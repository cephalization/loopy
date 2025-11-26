import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { Schema } from "@/schema";
import { ConversationNode } from "./ConversationNode";
import { Button } from "@/components/ui/button";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { useRunFlow } from "@/hooks/useRunFlow";
import type { ReadonlyJSONValue } from "@rocicorp/zero";

// Node Types
const nodeTypes = {
  conversation: ConversationNode,
  default: ConversationNode,
  input: ConversationNode,
};

export function Canvas({ conversationId }: { conversationId: string }) {
  const z = useZero<Schema>();

  // Query Zero
  const [nodes] = useQuery(
    z.query.node.where("conversationID", conversationId)
  );
  const [edges] = useQuery(
    z.query.edge.where("conversationID", conversationId)
  );

  // Transform to React Flow format
  const rfNodes: ReactFlowNode[] = useMemo(() => {
    return nodes.map((n) => ({
      id: n.id,
      type: n.type === "conversation" ? "conversation" : "default",
      position: { x: n.positionX, y: n.positionY },
      data: n.data as Record<string, unknown>,
      style: { width: "auto", border: "none", background: "transparent" },
    }));
  }, [nodes]);

  const rfEdges: ReactFlowEdge[] = useMemo(() => {
    return edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }));
  }, [edges]);

  // Handlers
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === "position" && change.position) {
          z.mutate.node.update({
            id: change.id,
            positionX: change.position.x,
            positionY: change.position.y,
          });
        } else if (change.type === "remove") {
          z.mutate.node.delete({ id: change.id });
        }
      });
    },
    [z]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === "remove") {
          z.mutate.edge.delete({ id: change.id });
        }
      });
    },
    [z]
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      const id = `edge-${crypto.randomUUID()}`;
      z.mutate.edge.insert({
        id,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle || undefined,
        targetHandle: connection.targetHandle || undefined,
        conversationID: conversationId,
      });
    },
    [z, conversationId]
  );

  const addNode = useCallback(() => {
    const id = `node-${crypto.randomUUID()}`;
    z.mutate.node.insert({
      id,
      type: "conversation",
      positionX: Math.random() * 400,
      positionY: Math.random() * 400,
      data: { label: "New Node", prompt: "" },
      conversationID: conversationId,
    });
  }, [z, conversationId]);

  const updateNodeData = useCallback(
    (nodeId: string, data: ReadonlyJSONValue) => {
      z.mutate.node.update({ id: nodeId, data });
    },
    [z]
  );

  const { runFlow, resetFlow, isGenerating } = useRunFlow({
    nodes: rfNodes,
    edges: rfEdges,
    updateNodeData,
  });

  return (
    <div className="h-screen w-full flex flex-col">
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
      <div className="flex-1">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-muted/10"
          colorMode="dark"
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
