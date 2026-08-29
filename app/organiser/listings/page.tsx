"use client";

import { useState, useMemo, useEffect, useCallback, useRef, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Plus, Trash2, MapPin, RefreshCw, Search,
  MoreHorizontal, Pencil, LayoutDashboard, Copy,
  ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { TableSkeleton } from "@/components/ui/skeleton";

type EventStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

const STATUS_ORDER: Record<EventStatus, number> = {
  APPROVED: 0,
  PENDING:  1,
  REJECTED: 2,
  DRAFT:    3,
  ARCHIVED: 4,
};

interface EventRow {
  id: string; title: string; discipline: string; city: string; state: string;
  eventDate: string; startTime: string; status: EventStatus; waves: { price: string }[];
  cap?: number | null; coverImageUrl?: string | null; registrationCount: number;
}

function formatEventDate(dateStr: string, startTime: string) {
  try {
    const d    = new Date(dateStr + "T00:00:00");
    const day  = d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    const time = startTime
      ? new Date(`1970-01-01T${startTime}`).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase()
      : null;
    return time ? `${day} · ${time}` : day;
  } catch {
    return dateStr;
  }
}

const STATUS_STYLE: Record<EventStatus, { bg: string; text: string; label: string }> = {
  DRAFT:    { bg: "bg-amber-400/10", text: "text-amber-300", label: "Draft"     },
  PENDING:  { bg: "bg-blue-400/10",  text: "text-blue-300",  label: "Pending"   },
  APPROVED: { bg: "bg-primary/10",   text: "text-primary",   label: "Published" },
  REJECTED: { bg: "bg-red-400/10",   text: "text-red-300",   label: "Rejected"  },
  ARCHIVED: { bg: "bg-white/5",      text: "text-muted",     label: "Archived"  },
};

type SortField = "status" | "date" | "name";
type SortDir   = "asc" | "desc";
type Filter    = EventStatus | "all";

const FILTERS: { k: Filter; l: string }[] = [
  { k: "all",      l: "All"       },
  { k: "APPROVED", l: "Published" },
  { k: "PENDING",  l: "Pending"   },
  { k: "DRAFT",    l: "Drafts"    },
  { k: "REJECTED", l: "Rejected"  },
  { k: "ARCHIVED", l: "Archived"  },
];

const SORT_LABELS: Record<SortField, string> = { status: "Status", date: "Date", name: "Name" };

// ── Actions dropdown ────────────────────────────────────────────────────────
function ActionsMenu({ event, onDelete }: { event: EventRow; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);
  const router          = useRouter();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleDuplicate = async (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (duplicating) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/organiser/events/${event.id}/duplicate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.id) throw new Error(data?.error || "Duplicate failed");
      setOpen(false);
      router.push(`/organiser/new-listing?id=${data.id}&from=${encodeURIComponent("/organiser/listings")}`);
    } catch (err) {
      console.error(err);
      setDuplicating(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <Button
        size="icon" variant="ghost"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="w-10 h-10"
      >
        <MoreHorizontal className="w-4 h-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-52 bg-dark border border-dark-lighter rounded-xl shadow-lg py-1 overflow-hidden">
          <button
            onClick={e => { e.stopPropagation(); setOpen(false); router.push(`/organiser/events/${event.id}/dashboard`); }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-white/70 hover:bg-primary/5 hover:text-primary transition-colors font-headline font-bold uppercase tracking-widest"
          >
            <LayoutDashboard className="w-4 h-4" /> View dashboard
          </button>
          <button
            onClick={e => { e.stopPropagation(); setOpen(false); router.push(`/organiser/new-listing?id=${event.id}&from=${encodeURIComponent("/organiser/listings")}`); }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-white/70 hover:bg-white/5 transition-colors font-headline font-bold uppercase tracking-widest"
          >
            <Pencil className="w-4 h-4" /> Edit event
          </button>
          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-white/70 hover:bg-white/5 transition-colors font-headline font-bold uppercase tracking-widest disabled:opacity-50"
          >
            <Copy className="w-4 h-4" /> {duplicating ? "Duplicating…" : "Duplicate listing"}
          </button>
          <div className="my-1 border-t border-dark-lighter" />
          <button
            onClick={e => { e.stopPropagation(); setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-red-300 hover:bg-red-400/10 transition-colors font-headline font-bold uppercase tracking-widest"
          >
            <Trash2 className="w-4 h-4" /> Delete event
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sort header button (desktop table) ─────────────────────────────────────
function SortButton({
  field, active, dir, onSort, label,
}: { field: SortField; active: boolean; dir: SortDir; onSort: (f: SortField) => void; label: string }) {
  return (
    <button
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 hover:text-primary transition-colors"
    >
      {label}
      {active
        ? dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        : <ArrowUpDown className="w-3 h-3 opacity-40" />}
    </button>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function ListingsPage() {
  const router = useRouter();
  const [events,     setEvents]     = useState<EventRow[] | null>(null);
  const loading = events === null;
  const [filter,     setFilter]     = useState<Filter>("all");
  const [confirmDel, setConfirmDel] = useState<EventRow | null>(null);
  const [deleting,   setDeleting]   = useState(false);
  const [sortField,  setSortField]  = useState<SortField>("status");
  const [sortDir,    setSortDir]    = useState<SortDir>("asc");

  const fetchEvents = useCallback(() => {
    fetch("/api/organiser/events")
      .then(r => r.ok ? r.json() : [])
      .then(data => { setEvents(Array.isArray(data) ? data : []); });
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    const list = (events ?? []).filter(e => filter === "all" || e.status === filter);
    return [...list].sort((a, b) => {
      if (sortField === "date") {
        const diff = a.eventDate.localeCompare(b.eventDate);
        return sortDir === "asc" ? diff : -diff;
      }
      if (sortField === "name") {
        const diff = a.title.localeCompare(b.title);
        return sortDir === "asc" ? diff : -diff;
      }
      const diff = sortDir === "asc"
        ? STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        : STATUS_ORDER[b.status] - STATUS_ORDER[a.status];
      if (diff !== 0) return diff;
      return a.eventDate.localeCompare(b.eventDate);
    });
  }, [events, filter, sortField, sortDir]);

  const counts = useMemo(() => {
    const list = events ?? [];
    const out: Record<string, number> = { all: list.length };
    FILTERS.slice(1).forEach(({ k }) => { out[k] = list.filter(e => e.status === k).length; });
    return out;
  }, [events]);

  const handleDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/organiser/events/${confirmDel.id}`, { method: "DELETE" });
      if (res.ok) {
        setEvents(es => (es ?? []).filter(e => e.id !== confirmDel.id));
        setConfirmDel(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleRowClick = (e: EventRow) => {
    if (e.status === "APPROVED") {
      router.push(`/organiser/events/${e.id}/dashboard`);
    } else {
      router.push(`/organiser/events/${e.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-dark-darker">


      <main className="pt-14">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-24 lg:pb-12 page-in">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <div className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-2">
                Event Listings
              </div>
              <h1 className="font-headline text-[36px] sm:text-[44px] lg:text-[56px] font-black italic tracking-tighter leading-none text-white">
                Your race<br /><span className="text-primary">calendar.</span>
              </h1>
              <p className="text-muted mt-3 text-[14px]">
                {events != null && events.length > 0
                  ? `${events.length} listing${events.length !== 1 ? "s" : ""} on the board.`
                  : "No listings yet. Create your first event to get started."}
              </p>
            </div>
            <Button asChild size="lg" className="self-start sm:self-end shrink-0">
              <Link href="/organiser/new-listing">
                <Plus className="w-4 h-4" /> Add New Event
              </Link>
            </Button>
          </div>

          {/* Filter strip */}
          <div className="flex items-center gap-2 mb-4 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto no-scrollbar pb-1">
            {FILTERS.map(({ k, l }) => (
              <Button key={k} size="sm" variant={filter === k ? "lime" : "outline"}
                onClick={() => setFilter(k)}
                className="shrink-0"
              >
                {l} <span className="opacity-60 ml-1">({counts[k] ?? 0})</span>
              </Button>
            ))}
            <Button size="icon" variant="outline" onClick={fetchEvents} title="Refresh" className="shrink-0">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Mobile sort chips */}
          <div className="flex sm:hidden items-center gap-2 mb-3 overflow-x-auto no-scrollbar pb-1">
            <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark shrink-0">Sort</span>
            {(["status", "date", "name"] as SortField[]).map(field => {
              const active = sortField === field;
              return (
                <button key={field} onClick={() => handleSort(field)}
                  className={`flex items-center gap-1 px-3 h-8 rounded-full font-headline text-[11px] font-bold uppercase tracking-widest border transition-colors shrink-0
                    ${active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-dark-lighter text-muted bg-transparent"}`}
                >
                  {SORT_LABELS[field]}
                  {active && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </button>
              );
            })}
          </div>

          {/* Table */}
          <Card className="stagger-item">
            {/* Desktop table header */}
            <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-white/[0.02] border-b border-dark-lighter font-headline font-bold text-[11px] uppercase tracking-widest text-muted-dark rounded-t-xl">
              <div className="col-span-5">
                <SortButton field="name" active={sortField === "name"} dir={sortDir} onSort={handleSort} label="Event" />
              </div>
              <div className="col-span-2 text-center">
                <SortButton field="date" active={sortField === "date"} dir={sortDir} onSort={handleSort} label="Date" />
              </div>
              <div className="col-span-2 text-center">
                <SortButton field="status" active={sortField === "status"} dir={sortDir} onSort={handleSort} label="Status" />
              </div>
              <div className="col-span-2">Registered / Cap</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {loading && <TableSkeleton rows={5} cols={4} className="p-6" />}

            {!loading && filtered.map((e, i) => {
              const s     = STATUS_STYLE[e.status];
              const price = (e.waves as { price: string }[])?.[0]?.price;
              return (
                <div key={e.id} className={`${i < filtered.length - 1 ? "border-b border-white/5" : ""}`}>

                  {/* ── Mobile card layout (< sm) ── */}
                  <div
                    className="sm:hidden flex items-center gap-3 px-4 py-3.5 cursor-pointer active:bg-white/5 transition-colors"
                    onClick={() => handleRowClick(e)}
                  >
                    <div className="relative w-12 h-12 rounded-lg bg-dark-light flex items-center justify-center shrink-0 overflow-hidden">
                        {e.coverImageUrl
                          ? <Image src={e.coverImageUrl} alt={e.title} fill className="pointer-events-none object-cover brightness-[.62] saturate-110" sizes="48px" />
                        : <div className="font-mono text-[9px] text-muted-dark uppercase">{e.discipline.slice(0, 4)}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-0.5">
                        <div className="font-headline text-[14px] font-black italic tracking-tighter text-white leading-tight line-clamp-1 flex-1">
                          {e.title}
                        </div>
                        <Badge className={`${s.bg} ${s.text} border-0 text-[10px] shrink-0`}>{s.label}</Badge>
                      </div>
                      <div className="flex items-center gap-1 font-headline text-[10px] text-muted-dark uppercase tracking-widest mb-1">
                        <MapPin className="w-3 h-3 text-primary shrink-0" /> {e.city}, {e.state.toUpperCase()}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="font-headline text-[11px] text-muted">{formatEventDate(e.eventDate, e.startTime)}</div>
                        <div className="font-headline text-[11px] text-muted-light">
                          {(e.registrationCount ?? 0)}{e.cap ? `/${e.cap}` : ""}<span className="text-muted-dark"> reg</span>
                        </div>
                      </div>
                    </div>
                    <div onClick={ev => ev.stopPropagation()}>
                      <ActionsMenu event={e} onDelete={() => setConfirmDel(e)} />
                    </div>
                  </div>

                  {/* ── Desktop table row (≥ sm) — inset rail (no layout shift vs hover:border-l) ── */}
                  <div
                    className={`hidden sm:grid grid-cols-12 gap-4 px-5 py-4 items-center cursor-pointer transition-colors
                      ${e.status === "APPROVED"
                        ? "hover:bg-primary/5 hover:shadow-[inset_2px_0_0_0_#B3E153]"
                        : "hover:bg-white/5 hover:shadow-[inset_2px_0_0_0_#353535]"}`}
                    onClick={() => handleRowClick(e)}
                  >
                    <div className="col-span-5 flex items-center gap-4 min-w-0">
                      <div className="relative w-14 h-14 rounded-lg bg-dark-light flex items-center justify-center shrink-0 overflow-hidden">
                        {e.coverImageUrl
                          ? <Image src={e.coverImageUrl} alt={e.title} fill className="pointer-events-none object-cover brightness-[.62] saturate-110" sizes="56px" />
                          : <div className="font-mono text-[9px] text-muted-dark uppercase">{e.discipline.slice(0, 4)}</div>}
                      </div>
                      <div className="min-w-0">
                        <div className="font-headline text-[15px] font-black italic tracking-tighter text-white">{e.title}</div>
                        <div className="flex items-center gap-1 font-headline text-[11px] text-muted-dark uppercase tracking-widest mt-0.5">
                          <MapPin className="w-3 h-3 text-primary" /> {e.city}, {e.state.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 text-center">
                      <div className="font-headline text-sm font-bold text-muted">{formatEventDate(e.eventDate, e.startTime)}</div>
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <Badge className={`${s.bg} ${s.text} border-0`}>{s.label}</Badge>
                    </div>
                    <div className="col-span-2">
                      <div className="font-headline text-sm font-bold text-white">
                        {(e.registrationCount ?? 0).toLocaleString()}
                        {e.cap
                          ? <span className="text-muted-dark font-normal"> / {e.cap.toLocaleString()}</span>
                          : <span className="text-muted-dark font-normal"> / —</span>}
                      </div>
                      {price && <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-0.5">from A${price}</div>}
                    </div>
                    <div className="col-span-1 flex items-center justify-end" onClick={ev => ev.stopPropagation()}>
                      <ActionsMenu event={e} onDelete={() => setConfirmDel(e)} />
                    </div>
                  </div>
                </div>
              );
            })}

            {!loading && filtered.length === 0 && (
              <div className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-dark-light mb-4">
                  <Search className="w-5 h-5 text-muted-dark" />
                </div>
                <div className="font-headline text-lg font-black italic text-white mb-1">Nothing here yet</div>
                <div className="text-muted-dark text-sm">
                  {(events ?? []).length === 0 ? "Create your first listing to get started." : "Try clearing the filter."}
                </div>
              </div>
            )}
          </Card>

          {events != null && events.length > 0 && !loading && (
            <Link href="/organiser/new-listing"
              className="group w-full mt-4 border border-dashed border-dark-lighter hover:border-primary bg-transparent rounded-xl p-5 flex items-center justify-center gap-3 text-muted-dark hover:text-primary hover:-translate-y-0.5 active:translate-y-0 transition-[transform,border-color,color] duration-200 ease-out">
              <Plus className="w-5 h-5" />
              <span className="font-headline text-sm font-bold uppercase tracking-widest">Add another event</span>
            </Link>
          )}
        </div>
      </main>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDel} onOpenChange={open => { if (!open) setConfirmDel(null); }}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-red-400/10 text-red-300 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <DialogTitle>Delete this event?</DialogTitle>
            </div>
            <DialogDescription>
              You&apos;re about to delete <span className="text-white font-semibold">{confirmDel?.title}</span>.
              This will remove it from the platform and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Yes, delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
