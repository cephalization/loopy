import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ConversationNode } from "../ConversationNode";
import { useCanvas } from "./useCanvas";

const nodeTypes = {
  conversation: ConversationNode,
  default: ConversationNode,
  input: ConversationNode,
};

export function FlowCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useCanvas();

  return (
    <div className="flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
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
  );
}

