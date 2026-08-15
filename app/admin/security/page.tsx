"use client";

import { useState, useEffect, Suspense, startTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ShieldAlert, Flag, RefreshCw, Bot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

type Filter = "all" | "bot_check_failed" | "review_reported";

interface SecurityEventRow {
  id: string;
  type: string;
  action: string | null;
  ip: string | null;
  userId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

interface ReviewReportRow {
  id: string;
  reason: string | null;
  createdAt: string;
  review: {
    id: string;
    reviewerName: string;
    title: string;
    body: string;
    overallRating: number;
    isPublished: boolean;
    organiser: { id: string; orgName: string | null };
  };
}

const TABS: { filter: Filter; label: string }[] = [
  { filter: "all",              label: "All"       },
  { filter: "bot_check_failed", label: "Bot checks" },
  { filter: "review_reported",  label: "Reports"   },
];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-AU", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function AdminSecurityContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const filterParam  = (searchParams.get("type") ?? "all").toLowerCase() as Filter;
  const activeFilter = TABS.find((t) => t.filter === filterParam)?.filter ?? "all";

  const [events, setEvents] = useState<SecurityEventRow[] | null>(null);
  const [reports, setReports] = useState<ReviewReportRow[] | null>(null);
  const loading = events === null || reports === null;

  const fetchData = (filter: Filter) => {
    fetch(`/api/admin/security?type=${filter}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(Array.isArray(data.events) ? data.events : []);
        setReports(Array.isArray(data.reports) ? data.reports : []);
      });
  };

  useEffect(() => {
    startTransition(() => fetchData(activeFilter));
  }, [activeFilter]);

  const switchFilter = (filter: Filter) => {
    router.push(`/admin/security?type=${filter}`, { scroll: false });
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
                Security.
              </h1>
            </div>
            <button
              onClick={() => fetchData(activeFilter)}
              className="self-start sm:self-end flex items-center gap-2 font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-dark-lighter">
            {TABS.map(({ filter, label }) => (
              <button
                key={filter}
                onClick={() => switchFilter(filter)}
                className={`font-headline text-[13px] font-bold uppercase tracking-widest px-5 py-2.5 border-b-2 transition-colors -mb-px
                  ${activeFilter === filter
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-light"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading && <TableSkeleton rows={6} cols={4} className="p-6" />}

          {!loading && (
            <div className="space-y-8">
              {/* Failed bot checks */}
              <div>
                <h2 className="flex items-center gap-2 font-headline text-[13px] font-bold uppercase tracking-widest text-light mb-3">
                  <Bot className="w-4 h-4 text-muted" /> Failed bot checks
                </h2>
                <Card className="overflow-hidden">
                  {events.length === 0 ? (
                    <div className="p-8 text-center text-muted text-sm">No failed bot checks recorded.</div>
                  ) : (
                    events.map((e) => (
                      <div key={e.id} className="border-b border-white/[0.06] last:border-0 px-5 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-headline text-[12px] font-bold uppercase tracking-widest text-light">
                              {e.action ?? e.type}
                            </div>
                            <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark truncate">
                              {e.ip ? `IP ${e.ip}` : "no IP"}
                              {e.userId ? ` · user ${e.userId}` : ""}
                            </div>
                          </div>
                        </div>
                        <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark shrink-0">
                          {formatDate(e.createdAt)}
                        </div>
                      </div>
                    ))
                  )}
                </Card>
              </div>

              {/* Reported reviews */}
              <div>
                <h2 className="flex items-center gap-2 font-headline text-[13px] font-bold uppercase tracking-widest text-light mb-3">
                  <Flag className="w-4 h-4 text-muted" /> Reported reviews
                </h2>
                <Card className="overflow-hidden">
                  {reports.length === 0 ? (
                    <div className="p-8 text-center text-muted text-sm">No reported reviews.</div>
                  ) : (
                    reports.map((r) => (
                      <div key={r.id} className="border-b border-white/[0.06] last:border-0 px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="font-headline text-[14px] font-bold text-light mb-0.5">
                              {r.review.title}
                              {!r.review.isPublished && (
                                <span className="ml-2 inline-flex font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark">
                                  Hidden
                                </span>
                              )}
                            </div>
                            <p className="text-[13px] text-muted leading-relaxed mb-1.5">{r.review.body}</p>
                            <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark">
                              {r.review.reviewerName}
                              <span className="text-dark-lighter"> · {r.review.organiser.orgName ?? r.review.organiser.id}</span>
                              {r.reason && <span className="text-red-400"> · report: {r.reason}</span>}
                            </div>
                          </div>
                          <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark shrink-0">
                            {formatDate(r.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdminSecurityPage() {
  return (
    <Suspense>
      <AdminSecurityContent />
    </Suspense>
  );
}
