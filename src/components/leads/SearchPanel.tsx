import { useState, useRef } from "react";
import { ChevronDown, Zap, SlidersHorizontal, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SearchParams =
  | { mode: "natural"; query: string; maxLead: number }
  | { mode: "manual"; location: string; categories: string[]; maxLead: number }
  | { mode: "current_location"; latitude: number; longitude: number; radiusKm: number; maxLead: number }
  | { mode: "apify"; location: string; searchStrings?: string[]; maxLead: number }
  | { mode: "apify_url"; googleMapsUrl: string; maxLead: number }
  | { mode: "csv_import"; file: File; maxLead: number; title?: string };

const LEAD_COUNTS_CSV = [10, 20, 50, 100, 200, 500];

interface SearchPanelProps {
  onSearch: (params: SearchParams) => void;
  isSearching: boolean;
  compact?: boolean;
}

export const SearchPanel = ({ onSearch, isSearching, compact }: SearchPanelProps) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [leadCount, setLeadCount] = useState(100);
  const [countOpen, setCountOpen] = useState(false);

  const handleSearch = () => {
    if (!csvFile) return;
    onSearch({ mode: "csv_import", file: csvFile, maxLead: leadCount });
  };

  const canSearch = !!csvFile;

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

      {/* Search Source: CSV only */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Search Source
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="searchSource"
              checked={true}
              readOnly
              className="w-4 h-4 text-primary border-border focus:ring-primary"
            />
            <span className="text-sm font-medium">CSV Search</span>
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Upload a CSV file (e.g. Google Maps export) to import leads.
        </p>
      </div>

      {/* CSV File */}
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
              {LEAD_COUNTS_CSV.map((c) => (
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
