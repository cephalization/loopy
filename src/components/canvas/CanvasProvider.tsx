import { useCallback, useMemo, ReactNode, useRef } from "react";
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

type CanvasProviderProps = {
  conversationId: string;
  children: ReactNode;
};

export function CanvasProvider({
  conversationId,
  children,
}: CanvasProviderProps) {
  const z = useZero<Schema>();
  const selectedNodesRef = useRef<string[]>([]);

  // Query Zero
  const [nodes] = useQuery(
    z.query.node.where("conversationID", conversationId)
  );
  const [edges] = useQuery(
    z.query.edge.where("conversationID", conversationId)
  );

  // Transform to React Flow format
  const rfNodes = useMemo(() => {
    return nodes.map((n) => ({
      id: n.id,
      type: n.type === "conversation" ? "conversation" : "default",
      position: { x: n.positionX, y: n.positionY },
      data: n.data as Record<string, unknown>,
      selected: selectedNodesRef.current.includes(n.id),
      style: { width: "auto", border: "none", background: "transparent" },
    }));
  }, [nodes]);

  const rfEdges = useMemo(() => {
    return edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }));
  }, [edges]);

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
    selectedNodesRef.current = nodeIds;
  }, []);

  const getSelectedNodes = useCallback(() => {
    return selectedNodesRef.current;
  }, []);

  const onSelectionChange: OnSelectionChangeFunc = useCallback(({ nodes }) => {
    selectedNodesRef.current = nodes.map((n) => n.id);
  }, []);

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
    pushAction,
  });

  // Keyboard shortcuts
  useCanvasKeyboardShortcuts({
    actions,
    undo,
    redo,
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
          if (change.selected) {
            if (!selectedNodesRef.current.includes(change.id)) {
              selectedNodesRef.current = [
                ...selectedNodesRef.current,
                change.id,
              ];
            }
          } else {
            selectedNodesRef.current = selectedNodesRef.current.filter(
              (id) => id !== change.id
            );
          }
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
        type: "conversation",
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
