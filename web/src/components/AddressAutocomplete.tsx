import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Search address...",
  className = "",
  id,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const userLocRef = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocRef.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 8000 }
    );
  }, []);

  const search = useCallback(
    debounce(async (q: string) => {
      if (q.trim().length < 3) {
        setSuggestions([]);
        setOpen(false);
        setLoading(false);
        return;
      }

      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      try {
        setLoading(true);
        const loc = userLocRef.current;
        let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=10&addressdetails=1&countrycodes=za`;
        if (loc) {
          const d = 0.9;
          const left = loc.lon - d;
          const right = loc.lon + d;
          const top = loc.lat + d;
          const bottom = loc.lat - d;
          url += `&viewbox=${left},${top},${right},${bottom}&bounded=0`;
        }
        const res = await fetch(url, {
          headers: { "Accept-Language": "en", "User-Agent": "ParcelPeer/1.0" },
          signal: abortRef.current.signal,
        });
        let data: NominatimResult[] = await res.json();
        if (loc) {
          data = [...data].sort((a, b) => {
            const da = haversineKm(loc.lat, loc.lon, parseFloat(a.lat), parseFloat(a.lon));
            const db = haversineKm(loc.lat, loc.lon, parseFloat(b.lat), parseFloat(b.lon));
            return da - db;
          });
        }
        data = data.slice(0, 6);
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        setLoading(false);
      }
    }, 350),
    []
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    if (val.trim().length >= 3) {
      setLoading(true);
    } else {
      setLoading(false);
      setSuggestions([]);
      setOpen(false);
    }
    search(val);
  };

  const handleSelect = (result: NominatimResult) => {
    const label = result.display_name;
    setQuery(label);
    onChange(label, parseFloat(result.lat), parseFloat(result.lon));
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.blur();
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin
          size={16}
          className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
            open ? "text-primary" : "text-slate-400"
          }`}
        />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={`input-field pl-10 pr-9 ${className}`}
        />
        {loading && (
          <Loader2
            size={14}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin pointer-events-none"
          />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-navy-mid rounded-xl shadow-xl border border-slate-200 dark:border-navy-light overflow-hidden">
          {suggestions.map((s, i) => {
            const parts = s.display_name.split(", ");
            const main = parts.slice(0, 2).join(", ");
            const sub = parts.slice(2).join(", ");
            return (
              <button
                key={s.place_id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(s);
                }}
                className={`flex items-start gap-3 w-full px-3.5 py-3 text-left hover:bg-primary/5 transition-colors ${
                  i !== 0 ? "border-t border-slate-100 dark:border-navy-light" : ""
                }`}
              >
                <MapPin size={14} className="text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy dark:text-white truncate">{main}</p>
                  {sub && <p className="text-xs text-slate-400 truncate">{sub}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
