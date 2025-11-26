import { useState, useCallback } from "react";
import {
  Node as ReactFlowNode,
  Edge as ReactFlowEdge,
  getIncomers,
  getOutgoers,
} from "@xyflow/react";
import {
  executeNode,
  clearAllResponses,
  UpdateNodeData,
  stripResponse,
  buildMessageHistory,
} from "@/lib/flow";

export type EdgeExecutionState = "selected" | "skipped" | "complete";

export type UseRunFlowOptions = {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  updateNodeData: UpdateNodeData;
  setEdgeExecutionState?: (edgeId: string, state: EdgeExecutionState) => void;
  clearEdgeExecutionStates?: () => void;
};

type NodeData = {
  label?: string;
  prompt?: string;
  executionMode?: "all" | "choose";
  conditionPrompt?: string;
  selectionState?: "selected" | "skipped";
  [key: string]: unknown;
};

/**
 * Calls the choose-child API to determine which child node to execute
 * based on the parent's condition prompt.
 * Returns both the selected child ID and the reasoning.
 */
async function chooseChild(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  conditionPrompt: string,
  children: Array<{ id: string; label: string; prompt: string }>
): Promise<{ selectedChildId: string; reasoning: string }> {
  console.log("[chooseChild] Calling API with:", {
    messageCount: messages.length,
    conditionPrompt,
    children: children.map((c) => ({ id: c.id, label: c.label })),
  });

  const response = await fetch("/api/choose-child", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, conditionPrompt, children }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[chooseChild] API failed:", response.status, errorText);
    throw new Error(`Choose child API failed: ${response.status}`);
  }

  const result = await response.json();
  console.log("[chooseChild] API returned:", result);
  return {
    selectedChildId: result.selectedChildId,
    reasoning: result.reasoning,
  };
}

export function useRunFlow({
  nodes,
  edges,
  updateNodeData,
  setEdgeExecutionState,
  clearEdgeExecutionStates,
}: UseRunFlowOptions) {
  const [isGenerating, setIsGenerating] = useState(false);

  const resetFlow = useCallback(() => {
    clearAllResponses(nodes, updateNodeData);
    clearEdgeExecutionStates?.();
  }, [nodes, updateNodeData, clearEdgeExecutionStates]);

  const runFlow = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    // Clear all responses and edge states before running
    clearAllResponses(nodes, updateNodeData);
    clearEdgeExecutionStates?.();

    try {
      // Map to store promises for each node's execution
      const nodePromises = new Map<string, Promise<string | null>>();
      // Map to store completed responses (used by buildMessageHistory for dependencies)
      const responseMap = new Map<string, string>();
      // Map to store which child was selected for each "choose" mode parent
      // Key: parent node ID, Value: selected child node ID
      const selectedChildMap = new Map<string, string>();
      // Set of nodes that should be skipped (not selected by conditional branching)
      const skippedNodes = new Set<string>();

      /**
       * Finds edges that connect to a target node.
       */
      const findIncomingEdges = (nodeId: string) => {
        return edges.filter((e) => e.target === nodeId);
      };

      /**
       * Recursively marks a node and all its descendants as skipped.
       * Also updates the UI to show the skipped state and marks incoming edges.
       */
      const markSubtreeSkipped = (nodeId: string) => {
        console.log("[markSubtreeSkipped] Skipping node:", nodeId);
        skippedNodes.add(nodeId);
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
          // Update UI to show skipped state
          const nodeBaseData = stripResponse(
            node.data as Record<string, unknown>
          );
          updateNodeData(node.id, {
            ...nodeBaseData,
            selectionState: "skipped",
          });

          // Mark incoming edges as skipped (yellow)
          const incomingEdges = findIncomingEdges(nodeId);
          for (const edge of incomingEdges) {
            setEdgeExecutionState?.(edge.id, "skipped");
          }

          const children = getOutgoers(node, nodes, edges);
          for (const child of children) {
            markSubtreeSkipped(child.id);
          }
        }
      };

      /**
       * Marks a node as selected and updates the UI.
       * Also marks the incoming edge as selected (green).
       */
      const markNodeSelected = (nodeId: string) => {
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
          const nodeBaseData = stripResponse(
            node.data as Record<string, unknown>
          );
          updateNodeData(node.id, {
            ...nodeBaseData,
            selectionState: "selected",
          });

          // Mark incoming edges as selected (green)
          const incomingEdges = findIncomingEdges(nodeId);
          for (const edge of incomingEdges) {
            setEdgeExecutionState?.(edge.id, "selected");
          }
        }
      };

      /**
       * Marks edges leading to a node as complete (green).
       */
      const markEdgesComplete = (nodeId: string) => {
        const incomingEdges = findIncomingEdges(nodeId);
        for (const edge of incomingEdges) {
          // Don't overwrite selected/skipped states
          const currentState = edges.find((e) => e.id === edge.id);
          if (currentState && !skippedNodes.has(nodeId)) {
            setEdgeExecutionState?.(edge.id, "complete");
          }
        }
      };

      /**
       * Creates an execution promise for a node that:
       * 1. Waits for all dependency nodes to complete
       * 2. Checks if this node should be skipped due to conditional branching
       * 3. Then executes this node
       * 4. Stores the response in responseMap
       *
       * This enables parallel execution: nodes automatically run in parallel
       * when all their dependencies have completed.
       *
       * NOTE: We use Promise.resolve().then() to defer execution to the next
       * microtask, ensuring all node promises are registered in the map before
       * any execution begins. This prevents race conditions where a node tries
       * to get a dependency's promise before it's been created.
       */
      const createNodeExecution = (
        node: ReactFlowNode
      ): Promise<string | null> => {
        return Promise.resolve().then(async () => {
          const nodeData = node.data as NodeData;
          console.log("[createNodeExecution] Starting node:", {
            id: node.id,
            label: nodeData.label,
            executionMode: nodeData.executionMode,
          });

          const baseData = stripResponse(node.data as Record<string, unknown>);

          // Get all dependency nodes (incomers)
          const dependencies = getIncomers(node, nodes, edges);
          console.log("[createNodeExecution] Node dependencies:", {
            nodeId: node.id,
            dependencies: dependencies.map((d) => d.id),
          });

          // Wait for all dependencies to complete before starting this node
          if (dependencies.length > 0) {
            console.log(
              "[createNodeExecution] Waiting for dependencies:",
              node.id
            );
            const dependencyPromises = dependencies.map((dep) => {
              const promise = nodePromises.get(dep.id);
              if (!promise) {
                console.warn(`Missing promise for dependency ${dep.id}`);
                return Promise.resolve(null);
              }
              return promise;
            });
            await Promise.all(dependencyPromises);
            console.log(
              "[createNodeExecution] Dependencies complete:",
              node.id
            );
          }

          // Check if this node should be skipped due to conditional branching
          if (skippedNodes.has(node.id)) {
            console.log("[createNodeExecution] Node already skipped:", node.id);
            return null;
          }

          // Check if any parent has executionMode="choose" and if we were selected
          for (const parent of dependencies) {
            const parentData = parent.data as NodeData;
            console.log("[createNodeExecution] Checking parent:", {
              parentId: parent.id,
              parentExecutionMode: parentData.executionMode,
              selectedChildId: selectedChildMap.get(parent.id),
              currentNodeId: node.id,
            });
            if (parentData.executionMode === "choose") {
              const selectedChildId = selectedChildMap.get(parent.id);
              if (selectedChildId && selectedChildId !== node.id) {
                // This node was not selected, skip it and its subtree
                console.log(
                  "[createNodeExecution] Node not selected, skipping:",
                  node.id
                );
                markSubtreeSkipped(node.id);
                return null;
              }
            }
          }

          // Set loading state
          updateNodeData(node.id, { ...baseData, loading: true });

          try {
            // Check if this node is in "choose" mode - if so, skip normal execution
            // and just do the child selection (don't generate a response)
            if (
              nodeData.executionMode === "choose" &&
              nodeData.conditionPrompt
            ) {
              const children = getOutgoers(node, nodes, edges);
              console.log("[createNodeExecution] Node is in choose mode:", {
                nodeId: node.id,
                childCount: children.length,
                children: children.map((c) => ({
                  id: c.id,
                  label: (c.data as NodeData).label,
                })),
              });

              if (children.length > 1) {
                // Build message history (without executing this node)
                const messages = buildMessageHistory(
                  node.id,
                  nodes,
                  edges,
                  responseMap
                );
                // Add this node's prompt to provide context for the decision
                if (nodeData.prompt) {
                  messages.push({ role: "user", content: nodeData.prompt });
                }

                console.log(
                  "[createNodeExecution] Built message history, messageCount:",
                  messages.length
                );

                // Prepare child info for the API
                const childInfo = children.map((child) => {
                  const childData = child.data as NodeData;
                  return {
                    id: child.id,
                    label: childData.label || "Untitled",
                    prompt: childData.prompt || "",
                  };
                });

                // Call the API to choose which child to execute
                console.log("[createNodeExecution] Calling chooseChild API...");
                const { selectedChildId, reasoning } = await chooseChild(
                  messages,
                  nodeData.conditionPrompt,
                  childInfo
                );
                console.log(
                  "[createNodeExecution] Selected child:",
                  selectedChildId,
                  "Reasoning:",
                  reasoning
                );
                selectedChildMap.set(node.id, selectedChildId);

                // Find the selected child's label for display
                const selectedChild = children.find(
                  (c) => c.id === selectedChildId
                );
                const selectedLabel = selectedChild
                  ? (selectedChild.data as NodeData).label || "Untitled"
                  : "Unknown";

                // Set the response to show the selection result
                const response = `Selected: ${selectedLabel}\n\nReason: ${reasoning}`;
                responseMap.set(node.id, response);
                updateNodeData(node.id, {
                  ...baseData,
                  response,
                  loading: false,
                });

                // Mark edges to this node as complete
                markEdgesComplete(node.id);

                // Mark the selected child and skip non-selected children
                markNodeSelected(selectedChildId);
                for (const child of children) {
                  if (child.id !== selectedChildId) {
                    console.log(
                      "[createNodeExecution] Marking non-selected child as skipped:",
                      child.id
                    );
                    markSubtreeSkipped(child.id);
                  }
                }

                return response;
              } else {
                console.log(
                  "[createNodeExecution] Node has choose mode but <= 1 children, executing normally"
                );
              }
            }

            // Normal execution for non-choose nodes (or choose nodes with <= 1 child)
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

            // Mark edges to this node as complete (green)
            markEdgesComplete(node.id);

            return response;
          } catch (e) {
            console.error(`Error executing node ${node.id}:`, e);
            updateNodeData(node.id, { ...baseData, loading: false });
            return null;
          }
        });
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
