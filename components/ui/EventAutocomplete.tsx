"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface EventResult {
  id: string;
  href: string;
  title: string;
  city: string;
  state: string;
  discipline: string;
  eventDate: string;
}

interface Props {
  value: string;
  onChange: (query: string) => void;
  /** Fired on Enter when no suggestion is highlighted. */
  onEnter?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  /** Rendered inside the input's relative wrapper, e.g. a clear button. */
  children?: React.ReactNode;
}

/**
 * Typeahead for the event field of both search bars, mirroring
 * SuburbAutocomplete so the two halves of the bar behave the same way.
 * Picking a suggestion goes straight to that event's page.
 */
export default function EventAutocomplete({
  value,
  onChange,
  onEnter,
  placeholder = "Event name, type or keyword",
  className = "",
  autoFocus = false,
  children,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<EventResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Guards against a slow early request landing after a later, faster one and
  // repopulating the list with stale matches.
  const requestRef = useRef(0);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node) &&
          listRef.current && !listRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const fetchSuggestions = async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    const seq = ++requestRef.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      if (seq !== requestRef.current) return;
      const results: EventResult[] = data.results ?? [];
      setSuggestions(results);
      setOpen(results.length > 0);
      setActiveIdx(-1);
    } catch {
      if (seq === requestRef.current) setSuggestions([]);
    } finally {
      if (seq === requestRef.current) setLoading(false);
    }
  };

  const handleInput = (text: string) => {
    onChange(text);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSuggestions(text), 250);
  };

  const select = (item: EventResult) => {
    setOpen(false);
    router.push(item.href);
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
    <div className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={className}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={open && suggestions.length > 0 ? "event-suggestions" : undefined}
        aria-autocomplete="list"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {children}
      {open && suggestions.length > 0 && (
        <div ref={listRef} id="event-suggestions" data-testid="event-suggestions"
          className="absolute top-full left-0 mt-2 z-50 w-full min-w-[280px] bg-dark border border-dark-lighter rounded-xl shadow-xl overflow-hidden modal-in">
          {suggestions.map((item, i) => (
            <button key={item.id} type="button"
              onClick={() => select(item)}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full px-4 py-2.5 text-left block transition-colors
                ${i === activeIdx ? "bg-primary/10" : "hover:bg-white/5"}`}>
              <span className={`block font-headline text-[14px] truncate ${i === activeIdx ? "text-primary" : "text-light"}`}>
                {item.title}
              </span>
              <span className="block font-headline text-[11px] uppercase tracking-widest text-muted truncate">
                {item.discipline} · {item.city}, {item.state}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
