import {
  Node as ReactFlowNode,
  Edge as ReactFlowEdge,
  getIncomers,
} from "@xyflow/react";
import type { ReadonlyJSONValue } from "@rocicorp/zero";
import { z } from "zod";

export type UpdateNodeData = (nodeId: string, data: ReadonlyJSONValue) => void;

/**
 * Strips the response field from node data.
 */
export function stripResponse(
  data: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => key !== "response")
  );
}

/**
 * Clears all responses from all nodes.
 * Used to reset the canvas before running a flow or manually via reset button.
 */
export function clearAllResponses(
  nodes: ReactFlowNode[],
  updateNodeData: UpdateNodeData
): void {
  for (const node of nodes) {
    const data = node.data as Record<string, unknown>;
    if (data.response !== undefined) {
      updateNodeData(node.id, stripResponse(data) as ReadonlyJSONValue);
    }
  }
}

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type NodeData = ReadonlyJSONValue;

const nodeDataSchema = z.object({
  prompt: z.string().optional(),
  response: z.string().optional(),
});

function parseNodeData(data: unknown) {
  const result = nodeDataSchema.safeParse(data);
  return result.success
    ? result.data
    : { prompt: undefined, response: undefined };
}

/**
 * Topologically sorts nodes based on their edge dependencies.
 * Throws if a cycle is detected.
 */
export function topologicalSort(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[]
): ReactFlowNode[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sorted: ReactFlowNode[] = [];

  const visit = (node: ReactFlowNode) => {
    if (visited.has(node.id)) return;
    if (visiting.has(node.id)) {
      throw new Error("Cycle detected in graph");
    }
    visiting.add(node.id);

    const incomers = getIncomers(node, nodes, edges);
    for (const incomer of incomers) {
      visit(incomer);
    }

    visiting.delete(node.id);
    visited.add(node.id);
    sorted.push(node);
  };

  for (const node of nodes) {
    visit(node);
  }

  return sorted;
}

/**
 * Recursively builds the message history for a node by traversing its parent chain.
 */
export function buildMessageHistory(
  nodeId: string,
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[]
): Message[] {
  const currentNode = nodes.find((n) => n.id === nodeId);
  if (!currentNode) return [];

  const incomers = getIncomers(currentNode, nodes, edges);
  if (incomers.length === 0) {
    return [];
  }

  // Take the first parent for the main history chain
  const parent = incomers[0];
  const parentHistory = buildMessageHistory(parent.id, nodes, edges);

  // Add parent's prompt and response
  const parentData = parseNodeData(parent.data);
  if (parentData.prompt) {
    parentHistory.push({ role: "user", content: parentData.prompt });
  }
  if (parentData.response) {
    parentHistory.push({ role: "assistant", content: parentData.response });
  }

  return parentHistory;
}

export type ExecuteNodeOptions = {
  node: ReactFlowNode;
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  apiEndpoint?: string;
  onStreamChunk?: (nodeId: string, accumulated: string) => void;
};

/**
 * Executes a single node by building its message history and calling the API.
 * Returns the complete response.
 */
export async function executeNode({
  node,
  nodes,
  edges,
  apiEndpoint = "/api/generate",
  onStreamChunk,
}: ExecuteNodeOptions): Promise<string> {
  const messages = buildMessageHistory(node.id, nodes, edges);

  // Add current node's prompt
  const nodeData = parseNodeData(node.data);
  if (nodeData.prompt) {
    messages.push({ role: "user", content: nodeData.prompt });
  }

  const res = await fetch(apiEndpoint, {
    method: "POST",
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      accumulated += chunk;
      onStreamChunk?.(node.id, accumulated);
    }
  }

  return accumulated;
}
