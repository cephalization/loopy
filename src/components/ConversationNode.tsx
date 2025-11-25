import { memo, useState, useCallback, useEffect } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useZero } from "@rocicorp/zero/react";
import { Schema } from "@/schema";
import { Loader2, Trash2 } from "lucide-react";
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

    // Sync local prompt state with data.prompt if it changes externally
    useEffect(() => {
      if (data.prompt !== undefined && data.prompt !== prompt) {
        setPrompt(data.prompt);
      }
    }, [data.prompt]);

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
          <CardTitle className="text-sm font-medium flex justify-between items-center">
            <span>Node {id}</span>
            {data.loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {!data.loading && deletable && (
              <Button size="icon" variant="ghost" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
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
