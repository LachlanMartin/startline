"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertCircle, RefreshCw, CalendarDays, Star, Users as UsersIcon, ShieldCheck, ShieldX, Ban, CircleCheck, Building2, X, Crown, UserCog } from "lucide-react";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface OrganiserRow {
  id: string;
  orgName: string | null;
  contactName: string | null;
  email: string;
  phone: string | null;
  abn: string | null;
  status: string;
  verified: boolean;
  stripeOnboardingComplete: boolean;
  insuranceDeclared: boolean;
  createdAt: string;
  eventCount: number;
  liveEventCount: number;
  reviewCount: number;
  registrationCount: number;
  memberCount: number;
}

interface Member {
  id: string;
  role: "OWNER" | "MANAGER";
  user: { id: string; name: string | null; email: string };
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}

function OrganiserCard({
  o,
  onToggleVerify,
  onToggleSuspend,
  onViewMembers,
}: {
  o: OrganiserRow;
  onToggleVerify: (id: string) => void;
  onToggleSuspend: (id: string) => void;
  onViewMembers: (o: OrganiserRow) => void;
}) {
  const name    = o.orgName || o.contactName || o.email;
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="border-b border-white/[0.06] last:border-0 px-5 py-4">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-lg bg-dark-light text-light font-headline font-black italic flex items-center justify-center shrink-0 text-sm">
          {initial}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-1.5">
            <span className="font-headline text-[15px] font-black italic tracking-tighter text-light truncate">
              {name}
            </span>

            {o.status === "SUSPENDED" ? (
              <span className="inline-flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-400/10 text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Suspended
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Active
              </span>
            )}

            {o.stripeOnboardingComplete ? (
              <span className="inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-primary">
                <CheckCircle2 className="w-3.5 h-3.5" /> Stripe ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-amber-300">
                <AlertCircle className="w-3.5 h-3.5" /> Stripe pending
              </span>
            )}

            <button
              onClick={() => onToggleVerify(o.id)}
              className={`inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest transition-colors hover:underline ${
                o.verified ? "text-primary" : "text-muted-dark hover:text-muted"
              }`}
            >
              {o.verified
                ? <><ShieldCheck className="w-3.5 h-3.5" /> Verified</>
                : <><ShieldX className="w-3.5 h-3.5" /> Not verified</>}
            </button>

            <button
              onClick={() => onToggleSuspend(o.id)}
              className={`inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest transition-colors hover:underline ${
                o.status === "SUSPENDED" ? "text-primary" : "text-red-400 hover:text-red-300"
              }`}
            >
              {o.status === "SUSPENDED"
                ? <><CircleCheck className="w-3.5 h-3.5" /> Activate</>
                : <><Ban className="w-3.5 h-3.5" /> Suspend</>}
            </button>
          </div>

          <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark mb-2">
            {o.email}
            {o.abn && <span className="text-muted-dark"> · ABN {o.abn}</span>}
            <span className="text-muted-dark"> · Joined {formatDate(o.createdAt)}</span>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 font-headline text-[11px] uppercase tracking-widest text-muted">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-muted-dark" />
              {o.eventCount} event{o.eventCount !== 1 ? "s" : ""}
              {o.liveEventCount > 0 && (
                <span className="text-primary">({o.liveEventCount} live)</span>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <UsersIcon className="w-3.5 h-3.5 text-muted-dark" />
              {o.registrationCount} registration{o.registrationCount !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-muted-dark" />
              {o.reviewCount} review{o.reviewCount !== 1 ? "s" : ""}
            </span>
            <button onClick={() => onViewMembers(o)}
              className="flex items-center gap-1.5 text-muted hover:text-primary transition-colors"
            >
              <Building2 className="w-3.5 h-3.5 text-muted-dark" />
              {o.memberCount} member{o.memberCount !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminOrganisersPage() {
  const [organisers, setOrganisers] = useState<OrganiserRow[] | null>(null);
  const [viewOrg,    setViewOrg]    = useState<OrganiserRow | null>(null);
  const [members,    setMembers]    = useState<Member[] | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const loading     = organisers === null;

  const fetchOrganisers = useCallback(() => {
    fetch("/api/admin/organisers")
      .then(r => r.json())
      .then(data => { setOrganisers(Array.isArray(data) ? data : []); });
  }, []);

  useEffect(() => { fetchOrganisers(); }, [fetchOrganisers]);

  const viewMembers = useCallback(async (o: OrganiserRow) => {
    setViewOrg(o);
    setMembers(null);
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/admin/organisers/${o.id}/members`);
      const data = await res.json();
      setMembers(Array.isArray(data.members) ? data.members : []);
    } catch {
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const toggleVerify = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/organisers/${id}/verify`, { method: "PATCH" });
      if (res.ok) {
        const updated = await res.json() as { verified: boolean };
        setOrganisers((prev) => (prev ?? []).map((o) => o.id === id ? { ...o, verified: updated.verified } : o));
      }
    } catch { /* silent */ }
  }, []);

  const toggleSuspend = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/organisers/${id}/suspend`, { method: "PATCH" });
      if (res.ok) {
        const updated = await res.json() as { status: string };
        setOrganisers((prev) => (prev ?? []).map((o) => o.id === id ? { ...o, status: updated.status } : o));
      }
    } catch { /* silent */ }
  }, []);

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
                Organisers.
              </h1>
            </div>
            <button
              onClick={fetchOrganisers}
              className="self-start sm:self-end flex items-center gap-2 font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          <Card className="overflow-hidden">
            {loading && (
              <div className="p-12 text-center">
                <div className="w-5 h-5 border-2 border-dark-lighter border-t-primary rounded-full animate-spin mx-auto mb-3" />
                <div className="font-headline text-sm text-muted uppercase tracking-widest">Loading…</div>
              </div>
            )}

            {!loading && organisers.length === 0 && (
              <div className="p-12 text-center">
                <div className="font-headline text-lg font-black italic text-light mb-1">No organisers yet</div>
                <div className="text-muted text-sm">Organiser accounts will appear here once they sign up.</div>
              </div>
            )}

            {!loading && organisers.map((o) => (
              <OrganiserCard key={o.id} o={o} onToggleVerify={toggleVerify} onToggleSuspend={toggleSuspend} onViewMembers={viewMembers} />
            ))}
          </Card>

          {!loading && organisers.length > 0 && (
            <div className="mt-4 font-headline text-[12px] uppercase tracking-widest text-muted text-right">
              {organisers.length} organiser{organisers.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </main>

      {/* Members viewer modal */}
      {viewOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setViewOrg(null)}>
          <div className="bg-dark border border-dark-lighter rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-1">Members</div>
                <h3 className="font-headline text-lg font-black italic tracking-tighter text-light">{viewOrg.orgName || "Organisation"}</h3>
              </div>
              <button onClick={() => setViewOrg(null)} className="text-muted hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-2">
              {loadingMembers ? (
                <div className="py-8 text-center">
                  <div className="w-5 h-5 border-2 border-dark-lighter border-t-primary rounded-full animate-spin mx-auto mb-2" />
                  <div className="font-headline text-[12px] uppercase tracking-widest text-muted">Loading…</div>
                </div>
              ) : members?.length === 0 ? (
                <div className="py-8 text-center">
                  <Building2 className="w-6 h-6 text-white/20 mx-auto mb-2" />
                  <div className="font-headline text-[12px] uppercase tracking-widest text-muted">No members</div>
                </div>
              ) : (
                members?.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-dark-light/60 border border-white/[0.05]">
                    <div className="w-8 h-8 rounded-lg bg-dark-light font-headline font-black italic flex items-center justify-center shrink-0 text-xs text-light">
                      {(m.user.name ?? m.user.email)[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-headline text-[13px] font-bold text-light truncate">{m.user.name ?? m.user.email}</div>
                      <div className="font-headline text-[10px] uppercase tracking-widest text-muted truncate">{m.user.email}</div>
                    </div>
                    {m.role === "OWNER" ? (
                      <span className="inline-flex items-center gap-1 font-headline text-[9px] font-bold uppercase tracking-widest text-dark bg-primary rounded px-1.5 py-0.5 shrink-0">
                        <Crown className="w-3 h-3" /> Owner
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-headline text-[9px] font-bold uppercase tracking-widest text-white/40 border border-white/15 rounded px-1.5 py-0.5 shrink-0">
                        <UserCog className="w-3 h-3" /> Manager
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
