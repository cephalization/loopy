import { createContext, useContext } from "react";
import {
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from "@xyflow/react";

export type CanvasContextValue = {
  // Data
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];

  // Handlers
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: () => void;

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

