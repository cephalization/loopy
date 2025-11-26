import { useCallback, MouseEvent, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ConversationNode } from "../ConversationNode";
import { useCanvas } from "./useCanvas";

const nodeTypes = {
  conversation: ConversationNode,
  default: ConversationNode,
  input: ConversationNode,
};

function FlowCanvasInner() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    addNode,
    registerGetNodes,
  } = useCanvas();
  const { screenToFlowPosition, getNodes } = useReactFlow();

  // Register getNodes so autoLayout can access measured dimensions
  useEffect(() => {
    registerGetNodes(getNodes);
  }, [registerGetNodes, getNodes]);

  const handleDoubleClick = useCallback(
    (event: MouseEvent) => {
      // Convert screen coordinates to flow coordinates
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      addNode(position);
    },
    [screenToFlowPosition, addNode]
  );

  return (
    <div className="flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onDoubleClick={handleDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        zoomOnDoubleClick={false}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        deleteKeyCode={null}
        className="bg-muted/10"
        colorMode="dark"
        connectionRadius={30}
        edgesFocusable
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
}
