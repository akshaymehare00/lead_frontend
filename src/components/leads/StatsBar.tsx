import { useEffect, useState } from "react";
import { TrendingUp, Users, CheckCircle, Clock } from "lucide-react";
import { api, type StatsResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

const STAT_CONFIG = [
  { key: "totalLeads" as const, label: "Total Leads", icon: Users, color: "text-primary", clickable: true },
  { key: "savedThisWeek" as const, label: "Saved This Week", icon: TrendingUp, color: "text-success", clickable: false },
  { key: "enriched" as const, label: "Enriched", icon: CheckCircle, color: "text-warning", clickable: true },
  { key: "pendingReview" as const, label: "Pending Review", icon: Clock, color: "text-destructive", clickable: true },
];

export const StatsBar = ({ onStatClick }: { onStatClick?: (key: "totalLeads" | "enriched" | "pendingReview") => void }) => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load stats"));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 animate-pulse">
            <div className="w-10 h-10 rounded-lg bg-secondary/60" />
            <div className="space-y-2">
              <div className="h-3 w-16 bg-secondary rounded" />
              <div className="h-6 w-12 bg-secondary rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {STAT_CONFIG.map(({ key, label, icon: Icon, color, clickable }) => {
        const value = stats[key];
        const change = stats.change[key];
        const isPositive = change?.startsWith("+");
        const onClick = clickable && onStatClick ? () => onStatClick(key) : undefined;
        return (
          <div
            key={key}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onClick={onClick}
            onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
            className={cn(
              "bg-card border border-border rounded-xl p-4 flex items-center gap-4 card-hover",
              onClick && "cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-colors"
            )}
          >
            <div className="w-10 h-10 rounded-lg bg-secondary/60 flex items-center justify-center flex-shrink-0">
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              <p className="text-xl font-bold text-foreground font-space mt-0.5">
                {typeof value === "number" ? value.toLocaleString() : value}
              </p>
              {change && (
                <p className={`text-[11px] font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
                  {change} this month
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
