import { memo, useState, useCallback } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useZero } from "@rocicorp/zero/react";
import { Schema } from "@/schema";
import { Loader2, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Define the specific data shape for this node type
export type ConversationNodeData = {
  label?: string;
  prompt?: string;
  response?: string;
  loading?: boolean;
  [key: string]: unknown;
};

// Define the Node type using the data shape
export type ConversationNodeType = Node<ConversationNodeData>;

export const ConversationNode = memo(
  ({ id, data, isConnectable, deletable }: NodeProps<ConversationNodeType>) => {
    const z = useZero<Schema>();
    const [prompt, setPrompt] = useState(data.prompt || "");
    const [prevDataPrompt, setPrevDataPrompt] = useState(data.prompt);
    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [labelValue, setLabelValue] = useState(data.label || "Untitled");
    const [prevDataLabel, setPrevDataLabel] = useState(data.label);

    // Sync local prompt state with data.prompt if it changes externally
    // React-recommended pattern: adjust state during render instead of useEffect
    if (data.prompt !== prevDataPrompt) {
      setPrevDataPrompt(data.prompt);
      setPrompt(data.prompt || "");
    }

    // Sync label state with data.label if it changes externally
    if (data.label !== prevDataLabel) {
      setPrevDataLabel(data.label);
      setLabelValue(data.label || "Untitled");
    }

    // Focus input when entering edit mode - this is a valid effect (DOM interaction)
    const labelInputRef = useCallback(
      (node: HTMLInputElement | null) => {
        if (node && isEditingLabel) {
          node.focus();
          node.select();
        }
      },
      [isEditingLabel]
    );

    const handleLabelSave = useCallback(() => {
      const trimmedLabel = labelValue.trim() || "Untitled";
      setLabelValue(trimmedLabel);
      z.mutate.node.update({
        id,
        data: { ...data, label: trimmedLabel },
      });
      setIsEditingLabel(false);
    }, [id, labelValue, data, z]);

    const handleLabelCancel = useCallback(() => {
      setLabelValue(data.label || "Untitled");
      setIsEditingLabel(false);
    }, [data.label]);

    const handleLabelKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleLabelSave();
        } else if (e.key === "Escape") {
          e.preventDefault();
          handleLabelCancel();
        }
      },
      [handleLabelSave, handleLabelCancel]
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setPrompt(e.target.value);
      },
      []
    );

    const handleBlur = useCallback(() => {
      z.mutate.node.update({
        id,
        data: { ...data, prompt },
      });
    }, [id, prompt, data, z]);

    const handleDelete = useCallback(() => {
      z.mutate.node.delete({ id });
    }, [id, z]);

    return (
      <Card className="w-[350px] shadow-lg border-2">
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={isConnectable}
        />
        <CardHeader className="p-3 bg-muted/50">
          <CardTitle className="text-sm font-medium flex justify-between items-center gap-2">
            {isEditingLabel ? (
              <div className="flex items-center gap-1 flex-1">
                <Input
                  ref={labelInputRef}
                  value={labelValue}
                  onChange={(e) => setLabelValue(e.target.value)}
                  onKeyDown={handleLabelKeyDown}
                  onBlur={handleLabelSave}
                  className="h-6 text-sm px-2 py-0"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={handleLabelSave}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={handleLabelCancel}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <span
                className="cursor-pointer hover:text-primary transition-colors flex items-center gap-1 group"
                onClick={() => setIsEditingLabel(true)}
                title="Click to rename"
              >
                {labelValue}
                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
            )}
            <div className="flex items-center gap-1">
              {data.loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {!data.loading && deletable && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Prompt
            </label>
            <Textarea
              placeholder="Enter your prompt here..."
              value={prompt}
              onChange={handleChange}
              onBlur={handleBlur}
              className="min-h-[80px] resize-none text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Response
            </label>
            <div className="bg-muted/30 p-2 rounded-md text-sm min-h-[60px] max-h-[200px] overflow-y-auto whitespace-pre-wrap border">
              {data.response || (
                <span className="text-muted-foreground italic">
                  AI response will appear here...
                </span>
              )}
            </div>
          </div>
        </CardContent>
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectable={isConnectable}
        />
      </Card>
    );
  }
);

ConversationNode.displayName = "ConversationNode";
