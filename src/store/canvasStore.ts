import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  Node as ReactFlowNode,
  Edge as ReactFlowEdge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  OnSelectionChangeFunc,
  NodeChange,
  EdgeChange,
} from "@xyflow/react";
import type { Node, Edge, Schema } from "@/schema";
import type { Zero } from "@rocicorp/zero";
import type { ReadonlyJSONValue } from "@rocicorp/zero";
import dagre from "dagre";

// ============================================================================
// Types
// ============================================================================

export type EdgeExecutionState = "selected" | "skipped" | "complete";

export type HistoryAction =
  | { type: "add_node"; node: Node }
  | { type: "delete_node"; node: Node; connectedEdges: Edge[] }
  | { type: "add_edge"; edge: Edge }
  | { type: "delete_edge"; edge: Edge }
  | {
      type: "move_node";
      nodeId: string;
      fromPosition: { x: number; y: number };
      toPosition: { x: number; y: number };
    }
  | {
      type: "duplicate_nodes";
      nodes: Node[];
      edges: Edge[];
    }
  | {
      type: "layout_nodes";
      positions: Array<{
        nodeId: string;
        fromPosition: { x: number; y: number };
        toPosition: { x: number; y: number };
      }>;
    };

export type NodeResponse = {
  response: string;
  loading: boolean;
};

type ZeroMutate = Zero<Schema>["mutate"];

// ============================================================================
// State Interface
// ============================================================================

interface CanvasState {
  // Configuration
  conversationId: string;

  // Zero-synced raw data
  rawNodes: Node[];
  rawEdges: Edge[];

  // React Flow nodes (derived, with selection state baked in)
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];

  // UI State
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  edgeExecutionStates: Map<string, EdgeExecutionState>;
  isGenerating: boolean;

  // Streaming responses - separate for fine-grained updates
  nodeResponses: Map<string, NodeResponse>;

  // History
  undoStack: HistoryAction[];
  redoStack: HistoryAction[];

  // Pending changes for debounced sync
  pendingPositions: Map<string, { x: number; y: number }>;
  pendingNodeData: Map<string, Record<string, unknown>>;

  // Position tracking for history (drag start positions)
  dragStartPositions: Map<string, { x: number; y: number }>;

  // React Flow getNodes ref for auto-layout
  getReactFlowNodes:
    | (() => Array<{
        id: string;
        measured?: { width?: number; height?: number };
      }>)
    | null;

  // Zero mutate reference
  zeroMutate: ZeroMutate | null;
}

// ============================================================================
// Actions Interface
// ============================================================================

interface CanvasActions {
  // Initialization
  initialize: (conversationId: string, zeroMutate: ZeroMutate) => void;
  setConversationId: (id: string) => void;

  // Zero sync
  syncFromZero: (nodes: Node[], edges: Edge[]) => void;

  // Node operations
  addNode: (position?: { x: number; y: number }) => void;
  deleteNode: (nodeId: string) => void;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  commitNodePosition: (nodeId: string) => void;

  // Edge operations
  addEdge: (edge: Edge) => void;
  deleteEdge: (edgeId: string) => void;

  // Selection
  setSelectedNodes: (nodeIds: string[]) => void;
  setSelectedEdges: (edgeIds: string[]) => void;
  selectAll: () => void;
  deselectAll: () => void;

  // React Flow handlers
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onSelectionChange: OnSelectionChangeFunc;

  // Canvas actions
  deleteSelected: () => void;
  duplicateSelected: () => void;
  autoLayout: () => void;
  registerGetNodes: (
    fn: () => Array<{
      id: string;
      measured?: { width?: number; height?: number };
    }>
  ) => void;

  // History
  pushAction: (action: HistoryAction) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Flow execution
  setIsGenerating: (generating: boolean) => void;
  setEdgeExecutionState: (edgeId: string, state: EdgeExecutionState) => void;
  clearEdgeExecutionStates: () => void;

  // Streaming responses (fine-grained updates)
  setNodeResponse: (nodeId: string, response: string, loading: boolean) => void;
  clearNodeResponses: () => void;

  // Flush pending changes to Zero
  flushPendingPositions: () => void;
  flushPendingNodeData: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_HISTORY_SIZE = 50;
const POSITION_DEBOUNCE_MS = 300;
const DATA_DEBOUNCE_MS = 300;
const RESPONSE_THROTTLE_MS = 500; // Throttle streaming response writes to Zero

// ============================================================================
// Debounce/Throttle timers (module-level for persistence across renders)
// ============================================================================

let positionFlushTimer: ReturnType<typeof setTimeout> | null = null;
let dataFlushTimer: ReturnType<typeof setTimeout> | null = null;

// Track last write time for response throttling (per node)
const lastResponseWriteTime = new Map<string, number>();

// ============================================================================
// Helper Functions
// ============================================================================

function toReactFlowNode(node: Node, selectedNodeIds: string[]): ReactFlowNode {
  return {
    id: node.id,
    type: "default",
    position: { x: node.positionX, y: node.positionY },
    data: node.data as Record<string, unknown>,
    selected: selectedNodeIds.includes(node.id),
    // initialWidth/Height for MiniMap before measurement
    initialWidth: 350,
    initialHeight: 250,
    style: {
      width: "auto",
      height: "auto",
      border: "none",
      background: "transparent",
    },
  };
}

function toReactFlowEdge(
  edge: Edge,
  selectedEdgeIds: string[],
  executionStates: Map<string, EdgeExecutionState>,
  isGenerating: boolean
): ReactFlowEdge {
  const executionState = executionStates.get(edge.id);

  let style: React.CSSProperties | undefined;
  let animated = false;

  if (executionState === "selected" || executionState === "complete") {
    style = { stroke: "#22c55e", strokeWidth: 2 };
    animated = isGenerating;
  } else if (executionState === "skipped") {
    style = { stroke: "#eab308", strokeWidth: 2, opacity: 0.5 };
  }

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    selected: selectedEdgeIds.includes(edge.id),
    style,
    animated,
  };
}

// ============================================================================
// Store Creation (with HMR support)
// ============================================================================

// Preserve store across hot module reloads in development
const createCanvasStore = () =>
  create<CanvasState & CanvasActions>()(
    subscribeWithSelector((set, get) => ({
      // ========================================================================
      // Initial State
      // ========================================================================
      conversationId: "",
      rawNodes: [],
      rawEdges: [],
      nodes: [],
      edges: [],
      selectedNodeIds: [],
      selectedEdgeIds: [],
      edgeExecutionStates: new Map(),
      isGenerating: false,
      nodeResponses: new Map(),
      undoStack: [],
      redoStack: [],
      pendingPositions: new Map(),
      pendingNodeData: new Map(),
      dragStartPositions: new Map(),
      getReactFlowNodes: null,
      zeroMutate: null,

      // ========================================================================
      // Initialization
      // ========================================================================
      initialize: (conversationId, zeroMutate) => {
        set({ conversationId, zeroMutate });
      },

      setConversationId: (id) => {
        set({ conversationId: id });
      },

      // ========================================================================
      // Zero Sync
      // ========================================================================
      syncFromZero: (nodes, edges) => {
        const state = get();
        const pendingPositions = state.pendingPositions;

        // Merge Zero nodes with pending local positions
        const mergedNodes = nodes.map((node) => {
          const pending = pendingPositions.get(node.id);
          if (pending) {
            return { ...node, positionX: pending.x, positionY: pending.y };
          }
          return node;
        });

        // Transform nodes to React Flow format
        const rfNodes = mergedNodes.map((n) =>
          toReactFlowNode(n, state.selectedNodeIds)
        );

        // Sync responses and loading states from Zero into nodeResponses Map
        // Only update if we're not currently streaming to this node locally
        const newNodeResponses = new Map(state.nodeResponses);
        nodes.forEach((node) => {
          const nodeData = node.data as Record<string, unknown>;
          const currentResponse = state.nodeResponses.get(node.id);

          // Don't overwrite if we're currently streaming to this node locally
          if (currentResponse?.loading && state.isGenerating) {
            return;
          }

          // Sync response and loading state from Zero
          const zeroResponse = (nodeData.response as string) || "";
          const zeroLoading = (nodeData.loading as boolean) || false;
          newNodeResponses.set(node.id, {
            response: zeroResponse,
            loading: zeroLoading,
          });
        });

        // Transform edges with current local execution states (edge states are local-only)
        const rfEdges = edges.map((e) =>
          toReactFlowEdge(
            e,
            state.selectedEdgeIds,
            state.edgeExecutionStates,
            state.isGenerating
          )
        );

        set({
          rawNodes: mergedNodes,
          rawEdges: edges,
          nodes: rfNodes,
          edges: rfEdges,
          nodeResponses: newNodeResponses,
        });
      },

      // ========================================================================
      // Node Operations
      // ========================================================================
      addNode: (position) => {
        const { conversationId, zeroMutate, pushAction } = get();
        if (!zeroMutate) return;

        const node: Node = {
          id: `node-${crypto.randomUUID()}`,
          type: "default",
          positionX: position?.x ?? Math.random() * 400,
          positionY: position?.y ?? Math.random() * 400,
          data: { label: "New Node", prompt: "" },
          conversationID: conversationId,
        };

        pushAction({ type: "add_node", node });
        zeroMutate.node.insert(node);
      },

      deleteNode: (nodeId) => {
        const { zeroMutate } = get();
        if (!zeroMutate) return;
        zeroMutate.node.delete({ id: nodeId });
      },

      updateNodePosition: (nodeId, x, y) => {
        const state = get();

        // Track drag start position for history
        if (!state.dragStartPositions.has(nodeId)) {
          const node = state.rawNodes.find((n) => n.id === nodeId);
          if (node) {
            state.dragStartPositions.set(nodeId, {
              x: node.positionX,
              y: node.positionY,
            });
          }
        }

        // Optimistic local update
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === nodeId ? { ...n, position: { x, y } } : n
          ),
          rawNodes: s.rawNodes.map((n) =>
            n.id === nodeId ? { ...n, positionX: x, positionY: y } : n
          ),
        }));

        // Track pending position
        state.pendingPositions.set(nodeId, { x, y });

        // Debounced flush to Zero
        if (positionFlushTimer) {
          clearTimeout(positionFlushTimer);
        }
        positionFlushTimer = setTimeout(() => {
          get().flushPendingPositions();
        }, POSITION_DEBOUNCE_MS);
      },

      commitNodePosition: (nodeId) => {
        const state = get();
        const startPos = state.dragStartPositions.get(nodeId);
        const currentPos = state.pendingPositions.get(nodeId);

        if (startPos && currentPos) {
          // Push to history
          state.pushAction({
            type: "move_node",
            nodeId,
            fromPosition: startPos,
            toPosition: currentPos,
          });
        }

        // Clean up tracking
        state.dragStartPositions.delete(nodeId);

        // Flush immediately on commit
        get().flushPendingPositions();
      },

      updateNodeData: (nodeId, data) => {
        const state = get();

        // Optimistic local update
        set((s) => {
          const newNodes = s.nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
          );
          const newRawNodes = s.rawNodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: { ...(n.data as object), ...data } as Node["data"],
                }
              : n
          ) as Node[];
          return { nodes: newNodes, rawNodes: newRawNodes };
        });

        // Track pending data
        const existingPending = state.pendingNodeData.get(nodeId) ?? {};
        state.pendingNodeData.set(nodeId, { ...existingPending, ...data });

        // Debounced flush to Zero
        if (dataFlushTimer) {
          clearTimeout(dataFlushTimer);
        }
        dataFlushTimer = setTimeout(() => {
          get().flushPendingNodeData();
        }, DATA_DEBOUNCE_MS);
      },

      // ========================================================================
      // Edge Operations
      // ========================================================================
      addEdge: (edge) => {
        const { zeroMutate, pushAction } = get();
        if (!zeroMutate) return;

        pushAction({ type: "add_edge", edge });
        zeroMutate.edge.insert(edge);
      },

      deleteEdge: (edgeId) => {
        const { zeroMutate } = get();
        if (!zeroMutate) return;
        zeroMutate.edge.delete({ id: edgeId });
      },

      // ========================================================================
      // Selection
      // ========================================================================
      setSelectedNodes: (nodeIds) => {
        set((s) => ({
          selectedNodeIds: nodeIds,
          nodes: s.nodes.map((n) => ({
            ...n,
            selected: nodeIds.includes(n.id),
          })),
        }));
      },

      setSelectedEdges: (edgeIds) => {
        set((s) => ({
          selectedEdgeIds: edgeIds,
          edges: s.edges.map((e) => ({
            ...e,
            selected: edgeIds.includes(e.id),
          })),
        }));
      },

      selectAll: () => {
        const { nodes, setSelectedNodes } = get();
        setSelectedNodes(nodes.map((n) => n.id));
      },

      deselectAll: () => {
        get().setSelectedNodes([]);
        get().setSelectedEdges([]);
      },

      // ========================================================================
      // React Flow Handlers
      // ========================================================================
      onNodesChange: (changes: NodeChange[]) => {
        const state = get();

        changes.forEach((change) => {
          if (change.type === "position") {
            if (change.dragging && change.position) {
              state.updateNodePosition(
                change.id,
                change.position.x,
                change.position.y
              );
            } else if (!change.dragging && change.position) {
              // Drag ended
              state.commitNodePosition(change.id);
            }
          } else if (change.type === "remove") {
            const node = state.rawNodes.find((n) => n.id === change.id);
            if (node) {
              const connectedEdges = state.rawEdges.filter(
                (e) => e.source === change.id || e.target === change.id
              );
              state.pushAction({ type: "delete_node", node, connectedEdges });
            }
            state.deleteNode(change.id);
          } else if (change.type === "select") {
            set((s) => {
              const newSelected = change.selected
                ? s.selectedNodeIds.includes(change.id)
                  ? s.selectedNodeIds
                  : [...s.selectedNodeIds, change.id]
                : s.selectedNodeIds.filter((id) => id !== change.id);

              return {
                selectedNodeIds: newSelected,
                nodes: s.nodes.map((n) => ({
                  ...n,
                  selected: newSelected.includes(n.id),
                })),
              };
            });
          }
        });
      },

      onEdgesChange: (changes: EdgeChange[]) => {
        const state = get();

        changes.forEach((change) => {
          if (change.type === "remove") {
            const edge = state.rawEdges.find((e) => e.id === change.id);
            if (edge) {
              state.pushAction({ type: "delete_edge", edge });
            }
            state.deleteEdge(change.id);
          } else if (change.type === "select") {
            set((s) => {
              const newSelected = change.selected
                ? s.selectedEdgeIds.includes(change.id)
                  ? s.selectedEdgeIds
                  : [...s.selectedEdgeIds, change.id]
                : s.selectedEdgeIds.filter((id) => id !== change.id);

              return {
                selectedEdgeIds: newSelected,
                edges: s.edges.map((e) => ({
                  ...e,
                  selected: newSelected.includes(e.id),
                })),
              };
            });
          }
        });
      },

      onConnect: (connection) => {
        const { conversationId, addEdge: addEdgeAction } = get();

        const edge: Edge = {
          id: `edge-${crypto.randomUUID()}`,
          source: connection.source!,
          target: connection.target!,
          sourceHandle: connection.sourceHandle ?? null,
          targetHandle: connection.targetHandle ?? null,
          conversationID: conversationId,
        };

        addEdgeAction(edge);
      },

      onSelectionChange: ({ nodes, edges }) => {
        set({
          selectedNodeIds: nodes.map((n) => n.id),
          selectedEdgeIds: edges.map((e) => e.id),
        });
      },

      // ========================================================================
      // Canvas Actions
      // ========================================================================
      deleteSelected: () => {
        const state = get();
        const {
          selectedNodeIds,
          selectedEdgeIds,
          rawNodes,
          rawEdges,
          zeroMutate,
          pushAction,
        } = state;
        if (!zeroMutate) return;

        // Delete selected edges first (that aren't connected to nodes being deleted)
        selectedEdgeIds.forEach((edgeId) => {
          const edge = rawEdges.find((e) => e.id === edgeId);
          if (!edge) return;

          if (
            selectedNodeIds.includes(edge.source) ||
            selectedNodeIds.includes(edge.target)
          ) {
            return;
          }

          pushAction({ type: "delete_edge", edge });
          zeroMutate.edge.delete({ id: edgeId });
        });

        // Delete selected nodes
        selectedNodeIds.forEach((nodeId) => {
          const node = rawNodes.find((n) => n.id === nodeId);
          if (!node) return;

          const connectedEdges = rawEdges.filter(
            (e) => e.source === nodeId || e.target === nodeId
          );

          pushAction({ type: "delete_node", node, connectedEdges });

          connectedEdges.forEach((edge) =>
            zeroMutate.edge.delete({ id: edge.id })
          );
          zeroMutate.node.delete({ id: nodeId });
        });
      },

      duplicateSelected: () => {
        const state = get();
        const {
          selectedNodeIds,
          rawNodes,
          rawEdges,
          conversationId,
          zeroMutate,
          pushAction,
          setSelectedNodes,
        } = state;
        if (!zeroMutate || selectedNodeIds.length === 0) return;

        const OFFSET = 50;
        const nodeIdMap = new Map<string, string>();
        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        // First pass: create new nodes
        selectedNodeIds.forEach((nodeId) => {
          const originalNode = rawNodes.find((n) => n.id === nodeId);
          if (!originalNode) return;

          const newId = `node-${crypto.randomUUID()}`;
          nodeIdMap.set(nodeId, newId);

          const newNode: Node = {
            id: newId,
            type: originalNode.type,
            positionX: originalNode.positionX + OFFSET,
            positionY: originalNode.positionY + OFFSET,
            data: originalNode.data,
            conversationID: conversationId,
          };

          newNodes.push(newNode);
          zeroMutate.node.insert(newNode);
        });

        // Second pass: recreate edges between duplicated nodes
        rawEdges.forEach((edge) => {
          const newSourceId = nodeIdMap.get(edge.source);
          const newTargetId = nodeIdMap.get(edge.target);

          if (newSourceId && newTargetId) {
            const newEdge: Edge = {
              id: `edge-${crypto.randomUUID()}`,
              source: newSourceId,
              target: newTargetId,
              sourceHandle: edge.sourceHandle,
              targetHandle: edge.targetHandle,
              conversationID: conversationId,
            };

            newEdges.push(newEdge);
            zeroMutate.edge.insert(newEdge);
          }
        });

        pushAction({
          type: "duplicate_nodes",
          nodes: newNodes,
          edges: newEdges,
        });
        setSelectedNodes(newNodes.map((n) => n.id));
      },

      autoLayout: () => {
        const state = get();
        const {
          rawNodes,
          rawEdges,
          zeroMutate,
          pushAction,
          getReactFlowNodes,
        } = state;
        if (!zeroMutate || rawNodes.length === 0) return;

        const DEFAULT_WIDTH = 350;
        const DEFAULT_HEIGHT = 320;

        const measuredNodes = getReactFlowNodes?.() ?? [];
        const nodeDimensions = new Map<
          string,
          { width: number; height: number }
        >();

        measuredNodes.forEach((n) => {
          nodeDimensions.set(n.id, {
            width: n.measured?.width ?? DEFAULT_WIDTH,
            height: n.measured?.height ?? DEFAULT_HEIGHT,
          });
        });

        const g = new dagre.graphlib.Graph();
        g.setGraph({
          rankdir: "TB",
          nodesep: 50,
          ranksep: 60,
          marginx: 50,
          marginy: 50,
        });
        g.setDefaultEdgeLabel(() => ({}));

        rawNodes.forEach((node) => {
          const dims = nodeDimensions.get(node.id) ?? {
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
          };
          g.setNode(node.id, { width: dims.width, height: dims.height });
        });

        rawEdges.forEach((edge) => {
          g.setEdge(edge.source, edge.target);
        });

        dagre.layout(g);

        const positionChanges: Array<{
          nodeId: string;
          fromPosition: { x: number; y: number };
          toPosition: { x: number; y: number };
        }> = [];

        g.nodes().forEach((nodeId) => {
          const nodeWithPosition = g.node(nodeId);
          const currentNode = rawNodes.find((n) => n.id === nodeId);

          if (nodeWithPosition && currentNode) {
            const dims = nodeDimensions.get(nodeId) ?? {
              width: DEFAULT_WIDTH,
              height: DEFAULT_HEIGHT,
            };
            const newX = nodeWithPosition.x - dims.width / 2;
            const newY = nodeWithPosition.y - dims.height / 2;

            positionChanges.push({
              nodeId,
              fromPosition: {
                x: currentNode.positionX,
                y: currentNode.positionY,
              },
              toPosition: { x: newX, y: newY },
            });

            zeroMutate.node.update({
              id: nodeId,
              positionX: newX,
              positionY: newY,
            });
          }
        });

        if (positionChanges.length > 0) {
          pushAction({ type: "layout_nodes", positions: positionChanges });
        }
      },

      registerGetNodes: (fn) => {
        set({ getReactFlowNodes: fn });
      },

      // ========================================================================
      // History
      // ========================================================================
      pushAction: (action) => {
        set((s) => {
          const newStack = [...s.undoStack, action];
          if (newStack.length > MAX_HISTORY_SIZE) {
            newStack.shift();
          }
          return { undoStack: newStack, redoStack: [] };
        });
      },

      undo: () => {
        const state = get();
        const { undoStack, zeroMutate } = state;
        if (!zeroMutate || undoStack.length === 0) return;

        const action = undoStack[undoStack.length - 1];

        // Perform inverse operation
        switch (action.type) {
          case "add_node":
            zeroMutate.node.delete({ id: action.node.id });
            break;
          case "delete_node":
            zeroMutate.node.insert(action.node);
            action.connectedEdges.forEach((edge) =>
              zeroMutate.edge.insert(edge)
            );
            break;
          case "add_edge":
            zeroMutate.edge.delete({ id: action.edge.id });
            break;
          case "delete_edge":
            zeroMutate.edge.insert(action.edge);
            break;
          case "move_node":
            zeroMutate.node.update({
              id: action.nodeId,
              positionX: action.fromPosition.x,
              positionY: action.fromPosition.y,
            });
            break;
          case "duplicate_nodes":
            action.nodes.forEach((node) =>
              zeroMutate.node.delete({ id: node.id })
            );
            break;
          case "layout_nodes":
            action.positions.forEach((pos) =>
              zeroMutate.node.update({
                id: pos.nodeId,
                positionX: pos.fromPosition.x,
                positionY: pos.fromPosition.y,
              })
            );
            break;
        }

        set((s) => ({
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [...s.redoStack, action],
        }));
      },

      redo: () => {
        const state = get();
        const { redoStack, zeroMutate } = state;
        if (!zeroMutate || redoStack.length === 0) return;

        const action = redoStack[redoStack.length - 1];

        // Re-perform operation
        switch (action.type) {
          case "add_node":
            zeroMutate.node.insert(action.node);
            break;
          case "delete_node":
            action.connectedEdges.forEach((edge) =>
              zeroMutate.edge.delete({ id: edge.id })
            );
            zeroMutate.node.delete({ id: action.node.id });
            break;
          case "add_edge":
            zeroMutate.edge.insert(action.edge);
            break;
          case "delete_edge":
            zeroMutate.edge.delete({ id: action.edge.id });
            break;
          case "move_node":
            zeroMutate.node.update({
              id: action.nodeId,
              positionX: action.toPosition.x,
              positionY: action.toPosition.y,
            });
            break;
          case "duplicate_nodes":
            action.nodes.forEach((node) => zeroMutate.node.insert(node));
            action.edges.forEach((edge) => zeroMutate.edge.insert(edge));
            break;
          case "layout_nodes":
            action.positions.forEach((pos) =>
              zeroMutate.node.update({
                id: pos.nodeId,
                positionX: pos.toPosition.x,
                positionY: pos.toPosition.y,
              })
            );
            break;
        }

        set((s) => ({
          redoStack: s.redoStack.slice(0, -1),
          undoStack: [...s.undoStack, action],
        }));
      },

      canUndo: () => get().undoStack.length > 0,
      canRedo: () => get().redoStack.length > 0,

      // ========================================================================
      // Flow Execution
      // ========================================================================
      setIsGenerating: (generating) => {
        set({ isGenerating: generating });
      },

      setEdgeExecutionState: (edgeId, executionState) => {
        // Edge execution states are local-only (not synced to Zero)
        set((s) => {
          const newStates = new Map(s.edgeExecutionStates);
          newStates.set(edgeId, executionState);
          // Update edges with new styling
          const newEdges = s.edges.map((e) => {
            if (e.id === edgeId) {
              const style =
                executionState === "selected" || executionState === "complete"
                  ? { stroke: "#22c55e", strokeWidth: 2 }
                  : executionState === "skipped"
                    ? { stroke: "#eab308", strokeWidth: 2, opacity: 0.5 }
                    : undefined;
              return {
                ...e,
                style,
                animated:
                  s.isGenerating &&
                  (executionState === "selected" ||
                    executionState === "complete"),
              };
            }
            return e;
          });
          return { edgeExecutionStates: newStates, edges: newEdges };
        });
      },

      clearEdgeExecutionStates: () => {
        // Edge execution states are local-only
        set((s) => ({
          edgeExecutionStates: new Map(),
          edges: s.edges.map((e) => ({
            ...e,
            style: undefined,
            animated: false,
          })),
        }));
      },

      // ========================================================================
      // Streaming Responses (Fine-grained)
      // ========================================================================
      setNodeResponse: (nodeId, response, loading) => {
        set((s) => {
          const newResponses = new Map(s.nodeResponses);
          newResponses.set(nodeId, { response, loading });
          return { nodeResponses: newResponses };
        });

        // Persist to Zero with throttling during streaming
        const { rawNodes, zeroMutate } = get();
        if (!zeroMutate) return;

        const now = Date.now();
        const lastWrite = lastResponseWriteTime.get(nodeId) ?? 0;
        const timeSinceLastWrite = now - lastWrite;

        // Write immediately when loading state changes, or throttle response during streaming
        const shouldWrite =
          !loading || timeSinceLastWrite >= RESPONSE_THROTTLE_MS;

        if (shouldWrite) {
          const node = rawNodes.find((n) => n.id === nodeId);
          if (node) {
            lastResponseWriteTime.set(nodeId, now);
            zeroMutate.node.update({
              id: nodeId,
              data: {
                ...(node.data as object),
                response,
                loading, // Sync loading state for other users to see spinners
              } as ReadonlyJSONValue,
            });
          }
        }
      },

      clearNodeResponses: () => {
        const { rawNodes, zeroMutate } = get();

        // Clear throttle tracking
        lastResponseWriteTime.clear();

        // Clear responses in local store
        const clearedResponses = new Map<string, NodeResponse>();
        rawNodes.forEach((node) => {
          clearedResponses.set(node.id, { response: "", loading: false });
        });
        set({ nodeResponses: clearedResponses });

        // Also clear responses from Zero (for persistence/sync)
        if (zeroMutate) {
          rawNodes.forEach((node) => {
            const nodeData = node.data as Record<string, unknown>;
            if (
              nodeData.response ||
              nodeData.loading ||
              nodeData.selectionState
            ) {
              // Strip response, loading, and selectionState from persisted data
              const cleanData = Object.fromEntries(
                Object.entries(nodeData).filter(
                  ([key]) =>
                    !["response", "loading", "selectionState"].includes(key)
                )
              );
              zeroMutate.node.update({
                id: node.id,
                data: cleanData as ReadonlyJSONValue,
              });
            }
          });
        }
      },

      // ========================================================================
      // Flush Pending Changes
      // ========================================================================
      flushPendingPositions: () => {
        const { pendingPositions, zeroMutate } = get();
        if (!zeroMutate || pendingPositions.size === 0) return;

        pendingPositions.forEach((pos, nodeId) => {
          zeroMutate.node.update({
            id: nodeId,
            positionX: pos.x,
            positionY: pos.y,
          });
        });

        set({ pendingPositions: new Map() });
      },

      flushPendingNodeData: () => {
        const { pendingNodeData, zeroMutate, rawNodes } = get();
        if (!zeroMutate || pendingNodeData.size === 0) return;

        pendingNodeData.forEach((data, nodeId) => {
          const node = rawNodes.find((n) => n.id === nodeId);
          if (node) {
            zeroMutate.node.update({
              id: nodeId,
              data: { ...(node.data as object), ...data } as ReadonlyJSONValue,
            });
          }
        });

        set({ pendingNodeData: new Map() });
      },
    }))
  );

// Preserve store across HMR - check if store already exists in module scope
export const useCanvasStore =
  (import.meta.hot?.data?.store as ReturnType<typeof createCanvasStore>) ??
  createCanvasStore();

// Store reference for HMR
if (import.meta.hot) {
  import.meta.hot.data.store = useCanvasStore;
}

// ============================================================================
// Selectors (for fine-grained subscriptions)
// ============================================================================

export const selectNodes = (state: CanvasState) => state.nodes;
export const selectEdges = (state: CanvasState) => state.edges;
export const selectRawNodes = (state: CanvasState) => state.rawNodes;
export const selectRawEdges = (state: CanvasState) => state.rawEdges;
export const selectIsGenerating = (state: CanvasState) => state.isGenerating;
export const selectSelectedNodeIds = (state: CanvasState) =>
  state.selectedNodeIds;
export const selectSelectedEdgeIds = (state: CanvasState) =>
  state.selectedEdgeIds;

// Default response object - stable reference to prevent re-renders
const DEFAULT_NODE_RESPONSE: NodeResponse = { response: "", loading: false };

// Fine-grained node response selector (prevents cascade when streaming)
export const selectNodeResponse = (nodeId: string) => (state: CanvasState) =>
  state.nodeResponses.get(nodeId) ?? DEFAULT_NODE_RESPONSE;
