import { useState, useEffect } from "react";
import {
  X, Star, Phone, Globe, MapPin, Clock, ExternalLink,
  CheckCircle2, User, Building2, Mail,
  Linkedin, Instagram, ArrowRight, Trash2
} from "lucide-react";
import { Lead } from "./LeadCard";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

const ENRICHMENT_SOURCE_MAP: Record<string, { icon: typeof Globe; label: string }> = {
  WEBSITE: { icon: Globe, label: "Company Website" },
  LINKEDIN: { icon: Linkedin, label: "LinkedIn" },
  INSTAGRAM: { icon: Instagram, label: "Instagram" },
  GOOGLE_MAPS: { icon: MapPin, label: "Google Maps" },
};

interface LeadDetailPanelProps {
  lead: Lead | null;
  onClose: () => void;
  onLeadUpdated?: (lead: Lead) => void;
  onSaveLead?: () => void;
  onSkipLead?: () => void;
  onRemoveLead?: () => void;
}

export const LeadDetailPanel = ({ lead, onClose, onLeadUpdated, onSaveLead, onSkipLead, onRemoveLead }: LeadDetailPanelProps) => {
  const [fullLead, setFullLead] = useState<{
    email?: string | null;
    linkedin?: string | null;
    instagram?: string | null;
    website?: string | null;
    contactPerson?: string | null;
    designation?: string | null;
    crmStatus?: string;
    isNew?: boolean;
    enrichmentSources?: { source: string; done: boolean }[];
  } | null>(null);
  useEffect(() => {
    if (!lead?.id) return;
    api.leads
      .get(lead.id)
      .then((l) =>
        setFullLead({
          email: l.email,
          linkedin: l.linkedin,
          instagram: l.instagram,
          website: l.website,
          contactPerson: l.contactPerson,
          designation: l.designation,
          crmStatus: l.crmStatus,
          isNew: (!!l.crmCheckedAt || l.crmStatus === "SAVED") ? false : (l.isNew ?? undefined),
          enrichmentSources: l.enrichmentSources,
        })
      )
      .catch(() => setFullLead(null));
  }, [lead?.id]);

  if (!lead) return null;

  const apiEnrichment = new Map(
    (fullLead?.enrichmentSources ?? []).map((s) => [s.source, s.done])
  );
  const hasData: Record<string, boolean> = {
    GOOGLE_MAPS: true,
    WEBSITE: !!(fullLead?.website || lead.website),
    LINKEDIN: !!(fullLead?.linkedin || lead.linkedin),
    INSTAGRAM: !!(fullLead?.instagram || lead.instagram),
  };
  const enrichmentSources = Object.entries(ENRICHMENT_SOURCE_MAP).map(([key, val]) => ({
    ...val,
    done: apiEnrichment.get(key) || hasData[key] || false,
  }));

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-card border-l border-border z-50 flex flex-col shadow-2xl animate-slide-up"
        style={{ animation: "slideInRight 0.25s ease forwards" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              {(() => {
                const s = (fullLead?.isNew ?? lead.isNew) === false ? "SAVED" : (fullLead?.crmStatus ?? lead.crmStatus ?? (lead.isNew ? "NEW" : ""));
                if (!s) return null;
                const badges: Record<string, { label: string; cls: string }> = {
                  NEW: { label: "NEW", cls: "bg-primary/15 border-primary/30 text-primary" },
                  SAVED: { label: "SAVED", cls: "bg-success/15 border-success/30 text-success" },
                  DUPLICATE: { label: "DUPLICATE", cls: "bg-destructive/15 border-destructive/30 text-destructive" },
                  ALREADY_REACHED: { label: "REACHED", cls: "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400" },
                  SKIPPED: { label: "SKIPPED", cls: "bg-muted border-border text-muted-foreground" },
                };
                const b = badges[s] ?? badges.NEW;
                return (
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold", b.cls)}>
                    {b.label}
                  </span>
                );
              })()}
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground font-medium">
                {lead.category}
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground leading-tight">{lead.name}</h2>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Star className="w-4 h-4 text-warning fill-warning" />
              <span className="text-sm font-bold text-warning">{lead.rating}</span>
              <span className="text-xs text-muted-foreground">· Google Maps rating</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Contact Info */}
          <div className="p-6 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Contact Information</p>
            <div className="space-y-3">
              <InfoRow icon={MapPin} label="Address" value={lead.address} />
              {lead.phone && <InfoRow icon={Phone} label="Phone" value={lead.phone} />}
              {(fullLead?.email || lead.email) && (
                <InfoRow icon={Mail} label="Email" value={(fullLead?.email ?? lead.email)!} isMailto />
              )}
              {(lead.website || fullLead?.website) && (
                <InfoRow icon={Globe} label="Website" value={(lead.website || fullLead?.website)!} isLink />
              )}
              {(fullLead?.linkedin || lead.linkedin) && (
                <InfoRow icon={Linkedin} label="LinkedIn" value={(fullLead?.linkedin ?? lead.linkedin)!} isLink />
              )}
              {(fullLead?.instagram || lead.instagram) && (
                <InfoRow icon={Instagram} label="Instagram" value={(fullLead?.instagram ?? lead.instagram)!} isLink />
              )}
              {(fullLead?.contactPerson || lead.contactPerson) && (
                <InfoRow icon={User} label="Contact Person" value={(fullLead?.contactPerson ?? lead.contactPerson)!} />
              )}
              {lead.hours && <InfoRow icon={Clock} label="Hours" value={lead.hours} />}
            </div>
          </div>

          {/* Lead Data Fields */}
          <div className="p-6 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Lead Data (Step 3 Fields)
            </p>
            <div className="space-y-2.5">
              <DataField icon={Building2} label="Company Name" value={lead.name} filled />
              <DataField icon={Building2} label="Customer Type" value={lead.category} filled />
              <DataField icon={Phone} label="Phone Number" value={lead.phone || "—"} filled={!!lead.phone} />
              <DataField icon={Mail} label="Email Address" value={fullLead?.email ?? lead.email ?? "—"} filled={!!(fullLead?.email || lead.email)} />
              <DataField icon={Globe} label="Website" value={fullLead?.website ?? lead.website ?? "—"} filled={!!(fullLead?.website || lead.website)} />
              <DataField icon={Linkedin} label="LinkedIn" value={fullLead?.linkedin ?? lead.linkedin ?? "—"} filled={!!(fullLead?.linkedin || lead.linkedin)} />
              <DataField icon={Instagram} label="Instagram" value={fullLead?.instagram ?? lead.instagram ?? "—"} filled={!!(fullLead?.instagram || lead.instagram)} />
              <DataField icon={MapPin} label="Full Address" value={lead.address} filled />
            </div>
          </div>

        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-border bg-surface-1 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSkipLead?.()}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-all font-medium"
            >
              Skip Lead
            </button>
            <button
              type="button"
              onClick={() => onSaveLead?.()}
              className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-[0_0_16px_hsl(214_100%_58%/0.25)]"
            >
              Save to CRM
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {onRemoveLead && (
            <button
              type="button"
              onClick={() => onRemoveLead()}
              className="w-full py-2 rounded-lg border border-destructive/50 text-destructive text-sm hover:bg-destructive/10 transition-all font-medium flex items-center justify-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove Lead
            </button>
          )}
        </div>
      </div>
    </>
  );
};

const InfoRow = ({
  icon: Icon, label, value, isLink, isMailto
}: {
  icon: React.ElementType; label: string; value: string; isLink?: boolean; isMailto?: boolean;
}) => {
  const href = isMailto
    ? `mailto:${value}`
    : isLink
      ? (value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`)
      : undefined;
  const displayValue = isLink
    ? value.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
    : value;

  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground/60 uppercase font-medium tracking-wider">{label}</p>
        {href ? (
          <a
            href={href}
            target={isMailto ? undefined : "_blank"}
            rel={isMailto ? undefined : "noopener noreferrer"}
            className="text-sm text-primary hover:underline flex items-center gap-1 mt-0.5 break-all"
          >
            {displayValue}
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        ) : (
          <p className="text-sm text-foreground mt-0.5 leading-snug">{value}</p>
        )}
      </div>
    </div>
  );
};

const DataField = ({
  icon: Icon, label, value, filled
}: {
  icon: React.ElementType; label: string; value: string; filled: boolean;
}) => (
  <div className={cn(
    "flex items-center gap-3 px-3.5 py-2.5 rounded-lg border",
    filled ? "bg-surface-2 border-border" : "bg-secondary/20 border-border/50"
  )}>
    <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", filled ? "text-primary/70" : "text-muted-foreground/30")} />
    <div className="flex-1 min-w-0">
      <p className="text-[10px] text-muted-foreground/50 font-medium">{label}</p>
      <p className={cn("text-xs font-medium truncate mt-0.5", filled ? "text-foreground" : "text-muted-foreground/30")}>{value}</p>
    </div>
    {filled ? (
      <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
    ) : (
      <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/20 flex-shrink-0" />
    )}
  </div>
);
