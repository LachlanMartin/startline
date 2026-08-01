"use client";

import { useEffect, useRef, useState } from "react";

export type AddressResult = {
  address: string;
  city:    string;
  state:   string;
  venue:   string;
  latitude?:  number;
  longitude?: number;
};

interface PlaceResult {
  placeId: string;
  label: string;
  title: string;
  placeType: string;
}

interface Props {
  value:        string;
  onChange:     (raw: string) => void;
  onSelect:     (result: AddressResult) => void;
  placeholder?: string;
  className?:   string;
  disabled?:    boolean;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing an address…",
  className = "",
  disabled = false,
}: Props) {
  const [open, setOpen]        = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [loading, setLoading]  = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node) &&
          listRef.current && !listRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const fetchSuggestions = async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data.results ?? []);
      setOpen((data.results ?? []).length > 0);
      setActiveIdx(-1);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const select = async (item: PlaceResult) => {
    const label = item.label;
    onChange(label);

    try {
      const res = await fetch(`/api/places/geocode?q=${encodeURIComponent(item.title || label)}`);
      const data = await res.json();
      const g = data.result;
      if (g) {
        onSelect({
          address: g.label,
          city: g.city,
          state: g.stateCode,
          venue: "",
          ...(g.latitude != null && g.longitude != null
            ? { latitude: g.latitude, longitude: g.longitude }
            : {}),
        });
      }
    } catch {
      // fallback: use raw selection
      const parts = label.split(",").map(s => s.trim());
      onSelect({ address: parts[0] ?? label, city: "", state: "", venue: "" });
    }
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      select(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={e => { onChange(e.target.value); clearTimeout(timerRef.current); timerRef.current = setTimeout(() => fetchSuggestions(e.target.value), 250); }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={open && suggestions.length > 0 ? "address-suggestions" : undefined}
        aria-autocomplete="list"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {open && suggestions.length > 0 && (
        <div ref={listRef} id="address-suggestions"
          className="absolute top-full left-0 mt-1 z-50 w-full bg-dark border border-dark-lighter rounded-xl shadow-xl overflow-y-auto max-h-64 modal-in">
          {suggestions.map((item, i) => (
            <button key={item.placeId} type="button"
              onClick={() => select(item)}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full px-4 py-3 text-left transition-colors
                ${i === activeIdx ? "bg-primary/10" : "hover:bg-white/5"}`}>
              <span className={`font-headline text-[14px] ${i === activeIdx ? "text-primary" : "text-light"}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
