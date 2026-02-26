import { useState, useCallback } from "react";
import { ChevronDown, Zap, SlidersHorizontal, Loader2, LocateFixed } from "lucide-react";
import { LocationAutocomplete } from "./LocationAutocomplete";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SearchParams =
  | { mode: "natural"; query: string; maxLead: number }
  | { mode: "manual"; location: string; categories: string[]; maxLead: number }
  | { mode: "current_location"; latitude: number; longitude: number; radiusKm: number; maxLead: number };

const CATEGORIES = [
  "Chain Store",
  "Polished Dealers",
  "Diamond Manufacturers",
  "E-Commerce",
  "Jewellery Manufacturers",
  "Retailer",
];

const LEAD_COUNTS = [10, 20, 30, 50, 100];

function getBestPosition(targetAccuracy = 100, maxWaitMs = 15_000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    let best: GeolocationPosition | null = null;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) {
          best = pos;
        }
        if (pos.coords.accuracy <= targetAccuracy) {
          navigator.geolocation.clearWatch(watchId);
          clearTimeout(timer);
          resolve(best);
        }
      },
      (err) => {
        navigator.geolocation.clearWatch(watchId);
        clearTimeout(timer);
        if (best) {
          resolve(best);
        } else {
          reject(err);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs }
    );

    const timer = setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      if (best) {
        resolve(best);
      } else {
        reject(new Error("Location request timed out. Please try again."));
      }
    }, maxWaitMs);
  });
}

interface SearchPanelProps {
  onSearch: (params: SearchParams) => void;
  isSearching: boolean;
  compact?: boolean;
}

export const SearchPanel = ({ onSearch, isSearching, compact }: SearchPanelProps) => {
  const [location, setLocation] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [leadCount, setLeadCount] = useState(10);
  const [countOpen, setCountOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const getLocation = useCallback(async () => {
    setLocating(true);
    try {
      const pos = await getBestPosition(100, 15_000);
      const { latitude, longitude } = pos.coords;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10`
      );
      const data = await res.json();
      const addr = data.address;
      const name =
        addr?.city || addr?.town || addr?.village || addr?.county ||
        data.display_name?.split(",").slice(0, 2).join(",").trim() ||
        `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      setLocation(name);
    } catch {
      // Silently fail — user can still type location manually
    } finally {
      setLocating(false);
    }
  }, []);

  const handleSearch = () => {
    if (!location.trim() || selectedCategories.length === 0) return;
    onSearch({ mode: "manual", location, categories: selectedCategories, maxLead: leadCount });
  };

  const canSearch = location.trim().length > 0 && selectedCategories.length > 0;

  return (
    <div className={compact ? "space-y-4" : "p-6 space-y-5"}>
      {!compact && (
        <div className="flex items-center gap-2 mb-1">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Search Parameters</span>
        </div>
      )}

      {/* Location */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</label>
          <button
            type="button"
            onClick={getLocation}
            disabled={locating || isSearching}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
          >
            {locating ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Locating...
              </>
            ) : (
              <>
                <LocateFixed className="w-3 h-3" />
                Get Location
              </>
            )}
          </button>
        </div>
        <LocationAutocomplete
          value={location}
          onChange={setLocation}
          placeholder="e.g. Pune, Mumbai"
          disabled={isSearching}
        />
        <p className="text-[10px] text-muted-foreground/60">Search radius: 25 km</p>
      </div>

      {/* Business Category */}
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

      {/* Max Lead Count */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Max Lead Count
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
