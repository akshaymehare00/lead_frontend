import { useState, useEffect } from "react";
import {
  X, Star, Phone, Globe, MapPin, Clock,
  CheckCircle2, User, Building2, Mail, Trash2
} from "lucide-react";
import { Lead } from "./LeadCard";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { formatHoursWithIST } from "@/lib/hours-to-ist";
import { LinkedinLogo, InstagramLogo } from "./BrandLogos";

const ENRICHMENT_SOURCE_MAP: Record<string, { icon: React.ElementType; label: string }> = {
  WEBSITE: { icon: Globe, label: "Company Website" },
  LINKEDIN: { icon: LinkedinLogo, label: "LinkedIn" },
  INSTAGRAM: { icon: InstagramLogo, label: "Instagram" },
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
          {/* Contact Information - Company at top, then Address, Phone, etc. */}
          <div className="p-6 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Contact Information</p>
            <div className="space-y-2.5">
              <ContactField icon={Building2} label="Company" value={`${lead.name} · ${lead.category}`} filled />
              <ContactField icon={MapPin} label="Address" value={lead.address} filled={!!lead.address} />
              <ContactField icon={Phone} label="Phone" value={lead.phone ?? "—"} filled={!!lead.phone} />
              <ContactField icon={Mail} label="Email" value={fullLead?.email ?? lead.email ?? "—"} filled={!!(fullLead?.email || lead.email)} />
              <ContactField icon={User} label="Contact Person" value={fullLead?.contactPerson ?? lead.contactPerson ?? "—"} filled={!!(fullLead?.contactPerson || lead.contactPerson)} />
              <ContactField icon={Clock} label="Hours" value={lead.hours ? formatHoursWithIST(lead.hours, lead.address ?? "") : "—"} filled={!!lead.hours} />
            </div>
          </div>

        </div>

        {/* Social links - separate buttons at bottom */}
        {(fullLead?.website || lead.website || fullLead?.linkedin || lead.linkedin || fullLead?.instagram || lead.instagram) && (
          <div className="p-4 border-t border-border bg-surface-1 flex flex-wrap gap-2">
            {(fullLead?.website || lead.website) && (
              <SocialButton
                href={(fullLead?.website ?? lead.website)!.startsWith("http") ? (fullLead?.website ?? lead.website)! : `https://${fullLead?.website ?? lead.website}`}
                icon={Globe}
                label="Website"
              />
            )}
            {(fullLead?.linkedin || lead.linkedin) && (
              <SocialButton
                href={(fullLead?.linkedin ?? lead.linkedin)!.startsWith("http") ? (fullLead?.linkedin ?? lead.linkedin)! : `https://${fullLead?.linkedin ?? lead.linkedin}`}
                icon={LinkedinLogo}
                label="LinkedIn"
                useBrandLogo
              />
            )}
            {(fullLead?.instagram || lead.instagram) && (
              <SocialButton
                href={(fullLead?.instagram ?? lead.instagram)!.startsWith("http") ? (fullLead?.instagram ?? lead.instagram)! : `https://${fullLead?.instagram ?? lead.instagram}`}
                icon={InstagramLogo}
                label="Instagram"
                useBrandLogo
              />
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="p-4 border-t border-border bg-surface-1 flex flex-col gap-2">
          {onRemoveLead && (
            <button
              type="button"
              onClick={() => onRemoveLead()}
              className="w-full py-2 rounded-lg border border-destructive/50 text-destructive text-sm hover:bg-destructive/10 transition-all font-medium flex items-center justify-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Lead
            </button>
          )}
        </div>
      </div>
    </>
  );
};

const SocialButton = ({
  href,
  icon: Icon,
  label,
  useBrandLogo,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  useBrandLogo?: boolean;
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-secondary transition-colors text-sm font-medium"
  >
    {useBrandLogo ? <Icon size={18} /> : <Icon className="w-4 h-4" />}
    {label}
  </a>
);

const ContactField = ({
  icon: Icon,
  label,
  value,
  filled,
  isLink,
  isMailto,
  useBrandLogo,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  filled: boolean;
  isLink?: boolean;
  isMailto?: boolean;
  useBrandLogo?: boolean;
}) => {
  const isEmpty = value === "—" || !value?.trim();
  const hasLink = filled && (isLink || isMailto) && !isEmpty;
  const href = hasLink
    ? isMailto
      ? `mailto:${value}`
      : (value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`)
    : undefined;
  const displayValue = isLink && value ? value.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : value;
  const visitLabel = label === "Website" ? "Visit Website" : label === "LinkedIn" ? "Visit LinkedIn" : label === "Instagram" ? "Visit Instagram" : label === "Email" ? "Send Email" : "Open";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3.5 py-2.5 rounded-lg border transition-colors",
        filled ? "bg-success/10 border-success/30" : "bg-muted/50 border-border/50"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          filled ? "bg-success/20" : "bg-muted"
        )}
      >
        {useBrandLogo ? (
          <span className={cn("flex items-center justify-center", !filled && "opacity-40 grayscale")}>
            <Icon size={16} />
          </span>
        ) : (
          <Icon className={cn("w-4 h-4 flex-shrink-0", filled ? "text-success" : "text-muted-foreground/50")} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground/60 uppercase font-medium tracking-wider">{label}</p>
        {hasLink && href ? (
          <a
            href={href}
            target={isMailto ? undefined : "_blank"}
            rel={isMailto ? undefined : "noopener noreferrer"}
            className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {useBrandLogo ? <Icon size={14} /> : <Icon className="w-3.5 h-3.5" />}
            {visitLabel}
          </a>
        ) : (
          <p className={cn("text-sm mt-0.5 leading-snug break-words", filled ? "text-foreground" : "text-muted-foreground/60")}>
            {value}
          </p>
        )}
      </div>
      {filled ? (
        <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
      ) : (
        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
      )}
    </div>
  );
};

