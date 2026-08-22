"use client";

import { useEffect, useRef, useState } from "react";

interface PlaceResult {
  placeId: string;
  label: string;
  title: string;
  placeType: string;
}

interface Props {
  value: string;
  onChange: (city: string) => void;
  onStateChange?: (state: string) => void;
  onSelect?: (label: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  className?: string;
}

export default function SuburbAutocomplete({
  value,
  onChange,
  onStateChange,
  onSelect,
  onEnter,
  placeholder = "e.g. Melbourne",
  className = "",
}: Props) {
  const [open, setOpen]       = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout>>(undefined);

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
      const filtered = (data.results ?? []).filter(
        (r: PlaceResult) => r.placeType === "Locality"
      );
      setSuggestions(filtered);
      setOpen(filtered.length > 0);
      setActiveIdx(-1);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (text: string) => {
    onChange(text);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSuggestions(text), 250);
  };

  const select = (item: PlaceResult) => {
    const label = item.label.split(",")[0].trim();
    onChange(label);
    setOpen(false);
    onSelect?.(label);
    fetch(`/api/places/geocode?q=${encodeURIComponent(item.title)}`)
      .then(r => r.json())
      .then(data => {
        if (data.result?.stateCode) onStateChange?.(data.result.stateCode);
      })
      .catch(() => {});
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "Enter") {
      if (open && activeIdx >= 0) {
        e.preventDefault();
        select(suggestions[activeIdx]);
      } else {
        onEnter?.();
      }
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={open && suggestions.length > 0 ? "suburb-suggestions" : undefined}
        aria-autocomplete="list"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {open && suggestions.length > 0 && (
        <div ref={listRef} id="suburb-suggestions"
          className="absolute top-full left-0 mt-1 z-50 w-full bg-dark border border-dark-lighter rounded-xl shadow-xl overflow-hidden modal-in">
          {suggestions.map((item, i) => (
            <button key={item.placeId} type="button"
              onClick={() => select(item)}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full px-4 py-3 text-left flex items-center gap-2.5 transition-colors
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
