"use client";

import { useState, useEffect, useCallback, Suspense, startTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  MapPin, Calendar, Check, X, RefreshCw, ChevronDown, ChevronUp,
  Pin, PinOff, Trash2, CheckSquare, Square, Plus, Pencil,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type EventStatus = "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

interface AdminEventRow {
  id: string;
  title: string;
  discipline: string;
  city: string;
  state: string;
  eventDate: string;
  startTime: string;
  status: EventStatus;
  isPinned: boolean;
  createdAt: string;
  coverImageUrl: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  organiser: { id: string; orgName: string | null; contactName: string | null; email: string };
}

const TABS: { status: EventStatus; label: string }[] = [
  { status: "PENDING",  label: "Pending"  },
  { status: "APPROVED", label: "Approved" },
  { status: "REJECTED", label: "Rejected" },
  { status: "ARCHIVED", label: "Archived" },
];

const STATUS_STYLE: Record<EventStatus, { bg: string; text: string; dot: string; label: string }> = {
  PENDING:  { bg: "bg-blue-400/10",  text: "text-blue-300",  dot: "bg-blue-400",   label: "Pending"  },
  APPROVED: { bg: "bg-primary/10",   text: "text-primary",   dot: "bg-primary",    label: "Approved" },
  REJECTED: { bg: "bg-red-400/10",   text: "text-red-400",   dot: "bg-red-400",    label: "Rejected" },
  ARCHIVED: { bg: "bg-white/[0.05]", text: "text-muted",     dot: "bg-muted-dark", label: "Archived" },
};

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-AU", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatSubmitted(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}

interface RejectPanelProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function RejectPanel({ onConfirm, onCancel, loading }: RejectPanelProps) {
  const [reason, setReason] = useState("");
  return (
    <div className="mt-3 p-4 bg-red-500/[0.08] border border-red-500/20 rounded-lg">
      <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-red-400 block mb-2">
        Rejection reason <span className="text-red-400">*</span>
      </label>
      <textarea
        className="w-full text-[14px] text-light bg-dark border border-red-500/30 rounded-md px-3 py-2 resize-none focus:outline-none focus:border-red-400 placeholder:text-muted-dark"
        rows={3}
        placeholder="Explain why the event is being rejected…"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex items-center gap-2 mt-2 justify-end">
        <button
          onClick={onCancel}
          disabled={loading}
          className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light px-3 py-1.5 rounded transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={() => reason.trim() && onConfirm(reason.trim())}
          disabled={loading || !reason.trim()}
          className="font-headline text-[12px] font-bold uppercase tracking-widest bg-red-600 text-white px-4 py-1.5 rounded hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {loading
            ? <><span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> Rejecting…</>
            : <><X className="w-3 h-3" /> Reject</>}
        </button>
      </div>
    </div>
  );
}

function EventRow({
  event,
  selected,
  onToggleSelect,
  onReviewed,
  onDeleted,
  onPinToggled,
}: {
  event: AdminEventRow;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onReviewed: (id: string) => void;
  onDeleted: (id: string) => void;
  onPinToggled: (id: string, isPinned: boolean) => void;
}) {
  const [approving,    setApproving]    = useState(false);
  const [approveError, setApproveError] = useState("");
  const [rejectOpen,   setRejectOpen]   = useState(false);
  const [rejecting,    setRejecting]    = useState(false);
  const [pinning,      setPinning]      = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [confirmDel,   setConfirmDel]   = useState(false);
  const [expanded,     setExpanded]     = useState(false);

  const organiserName =
    event.organiser.orgName || event.organiser.contactName || event.organiser.email;

  const handleApprove = async () => {
    setApproving(true);
    setApproveError("");
    try {
      const res = await fetch(`/api/admin/events/${event.id}/review`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "approve" }),
      });
      if (res.ok) {
        onReviewed(event.id);
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setApproveError(data.error ?? "Failed to approve event.");
      }
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (reason: string) => {
    setRejecting(true);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/review`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "reject", reason }),
      });
      if (res.ok) {
        setRejectOpen(false);
        onReviewed(event.id);
      }
    } finally {
      setRejecting(false);
    }
  };

  const handlePin = async () => {
    setPinning(true);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/pin`, { method: "PATCH" });
      if (res.ok) {
        const data = await res.json() as { isPinned: boolean };
        onPinToggled(event.id, data.isPinned);
      }
    } finally {
      setPinning(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    setConfirmDel(false);
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, { method: "DELETE" });
      if (res.ok) onDeleted(event.id);
    } finally {
      setDeleting(false);
    }
  };

  const s = STATUS_STYLE[event.status];

  return (
    <div className="border-b border-white/[0.06] last:border-0">
      <div className="flex items-start gap-3 px-5 py-4">
        {/* Checkbox */}
        <button
          onClick={() => onToggleSelect(event.id)}
          className="mt-1 shrink-0 text-muted-dark hover:text-muted transition-colors"
        >
          {selected
            ? <CheckSquare className="w-4 h-4 text-primary" />
            : <Square className="w-4 h-4" />}
        </button>

        {/* Cover thumbnail */}
        <div className="relative w-14 h-14 rounded-lg bg-dark-light flex items-center justify-center shrink-0 overflow-hidden">
          {event.coverImageUrl
            ? <Image src={event.coverImageUrl} alt={event.title} fill className="pointer-events-none object-cover" sizes="56px" />
            : <div className="font-mono text-[9px] text-muted-dark uppercase">{event.discipline.slice(0, 4)}</div>}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-x-3 gap-y-1 mb-1">
            <span className="font-headline text-[15px] font-black italic tracking-tighter text-light truncate">
              {event.title}
            </span>
            <Badge className={`gap-1.5 ${s.bg} ${s.text} border-0 shrink-0`}>
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              {s.label}
            </Badge>
            {event.isPinned && (
              <Badge className="gap-1.5 bg-amber-400/10 text-amber-300 border-0 shrink-0">
                <Pin className="w-3 h-3" /> Pinned
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-headline text-[11px] uppercase tracking-widest text-muted mb-1">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-primary" />
              {event.city}, {event.state.toUpperCase()}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-muted-dark" />
              {formatDate(event.eventDate)}
            </span>
            <span className="capitalize">{event.discipline}</span>
          </div>

          <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark">
            By <span className="text-muted">{organiserName}</span>
            {" · "}Submitted {formatSubmitted(event.createdAt)}
          </div>

          {event.status === "REJECTED" && event.rejectionReason && (
            <div className="mt-2 text-[13px] text-red-400 bg-red-500/10 rounded px-3 py-2 border border-red-500/20">
              <span className="font-bold">Reason: </span>{event.rejectionReason}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto pl-2 flex-wrap justify-end">
          {event.status === "PENDING" && (
            <>
              <button
                onClick={handleApprove}
                disabled={approving || rejecting}
                className="flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest bg-primary text-dark px-3 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {approving
                  ? <span className="w-3 h-3 border border-dark/40 border-t-dark rounded-full animate-spin" />
                  : <Check className="w-3.5 h-3.5" />}
                Approve
              </button>
              <button
                onClick={() => { setRejectOpen((o) => !o); setApproveError(""); }}
                disabled={approving || rejecting}
                className="flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest border border-red-500/30 text-red-400 px-3 py-2 rounded-md hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <X className="w-3.5 h-3.5" /> Reject
              </button>
            </>
          )}

          {event.status === "APPROVED" && (
            <button
              onClick={handlePin}
              disabled={pinning}
              className={`flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest px-3 py-2 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                ${event.isPinned
                  ? "border border-amber-400/40 text-amber-300 hover:bg-amber-400/10"
                  : "border border-dark-lighter text-muted hover:border-primary/40 hover:text-light"
                }`}
            >
              {pinning
                ? <span className="w-3 h-3 border border-current/40 border-t-current rounded-full animate-spin" />
                : event.isPinned
                  ? <><PinOff className="w-3.5 h-3.5" /> Unpin</>
                  : <><Pin className="w-3.5 h-3.5" /> Pin</>}
            </button>
          )}

          {/* Edit */}
          <Link
            href={`/admin/events/${event.id}/edit`}
            className="flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest border border-dark-lighter text-muted px-3 py-2 rounded-md hover:border-primary/40 hover:text-light transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            title={confirmDel ? "Click again to confirm deletion" : "Delete event"}
            className={`flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest px-3 py-2 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed
              ${confirmDel
                ? "bg-red-600 text-white hover:bg-red-700"
                : "border border-dark-lighter text-muted-dark hover:border-red-500/40 hover:text-red-400"
              }`}
          >
            {deleting
              ? <span className="w-3 h-3 border border-current/40 border-t-current rounded-full animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />}
            {confirmDel ? "Confirm" : "Delete"}
          </button>
          {confirmDel && (
            <button
              onClick={() => setConfirmDel(false)}
              className="font-headline text-[11px] text-muted hover:text-light px-2 py-2 transition-colors"
            >
              Cancel
            </button>
          )}

          {/* Expand */}
          <button
            onClick={() => setExpanded((o) => !o)}
            className="p-2 text-muted-dark hover:text-muted transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Approve error */}
      {approveError && (
        <div className="px-5 pb-4 pl-12">
          <div className="flex items-start gap-3 bg-amber-400/[0.08] border border-amber-400/20 rounded-lg px-4 py-3">
            <svg className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div className="text-[13px] text-amber-200">{approveError}</div>
          </div>
        </div>
      )}

      {/* Reject panel */}
      {rejectOpen && (
        <div className="px-5 pb-4 pl-12">
          <RejectPanel onConfirm={handleReject} onCancel={() => setRejectOpen(false)} loading={rejecting} />
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 pl-12 bg-white/[0.02] border-t border-white/[0.06]">
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
            <div>
              <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mb-0.5">Organiser</div>
              <div className="text-[13px] text-light/80">
                {organiserName}
                {organiserName !== event.organiser.email && (
                  <span className="text-muted-dark ml-1">({event.organiser.email})</span>
                )}
              </div>
            </div>
            <div>
              <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mb-0.5">Event date</div>
              <div className="text-[13px] text-light/80">{formatDate(event.eventDate)} · {event.startTime}</div>
            </div>
            <div>
              <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mb-0.5">Discipline</div>
              <div className="text-[13px] text-light/80 capitalize">{event.discipline}</div>
            </div>
            {event.reviewedAt && (
              <div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mb-0.5">Reviewed</div>
                <div className="text-[13px] text-light/80">{formatSubmitted(event.reviewedAt)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BulkActionBar({
  selectedIds,
  activeTab,
  onClearSelection,
  onBulkDone,
}: {
  selectedIds: Set<string>;
  activeTab: EventStatus;
  onClearSelection: () => void;
  onBulkDone: (ids: string[], action: string) => void;
}) {
  const [loading,       setLoading]       = useState(false);
  const [rejectOpen,    setRejectOpen]    = useState(false);
  const [bulkReason,    setBulkReason]    = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const ids = Array.from(selectedIds);

  const run = async (action: string, reason?: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/events/bulk", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ids, action, reason }),
      });
      if (res.ok) {
        onBulkDone(ids, action);
        onClearSelection();
        setRejectOpen(false);
        setConfirmDelete(false);
        setBulkReason("");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sticky top-14 z-40 bg-dark-darker/95 backdrop-blur border-b border-primary/20 text-light px-5 py-3 flex flex-wrap items-center gap-3 shadow-lg">
      <span className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted">
        {ids.length} selected
      </span>

      {activeTab === "PENDING" && !rejectOpen && !confirmDelete && (
        <>
          <button
            onClick={() => run("approve")}
            disabled={loading}
            className="flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest bg-primary text-dark px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" /> Approve all
          </button>
          <button
            onClick={() => setRejectOpen(true)}
            disabled={loading}
            className="flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest border border-red-500/30 text-red-400 px-4 py-1.5 rounded-md hover:bg-red-500/10 transition-colors disabled:opacity-40"
          >
            <X className="w-3.5 h-3.5" /> Reject all
          </button>
        </>
      )}

      {rejectOpen && (
        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            placeholder="Rejection reason (required)…"
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            className="flex-1 max-w-sm text-[13px] bg-dark-light border border-dark-lighter rounded-md px-3 py-1.5 text-light placeholder:text-muted-dark focus:outline-none focus:border-primary"
          />
          <button
            onClick={() => bulkReason.trim() && run("reject", bulkReason.trim())}
            disabled={loading || !bulkReason.trim()}
            className="font-headline text-[12px] font-bold uppercase tracking-widest bg-red-600 text-white px-4 py-1.5 rounded-md hover:bg-red-500 transition-colors disabled:opacity-40"
          >
            Confirm reject
          </button>
          <button onClick={() => setRejectOpen(false)} className="text-muted hover:text-light transition-colors px-2 font-headline text-[12px] uppercase tracking-widest">
            Cancel
          </button>
        </div>
      )}

      {!rejectOpen && (
        confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="font-headline text-[11px] text-red-400 uppercase tracking-widest">
              Delete {ids.length} event{ids.length !== 1 ? "s" : ""}?
            </span>
            <button
              onClick={() => run("delete")}
              disabled={loading}
              className="font-headline text-[12px] font-bold uppercase tracking-widest bg-red-600 text-white px-4 py-1.5 rounded-md hover:bg-red-500 transition-colors disabled:opacity-40"
            >
              Yes, delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-muted hover:text-light transition-colors px-2 font-headline text-[12px] uppercase tracking-widest">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={loading}
            className="flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest border border-red-500/30 text-red-400 px-4 py-1.5 rounded-md hover:bg-red-500/10 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete all
          </button>
        )
      )}

      <button
        onClick={onClearSelection}
        className="ml-auto font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light transition-colors"
      >
        Clear
      </button>
    </div>
  );
}

function AdminEventsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const statusParam  = (searchParams.get("status") ?? "PENDING").toUpperCase() as EventStatus;
  const activeTab    = TABS.find((t) => t.status === statusParam)?.status ?? "PENDING";

  const [events,      setEvents]      = useState<AdminEventRow[] | null>(null);
  const loading = events === null;
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchEvents = useCallback(async (status: EventStatus, p = 1) => {
    try {
      const res  = await fetch(`/api/admin/events?status=${status}&page=${p}&limit=50`);
      const data = await res.json() as { events: AdminEventRow[]; total: number; totalPages: number };
      if (res.ok && Array.isArray(data.events)) {
        setEvents(data.events);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } else {
        setEvents([]);
        setTotal(0);
        setTotalPages(1);
      }
    } catch {
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    startTransition(() => fetchEvents(activeTab, 1));
  }, [activeTab, fetchEvents]);

  const switchTab = (status: EventStatus) => {
    setSelectedIds(new Set());
    setPage(1);
    router.push(`/admin/events?status=${status}`, { scroll: false });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!events) return;
    setSelectedIds((prev) =>
      prev.size === events.length ? new Set() : new Set(events.map((e) => e.id))
    );
  };

  const handleReviewed = (id: string) => {
    setEvents((prev) => (prev ?? []).filter((e) => e.id !== id));
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleDeleted = (id: string) => {
    setEvents((prev) => (prev ?? []).filter((e) => e.id !== id));
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handlePinToggled = (id: string, isPinned: boolean) => {
    setEvents((prev) => (prev ?? []).map((e) => e.id === id ? { ...e, isPinned } : e));
  };

  const handleBulkDone = (ids: string[]) => {
    setEvents((prev) => (prev ?? []).filter((e) => !ids.includes(e.id)));
  };

  const allSelected = events != null && events.length > 0 && selectedIds.size === events.length;

  return (
    <div className="min-h-screen bg-dark-darker">


      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedIds={selectedIds}
          activeTab={activeTab}
          onClearSelection={() => setSelectedIds(new Set())}
          onBulkDone={handleBulkDone}
        />
      )}

      <main className={selectedIds.size > 0 ? "" : "pt-14"}>
        <div className="max-w-[1200px] mx-auto px-6 py-10 page-in">

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-2">
                Admin portal
              </div>
              <h1 className="font-headline text-[44px] font-black italic tracking-tighter leading-none text-light">
                Events.
              </h1>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-end">
              <Link
                href="/admin/events/create"
                className="flex items-center gap-2 font-headline text-[12px] font-bold uppercase tracking-widest bg-machined shadow-machined text-dark px-4 py-2.5 rounded-md hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform"
              >
                <Plus className="w-3.5 h-3.5" /> Create event
              </Link>
              <button
                onClick={() => fetchEvents(activeTab, page)}
                className="flex items-center gap-2 font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-dark-lighter">
            {TABS.map(({ status, label }) => (
              <button
                key={status}
                onClick={() => switchTab(status)}
                className={`font-headline text-[13px] font-bold uppercase tracking-widest px-5 py-2.5 border-b-2 transition-colors -mb-px
                  ${activeTab === status
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-light"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          <Card className="overflow-hidden">
            {/* Select-all header */}
            {!loading && events.length > 0 && (
              <div className="flex items-center gap-3 px-5 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 font-headline text-[11px] font-bold uppercase tracking-widest text-muted-dark hover:text-muted transition-colors"
                >
                  {allSelected
                    ? <CheckSquare className="w-4 h-4 text-primary" />
                    : <Square className="w-4 h-4" />}
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
                {selectedIds.size > 0 && (
                  <span className="font-headline text-[11px] uppercase tracking-widest text-muted">
                    {selectedIds.size} of {events.length} selected
                  </span>
                )}
              </div>
            )}

            {loading && (
              <div className="p-12 text-center">
                <div className="w-5 h-5 border-2 border-dark-lighter border-t-primary rounded-full animate-spin mx-auto mb-3" />
                <div className="font-headline text-sm text-muted uppercase tracking-widest">Loading…</div>
              </div>
            )}

            {!loading && events.length === 0 && (
              <div className="p-12 text-center">
                <div className="font-headline text-lg font-black italic text-light mb-1">
                  {activeTab === "PENDING" ? "Queue is clear" : `No ${activeTab.toLowerCase()} events`}
                </div>
                <div className="text-muted text-sm">
                  {activeTab === "PENDING"
                    ? "No events are waiting for review right now."
                    : `No events with ${activeTab.toLowerCase()} status.`}
                </div>
              </div>
            )}

            {!loading && events.length > 0 && events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                selected={selectedIds.has(event.id)}
                onToggleSelect={toggleSelect}
                onReviewed={handleReviewed}
                onDeleted={handleDeleted}
                onPinToggled={handlePinToggled}
              />
            ))}
          </Card>

          {!loading && events.length > 0 && (
            <div className="mt-4 flex items-center justify-between font-headline text-[12px] uppercase tracking-widest text-muted">
              <span>{total} event{total !== 1 ? "s" : ""}</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { const p = page - 1; setPage(p); fetchEvents(activeTab, p); }}
                    disabled={page <= 1}
                    className="px-3 py-1 rounded border border-dark-lighter text-muted hover:border-primary/50 hover:text-light disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  <span>Page {page} of {totalPages}</span>
                  <button
                    onClick={() => { const p = page + 1; setPage(p); fetchEvents(activeTab, p); }}
                    disabled={page >= totalPages}
                    className="px-3 py-1 rounded border border-dark-lighter text-muted hover:border-primary/50 hover:text-light disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdminEventsPage() {
  return (
    <Suspense>
      <AdminEventsContent />
    </Suspense>
  );
}
