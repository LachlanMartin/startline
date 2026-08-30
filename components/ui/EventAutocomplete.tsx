"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDivisionLabel, selectionLabel } from "@/lib/divisions";

interface EventResult {
  id: string;
  href: string;
  title: string;
  city: string;
  state: string;
  discipline: string;
  eventDate: string;
}

interface DivisionResult {
  name: string;
  href: string;
  eventCount: number;
}

interface CategoryResult {
  value: string;
  label: string;
  href: string;
  eventCount: number;
  divisions?: DivisionResult[];
}

/** One flattened row so arrow keys can walk categories and events as one list. */
type Row =
  | { kind: "category"; item: CategoryResult }
  | { kind: "division"; item: DivisionResult; discipline: string; disciplineLabel: string }
  | { kind: "event"; item: EventResult };

interface Props {
  value: string;
  onChange: (query: string) => void;
  /** Fired on Enter when no suggestion is highlighted. */
  onEnter?: () => void;
  /**
   * Fired when a category or division is picked. Picking one fills the field
   * with a readable label ("Running - 10km") and hands the structured choice
   * back; it deliberately does not run the search, so the user stays in control
   * of when that happens. Only picking a named event navigates immediately.
   */
  onSelectCategory?: (selection: { discipline: string; division: string | null; label: string }) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  /**
   * The where field's current text, so category and division counts reflect
   * what the listing would actually show in that location.
   */
  where?: string;
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
  onSelectCategory,
  placeholder = "Event name, type or keyword",
  className = "",
  autoFocus = false,
  where,
  children,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
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
    if (q.trim().length < 2) { setRows([]); setOpen(false); return; }
    const seq = ++requestRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: q.trim() });
      if (where?.trim()) params.set("where", where.trim());
      const res = await fetch(`/api/events/search?${params}`);
      const data = await res.json();
      if (seq !== requestRef.current) return;
      // Categories lead, individual events sit under them.
      // Each discipline is followed by its divisions, then individual events.
      const next: Row[] = [
        ...(data.categories ?? []).flatMap((c: CategoryResult) => [
          { kind: "category" as const, item: c },
          ...(c.divisions ?? []).map((d) => ({
            kind: "division" as const, item: d, discipline: c.value, disciplineLabel: c.label,
          })),
        ]),
        ...(data.results ?? []).map((e: EventResult) => ({ kind: "event" as const, item: e })),
      ];
      setRows(next);
      setOpen(next.length > 0);
      setActiveIdx(-1);
    } catch {
      if (seq === requestRef.current) setRows([]);
    } finally {
      if (seq === requestRef.current) setLoading(false);
    }
  };

  const handleInput = (text: string) => {
    onChange(text);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSuggestions(text), 250);
  };

  const select = (row: Row) => {
    setOpen(false);

    // A named event is an unambiguous destination, so it navigates. A category
    // or division only fills the field and reports the choice upward.
    if (row.kind === "event") {
      router.push(row.item.href);
      return;
    }

    const discipline = row.kind === "category" ? row.item.value : row.discipline;
    const disciplineLabel = row.kind === "category" ? row.item.label : row.disciplineLabel;
    const division = row.kind === "division" ? row.item.name : null;
    const label = selectionLabel(disciplineLabel, division);

    onChange(label);
    onSelectCategory?.({ discipline, division, label });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "Enter") {
      if (open && activeIdx >= 0) {
        e.preventDefault();
        select(rows[activeIdx]);
      } else {
        onEnter?.();
      }
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, rows.length - 1));
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
        onFocus={() => { if (rows.length > 0) setOpen(true); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={className}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={open && rows.length > 0 ? "event-suggestions" : undefined}
        aria-autocomplete="list"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {children}
      {open && rows.length > 0 && (
        <div ref={listRef} id="event-suggestions" data-testid="event-suggestions"
          className="absolute top-full left-0 mt-2 z-50 w-full min-w-[280px] bg-dark border border-dark-lighter rounded-xl shadow-xl overflow-hidden modal-in">
          {rows.map((row, i) => {
            // Headings are rendered off the first row of each kind, so the
            // flat list stays a single sequence for arrow-key navigation.
            const heading =
              i === 0 && row.kind !== "event" ? "Categories"
              : row.kind === "event" && (i === 0 || rows[i - 1].kind !== "event") ? "Events"
              : null;
            const active = i === activeIdx;
            const key =
              row.kind === "category" ? `c-${row.item.value}`
              : row.kind === "division" ? `d-${row.discipline}-${row.item.name}`
              : `e-${row.item.id}`;

            return (
              <div key={key}>
                {heading && (
                  <div className="px-4 pt-2.5 pb-1 font-headline text-[10px] font-black uppercase tracking-widest text-muted-dark border-t border-dark-lighter first:border-t-0">
                    {heading}
                  </div>
                )}
                <button type="button"
                  data-testid={`suggestion-${row.kind}`}
                  onClick={() => select(row)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`w-full text-left block transition-colors py-2.5
                    ${row.kind === "division" ? "pl-8 pr-4" : "px-4"}
                    ${active ? "bg-primary/10" : "hover:bg-white/5"}`}>
                  {row.kind === "category" ? (
                    <>
                      <span className={`block font-headline text-[14px] font-bold truncate ${active ? "text-primary" : "text-light"}`}>
                        {row.item.label}
                      </span>
                      <span className="block font-headline text-[11px] uppercase tracking-widest text-muted truncate">
                        {row.item.eventCount} {row.item.eventCount === 1 ? "event" : "events"}
                      </span>
                    </>
                  ) : row.kind === "division" ? (
                    <span className={`flex items-baseline gap-2 font-headline text-[13px] truncate ${active ? "text-primary" : "text-light/80"}`}>
                      <span className="truncate">{formatDivisionLabel(row.item.name)}</span>
                      <span className="font-headline text-[10px] uppercase tracking-widest text-muted flex-shrink-0">
                        {row.item.eventCount}
                      </span>
                    </span>
                  ) : (
                    <>
                      <span className={`block font-headline text-[14px] truncate ${active ? "text-primary" : "text-light"}`}>
                        {row.item.title}
                      </span>
                      <span className="block font-headline text-[11px] uppercase tracking-widest text-muted truncate">
                        {row.item.discipline} · {row.item.city}, {row.item.state}
                      </span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
