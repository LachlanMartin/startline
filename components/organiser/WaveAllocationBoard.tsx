"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronRight, Search, Users, AlertTriangle, AlertCircle,
  ArrowRightLeft, X, Pencil, CheckSquare, Square, GripVertical,
} from "lucide-react";
import { animate } from "animejs";
import { Button } from "@/components/ui/button";
import FormSelect from "@/components/ui/FormSelect";
import { formatFinishMinutes } from "@/lib/registration-form";
import { capacityState, previewMove } from "@/lib/wave-capacity";

/** Wave start times: HH:MM AM/PM (zero-padded), matching the design playbook. */
function formatWaveStartTime(timeString: string): string {
  const [hours, minutes = "00"] = timeString.split(":");
  const hour = parseInt(hours, 10);
  if (Number.isNaN(hour)) return timeString;
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${minutes.slice(0, 2)} ${ampm}`;
}

/** Wave rule chips for the header; separate so they wrap cleanly on small screens. */
function waveRuleParts(w: BoardWave): string[] {
  const parts: string[] = [];
  if (w.finishMin != null || w.finishMax != null) {
    const min = w.finishMin != null ? formatFinishMinutes(w.finishMin) : null;
    const max = w.finishMax != null ? formatFinishMinutes(w.finishMax) : null;
    if (min && max) parts.push(`Finish ${min}-${max}`);
    else if (min) parts.push(`Finish ${min}+`);
    else if (max) parts.push(`Finish ≤${max}`);
  }
  if (w.genders && w.genders.length > 0) {
    parts.push(w.genders.join(" / "));
  }
  if (w.ageMin != null || w.ageMax != null) {
    if (w.ageMin != null && w.ageMax != null) parts.push(`Age ${w.ageMin}-${w.ageMax}`);
    else if (w.ageMin != null) parts.push(`Age ${w.ageMin}+`);
    else parts.push(`Age ≤${w.ageMax}`);
  }
  return parts;
}

export interface BoardWave {
  id: string;
  label: string;
  startTime?: string;
  capacity?: number | null;
  finishMin?: number | null;
  finishMax?: number | null;
  genders?: string[];
  ageMin?: number | null;
  ageMax?: number | null;
}

export interface BoardAthlete {
  id: string;
  name: string;
  email: string;
  waveId: string | null;
  bibNumber: string | null;
  medicalNotes: string | null;
  /** Estimated finish as "h:mm", when known. */
  finishLabel?: string | null;
  gender?: string | null;
  age?: number | null;
  /** Why auto-sort left them out of every wave (unassigned only). */
  unassignedReason?: string | null;
}

interface Props {
  waves: BoardWave[];
  /** Confirmed athletes only; waves are for paid, registered athletes. */
  athletes: BoardAthlete[];
  onEdit: (athleteId: string) => void;
  onMove: (
    ids: string[],
    destWaveId: string | null,
  ) => Promise<{ ok: boolean; overCapacity?: boolean; error?: string }>;
}

const UNASSIGNED = "__unassigned__";
const PAGE = 25;
/** How close to the viewport edge a drag must get before the page scrolls. */
const EDGE_PX = 84;
/** Peak auto-scroll speed, in px per animation frame, right at the edge. */
const EDGE_SPEED = 20;

const CAP_STYLE = {
  normal: "text-muted-light border-dark-lighter",
  near: "text-amber-300 border-amber-400/30 bg-amber-400/5",
  over: "text-red-300 border-red-400/40 bg-red-400/10",
} as const;

export default function WaveAllocationBoard({ waves, athletes, onEdit, onMove }: Props) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([...waves.map((w) => w.id), UNASSIGNED]),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState<Record<string, number>>({});
  const [dest, setDest] = useState<string>("");
  const [moving, setMoving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  // ── Drag and drop ──────────────────────────────────────────────────────────
  // Grab a row (or a checked group) and drop it onto a wave. Pointer events drive
  // the mechanics; anime.js drives the motion (lift, settle, spring-back, pulse).
  const waveRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const chipRefs = useRef<Map<string, HTMLElement>>(new Map());
  const ghostRef = useRef<HTMLDivElement>(null);
  const dropTargetRef = useRef<string | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [ghost, setGhost] = useState<{ ids: string[]; label: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // Keyboard equivalent of the drag: pick an athlete up, arrow between waves,
  // Enter to drop. A pointer-only handle would be unusable without a mouse.
  const [keyMove, setKeyMove] = useState<{ ids: string[]; label: string; index: number } | null>(null);

  const placeGhost = (x: number, y: number) => {
    pointerRef.current = { x, y };
    const el = ghostRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${x + 14}px, ${y + 8}px, 0)`;
  };

  // Athletes grouped by wave id (UNASSIGNED bucket for those with no wave).
  const byWave = useMemo(() => {
    const map = new Map<string, BoardAthlete[]>();
    map.set(UNASSIGNED, []);
    for (const w of waves) map.set(w.id, []);
    for (const a of athletes) {
      const key = a.waveId && map.has(a.waveId) ? a.waveId : UNASSIGNED;
      map.get(key)!.push(a);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
    }
    return map;
  }, [waves, athletes]);

  const assignedCount = (waveId: string) => byWave.get(waveId)?.length ?? 0;

  // Flat search results across every wave; allocation is the job, so search must
  // find an athlete wherever they currently sit.
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return athletes
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          (a.bibNumber ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  }, [query, athletes]);

  const waveLabel = (waveId: string | null) =>
    waveId ? waves.find((w) => w.id === waveId)?.label ?? "Unknown" : null;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleMany = (ids: string[], on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      for (const id of ids) (on ? next.add(id) : next.delete(id));
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Over-capacity preview for the chosen destination, excluding any selected
  // athletes already in it (they don't add to the count).
  const movePreview = useMemo(() => {
    if (!dest || dest === UNASSIGNED) return null;
    const wave = waves.find((w) => w.id === dest);
    if (!wave) return null;
    const selectedList = athletes.filter((a) => selected.has(a.id));
    const movingIn = selectedList.filter((a) => a.waveId !== dest).length;
    const alreadyIn = assignedCount(dest) - selectedList.filter((a) => a.waveId === dest).length;
    return { wave, ...previewMove({ destCapacity: wave.capacity, destAssignedNow: alreadyIn, movingCount: movingIn }) };
  }, [dest, selected, athletes, waves]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared optimistic move (via the parent), with a friendly result message.
  const applyMove = async (ids: string[], destWaveId: string | null, clearSel: boolean) => {
    setError("");
    setMsg("");
    const res = await onMove(ids, destWaveId);
    if (!res.ok) {
      setError(res.error ?? "Move failed.");
      return false;
    }
    const label = destWaveId ? waveLabel(destWaveId) : "no wave";
    setMsg(
      `Moved ${ids.length} athlete${ids.length === 1 ? "" : "s"} to ${label}.` +
        (res.overCapacity ? " That wave is now over capacity." : ""),
    );
    if (clearSel) clearSelection();
    return true;
  };

  const runMove = async () => {
    if (selected.size === 0 || dest === "") return;
    setMoving(true);
    await applyMove([...selected], dest === UNASSIGNED ? null : dest, true);
    setMoving(false);
    setDest("");
  };

  const showMore = (waveId: string) =>
    setShown((s) => ({ ...s, [waveId]: (s[waveId] ?? PAGE) + PAGE }));

  // Which wave container (or the Unassigned bucket) sits under the pointer.
  const hitTest = (x: number, y: number): string | null => {
    for (const [id, el] of waveRefs.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  };

  const pulseChip = (waveId: string) => {
    const chip = chipRefs.current.get(waveId);
    if (chip) animate(chip, { scale: [1, 1.35, 1], duration: 500, ease: "outElastic(1, .6)" });
  };

  // Begin a drag from a row handle. Drags the checked group if the row is part of
  // the selection, otherwise just that one athlete. Ghost is portaled to body so
  // page-level transforms (e.g. .page-in) don't trap position:fixed.
  const startDrag = (e: React.PointerEvent, athleteId: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const ids = selected.has(athleteId) && selected.size > 0 ? [...selected] : [athleteId];
    const label = ids.length === 1
      ? athletes.find((a) => a.id === athleteId)?.name ?? "Athlete"
      : `${ids.length} athletes`;
    const startX = e.clientX, startY = e.clientY;
    let active = false;

    const setTarget = (t: string | null) => {
      if (t !== dropTargetRef.current) { dropTargetRef.current = t; setDropTarget(t); }
    };

    // The board is taller than the viewport as soon as an event has a few waves,
    // so without edge auto-scroll the waves below the fold simply cannot be
    // dropped into — the pointer runs out of screen and the athlete lands in
    // whichever wave happened to be at the bottom edge.
    let raf: number | null = null;
    const stopEdgeScroll = () => {
      if (raf != null) { cancelAnimationFrame(raf); raf = null; }
    };
    const startEdgeScroll = () => {
      if (raf != null) return;
      const step = () => {
        const { x, y } = pointerRef.current;
        const h = window.innerHeight;
        let dy = 0;
        if (y < EDGE_PX) dy = -EDGE_SPEED * (1 - Math.max(y, 0) / EDGE_PX);
        else if (y > h - EDGE_PX) dy = EDGE_SPEED * (1 - Math.max(h - y, 0) / EDGE_PX);
        if (dy !== 0) {
          window.scrollBy(0, dy);
          setTarget(hitTest(x, y));
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    const move = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
        active = true;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
        placeGhost(ev.clientX, ev.clientY);
        setGhost({ ids, label });
        startEdgeScroll();
      }
      placeGhost(ev.clientX, ev.clientY);
      setTarget(hitTest(ev.clientX, ev.clientY));
    };

    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      stopEdgeScroll();
      if (!active) return;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      const target = hitTest(ev.clientX, ev.clientY);
      setTarget(null);
      const el = ghostRef.current;
      const destWaveId = target === UNASSIGNED ? null : target;
      const willChange =
        target !== null &&
        athletes.filter((a) => ids.includes(a.id)).some((a) => a.waveId !== destWaveId);

      // Remove the ghost on a timer so cleanup never depends on an animation
      // callback firing (it isn't always reliable in headless/background tabs).
      const removeGhost = () => setGhost(null);
      if (willChange && el) {
        const r = waveRefs.current.get(target)!.getBoundingClientRect();
        animate(el, {
          translateX: r.left + 24, translateY: r.top + 18, scale: 0.4, opacity: 0,
          duration: 240, ease: "out(3)",
        });
        if (target !== UNASSIGNED) pulseChip(target);
        void applyMove(ids, destWaveId, ids.length > 1 || selected.has(athleteId));
        setTimeout(removeGhost, 260);
      } else if (el) {
        animate(el, { scale: 0.6, opacity: 0, duration: 200, ease: "out(3)" });
        setTimeout(removeGhost, 220);
      } else {
        removeGhost();
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Every drop zone in board order, so arrow keys walk the same path the pointer
  // would. Unassigned sits last, matching the rendered layout.
  const groupOrder = useMemo(() => [...waves.map((w) => w.id), UNASSIGNED], [waves]);
  const groupLabel = (groupId: string) =>
    groupId === UNASSIGNED ? "Unassigned" : waves.find((w) => w.id === groupId)?.label ?? "Unknown";

  const onHandleKeyDown = (e: React.KeyboardEvent, athleteId: string) => {
    if (!keyMove) {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      const ids = selected.has(athleteId) && selected.size > 0 ? [...selected] : [athleteId];
      const athlete = athletes.find((a) => a.id === athleteId);
      setKeyMove({
        ids,
        label: ids.length === 1 ? athlete?.name ?? "Athlete" : `${ids.length} athletes`,
        index: Math.max(0, groupOrder.indexOf(athlete?.waveId ?? UNASSIGNED)),
      });
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setKeyMove(null);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      setKeyMove({ ...keyMove, index: (keyMove.index + 1) % groupOrder.length });
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      setKeyMove({ ...keyMove, index: (keyMove.index - 1 + groupOrder.length) % groupOrder.length });
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const target = groupOrder[keyMove.index];
      const ids = keyMove.ids;
      setKeyMove(null);
      void applyMove(ids, target === UNASSIGNED ? null : target, ids.length > 1);
    }
  };

  const renderColumnHeaders = (showWave: boolean) => (
    <div
      className="flex items-center gap-2 px-2 pt-2 pb-1"
      role="row"
      aria-label="Column headers"
    >
      <span className="shrink-0 w-4" aria-hidden />
      <span className="shrink-0 w-4" aria-hidden />
      <span className="min-w-0 flex-1 font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark">
        Athlete
      </span>
      {showWave && (
        <span className="shrink-0 font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark">
          Wave
        </span>
      )}
      <span className="shrink-0 w-14 text-right font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark">
        Bib
      </span>
      <span className="shrink-0 w-6" aria-hidden />
    </div>
  );

  const renderAthleteRow = (a: BoardAthlete, showWave: boolean, draggable = false) => {
    const checked = selected.has(a.id);
    const dragging = !!ghost && ghost.ids.includes(a.id);
    return (
      <div
        key={a.id}
        className={`flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.03] group transition-opacity ${dragging ? "opacity-30 ring-1 ring-primary/40 bg-primary/[0.06]" : ""}`}
      >
        {draggable ? (
          <button
            type="button"
            aria-label={`Drag ${a.name}`}
            title={`Drag ${a.name} to another wave, or press Enter to move with the keyboard`}
            aria-keyshortcuts="Enter"
            onPointerDown={(e) => startDrag(e, a.id)}
            onKeyDown={(e) => onHandleKeyDown(e, a.id)}
            className="shrink-0 text-muted-dark hover:text-primary transition-colors cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        ) : (
          <span className="shrink-0 w-4" />
        )}
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={`Select ${a.name}`}
          onClick={() => toggle(a.id)}
          className="shrink-0 text-muted-dark hover:text-primary transition-colors"
        >
          {checked ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
        </button>
        <span className="min-w-0 flex-1">
          <span className="font-headline text-[13.5px] font-bold text-white/90 truncate block">
            {a.name}
            {a.medicalNotes && (
              <span
                title={`Medical: ${a.medicalNotes}`}
                className="ml-2 inline-flex items-center gap-1 align-middle font-headline text-[9px] font-bold uppercase tracking-widest text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded px-1.5 py-0.5"
              >
                <AlertCircle className="w-2.5 h-2.5" /> Medical
              </span>
            )}
          </span>
          <span className="block text-[11px] text-muted-dark truncate mt-0.5">
            {[
              a.finishLabel ? `Finish ${a.finishLabel}` : "No finish time",
              a.gender || "No gender",
              a.age != null ? `Age ${a.age}` : "No age",
            ].join(" · ")}
            {!a.waveId && a.unassignedReason ? ` · ${a.unassignedReason}` : ""}
          </span>
        </span>
        {showWave && (
          <span className="shrink-0 font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark">
            {waveLabel(a.waveId) ?? "No wave"}
          </span>
        )}
        <span className="shrink-0 w-14 text-right font-headline text-[13px] font-bold text-muted-light">
          {a.bibNumber ? `#${a.bibNumber}` : "-"}
        </span>
        <button
          type="button"
          onClick={() => onEdit(a.id)}
          aria-label={`Edit ${a.name}`}
          className="shrink-0 p-1 text-muted-dark hover:text-primary transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  // A single wave (or the Unassigned bucket) as a disclosure row.
  const renderWaveGroup = (
    waveId: string,
    label: string,
    startTime: string | undefined,
    capacity: number | null | undefined,
    ruleParts: string[] = [],
  ) => {
    const list = byWave.get(waveId) ?? [];
    const isOpen = expanded.has(waveId);
    const limit = shown[waveId] ?? PAGE;
    const visible = list.slice(0, limit);
    const ids = list.map((a) => a.id);
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
    const someSelected = ids.some((id) => selected.has(id));
    const state = waveId === UNASSIGNED ? "normal" : capacityState(list.length, capacity ?? null);
    const isDropTarget =
      dropTarget === waveId || (!!keyMove && groupOrder[keyMove.index] === waveId);
    const headerParts = [
      label,
      startTime ? formatWaveStartTime(startTime) : null,
      ...ruleParts,
    ].filter((p): p is string => Boolean(p));

    return (
      <div
        key={waveId}
        ref={(el) => { if (el) waveRefs.current.set(waveId, el); else waveRefs.current.delete(waveId); }}
        className={`border rounded-xl overflow-hidden bg-dark transition-colors ${
          isDropTarget ? "border-primary ring-2 ring-primary/40 bg-primary/[0.04]" : "border-dark-lighter"
        }`}
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

          {ids.length > 0 && (
            <button
              type="button"
              role="checkbox"
              aria-checked={allSelected ? true : someSelected ? "mixed" : false}
              aria-label={`Select all in ${label}`}
              onClick={() => toggleMany(ids, !allSelected)}
              className="shrink-0 mt-0.5 text-muted-dark hover:text-primary transition-colors"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-primary" />
              ) : someSelected ? (
                <CheckSquare className="w-4 h-4 text-primary/40" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
          )}

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

          {waveId === UNASSIGNED ? (
            <span
              ref={(el) => { if (el) chipRefs.current.set(waveId, el); else chipRefs.current.delete(waveId); }}
              className="shrink-0 mt-0.5 inline-flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-muted border border-dark-lighter rounded-full px-2.5 py-1"
              title="No start wave. Bib numbers are separate."
            >
              <Users className="w-3 h-3" /> {list.length}
            </span>
          ) : (
            <span
              ref={(el) => { if (el) chipRefs.current.set(waveId, el); else chipRefs.current.delete(waveId); }}
              className={`shrink-0 mt-0.5 inline-flex items-center gap-1.5 font-headline text-[11px] font-black italic rounded-full border px-2.5 py-1 ${CAP_STYLE[state]}`}
            >
              {state === "over" && <AlertTriangle className="w-3 h-3" strokeWidth={2.5} />}
              {list.length}
              {capacity != null ? ` / ${capacity}` : ""}
              {state === "over" && (
                <span className="not-italic font-bold uppercase tracking-widest text-[9px]">Over</span>
              )}
            </span>
          )}
        </div>

        {isOpen && (
          <div className="px-1.5 pb-2 border-t border-white/5">
            {list.length === 0 ? (
              <p className="px-3 py-4 text-[12.5px] text-muted-dark">
                {waveId === UNASSIGNED ? "Everyone has a wave." : "No athletes in this wave yet."}
              </p>
            ) : (
              <>
                {waveId === UNASSIGNED && (
                  <p className="px-3 pt-2 pb-1 text-[12px] text-muted-dark">
                    No start wave yet. They didn&apos;t match your rules (pace, gender, age, or a wave was full). Bib numbers are separate.
                  </p>
                )}
                {renderColumnHeaders(false)}
                {visible.map((a) => renderAthleteRow(a, false, true))}
                {list.length > visible.length && (
                  <button
                    type="button"
                    onClick={() => showMore(waveId)}
                    className="w-full py-2 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors"
                  >
                    Show {Math.min(PAGE, list.length - visible.length)} more of {list.length}
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
          aria-label="Search athletes"
          className="w-full bg-dark border border-dark-lighter rounded-lg pl-10 pr-3 py-2.5 text-[14px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none"
        />
      </div>

      {(msg || error) && (
        <p className={`text-[13px] ${error ? "text-red-300" : "text-muted-light"}`}>{error || msg}</p>
      )}

      {/* Keyboard move: spoken to screen readers, and shown for sighted keyboard users. */}
      <p aria-live="assertive" className="sr-only">
        {keyMove
          ? `Moving ${keyMove.label}. Target wave ${groupLabel(groupOrder[keyMove.index])}. Press Enter to drop, Escape to cancel.`
          : ""}
      </p>
      {keyMove && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-2 font-headline text-[11px] font-bold uppercase tracking-widest text-light">
          <span>Moving {keyMove.label}</span>
          <span className="text-primary">→ {groupLabel(groupOrder[keyMove.index])}</span>
          <span className="text-muted normal-case tracking-normal font-normal">
            Arrow keys pick a wave · Enter drops · Esc cancels
          </span>
        </p>
      )}

      {searchResults ? (
        <div className="border border-dark-lighter rounded-xl bg-dark px-1.5 py-2">
          <p className="px-3 py-1.5 font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark">
            {searchResults.length} match{searchResults.length === 1 ? "" : "es"}
          </p>
          {searchResults.length === 0 ? (
            <p className="px-3 py-4 text-[13px] text-muted-dark">No athletes match your search.</p>
          ) : (
            <>
              {renderColumnHeaders(true)}
              {searchResults.map((a) => renderAthleteRow(a, true))}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {waves.map((w) => renderWaveGroup(w.id, w.label, w.startTime, w.capacity, waveRuleParts(w)))}
          {renderWaveGroup(UNASSIGNED, "Unassigned", undefined, null)}
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 z-10 flex flex-col sm:flex-row sm:items-center gap-3 bg-dark-light border border-primary/30 rounded-xl px-4 py-3 shadow-machined">
          <span className="font-headline text-[12px] font-bold uppercase tracking-widest text-light shrink-0">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ArrowRightLeft className="w-4 h-4 text-primary shrink-0" />
            <FormSelect
              aria-label="Destination wave"
              value={dest}
              onChange={setDest}
              placement="top"
              className="flex-1 min-w-0"
              options={[
                { value: "", label: "Move to…" },
                ...waves.map((w) => ({ value: w.id, label: w.label })),
                { value: UNASSIGNED, label: "No wave" },
              ]}
            />
          </div>
          {movePreview?.over && (
            <span className="inline-flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-amber-300 shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" /> Over by {movePreview.overBy}
            </span>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={clearSelection} aria-label="Clear selection">
              <X className="w-4 h-4" /> Clear
            </Button>
            <Button size="sm" onClick={runMove} disabled={moving || dest === ""} className="shadow-machined">
              {moving ? "Moving…" : "Move"}
            </Button>
          </div>
        </div>
      )}

      {/* Drag ghost on document.body — avoids .page-in transform trapping fixed pos.
          A ghost only exists once a pointer drag has started, so this never runs
          during SSR and needs no mounted guard. */}
      {ghost && createPortal(
        <div
          ref={(el) => {
            ghostRef.current = el;
            if (el) {
              const { x, y } = pointerRef.current;
              el.style.transform = `translate3d(${x + 14}px, ${y + 8}px, 0)`;
            }
          }}
          className="fixed left-0 top-0 z-[9999] pointer-events-none will-change-transform"
        >
          <div className="inline-flex items-center gap-2 rounded-lg bg-primary text-dark font-headline text-[12px] font-bold uppercase tracking-widest px-3.5 py-2.5 shadow-machined border border-dark/20">
            <GripVertical className="w-3.5 h-3.5" />
            {ghost.label}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
