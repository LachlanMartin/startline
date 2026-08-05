"use client";

import { useState, useEffect, useCallback, Suspense, startTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Search, RefreshCw, RotateCcw, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

type RegStatus = "CONFIRMED" | "CANCELLED" | "REFUNDED" | "REFUND_REQUESTED";

interface Registration {
  id: string;
  athleteName: string;
  athleteEmail: string;
  category: string | null;
  waveLabel: string | null;
  amountCents: number;
  platformFeeCents: number;
  feeStructure: string;
  status: RegStatus;
  stripePaymentIntentId: string | null;
  createdAt: string;
  event: { id: string; title: string; eventDate: string; city: string; state: string };
  organiser: { id: string; orgName: string | null; contactName: string | null; email: string };
}

const STATUS_TABS: { status: RegStatus | "ALL"; label: string }[] = [
  { status: "ALL",              label: "All"              },
  { status: "CONFIRMED",        label: "Confirmed"        },
  { status: "REFUND_REQUESTED", label: "Refund requested" },
  { status: "REFUNDED",         label: "Refunded"         },
  { status: "CANCELLED",        label: "Cancelled"        },
];

const STATUS_STYLE: Record<RegStatus, { bg: string; text: string; dot: string }> = {
  CONFIRMED:         { bg: "bg-primary/10",   text: "text-primary",   dot: "bg-primary"   },
  CANCELLED:         { bg: "bg-white/[0.05]", text: "text-muted",     dot: "bg-muted-dark" },
  REFUND_REQUESTED:  { bg: "bg-blue-400/10",  text: "text-blue-300",  dot: "bg-blue-400"  },
  REFUNDED:          { bg: "bg-amber-400/10", text: "text-amber-300", dot: "bg-amber-400"  },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatAud(cents: number) {
  return cents === 0 ? "Free" : `$${(cents / 100).toFixed(2)}`;
}

function RegistrationRow({
  reg,
  onRefunded,
}: {
  reg: Registration;
  onRefunded: (id: string) => void;
}) {
  const [refunding,  setRefunding]  = useState(false);
  const [error,      setError]      = useState("");
  const [confirming, setConfirming] = useState(false);

  const organiserName = reg.organiser.orgName || reg.organiser.contactName || reg.organiser.email;
  const s = STATUS_STYLE[reg.status];

  const handleRefund = async () => {
    if (!confirming) { setConfirming(true); return; }
    setRefunding(true);
    setError("");
    setConfirming(false);
    try {
      const res = await fetch(`/api/admin/registrations/${reg.id}/refund`, { method: "POST" });
      if (res.ok) {
        onRefunded(reg.id);
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Refund failed.");
      }
    } finally {
      setRefunding(false);
    }
  };

  return (
    <div className="border-b border-white/[0.06] last:border-0 px-5 py-4">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
            <span className="font-headline text-[15px] font-black italic tracking-tighter text-light">
              {reg.athleteName}
            </span>
            <span className={`inline-flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              {reg.status.charAt(0) + reg.status.slice(1).toLowerCase()}
            </span>
            <span className="font-headline text-[13px] font-bold text-light">
              {formatAud(reg.amountCents)}
            </span>
            {reg.platformFeeCents > 0 && (
              <span className="font-headline text-[11px] text-muted-dark uppercase tracking-widest">
                +{formatAud(reg.platformFeeCents)} fee
              </span>
            )}
          </div>

          <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark mb-1">
            {reg.athleteEmail}
            {reg.category  && <span> · {reg.category}</span>}
            {reg.waveLabel && <span> · {reg.waveLabel}</span>}
          </div>

          <div className="font-headline text-[11px] uppercase tracking-widest text-muted">
            <span className="text-light/80">{reg.event.title}</span>
            {" · "}{reg.event.city}, {reg.event.state.toUpperCase()}
            {" · "}{formatDate(reg.event.eventDate)}
          </div>

          <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark mt-0.5">
            By {organiserName} · Registered {formatDate(reg.createdAt)}
          </div>

          {error && (
            <div className="mt-2 text-[12px] text-red-400 bg-red-500/10 rounded px-3 py-1.5 border border-red-500/20">
              {error}
            </div>
          )}
        </div>

        {reg.status === "CONFIRMED" && (
          <div className="shrink-0 ml-auto pl-2 flex items-center gap-2">
            {confirming && (
              <span className="font-headline text-[11px] text-amber-300 uppercase tracking-widest">
                Confirm?
              </span>
            )}
            <button
              onClick={handleRefund}
              disabled={refunding}
              className={`flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest px-3 py-2 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                ${confirming
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "border border-amber-400/30 text-amber-300 hover:bg-amber-400/10"
                }`}
            >
              {refunding
                ? <span className="w-3 h-3 border border-current/40 border-t-current rounded-full animate-spin" />
                : confirming
                  ? <><RotateCcw className="w-3.5 h-3.5" /> Yes, refund</>
                  : <><DollarSign className="w-3.5 h-3.5" /> Refund</>}
            </button>
            {confirming && (
              <button
                onClick={() => setConfirming(false)}
                className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light transition-colors px-2"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RegistrationsContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId") ?? undefined;

  const [regs,       setRegs]       = useState<Registration[] | null>(null);
  const loading = regs === null;
  const [search,     setSearch]     = useState("");
  const [query,      setQuery]      = useState("");
  const [activeTab,  setActiveTab]  = useState<RegStatus | "ALL">("ALL");
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchRegs = useCallback(async (status: RegStatus | "ALL", q: string, p: number) => {
    try {
      const params = new URLSearchParams({ page: String(p), limit: "50" });
      if (status !== "ALL") params.set("status", status);
      if (q) params.set("search", q);
      if (eventId) params.set("eventId", eventId);
      const res  = await fetch(`/api/admin/registrations?${params}`);
      const data = await res.json() as { registrations: Registration[]; total: number; totalPages: number };
      if (res.ok) {
        setRegs(data.registrations);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } else {
        setRegs([]);
      }
    } catch {
      setRegs([]);
    }
  }, [eventId]);

  useEffect(() => { startTransition(() => fetchRegs(activeTab, query, page)); }, [activeTab, query, page, fetchRegs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(search);
  };

  const handleRefunded = (id: string) => {
    setRegs((prev) => (prev ?? []).map((r) => r.id === id ? { ...r, status: "REFUNDED" } : r));
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
                Registrations.
              </h1>
              {eventId && (
                <p className="text-[13px] text-muted mt-2">Filtered by event</p>
              )}
            </div>
            <button
              onClick={() => fetchRegs(activeTab, query, page)}
              className="self-start sm:self-end flex items-center gap-2 font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
              <input
                type="text"
                placeholder="Search by athlete name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-[14px] bg-dark-light border border-dark-lighter rounded-lg text-light placeholder:text-muted-dark focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <button
              type="submit"
              className="font-headline text-[12px] font-bold uppercase tracking-widest bg-machined shadow-machined text-dark px-5 py-2.5 rounded-lg hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform"
            >
              Search
            </button>
            {query && (
              <button
                type="button"
                onClick={() => { setSearch(""); setQuery(""); setPage(1); }}
                className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light px-3 py-2.5 transition-colors"
              >
                Clear
              </button>
            )}
          </form>

          {/* Status tabs */}
          <div className="flex gap-1 mb-6 border-b border-dark-lighter">
            {STATUS_TABS.map(({ status, label }) => (
              <button
                key={status}
                onClick={() => { setActiveTab(status); setPage(1); }}
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
            {loading && <TableSkeleton rows={6} cols={5} className="p-6" />}

            {!loading && regs.length === 0 && (
              <div className="p-12 text-center">
                <div className="font-headline text-lg font-black italic text-light mb-1">No registrations</div>
                <div className="text-muted text-sm">
                  {query
                    ? `No registrations match "${query}".`
                    : "No registrations found for this filter."}
                </div>
              </div>
            )}

            {!loading && regs.map((r) => (
              <RegistrationRow key={r.id} reg={r} onRefunded={handleRefunded} />
            ))}
          </Card>

          {!loading && regs.length > 0 && (
            <div className="mt-4 flex items-center justify-between font-headline text-[12px] uppercase tracking-widest text-muted">
              <span>{total} registration{total !== 1 ? "s" : ""}</span>
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

export default function AdminRegistrationsPage() {
  return (
    <Suspense>
      <RegistrationsContent />
    </Suspense>
  );
}
