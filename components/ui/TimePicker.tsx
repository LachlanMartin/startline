"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Clock, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════
   TIME PICKER
   Shared dark-theme time popover. The native time input renders an
   OS-styled panel that ignores the design system, so every time
   field on the platform uses this instead.
   ══════════════════════════════════════════════════════════════ */

/** "14:30" → "2:30 PM". Empty stays empty so callers can show a placeholder. */
export function fmtTime12(value: string): string {
  const parsed = parse(value);
  if (!parsed) return "";
  const { hour12, minute, period } = parsed;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

type Parts = { hour12: number; minute: number; period: "AM" | "PM" };

function parse(value: string): Parts | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const minute = Number(m[2]);
  if (h > 23 || minute > 59) return null;
  return {
    hour12: h % 12 === 0 ? 12 : h % 12,
    minute,
    period: h >= 12 ? "PM" : "AM",
  };
}

function to24(hour12: number, minute: number, period: "AM" | "PM"): string {
  const h = period === "PM" ? (hour12 === 12 ? 12 : hour12 + 12) : hour12 === 12 ? 0 : hour12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTE_STEP = 5;
const BASE_MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);
const PERIODS = ["AM", "PM"] as const;

/** Trigger chrome per surface: the wizard's roomy fields vs tighter forms. */
const TRIGGER_SIZE = {
  md: "rounded-md px-4 py-3 text-[15px]",
  sm: "rounded-[10px] px-[13px] py-[11px] text-[13.5px]",
} as const;

export interface TimePickerProps {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  size?: keyof typeof TRIGGER_SIZE;
  invalid?: boolean;
  ariaLabel?: string;
}

export default function TimePicker({
  id,
  value,
  onChange,
  placeholder = "Select a time",
  size = "md",
  invalid = false,
  ariaLabel,
}: TimePickerProps) {
  const [open, setOpen]     = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref     = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const baseId  = useId();
  const domId   = id ?? baseId;

  const parts   = parse(value);
  const display = fmtTime12(value);

  // Keep an off-grid minute (e.g. 07:23 from an older listing) selectable so
  // editing an existing event never silently rounds its start time.
  const minutes = parts && !BASE_MINUTES.includes(parts.minute)
    ? [...BASE_MINUTES, parts.minute].sort((a, b) => a - b)
    : BASE_MINUTES;

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelectorAll<HTMLElement>('[data-selected="true"]')
      .forEach(el => el.scrollIntoView({ block: "center" }));
  }, [open]);

  const toggleOpen = () => {
    if (open) { setOpen(false); return; }
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setDropUp(window.innerHeight - rect.bottom < 300 && rect.top > 300);
    setOpen(true);
  };

  // Each column commits on click, defaulting the parts not chosen yet so the
  // first tap always produces a valid time.
  const commit = (next: Partial<Parts>) => {
    const base: Parts = parts ?? { hour12: 12, minute: 0, period: "AM" };
    const merged = { ...base, ...next };
    onChange(to24(merged.hour12, merged.minute, merged.period));
  };

  const colBtn = (selected: boolean) => cn(
    "w-full text-center px-2 py-2 rounded-lg font-headline text-[13px] transition-colors",
    selected ? "text-primary bg-primary/10" : "text-light hover:bg-white/5",
  );

  return (
    <div ref={ref} className="relative">
      <button
        id={domId}
        type="button"
        onClick={toggleOpen}
        onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "w-full bg-dark-light border font-headline text-left flex items-center justify-between transition-colors",
          TRIGGER_SIZE[size],
          invalid
            ? "border-red-500/70"
            : open ? "border-primary" : "border-dark-lighter hover:border-primary/40",
          display ? "text-light" : "text-muted-dark",
        )}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <Clock className="w-4 h-4 text-muted-dark shrink-0" />
          <span className="truncate">{display || placeholder}</span>
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-dark shrink-0 ml-2 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {/* Sits clear of the chevron (which ends 32px in) rather than on top of it. */}
      {value && (
        <button
          type="button"
          onClick={() => { onChange(""); setOpen(false); }}
          title="Clear time"
          aria-label="Clear time"
          className="absolute right-10 top-1/2 -translate-y-1/2 p-1 rounded text-muted-dark hover:text-light hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Choose a time"
          className={cn(
            "absolute left-0 z-50 w-full sm:w-64 bg-dark border border-dark-lighter rounded-xl shadow-xl p-2 modal-in",
            dropUp ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          <div className="grid grid-cols-3 gap-1">
            {(["Hour", "Min", "AM/PM"] as const).map(h => (
              <div key={h} className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark text-center pb-1.5">
                {h}
              </div>
            ))}

            <div className="max-h-[184px] overflow-y-auto pr-0.5 space-y-0.5" role="listbox" aria-label="Hour">
              {HOURS.map(h => {
                const selected = parts?.hour12 === h;
                return (
                  <button key={h} type="button" role="option" aria-selected={selected} data-selected={selected}
                    onClick={() => commit({ hour12: h })} className={colBtn(selected)}>
                    {h}
                  </button>
                );
              })}
            </div>

            <div className="max-h-[184px] overflow-y-auto pr-0.5 space-y-0.5" role="listbox" aria-label="Minute">
              {minutes.map(m => {
                const selected = parts?.minute === m;
                return (
                  <button key={m} type="button" role="option" aria-selected={selected} data-selected={selected}
                    onClick={() => commit({ minute: m })} className={colBtn(selected)}>
                    {String(m).padStart(2, "0")}
                  </button>
                );
              })}
            </div>

            <div className="space-y-0.5" role="listbox" aria-label="AM or PM">
              {PERIODS.map(p => {
                const selected = parts?.period === p;
                return (
                  <button key={p} type="button" role="option" aria-selected={selected} data-selected={selected}
                    onClick={() => commit({ period: p })} className={colBtn(selected)}>
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 mt-1.5 border-t border-dark-lighter">
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}
              className="font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary transition-colors">
              Clear
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="font-headline text-[11px] uppercase tracking-widest text-primary hover:underline transition-colors">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
