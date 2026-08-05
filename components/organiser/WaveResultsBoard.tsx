"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search, Users, Pencil } from "lucide-react";
import { formatFinishMinutes } from "@/lib/registration-form";

/** Wave start times: HH:MM AM/PM (zero-padded), matching the design playbook. */
function formatWaveStartTime(timeString: string): string {
  const [hours, minutes = "00"] = timeString.split(":");
  const hour = parseInt(hours, 10);
  if (Number.isNaN(hour)) return timeString;
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${minutes.slice(0, 2)} ${ampm}`;
}

function waveRuleParts(w: ResultsWave): string[] {
  const parts: string[] = [];
  if (w.finishMin != null || w.finishMax != null) {
    const min = w.finishMin != null ? formatFinishMinutes(w.finishMin) : null;
    const max = w.finishMax != null ? formatFinishMinutes(w.finishMax) : null;
    if (min && max) parts.push(`Finish ${min}-${max}`);
    else if (min) parts.push(`Finish ${min}+`);
    else if (max) parts.push(`Finish ≤${max}`);
  }
  if (w.genders && w.genders.length > 0) parts.push(w.genders.join(" / "));
  if (w.ageMin != null || w.ageMax != null) {
    if (w.ageMin != null && w.ageMax != null) parts.push(`Age ${w.ageMin}-${w.ageMax}`);
    else if (w.ageMin != null) parts.push(`Age ${w.ageMin}+`);
    else parts.push(`Age ≤${w.ageMax}`);
  }
  return parts;
}

export interface ResultsWave {
  id: string;
  label: string;
  startTime?: string;
  finishMin?: number | null;
  finishMax?: number | null;
  genders?: string[];
  ageMin?: number | null;
  ageMax?: number | null;
}

export interface ResultsAthlete {
  id: string;
  name: string;
  email: string;
  waveId: string | null;
  bibNumber: string | null;
  category: string | null;
  resultTime: string | null;
  resultPlacement: string | null;
}

interface Props {
  waves: ResultsWave[];
  athletes: ResultsAthlete[];
  onEditResult: (athleteId: string) => void;
}

const UNASSIGNED = "__unassigned__";
const PAGE = 40;

export default function WaveResultsBoard({ waves, athletes, onEditResult }: Props) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([...waves.map((w) => w.id), UNASSIGNED]),
  );
  const [shown, setShown] = useState<Record<string, number>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.bibNumber ?? "").toLowerCase().includes(q),
    );
  }, [athletes, query]);

  const byWave = useMemo(() => {
    const map = new Map<string, ResultsAthlete[]>();
    for (const w of waves) map.set(w.id, []);
    map.set(UNASSIGNED, []);
    for (const a of filtered) {
      const key = a.waveId && map.has(a.waveId) ? a.waveId : UNASSIGNED;
      map.get(key)!.push(a);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const bibA = parseInt(a.bibNumber ?? "", 10);
        const bibB = parseInt(b.bibNumber ?? "", 10);
        const aOk = Number.isFinite(bibA);
        const bOk = Number.isFinite(bibB);
        if (aOk && bOk && bibA !== bibB) return bibA - bibB;
        if (aOk !== bOk) return aOk ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }
    return map;
  }, [filtered, waves]);

  const toggleExpand = (waveId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(waveId)) next.delete(waveId);
      else next.add(waveId);
      return next;
    });
  };

  const renderAthleteRow = (a: ResultsAthlete) => {
    const hasResult = Boolean(a.resultTime || a.resultPlacement);
    const cell =
      "shrink-0 font-headline text-[12px] sm:text-[13px] truncate";
    return (
      <div
        key={a.id}
        className="flex items-center gap-2 sm:gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.03] group"
      >
        <span className="min-w-0 flex-1">
          <span className="font-headline text-[13.5px] font-bold text-white/90 truncate block">
            {a.name}
          </span>
          <span className="block text-[11px] text-muted-dark truncate mt-0.5">{a.email}</span>
        </span>
        <span
          className={`shrink-0 w-12 text-right font-headline text-[13px] font-black italic ${
            a.bibNumber ? "text-light" : "text-muted-dark"
          }`}
        >
          {a.bibNumber ? `#${a.bibNumber}` : "-"}
        </span>
        <span className={`${cell} w-[88px] sm:w-[110px] ${a.category ? "text-white/80" : "text-muted-dark"}`}>
          {a.category || "-"}
        </span>
        <span className={`${cell} w-14 sm:w-16 ${a.resultTime ? "text-white/80" : "text-muted-dark"}`}>
          {a.resultTime || "-"}
        </span>
        <span className={`${cell} w-16 sm:w-24 ${a.resultPlacement ? "text-white/80" : "text-muted-dark"}`}>
          {a.resultPlacement || "-"}
        </span>
        <button
          type="button"
          onClick={() => onEditResult(a.id)}
          aria-label={hasResult ? `Edit result for ${a.name}` : `Add result for ${a.name}`}
          className="shrink-0 p-1.5 text-muted-dark hover:text-primary transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const renderWaveGroup = (
    waveId: string,
    label: string,
    startTime: string | undefined,
    ruleParts: string[] = [],
  ) => {
    const list = byWave.get(waveId) ?? [];
    const isOpen = expanded.has(waveId);
    const limit = shown[waveId] ?? PAGE;
    const visible = list.slice(0, limit);
    const withResults = list.filter((a) => a.resultTime || a.resultPlacement).length;
    const headerParts = [
      label,
      startTime ? formatWaveStartTime(startTime) : null,
      ...ruleParts,
    ].filter((p): p is string => Boolean(p));

    return (
      <div
        key={waveId}
        className="border border-dark-lighter rounded-xl overflow-hidden bg-dark"
      >
        <div className="flex items-start gap-2 sm:gap-3 px-3 py-3">
          <button
            type="button"
            onClick={() => toggleExpand(waveId)}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${label}`}
            className="shrink-0 mt-0.5 text-muted hover:text-primary transition-colors"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => toggleExpand(waveId)}
            className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-left"
          >
            {headerParts.map((part, i) => (
              <span
                key={`${part}-${i}`}
                className="font-headline text-[13px] sm:text-[14px] font-bold text-light"
              >
                {part}
              </span>
            ))}
          </button>
          <span className="shrink-0 mt-0.5 inline-flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-muted border border-dark-lighter rounded-full px-2.5 py-1">
            <Users className="w-3 h-3" />
            {list.length === 0
              ? "0"
              : withResults === list.length
                ? `${list.length}`
                : `${withResults}/${list.length}`}
          </span>
        </div>

        {isOpen && (
          <div className="px-1.5 pb-2 border-t border-white/5">
            {list.length === 0 ? (
              <p className="px-3 py-4 text-[12.5px] text-muted-dark">
                {waveId === UNASSIGNED ? "Everyone has a wave." : "No athletes in this wave yet."}
              </p>
            ) : (
              <>
                <div
                  className="flex items-center gap-2 sm:gap-3 px-2 pt-2 pb-1"
                  role="row"
                  aria-label="Column headers"
                >
                  <span className="min-w-0 flex-1 font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark">
                    Athlete
                  </span>
                  <span className="shrink-0 w-12 text-right font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark">
                    Bib
                  </span>
                  <span className="shrink-0 w-[88px] sm:w-[110px] font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark">
                    Division
                  </span>
                  <span className="shrink-0 w-14 sm:w-16 font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark">
                    Time
                  </span>
                  <span className="shrink-0 w-16 sm:w-24 font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark">
                    Placement
                  </span>
                  <span className="shrink-0 w-8" aria-hidden />
                </div>
                {visible.map(renderAthleteRow)}
                {list.length > limit && (
                  <button
                    type="button"
                    onClick={() => setShown((s) => ({ ...s, [waveId]: limit + PAGE }))}
                    className="mx-2 mt-1 mb-1 font-headline text-[11px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
                  >
                    Show more ({list.length - limit} left)
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any wave by name, email, or bib"
          className="w-full bg-dark border border-dark-lighter rounded-lg pl-10 pr-3 py-2.5 text-[14px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        {waves.map((w) =>
          renderWaveGroup(w.id, w.label, w.startTime, waveRuleParts(w)),
        )}
        {renderWaveGroup(UNASSIGNED, "Unassigned", undefined)}
      </div>
    </div>
  );
}
