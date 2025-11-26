import { useCallback, useMemo, ReactNode } from "react";
import { OnNodesChange, OnEdgesChange, OnConnect } from "@xyflow/react";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { Schema } from "@/schema";
import { useRunFlow } from "@/hooks/useRunFlow";
import type { ReadonlyJSONValue } from "@rocicorp/zero";
import { CanvasContext } from "./useCanvas";

type CanvasProviderProps = {
  conversationId: string;
  children: ReactNode;
};

export function CanvasProvider({
  conversationId,
  children,
}: CanvasProviderProps) {
  const z = useZero<Schema>();

  // Query Zero
  const [nodes] = useQuery(
    z.query.node.where("conversationID", conversationId)
  );
  const [edges] = useQuery(
    z.query.edge.where("conversationID", conversationId)
  );

  // Transform to React Flow format
  const rfNodes = useMemo(() => {
    return nodes.map((n) => ({
      id: n.id,
      type: n.type === "conversation" ? "conversation" : "default",
      position: { x: n.positionX, y: n.positionY },
      data: n.data as Record<string, unknown>,
      style: { width: "auto", border: "none", background: "transparent" },
    }));
  }, [nodes]);

  const rfEdges = useMemo(() => {
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

  const value = useMemo(
    () => ({
      nodes: rfNodes,
      edges: rfEdges,
      onNodesChange,
      onEdgesChange,
      onConnect,
      addNode,
      runFlow,
      resetFlow,
      isGenerating,
    }),
    [
      rfNodes,
      rfEdges,
      onNodesChange,
      onEdgesChange,
      onConnect,
      addNode,
      runFlow,
      resetFlow,
      isGenerating,
    ]
  );

  return (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  );
}
