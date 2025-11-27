import { useShallow } from "zustand/react/shallow";
import { useCanvasStore } from "@/store";
import { useRunFlow } from "@/hooks/useRunFlow";

export type CanvasActions = {
  deleteSelected: () => void;
  duplicateSelected: () => void;
  selectAll: () => void;
  deselectAll: () => void;
};

/**
 * Hook to access canvas state and actions from the Zustand store.
 * This replaces the old React Context-based approach.
 */
export function useCanvas() {
  // Select stable state slices using shallow comparison
  const {
    nodes,
    edges,
    isGenerating,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    addNode,
    autoLayout,
    registerGetNodes,
    deleteSelected,
    duplicateSelected,
    selectAll,
    deselectAll,
    undo,
    redo,
    canUndo,
    canRedo,
    setEdgeExecutionState,
    clearEdgeExecutionStates,
    setNodeResponse,
    clearNodeResponses,
    setIsGenerating,
  } = useCanvasStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      isGenerating: s.isGenerating,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      onConnect: s.onConnect,
      onSelectionChange: s.onSelectionChange,
      addNode: s.addNode,
      autoLayout: s.autoLayout,
      registerGetNodes: s.registerGetNodes,
      deleteSelected: s.deleteSelected,
      duplicateSelected: s.duplicateSelected,
      selectAll: s.selectAll,
      deselectAll: s.deselectAll,
      undo: s.undo,
      redo: s.redo,
      canUndo: s.canUndo,
      canRedo: s.canRedo,
      setEdgeExecutionState: s.setEdgeExecutionState,
      clearEdgeExecutionStates: s.clearEdgeExecutionStates,
      setNodeResponse: s.setNodeResponse,
      clearNodeResponses: s.clearNodeResponses,
      setIsGenerating: s.setIsGenerating,
    }))
  );

  // Flow execution using the store's state
  const { runFlow, resetFlow } = useRunFlow({
    nodes,
    edges,
    setNodeResponse,
    clearNodeResponses,
    setEdgeExecutionState,
    clearEdgeExecutionStates,
    setIsGenerating,
    isGenerating,
  });

  // Bundle actions for menus/toolbar
  const actions: CanvasActions = {
    deleteSelected,
    duplicateSelected,
    selectAll,
    deselectAll,
  };

  return {
    // Data
    nodes,
    edges,

    // Handlers
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    addNode,
    autoLayout,
    registerGetNodes,

    // Actions
    actions,
    undo,
    redo,
    canUndo,
    canRedo,

    // Flow execution
    runFlow,
    resetFlow,
    isGenerating,
  };
}
