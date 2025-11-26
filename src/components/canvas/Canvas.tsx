import { CanvasProvider } from "./CanvasProvider";
import { CanvasToolbar } from "./CanvasToolbar";
import { FlowCanvas } from "./FlowCanvas";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import { useOnboarding } from "@/hooks/useOnboarding";

type CanvasProps = {
  conversationId: string;
};

function CanvasInner() {
  const { showOnboarding, setShowOnboarding, openOnboarding } = useOnboarding();

  return (
    <>
      <div className="h-screen w-full flex flex-col">
        <CanvasToolbar onOpenOnboarding={openOnboarding} />
        <FlowCanvas />
      </div>
      <OnboardingDialog
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
      />
    </>
  );
}

export function Canvas({ conversationId }: CanvasProps) {
  return (
    <CanvasProvider conversationId={conversationId}>
      <CanvasInner />
    </CanvasProvider>
  );
}
