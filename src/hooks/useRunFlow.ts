import { useState, useCallback } from "react";
import { Node as ReactFlowNode, Edge as ReactFlowEdge } from "@xyflow/react";
import { topologicalSort, executeNode, clearAllResponses, UpdateNodeData, stripResponse } from "@/lib/flow";

export type UseRunFlowOptions = {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  updateNodeData: UpdateNodeData;
};

export function useRunFlow({ nodes, edges, updateNodeData }: UseRunFlowOptions) {
  const [isGenerating, setIsGenerating] = useState(false);

  const resetFlow = useCallback(() => {
    clearAllResponses(nodes, updateNodeData);
  }, [nodes, updateNodeData]);

  const runFlow = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    // Clear all responses before running
    clearAllResponses(nodes, updateNodeData);

    try {
      const sortedNodes = topologicalSort(nodes, edges);

      for (const node of sortedNodes) {
        const baseData = stripResponse(node.data as Record<string, unknown>);
        
        // Set loading state (without old response)
        updateNodeData(node.id, { ...baseData, loading: true });

        try {
          const response = await executeNode({
            node,
            nodes,
            edges,
            onStreamChunk: (nodeId, accumulated) => {
              updateNodeData(nodeId, {
                ...baseData,
                response: accumulated,
                loading: true,
              });
            },
          });

          // Final update to clear loading
          updateNodeData(node.id, {
            ...baseData,
            response,
            loading: false,
          });
        } catch (e) {
          console.error(`Error executing node ${node.id}:`, e);
          updateNodeData(node.id, { ...baseData, loading: false });
        }
      }
    } catch (e) {
      console.error("Flow execution failed:", e);
    } finally {
      setIsGenerating(false);
    }
  }, [nodes, edges, updateNodeData, isGenerating]);

  return { runFlow, resetFlow, isGenerating };
}

