import { Star, Phone, Globe, MapPin, Clock, CheckSquare, Square, ExternalLink, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

function CrmStatusBadge({ status, isNew }: { status?: string; isNew?: boolean }) {
  if (!status && !isNew) return null;
  const s = status ?? (isNew ? "NEW" : "");
  const config: Record<string, { label: string; className: string }> = {
    NEW: { label: "New", className: "bg-primary/15 border-primary/30 text-primary" },
    SAVED: { label: "Saved", className: "bg-success/15 border-success/30 text-success" },
    DUPLICATE: { label: "Duplicate", className: "bg-destructive/15 border-destructive/30 text-destructive" },
    ALREADY_REACHED: { label: "Reached", className: "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400" },
    SKIPPED: { label: "Skipped", className: "bg-muted border-border text-muted-foreground" },
    PENDING: { label: "Pending", className: "bg-muted border-border text-muted-foreground" },
  };
  const c = config[s] ?? config.NEW;
  return (
    <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", c.className)}>
      {c.label}
    </span>
  );
}

export interface Lead {
  id: string;
  rank: number;
  name: string;
  category: string;
  rating: number;
  address: string;
  phone?: string;
  website?: string;
  hours?: string;
  isNew?: boolean;
  crmStatus?: string;
  duplicateOf?: { id: string; name: string; crmId: string };
  email?: string;
  linkedin?: string;
  instagram?: string;
  enrichmentStatus?: string;
}

interface LeadCardProps {
  lead: Lead;
  selected: boolean;
  onToggle: (id: string) => void;
}

export const LeadCard = ({ lead, selected, onToggle }: LeadCardProps) => {
  return (
    <div
      onClick={() => onToggle(lead.id)}
      className={cn(
        "relative rounded-xl border p-4 cursor-pointer transition-all duration-200 group flex flex-col min-h-[220px] h-full overflow-hidden",
        selected
          ? "bg-accent border-primary/40 shadow-[0_0_16px_hsl(214_100%_58%/0.1)]"
          : "bg-card border-border hover:border-primary/20 hover:bg-surface-2"
      )}
    >
      {/* Selection indicator */}
      <div className="absolute top-3 right-3 z-10">
        {selected ? (
          <CheckSquare className="w-4 h-4 text-primary" />
        ) : (
          <Square className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
        )}
      </div>

      {/* Lead number + name */}
      <div className="flex items-start gap-2 pr-6 mb-2 flex-shrink-0">
        <span className="text-xs font-bold text-muted-foreground/50 mt-0.5 w-4 flex-shrink-0">{lead.rank}.</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{lead.name}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground font-medium">
              {lead.category}
            </span>
            <CrmStatusBadge status={lead.crmStatus} isNew={lead.isNew} />
            {(lead.email || lead.linkedin || lead.instagram) && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 border border-warning/30 text-warning font-medium flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Enriched
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-1 mb-2 flex-shrink-0">
        <Star className="w-3.5 h-3.5 text-warning fill-warning" />
        <span className="text-xs font-bold text-warning">{lead.rating}</span>
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        {lead.address && (
          <div className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-muted-foreground leading-tight line-clamp-2 break-words">{lead.address}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-2 min-w-0">
            <Phone className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{lead.phone}</span>
          </div>
        )}
        {lead.website && (
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
            <a
              href={`https://${lead.website}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-primary hover:underline flex items-center gap-1 truncate min-w-0"
            >
              <span className="truncate">{lead.website}</span>
              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
            </a>
          </div>
        )}
        {lead.hours && (
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{lead.hours}</span>
          </div>
        )}
      </div>

    </div>
  );
};
