import { useState, useCallback } from "react";
import { Search, ChevronDown, Zap, SlidersHorizontal, MapPin, Loader2, LocateFixed } from "lucide-react";
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
const RADIUS_OPTIONS = [5, 10, 25, 50, 100, 200];

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 60_000,
    });
  });
}

interface SearchPanelProps {
  onSearch: (params: SearchParams) => void;
  isSearching: boolean;
}

export const SearchPanel = ({ onSearch, isSearching }: SearchPanelProps) => {
  const [mode, setMode] = useState<"natural" | "manual" | "near_me">("natural");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [leadCount, setLeadCount] = useState(10);
  const [countOpen, setCountOpen] = useState(false);

  // Near Me state
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingStatus, setLocatingStatus] = useState<"idle" | "loading" | "granted" | "error">("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(25);
  const [radiusOpen, setRadiusOpen] = useState(false);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const requestLocation = useCallback(async () => {
    setLocatingStatus("loading");
    setLocationError(null);
    try {
      const pos = await getCurrentPosition();
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setLocatingStatus("granted");
    } catch (err) {
      const geo = err as GeolocationPositionError;
      if (geo.code === 1) {
        setLocationError("Location access denied. Please allow location in your browser settings.");
      } else if (geo.code === 2) {
        setLocationError("Location unavailable. Try searching by city instead.");
      } else if (geo.code === 3) {
        setLocationError("Location request timed out. Please try again.");
      } else {
        setLocationError(err instanceof Error ? err.message : "Failed to get location");
      }
      setLocatingStatus("error");
    }
  }, []);

  const handleSearch = () => {
    if (mode === "natural") {
      if (!query.trim()) return;
      onSearch({ mode: "natural", query: query.trim(), maxLead: leadCount });
    } else if (mode === "manual") {
      if (!location.trim() || selectedCategories.length === 0) return;
      onSearch({ mode: "manual", location, categories: selectedCategories, maxLead: leadCount });
    } else if (mode === "near_me") {
      if (!coords) return;
      onSearch({ mode: "current_location", latitude: coords.lat, longitude: coords.lng, radiusKm, maxLead: leadCount });
    }
  };

  const canSearch =
    mode === "natural"
      ? query.trim().length > 0
      : mode === "manual"
        ? location.trim().length > 0 && selectedCategories.length > 0
        : coords !== null;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <SlidersHorizontal className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Search Parameters</span>
      </div>

      {/* Tabs: Prompt / Manual / Near Me */}
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
          Prompt
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
          Manual
        </button>
        <button
          onClick={() => setMode("near_me")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-medium transition-all",
            mode === "near_me"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LocateFixed className="w-3 h-3" />
          Near Me
        </button>
      </div>

      {mode === "natural" ? (
        /* Prompt: single query input */
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
      ) : mode === "manual" ? (
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
      ) : (
        /* Near Me: GPS location + radius */
        <div className="space-y-4">
          {locatingStatus === "idle" || locatingStatus === "error" ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-[200px]">
                Allow location access to find diamond &amp; jewellery stores near you.
              </p>
              {locationError && (
                <p className="text-xs text-destructive text-center max-w-[200px]">{locationError}</p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={requestLocation}
                className="gap-2"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                {locatingStatus === "error" ? "Try Again" : "Get My Location"}
              </Button>
            </div>
          ) : locatingStatus === "loading" ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground">Getting your location...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                <MapPin className="w-4 h-4 text-success flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">Location acquired</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {coords!.lat.toFixed(4)}, {coords!.lng.toFixed(4)}
                  </p>
                </div>
                <button
                  onClick={requestLocation}
                  className="ml-auto text-[10px] text-primary hover:underline flex-shrink-0"
                >
                  Refresh
                </button>
              </div>

              {/* Radius picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Search Radius
                </label>
                <div className="relative">
                  <button
                    onClick={() => setRadiusOpen(!radiusOpen)}
                    className="w-full flex items-center justify-between bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground transition-all hover:border-primary/30"
                  >
                    <span className="font-medium">{radiusKm} km</span>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", radiusOpen && "rotate-180")} />
                  </button>
                  {radiusOpen && (
                    <div className="absolute top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg z-10 overflow-hidden animate-slide-up">
                      {RADIUS_OPTIONS.map((r) => (
                        <button
                          key={r}
                          onClick={() => { setRadiusKm(r); setRadiusOpen(false); }}
                          className={cn(
                            "w-full text-left px-4 py-2.5 text-sm transition-colors",
                            r === radiusKm
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-foreground hover:bg-secondary"
                          )}
                        >
                          {r} km
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

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
