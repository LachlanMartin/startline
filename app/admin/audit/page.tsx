"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface AuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
  admin: { id: string; email: string; name: string | null };
}

const ACTION_COLORS: Record<string, string> = {
  APPROVE_EVENT:       "bg-primary/10 text-primary",
  REJECT_EVENT:        "bg-red-400/10 text-red-400",
  CREATE_EVENT:        "bg-primary/10 text-primary",
  EDIT_EVENT:          "bg-blue-400/10 text-blue-300",
  DELETE_EVENT:        "bg-red-400/10 text-red-400",
  PIN_EVENT:           "bg-blue-400/10 text-blue-300",
  UNPIN_EVENT:         "bg-white/[0.05] text-muted",
  BULK_APPROVE:        "bg-primary/10 text-primary",
  BULK_REJECT:         "bg-red-400/10 text-red-400",
  BULK_DELETE:         "bg-red-400/10 text-red-400",
  VERIFY_ORGANISER:    "bg-primary/10 text-primary",
  UNVERIFY_ORGANISER:  "bg-white/[0.05] text-muted",
  SUSPEND_ORGANISER:   "bg-red-400/10 text-red-400",
  ACTIVATE_ORGANISER:  "bg-primary/10 text-primary",
  BAN_USER:            "bg-red-400/10 text-red-400",
  UNBAN_USER:          "bg-primary/10 text-primary",
  EDIT_USER:           "bg-blue-400/10 text-blue-300",
  REFUND_REGISTRATION: "bg-amber-400/10 text-amber-300",
};

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-AU", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function metaSummary(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const parts: string[] = [];
  if (typeof meta.title       === "string") parts.push(meta.title);
  if (typeof meta.reason      === "string" && meta.reason) parts.push(`Reason: ${meta.reason}`);
  if (typeof meta.count       === "number") parts.push(`${meta.count} event${meta.count !== 1 ? "s" : ""}`);
  if (typeof meta.athleteName === "string") parts.push(meta.athleteName);
  if (typeof meta.amountCents === "number") parts.push(`$${((meta.amountCents as number) / 100).toFixed(2)}`);
  if (typeof meta.newStatus   === "string") parts.push(`→ ${meta.newStatus}`);
  if (Array.isArray(meta.fields) && meta.fields.length) parts.push(`${meta.fields.join(", ")} changed`);
  return parts.join(" · ");
}

const ALL_ACTIONS = [
  "APPROVE_EVENT", "REJECT_EVENT", "CREATE_EVENT", "EDIT_EVENT", "DELETE_EVENT", "PIN_EVENT", "UNPIN_EVENT",
  "BULK_APPROVE", "BULK_REJECT", "BULK_DELETE",
  "VERIFY_ORGANISER", "UNVERIFY_ORGANISER", "SUSPEND_ORGANISER", "ACTIVATE_ORGANISER",
  "BAN_USER", "UNBAN_USER", "EDIT_USER",
  "REFUND_REGISTRATION",
];

export default function AdminAuditPage() {
  const [logs,       setLogs]       = useState<AuditLog[] | null>(null);
  const loading = logs === null;
  const [filter,     setFilter]     = useState("");
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async (action: string, p: number) => {
    try {
      const params = new URLSearchParams({ page: String(p), limit: "50" });
      if (action) params.set("action", action);
      const res  = await fetch(`/api/admin/audit?${params}`);
      const data = await res.json() as { logs: AuditLog[]; total: number; totalPages: number };
      if (res.ok) {
        setLogs(data.logs);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } else {
        setLogs([]);
      }
    } catch {
      setLogs([]);
    }
  }, []);

  useEffect(() => { startTransition(() => fetchLogs(filter, page)); }, [filter, page, fetchLogs]);

  const handleFilterChange = (action: string) => {
    setFilter(action);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-dark-darker">
      <main className="pt-14">
        <div className="max-w-[1200px] mx-auto px-6 py-10 page-in">

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-2">
                Admin portal
              </div>
              <h1 className="font-headline text-[44px] font-black italic tracking-tighter leading-none text-light">
                Audit log.
              </h1>
            </div>
            <button
              onClick={() => fetchLogs(filter, page)}
              className="self-start sm:self-end flex items-center gap-2 font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => handleFilterChange("")}
              className={`font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors
                ${filter === ""
                  ? "bg-primary/10 text-primary border-primary"
                  : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}
            >
              All
            </button>
            {ALL_ACTIONS.map((action) => (
              <button
                key={action}
                onClick={() => handleFilterChange(action)}
                className={`font-headline text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors
                  ${filter === action
                    ? "bg-primary/10 text-primary border-primary"
                    : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"
                  }`}
              >
                {action.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          <Card className="overflow-hidden">
            {loading && (
              <div className="p-12 text-center">
                <div className="w-5 h-5 border-2 border-dark-lighter border-t-primary rounded-full animate-spin mx-auto mb-3" />
                <div className="font-headline text-sm text-muted uppercase tracking-widest">Loading…</div>
              </div>
            )}

            {!loading && logs.length === 0 && (
              <div className="p-12 text-center">
                <ShieldCheck className="w-8 h-8 text-dark-lighter mx-auto mb-3" />
                <div className="font-headline text-lg font-black italic text-light mb-1">
                  No audit entries yet
                </div>
                <div className="text-muted text-sm">
                  Admin actions will be recorded here automatically.
                </div>
              </div>
            )}

            {!loading && logs.map((log) => {
              const colorClass = ACTION_COLORS[log.action] ?? "bg-white/[0.05] text-muted";
              const summary    = metaSummary(log.meta);
              return (
                <div key={log.id} className="border-b border-white/[0.06] last:border-0 px-5 py-3.5">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 pt-0.5">
                      <span className={`inline-block font-headline text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${colorClass}`}>
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-headline text-[12px] uppercase tracking-widest text-muted">
                        <span className="text-light/80">{log.admin.name ?? log.admin.email}</span>
                        {" · "}<span className="capitalize">{log.targetType}</span>
                        {summary && <span className="text-muted-dark"> · {summary}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 font-headline text-[11px] uppercase tracking-widest text-muted-dark whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>

          {!loading && logs.length > 0 && (
            <div className="mt-4 flex items-center justify-between font-headline text-[12px] uppercase tracking-widest text-muted">
              <span>{total} entr{total !== 1 ? "ies" : "y"}</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1 rounded border border-dark-lighter text-muted hover:border-primary/50 hover:text-light disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  <span>Page {page} of {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
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
