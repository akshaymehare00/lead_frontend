import {
  X, Star, Phone, Globe, MapPin, Clock, ExternalLink,
  CheckCircle2, Circle, Tag, User, Building2, Mail,
  Linkedin, Instagram, FileText, ArrowRight
} from "lucide-react";
import { Lead } from "./LeadCard";
import { cn } from "@/lib/utils";

const ENRICHMENT_SOURCES = [
  { icon: Globe, label: "Company Website", done: false },
  { icon: Linkedin, label: "LinkedIn", done: false },
  { icon: Instagram, label: "Instagram", done: false },
  { icon: MapPin, label: "Google Maps", done: true },
];

interface LeadDetailPanelProps {
  lead: Lead | null;
  onClose: () => void;
}

export const LeadDetailPanel = ({ lead, onClose }: LeadDetailPanelProps) => {
  if (!lead) return null;

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
              {lead.isNew && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary font-semibold">
                  NEW
                </span>
              )}
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
              {lead.website && (
                <InfoRow icon={Globe} label="Website" value={lead.website} isLink />
              )}
              {lead.hours && <InfoRow icon={Clock} label="Hours" value={lead.hours} />}
            </div>
          </div>

          {/* Enrichment Checklist */}
          <div className="p-6 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Enrichment Checklist (Step 6)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ENRICHMENT_SOURCES.map((src) => {
                const Icon = src.icon;
                return (
                  <div
                    key={src.label}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all",
                      src.done
                        ? "bg-success/5 border-success/20 text-success"
                        : "bg-secondary/30 border-border text-muted-foreground"
                    )}
                  >
                    {src.done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 flex-shrink-0" />
                    )}
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {src.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lead Data Fields */}
          <div className="p-6 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Lead Data (Step 3 Fields)
            </p>
            <div className="space-y-2.5">
              <DataField icon={Building2} label="Company Name" value={lead.name} filled />
              <DataField icon={User} label="Contact Person" value="—" filled={false} />
              <DataField icon={Tag} label="Designation / Title" value="—" filled={false} />
              <DataField icon={Building2} label="Customer Type" value={lead.category} filled />
              <DataField icon={Phone} label="Phone Number" value={lead.phone || "—"} filled={!!lead.phone} />
              <DataField icon={Mail} label="Email Address" value="—" filled={false} />
              <DataField icon={MapPin} label="Full Address" value={lead.address} filled />
            </div>
          </div>

          {/* CRM Status */}
          <div className="p-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              CRM Status (Step 4)
            </p>
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-primary/8 border border-primary/15">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {lead.isNew ? "Not in CRM — New Lead" : "Existing Lead in CRM"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {lead.isNew
                    ? "Proceed to enrichment step"
                    : "Request lead transfer from Global Sales Head"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-border bg-surface-1 flex gap-2">
          <button className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-all font-medium">
            Skip Lead
          </button>
          <button className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-[0_0_16px_hsl(214_100%_58%/0.25)]">
            Save to CRM
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
};

const InfoRow = ({
  icon: Icon, label, value, isLink
}: {
  icon: React.ElementType; label: string; value: string; isLink?: boolean;
}) => (
  <div className="flex items-start gap-3">
    <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground/60 uppercase font-medium tracking-wider">{label}</p>
      {isLink ? (
        <a
          href={`https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline flex items-center gap-1 mt-0.5"
        >
          {value}
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <p className="text-sm text-foreground mt-0.5 leading-snug">{value}</p>
      )}
    </div>
  </div>
);

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
