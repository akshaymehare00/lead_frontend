import { useState } from "react";
import { Star, Phone, Globe, MapPin, Clock, CheckSquare, Square, ExternalLink, CheckCircle2, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function CrmStatusBadge({ lead }: { lead: Lead }) {
  const wasChecked = !!(lead.checkedAt || lead.crmCheckedAt);
  const hasSimilar = wasChecked && (lead.similarMatches?.length ?? 0) > 0 && !lead.duplicateOf;
  const passedCheck = wasChecked && lead.crmStatus === "NEW" && !lead.duplicateOf;
  const saved = lead.isNew === false;

  const effectiveStatus = lead.duplicateOf
    ? "DUPLICATE"
    : hasSimilar
      ? "FOUND_SIMILAR"
      : passedCheck
        ? "NOT_DUPLICATE"
        : saved
          ? "SAVED"
          : (lead.crmStatus ?? (lead.isNew ? "NEW" : "PENDING"));

  const config: Record<string, { label: string; className: string }> = {
    PENDING: { label: "Pending", className: "bg-muted border-border text-muted-foreground" },
    NEW: { label: "New", className: "bg-primary/15 border-primary/30 text-primary" },
    SAVED: { label: "Saved", className: "bg-success/15 border-success/30 text-success" },
    NOT_DUPLICATE: { label: "Not Duplicate", className: "bg-success/15 border-success/30 text-success" },
    DUPLICATE: { label: "Duplicate", className: "bg-destructive/15 border-destructive/30 text-destructive" },
    FOUND_SIMILAR: { label: "Found Similar", className: "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400" },
    ALREADY_REACHED: { label: "Already Reached", className: "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400" },
    SKIPPED: { label: "Skipped", className: "bg-muted border-border text-muted-foreground" },
  };

  const c = config[effectiveStatus] ?? config.PENDING;

  // If we truly have no status info at all, don't show a pill
  if (!wasChecked && !saved && !lead.isNew && !lead.crmStatus) {
    return null;
  }

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
  contactPerson?: string;
  /** From CRM check response — similar leads for duplicate check UI */
  similarMatches?: Array<{
    id: string;
    source: string;
    name: string;
    score: number;
    matchedFields: string[];
    reason: string;
  }>;
  checkMessage?: string;
  /** When duplicate check was performed (from session API) */
  crmCheckedAt?: string;
  /** Timestamp when CRM check was performed */
  checkedAt?: number;
  /** Enrichment sources status from API */
  enrichmentSources?: { source: string; done: boolean }[];
  /** Workflow step (6 = enrichment, 7 = final) */
  currentStep?: number;
}

interface LeadCardProps {
  lead: Lead;
  selected: boolean;
  onToggle: (id: string) => void;
  /** Same-company accent (border/background) — when multiple leads share the same name */
  companyColor?: string;
  /** Other leads with same name (different locations) — for "Duplicate store" pill */
  siblingLeads?: Lead[];
  /** Callback when user chooses to view a sibling lead */
  onViewSibling?: (lead: Lead) => void;
}

export const LeadCard = ({ lead, selected, onToggle, companyColor, siblingLeads, onViewSibling }: LeadCardProps) => {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const hasSiblings = siblingLeads && siblingLeads.length > 0;
  return (
    <div
      onClick={() => onToggle(lead.id)}
      className={cn(
        "relative rounded-xl border p-4 cursor-pointer transition-all duration-200 group flex flex-col min-h-[220px] h-full overflow-hidden",
        selected
          ? "bg-accent border-primary/40 shadow-[0_0_16px_hsl(214_100%_58%/0.1)]"
          : "bg-card border-border hover:border-primary/20 hover:bg-surface-2",
        companyColor
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
            <CrmStatusBadge lead={lead} />
            {lead.currentStep != null && lead.currentStep >= 6 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-violet-500/15 border-violet-500/30 text-violet-600 dark:text-violet-400">
                In Enrichment
              </span>
            )}
            {hasSiblings && (
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 transition-colors"
                  >
                    <Store className="w-2.5 h-2.5" />
                    {siblingLeads!.length + 1} stores
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 p-0" onClick={(e) => e.stopPropagation()}>
                  <div className="p-2 border-b border-border">
                    <p className="text-xs font-semibold text-foreground">Same company — other locations</p>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {[lead, ...siblingLeads!].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewSibling?.(s);
                          setPopoverOpen(false);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors border-b border-border/50 last:border-0"
                      >
                        <p className="text-xs font-medium text-foreground truncate">{s.name}</p>
                        {s.address && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{s.address}</p>
                        )}
                        <span className="text-[10px] text-primary font-semibold mt-1 inline-block">View →</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
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

      {/* Duplicate of — shown when Duplicate in CRM check */}
      {lead.duplicateOf && (
        <div className="mt-2 pt-2 border-t border-destructive/20 space-y-1 flex-shrink-0">
          <p className="text-[10px] font-semibold text-destructive uppercase tracking-wider">Duplicate of</p>
          <p className="text-xs font-medium text-foreground">{lead.duplicateOf.name}</p>
          {lead.duplicateOf.crmId && (
            <p className="text-[10px] text-muted-foreground">CRM ID: {lead.duplicateOf.crmId}</p>
          )}
        </div>
      )}

      {/* Similar matches — shown when Found Similar in CRM check */}
      {!lead.duplicateOf && lead.similarMatches && lead.similarMatches.length > 0 && (
        <div className="mt-2 pt-2 border-t border-amber-500/20 space-y-1 flex-shrink-0">
          <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Similar to
          </p>
          {lead.similarMatches.map((m) => (
            <div key={m.id} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{m.name}</span>
              {m.source === "duplicate_dummy" && (
                <span className="ml-1 text-[10px] text-muted-foreground/70">(CRM)</span>
              )}
              {m.score != null && (
                <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400">{m.score}% match</span>
              )}
              {m.matchedFields?.length > 0 && (
                <p className="text-[10px] text-muted-foreground/80 mt-0.5">Matched: {m.matchedFields.join(", ")}</p>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
