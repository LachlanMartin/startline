"use client";

import { useEffect, useRef, useState, startTransition } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════
   DATE PICKER
   Shared dark-theme calendar popover. The native date input renders
   an OS-styled panel that ignores the design system, so every date
   field on the platform uses this instead.
   ══════════════════════════════════════════════════════════════ */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function fmtDateShort(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Trigger chrome per surface: the wizard's roomy fields vs the tighter register form. */
const TRIGGER_SIZE = {
  md: "rounded-md px-4 py-3 text-[15px]",
  sm: "rounded-[10px] px-[13px] py-[11px] text-[13.5px]",
} as const;

export interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  /** Supplying onChangeEnd turns the picker into a start/end range picker. */
  rangeEnd?: string;
  onChangeEnd?: (v: string) => void;
  placeholder?: string;
  disablePast?: boolean;
  /** Inclusive ISO bounds (yyyy-mm-dd). */
  minDate?: string;
  maxDate?: string;
  /** Show a year grid behind the month label — for far-back dates like a birthday. */
  yearPicker?: boolean;
  size?: keyof typeof TRIGGER_SIZE;
  invalid?: boolean;
}

export default function DatePicker({
  id,
  value,
  onChange,
  rangeEnd,
  onChangeEnd,
  placeholder = "Select date",
  disablePast = true,
  minDate,
  maxDate,
  yearPicker = false,
  size = "md",
  invalid = false,
}: DatePickerProps) {
  const isRange   = !!onChangeEnd;
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);

  const parseView = (iso: string) => {
    if (iso) { const [y, m] = iso.split("-").map(Number); return { year: y, month: m - 1 }; }
    // With no value, open on the newest month the bounds allow rather than
    // today — a birthday capped at "18 years ago" should not start in 2026.
    if (maxDate) { const [y, m] = maxDate.split("-").map(Number); return { year: y, month: m - 1 }; }
    return { year: todayDate.getFullYear(), month: todayDate.getMonth() };
  };

  const [open, setOpen]           = useState(false);
  const [dropUp, setDropUp]       = useState(false);
  const [showYears, setShowYears] = useState(false);
  const [viewYear, setViewYear]   = useState(parseView(value).year);
  const [viewMonth, setViewMonth] = useState(parseView(value).month);
  const [picking, setPicking]     = useState<"start" | "end">("start");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    if (value) { startTransition(() => { const [y, m] = value.split("-").map(Number); setViewYear(y); setViewMonth(m - 1); }); }
  }, [value]);

  const toggleOpen = () => {
    if (!open) {
      setShowYears(false);
      // Flip upwards when the panel would run off the bottom of the viewport.
      const rect = ref.current?.getBoundingClientRect();
      if (rect) setDropUp(window.innerHeight - rect.bottom < 400 && rect.top > 400);
      setPicking(value && !rangeEnd ? "end" : "start");
      const view = parseView(value);
      setViewYear(view.year); setViewMonth(view.month);
    }
    setOpen(v => !v);
  };

  const toIso = (d: number) => `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const selectDay = (d: number) => {
    const iso = toIso(d);
    if (!isRange) { onChange(iso); setOpen(false); return; }
    if (picking === "start" || !value) { onChange(iso); if (onChangeEnd) onChangeEnd(""); setPicking("end"); }
    else if (iso < value) { onChange(iso); if (onChangeEnd) onChangeEnd(""); setPicking("end"); }
    else { if (onChangeEnd) onChangeEnd(iso); setOpen(false); setPicking("start"); }
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0);  setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const isDisabled = (d: number) => {
    const iso = toIso(d);
    if (disablePast && new Date(viewYear, viewMonth, d) < todayDate) return true;
    if (minDate && iso < minDate) return true;
    if (maxDate && iso > maxDate) return true;
    return false;
  };
  const isStart    = (d: number) => !!value    && toIso(d) === value;
  const isEnd      = (d: number) => !!rangeEnd && toIso(d) === rangeEnd;
  const isSelected = (d: number) => !isRange   && !!value && toIso(d) === value;
  const isInRange  = (d: number) => { if (!isRange || !value || !rangeEnd) return false; const iso = toIso(d); return iso > value && iso < rangeEnd; };
  const isToday    = (d: number) => d === todayDate.getDate() && viewMonth === todayDate.getMonth() && viewYear === todayDate.getFullYear();

  const firstDow    = (() => { const d = new Date(viewYear, viewMonth, 1).getDay() - 1; return d < 0 ? 6 : d; })();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const displayValue = isRange
    ? value
      ? rangeEnd && rangeEnd !== value ? `${fmtDateShort(value)} to ${fmtDateShort(rangeEnd)}`
        : rangeEnd && rangeEnd === value ? fmtDateShort(value) + " (1 day)"
        // Only prompt for an end date while the picker is open — a closed
        // picker with just a start date is a valid single-day event.
        : open ? fmtDateShort(value) + " → pick end date" : fmtDateShort(value)
      : ""
    : value ? fmtDateShort(value) : "";

  const today        = todayIso();
  // Hide the "Today" shortcut when today falls outside the allowed range
  // (e.g. a date of birth capped at 18 years ago).
  const todayAllowed = !(minDate && today < minDate) && !(maxDate && today > maxDate);

  const selectToday = () => {
    onChange(today);
    if (isRange && onChangeEnd) { onChangeEnd(""); setPicking("end"); } else setOpen(false);
  };

  const lastYear  = maxDate ? Number(maxDate.slice(0, 4)) : todayDate.getFullYear() + 10;
  const firstYear = minDate ? Number(minDate.slice(0, 4)) : (disablePast ? todayDate.getFullYear() : lastYear - 100);
  const years     = Array.from({ length: Math.max(1, lastYear - firstYear + 1) }, (_, i) => lastYear - i);

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        onClick={toggleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "w-full bg-dark-light border font-headline text-left flex items-center justify-between transition-colors",
          TRIGGER_SIZE[size],
          invalid
            ? "border-red-500/70"
            : open ? "border-primary" : "border-dark-lighter hover:border-primary/40",
          displayValue ? "text-light" : "text-muted-dark",
        )}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <Calendar className="w-4 h-4 text-muted-dark shrink-0" />
          <span className="truncate">{displayValue || placeholder}</span>
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-dark shrink-0 ml-2 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 z-50 bg-dark border border-dark-lighter rounded-xl shadow-xl p-4 w-full sm:w-72 modal-in",
            dropUp ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {isRange && (
            <div className="mb-3 flex items-center justify-between">
              <span className={cn(
                "font-headline text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md",
                picking === "start" ? "bg-primary/10 text-primary" : "text-muted-dark",
              )}>
                {picking === "start" ? "▸ Tap start date" : "▸ Tap end date"}
              </span>
              {value && !rangeEnd && (
                <button type="button" onClick={() => { onChange(""); if (onChangeEnd) onChangeEnd(""); setPicking("start"); }}
                  className="font-headline text-[10px] uppercase tracking-widest text-muted hover:text-primary transition-colors">Reset</button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={prevMonth} disabled={showYears} aria-label="Previous month"
              className="w-9 h-9 rounded-md hover:bg-white/5 flex items-center justify-center text-muted hover:text-primary transition-colors disabled:opacity-30 disabled:hover:bg-transparent">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {yearPicker ? (
              <button type="button" onClick={() => setShowYears(v => !v)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md font-headline text-[13px] font-bold text-light hover:bg-white/5 transition-colors">
                {MONTH_NAMES[viewMonth]} {viewYear}
                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-dark transition-transform duration-200", showYears && "rotate-180")} />
              </button>
            ) : (
              <span className="font-headline text-[13px] font-bold text-light">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            )}
            <button type="button" onClick={nextMonth} disabled={showYears} aria-label="Next month"
              className="w-9 h-9 rounded-md hover:bg-white/5 flex items-center justify-center text-muted hover:text-primary transition-colors disabled:opacity-30 disabled:hover:bg-transparent">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {showYears ? (
            <div className="grid grid-cols-4 gap-1 max-h-[228px] overflow-y-auto">
              {years.map(y => (
                <button key={y} type="button"
                  onClick={() => { setViewYear(y); setShowYears(false); }}
                  className={cn(
                    "h-9 rounded-md font-headline text-[13px] font-bold transition-colors",
                    y === viewYear ? "bg-primary text-dark" : "text-muted hover:bg-white/5 hover:text-light",
                  )}>
                  {y}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 mb-1">
                {DAY_NAMES.map(d => (
                  <div key={d} className="font-headline text-[9px] uppercase tracking-widest text-muted-dark text-center py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((d, i) => {
                  if (d === null) return <div key={i} className="h-9" />;
                  const inRange = isInRange(d), start = isStart(d), end = isEnd(d);
                  const sel = isSelected(d), off = isDisabled(d), now = isToday(d);
                  return (
                    <div key={i} className={cn(
                      "flex items-center justify-center h-9",
                      inRange && "bg-primary/10",
                      start && (rangeEnd || picking === "end") && "bg-gradient-to-r from-transparent to-primary/10",
                      end && "bg-gradient-to-l from-transparent to-primary/10",
                    )}>
                      <button type="button" disabled={off} onClick={() => selectDay(d)}
                        className={cn(
                          "w-9 h-9 rounded-full text-[13px] font-headline font-bold transition-colors",
                          start || sel ? "bg-primary text-dark"
                            : end ? "bg-primary/80 text-dark"
                            : inRange ? "text-primary hover:bg-primary/10"
                            : off ? "text-muted-dark opacity-50 cursor-not-allowed"
                            : now ? "text-primary border border-primary/40 hover:bg-primary/10"
                            : "text-muted hover:bg-white/5 hover:text-light",
                        )}>
                        {d}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-dark-lighter flex items-center justify-between">
                <button type="button" onClick={() => { onChange(""); if (onChangeEnd) onChangeEnd(""); setOpen(false); setPicking("start"); }}
                  className="font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary transition-colors">Clear</button>
                {todayAllowed && (
                  <button type="button" onClick={selectToday}
                    className="font-headline text-[11px] uppercase tracking-widest text-primary hover:underline transition-colors">Today</button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
