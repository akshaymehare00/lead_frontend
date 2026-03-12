import { useState, useCallback, useRef } from "react";
import { ChevronDown, Zap, SlidersHorizontal, Loader2, LocateFixed, FileSpreadsheet, X } from "lucide-react";
import { LocationAutocomplete } from "./LocationAutocomplete";
import { reverseGeocode } from "@/lib/google-maps";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SearchParams =
  | { mode: "natural"; query: string; maxLead: number }
  | { mode: "manual"; location: string; categories: string[]; maxLead: number }
  | { mode: "current_location"; latitude: number; longitude: number; radiusKm: number; maxLead: number }
  | { mode: "apify"; location: string; searchStrings?: string[]; maxLead: number }
  | { mode: "apify_url"; googleMapsUrl: string; maxLead: number }
  | { mode: "csv_import"; file: File; maxLead: number; title?: string };

const CATEGORIES = [
  "Polished Dealers",
  "Diamond Manufacturers",
  "E-Commerce",
  "Jewellery Manufacturers",
  "Retailer",
];

const LEAD_COUNTS = [10, 20, 30, 50, 100];
const LEAD_COUNTS_URL = [10, 20, 30, 50, 100, 120];
const LEAD_COUNTS_CSV = [50, 100, 150, 200, 300, 500];

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

export type SearchSource = "serpapi" | "apify" | "url" | "csv";

export const SearchPanel = ({ onSearch, isSearching, compact }: SearchPanelProps) => {
  const [searchSource, setSearchSource] = useState<SearchSource>("serpapi");
  const [location, setLocation] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvTitle, setCsvTitle] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      const hasGoogleKey = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (hasGoogleKey) {
        const name = await reverseGeocode(latitude, longitude);
        if (name) {
          setLocation(name);
          return;
        }
      }
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
    if (searchSource === "csv") {
      if (!csvFile) return;
      onSearch({ mode: "csv_import", file: csvFile, maxLead: leadCount, title: csvTitle.trim() || undefined });
      return;
    }
    if (searchSource === "url") {
      if (!googleMapsUrl.trim() || !googleMapsUrl.includes("google.com/maps/")) return;
      onSearch({ mode: "apify_url", googleMapsUrl: googleMapsUrl.trim(), maxLead: leadCount });
      return;
    }
    if (!location.trim()) return;
    if (searchSource === "serpapi") {
      if (selectedCategories.length === 0) return;
      onSearch({ mode: "manual", location, categories: selectedCategories, maxLead: leadCount });
    } else {
      onSearch({
        mode: "apify",
        location,
        searchStrings: selectedCategories.length > 0 ? selectedCategories : undefined,
        maxLead: leadCount,
      });
    }
  };

  const canSearch =
    searchSource === "csv"
      ? !!csvFile
      : searchSource === "url"
        ? googleMapsUrl.trim().length > 0 && googleMapsUrl.includes("google.com/maps/")
        : location.trim().length > 0 &&
          (searchSource === "apify" || selectedCategories.length > 0);

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith(".csv")) {
      setCsvFile(file);
    }
  };

  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.toLowerCase().endsWith(".csv")) {
      setCsvFile(file);
    }
    e.target.value = "";
  };

  return (
    <div className={compact ? "space-y-4" : "p-6 space-y-5"}>
      {!compact && (
        <div className="flex items-center gap-2 mb-1">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Search Parameters</span>
        </div>
      )}

      {/* Search Source: SerpAPI, Apify, URL Search */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Search Source
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="searchSource"
              checked={searchSource === "serpapi"}
              onChange={() => setSearchSource("serpapi")}
              className="w-4 h-4 text-primary border-border focus:ring-primary"
            />
            <span className="text-sm font-medium">SerpAPI</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="searchSource"
              checked={searchSource === "apify"}
              onChange={() => setSearchSource("apify")}
              className="w-4 h-4 text-primary border-border focus:ring-primary"
            />
            <span className="text-sm font-medium">Apify</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="searchSource"
              checked={searchSource === "url"}
              onChange={() => setSearchSource("url")}
              className="w-4 h-4 text-primary border-border focus:ring-primary"
            />
            <span className="text-sm font-medium">URL Search</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="searchSource"
              checked={searchSource === "csv"}
              onChange={() => setSearchSource("csv")}
              className="w-4 h-4 text-primary border-border focus:ring-primary"
            />
            <span className="text-sm font-medium">CSV Search</span>
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {searchSource === "serpapi"
            ? "AI-filtered results with ranking"
            : searchSource === "apify"
              ? "Raw Google Maps results (no AI filter). Leave empty for default terms."
              : searchSource === "url"
                ? "Paste a Google Maps search URL to scrape leads directly."
                : "Upload a CSV file (e.g. Google Maps export) to import leads."}
        </p>
      </div>

      {/* CSV Search — only when CSV Search selected */}
      {searchSource === "csv" && (
        <div className="space-y-3">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            CSV File
          </label>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleCsvDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-border bg-secondary/30 hover:bg-secondary/50",
              csvFile && "border-primary/40 bg-primary/5"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCsvSelect}
              className="hidden"
            />
            {csvFile ? (
              <>
                <FileSpreadsheet className="w-10 h-10 text-primary" />
                <span className="text-sm font-medium text-foreground">{csvFile.name}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setCsvFile(null); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3 h-3" /> Remove
                </button>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Drag & drop CSV or click to select</span>
                <span className="text-[11px] text-muted-foreground/80">CSV files only</span>
              </>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Session Title (optional)
            </label>
            <input
              type="text"
              value={csvTitle}
              onChange={(e) => setCsvTitle(e.target.value)}
              placeholder="e.g. Diamond Bourse Mumbai"
              disabled={isSearching}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-secondary/50 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
      )}

      {/* URL Search — only when URL Search selected */}
      {searchSource === "url" && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Google Maps URL
          </label>
          <input
            type="url"
            value={googleMapsUrl}
            onChange={(e) => setGoogleMapsUrl(e.target.value)}
            placeholder="https://www.google.com/maps/search/diamond+store+in+bangalore/..."
            disabled={isSearching}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-secondary/50 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <p className="text-[11px] text-muted-foreground">
            Must contain google.com/maps/
          </p>
        </div>
      )}

      {/* Location — hidden when URL Search or CSV Search */}
      {searchSource !== "url" && searchSource !== "csv" && (
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
      </div>
      )}

      {/* Business Category / Search Terms — hidden when URL Search or CSV Search */}
      {searchSource !== "url" && searchSource !== "csv" && (
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {searchSource === "apify" ? "Search Terms (optional)" : "Business Category"}
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
              {(searchSource === "url" ? LEAD_COUNTS_URL : searchSource === "csv" ? LEAD_COUNTS_CSV : LEAD_COUNTS).map((c) => (
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
