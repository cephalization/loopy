import { CanvasProvider } from "./CanvasProvider";
import { CanvasToolbar } from "./CanvasToolbar";
import { FlowCanvas } from "./FlowCanvas";

type CanvasProps = {
  conversationId: string;
};

export function Canvas({ conversationId }: CanvasProps) {
  return (
    <CanvasProvider conversationId={conversationId}>
      <div className="h-screen w-full flex flex-col">
        <CanvasToolbar />
        <FlowCanvas />
      </div>
    </CanvasProvider>
  );
}
