import { useState, useEffect, useRef } from "react";
import { Loader2, MapPin } from "lucide-react";
import { api, type PlaceSuggestion } from "@/lib/api";
import { queryAutocomplete, type QueryPrediction } from "@/lib/google-maps";
import { cn } from "@/lib/utils";

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Unified suggestion type for both Google Places and backend fallback */
interface Suggestion {
  id: string;
  name: string;
  canonicalName: string;
}

const DEBOUNCE_MS = 300;
const SUGGESTION_LIMIT = 5;

function mapGoogleToSuggestion(p: QueryPrediction): Suggestion {
  return {
    id: p.placeId ?? p.description,
    name: p.mainText,
    canonicalName: p.description,
  };
}

function mapBackendToSuggestion(s: PlaceSuggestion): Suggestion {
  return {
    id: s.id,
    name: s.name,
    canonicalName: s.canonicalName,
  };
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = "e.g. Pune, Mumbai",
  disabled,
  className,
}: LocationAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const q = inputValue.trim();
    if (!q || q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const hasGoogleKey = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (hasGoogleKey) {
          const list = await queryAutocomplete(q);
          const mapped = list.slice(0, SUGGESTION_LIMIT).map(mapGoogleToSuggestion);
          setSuggestions(mapped);
          const isAlreadySelected = mapped.some((s) => s.canonicalName === q);
          setOpen(mapped.length > 0 && !isAlreadySelected);
        } else {
          const { suggestions: list } = await api.places.autocomplete(q, SUGGESTION_LIMIT);
          const mapped = list.map(mapBackendToSuggestion);
          setSuggestions(mapped);
          const isAlreadySelected = mapped.some((s) => s.canonicalName === q);
          setOpen(mapped.length > 0 && !isAlreadySelected);
        }
      } catch {
        try {
          const { suggestions: list } = await api.places.autocomplete(q, SUGGESTION_LIMIT);
          const mapped = list.map(mapBackendToSuggestion);
          setSuggestions(mapped);
          const isAlreadySelected = mapped.some((s) => s.canonicalName === q);
          setOpen(mapped.length > 0 && !isAlreadySelected);
        } catch {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (suggestion: Suggestion) => {
    onChange(suggestion.canonicalName);
    setInputValue(suggestion.canonicalName);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    onChange(v);
  };

  const handleBlur = () => {
    setTimeout(() => setOpen(false), 150);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
        <input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={handleBlur}
          disabled={disabled}
          autoComplete="off"
          className={cn(
            "w-full bg-secondary/50 border border-border rounded-lg pl-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all",
            loading ? "pr-10" : "pr-4"
          )}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg z-20 overflow-hidden animate-slide-up max-h-48 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelect(s)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary/80 transition-colors flex flex-col items-start gap-0.5"
            >
              <span className="font-medium text-foreground">{s.name}</span>
              <span className="text-xs text-muted-foreground">{s.canonicalName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
