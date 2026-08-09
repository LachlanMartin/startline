"use client";

import { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect, Suspense } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, MapPin, X, LayoutGrid, ChevronDown, Check, ArrowUpDown, Locate, Loader2, SlidersHorizontal } from "lucide-react";
import type { UserEvent, FilterState, EventType, AustralianState, CompetitionFormat, ExperienceLevel, SortOption } from "@/types";
import {
  EVENT_TYPE_LABELS, STATE_LABELS, STATE_OPTIONS, EVENT_TYPE_OPTIONS,
  FORMAT_OPTIONS, DATE_RANGE_OPTIONS, LEVEL_OPTIONS, SORT_OPTIONS,
  PRICE_RANGE_MIN, PRICE_RANGE_MAX,
} from "@/types";
import { filterEvents, sortEvents } from "@/lib/utils";
import { toUserEvents } from "@/lib/user-events";
import { eventDistance, formatDistance, DEFAULT_RADIUS_KM } from "@/lib/distance";
import { getEventCoords } from "@/lib/australia-coords";
import { useAuthContext } from "@/context/AuthContext";
import EventMap from "@/components/EventMap";
import type { EventMapHandle } from "@/components/EventMap";
import EventCard from "@/components/EventCard";

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

/** One labelled group inside the mobile filter sheet. */
function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-muted mb-3">{title}</h3>
      {children}
    </section>
  );
}

function FilterTrigger({
  label, active, isOpen, onToggle, panelClassName, align = "left", children, icon,
}: {
  label: string; active: boolean; isOpen: boolean; onToggle: () => void; panelClassName?: string; align?: "left" | "right"; children: React.ReactNode; icon?: React.ReactNode;
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
        {icon}
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

  // Default map to the user's area: device GPS first, then profile city/state,
  // then fall back to the Australia-wide view. Runs once on mount.
  useEffect(() => {
    let cancelled = false;

    function tryProfileFallback() {
      if (status !== "authenticated") return;
      fetch("/api/user/profile")
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data?.city && data?.state) {
            const [lat, lng] = getEventCoords(data.city, data.state);
            setInitialCenter({ lng, lat, zoom: 8 });
          }
        })
        .catch(() => {});
    }

    if (!navigator.geolocation) {
      tryProfileFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!cancelled) setInitialCenter({ lng: pos.coords.longitude, lat: pos.coords.latitude, zoom: 10 });
      },
      () => tryProfileFallback(),
      { timeout: 5000, maximumAge: 300_000 },
    );

    return () => { cancelled = true; };
  }, [status]);

  const searchParams = useSearchParams();
  const [whatQuery,     setWhatQuery]     = useState(searchParams.get("what")  ?? "");
  const [whereQuery,    setWhereQuery]    = useState(searchParams.get("where") ?? "");
  const [searchOrigin,  setSearchOrigin]  = useState<{ lat: number; lng: number } | null>(null);
  const [isGeocoding,   setIsGeocoding]   = useState(false);
  const [typeFilters,   setTypeFilters]   = useState<EventType[]>(searchParams.get("type") ? [searchParams.get("type") as EventType] : []);
  const [stateFilters,  setStateFilters]  = useState<AustralianState[]>([]);
  const [formatFilters, setFormatFilters] = useState<CompetitionFormat[]>([]);
  const [levelFilters,  setLevelFilters]  = useState<ExperienceLevel[]>([]);
  const [priceRange,    setPriceRange]    = useState<[number, number] | null>(null);
  const [dateFilter,    setDateFilter]    = useState<FilterState["dateRange"]>("all");
  const [sortBy,        setSortBy]        = useState<SortOption>("date");
  const [openDropdown,  setOpenDropdown]  = useState<string | null>(null);
  const [mobileSearch,  setMobileSearch]  = useState(false);
  const [filterSheet,   setFilterSheet]   = useState(false);
  const [view, setView] = useState<"list" | "map">(searchParams.get("view") === "list" ? "list" : "map");
  // Latches true the first time the Map tab is viewed, so EventMap mounts
  // once and then just toggles visibility (avoids re-init/re-fetch on every tab switch).
  const [mapEverViewed, setMapEverViewed] = useState(view === "map");

  const locateMe = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    setIsGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSearchOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setWhereQuery("Current location");
        setIsGeocoding(false);
      },
      () => {
        setSearchOrigin(null);
        setWhereQuery("");
        setIsGeocoding(false);
      },
      { timeout: 10000 }
    );
  }, []);

  const handleWhereSearch = useCallback(async (raw?: string) => {
    const q = (raw ?? whereQuery).trim();
    if (!q) { setSearchOrigin(null); return; }
    if (q.toLowerCase() === "current location") { locateMe(); return; }
    setIsGeocoding(true);
    try {
      const res = await fetch(`/api/places/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const result = data?.result;
      if (result && typeof result.latitude === "number" && typeof result.longitude === "number") {
        setSearchOrigin({ lat: result.latitude, lng: result.longitude });
      } else {
        // Geocode failed — fall back to substring matching.
        setSearchOrigin(null);
      }
    } catch {
      setSearchOrigin(null);
    } finally {
      setIsGeocoding(false);
    }
  }, [whereQuery, locateMe]);

  const clearWhere = useCallback(() => {
    setWhereQuery("");
    setSearchOrigin(null);
  }, []);

  // Auto-search an initial ?where= param (e.g. from HeroSearch) once.
  const didInitialWhere = useRef(false);
  useEffect(() => {
    if (didInitialWhere.current) return;
    didInitialWhere.current = true;
    const initial = searchParams.get("where");
    if (!initial) return;
    // Defer so the geocode fetch (and its setState) runs after this effect settles.
    const t = setTimeout(() => handleWhereSearch(initial), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    originLat:   searchOrigin?.lat,
    originLng:   searchOrigin?.lng,
    maxDistance: searchOrigin ? DEFAULT_RADIUS_KM : undefined,
  }), [typeFilters, stateFilters, formatFilters, levelFilters, priceRange, dateFilter, whatQuery, searchOrigin]);

  const displayEvents = useMemo(() => {
    let results = filterEvents(allEvents, filterState);
    if (searchOrigin) {
      // Geocoded search — sort closest-first and stamp distance onto each event.
      results = results
        .map((e) => {
          const dist = eventDistance(searchOrigin, e);
          return { ...e, distance: dist === null ? undefined : formatDistance(dist) };
        })
        .sort((a, b) => {
          const da = eventDistance(searchOrigin, a) ?? Infinity;
          const db = eventDistance(searchOrigin, b) ?? Infinity;
          return da - db;
        });
    } else {
      results = sortEvents(results, sortBy);
      if (whereQuery.trim()) {
        const q = whereQuery.toLowerCase();
        results = results.filter((e) => e.city.toLowerCase().includes(q) || e.state.toLowerCase().includes(q) || e.location.toLowerCase().includes(q));
      }
    }
    return results;
  }, [allEvents, filterState, whereQuery, sortBy, searchOrigin]);

  function clearFilters() {
    setWhatQuery(""); clearWhere();
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

  // The sheet covers the viewport, so freeze the page behind it and let
  // Escape close it like any other overlay.
  useEffect(() => {
    if (!filterSheet) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFilterSheet(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [filterSheet]);

  const handleSelect = useCallback((id: string) => {
    if (!id) {
      setSelectedId(null);
      return;
    }
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
      <button onClick={() => { setView("map"); setMapEverViewed(true); }} data-testid="view-mode-map"
        className={`flex items-center gap-1.5 px-3 h-11 lg:h-9 rounded-lg font-headline text-xs font-bold uppercase tracking-widest transition-colors duration-150 ${view === "map" ? "bg-white/10 text-light" : "text-muted hover:text-light"}`}
      >
        <MapPin className="w-3.5 h-3.5" /> Map
      </button>
      <button onClick={() => setView("list")} data-testid="view-mode-list"
        className={`flex items-center gap-1.5 px-3 h-11 lg:h-9 rounded-lg font-headline text-xs font-bold uppercase tracking-widest transition-colors duration-150 ${view === "list" ? "bg-white/10 text-light" : "text-muted hover:text-light"}`}
      >
        <LayoutGrid className="w-3.5 h-3.5" /> List
      </button>
    </div>
  );

  const desktopHeader = (
    <div className="hidden lg:block px-4 pt-4 pb-2 border-b border-dark-lighter bg-dark-darker flex-shrink-0">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-stretch bg-dark rounded-xl overflow-hidden border border-dark-lighter">
          {/* Icons are siblings of the label+input stack, not children of the
              input row, so they centre against the full height of the field
              instead of sitting on the input's baseline. Labels wrap the text
              stack so the field label is part of the clickable area. */}
          <div className="flex-1 px-3.5 py-2.5 border-r border-dark-lighter min-w-0 flex items-center gap-1.5">
            <label className="flex-1 min-w-0 cursor-text">
              <span className="font-headline text-[10px] font-black uppercase tracking-widest text-primary block mb-0.5">Event</span>
              <input type="text" placeholder="Event name, type or keyword" value={whatQuery}
                onChange={(e) => setWhatQuery(e.target.value)}
                className="w-full bg-transparent text-light font-headline text-sm placeholder:text-muted/40 border-0 focus:ring-0 focus:outline-none" />
            </label>
            {whatQuery && <button type="button" onClick={() => setWhatQuery("")} aria-label="Clear event search" className="text-muted hover:text-light flex-shrink-0"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="flex-1 px-3.5 py-2.5 min-w-0 flex items-center gap-1.5">
            <label className="flex-1 min-w-0 cursor-text">
              <span className="font-headline text-[10px] font-black uppercase tracking-widest text-primary block mb-0.5">Where</span>
              <input type="text" placeholder="State, city, or suburb" value={whereQuery}
                onChange={(e) => setWhereQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleWhereSearch()}
                className="w-full bg-transparent text-light font-headline text-sm placeholder:text-muted/40 border-0 focus:ring-0 focus:outline-none" />
            </label>
            {isGeocoding
              ? <Loader2 data-testid="geocoding-spinner" className="w-3.5 h-3.5 text-muted animate-spin flex-shrink-0" />
              : <button type="button" onClick={locateMe} aria-label="Use my location" title="Use my location" className="text-muted hover:text-primary flex-shrink-0"><Locate className="w-3.5 h-3.5" /></button>}
            {whereQuery && <button type="button" onClick={clearWhere} aria-label="Clear where" className="text-muted hover:text-light flex-shrink-0"><X className="w-3.5 h-3.5" /></button>}
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
              onKeyDown={(e) => e.key === "Enter" && handleWhereSearch()}
              className="flex-1 bg-transparent text-light font-headline text-sm placeholder:text-muted/40 border-0 focus:outline-none" />
            {isGeocoding
              ? <Loader2 data-testid="geocoding-spinner" className="w-4 h-4 text-muted animate-spin flex-shrink-0" />
              : <button onClick={locateMe} aria-label="Use my location" title="Use my location" className="text-muted hover:text-primary flex-shrink-0"><Locate className="w-4 h-4" /></button>}
            {whereQuery && <button onClick={clearWhere} aria-label="Clear where" className="text-muted"><X className="w-4 h-4" /></button>}
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

  const sortDropdown = (
    <div className="flex flex-col gap-2">
      {SORT_OPTIONS.map((opt) => (
        <button key={opt.value} onClick={() => { setSortBy(opt.value); setOpenDropdown(null); }}
          className={`${pillClass(sortBy === opt.value)} text-left`}
        >{opt.label}</button>
      ))}
    </div>
  );

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Sort";

  // Phones get a Sort control plus a single Filters button that opens the
  // sheet below; six pills in a sideways-scrolling row was unusable at 390px.
  const mobileFilterBar = (
    <div className="lg:hidden border-b border-dark-lighter bg-dark-darker px-3 py-2 flex items-center gap-2">
      <FilterTrigger label={sortLabel} active={sortBy !== "date"}
        isOpen={openDropdown === "sort-mobile"}
        onToggle={() => setOpenDropdown(openDropdown === "sort-mobile" ? null : "sort-mobile")}
        panelClassName="w-48" icon={<ArrowUpDown className="w-3.5 h-3.5" />}
      >
        {sortDropdown}
      </FilterTrigger>

      <button onClick={() => { setOpenDropdown(null); setFilterSheet(true); }} data-testid="mobile-filters-open"
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full font-headline text-xs font-bold uppercase tracking-widest border transition-colors ${activeChips.length > 0 ? "border-primary/35 bg-primary/[0.08] text-primary" : "border-transparent text-muted"}`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Filters
        {activeChips.length > 0 && (
          <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-dark text-[10px] font-black flex items-center justify-center">
            {activeChips.length}
          </span>
        )}
      </button>

      {activeChips.length > 0 && (
        <button onClick={clearFilters} className="ml-auto font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-light transition-colors">
          Clear All
        </button>
      )}
    </div>
  );

  const filterSubNav = (
    <div ref={subNavRef} className="flex-shrink-0">
      {mobileFilterBar}
      <div className="hidden lg:flex border-b border-dark-lighter bg-dark-darker px-3 lg:px-6 py-2 items-center gap-1 overflow-x-auto">
      <FilterTrigger label={sortLabel} active={sortBy !== "date"}
        isOpen={openDropdown === "sort"} onToggle={() => setOpenDropdown(openDropdown === "sort" ? null : "sort")}
        panelClassName="w-48" icon={<ArrowUpDown className="w-3.5 h-3.5" />}
      >
        {sortDropdown}
      </FilterTrigger>
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
    </div>
  );

  const filterSheetOverlay = filterSheet ? createPortal(
    <div className="lg:hidden fixed inset-0 z-[60] flex flex-col bg-dark-darker" role="dialog" aria-modal="true" aria-label="Filters">
      <div className="flex items-center justify-between px-4 h-14 border-b border-dark-lighter flex-shrink-0">
        <span className="font-headline text-sm font-black uppercase tracking-widest text-light">Filters</span>
        <button onClick={() => setFilterSheet(false)} aria-label="Close filters"
          className="w-10 h-10 -mr-2 flex items-center justify-center text-muted hover:text-light transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-7">
        <SheetSection title="Discipline">{disciplineDropdown}</SheetSection>
        <SheetSection title="Location">{locationDropdown}</SheetSection>
        <SheetSection title="Date">{dateDropdown}</SheetSection>
        <SheetSection title="Price">{priceDropdown}</SheetSection>
        <SheetSection title="Format & Level">{formatLevelDropdown}</SheetSection>
      </div>

      <div className="flex-shrink-0 border-t border-dark-lighter px-4 py-3 flex items-center gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button onClick={clearFilters} disabled={activeChips.length === 0}
          className="font-headline text-xs font-bold uppercase tracking-widest text-muted hover:text-light transition-colors disabled:opacity-40">
          Clear all
        </button>
        <button onClick={() => setFilterSheet(false)}
          className="flex-1 bg-machined text-dark font-headline text-xs font-bold uppercase tracking-widest h-11 rounded-xl">
          Show {displayEvents.length} event{displayEvents.length !== 1 ? "s" : ""}
        </button>
      </div>
    </div>,
    document.body,
  ) : null;

  const resultsHeader = (
    <div className="px-3 lg:px-6 pt-4 pb-1 flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
      <h2 className="font-headline text-base lg:text-xl font-black italic tracking-tighter text-light">
        <span className="text-primary">{displayEvents.length}</span> event{displayEvents.length !== 1 ? "s" : ""} found
      </h2>
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
        <div className="grid gap-4 sm:gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {displayEvents.map((event) => (
            <EventCard key={event.id} event={event} className="w-full" />
          ))}
        </div>
      )}
    </div>
  );

  // List + map split — shown for the "Map" tab. Map mounts lazily on first
  // visit to this tab, then stays mounted (hidden via CSS) to avoid
  // re-initialising Mapbox / re-fetching tiles on every toggle.
  const mapContent = (
    <div className={view === "map" ? "flex flex-col lg:flex-row flex-1 min-h-0" : "hidden"}>
      {/* Phones show the map alone in this tab — a 32vh list on top of a short
          map left neither usable. The List tab is the list. */}
      <div ref={listRef} className="hidden lg:flex flex-col w-full lg:flex-1 lg:flex-shrink-0 border-b lg:border-b-0 lg:border-r border-dark-lighter bg-dark-darker overflow-y-auto lg:max-h-none px-4 py-3 lg:py-4">
        {displayEvents.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-headline text-lg font-black italic tracking-tighter text-light mb-3">No events found.</p>
            <button onClick={clearFilters}
              className="font-headline text-xs font-medium uppercase tracking-widest border border-primary text-primary px-4 py-2 hover:bg-primary hover:text-dark transition-colors rounded-full"
            >Clear Filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {displayEvents.map((event) => (
              <EventCard key={event.id} event={event} className="w-full" selected={selectedId === event.id} onSelect={() => handleSelect(event.id)} />
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 relative min-h-[260px] lg:min-h-[320px]">
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
    <div className="app-shell flex flex-col">
      {desktopHeader}
      {mobileHeader}
      {filterSubNav}
      {resultsHeader}
      {activeChipsRow}

      <div className="flex-1 min-h-0 flex flex-col">
        {gridContent}
        {mapContent}
      </div>

      {filterSheetOverlay}
    </div>
  );
}

export default function EventsListing() {
  return <Suspense><EventsListingInner /></Suspense>;
}
