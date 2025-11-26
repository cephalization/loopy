import { createContext, useContext } from "react";
import {
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  OnSelectionChangeFunc,
} from "@xyflow/react";
import type { CanvasActions } from "@/hooks/useCanvasActions";

export type CanvasContextValue = {
  // Data
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];

  // Handlers
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onSelectionChange: OnSelectionChangeFunc;
  addNode: (position?: { x: number; y: number }) => void;
  autoLayout: () => void;
  registerGetNodes: (fn: () => Array<{ id: string; measured?: { width?: number; height?: number } }>) => void;

  // Actions (reusable for menus)
  actions: CanvasActions;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Flow execution
  runFlow: () => void;
  resetFlow: () => void;
  isGenerating: boolean;
};

export const CanvasContext = createContext<CanvasContextValue | null>(null);

export function useCanvas() {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error("useCanvas must be used within a CanvasProvider");
  }
  return context;
}

