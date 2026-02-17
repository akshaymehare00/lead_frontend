import { TrendingUp, Users, CheckCircle, Clock } from "lucide-react";

const STATS = [
  { label: "Total Leads", value: "1,248", change: "+12.5%", icon: Users, color: "text-primary" },
  { label: "Saved This Week", value: "86", change: "+8.2%", icon: TrendingUp, color: "text-success" },
  { label: "Enriched", value: "934", change: "+5.1%", icon: CheckCircle, color: "text-warning" },
  { label: "Pending Review", value: "314", change: "-2.3%", icon: Clock, color: "text-destructive" },
];

export const StatsBar = () => {
  return (
    <div className="grid grid-cols-4 gap-4">
      {STATS.map((stat) => {
        const Icon = stat.icon;
        const isPositive = stat.change.startsWith("+");
        return (
          <div
            key={stat.label}
            className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 card-hover"
          >
            <div className="w-10 h-10 rounded-lg bg-secondary/60 flex items-center justify-center flex-shrink-0">
              <Icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
              <p className="text-xl font-bold text-foreground font-space mt-0.5">{stat.value}</p>
              <p className={`text-[11px] font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
                {stat.change} this month
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
