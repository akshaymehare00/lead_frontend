import { Star, Phone, Globe, MapPin, Clock, CheckSquare, Square, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

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
        "relative rounded-xl border p-4 cursor-pointer transition-all duration-200 group",
        selected
          ? "bg-accent border-primary/40 shadow-[0_0_16px_hsl(214_100%_58%/0.1)]"
          : "bg-card border-border hover:border-primary/20 hover:bg-surface-2"
      )}
    >
      {/* Selection indicator */}
      <div className="absolute top-3 right-3">
        {selected ? (
          <CheckSquare className="w-4 h-4 text-primary" />
        ) : (
          <Square className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
        )}
      </div>

      {/* Lead number + name */}
      <div className="flex items-start gap-2 pr-6 mb-2">
        <span className="text-xs font-bold text-muted-foreground/50 mt-0.5 w-4 flex-shrink-0">{lead.rank}.</span>
        <div>
          <h3 className="text-sm font-semibold text-foreground leading-tight">{lead.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground font-medium">
              {lead.category}
            </span>
            {lead.isNew && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary font-medium">
                New
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-1 mb-3">
        <Star className="w-3.5 h-3.5 text-warning fill-warning" />
        <span className="text-xs font-bold text-warning">{lead.rating}</span>
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        {lead.address && (
          <div className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-muted-foreground leading-tight line-clamp-2">{lead.address}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
            <span className="text-xs text-muted-foreground">{lead.phone}</span>
          </div>
        )}
        {lead.website && (
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
            <a
              href={`https://${lead.website}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {lead.website}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        )}
        {lead.hours && (
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
            <span className="text-xs text-muted-foreground">{lead.hours}</span>
          </div>
        )}
      </div>
    </div>
  );
};
