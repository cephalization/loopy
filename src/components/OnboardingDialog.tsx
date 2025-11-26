import { useState } from "react";
import { markOnboardingSeen } from "@/hooks/useOnboarding";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Workflow,
  Sparkles,
  GitBranch,
  Play,
  MousePointerClick,
  Users,
  ArrowRight,
  ArrowLeft,
  Zap,
} from "lucide-react";

type OnboardingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type OnboardingStep = {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  visual: React.ReactNode;
};

const steps: OnboardingStep[] = [
  {
    icon: <Sparkles className="h-6 w-6" />,
    title: "Welcome to Loopy",
    description: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          Loopy is a <span className="text-foreground font-medium">collaborative visual canvas</span> for
          building AI workflows. Create nodes that each make an LLM call, then
          connect them to build powerful chains of thought.
        </p>
        <p className="text-muted-foreground leading-relaxed mt-3">
          Think of it as a <span className="text-foreground font-medium">flowchart that thinks</span> — each
          node processes its input, generates a response, and passes it along to
          connected nodes.
        </p>
      </>
    ),
    visual: (
      <div className="relative h-32 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-chart-1/20 via-transparent to-chart-2/20 rounded-lg" />
        <div className="flex items-center gap-4 relative">
          {/* Lines behind nodes */}
          <svg
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-4 pointer-events-none z-0"
          >
            <line
              x1="20%"
              y1="50%"
              x2="40%"
              y2="50%"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground"
            />
            <line
              x1="60%"
              y1="50%"
              x2="80%"
              y2="50%"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground"
            />
          </svg>
          {/* Nodes on top */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-16 h-16 rounded-lg bg-card border-2 border-border flex items-center justify-center shadow-lg relative z-10"
              style={{
                animationDelay: `${i * 150}ms`,
                animation: "float 3s ease-in-out infinite",
              }}
            >
              <Zap className="h-6 w-6 text-chart-1" />
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: <GitBranch className="h-6 w-6" />,
    title: "Build Your Flow",
    description: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          Nodes are connected in a <span className="text-foreground font-medium">directed acyclic graph (DAG)</span>.
          This means information flows in one direction — from parent nodes to child nodes.
        </p>
        <p className="text-muted-foreground leading-relaxed mt-3">
          Each node receives the combined responses from all its parents, letting you build
          complex reasoning chains, summaries, or multi-step analyses.
        </p>
      </>
    ),
    visual: (
      <div className="relative h-44 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-chart-2/20 via-transparent to-chart-3/20 rounded-lg" />
        <div className="relative flex flex-col items-center gap-1">
          <div className="w-14 h-8 rounded-md bg-card border-2 border-chart-2 flex items-center justify-center shadow-lg text-xs font-medium">
            Input
          </div>
          <svg className="h-4 w-full">
            <line x1="50%" y1="0" x2="30%" y2="100%" stroke="currentColor" strokeWidth="2" className="text-muted-foreground" />
            <line x1="50%" y1="0" x2="70%" y2="100%" stroke="currentColor" strokeWidth="2" className="text-muted-foreground" />
          </svg>
          <div className="flex gap-8">
            <div className="w-14 h-8 rounded-md bg-card border-2 border-chart-3 flex items-center justify-center shadow-lg text-xs font-medium">
              Analyze
            </div>
            <div className="w-14 h-8 rounded-md bg-card border-2 border-chart-4 flex items-center justify-center shadow-lg text-xs font-medium">
              Expand
            </div>
          </div>
          <svg className="h-4 w-full">
            <line x1="30%" y1="0" x2="50%" y2="100%" stroke="currentColor" strokeWidth="2" className="text-muted-foreground" />
            <line x1="70%" y1="0" x2="50%" y2="100%" stroke="currentColor" strokeWidth="2" className="text-muted-foreground" />
          </svg>
          <div className="w-14 h-8 rounded-md bg-card border-2 border-chart-5 flex items-center justify-center shadow-lg text-xs font-medium">
            Merge
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: <MousePointerClick className="h-6 w-6" />,
    title: "Getting Started",
    description: (
      <ul className="space-y-3 text-muted-foreground">
        <li className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-chart-1/20 text-chart-1 flex items-center justify-center text-xs font-bold">1</span>
          <span><span className="text-foreground font-medium">Double-click</span> anywhere on the canvas to create a new node</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-chart-2/20 text-chart-2 flex items-center justify-center text-xs font-bold">2</span>
          <span>Write your prompt in the node's text area</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-chart-3/20 text-chart-3 flex items-center justify-center text-xs font-bold">3</span>
          <span><span className="text-foreground font-medium">Drag from the handle</span> at the bottom of a node to the top of another to connect them</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-chart-4/20 text-chart-4 flex items-center justify-center text-xs font-bold">4</span>
          <span>Click <span className="text-foreground font-medium">Run Flow</span> to execute your workflow</span>
        </li>
      </ul>
    ),
    visual: (
      <div className="relative h-32 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-chart-4/20 via-transparent to-chart-1/20 rounded-lg" />
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <MousePointerClick className="h-8 w-8 text-chart-1 animate-pulse" />
            <span className="text-xs text-muted-foreground">Double-click</span>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col items-center gap-1">
            <Workflow className="h-8 w-8 text-chart-2" />
            <span className="text-xs text-muted-foreground">Connect</span>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col items-center gap-1">
            <Play className="h-8 w-8 text-chart-3" />
            <span className="text-xs text-muted-foreground">Run</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Collaborate in Real-Time",
    description: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          Loopy is built for <span className="text-foreground font-medium">multiplayer collaboration</span>.
          Changes sync instantly across all connected users, so you can build AI
          workflows together in real-time.
        </p>
        <p className="text-muted-foreground leading-relaxed mt-3">
          Share your canvas with teammates to brainstorm, iterate, and explore
          ideas collectively.
        </p>
      </>
    ),
    visual: (
      <div className="relative h-32 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-chart-5/20 via-transparent to-chart-1/20 rounded-lg" />
        <div className="flex items-center -space-x-3">
          {[
            { color: "bg-chart-1", delay: "0ms" },
            { color: "bg-chart-2", delay: "100ms" },
            { color: "bg-chart-3", delay: "200ms" },
            { color: "bg-chart-4", delay: "300ms" },
          ].map((user, i) => (
            <div
              key={i}
              className={`w-12 h-12 rounded-full ${user.color} border-2 border-background flex items-center justify-center shadow-lg`}
              style={{
                animationDelay: user.delay,
                animation: "pop 0.3s ease-out forwards",
              }}
            >
              <Users className="h-5 w-5 text-background" />
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

export function OnboardingDialog({ open, onOpenChange }: OnboardingDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    markOnboardingSeen();
    onOpenChange(false);
    setCurrentStep(0);
  };

  const handleSkip = () => {
    markOnboardingSeen();
    onOpenChange(false);
    setCurrentStep(0);
  };

  const step = steps[currentStep];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden">
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
          }
          @keyframes pop {
            0% { transform: scale(0); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {step.icon}
            </div>
            {step.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {step.visual}
          <div className="space-y-2">{step.description}</div>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-1.5 py-2">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? "w-6 bg-primary"
                  : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-muted-foreground"
          >
            Skip
          </Button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" onClick={handlePrev}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button onClick={handleNext}>
              {currentStep === steps.length - 1 ? (
                "Get Started"
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

