import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, title: "Home" },
  { id: 2, title: "Create List" },
  { id: 3, title: "CRM Check" },
  { id: 4, title: "Enrichment List" },
  { id: 5, title: "Final List" },
];

interface WorkflowStepperProps {
  currentStep: number;
  maxStepReached?: number;
  onStepClick?: (stepId: number) => void;
}

export const WorkflowStepper = ({ currentStep, maxStepReached, onStepClick }: WorkflowStepperProps) => {
  const reachable = maxStepReached ?? currentStep;
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const done = currentStep > step.id;
        const active = currentStep === step.id;
        const canNavigate = step.id <= reachable;
        const handleClick = () => {
          if (canNavigate && onStepClick) onStepClick(step.id);
        };
        return (
          <div key={step.id} className="flex items-center">
            <button
              type="button"
              onClick={handleClick}
              disabled={!canNavigate || !onStepClick}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                active && "bg-primary/15 border border-primary/30 text-primary",
                done && "text-muted-foreground",
                !active && !done && "text-muted-foreground/40",
                canNavigate && onStepClick && "cursor-pointer hover:bg-accent/50 hover:text-foreground",
                !canNavigate && "cursor-default"
              )}
            >
              {done ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
              ) : active ? (
                <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0 animate-pulse" />
              ) : (
                <div className="w-3 h-3 rounded-full border border-current flex-shrink-0" />
              )}
              <span className="whitespace-nowrap">{step.title}</span>
            </button>
            {idx < STEPS.length - 1 && (
              <ChevronRight className={cn(
                "w-3.5 h-3.5 mx-0.5 flex-shrink-0",
                done ? "text-success/50" : "text-muted-foreground/20"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
};
