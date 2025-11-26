import { useCallback, useMemo, ReactNode, useRef, useState } from "react";
import {
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  OnSelectionChangeFunc,
} from "@xyflow/react";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { Schema, Node, Edge } from "@/schema";
import { useRunFlow } from "@/hooks/useRunFlow";
import { useCanvasHistory } from "@/hooks/useCanvasHistory";
import { useCanvasActions } from "@/hooks/useCanvasActions";
import { useCanvasKeyboardShortcuts } from "@/hooks/useCanvasKeyboardShortcuts";
import type { ReadonlyJSONValue } from "@rocicorp/zero";
import { CanvasContext } from "./useCanvas";
import dagre from "dagre";

type CanvasProviderProps = {
  conversationId: string;
  children: ReactNode;
};

export function CanvasProvider({
  conversationId,
  children,
}: CanvasProviderProps) {
  const z = useZero<Schema>();
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);

  // Query Zero
  const [nodes] = useQuery(
    z.query.node.where("conversationID", conversationId)
  );
  const [edges] = useQuery(
    z.query.edge.where("conversationID", conversationId)
  );

  // Transform to React Flow format
  // Use 'default' type for all nodes to get built-in React Flow selection/hover styling
  const rfNodes = useMemo(() => {
    return nodes.map((n) => ({
      id: n.id,
      type: "default",
      position: { x: n.positionX, y: n.positionY },
      data: n.data as Record<string, unknown>,
      selected: selectedNodeIds.includes(n.id),
      // initialWidth/Height for MiniMap before measurement, doesn't constrain actual size
      initialWidth: 350,
      initialHeight: 250,
      style: {
        width: "auto",
        height: "auto",
        border: "none",
        background: "transparent",
      },
    }));
  }, [nodes, selectedNodeIds]);

  const rfEdges = useMemo(() => {
    return edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      selected: selectedEdgeIds.includes(e.id),
    }));
  }, [edges, selectedEdgeIds]);

  // Low-level mutation helpers (for history system)
  const insertNode = useCallback(
    (node: Node) => {
      z.mutate.node.insert(node);
    },
    [z]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      z.mutate.node.delete({ id: nodeId });
    },
    [z]
  );

  const insertEdge = useCallback(
    (edge: Edge) => {
      z.mutate.edge.insert(edge);
    },
    [z]
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      z.mutate.edge.delete({ id: edgeId });
    },
    [z]
  );

  const updateNodePosition = useCallback(
    (nodeId: string, x: number, y: number) => {
      z.mutate.node.update({ id: nodeId, positionX: x, positionY: y });
    },
    [z]
  );

  // History system
  const { pushAction, undo, redo, canUndo, canRedo } = useCanvasHistory({
    insertNode,
    deleteNode,
    insertEdge,
    deleteEdge,
    updateNodePosition,
  });

  // Selection management
  const setSelectedNodes = useCallback((nodeIds: string[]) => {
    setSelectedNodeIds(nodeIds);
  }, []);

  const getSelectedNodes = useCallback(() => {
    return selectedNodeIds;
  }, [selectedNodeIds]);

  const getSelectedEdges = useCallback(() => {
    return selectedEdgeIds;
  }, [selectedEdgeIds]);

  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes, edges: selectedEdges }) => {
      setSelectedNodeIds(nodes.map((n) => n.id));
      setSelectedEdgeIds(selectedEdges.map((e) => e.id));
    },
    []
  );

  // Canvas actions
  const actions = useCanvasActions({
    nodes: rfNodes,
    edges: rfEdges,
    rawNodes: nodes,
    rawEdges: edges,
    conversationId,
    insertNode,
    deleteNode,
    insertEdge,
    deleteEdge,
    setSelectedNodes,
    getSelectedNodes,
    getSelectedEdges,
    pushAction,
  });

  // Track position changes for undo
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map()
  );

  // Handlers
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === "position") {
          if (change.dragging && change.position) {
            // Store initial position when drag starts
            if (!nodePositionsRef.current.has(change.id)) {
              const node = nodes.find((n) => n.id === change.id);
              if (node) {
                nodePositionsRef.current.set(change.id, {
                  x: node.positionX,
                  y: node.positionY,
                });
              }
            }
            // Update position during drag
            z.mutate.node.update({
              id: change.id,
              positionX: change.position.x,
              positionY: change.position.y,
            });
          } else if (!change.dragging && change.position) {
            // Drag ended - push to history if position changed
            const initialPos = nodePositionsRef.current.get(change.id);
            if (initialPos) {
              pushAction({
                type: "move_node",
                nodeId: change.id,
                fromPosition: initialPos,
                toPosition: change.position,
              });
              nodePositionsRef.current.delete(change.id);
            }
          }
        } else if (change.type === "remove") {
          // Note: Deletion is handled through actions.deleteSelected() for history tracking
          // This is a fallback for direct React Flow deletions
          const node = nodes.find((n) => n.id === change.id);
          if (node) {
            const connectedEdges = edges.filter(
              (e) => e.source === change.id || e.target === change.id
            );
            pushAction({
              type: "delete_node",
              node,
              connectedEdges,
            });
          }
          z.mutate.node.delete({ id: change.id });
        } else if (change.type === "select") {
          // Update selection state
          setSelectedNodeIds((prev) => {
            if (change.selected) {
              return prev.includes(change.id) ? prev : [...prev, change.id];
            } else {
              return prev.filter((id) => id !== change.id);
            }
          });
        }
      });
    },
    [z, nodes, edges, pushAction]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === "remove") {
          const edge = edges.find((e) => e.id === change.id);
          if (edge) {
            pushAction({ type: "delete_edge", edge });
          }
          z.mutate.edge.delete({ id: change.id });
        } else if (change.type === "select") {
          // Track edge selection with state to trigger re-render
          setSelectedEdgeIds((prev) => {
            if (change.selected) {
              return prev.includes(change.id) ? prev : [...prev, change.id];
            } else {
              return prev.filter((id) => id !== change.id);
            }
          });
        }
      });
    },
    [z, edges, pushAction]
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      const edge: Edge = {
        id: `edge-${crypto.randomUUID()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? null,
        targetHandle: connection.targetHandle ?? null,
        conversationID: conversationId,
      };
      pushAction({ type: "add_edge", edge });
      z.mutate.edge.insert(edge);
    },
    [z, conversationId, pushAction]
  );

  const addNode = useCallback(
    (position?: { x: number; y: number }) => {
      const node: Node = {
        id: `node-${crypto.randomUUID()}`,
        type: "default",
        positionX: position?.x ?? Math.random() * 400,
        positionY: position?.y ?? Math.random() * 400,
        data: { label: "New Node", prompt: "" },
        conversationID: conversationId,
      };
      pushAction({ type: "add_node", node });
      z.mutate.node.insert(node);
    },
    [z, conversationId, pushAction]
  );

  const updateNodeData = useCallback(
    (nodeId: string, data: ReadonlyJSONValue) => {
      z.mutate.node.update({ id: nodeId, data });
    },
    [z]
  );

  // Ref to hold getNodes function from React Flow (set by FlowCanvas)
  const getReactFlowNodesRef = useRef<
    | (() => Array<{
        id: string;
        measured?: { width?: number; height?: number };
      }>)
    | null
  >(null);

  // Allow FlowCanvas to register the getNodes function
  const registerGetNodes = useCallback(
    (
      fn: () => Array<{
        id: string;
        measured?: { width?: number; height?: number };
      }>
    ) => {
      getReactFlowNodesRef.current = fn;
    },
    []
  );

  // Auto-layout using dagre
  const autoLayout = useCallback(() => {
    if (nodes.length === 0) return;

    // Default dimensions matching ConversationNode (w-[350px], estimated height)
    const DEFAULT_WIDTH = 350;
    const DEFAULT_HEIGHT = 320;

    // Try to get measured dimensions from React Flow
    const measuredNodes = getReactFlowNodesRef.current?.() ?? [];
    const nodeDimensions = new Map<string, { width: number; height: number }>();

    measuredNodes.forEach((n) => {
      nodeDimensions.set(n.id, {
        width: n.measured?.width ?? DEFAULT_WIDTH,
        height: n.measured?.height ?? DEFAULT_HEIGHT,
      });
    });

    // Create a new dagre graph
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: "TB", // Top to bottom layout
      nodesep: 50, // Horizontal spacing between nodes
      ranksep: 60, // Vertical spacing between ranks
      marginx: 50,
      marginy: 50,
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes to the graph with their measured or default dimensions
    nodes.forEach((node) => {
      const dims = nodeDimensions.get(node.id) ?? {
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
      };
      g.setNode(node.id, { width: dims.width, height: dims.height });
    });

    // Add edges to the graph
    edges.forEach((edge) => {
      g.setEdge(edge.source, edge.target);
    });

    // Run the layout algorithm
    dagre.layout(g);

    // Collect position changes for history
    const positionChanges: Array<{
      nodeId: string;
      fromPosition: { x: number; y: number };
      toPosition: { x: number; y: number };
    }> = [];

    // Apply the new positions
    g.nodes().forEach((nodeId) => {
      const nodeWithPosition = g.node(nodeId);
      const currentNode = nodes.find((n) => n.id === nodeId);

      if (nodeWithPosition && currentNode) {
        const dims = nodeDimensions.get(nodeId) ?? {
          width: DEFAULT_WIDTH,
          height: DEFAULT_HEIGHT,
        };
        // Dagre gives center position, we need top-left
        const newX = nodeWithPosition.x - dims.width / 2;
        const newY = nodeWithPosition.y - dims.height / 2;

        positionChanges.push({
          nodeId,
          fromPosition: { x: currentNode.positionX, y: currentNode.positionY },
          toPosition: { x: newX, y: newY },
        });

        z.mutate.node.update({
          id: nodeId,
          positionX: newX,
          positionY: newY,
        });
      }
    });

    // Push to history for undo support
    if (positionChanges.length > 0) {
      pushAction({
        type: "layout_nodes",
        positions: positionChanges,
      });
    }
  }, [nodes, edges, z, pushAction]);

  // Keyboard shortcuts
  useCanvasKeyboardShortcuts({
    actions,
    undo,
    redo,
    autoLayout,
  });

  const { runFlow, resetFlow, isGenerating } = useRunFlow({
    nodes: rfNodes,
    edges: rfEdges,
    updateNodeData,
  });

  const value = useMemo(
    () => ({
      nodes: rfNodes,
      edges: rfEdges,
      onNodesChange,
      onEdgesChange,
      onConnect,
      onSelectionChange,
      addNode,
      autoLayout,
      registerGetNodes,
      actions,
      undo,
      redo,
      canUndo,
      canRedo,
      runFlow,
      resetFlow,
      isGenerating,
    }),
    [
      rfNodes,
      rfEdges,
      onNodesChange,
      onEdgesChange,
      onConnect,
      onSelectionChange,
      addNode,
      autoLayout,
      registerGetNodes,
      actions,
      undo,
      redo,
      canUndo,
      canRedo,
      runFlow,
      resetFlow,
      isGenerating,
    ]
  );

  return (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  );
}
