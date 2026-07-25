"use client";

import { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect, Suspense } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, MapPin, Clock, Users, X, LayoutGrid, ChevronDown, Check } from "lucide-react";
import type { UserEvent, FilterState, EventType, AustralianState, CompetitionFormat, ExperienceLevel, SortOption } from "@/types";
import {
  EVENT_TYPE_LABELS, STATE_LABELS, STATE_OPTIONS, EVENT_TYPE_OPTIONS,
  FORMAT_OPTIONS, DATE_RANGE_OPTIONS, LEVEL_OPTIONS, SORT_OPTIONS,
  PRICE_RANGE_MIN, PRICE_RANGE_MAX,
} from "@/types";
import { filterEvents, sortEvents, formatShortDate, formatTime, formatCompetitionFormat } from "@/lib/utils";
import { toUserEvents } from "@/lib/user-events";
import { getEventCoords } from "@/lib/australia-coords";
import { useAuthContext } from "@/context/AuthContext";
import EventMap from "@/components/EventMap";
import type { EventMapHandle } from "@/components/EventMap";
import OrganiserCardMeta from "@/components/OrganiserCardMeta";

const DISCIPLINE_OPTIONS = EVENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
const STATE_CHIP_OPTIONS  = STATE_OPTIONS.map((o) => ({ value: o.value, label: o.shortLabel }));
const FORMAT_CHIP_OPTIONS = FORMAT_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
const DATE_CHIP_OPTIONS   = DATE_RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

const RANGE_THUMB_CLASS =
  "range-thumb absolute inset-0 w-full h-4 appearance-none bg-transparent pointer-events-none " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-dark " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-dark";

function pillClass(active: boolean): string {
  return `px-3.5 py-2 rounded-full font-headline text-xs font-medium uppercase tracking-widest border transition-colors whitespace-nowrap ${active ? "border-primary bg-primary text-dark" : "border-dark-lighter text-muted hover:border-primary/50 hover:text-light"}`;
}

function toggleInArray<T>(arr: T[], value: T, setArr: (v: T[]) => void) {
  setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
}

function FilterTrigger({
  label, active, isOpen, onToggle, panelClassName, align = "left", children,
}: {
  label: string; active: boolean; isOpen: boolean; onToggle: () => void; panelClassName?: string; align?: "left" | "right"; children: React.ReactNode;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);

  // Panels render into a portal (not a sibling of this scrollable pill row)
  // since overflow-x-auto on the row would otherwise clip them — position
  // is computed from the trigger's on-screen rect each time it opens. Right-
  // aligned triggers (e.g. the rightmost pill) anchor via `right` instead of
  // `left` so the panel doesn't overhang past the viewport edge.
  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) { setPos(null); return; }
    const rect = buttonRef.current.getBoundingClientRect();
    if (align === "right") {
      setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    } else {
      setPos({ top: rect.bottom + 8, left: rect.left });
    }
  }, [isOpen, align]);

  return (
    <div className="flex-shrink-0">
      <button ref={buttonRef} onClick={onToggle}
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full font-headline text-xs font-bold uppercase tracking-widest border transition-colors whitespace-nowrap ${active || isOpen ? "border-primary/35 bg-primary/[0.08] text-primary" : "border-transparent text-muted hover:text-light"}`}
      >
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && pos && createPortal(
        <div data-filter-panel style={{ position: "fixed", top: pos.top, left: pos.left, right: pos.right }}
          className={`z-30 bg-dark border border-dark-lighter rounded-2xl shadow-2xl shadow-black/50 p-4 ${panelClassName ?? "w-56"}`}
        >
          {children}
        </div>,
        document.body
      )}
    </div>
  );
}

function EventCard({ event, selected, onSelect }: { event: UserEvent; selected: boolean; onSelect: () => void }) {
  const [day, month] = formatShortDate(event.date).split(" ");
  const img = event.image;
  const typeLabel = EVENT_TYPE_LABELS[event.type];
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer h-full bg-dark border rounded-2xl transition-all duration-300 transform-gpu ${selected ? "border-primary ring-2 ring-primary bg-primary/5" : "border-dark-lighter hover:border-primary/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50"}`}
    >
      <div className="relative w-full aspect-video overflow-hidden rounded-t-2xl">
        <Image
          src={img}
          alt={event.title}
          fill
          className="pointer-events-none object-cover brightness-[0.55] transition-all duration-700"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark/60 via-transparent to-transparent" />
        <div className="absolute top-3 right-3 bg-dark-light/90 backdrop-blur-sm rounded-lg px-3 py-2 text-center leading-tight">
          <span className="block font-headline text-[9px] font-bold uppercase tracking-widest text-muted">{month}</span>
          <span className="block font-headline text-xl font-black text-light leading-none mt-0.5">{day}</span>
        </div>
      </div>

      <div className="p-4">
        <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
          {typeLabel}
        </span>
        <h3 className="font-headline text-lg sm:text-xl font-black italic tracking-tighter text-light leading-tight mb-3 line-clamp-2">
          {event.title}
        </h3>

        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2 font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
            <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
            <span className="truncate">{event.city}, {STATE_LABELS[event.state]}</span>
          </div>
          <div className="flex items-center gap-2 font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
            <Clock className="w-3 h-3 text-primary flex-shrink-0" />
            <span>{formatTime(event.time)}</span>
          </div>
          <div className="flex items-center gap-2 font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
            <Users className="w-3 h-3 text-primary flex-shrink-0" />
            <span>{formatCompetitionFormat(event.format)}</span>
          </div>
        </div>

        {event.description && (
          <p className="font-headline text-xs text-muted leading-relaxed line-clamp-2 mb-3">
            {event.description}
          </p>
        )}

        <div className="space-y-2">
          {(event.organizer || event.organiser?.orgName) && (
            <OrganiserCardMeta
              organiserId={event.organiserId}
              name={event.organizer ?? event.organiser!.orgName!}
              rating={event.organiser?.rating}
              stopPropagation
            />
          )}
          <div className="flex items-center justify-between gap-2">
            {event.fromPrice !== null && (
              <span className="font-headline text-sm font-bold text-primary">From ${event.fromPrice}</span>
            )}
            <Link
              href={`/events/${event.id}`}
              onClick={(e) => e.stopPropagation()}
              className="ml-auto inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
            >
              View Details →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventsListingInner() {
  const { status } = useAuthContext();
  const [allEvents, setAllEvents] = useState<UserEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialCenter, setInitialCenter] = useState<{ lng: number; lat: number; zoom: number } | undefined>(undefined);
  const mapRef = useRef<EventMapHandle>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const subNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAllEvents(toUserEvents(data)); })
      .catch(() => {});
  }, []);

  // Fetch user location for map centering
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data?.city && data?.state) {
          const [lat, lng] = getEventCoords(data.city, data.state);
          setInitialCenter({ lng, lat, zoom: 5 });
        }
      })
      .catch(() => {});
  }, [status]);

  const searchParams = useSearchParams();
  const [whatQuery,     setWhatQuery]     = useState(searchParams.get("what")  ?? "");
  const [whereQuery,    setWhereQuery]    = useState(searchParams.get("where") ?? "");
  const [typeFilters,   setTypeFilters]   = useState<EventType[]>(searchParams.get("type") ? [searchParams.get("type") as EventType] : []);
  const [stateFilters,  setStateFilters]  = useState<AustralianState[]>([]);
  const [formatFilters, setFormatFilters] = useState<CompetitionFormat[]>([]);
  const [levelFilters,  setLevelFilters]  = useState<ExperienceLevel[]>([]);
  const [priceRange,    setPriceRange]    = useState<[number, number] | null>(null);
  const [dateFilter,    setDateFilter]    = useState<FilterState["dateRange"]>("all");
  const [sortBy,        setSortBy]        = useState<SortOption>("date");
  const [openDropdown,  setOpenDropdown]  = useState<string | null>(null);
  const [mobileSearch,  setMobileSearch]  = useState(false);
  const [view, setView] = useState<"list" | "map">(searchParams.get("view") === "map" ? "map" : "list");
  // Latches true the first time the Map tab is viewed, so EventMap mounts
  // once and then just toggles visibility (avoids re-init/re-fetch on every tab switch).
  const [mapEverViewed, setMapEverViewed] = useState(view === "map");

  // Close an open filter dropdown on outside click / Escape.
  useEffect(() => {
    if (!openDropdown) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (subNavRef.current?.contains(target)) return;
      if (target.closest("[data-filter-panel]")) return;
      setOpenDropdown(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenDropdown(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openDropdown]);

  const filterState: FilterState = useMemo(() => ({
    types:       typeFilters,
    states:      stateFilters,
    formats:     formatFilters,
    levels:      levelFilters,
    priceRange,
    dateRange:   dateFilter,
    searchQuery: whatQuery,
  }), [typeFilters, stateFilters, formatFilters, levelFilters, priceRange, dateFilter, whatQuery]);

  const displayEvents = useMemo(() => {
    let results = filterEvents(allEvents, filterState);
    results = sortEvents(results, sortBy);
    if (whereQuery.trim()) {
      const q = whereQuery.toLowerCase();
      results = results.filter((e) => e.city.toLowerCase().includes(q) || e.state.toLowerCase().includes(q) || e.location.toLowerCase().includes(q));
    }
    return results;
  }, [allEvents, filterState, whereQuery, sortBy]);

  function clearFilters() {
    setWhatQuery(""); setWhereQuery("");
    setTypeFilters([]); setStateFilters([]); setFormatFilters([]); setLevelFilters([]);
    setPriceRange(null); setDateFilter("all");
  }

  const hasActiveFilters = typeFilters.length > 0 || stateFilters.length > 0 || formatFilters.length > 0
    || levelFilters.length > 0 || !!priceRange || dateFilter !== "all" || !!whatQuery || !!whereQuery;

  interface ActiveChip { key: string; label: string; onRemove: () => void }
  const activeChips: ActiveChip[] = useMemo(() => {
    const chips: ActiveChip[] = [];
    typeFilters.forEach((t) => chips.push({ key: `type-${t}`, label: EVENT_TYPE_LABELS[t], onRemove: () => setTypeFilters(typeFilters.filter((v) => v !== t)) }));
    stateFilters.forEach((s) => chips.push({ key: `state-${s}`, label: STATE_LABELS[s], onRemove: () => setStateFilters(stateFilters.filter((v) => v !== s)) }));
    formatFilters.forEach((f) => {
      const opt = FORMAT_CHIP_OPTIONS.find((o) => o.value === f);
      chips.push({ key: `format-${f}`, label: opt?.label ?? f, onRemove: () => setFormatFilters(formatFilters.filter((v) => v !== f)) });
    });
    levelFilters.forEach((l) => {
      const opt = LEVEL_OPTIONS.find((o) => o.value === l);
      chips.push({ key: `level-${l}`, label: opt?.label ?? l, onRemove: () => setLevelFilters(levelFilters.filter((v) => v !== l)) });
    });
    if (dateFilter !== "all") {
      const opt = DATE_CHIP_OPTIONS.find((o) => o.value === dateFilter);
      chips.push({ key: "date", label: opt?.label ?? dateFilter, onRemove: () => setDateFilter("all") });
    }
    if (priceRange) {
      chips.push({
        key: "price",
        label: `$${priceRange[0]} – $${priceRange[1]}${priceRange[1] === PRICE_RANGE_MAX ? "+" : ""}`,
        onRemove: () => setPriceRange(null),
      });
    }
    return chips;
  }, [typeFilters, stateFilters, formatFilters, levelFilters, dateFilter, priceRange]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => {
      const next = prev === id ? null : id;
      if (next) {
        mapRef.current?.flyTo(next);
        mapRef.current?.stopSpin();
      }
      return next;
    });
  }, []);

  const viewToggle = (
    <div className="flex items-center gap-0.5 bg-dark rounded-xl border border-dark-lighter p-0.5 flex-shrink-0">
      <button onClick={() => setView("list")}
        className={`flex items-center gap-1.5 px-3 h-8 lg:h-9 rounded-lg font-headline text-xs font-bold uppercase tracking-widest transition-colors duration-150 ${view === "list" ? "bg-white/10 text-light" : "text-muted hover:text-light"}`}
      >
        <LayoutGrid className="w-3.5 h-3.5" /> List
      </button>
      <button onClick={() => { setView("map"); setMapEverViewed(true); }}
        className={`flex items-center gap-1.5 px-3 h-8 lg:h-9 rounded-lg font-headline text-xs font-bold uppercase tracking-widest transition-colors duration-150 ${view === "map" ? "bg-white/10 text-light" : "text-muted hover:text-light"}`}
      >
        <MapPin className="w-3.5 h-3.5" /> Map
      </button>
    </div>
  );

  const desktopHeader = (
    <div className="hidden lg:block px-4 pt-4 pb-2 border-b border-dark-lighter bg-dark-darker flex-shrink-0">
      <div className="flex items-stretch gap-2">
        <div className="flex flex-1 items-stretch bg-dark rounded-xl overflow-hidden border border-dark-lighter">
          <div className="flex-1 px-3.5 py-2.5 border-r border-dark-lighter min-w-0">
            <label className="font-headline text-[10px] font-black uppercase tracking-widest text-primary block mb-0.5">Event</label>
            <div className="flex items-center gap-1.5">
              <input type="text" placeholder="Event name, type or keyword" value={whatQuery}
                onChange={(e) => setWhatQuery(e.target.value)}
                className="w-full bg-transparent text-light font-headline text-sm placeholder:text-muted/40 border-0 focus:ring-0 focus:outline-none" />
              {whatQuery && <button onClick={() => setWhatQuery("")} className="text-muted hover:text-light flex-shrink-0"><X className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
          <div className="flex-1 px-3.5 py-2.5 min-w-0">
            <label className="font-headline text-[10px] font-black uppercase tracking-widest text-primary block mb-0.5">Where</label>
            <div className="flex items-center gap-1.5">
              <input type="text" placeholder="State, city, or suburb" value={whereQuery}
                onChange={(e) => setWhereQuery(e.target.value)}
                className="w-full bg-transparent text-light font-headline text-sm placeholder:text-muted/40 border-0 focus:ring-0 focus:outline-none" />
              {whereQuery && <button onClick={() => setWhereQuery("")} className="text-muted hover:text-light flex-shrink-0"><X className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        </div>
        {viewToggle}
      </div>
    </div>
  );

  const mobileHeader = (
    <div className="lg:hidden px-4 pt-3 pb-2 border-b border-dark-lighter flex-shrink-0">
      {mobileSearch ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-dark rounded-xl px-4 py-2.5">
            <Search className="w-4 h-4 text-muted flex-shrink-0" />
            <input autoFocus type="text" placeholder="Event name, type or keyword" value={whatQuery}
              onChange={(e) => setWhatQuery(e.target.value)}
              className="flex-1 bg-transparent text-light font-headline text-sm placeholder:text-muted/40 border-0 focus:outline-none" />
            {whatQuery && <button onClick={() => setWhatQuery("")} className="text-muted"><X className="w-4 h-4" /></button>}
          </div>
          <div className="flex items-center gap-2 bg-dark rounded-xl px-4 py-2.5">
            <MapPin className="w-4 h-4 text-muted flex-shrink-0" />
            <input type="text" placeholder="City or state" value={whereQuery}
              onChange={(e) => setWhereQuery(e.target.value)}
              className="flex-1 bg-transparent text-light font-headline text-sm placeholder:text-muted/40 border-0 focus:outline-none" />
            {whereQuery && <button onClick={() => setWhereQuery("")} className="text-muted"><X className="w-4 h-4" /></button>}
          </div>
          <button onClick={() => setMobileSearch(false)} className="text-center font-headline text-xs uppercase tracking-widest text-muted py-1">Done</button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileSearch(true)} className="flex-1 flex items-center gap-3 bg-dark rounded-xl px-4 h-11 text-left min-w-0">
            <Search className="w-4 h-4 text-muted flex-shrink-0" />
            <span className="flex-1 font-headline text-sm text-muted/60 truncate">
              {whatQuery || whereQuery ? [whatQuery, whereQuery].filter(Boolean).join(" · ") : "Search events…"}
            </span>
          </button>
          {viewToggle}
        </div>
      )}
    </div>
  );

  const disciplineDropdown = (
    <div className="space-y-1">
      {DISCIPLINE_OPTIONS.map((opt) => {
        const checked = typeFilters.includes(opt.value as EventType);
        return (
          <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group py-1">
            <span className={`w-[17px] h-[17px] rounded-[5px] border flex items-center justify-center flex-shrink-0 transition-colors ${checked ? "bg-primary border-primary" : "border-dark-lighter group-hover:border-primary/50"}`}>
              {checked && <Check className="w-3 h-3 text-dark" strokeWidth={3} />}
            </span>
            <input type="checkbox" className="sr-only" checked={checked}
              onChange={() => toggleInArray(typeFilters, opt.value as EventType, setTypeFilters)} />
            <span className="font-headline text-xs font-medium uppercase tracking-widest text-light">{opt.label}</span>
          </label>
        );
      })}
    </div>
  );

  const locationDropdown = (
    <div className="flex flex-wrap gap-2">
      {STATE_CHIP_OPTIONS.map((opt) => (
        <button key={opt.value} onClick={() => toggleInArray(stateFilters, opt.value as AustralianState, setStateFilters)}
          className={pillClass(stateFilters.includes(opt.value as AustralianState))}
        >{opt.label}</button>
      ))}
    </div>
  );

  const dateDropdown = (
    <div className="flex flex-col gap-2">
      {DATE_CHIP_OPTIONS.map((opt) => (
        <button key={opt.value} onClick={() => setDateFilter(opt.value as FilterState["dateRange"])}
          className={`${pillClass(dateFilter === opt.value)} text-left`}
        >{opt.label}</button>
      ))}
    </div>
  );

  const [priceMin, priceMax] = priceRange ?? [PRICE_RANGE_MIN, PRICE_RANGE_MAX];
  const priceDropdown = (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="font-headline text-sm font-bold text-light">
          ${priceMin} – ${priceMax}{priceMax === PRICE_RANGE_MAX ? "+" : ""}
        </span>
        {priceRange && (
          <button onClick={() => setPriceRange(null)} className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/70">Reset</button>
        )}
      </div>
      <div className="relative h-4 mt-2 mb-1">
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 rounded-full bg-dark-lighter" />
        <div className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-primary"
          style={{ left: `${(priceMin / PRICE_RANGE_MAX) * 100}%`, right: `${100 - (priceMax / PRICE_RANGE_MAX) * 100}%` }}
        />
        <input type="range" min={PRICE_RANGE_MIN} max={PRICE_RANGE_MAX} value={priceMin}
          onChange={(e) => setPriceRange([Math.min(Number(e.target.value), priceMax - 5), priceMax])}
          className={RANGE_THUMB_CLASS} />
        <input type="range" min={PRICE_RANGE_MIN} max={PRICE_RANGE_MAX} value={priceMax}
          onChange={(e) => setPriceRange([priceMin, Math.max(Number(e.target.value), priceMin + 5)])}
          className={RANGE_THUMB_CLASS} />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="font-headline text-[10px] text-muted">${PRICE_RANGE_MIN}</span>
        <span className="font-headline text-[10px] text-muted">${PRICE_RANGE_MAX}+</span>
      </div>
    </div>
  );

  const formatLevelDropdown = (
    <div className="space-y-4">
      <div>
        <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Format</p>
        <div className="flex flex-wrap gap-2">
          {FORMAT_CHIP_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => toggleInArray(formatFilters, opt.value as CompetitionFormat, setFormatFilters)}
              className={pillClass(formatFilters.includes(opt.value as CompetitionFormat))}
            >{opt.label}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Level</p>
        <div className="flex flex-wrap gap-2">
          {LEVEL_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => toggleInArray(levelFilters, opt.value, setLevelFilters)}
              className={pillClass(levelFilters.includes(opt.value))}
            >{opt.label}</button>
          ))}
        </div>
      </div>
    </div>
  );

  const filterSubNav = (
    <div ref={subNavRef} className="border-b border-dark-lighter bg-dark-darker px-3 lg:px-6 py-2 flex items-center gap-1 overflow-x-auto flex-shrink-0">
      <FilterTrigger label="Discipline" active={typeFilters.length > 0} isOpen={openDropdown === "discipline"}
        onToggle={() => setOpenDropdown(openDropdown === "discipline" ? null : "discipline")}>
        {disciplineDropdown}
      </FilterTrigger>
      <FilterTrigger label="Location" active={stateFilters.length > 0} isOpen={openDropdown === "location"}
        onToggle={() => setOpenDropdown(openDropdown === "location" ? null : "location")} panelClassName="w-56">
        {locationDropdown}
      </FilterTrigger>
      <FilterTrigger label="Date" active={dateFilter !== "all"} isOpen={openDropdown === "date"}
        onToggle={() => setOpenDropdown(openDropdown === "date" ? null : "date")} panelClassName="w-48">
        {dateDropdown}
      </FilterTrigger>
      <FilterTrigger label="Price" active={!!priceRange} isOpen={openDropdown === "price"}
        onToggle={() => setOpenDropdown(openDropdown === "price" ? null : "price")} panelClassName="w-64">
        {priceDropdown}
      </FilterTrigger>
      <FilterTrigger label="Format & Level" active={formatFilters.length > 0 || levelFilters.length > 0} isOpen={openDropdown === "format-level"}
        onToggle={() => setOpenDropdown(openDropdown === "format-level" ? null : "format-level")} panelClassName="w-60">
        {formatLevelDropdown}
      </FilterTrigger>
      {hasActiveFilters && (
        <button onClick={clearFilters} className="ml-1 flex-shrink-0 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-light transition-colors">Clear All</button>
      )}
    </div>
  );

  const sortDropdown = (
    <div className="flex flex-col gap-2">
      {SORT_OPTIONS.map((opt) => (
        <button key={opt.value} onClick={() => { setSortBy(opt.value); setOpenDropdown(null); }}
          className={`${pillClass(sortBy === opt.value)} text-left`}
        >{opt.label}</button>
      ))}
    </div>
  );

  const resultsHeader = (
    <div className="px-3 lg:px-6 pt-4 pb-1 flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
      <h2 className="font-headline text-base lg:text-xl font-black italic tracking-tighter text-light">
        <span className="text-primary">{displayEvents.length}</span> event{displayEvents.length !== 1 ? "s" : ""} found
      </h2>
      <FilterTrigger label={SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Sort"} active={sortBy !== "date"}
        isOpen={openDropdown === "sort"} onToggle={() => setOpenDropdown(openDropdown === "sort" ? null : "sort")}
        panelClassName="w-48" align="right"
      >
        {sortDropdown}
      </FilterTrigger>
    </div>
  );

  const activeChipsRow = activeChips.length > 0 ? (
    <div className="px-3 lg:px-6 pb-3 pt-2 flex flex-wrap gap-2 flex-shrink-0">
      {activeChips.map((chip) => (
        <button key={chip.key} onClick={chip.onRemove}
          className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-headline text-[11px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-colors"
        >
          {chip.label} <X className="w-3 h-3" />
        </button>
      ))}
    </div>
  ) : null;

  const emptyState = (
    <div className="p-10 text-center">
      <p className="font-headline text-2xl font-black italic tracking-tighter text-light mb-4">No events found.</p>
      <button onClick={clearFilters}
        className="font-headline text-sm font-medium uppercase tracking-widest border border-primary text-primary px-5 py-2.5 hover:bg-primary hover:text-dark transition-colors rounded-full"
      >Clear Filters</button>
    </div>
  );

  // Full-width results grid — shown for the "List" tab, all breakpoints
  const gridContent = (
    <div className={view === "list" ? "flex-1 overflow-y-auto px-3 lg:px-6 py-4 lg:py-5" : "hidden"}>
      {displayEvents.length === 0 ? emptyState : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
          {displayEvents.map((event) => (
            <EventCard key={event.id} event={event} selected={false} onSelect={() => {}} />
          ))}
        </div>
      )}
    </div>
  );

  // List + map split — shown for the "Map" tab. Map mounts lazily on first
  // visit to this tab, then stays mounted (hidden via CSS) to avoid
  // re-initialising MapLibre / re-fetching tiles on every toggle.
  const mapContent = (
    <div className={view === "map" ? "flex flex-col lg:flex-row flex-1 min-h-0" : "hidden"}>
      <div ref={listRef} className="flex flex-col w-full lg:w-[480px] xl:w-[564px] lg:flex-shrink-0 border-b lg:border-b-0 lg:border-r border-dark-lighter bg-dark-darker overflow-y-auto max-h-[38vh] lg:max-h-none px-4 py-3 lg:py-4">
        {displayEvents.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-headline text-lg font-black italic tracking-tighter text-light mb-3">No events found.</p>
            <button onClick={clearFilters}
              className="font-headline text-xs font-medium uppercase tracking-widest border border-primary text-primary px-4 py-2 hover:bg-primary hover:text-dark transition-colors rounded-full"
            >Clear Filters</button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {displayEvents.map((event) => (
              <EventCard key={event.id} event={event} selected={selectedId === event.id} onSelect={() => handleSelect(event.id)} />
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 relative min-h-[320px]">
        {mapEverViewed && (
          <EventMap
            events={displayEvents}
            selectedId={selectedId}
            onMarkerClick={handleSelect}
            initialCenter={initialCenter}
            ref={mapRef}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 56px)" }}>
      {desktopHeader}
      {mobileHeader}
      {filterSubNav}
      {resultsHeader}
      {activeChipsRow}

      <div className="flex-1 min-h-0 flex flex-col">
        {gridContent}
        {mapContent}
      </div>
    </div>
  );
}

export default function EventsListing() {
  return <Suspense><EventsListingInner /></Suspense>;
}
