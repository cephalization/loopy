import { useEffect, useCallback } from "react";
import type { CanvasActions } from "./useCanvasActions";

type KeyboardShortcutsConfig = {
  actions: CanvasActions;
  undo: () => void;
  redo: () => void;
  enabled?: boolean;
};

export function useCanvasKeyboardShortcuts({
  actions,
  undo,
  redo,
  enabled = true,
}: KeyboardShortcutsConfig) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow Escape to work even in inputs
        if (event.key === "Escape") {
          actions.deselectAll();
          (target as HTMLElement).blur();
        }
        return;
      }

      const isMod = event.metaKey || event.ctrlKey;

      // Delete/Backspace - delete selected nodes
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        actions.deleteSelected();
        return;
      }

      // Escape - deselect all
      if (event.key === "Escape") {
        event.preventDefault();
        actions.deselectAll();
        return;
      }

      // Cmd/Ctrl + A - select all
      if (isMod && event.key === "a") {
        event.preventDefault();
        actions.selectAll();
        return;
      }

      // Cmd/Ctrl + D - duplicate selected
      if (isMod && event.key === "d") {
        event.preventDefault();
        actions.duplicateSelected();
        return;
      }

      // Cmd/Ctrl + Z - undo
      if (isMod && event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      // Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y - redo
      if (isMod && ((event.key === "z" && event.shiftKey) || event.key === "y")) {
        event.preventDefault();
        redo();
        return;
      }
    },
    [actions, undo, redo]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, enabled]);
}

