import { useState, useCallback } from "react";
import { Node as ReactFlowNode, Edge as ReactFlowEdge, getIncomers } from "@xyflow/react";
import { executeNode, clearAllResponses, UpdateNodeData, stripResponse } from "@/lib/flow";

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
      // Map to store promises for each node's execution
      const nodePromises = new Map<string, Promise<string | null>>();
      // Map to store completed responses (used by buildMessageHistory for dependencies)
      const responseMap = new Map<string, string>();

      /**
       * Creates an execution promise for a node that:
       * 1. Waits for all dependency nodes to complete
       * 2. Then executes this node
       * 3. Stores the response in responseMap
       * 
       * This enables parallel execution: nodes automatically run in parallel
       * when all their dependencies have completed.
       */
      const createNodeExecution = (node: ReactFlowNode): Promise<string | null> => {
        return (async () => {
          const baseData = stripResponse(node.data as Record<string, unknown>);
          
          // Get all dependency nodes (incomers)
          const dependencies = getIncomers(node, nodes, edges);
          
          // Wait for all dependencies to complete before starting this node
          if (dependencies.length > 0) {
            const dependencyPromises = dependencies.map(dep => {
              const promise = nodePromises.get(dep.id);
              if (!promise) {
                console.warn(`Missing promise for dependency ${dep.id}`);
                return Promise.resolve(null);
              }
              return promise;
            });
            await Promise.all(dependencyPromises);
          }
          
          // Set loading state
          updateNodeData(node.id, { ...baseData, loading: true });

          try {
            const response = await executeNode({
              node,
              nodes,
              edges,
              responseMap,
              onStreamChunk: (nodeId, accumulated) => {
                updateNodeData(nodeId, {
                  ...baseData,
                  response: accumulated,
                  loading: true,
                });
              },
            });

            // Store response for dependent nodes to access
            responseMap.set(node.id, response);

            // Final update to clear loading
            updateNodeData(node.id, {
              ...baseData,
              response,
              loading: false,
            });

            return response;
          } catch (e) {
            console.error(`Error executing node ${node.id}:`, e);
            updateNodeData(node.id, { ...baseData, loading: false });
            return null;
          }
        })();
      };

      // Create execution promises for all nodes
      // The promises will automatically coordinate via dependency waiting
      for (const node of nodes) {
        nodePromises.set(node.id, createNodeExecution(node));
      }

      // Wait for all nodes to complete
      await Promise.all(nodePromises.values());
    } catch (e) {
      console.error("Flow execution failed:", e);
    } finally {
      setIsGenerating(false);
    }
  }, [nodes, edges, updateNodeData, isGenerating]);

  return { runFlow, resetFlow, isGenerating };
}

