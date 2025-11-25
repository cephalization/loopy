import { useCallback, useMemo, useState } from "react";
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
  getIncomers,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { Schema } from "@/schema";
import { ConversationNode } from "./ConversationNode";
import { Button } from "@/components/ui/button";
import { Loader2, Play } from "lucide-react";

// Node Types
const nodeTypes = {
  conversation: ConversationNode,
  default: ConversationNode,
  input: ConversationNode,
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function Canvas({ conversationId }: { conversationId: string }) {
  const z = useZero<Schema>();
  const [isGenerating, setIsGenerating] = useState(false);

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

  // Topological Sort & Execution Logic
  const runFlow = async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      // 1. Build dependency graph
      const visited = new Set<string>();
      const sortedNodes: ReactFlowNode[] = [];
      const visiting = new Set<string>();

      // Helper to get incomers from our local state (rfNodes/rfEdges)
      const getLocalIncomers = (node: ReactFlowNode) => {
        return getIncomers(node, rfNodes, rfEdges);
      };

      const visit = (node: ReactFlowNode) => {
        if (visited.has(node.id)) return;
        if (visiting.has(node.id)) {
          throw new Error("Cycle detected in graph");
        }
        visiting.add(node.id);

        const incomers = getLocalIncomers(node);
        for (const incomer of incomers) {
          visit(incomer);
        }

        visiting.delete(node.id);
        visited.add(node.id);
        sortedNodes.push(node);
      };

      // Perform topological sort
      for (const node of rfNodes) {
        visit(node);
      }

      // 2. Execute nodes in order
      for (const node of sortedNodes) {
        // Set loading state
        z.mutate.node.update({
          id: node.id,
          data: { ...node.data, loading: true },
        });

        try {
          const getHistory = (currentNodeId: string): Message[] => {
            const currentNode = rfNodes.find((n) => n.id === currentNodeId);
            if (!currentNode) return [];

            const incomers = getIncomers(currentNode, rfNodes, rfEdges);
            if (incomers.length === 0) {
              return [];
            }

            // Take the first parent for the main history chain
            const parent = incomers[0];
            const parentHistory = getHistory(parent.id);

            // Add parent's prompt and response
            const parentData = parent.data as Record<string, unknown>;
            if (typeof parentData.prompt === "string" && parentData.prompt) {
              parentHistory.push({ role: "user", content: parentData.prompt });
            }
            if (
              typeof parentData.response === "string" &&
              parentData.response
            ) {
              parentHistory.push({
                role: "assistant",
                content: parentData.response,
              });
            }

            return parentHistory;
          };

          const messages = getHistory(node.id);

          // Add current node's prompt
          const currentPrompt = (node.data as Record<string, unknown>).prompt;
          if (typeof currentPrompt === "string") {
            messages.push({ role: "user", content: currentPrompt });
          }

          // Call API
          const res = await fetch("/api/generate", {
            method: "POST",
            body: JSON.stringify({ messages }),
          });

          if (!res.ok) throw new Error("Failed");

          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              accumulated += chunk;

              z.mutate.node.update({
                id: node.id,
                data: { ...node.data, response: accumulated, loading: true },
              });
            }
          }

          // Final update to clear loading
          z.mutate.node.update({
            id: node.id,
            data: { ...node.data, response: accumulated, loading: false },
          });
        } catch (e) {
          console.error(`Error executing node ${node.id}:`, e);
          z.mutate.node.update({
            id: node.id,
            data: { ...node.data, loading: false },
          });
        }
      }
    } catch (e) {
      console.error("Flow execution failed:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col">
      <div className="h-12 border-b flex items-center px-4 justify-between bg-background z-10">
        <span className="font-semibold">Loopy Canvas</span>
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
