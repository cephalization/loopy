import { Button } from "@/components/ui/button";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { useCanvas } from "./useCanvas";

export function CanvasToolbar() {
  const { runFlow, resetFlow, isGenerating, addNode } = useCanvas();

  return (
    <div className="h-12 border-b flex items-center px-4 justify-between bg-background z-10">
      <span className="font-semibold">loopy</span>
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
        <Button onClick={addNode} variant="secondary" size="sm">
          Add Node
        </Button>
      </div>
    </div>
  );
}

