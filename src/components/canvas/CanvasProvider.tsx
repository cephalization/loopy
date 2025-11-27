import { useEffect, ReactNode } from "react";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { Schema } from "@/schema";
import { useCanvasStore } from "@/store";
import { useCanvasKeyboardShortcuts } from "@/hooks/useCanvasKeyboardShortcuts";

type CanvasProviderProps = {
  conversationId: string;
  children: ReactNode;
};

/**
 * CanvasProvider syncs Zero data into the Zustand store and sets up keyboard shortcuts.
 * All state and mutations are managed through the store - this component just bridges Zero.
 */
export function CanvasProvider({
  conversationId,
  children,
}: CanvasProviderProps) {
  const z = useZero<Schema>();

  // Query Zero for nodes and edges
  const [nodes] = useQuery(
    z.query.node.where("conversationID", conversationId)
  );
  const [edges] = useQuery(
    z.query.edge.where("conversationID", conversationId)
  );

  // Initialize store with conversationId and Zero mutate reference
  // Use getState() to avoid re-render loops - actions are stable
  useEffect(() => {
    useCanvasStore.getState().initialize(conversationId, z.mutate);
  }, [conversationId, z.mutate]);

  // Sync Zero data changes into the store
  // Use getState() to avoid creating new function references each render
  useEffect(() => {
    useCanvasStore.getState().syncFromZero(nodes, edges);
  }, [nodes, edges]);

  // Get actions for keyboard shortcuts - these are stable references from the store
  const actions = {
    deleteSelected: useCanvasStore.getState().deleteSelected,
    duplicateSelected: useCanvasStore.getState().duplicateSelected,
    selectAll: useCanvasStore.getState().selectAll,
    deselectAll: useCanvasStore.getState().deselectAll,
  };
  const undo = useCanvasStore.getState().undo;
  const redo = useCanvasStore.getState().redo;
  const autoLayout = useCanvasStore.getState().autoLayout;

  // Set up keyboard shortcuts
  useCanvasKeyboardShortcuts({
    actions,
    undo,
    redo,
    autoLayout,
  });

  return <>{children}</>;
}
