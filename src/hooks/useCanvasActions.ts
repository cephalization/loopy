import { useCallback } from "react";
import type {
  Node as ReactFlowNode,
  Edge as ReactFlowEdge,
} from "@xyflow/react";
import type { Node, Edge } from "@/schema";
import type { HistoryAction } from "./useCanvasHistory";

type CanvasActionsConfig = {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  rawNodes: Node[];
  rawEdges: Edge[];
  conversationId: string;
  insertNode: (node: Node) => void;
  deleteNode: (nodeId: string) => void;
  insertEdge: (edge: Edge) => void;
  deleteEdge: (edgeId: string) => void;
  setSelectedNodes: (nodeIds: string[]) => void;
  getSelectedNodes: () => string[];
  getSelectedEdges: () => string[];
  pushAction: (action: HistoryAction) => void;
};

export type CanvasActions = {
  deleteSelected: () => void;
  duplicateSelected: () => void;
  selectAll: () => void;
  deselectAll: () => void;
};

export function useCanvasActions({
  nodes,
  // @ts-expect-error - edges is used in the callback but not passed to the function
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  edges,
  rawNodes,
  rawEdges,
  conversationId,
  insertNode,
  deleteNode,
  insertEdge,
  deleteEdge,
  setSelectedNodes,
  getSelectedNodes,
  getSelectedEdges,
  pushAction,
}: CanvasActionsConfig): CanvasActions {
  // Delete all selected nodes and edges
  const deleteSelected = useCallback(() => {
    const selectedNodeIds = getSelectedNodes();
    const selectedEdgeIds = getSelectedEdges();

    // Delete selected edges first (that aren't connected to nodes being deleted)
    selectedEdgeIds.forEach((edgeId) => {
      const edge = rawEdges.find((e) => e.id === edgeId);
      if (!edge) return;

      // Skip if this edge connects to a node being deleted (will be handled with node deletion)
      if (
        selectedNodeIds.includes(edge.source) ||
        selectedNodeIds.includes(edge.target)
      ) {
        return;
      }

      pushAction({ type: "delete_edge", edge });
      deleteEdge(edgeId);
    });

    // Delete selected nodes
    selectedNodeIds.forEach((nodeId) => {
      const node = rawNodes.find((n) => n.id === nodeId);
      if (!node) return;

      // Find connected edges
      const connectedEdges = rawEdges.filter(
        (e) => e.source === nodeId || e.target === nodeId
      );

      // Push to history before deleting
      pushAction({
        type: "delete_node",
        node,
        connectedEdges,
      });

      // Delete connected edges first
      connectedEdges.forEach((edge) => deleteEdge(edge.id));
      // Then delete node
      deleteNode(nodeId);
    });
  }, [
    getSelectedNodes,
    getSelectedEdges,
    rawNodes,
    rawEdges,
    pushAction,
    deleteEdge,
    deleteNode,
  ]);

  // Duplicate all selected nodes
  const duplicateSelected = useCallback(() => {
    const selectedNodeIds = getSelectedNodes();
    if (selectedNodeIds.length === 0) return;

    const OFFSET = 50;
    const nodeIdMap = new Map<string, string>();
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // First pass: create new nodes
    selectedNodeIds.forEach((nodeId) => {
      const originalNode = rawNodes.find((n) => n.id === nodeId);
      if (!originalNode) return;

      const newId = `node-${crypto.randomUUID()}`;
      nodeIdMap.set(nodeId, newId);

      const newNode: Node = {
        id: newId,
        type: originalNode.type,
        positionX: originalNode.positionX + OFFSET,
        positionY: originalNode.positionY + OFFSET,
        data: originalNode.data,
        conversationID: conversationId,
      };

      newNodes.push(newNode);
      insertNode(newNode);
    });

    // Second pass: recreate edges between duplicated nodes
    rawEdges.forEach((edge) => {
      const newSourceId = nodeIdMap.get(edge.source);
      const newTargetId = nodeIdMap.get(edge.target);

      // Only create edge if both source and target were duplicated
      if (newSourceId && newTargetId) {
        const newEdge: Edge = {
          id: `edge-${crypto.randomUUID()}`,
          source: newSourceId,
          target: newTargetId,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          conversationID: conversationId,
        };

        newEdges.push(newEdge);
        insertEdge(newEdge);
      }
    });

    // Push to history
    pushAction({
      type: "duplicate_nodes",
      nodes: newNodes,
      edges: newEdges,
    });

    // Select the new nodes
    setSelectedNodes(newNodes.map((n) => n.id));
  }, [
    getSelectedNodes,
    rawNodes,
    rawEdges,
    conversationId,
    insertNode,
    insertEdge,
    pushAction,
    setSelectedNodes,
  ]);

  // Select all nodes
  const selectAll = useCallback(() => {
    setSelectedNodes(nodes.map((n) => n.id));
  }, [nodes, setSelectedNodes]);

  // Deselect all nodes
  const deselectAll = useCallback(() => {
    setSelectedNodes([]);
  }, [setSelectedNodes]);

  return {
    deleteSelected,
    duplicateSelected,
    selectAll,
    deselectAll,
  };
}
