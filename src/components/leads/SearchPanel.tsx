import { useState } from "react";
import { Search, ChevronDown, Zap, SlidersHorizontal } from "lucide-react";
import { LocationAutocomplete } from "./LocationAutocomplete";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SearchParams =
  | { mode: "natural"; query: string; count: number }
  | { mode: "manual"; location: string; categories: string[]; count: number };

const CATEGORIES = [
  "Chain Store",
  "Polished Dealers",
  "Diamond Manufacturers",
  "E-Commerce",
  "Jewellery Manufacturers",
  "Retailer",
];

const LEAD_COUNTS = [10, 20, 30, 50, 100];

interface SearchPanelProps {
  onSearch: (params: SearchParams) => void;
  isSearching: boolean;
}

export const SearchPanel = ({ onSearch, isSearching }: SearchPanelProps) => {
  const [mode, setMode] = useState<"natural" | "manual">("natural");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [leadCount, setLeadCount] = useState(10);
  const [countOpen, setCountOpen] = useState(false);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSearch = () => {
    if (mode === "natural") {
      if (!query.trim()) return;
      onSearch({ mode: "natural", query: query.trim(), count: leadCount });
    } else {
      if (!location.trim() || selectedCategories.length === 0) return;
      onSearch({ mode: "manual", location, categories: selectedCategories, count: leadCount });
    }
  };

  const canSearch =
    mode === "natural" ? query.trim().length > 0 : location.trim().length > 0 && selectedCategories.length > 0;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <SlidersHorizontal className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Search Parameters</span>
      </div>

      {/* Tabs: Natural Language / Manual Search */}
      <div className="flex rounded-lg bg-secondary/30 border border-border p-1">
        <button
          onClick={() => setMode("natural")}
          className={cn(
            "flex-1 flex items-center justify-center py-2 rounded-md text-xs font-medium transition-all",
            mode === "natural"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Natural Language
        </button>
        <button
          onClick={() => setMode("manual")}
          className={cn(
            "flex-1 flex items-center justify-center py-2 rounded-md text-xs font-medium transition-all",
            mode === "manual"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Manual Search
        </button>
      </div>

      {mode === "natural" ? (
        /* Natural Language: single query input */
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Search Query
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
            <input
              type="text"
              placeholder='e.g. Find jewelry shops in Dubai'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
            />
          </div>
        </div>
      ) : (
        /* Manual: Location + Business Category */
        <>
          {/* Location Input with autocomplete */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</label>
            <LocationAutocomplete
              value={location}
              onChange={setLocation}
              placeholder="e.g. Pune, Mumbai"
              disabled={isSearching}
            />
          </div>

          {/* Categories - only in manual mode */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Business Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => {
                const active = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={cn(
                      "text-xs px-3 py-2.5 rounded-lg border font-medium text-left transition-all duration-150",
                      active
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-secondary/30 border-border text-muted-foreground hover:border-primary/20 hover:text-foreground"
                    )}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Lead Count */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Lead Count
        </label>
        <div className="relative">
          <button
            onClick={() => setCountOpen(!countOpen)}
            className="w-full flex items-center justify-between bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground transition-all hover:border-primary/30"
          >
            <span className="font-medium">{leadCount} Leads</span>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", countOpen && "rotate-180")} />
          </button>
          {countOpen && (
            <div className="absolute top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg z-10 overflow-hidden animate-slide-up">
              {LEAD_COUNTS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setLeadCount(c); setCountOpen(false); }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm transition-colors",
                    c === leadCount
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-secondary"
                  )}
                >
                  {c} Leads
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search Button */}
      <Button
        onClick={handleSearch}
        disabled={isSearching || !canSearch}
        className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_hsl(214_100%_58%/0.2)] hover:shadow-[0_0_30px_hsl(214_100%_58%/0.35)] disabled:opacity-40 disabled:shadow-none"
      >
        {isSearching ? (
          <>
            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Searching...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Find Leads
          </>
        )}
      </Button>
    </div>
  );
};
