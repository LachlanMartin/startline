"use client";

import { useState, useRef, useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Check, Plus, Trash2,
  Upload, X, MapPin, Calendar, Users,
  ChevronDown, ChevronLeft, ChevronRight, Clock, Eye,
  Ticket, ExternalLink, DollarSign, Bold, Italic, Underline,
  AlignLeft, Trophy,
} from "lucide-react";
import { encodePrizePool, parsePrizePool, normalisePrizeAmount } from "@/lib/prize-pool";
import AddressAutocomplete  from "@/components/ui/AddressAutocomplete";
import SuburbAutocomplete   from "@/components/ui/SuburbAutocomplete";
import LocationPreviewMap   from "@/components/organiser/LocationPreviewMap";

/* ── Step definitions ───────────────────────────────────────── */
const STEPS = [
  { k: "basics",   n: "01", label: "The Basics",          sub: "Name & Discipline"      },
  { k: "when",     n: "02", label: "Date & Location",     sub: "When & Where"           },
  { k: "tickets",  n: "03", label: "Tickets & Pricing",   sub: "Cost & Entry Options"   },
  { k: "media",    n: "04", label: "Media & Description", sub: "Images & Event Details" },
  { k: "review",   n: "05", label: "Final Review",        sub: "Review & Publish"       },
] as const;

const STEP_ERRORS: Record<number, string> = {
  0: "Event name, format, discipline, intensity level, participant cap and minimum age are required.",
  1: "Date, start time, street address, city and state are required.",
  2: "Registration platform, at least one ticket category with a price, and refund policy are required.",
  3: "A cover image and full description are required.",
};

type Discipline = "crossfit" | "running" | "hybrid" | "cycling" | "swimming" | "other" | "";
type Format     = "individual" | "team" | "both" | "";
type Intensity  = "low" | "moderate" | "high" | "extreme" | "";
type AusState   = "nsw" | "vic" | "qld" | "wa" | "sa" | "tas" | "act" | "nt" | "";

interface Wave { label: string; price: string; closes: string; startTime: string; }

interface FormState {
  title: string;
  discipline: Discipline;
  description: string;
  format: Format;
  level: Intensity;
  categories: string[];
  cap: string;
  minAge: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  address: string;
  city: string;
  state: AusState;
  latitude: number | null;
  longitude: number | null;
  waves: Wave[];
  prizeMoney: boolean;
  prizeMoneyAmount: string;
  prizeMoneyDetails: string;
  refundPolicy: string;
  registrationType: "startline" | "external";
  feeStructure: "athlete" | "organiser";
  registrationUrl: string;
  coverImage: File | null;
  coverImageUrl: string;
  photos: File[];
  photoUrls: string[];
}

const INITIAL: FormState = {
  title: "", discipline: "", description: "",
  format: "", level: "", categories: [], cap: "", minAge: "",
  date: "", endDate: "", startTime: "", endTime: "",
  venue: "", address: "", city: "", state: "", latitude: null, longitude: null,
  waves: [{ label: "", price: "", closes: "", startTime: "" }],
  prizeMoney: false, prizeMoneyAmount: "", prizeMoneyDetails: "",
  refundPolicy: "",
  registrationType: "startline", feeStructure: "athlete", registrationUrl: "",
  coverImage: null, coverImageUrl: "",
  photos: [], photoUrls: [],
};

/* ── Shared field primitive ─────────────────────────────────── */
function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-light/70">
          {label}{required && <span className="text-primary font-black text-[15px] leading-none ml-1">*</span>}
        </label>
        {hint && <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputCls    = "w-full bg-dark-light border border-dark-lighter rounded-md px-4 py-3 font-headline text-[15px] text-light placeholder:text-muted focus:border-primary focus:outline-none transition-colors";
const textareaCls = "w-full bg-dark-light border border-dark-lighter rounded-md px-4 py-3 font-headline text-[14px] text-light placeholder:text-muted focus:border-primary focus:outline-none resize-none transition-colors";

/* ═══════════════════════════════════════════════════════════════
   DATE PICKER POPOVER
   ══════════════════════════════════════════════════════════════ */
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function fmtDateShort(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

function DatePickerPopover({
  value, onChange, rangeEnd, onChangeEnd,
  placeholder = "Select date", disablePast = true,
}: {
  value: string; onChange: (v: string) => void;
  rangeEnd?: string; onChangeEnd?: (v: string) => void;
  placeholder?: string; disablePast?: boolean;
}) {
  const isRange    = !!onChangeEnd;
  const todayDate  = new Date(); todayDate.setHours(0, 0, 0, 0);
  const parseView  = (iso: string) => {
    if (iso) { const [y, m] = iso.split("-").map(Number); return { year: y, month: m - 1 }; }
    return { year: todayDate.getFullYear(), month: todayDate.getMonth() };
  };
  const [open, setOpen]           = useState(false);
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

  const toIso = (d: number) => `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const selectDay = (d: number) => {
    const iso = toIso(d);
    if (!isRange) { onChange(iso); setOpen(false); return; }
    if (picking === "start" || !value) { onChange(iso); if (onChangeEnd) onChangeEnd(""); setPicking("end"); }
    else if (iso < value) { onChange(iso); if (onChangeEnd) onChangeEnd(""); setPicking("end"); }
    else if (iso === value) { if (onChangeEnd) onChangeEnd(iso); setOpen(false); setPicking("start"); }
    else { if (onChangeEnd) onChangeEnd(iso); setOpen(false); setPicking("start"); }
  };
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const isPast     = (d: number) => !disablePast ? false : new Date(viewYear, viewMonth, d) < todayDate;
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
      ? rangeEnd && rangeEnd !== value ? `${fmtDateShort(value)} — ${fmtDateShort(rangeEnd)}`
        : rangeEnd && rangeEnd === value ? fmtDateShort(value) + " (1 day)"
        // Only prompt for an end date while the picker is open — a closed
        // picker with just a start date is a valid single-day event.
        : open ? fmtDateShort(value) + " → pick end date" : fmtDateShort(value)
      : ""
    : value ? fmtDateShort(value) : "";

  const selectToday = () => {
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    onChange(iso);
    if (isRange && onChangeEnd) { onChangeEnd(""); setPicking("end"); } else setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button type="button"
        onClick={() => { setOpen(v => !v); if (!open) setPicking(value && !rangeEnd ? "end" : "start"); }}
        className={`w-full bg-dark-light border rounded-md px-4 py-3 font-headline text-[15px] text-left flex items-center justify-between transition-colors
          ${open ? "border-primary" : "border-dark-lighter hover:border-primary/40"}
          ${displayValue ? "text-light" : "text-muted-dark"}`}>
        <span className="flex items-center gap-2.5 min-w-0">
          <Calendar className="w-4 h-4 text-muted-dark shrink-0" />
          <span className="truncate">{displayValue || placeholder}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-dark shrink-0 ml-2 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-dark border border-dark-lighter rounded-xl shadow-xl p-4 w-full sm:w-72 modal-in">
          {isRange && (
            <div className="mb-3 flex items-center justify-between">
              <span className={`font-headline text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md ${picking === "start" ? "bg-primary/10 text-primary" : "text-muted-dark"}`}>
                {picking === "start" ? "▸ Tap start date" : "▸ Tap end date"}
              </span>
              {value && !rangeEnd && (
                <button type="button" onClick={() => { onChange(""); if (onChangeEnd) onChangeEnd(""); setPicking("start"); }}
                  className="font-headline text-[10px] uppercase tracking-widest text-muted hover:text-primary transition-colors">Reset</button>
              )}
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={prevMonth} className="w-9 h-9 rounded-md hover:bg-white/5 flex items-center justify-center text-muted hover:text-primary transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-headline text-[13px] font-bold text-light">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} className="w-9 h-9 rounded-md hover:bg-white/5 flex items-center justify-center text-muted hover:text-primary transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {["Mo","Tu","We","Th","Fr","Sa","Su"].map(d => (
              <div key={d} className="font-headline text-[9px] uppercase tracking-widest text-muted-dark text-center py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} className="h-9" />;
              const inRange = isInRange(d), start = isStart(d), end = isEnd(d), sel = isSelected(d), past = isPast(d), today = isToday(d);
              return (
                <div key={i} className={`flex items-center justify-center h-9 ${inRange ? "bg-primary/10" : ""} ${start && (rangeEnd || picking === "end") ? "bg-gradient-to-r from-transparent to-primary/10" : ""} ${end ? "bg-gradient-to-l from-transparent to-primary/10" : ""}`}>
                  <button type="button" disabled={past} onClick={() => selectDay(d)}
                    className={`w-9 h-9 rounded-full text-[13px] font-headline font-bold transition-colors
                      ${start || sel ? "bg-primary text-dark" : end ? "bg-primary/80 text-dark" : inRange ? "text-primary hover:bg-primary/10" : past ? "text-muted-dark opacity-50 cursor-not-allowed" : today ? "text-primary border border-primary/40 hover:bg-primary/10" : "text-muted hover:bg-white/5 hover:text-light"}`}>
                    {d}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-dark-lighter flex items-center justify-between">
            <button type="button" onClick={() => { onChange(""); if (onChangeEnd) onChangeEnd(""); setOpen(false); setPicking("start"); }}
              className="font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary transition-colors">Clear</button>
            <button type="button" onClick={selectToday}
              className="font-headline text-[11px] uppercase tracking-widest text-primary hover:underline transition-colors">Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TIME PICKER
   ══════════════════════════════════════════════════════════════ */
function fmt24to12(t: string): string {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative flex items-center">
      <input type="time" value={value} onChange={e => onChange(e.target.value)}
        className={`w-full bg-dark-light border border-dark-lighter rounded-md px-4 py-3 font-headline text-[15px] text-light placeholder:text-muted focus:border-primary focus:outline-none transition-colors ${value ? "text-light" : "text-muted-dark"}`} />
      {value && (
        <button type="button" onClick={() => onChange("")}
          className="absolute right-3 p-1.5 text-muted-dark hover:text-light transition-colors" title="Clear time">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RICH TEXT EDITOR
   ══════════════════════════════════════════════════════════════ */
function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editorRef     = useRef<HTMLDivElement>(null);
  const userHasTyped  = useRef(false);

  useEffect(() => {
    if (editorRef.current && !userHasTyped.current) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val ?? undefined);
    editorRef.current?.focus();
  };

  const setBlock = (tag: string) => {
    document.execCommand("formatBlock", false, tag);
    editorRef.current?.focus();
  };

  const toolbarBtn = "w-8 h-8 rounded flex items-center justify-center text-muted hover:bg-white/5 hover:text-light transition-colors font-headline font-bold text-[13px]";

  return (
    <div className="border border-dark-lighter rounded-md overflow-hidden focus-within:border-primary transition-colors">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-dark-lighter bg-white/[0.02] flex-wrap">
        <button type="button" title="Bold (Ctrl+B)"      onClick={() => exec("bold")}      className={toolbarBtn}><Bold      className="w-3.5 h-3.5" /></button>
        <button type="button" title="Italic (Ctrl+I)"    onClick={() => exec("italic")}    className={toolbarBtn}><Italic    className="w-3.5 h-3.5" /></button>
        <button type="button" title="Underline (Ctrl+U)" onClick={() => exec("underline")} className={toolbarBtn}><Underline className="w-3.5 h-3.5" /></button>
        <div className="w-px h-5 bg-dark-lighter mx-1" />
        <button type="button" title="Heading"   onClick={() => setBlock("h3")} className={`${toolbarBtn} text-[11px] font-black uppercase tracking-widest`}>H</button>
        <button type="button" title="Subheading" onClick={() => setBlock("h4")} className={`${toolbarBtn} text-[10px] font-black uppercase tracking-widest`}>H2</button>
        <button type="button" title="Normal text" onClick={() => setBlock("p")} className={toolbarBtn}><AlignLeft className="w-3.5 h-3.5" /></button>
        <div className="w-px h-5 bg-dark-lighter mx-1" />
        <button type="button" title="Bullet list" onClick={() => exec("insertUnorderedList")} className={`${toolbarBtn} text-[11px]`}>• List</button>
      </div>
      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          userHasTyped.current = true;
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        onKeyDown={e => {
          if (e.ctrlKey || e.metaKey) {
            if (e.key === "b") { e.preventDefault(); exec("bold"); }
            if (e.key === "i") { e.preventDefault(); exec("italic"); }
            if (e.key === "u") { e.preventDefault(); exec("underline"); }
          }
        }}
        data-placeholder="Tell athletes what makes this event unmissable — course details, atmosphere, divisions, what to bring…"
        className="min-h-[220px] px-4 py-3 font-headline text-[14px] text-light focus:outline-none prose prose-sm max-w-none
          [&_h3]:font-headline [&_h3]:font-black [&_h3]:text-[16px] [&_h3]:text-light [&_h3]:mt-3 [&_h3]:mb-1
          [&_h4]:font-headline [&_h4]:font-bold [&_h4]:text-[14px] [&_h4]:text-light [&_h4]:mt-2 [&_h4]:mb-1
          [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_li]:mb-0.5
          empty:before:content-[attr(data-placeholder)] empty:before:text-muted-dark empty:before:pointer-events-none"
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 1 — THE BASICS
   ══════════════════════════════════════════════════════════════ */
const DISCIPLINES: { v: Discipline; l: string; d: string }[] = [
  { v: "crossfit",  l: "CrossFit",  d: "Functional fitness comp"    },
  { v: "running",   l: "Running",   d: "5K · 10K · Half · Marathon" },
  { v: "hybrid",    l: "Hybrid",    d: "Multi-discipline / OCR"     },
  { v: "cycling",   l: "Cycling",   d: "Road · Criterium · Gravel"  },
  { v: "swimming",  l: "Swimming",  d: "Pool · Open water events"   },
  { v: "other",     l: "Other",     d: "Another discipline"         },
];

const DISCIPLINE_CATS: Partial<Record<Discipline, string[]>> = {
  running:  ["5K", "10K", "Half Marathon", "Marathon", "Ultra"],
  cycling:  ["Road Race", "Criterium", "Time Trial", "Gran Fondo", "Mountain Bike", "Gravel"],
  swimming: ["50m", "100m", "200m", "400m", "800m", "1500m", "Open Water"],
};

const FORMATS: { v: Format; l: string; d: string }[] = [
  { v: "individual", l: "Individual",   d: "Solo athletes"     },
  { v: "team",       l: "Team / Pairs", d: "Doubles or relay"  },
  { v: "both",       l: "Both",         d: "Individual & team" },
];

const INTENSITY_LEVELS: { v: Intensity; l: string; d: string }[] = [
  { v: "low",      l: "Low",      d: "Beginner / fun runs"      },
  { v: "moderate", l: "Moderate", d: "Intermediate fitness"     },
  { v: "high",     l: "High",     d: "Competitive & challenging" },
  { v: "extreme",  l: "Extreme",  d: "Elite / pro level"        },
];

const AGE_PRESETS = ["18"];
const CAP_PRESETS = ["250", "500", "1000", "5000"];

function BasicsStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  const [ageMode, setAgeMode] = useState<"open" | "preset" | "custom" | "none">(
    form.minAge === "" ? "none" : form.minAge === "0" ? "open" : AGE_PRESETS.includes(form.minAge) ? "preset" : "custom"
  );
  const [capMode, setCapMode] = useState<"preset" | "custom" | "none">(
    form.cap === "" ? "none" : CAP_PRESETS.includes(form.cap) ? "preset" : "custom"
  );
  const [showCustomCat,  setShowCustomCat]  = useState(false);
  const [customCatInput, setCustomCatInput] = useState("");

  const toggle = (c: string) => {
    const s = new Set(form.categories); s.has(c) ? s.delete(c) : s.add(c);
    update({ categories: [...s] });
  };
  const commitCustomCat = () => {
    const val = customCatInput.trim();
    if (val && !form.categories.includes(val)) update({ categories: [...form.categories, val] });
    setCustomCatInput(""); setShowCustomCat(false);
  };

  const hasDisciplineCats = !!DISCIPLINE_CATS[form.discipline as Discipline];

  return (
    <div>
      <Field label="Event title" required hint={`${form.title.length}/80`}>
        <input maxLength={80} value={form.title} onChange={e => update({ title: e.target.value })}
          placeholder="e.g. Apex Throwdown Sydney 2026" className={inputCls} />
      </Field>

      <Field label="Competition format" required>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {FORMATS.map(f => {
            const on = form.format === f.v;
            return (
              <button key={f.v} type="button" onClick={() => update({ format: f.v })}
                className={`flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1 text-left p-3 sm:p-4 rounded-md border transition-all
                  ${on ? "border-primary bg-primary/10" : "border-dark-lighter hover:border-primary/40"}`}>
                <div className={`font-headline text-[14px] font-black italic tracking-tighter ${on ? "text-primary" : "text-light"}`}>{f.l}</div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-muted">{f.d}</div>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Discipline" required>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {DISCIPLINES.map(d => {
            const on = form.discipline === d.v;
            return (
              <button key={d.v} type="button" onClick={() => update({ discipline: d.v, categories: [] })}
                className={`text-left p-4 rounded-md border transition-all ${on ? "border-primary bg-primary/10" : "border-dark-lighter hover:border-primary/40"}`}>
                <div className={`font-headline text-[15px] font-black italic tracking-tighter ${on ? "text-primary" : "text-light"}`}>{d.l}</div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-muted mt-1">{d.d}</div>
              </button>
            );
          })}
        </div>
      </Field>

      {hasDisciplineCats && (
        <Field label="Divisions & categories" required hint={`${form.categories.length} selected`}>
          <div className="flex flex-wrap gap-2">
            {(DISCIPLINE_CATS[form.discipline as Discipline] ?? []).map(c => (
              <button key={c} type="button" onClick={() => toggle(c)}
                className={`font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md border transition-colors
                  ${form.categories.includes(c) ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}>
                {form.categories.includes(c) && <Check className="w-3 h-3 inline mr-1" />}{c}
              </button>
            ))}
            {form.categories.filter(c => !(DISCIPLINE_CATS[form.discipline as Discipline] ?? []).includes(c)).map(c => (
              <button key={c} type="button" onClick={() => toggle(c)}
                className="font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md border border-primary bg-primary/10 text-primary">
                <Check className="w-3 h-3 inline mr-1" />{c}
              </button>
            ))}
            {showCustomCat ? (
              <div className="flex items-center gap-2">
                <input autoFocus type="text" value={customCatInput}
                  onChange={e => setCustomCatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitCustomCat(); } if (e.key === "Escape") { setShowCustomCat(false); setCustomCatInput(""); } }}
                  placeholder="e.g. Masters 45+" className={`${inputCls} !py-2 w-36 text-[12px]`} />
                <button type="button" onClick={commitCustomCat}
                  className="font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors">Add</button>
                <button type="button" onClick={() => { setShowCustomCat(false); setCustomCatInput(""); }} className="text-muted-dark hover:text-light transition-colors"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowCustomCat(true)}
                className="font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md border border-dark-lighter text-muted hover:border-primary hover:bg-primary/10 hover:text-primary transition-colors">
                <Plus className="w-3 h-3 inline mr-1" /> Custom…
              </button>
            )}
          </div>
        </Field>
      )}

      <Field label="Intensity level" required>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {INTENSITY_LEVELS.map(l => {
            const on = form.level === l.v;
            return (
              <button key={l.v} type="button" onClick={() => update({ level: l.v })}
                className={`flex flex-col items-start text-left p-3 sm:p-4 rounded-md border transition-all
                  ${on ? "border-primary bg-primary/10" : "border-dark-lighter hover:border-primary/40"}`}>
                <div className={`font-headline text-[14px] font-black italic tracking-tighter ${on ? "text-primary" : "text-light"}`}>{l.l}</div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-muted mt-0.5">{l.d}</div>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Participant cap" required hint="Max registrations">
        <div className="flex flex-wrap gap-2 mb-3">
          {CAP_PRESETS.map(c => {
            const active = capMode === "preset" && form.cap === c;
            return (
              <button key={c} type="button" onClick={() => { update({ cap: c }); setCapMode("preset"); }}
                className={`font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md border transition-colors
                  ${active ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}>
                {parseInt(c).toLocaleString()}
              </button>
            );
          })}
          <button type="button" onClick={() => setCapMode("custom")}
            className={`font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md border transition-colors
              ${capMode === "custom" ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}>
            Custom
          </button>
        </div>
        {capMode === "custom" && (
          <input type="number" value={form.cap} onChange={e => update({ cap: e.target.value })}
            placeholder="e.g. 4200" className={`${inputCls} w-40`} />
        )}
      </Field>

      <Field label="Minimum age" required>
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" onClick={() => { update({ minAge: "0" }); setAgeMode("open"); }}
            className={`font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md border transition-colors
              ${ageMode === "open" ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}>
            Open to all
          </button>
          {AGE_PRESETS.map(a => (
            <button key={a} type="button" onClick={() => { update({ minAge: a }); setAgeMode("preset"); }}
              className={`font-headline text-[13px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-md border transition-colors
                ${ageMode === "preset" && form.minAge === a ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}>
              {a}+
            </button>
          ))}
          <button type="button" onClick={() => { update({ minAge: "" }); setAgeMode("custom"); }}
            className={`font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md border transition-colors
              ${ageMode === "custom" ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}>
            Custom
          </button>
        </div>
        {ageMode === "custom" && (
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-dark-lighter rounded-md overflow-hidden">
              <button type="button" onClick={() => update({ minAge: String(Math.max(0, (parseInt(form.minAge) || 0) - 1)) })}
                className="w-9 h-11 flex items-center justify-center text-muted-dark hover:text-light hover:bg-white/5 transition-colors font-headline text-lg select-none">−</button>
              <input type="number" value={form.minAge} onChange={e => update({ minAge: e.target.value })} placeholder="0"
                className="w-16 bg-dark-light px-2 py-3 font-headline text-[15px] text-light text-center placeholder:text-muted focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <button type="button" onClick={() => update({ minAge: String((parseInt(form.minAge) || 0) + 1) })}
                className="w-9 h-11 flex items-center justify-center text-muted-dark hover:text-light hover:bg-white/5 transition-colors font-headline text-lg select-none">+</button>
            </div>
            <span className="font-headline text-[13px] text-muted">years old minimum</span>
          </div>
        )}
        {ageMode === "open" && (
          <p className="font-headline text-[11px] uppercase tracking-widest text-muted-dark">No age restriction — open to all ages.</p>
        )}
      </Field>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 2 — DATE & LOCATION
   ══════════════════════════════════════════════════════════════ */
const AUS_STATES: [AusState, string, string][] = [
  ["nsw", "NSW", "New South Wales"],
  ["vic", "VIC", "Victoria"],
  ["qld", "QLD", "Queensland"],
  ["wa",  "WA",  "Western Australia"],
  ["sa",  "SA",  "South Australia"],
  ["tas", "TAS", "Tasmania"],
  ["act", "ACT", "Australian Capital Territory"],
  ["nt",  "NT",  "Northern Territory"],
];

function StateSelect({ value, onChange }: { value: AusState; onChange: (v: AusState) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as AusState)}
      className={`w-full bg-dark-light border border-dark-lighter rounded-md px-4 py-3 font-headline text-[15px] focus:border-primary focus:outline-none transition-colors ${value ? "text-light" : "text-muted-dark"}`}>
      <option value="" disabled className="bg-dark text-muted-dark">Select state…</option>
      {AUS_STATES.map(([v, abbr]) => (
        <option key={v} value={v} className="bg-dark text-light">{abbr}</option>
      ))}
    </select>
  );
}

function WhenStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  return (
    <div>
      <Field label="Event date(s)" required hint="Tap start then end for multi-day">
        <DatePickerPopover
          value={form.date} onChange={v => update({ date: v })}
          rangeEnd={form.endDate} onChangeEnd={v => update({ endDate: v })}
          placeholder="Pick start date"
        />
        {form.endDate && form.endDate !== form.date && (
          <button type="button" onClick={() => update({ endDate: "" })}
            className="mt-1.5 font-headline text-[10px] uppercase tracking-widest text-muted-dark hover:text-primary transition-colors flex items-center gap-1">
            <X className="w-3 h-3" /> Make single-day event
          </button>
        )}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <Field label="Start time" required>
          <TimePicker value={form.startTime} onChange={v => update({ startTime: v })} />
          <p className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-1.5">
            Overall start. Per-wave start times can be set in Tickets & Pricing.
          </p>
        </Field>
        <Field label="Cut-off time" hint="Last finisher">
          <TimePicker value={form.endTime} onChange={v => update({ endTime: v })} placeholder="Select end time" />
        </Field>
      </div>

      <div className="my-6 border-t border-dark-lighter" />

      <Field label="Street address" required>
        <AddressAutocomplete
          value={form.address} onChange={raw => update({ address: raw })}
          onSelect={({ address, city, state, venue, latitude, longitude }) => {
            update({
              ...(address && { address }),
              ...(city    && { city }),
              ...(state   && { state: state as typeof form.state }),
              ...(venue   && { venue }),
              ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
            });
          }}
          placeholder="Start typing an address…"
          className={inputCls}
        />
      </Field>

      <Field label="Location preview" hint="Updates when you select an address">
        <LocationPreviewMap
          latitude={form.latitude}
          longitude={form.longitude}
          label={[form.venue, form.city, form.state?.toUpperCase()].filter(Boolean).join(", ") || undefined}
        />
      </Field>

      <Field label="Venue name" hint="Optional">
        <input value={form.venue} onChange={e => update({ venue: e.target.value })}
          placeholder="Sydney Olympic Park" className={inputCls} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <Field label="City" required>
          <SuburbAutocomplete
            value={form.city}
            onChange={city  => update({ city })}
            onStateChange={state => { if (!form.state) update({ state: state as AusState }); }}
            placeholder="e.g. Melbourne"
            className={inputCls}
          />
        </Field>
        <Field label="State" required>
          <StateSelect value={form.state} onChange={v => update({ state: v })} />
        </Field>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 3 — TICKETS & PRICING
   ══════════════════════════════════════════════════════════════ */
const REFUND_PRESETS: { v: string; l: string }[] = [
  { v: "no-refunds", l: "No refunds"              },
  { v: "full-30",    l: "Full refund 30+ days out" },
  { v: "half-14",    l: "50% refund 14–30 days"    },
  { v: "deferrals",  l: "Deferrals accepted"        },
];

function refundPresetToText(v: string): string {
  return REFUND_PRESETS.find(r => r.v === v)?.l ?? v;
}

const STARTLINE_PCT  = 0.0395;
const STARTLINE_FLAT = 1.45;
const STRIPE_PCT     = 0.0175;
const STRIPE_FLAT    = 0.30;

function TicketsStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  const updateWave = (i: number, patch: Partial<Wave>) => {
    const waves = [...form.waves]; waves[i] = { ...waves[i], ...patch }; update({ waves });
  };
  const removeWave = (i: number) => update({ waves: form.waves.filter((_, j) => j !== i) });
  const addWave    = () => update({ waves: [...form.waves, { label: "", price: "", closes: "", startTime: "" }] });

  const [refundSelected, setRefundSelected] = useState<string[]>(() =>
    REFUND_PRESETS.filter(r => form.refundPolicy.includes(r.l)).map(r => r.v)
  );
  const [refundCustom, setRefundCustom] = useState(() => {
    let text = form.refundPolicy;
    REFUND_PRESETS.forEach(r => { text = text.replace(r.l, "").replace(/^[.,\s]+|[.,\s]+$/g, ""); });
    return text.trim();
  });

  const buildRefundPolicy = (selected: string[], custom: string) =>
    [...selected.map(refundPresetToText), ...(custom.trim() ? [custom.trim()] : [])].join(". ");

  const toggleRefund = (v: string) => {
    const next = refundSelected.includes(v) ? refundSelected.filter(x => x !== v) : [...refundSelected, v];
    setRefundSelected(next);
    update({ refundPolicy: buildRefundPolicy(next, refundCustom) });
  };
  const handleRefundCustom = (text: string) => {
    setRefundCustom(text);
    update({ refundPolicy: buildRefundPolicy(refundSelected, text) });
  };

  return (
    <div>
      {/* Registration platform */}
      <Field label="Registration platform" required>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { value: "startline", title: "Startline",        sub: "Managed on this platform"      },
            { value: "external",  title: "External website", sub: "Link to your own registration" },
          ] as const).map(({ value, title, sub }) => {
            const active = form.registrationType === value;
            return (
              <button key={value} type="button" onClick={() => update({ registrationType: value })}
                className={`flex flex-col items-start gap-1 rounded-xl border-2 px-5 py-4 text-left transition-colors
                  ${active ? "border-primary bg-primary/10" : "border-dark-lighter bg-dark-light hover:border-primary/40"}`}>
                <div className={`font-headline text-[13px] font-bold uppercase tracking-widest ${active ? "text-primary" : "text-light"}`}>{title}</div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">{sub}</div>
              </button>
            );
          })}
        </div>

        {form.registrationType === "startline" && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between mt-1">
              <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">Fee structure</div>
              <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">Startline fee: 3.95% + A$1.45 per ticket</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { value: "athlete",   title: "Athlete pays the fee",       sub: "Startline's fee added on top at checkout" },
                { value: "organiser", title: "Organiser absorbs the fee",  sub: "Fee deducted from your payout"            },
              ] as const).map(({ value, title, sub }) => {
                const active = form.feeStructure === value;
                return (
                  <button key={value} type="button" onClick={() => update({ feeStructure: value })}
                    className={`flex flex-col items-start gap-1 rounded-xl border-2 px-5 py-4 text-left transition-colors
                      ${active ? "border-primary bg-primary/10" : "border-dark-lighter bg-dark-light hover:border-primary/40"}`}>
                    <div className={`font-headline text-[13px] font-bold uppercase tracking-widest ${active ? "text-primary" : "text-light"}`}>{title}</div>
                    <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">{sub}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {form.registrationType === "external" && (
          <div className="mt-5">
            <Field label="Registration URL" required>
              <input value={form.registrationUrl} onChange={e => update({ registrationUrl: e.target.value })}
                placeholder="https://yourorg.com/events/sydney-2026" className={inputCls} />
            </Field>
          </div>
        )}
      </Field>

      {/* Ticket categories */}
      <Field label="Ticket categories" required>
        <div className="space-y-3">
          {form.waves.map((w, i) => (
            <div key={i} className="bg-dark-light border border-dark-lighter rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-dark-lighter flex items-center justify-center font-headline font-black italic text-primary text-[13px] shrink-0">
                  {i + 1}
                </div>
                <input value={w.label} onChange={e => updateWave(i, { label: e.target.value })}
                  placeholder="General admission" className={`${inputCls} flex-1`} />
                <button onClick={() => removeWave(i)}
                  className="w-9 h-9 rounded text-muted-dark hover:text-primary hover:bg-white/5 flex items-center justify-center transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Price + close date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">Price (A$)</div>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">Free</span>
                      <div onClick={() => updateWave(i, { price: w.price === "0" ? "" : "0" })}
                        className={`relative w-8 h-4 rounded-full transition-colors duration-200 cursor-pointer ${w.price === "0" ? "bg-primary/100" : "bg-dark-lighter"}`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${w.price === "0" ? "translate-x-4" : "translate-x-0.5"}`} />
                      </div>
                    </label>
                  </div>
                  {w.price === "0" ? (
                    <div className="w-full bg-primary/10 border border-primary/30 rounded-md px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-primary">Free</div>
                  ) : (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-headline text-[13px] text-muted">A$</span>
                      <input value={w.price} inputMode="decimal"
                        onChange={e => updateWave(i, { price: e.target.value.replace(/[^\d.]/g, "") })}
                        placeholder="129" className={`${inputCls} pl-9`} />
                    </div>
                  )}
                  {form.registrationType === "startline" && (() => {
                    const p = parseFloat(w.price);
                    if (!w.price || w.price === "0" || isNaN(p) || p <= 0) return null;
                    const startlineFee = p * STARTLINE_PCT + STARTLINE_FLAT;
                    const stripeFee    = p * STRIPE_PCT + STRIPE_FLAT;
                    const athletePays  = form.feeStructure === "athlete" ? p + startlineFee : p;
                    const youReceive   = form.feeStructure === "athlete" ? p - stripeFee : p - startlineFee - stripeFee;
                    const fmt = (n: number) => `A$${n.toFixed(2)}`;
                    return (
                      <div className="mt-2 rounded-md bg-dark px-3 py-2.5 space-y-1">
                        {([
                          { label: "Athlete pays",  value: fmt(athletePays),  muted: false, sub: null              },
                          { label: "You receive",   value: fmt(youReceive),   muted: false, sub: "after Stripe fee" },
                          { label: "Startline fee", value: fmt(startlineFee), muted: true,  sub: null              },
                        ] as const).map(r => (
                          <div key={r.label} className="flex items-baseline justify-between">
                            <span className="font-headline text-[13px] uppercase tracking-widest text-light">
                              {r.label}{r.sub && <span className="ml-1.5 normal-case text-[11px] text-muted">({r.sub})</span>}
                            </span>
                            <span className={`font-headline text-[14px] font-bold ${r.muted ? "text-muted" : "text-light"}`}>{r.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mb-1.5">Category closes</div>
                  <DatePickerPopover value={w.closes} onChange={v => updateWave(i, { closes: v })} placeholder="Optional close date" disablePast={false} />
                </div>
              </div>

              {/* Per-wave start time */}
              <div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Wave start time <span className="text-muted-dark">— optional</span>
                </div>
                <TimePicker value={w.startTime} onChange={v => updateWave(i, { startTime: v })} placeholder="Same as event start" />
              </div>
            </div>
          ))}
          <button onClick={addWave}
            className="w-full border border-dashed border-dark-lighter rounded-md py-3 font-headline text-[12px] uppercase tracking-widest text-muted hover:text-primary hover:border-primary/40 flex items-center justify-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Add ticket category
          </button>
        </div>
      </Field>

      {/* Prize money toggle */}
      <div className="border border-dark-lighter rounded-xl overflow-hidden mb-6">
        <button type="button" onClick={() => update({ prizeMoney: !form.prizeMoney })}
          className="w-full flex items-center justify-between px-5 py-4 bg-dark-light hover:bg-dark-light/80 transition-colors">
          <div>
            <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-light text-left flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" /> Prize money
            </div>
            <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-0.5 text-left">This event offers a cash prize pool</div>
          </div>
          <div className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${form.prizeMoney ? "bg-primary/100" : "bg-dark-lighter"}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.prizeMoney ? "translate-x-5" : "translate-x-0"}`} />
          </div>
        </button>
        {form.prizeMoney && (
          <div className="px-5 pb-5 pt-3 bg-white/[0.02] border-t border-dark-lighter space-y-3">
            <div>
              <div className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5">Total prize pool</div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-headline text-[13px] text-muted">A$</span>
                <input value={form.prizeMoneyAmount} onChange={e => update({ prizeMoneyAmount: e.target.value })}
                  placeholder="e.g. 2,000"
                  className={`${inputCls} pl-9`} />
              </div>
            </div>
            <div>
              <div className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5">How it&apos;s awarded</div>
              <input value={form.prizeMoneyDetails} onChange={e => update({ prizeMoneyDetails: e.target.value })}
                placeholder="e.g. Awarded to podium finishers per division"
                className={inputCls} />
            </div>
            {normalisePrizeAmount(form.prizeMoneyAmount) && (
              <div className="bg-dark border border-dark-lighter rounded-xl px-5 py-4 flex items-center gap-4">
                <Trophy className="w-6 h-6 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-headline text-[17px] font-bold text-primary leading-tight">
                    ${normalisePrizeAmount(form.prizeMoneyAmount)} prize pool
                  </p>
                  <p className="font-headline text-[11px] font-medium uppercase tracking-widest text-muted mt-0.5 truncate">
                    {form.prizeMoneyDetails.trim() || "Cash prizes up for grabs"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Refund policy */}
      <Field label="Refund & transfer policy" required>
        <div className="flex flex-wrap gap-2 mb-3">
          {REFUND_PRESETS.map(({ v, l }) => {
            const active = refundSelected.includes(v);
            return (
              <button key={v} type="button" onClick={() => toggleRefund(v)}
                className={`font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2.5 rounded-md border transition-colors flex items-center gap-1.5
                  ${active ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}>
                {active && <Check className="w-3 h-3" />}{l}
              </button>
            );
          })}
        </div>
        <textarea rows={2} value={refundCustom} onChange={e => handleRefundCustom(e.target.value)}
          placeholder="Additional details, deferral windows, exceptions…" className={textareaCls} />
      </Field>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 4 — MEDIA & DESCRIPTION
   ══════════════════════════════════════════════════════════════ */
const MAX_GALLERY_PHOTOS = 8;

function GalleryThumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative aspect-square rounded-md overflow-hidden border border-dark-lighter">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="w-full h-full object-cover" />
      <button type="button" onClick={onRemove}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-dark/70 text-muted hover:text-white flex items-center justify-center transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function GalleryFileThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    startTransition(() => setSrc(url));
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return src ? <GalleryThumb src={src} onRemove={onRemove} /> : null;
}

function MediaStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  const coverSrc = form.coverImage ? URL.createObjectURL(form.coverImage) : form.coverImageUrl;
  useEffect(() => () => { if (coverSrc?.startsWith("blob:")) URL.revokeObjectURL(coverSrc); }, [coverSrc]);

  const galleryCount = form.photoUrls.length + form.photos.length;
  const addGalleryFiles = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter(f => f.type.startsWith("image/"));
    const remaining = MAX_GALLERY_PHOTOS - galleryCount;
    if (files.length && remaining > 0) update({ photos: [...form.photos, ...files.slice(0, remaining)] });
  };

  return (
    <div>
      <Field label="Cover image" required>
        <label className="block cursor-pointer">
          {coverSrc ? (
            <div className="relative rounded-md overflow-hidden border border-primary/40 aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverSrc} alt="Cover preview" className="w-full h-full object-cover" />
              <button type="button" onClick={e => { e.preventDefault(); update({ coverImage: null, coverImageUrl: "" }); }}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-dark/70 text-muted hover:text-white flex items-center justify-center transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative rounded-md border-2 border-dashed border-dark-lighter hover:border-primary/40 bg-dark-light aspect-video flex flex-col items-center justify-center transition-colors">
              <Upload className="w-6 h-6 text-primary mb-2" />
              <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-light">Upload cover image</span>
              <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-1">JPG · PNG · WEBP · 1920×1080</span>
            </div>
          )}
          <input type="file" accept="image/*" className="sr-only"
            onChange={e => update({ coverImage: e.target.files?.[0] ?? null })} />
        </label>
      </Field>

      <Field label="Gallery photos" hint={`${galleryCount}/${MAX_GALLERY_PHOTOS} · Optional`}>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {form.photoUrls.map((url, i) => (
            <GalleryThumb key={url} src={url}
              onRemove={() => update({ photoUrls: form.photoUrls.filter((_, j) => j !== i) })} />
          ))}
          {form.photos.map((file, i) => (
            <GalleryFileThumb key={`${file.name}-${file.lastModified}-${i}`} file={file}
              onRemove={() => update({ photos: form.photos.filter((_, j) => j !== i) })} />
          ))}
          {galleryCount < MAX_GALLERY_PHOTOS && (
            <label className="aspect-square rounded-md border-2 border-dashed border-dark-lighter hover:border-primary/40 bg-dark-light flex flex-col items-center justify-center cursor-pointer transition-colors">
              <Plus className="w-5 h-5 text-primary mb-1" />
              <span className="font-headline text-[9px] font-bold uppercase tracking-widest text-muted">Add photos</span>
              <input type="file" accept="image/*" multiple className="sr-only"
                onChange={e => { addGalleryFiles(e.target.files); e.target.value = ""; }} />
            </label>
          )}
        </div>
        <p className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-2">
          Shown as a gallery on your event page — venue, atmosphere, past editions.
        </p>
      </Field>

      <Field label="Full description" required hint={`${stripHtml(form.description).length} chars`}>
        <RichTextEditor value={form.description} onChange={html => update({ description: html })} />
      </Field>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 5 — REVIEW
   ══════════════════════════════════════════════════════════════ */
const INTENSITY_LABELS: Record<string, string> = {
  low: "Low", moderate: "Moderate", high: "High", extreme: "Extreme",
};

function ReviewStep({ form, setStep, confirmed, onConfirm }: {
  form: FormState; setStep: (n: number) => void; confirmed: boolean; onConfirm: (v: boolean) => void;
}) {
  const rows: { k: string; v: string; step: number }[] = [
    { k: "Title",          v: form.title || "—",                                                                   step: 0 },
    { k: "Discipline",     v: form.discipline ? form.discipline.toUpperCase() : "—",                               step: 0 },
    { k: "Format",         v: form.format || "—",                                                                  step: 0 },
    { k: "Intensity",      v: form.level ? INTENSITY_LABELS[form.level] : "—",                                    step: 0 },
    { k: "Cap / Min age",  v: `${form.cap ? parseInt(form.cap).toLocaleString() : "—"} · ${form.minAge === "0" ? "Open to all" : form.minAge ? `${form.minAge}+` : "—"}`, step: 0 },
    { k: "Date",           v: form.date
        ? form.endDate && form.endDate !== form.date
          ? `${new Date(form.date + "T00:00:00").toLocaleDateString("en-AU", { day:"numeric", month:"short", year:"numeric" })} — ${new Date(form.endDate + "T00:00:00").toLocaleDateString("en-AU", { day:"numeric", month:"short", year:"numeric" })}`
          : new Date(form.date + "T00:00:00").toLocaleDateString("en-AU", { day:"numeric", month:"short", year:"numeric" })
        : "—",                                                                                                      step: 1 },
    { k: "Start / End",    v: form.startTime ? `${fmt24to12(form.startTime)}${form.endTime ? ` → ${fmt24to12(form.endTime)}` : ""}` : "—", step: 1 },
    { k: "Venue",          v: `${form.venue || "—"}, ${form.city || "—"}, ${form.state ? form.state.toUpperCase() : "—"}`, step: 1 },
    { k: "Tickets",        v: `${form.waves.length} categor${form.waves.length !== 1 ? "ies" : "y"}, from ${form.waves[0]?.price === "0" ? "Free" : form.waves[0]?.price ? `A$${form.waves[0].price}` : "—"}`, step: 2 },
    { k: "Registration",   v: form.registrationType === "startline" ? "Startline" : form.registrationUrl || "—",  step: 2 },
    { k: "Refund policy",  v: form.refundPolicy || "—",                                                            step: 2 },
    { k: "Prize money",    v: form.prizeMoney ? (normalisePrizeAmount(form.prizeMoneyAmount) ? `$${normalisePrizeAmount(form.prizeMoneyAmount)} prize pool` : "Yes") : "No", step: 2 },
    { k: "Cover image",    v: form.coverImage || form.coverImageUrl ? "Uploaded" : "No image",                    step: 3 },
    { k: "Gallery",        v: (() => { const n = form.photoUrls.length + form.photos.length; return n ? `${n} photo${n !== 1 ? "s" : ""}` : "None"; })(), step: 3 },
    { k: "Description",    v: form.description ? `${stripHtml(form.description).slice(0, 60)}…` : "—", step: 3 },
  ];

  return (
    <div>
      <div className="bg-dark border border-dark-lighter rounded-lg overflow-hidden mb-6">
        {rows.map((r, i) => (
          <div key={r.k} className={`flex items-center gap-4 px-5 py-4 ${i === rows.length - 1 ? "" : "border-b border-white/5"}`}>
            <div className="font-headline text-[11px] uppercase tracking-widest text-muted w-32 flex-shrink-0">{r.k}</div>
            <div className="flex-1 font-headline text-[14px] text-light truncate">{r.v}</div>
            <button onClick={() => setStep(r.step)}
              className="font-headline text-[11px] uppercase tracking-widest text-muted-dark hover:text-primary flex items-center gap-1 transition-colors">
              Edit <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="bg-primary/5 border border-primary/30 rounded-md p-5 mb-6">
        <div className="font-headline text-[14px] font-black italic tracking-tighter text-light mb-1">Your listing is ready to publish.</div>
        <p className="font-headline text-[13px] text-muted leading-relaxed">
          Once published, athletes will be able to find your event in search and carousels.
          You&apos;ll receive a notification each time someone registers.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={confirmed} onChange={e => onConfirm(e.target.checked)}
          className="accent-primary w-4 h-4 mt-1 cursor-pointer" />
        <span className="font-headline text-[13px] text-muted leading-relaxed">
          I confirm I have the rights to host this event and the information provided is accurate.
          I agree to the{" "}
          <span className="text-primary hover:underline cursor-pointer">Organiser Terms</span> and{" "}
          <span className="text-primary hover:underline cursor-pointer">Event Listing Policy</span>.
        </span>
      </label>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LIVE PREVIEW SIDEBAR
   ══════════════════════════════════════════════════════════════ */
const DISC_LABEL: Record<string, string> = {
  crossfit: "CrossFit", running: "Running", hybrid: "Hybrid",
  cycling: "Cycling", swimming: "Swimming", other: "Other",
};
const MONTHS_SHORT = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&[^;\s]+;/g, " ").replace(/\s+/g, " ").trim();

function LivePreview({ form }: { form: FormState }) {
  const sp    = (form.date || "").split("-");
  const sDay  = sp[2] || null;
  const sMon  = sp[1] ? MONTHS_SHORT[parseInt(sp[1]) - 1] : null;
  const price = form.waves.find(w => w.price === "0" || !!w.price)?.price;
  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = form.coverImage ? URL.createObjectURL(form.coverImage) : form.coverImageUrl || null;
    startTransition(() => setCoverSrc(url));
    return () => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [form.coverImage, form.coverImageUrl]);
  const descriptionText = stripHtml(form.description || "");

  return (
    <div>
      <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary/70 block mb-4">
        Live preview
      </span>

      {/* Card — matches HomeEventCard */}
      <div className="bg-dark border border-dark-lighter rounded-2xl overflow-hidden">

        {/* Image */}
        <div className="relative w-full aspect-video overflow-hidden rounded-t-2xl">
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverSrc}
              alt=""
              className="absolute inset-0 w-full h-full object-cover brightness-[0.55]"
            />
          ) : (
            <div className="absolute inset-0 placeholder-stripes scan-grid" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-dark/60 via-transparent to-transparent" />

          {/* DRAFT badge */}
          <div className="absolute top-3 left-3">
            <span className="font-headline text-[10px] font-medium uppercase tracking-widest bg-primary text-dark px-2.5 py-1 rounded-full">
              Draft
            </span>
          </div>

          {/* Date badge */}
          {sDay && sMon && (
            <div className="absolute top-3 right-3 bg-dark-light/90 backdrop-blur-sm rounded-lg px-3 py-2 text-center leading-tight">
              <span className="block font-headline text-[9px] font-bold uppercase tracking-widest text-muted">{sMon}</span>
              <span className="block font-headline text-xl font-black text-light leading-none mt-0.5">{sDay}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {form.discipline && (
            <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
              {DISC_LABEL[form.discipline]}
            </span>
          )}
          <h3 className="font-headline text-lg sm:text-xl font-black italic tracking-tighter text-light leading-tight mb-3 line-clamp-2">
            {form.title || <span className="text-muted/40">Event title...</span>}
          </h3>

          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-2 font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
              <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
              <span className="truncate">
                {form.city || form.state
                  ? [form.city, form.state ? form.state.toUpperCase() : ""].filter(Boolean).join(", ")
                  : "Venue TBC"}
              </span>
            </div>
            <div className="flex items-center gap-2 font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
              <Clock className="w-3 h-3 text-primary flex-shrink-0" />
              <span>{form.startTime ? fmt24to12(form.startTime) : "Time TBC"}</span>
            </div>
            {form.format && (
              <div className="flex items-center gap-2 font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
                <Users className="w-3 h-3 text-primary flex-shrink-0" />
                <span>
                  {form.format === "both"        ? "Individual & Team"
                  : form.format === "individual"  ? "Individual"
                  :                                "Team"}
                </span>
              </div>
            )}
          </div>

          {descriptionText && (
            <p className="font-headline text-xs text-muted leading-relaxed line-clamp-2 mb-3">
              {descriptionText}
            </p>
          )}

          {(price === "0" || !!price) && (
            <span className="font-headline text-sm font-bold text-primary">
              {price === "0" ? "Free" : `From $${price}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FULL EVENT PAGE PREVIEW
   ══════════════════════════════════════════════════════════════ */
const FORMAT_LABELS_PREVIEW: Record<string, string> = {
  individual: "Individual", team: "Team / Pairs", both: "Individual & Team",
};

function EventFullPreview({ form, onClose }: { form: FormState; onClose: () => void }) {
  const discipline  = DISC_LABEL[form.discipline] || "";
  const stateLabel  = form.state ? form.state.toUpperCase() : "";
  const formatLabel = FORMAT_LABELS_PREVIEW[form.format] || "—";
  const intensity   = form.level ? INTENSITY_LABELS[form.level] : "—";

  // Mirrors formatEventDate / formatEventDateRange on the public event page.
  const dateLabel = (() => {
    if (!form.date) return "Date TBC";
    const s = new Date(form.date + "T00:00:00");
    if (form.endDate && form.endDate !== form.date) {
      const e = new Date(form.endDate + "T00:00:00");
      if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
        return `${s.getDate()}–${e.getDate()} ${e.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}`;
      }
      return `${s.toLocaleDateString("en-AU", { day: "numeric", month: "long" })} — ${e.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}`;
    }
    return s.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  })();

  const today = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  })();
  const drops = form.waves
    .filter(w => w.price === "0" || !!w.price)
    .map(w => ({ ...w, isClosed: !!w.closes && w.closes < today }));
  const fmtCloseDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = form.coverImage ? URL.createObjectURL(form.coverImage) : form.coverImageUrl;
    startTransition(() => setCoverSrc(url || null));
    return () => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [form.coverImage, form.coverImageUrl]);

  const [photoSrcs, setPhotoSrcs] = useState<string[]>([]);
  useEffect(() => {
    const urls = form.photos.map(f => URL.createObjectURL(f));
    startTransition(() => setPhotoSrcs(urls));
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [form.photos]);
  const gallery = [...form.photoUrls, ...photoSrcs];

  const prizeAmount = form.prizeMoney ? normalisePrizeAmount(form.prizeMoneyAmount) : "";
  const cap = form.cap ? parseInt(form.cap) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overlay-in">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex flex-col w-full h-full overflow-hidden modal-in">
        <div className="relative z-10 flex items-center justify-between px-5 py-3 bg-dark-darker/95 backdrop-blur border-b border-dark-lighter shrink-0">
          <div className="flex items-center gap-3">
            <Eye className="w-4 h-4 text-primary" />
            <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary">Athlete view preview</span>
            <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark hidden sm:block">— This is how your listing will appear to athletes</span>
          </div>
          <button onClick={onClose}
            className="flex items-center gap-2 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light transition-colors">
            <X className="w-4 h-4" /> Close preview
          </button>
        </div>

        <div className="relative flex-1 overflow-y-auto bg-dark-darker">

          {/* ── Banner — mirrors the public event page ── */}
          <div className="relative overflow-hidden w-full" style={{ aspectRatio: "4/3", maxHeight: "420px" }}>
            {coverSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 placeholder-stripes scan-grid" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-dark-darker/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-5">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {discipline && (
                  <span className="inline-block font-headline text-[10px] font-bold uppercase tracking-widest bg-primary text-dark px-3 py-1 rounded-full">
                    {discipline}
                  </span>
                )}
                <span className="inline-block font-headline text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/40 px-2.5 py-1 rounded-full">
                  Draft
                </span>
              </div>
              <h1 className="font-headline text-[28px] sm:text-4xl lg:text-5xl font-black italic tracking-tighter text-light leading-tight mb-2">
                {form.title || "Your event title"}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5 font-headline text-xs font-medium uppercase tracking-widest text-muted">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  {form.venue || form.city || "Venue TBC"}{stateLabel ? `, ${stateLabel}` : ""}
                </span>
                <span className="flex items-center gap-1.5 font-headline text-xs font-medium uppercase tracking-widest text-muted">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  {dateLabel}
                </span>
              </div>
            </div>
          </div>

          <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

              {/* ── Main content ── */}
              <div className="order-2 lg:order-none lg:col-span-2 space-y-6 sm:space-y-8">

                <div>
                  <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-3">Event Overview</h2>
                  {form.description ? (
                    <div
                      className="text-sm font-medium text-muted leading-relaxed
                        [&_h3]:font-headline [&_h3]:font-black [&_h3]:text-base [&_h3]:text-light [&_h3]:mt-4 [&_h3]:mb-1
                        [&_h4]:font-headline [&_h4]:font-bold [&_h4]:text-sm [&_h4]:text-light [&_h4]:mt-3 [&_h4]:mb-1
                        [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_li]:mb-0.5"
                      dangerouslySetInnerHTML={{ __html: form.description }}
                    />
                  ) : (
                    <p className="text-sm font-medium text-muted-dark italic">Full description will appear here.</p>
                  )}
                </div>

                {prizeAmount && (
                  <div className="bg-dark rounded-xl px-5 sm:px-6 py-5 flex items-center gap-4">
                    <Trophy className="w-7 h-7 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-headline text-xl font-black text-primary leading-tight">
                        ${prizeAmount} prize pool
                      </p>
                      {form.prizeMoneyDetails.trim() && (
                        <p className="font-headline text-[11px] font-medium uppercase tracking-widest text-muted mt-1">
                          {form.prizeMoneyDetails.trim()}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {drops.length > 0 && (
                  <div>
                    <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-3">Pricing</h2>
                    <div className="space-y-2">
                      {drops.map((w, i) => (
                        <div key={i} className={`flex items-center justify-between bg-dark rounded-xl px-4 sm:px-6 py-4 ${w.isClosed ? "opacity-50" : ""}`}>
                          <div>
                            <p className="font-headline text-sm font-bold text-light flex items-center gap-2 flex-wrap">
                              {w.label || "General admission"}
                              {w.isClosed && (
                                <span className="font-headline text-[9px] font-bold uppercase tracking-widest text-muted border border-dark-lighter px-2 py-0.5 rounded-full">
                                  Closed
                                </span>
                              )}
                            </p>
                            {w.startTime && (
                              <p className="font-headline text-xs text-muted uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Wave start {fmt24to12(w.startTime)}
                              </p>
                            )}
                            {w.closes && (
                              <p className="font-headline text-xs text-muted uppercase tracking-widest mt-0.5">
                                {w.isClosed ? "Closed" : "Closes"} {fmtCloseDate(w.closes)}
                              </p>
                            )}
                          </div>
                          <span className={`font-headline text-2xl font-black italic ${w.isClosed ? "text-muted line-through" : "text-primary"}`}>
                            {w.price === "0" ? "Free" : `$${w.price}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {gallery.length > 0 && (
                  <div>
                    <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-3">Gallery</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                      {gallery.map((src, i) => (
                        <div key={i} className="relative aspect-video rounded-xl overflow-hidden bg-dark">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* ── Sidebar: CTAs + details ── */}
              <div className="order-1 lg:order-none space-y-4">
                <div className="flex flex-col gap-3">
                  <span className="w-full flex items-center justify-center gap-2 bg-machined shadow-machined text-dark font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md cursor-default">
                    Register Now
                    {form.registrationType === "external" ? <ExternalLink className="w-4 h-4" /> : <Ticket className="w-4 h-4" />}
                  </span>
                  <span className="w-full flex items-center justify-center gap-2 border border-dark-lighter text-light font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md cursor-default">
                    <MapPin className="w-4 h-4" />
                    View on Maps
                  </span>
                </div>

                <div className="bg-dark rounded-xl p-5 sm:p-6">
                  <h3 className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-4">Event Details</h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Date</p>
                      <p className="font-headline text-base font-black italic text-light">{dateLabel}</p>
                    </div>
                    <div>
                      <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Time</p>
                      <p className="font-headline text-base font-black italic text-light">
                        {form.startTime ? fmt24to12(form.startTime) : "TBC"}
                        {form.endTime && ` — ${fmt24to12(form.endTime)}`}
                      </p>
                    </div>
                    <div>
                      <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Location</p>
                      <p className="font-headline text-base font-black italic text-light">{form.venue || "Venue TBC"}</p>
                      {form.address && (
                        <p className="font-headline text-xs text-muted uppercase tracking-widest mt-0.5">{form.address}</p>
                      )}
                      {form.city && (
                        <p className="font-headline text-xs text-muted uppercase tracking-widest mt-0.5">{form.city}{stateLabel ? `, ${stateLabel}` : ""}</p>
                      )}
                    </div>
                    <div>
                      <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Format</p>
                      <p className="font-headline text-base font-black italic text-light">{formatLabel}</p>
                    </div>
                    {form.categories.length > 0 && (
                      <div>
                        <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-1">Divisions</p>
                        <div className="flex flex-wrap gap-1.5">
                          {form.categories.map(c => (
                            <span key={c} className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/30 bg-primary/10 px-2 py-1 rounded-md">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Intensity</p>
                      <p className="font-headline text-base font-black italic text-light">{intensity}</p>
                    </div>
                    {(cap || form.minAge !== "") && (
                      <div className="grid grid-cols-2 gap-3">
                        {cap != null && cap > 0 && (
                          <div>
                            <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Participant Cap</p>
                            <p className="font-headline text-base font-black italic text-light">{cap.toLocaleString()}</p>
                          </div>
                        )}
                        {form.minAge !== "" && (
                          <div>
                            <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Minimum Age</p>
                            <p className="font-headline text-base font-black italic text-light">
                              {form.minAge === "0" ? "All ages" : `${form.minAge}+`}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {form.refundPolicy.trim() && (
                  <div className="bg-dark rounded-xl p-5 sm:p-6">
                    <h3 className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2">Refund &amp; Transfer Policy</h3>
                    <p className="text-sm font-medium text-muted leading-relaxed">{form.refundPolicy}</p>
                  </div>
                )}
              </div>

            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN WIZARD PAGE
   ══════════════════════════════════════════════════════════════ */
export default function NewListingPage() {
  const router = useRouter();
  const [step,            setStep]            = useState(0);
  const [form,            setForm]            = useState<FormState>(INITIAL);
  const [loadingEvent,    setLoadingEvent]    = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [apiError,        setApiError]        = useState("");
  const [submitErrors,    setSubmitErrors]    = useState<number[]>([]);
  const [visited,         setVisited]         = useState<Set<number>>(new Set());
  const [confirmed,       setConfirmed]       = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [direction,       setDirection]       = useState<"forward" | "back">("forward");
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [eventId,         setEventId]         = useState<string | null>(null);
  const originalFields = useRef<Record<string, unknown>>({});

  const update = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    fetch(`/api/organiser/events/${id}`)
      .then(r => r.json())
      .then(e => {
        if (e.error) return;
        setEventId(id);
        originalFields.current = { inclusions: e.inclusions, activations: e.activations, accessibilityInfo: e.accessibilityInfo };
        setForm({
          title:             e.title          ?? "",
          discipline:        e.discipline     ?? "",
          description:       e.description    ?? "",
          format:            e.format         ?? "",
          level:             e.level          ?? "",
          categories:        Array.isArray(e.categories) ? e.categories : [],
          cap:               e.cap != null    ? String(e.cap)    : "",
          minAge:            e.minAge != null ? String(e.minAge) : "",
          date:              e.eventDate      ?? "",
          endDate:           e.endDate        ?? "",
          startTime:         e.startTime      ?? "",
          endTime:           e.endTime        ?? "",
          venue:             e.venue          ?? "",
          address:           e.address        ?? "",
          city:              e.city           ?? "",
          state:             e.state          ?? "",
          latitude:          e.latitude       ?? null,
          longitude:         e.longitude      ?? null,
          waves:             Array.isArray(e.waves) && e.waves.length
            ? e.waves.map((w: Wave) => ({ label: w.label ?? "", price: w.price ?? "", closes: w.closes ?? "", startTime: w.startTime ?? "" }))
            : [{ label: "", price: "", closes: "", startTime: "" }],
          prizeMoney:        !!parsePrizePool(e.extras),
          prizeMoneyAmount:  parsePrizePool(e.extras)?.amount ?? "",
          prizeMoneyDetails: parsePrizePool(e.extras)?.details ?? "",
          refundPolicy:      e.refundPolicy   ?? "",
          registrationType:  e.registrationType === "external" ? "external" : "startline",
          feeStructure:      e.feeStructure   === "organiser"  ? "organiser" : "athlete",
          registrationUrl:   e.registrationUrl   ?? "",
          coverImage:        null,
          coverImageUrl:     e.coverImageUrl  ?? "",
          photos:            [],
          photoUrls:         Array.isArray(e.photos) ? e.photos.filter((p: unknown): p is string => typeof p === "string") : [],
        });
      })
      .catch(() => {})
      .finally(() => setLoadingEvent(false));
  }, []);

  const stepHasErrors = (s: number): boolean => {
    if (s === 0) {
      const hasCatRequirement = !!DISCIPLINE_CATS[form.discipline as Discipline];
      return !(
        form.title.trim().length > 2 &&
        form.format &&
        form.discipline &&
        form.level &&
        form.cap !== "" &&
        form.minAge !== "" &&
        (!hasCatRequirement || form.categories.length > 0)
      );
    }
    if (s === 1) return !(form.date && form.startTime && form.address.trim() && form.city.trim() && form.state);
    if (s === 2) return !(
      form.waves.length > 0 &&
      (form.waves[0]?.price === "0" || !!form.waves[0]?.price) &&
      (form.registrationType === "startline" || !!form.registrationUrl.trim()) &&
      !!form.refundPolicy.trim()
    );
    if (s === 3) return !((form.coverImage || form.coverImageUrl) && stripHtml(form.description).length > 0);
    if (s === 4) return !confirmed;
    return false;
  };

  const goTo = (target: number) => {
    setVisited(prev => new Set([...prev, step]));
    setDirection(target > step ? "forward" : "back");
    if (target !== STEPS.length - 1) setConfirmed(false);
    setStep(target);
  };

  const submitToApi = async (asDraft: boolean, overrideTitle?: string): Promise<boolean> => {
    setSaving(true); setApiError(""); setSubmitErrors([]);
    try {
      let coverImageUrl: string | null = null;
      if (form.coverImage) {
        const fd = new FormData();
        fd.append("file", form.coverImage);
        fd.append("type", "cover");
        const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
        if (!uploadRes.ok) { setApiError("Cover image upload failed. Please try again or remove the image."); return false; }
        const { fileUrl } = await uploadRes.json(); coverImageUrl = fileUrl;
      }

      const photoUrls: string[] = [...form.photoUrls];
      for (const photo of form.photos) {
        const fd = new FormData();
        fd.append("file", photo);
        fd.append("type", "photo");
        const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
        if (!uploadRes.ok) { setApiError(`Gallery photo "${photo.name}" failed to upload. Please try again or remove it.`); return false; }
        const { fileUrl } = await uploadRes.json(); photoUrls.push(fileUrl);
      }

      const payload = {
        title:             overrideTitle ?? form.title,
        discipline:        form.discipline,
        description:       form.description,
        eventDate:         form.date,
        endDate:           form.endDate || null,
        startTime:         form.startTime,
        endTime:           form.endTime,
        venue:             form.venue,
        address:           form.address,
        city:              form.city,
        state:             form.state,
        latitude:          form.latitude,
        longitude:         form.longitude,
        format:            form.format,
        level:             form.level,
        categories:        form.categories,
        cap:               form.cap ? parseInt(form.cap) : null,
        minAge:            form.minAge ? parseInt(form.minAge) : null,
        waves:             form.waves,
        inclusions:        originalFields.current.inclusions ?? null,
        activations:       originalFields.current.activations ?? null,
        extras:            form.prizeMoney ? encodePrizePool(form.prizeMoneyAmount, form.prizeMoneyDetails) : (originalFields.current.extras ?? null),
        refundPolicy:      form.refundPolicy,
        registrationType:  form.registrationType,
        feeStructure:      form.feeStructure,
        registrationUrl:   form.registrationType === "external" ? form.registrationUrl : null,
        accessibilityInfo: originalFields.current.accessibilityInfo ?? null,
        submit:            !asDraft,
        coverImageUrl:     coverImageUrl ?? form.coverImageUrl ?? null,
        photos:            photoUrls,
      };

      let res: Response;
      if (eventId) {
        res = await fetch(`/api/organiser/events/${eventId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        res = await fetch("/api/organiser/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setApiError(data.error ?? "Something went wrong."); return false; }
      if (asDraft && !eventId && data.id) setEventId(data.id);
      router.push("/organiser/dashboard");
      return true;
    } catch {
      setApiError("Something went wrong. Please check your connection and try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) { goTo(step + 1); }
    else {
      const errs = Array.from({ length: STEPS.length }, (_, i) => i).filter(i => stepHasErrors(i));
      if (errs.length > 0) { setVisited(new Set(Array.from({ length: STEPS.length }, (_, i) => i))); setSubmitErrors(errs); return; }
      submitToApi(false);
    }
  };
  const prev = () => {
    if (step > 0) { setVisited(s => new Set([...s, step])); setDirection("back"); setStep(step - 1); }
    else { setShowCancelModal(true); }
  };

  const STEP_HEADINGS = [
    { h: <>Let&apos;s start with<br /><span className="text-primary">the basics.</span></>, sub: "Name, format, discipline and intensity — the essentials every athlete will see first." },
    { h: <>When and where<br /><span className="text-primary">do athletes race?</span></>, sub: "Athletes search by city, state and date. If your event uses waves, per-wave start times are set in the next step." },
    { h: <>Tickets, pricing<br /><span className="text-primary">and registration.</span></>, sub: "Add ticket categories and pricing. You can set individual wave start times per category." },
    { h: <>Images and<br /><span className="text-primary">event description.</span></>, sub: "Upload your cover image and write a compelling event description." },
    { h: <>Review, then<br /><span className="text-primary">hit publish.</span></>, sub: "Nothing's live yet. You can always come back to edit after publishing." },
  ];

  return (
    <div className="min-h-screen bg-dark-darker">
      <div className="anim-fade-slide">

          {/* Sticky header */}
          <div className="sticky top-16 z-30 bg-dark/95 backdrop-blur border-b border-dark-lighter">
            <div className="max-w-[1280px] mx-auto px-6 lg:px-8 pt-3 pb-3">
              {/* Breadcrumb */}
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setShowCancelModal(true)}
                  className="flex items-center gap-1.5 text-muted hover:text-primary font-headline text-[11px] uppercase tracking-widest transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Event Listings
                </button>
                <span className="font-headline text-muted-dark">/</span>
                <span className="font-headline text-[11px] uppercase tracking-widest text-light">Create new listing</span>
                <div className="ml-auto flex items-center gap-3">
                  <button onClick={() => setShowFullPreview(true)}
                    className="flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors">
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                </div>
              </div>

              {/* Step rail */}
              <div className="flex items-center gap-0 overflow-x-auto no-scrollbar -mx-2 px-2">
                {STEPS.map((s, i) => {
                  const done   = visited.has(i) && !stepHasErrors(i) && i !== step;
                  const cur    = i === step;
                  const hasErr = visited.has(i) && stepHasErrors(i) && !cur;
                  return (
                    <div key={s.k} className="flex items-center flex-1 min-w-0">
                      <button onClick={() => goTo(i)}
                        className={`flex items-center gap-2.5 text-left transition-opacity min-w-0 ${cur ? "opacity-100" : "opacity-70 hover:opacity-100"}`}>
                        <div className={`relative w-8 h-8 rounded-md border flex items-center justify-center font-headline font-black italic text-[13px] flex-shrink-0
                          ${cur ? "bg-primary text-dark border-primary" : hasErr ? "bg-orange-400/10 text-orange-400 border-orange-400/40" : done ? "bg-dark-light text-primary border-primary/40" : "bg-dark border-dark-lighter text-muted-dark"}`}>
                          {hasErr ? <span className="text-[15px] leading-none font-black">!</span> : done ? <Check className="w-4 h-4" /> : s.n}
                        </div>
                        <div className="hidden xl:block min-w-0">
                          <div className={`font-headline text-[11px] font-bold uppercase tracking-widest truncate ${cur ? "text-light" : hasErr ? "text-orange-500" : "text-muted"}`}>
                            {s.label}
                          </div>
                          <div className={`font-headline text-[10px] uppercase tracking-widest truncate ${hasErr ? "text-orange-400" : "text-muted-dark"}`}>
                            {hasErr ? "Missing required fields" : s.sub}
                          </div>
                        </div>
                      </button>
                      {i < STEPS.length - 1 && <div className="flex-1 h-px mx-3 bg-dark-lighter" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="max-w-[1280px] mx-auto grid lg:grid-cols-[1fr_360px]">
            <div className="p-4 sm:p-6 lg:p-8 pb-32 lg:pb-10">
              <div key={step} className={direction === "forward" ? "step-forward" : "step-back"}>
                <div className="mb-6">
                  <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-2">
                    STEP {STEPS[step].n} / {STEPS[STEPS.length - 1].n}
                  </div>
                  <h1 className="font-headline text-[28px] sm:text-[38px] font-black italic tracking-tighter leading-tight text-light">
                    {STEP_HEADINGS[step].h}
                  </h1>
                  <p className="font-headline text-muted mt-3 max-w-lg text-[14px]">{STEP_HEADINGS[step].sub}</p>
                </div>

                {step === 0 && <BasicsStep  form={form} update={update} />}
                {step === 1 && <WhenStep    form={form} update={update} />}
                {step === 2 && <TicketsStep form={form} update={update} />}
                {step === 3 && <MediaStep   key={loadingEvent ? "loading" : (eventId ?? "new")} form={form} update={update} />}
                {step === 4 && <ReviewStep  form={form} setStep={goTo} confirmed={confirmed} onConfirm={setConfirmed} />}

                {apiError && (
                  <div className="mt-4 px-4 py-3 rounded-md bg-red-400/10 border border-red-400/20 text-red-300 font-headline text-[13px]">
                    {apiError}
                  </div>
                )}

                {submitErrors.length > 0 && (
                  <div className="mt-5 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
                    <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-3 flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[11px] font-black">!</span>
                      Before you can submit, please complete the following:
                    </p>
                    <ul className="space-y-2.5">
                      {submitErrors.map(i => (
                        <li key={i} className="flex items-start justify-between gap-4 py-2.5 px-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                          <div>
                            <p className="font-headline text-[12px] font-bold uppercase tracking-widest text-orange-600">{STEPS[i].n} — {STEPS[i].label}</p>
                            <p className="font-headline text-orange-500 text-[12px] mt-0.5">{STEP_ERRORS[i]}</p>
                          </div>
                          <button onClick={() => { setSubmitErrors([]); goTo(i); }}
                            className="shrink-0 font-headline text-[11px] font-bold uppercase tracking-widest text-orange-500 hover:text-orange-700 flex items-center gap-1 transition-colors mt-0.5">
                            Fix now <ArrowRight className="w-3 h-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Mobile preview toggle */}
              <div className="lg:hidden mt-8 rounded-xl border border-dark-lighter overflow-hidden">
                <button type="button" onClick={() => setShowMobilePreview(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 bg-dark-light text-left">
                  <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary">Event preview</span>
                  <ChevronDown className={`w-4 h-4 text-muted transition-transform duration-200 ${showMobilePreview ? "rotate-180" : ""}`} />
                </button>
                {showMobilePreview && (
                  <div className="p-5 pt-0 bg-dark-light border-t border-dark-lighter"><LivePreview form={form} /></div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between pt-5 border-t border-dark-lighter">
                <button onClick={prev}
                  className="font-headline text-[13px] font-bold uppercase tracking-widest text-muted hover:text-light flex items-center gap-2 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> {step === 0 ? "Cancel" : "Back"}
                </button>
                <div className="flex items-center gap-3">
                  <button onClick={() => submitToApi(true, form.title.trim() || "Untitled draft")} disabled={saving}
                    className="font-headline text-[13px] font-bold uppercase tracking-widest text-muted hover:text-light px-5 py-3 transition-colors disabled:opacity-40">
                    Save draft
                  </button>
                  <button onClick={next} disabled={saving || (step === STEPS.length - 1 && !confirmed)}
                    className="bg-machined shadow-machined disabled:opacity-40 disabled:cursor-not-allowed text-dark font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md flex items-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform">
                    {saving
                      ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Saving…</>
                      : step === STEPS.length - 1
                        ? <><Check className="w-4 h-4" /> Publish listing</>
                        : <>Continue <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            </div>

            {/* Live preview sidebar */}
            <aside className="hidden lg:block border-l border-dark-lighter bg-dark p-6 sticky top-[152px] h-[calc(100vh-152px)] overflow-y-auto">
              <LivePreview form={form} />
            </aside>
          </div>
      </div>

      {showFullPreview && <EventFullPreview form={form} onClose={() => setShowFullPreview(false)} />}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-in">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCancelModal(false)} />
          <div className="relative bg-dark border border-dark-lighter rounded-2xl shadow-2xl w-full max-w-sm p-7 modal-in">
            <h2 className="font-headline text-[22px] font-black italic tracking-tight text-light mb-2">Leave without saving?</h2>
            <p className="font-headline text-muted text-[14px] leading-relaxed mb-7">
              Your event details haven&apos;t been saved yet. Save as a draft so you can come back and finish it later.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={async () => { await submitToApi(true, form.title.trim() || "Untitled draft"); setShowCancelModal(false); }}
                disabled={saving}
                className="w-full font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {saving ? "Saving…" : <><Check className="w-4 h-4" /> Save draft &amp; leave</>}
              </button>
              <button onClick={() => router.push("/organiser/dashboard")}
                className="w-full font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md border border-dark-lighter text-muted hover:text-light hover:border-primary/40 transition-colors">
                Discard &amp; leave
              </button>
              <button onClick={() => setShowCancelModal(false)}
                className="font-headline text-[12px] uppercase tracking-widest text-muted-dark hover:text-light transition-colors text-center py-1">
                Keep editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
