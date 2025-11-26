import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Play, RotateCcw, Info, Command } from "lucide-react";
import { useCanvas } from "./useCanvas";

const isMac =
  typeof navigator !== "undefined" &&
  navigator.platform.toUpperCase().indexOf("MAC") >= 0;

const modKey = isMac ? "⌘" : "Ctrl";

const shortcuts = [
  { keys: ["Double-click"], description: "Create new node" },
  { keys: ["Delete", "Backspace"], description: "Delete selected" },
  { keys: [modKey, "D"], description: "Duplicate selected" },
  { keys: [modKey, "A"], description: "Select all" },
  { keys: ["Esc"], description: "Deselect all" },
  { keys: [modKey, "Z"], description: "Undo" },
  { keys: [modKey, "Shift", "Z"], description: "Redo" },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded shadow-sm">
      {children}
    </kbd>
  );
}

export function CanvasToolbar() {
  const { runFlow, resetFlow, isGenerating, addNode } = useCanvas();
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="h-12 border-b flex items-center px-4 justify-between bg-background relative z-10">
      <div className="flex items-center gap-2">
        <span className="font-semibold">loopy</span>
        <Dialog open={showHelp} onOpenChange={setShowHelp}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <Info className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Command className="h-5 w-5" />
                Keyboard Shortcuts & Tips
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Shortcuts</h4>
                <div className="space-y-2">
                  {shortcuts.map((shortcut, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, j) => (
                          <span key={j} className="flex items-center gap-0.5">
                            <Kbd>{key}</Kbd>
                            {j < shortcut.keys.length - 1 && (
                              <span className="text-muted-foreground text-xs">
                                +
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t pt-3">
                <h4 className="font-medium text-sm mb-1">History</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  All actions are tracked and can be undone/redone. This
                  includes creating, deleting, moving, and duplicating nodes.
                  When you undo a node deletion, connected edges are restored
                  too!
                </p>
              </div>
              <div className="border-t pt-3">
                <h4 className="font-medium text-sm mb-1">Tips</h4>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Shift + drag to box-select multiple nodes</li>
                  <li>Connect nodes by dragging from handle to handle</li>
                  <li>Click a node label to rename it</li>
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={runFlow}
          disabled={isGenerating}
          size="sm"
          className="gap-2"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {isGenerating ? "Running..." : "Run Flow"}
        </Button>
        <Button
          onClick={resetFlow}
          disabled={isGenerating}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Button onClick={() => addNode()} variant="secondary" size="sm">
          Add Node
        </Button>
      </div>
    </div>
  );
}
