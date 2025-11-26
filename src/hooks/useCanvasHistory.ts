import { useCallback, useRef } from "react";
import type { Node, Edge } from "@/schema";

// Action types for undo/redo
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
    };

type UndoHandlers = {
  insertNode: (node: Node) => void;
  deleteNode: (nodeId: string) => void;
  insertEdge: (edge: Edge) => void;
  deleteEdge: (edgeId: string) => void;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
};

const MAX_HISTORY_SIZE = 50;

export function useCanvasHistory(handlers: UndoHandlers) {
  const undoStack = useRef<HistoryAction[]>([]);
  const redoStack = useRef<HistoryAction[]>([]);

  const pushAction = useCallback((action: HistoryAction) => {
    undoStack.current.push(action);
    if (undoStack.current.length > MAX_HISTORY_SIZE) {
      undoStack.current.shift();
    }
    // Clear redo stack when new action is performed
    redoStack.current = [];
  }, []);

  const undo = useCallback(() => {
    const action = undoStack.current.pop();
    if (!action) return;

    // Perform the inverse operation
    switch (action.type) {
      case "add_node":
        handlers.deleteNode(action.node.id);
        break;
      case "delete_node":
        handlers.insertNode(action.node);
        // Restore connected edges
        action.connectedEdges.forEach((edge) => handlers.insertEdge(edge));
        break;
      case "add_edge":
        handlers.deleteEdge(action.edge.id);
        break;
      case "delete_edge":
        handlers.insertEdge(action.edge);
        break;
      case "move_node":
        handlers.updateNodePosition(
          action.nodeId,
          action.fromPosition.x,
          action.fromPosition.y
        );
        break;
      case "duplicate_nodes":
        // Delete all duplicated nodes (edges will be deleted via cascade)
        action.nodes.forEach((node) => handlers.deleteNode(node.id));
        break;
    }

    redoStack.current.push(action);
  }, [handlers]);

  const redo = useCallback(() => {
    const action = redoStack.current.pop();
    if (!action) return;

    // Re-perform the operation
    switch (action.type) {
      case "add_node":
        handlers.insertNode(action.node);
        break;
      case "delete_node":
        // Delete edges first, then node
        action.connectedEdges.forEach((edge) => handlers.deleteEdge(edge.id));
        handlers.deleteNode(action.node.id);
        break;
      case "add_edge":
        handlers.insertEdge(action.edge);
        break;
      case "delete_edge":
        handlers.deleteEdge(action.edge.id);
        break;
      case "move_node":
        handlers.updateNodePosition(
          action.nodeId,
          action.toPosition.x,
          action.toPosition.y
        );
        break;
      case "duplicate_nodes":
        // Re-insert all duplicated nodes and edges
        action.nodes.forEach((node) => handlers.insertNode(node));
        action.edges.forEach((edge) => handlers.insertEdge(edge));
        break;
    }

    undoStack.current.push(action);
  }, [handlers]);

  const canUndo = useCallback(() => undoStack.current.length > 0, []);
  const canRedo = useCallback(() => redoStack.current.length > 0, []);

  return {
    pushAction,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}

