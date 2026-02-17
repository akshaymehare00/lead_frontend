import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, title: "Define Lead Type", desc: "Select category" },
  { id: 2, title: "Search Google Maps", desc: "Find businesses" },
  { id: 3, title: "Create Lead List", desc: "Compile initial data" },
  { id: 4, title: "CRM Duplicate Check", desc: "Verify uniqueness" },
  { id: 5, title: "Enrichment Prep", desc: "Move verified leads" },
  { id: 6, title: "Collect Lead Details", desc: "Enrich with data" },
  { id: 7, title: "Finalize Outreach", desc: "Ready for sales" },
];

interface StepsPanelProps {
  currentStep: number;
}

export const StepsPanel = ({ currentStep }: StepsPanelProps) => {
  return (
    <div className="flex flex-col gap-1 p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-2">
        Workflow
      </p>
      {STEPS.map((step, idx) => {
        const done = currentStep > step.id;
        const active = currentStep === step.id;
        return (
          <div
            key={step.id}
            className={cn(
              "relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200",
              active && "bg-accent border border-primary/20",
              done && "opacity-70",
              !active && !done && "hover:bg-secondary/50"
            )}
          >
            <div className="relative flex-shrink-0">
              {done ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : active ? (
                <div className="w-4 h-4 rounded-full border-2 border-primary bg-primary/20 animate-pulse-glow" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground/40" />
              )}
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    "absolute left-1/2 top-full w-px h-[18px] -translate-x-1/2 mt-1",
                    done ? "bg-success/40" : "bg-border"
                  )}
                />
              )}
            </div>
            <div className="min-w-0">
              <p className={cn(
                "text-xs font-semibold leading-tight",
                active ? "text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/60"
              )}>
                Step {step.id}: {step.title}
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{step.desc}</p>
            </div>
            {active && (
              <ArrowRight className="w-3 h-3 text-primary ml-auto flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
};
