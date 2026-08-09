"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, RefreshCw, UserCheck } from "lucide-react";
import type { UserEvent } from "@/types";
import { getRegisteredEventIds, fetchSavedEventIds } from "@/lib/client-lists";
import { toUserEvents } from "@/lib/user-events";
import { useAuthContext } from "@/context/AuthContext";
import EventCard from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type FollowingOrganiser = {
  followId: string;
  id: string;
  orgName: string | null;
  logoUrl: string | null;
  followers: number;
  eventsHosted: number;
  registrations: number;
};

type RegStatus = "CONFIRMED" | "REFUND_REQUESTED";
type RegMeta = { id: string; eventId: string; status: RegStatus; wave: string | null; bibNumber: string | null };

type UserNotif = {
  id: string;
  type?: string;
  title: string;
  body: string;
  eventId: string | null;
  read: boolean;
  createdAt: string;
};

function NotificationsPanel({
  notifs,
  onMarkAllRead,
}: {
  notifs: UserNotif[];
  onMarkAllRead: () => void;
}) {
  const unread = notifs.filter((n) => !n.read).length;
  if (notifs.length === 0) return null;
  return (
    <div className="mb-9">
      <div className="flex items-center justify-between mb-3">
        <p className="inline-flex items-center gap-2 font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary">
          <Bell className="w-3.5 h-3.5" strokeWidth={2.4} /> Updates
          {unread > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-dark text-[10px] font-black">
              {unread}
            </span>
          )}
        </p>
        {unread > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="space-y-2">
        {notifs.slice(0, 5).map((n) => {
          const href =
            n.type === "ORGANISER_EVENT_LIVE" && n.eventId
              ? `/events/${n.eventId}`
              : null;
          const className = `flex items-start gap-3 rounded-xl border px-4 py-3 ${
            n.read ? "bg-dark border-dark-lighter" : "bg-primary/[0.07] border-primary/25"
          }${href ? " hover:border-primary/40 transition-colors" : ""}`;
          const inner = (
            <>
              <Bell className={`w-4 h-4 shrink-0 mt-0.5 ${n.read ? "text-muted-dark" : "text-primary"}`} strokeWidth={2.2} />
              <div className="min-w-0 flex-1">
                <p className="font-headline text-[13px] font-bold text-light">{n.title}</p>
                <p className="text-[12.5px] text-muted leading-relaxed mt-0.5">{n.body}</p>
                {n.type === "ORGANISER_EVENT_LIVE" && n.eventId && (
                  <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary mt-1.5">
                    View event
                  </p>
                )}
              </div>
              {!n.read && <span className="shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />}
            </>
          );
          return href ? (
            <Link key={n.id} href={href} className={className}>
              {inner}
            </Link>
          ) : (
            <div key={n.id} className={className}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RegisteredCard({
  event,
  meta,
  onRequestRefund,
}: {
  event: UserEvent;
  meta?: RegMeta;
  onRequestRefund: (meta: RegMeta) => void;
}) {
  const refundRequested = meta?.status === "REFUND_REQUESTED";
  return (
    <div className="flex flex-col">
      <EventCard
        event={event}
        cardClassName="rounded-b-none border-b-0 group-hover:ring-0"
      />
      <div
        className="bg-dark-light border border-dark-lighter rounded-b-xl px-4 py-3 flex items-center justify-between gap-3"
        style={{ borderTopStyle: "dashed" }}
      >
        <div className="min-w-0">
          <p className="font-headline text-[9.5px] font-bold uppercase tracking-widest text-muted-dark leading-none">
            Your Wave
          </p>
          <p className="font-headline text-[12px] font-bold uppercase tracking-widest text-light mt-1 truncate">
            {meta?.wave || "—"}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-headline text-[9.5px] font-bold uppercase tracking-widest text-muted-dark leading-none">
            Bib
          </p>
          <p className={`font-headline text-[13px] font-black mt-1 ${meta?.bibNumber ? "text-primary" : "text-muted-dark"}`}>
            {meta?.bibNumber ? `#${meta.bibNumber}` : "—"}
          </p>
        </div>
      </div>
      {meta && (
        <div className="mt-1.5 flex justify-end">
          {refundRequested ? (
            <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-amber-300">
              Refund requested
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onRequestRefund(meta)}
              className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark hover:text-red-300 transition-colors"
            >
              Request refund
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function OrganiserCard({
  organiser,
  onUnfollow,
}: {
  organiser: FollowingOrganiser;
  onUnfollow: (followId: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function unfollow() {
    setBusy(true);
    try {
      const res = await fetch(`/api/public/organisers/${organiser.id}/follow`, {
        method: "DELETE",
      });
      if (res.ok) onUnfollow(organiser.followId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col bg-dark border border-dark-lighter rounded-2xl p-5">
      <Link href={`/organisers/${organiser.id}`} className="group flex items-center gap-4">
        <span className="relative w-14 h-14 rounded-xl overflow-hidden bg-dark-lighter shrink-0">
          {organiser.logoUrl ? (
            <Image src={organiser.logoUrl} alt={`${organiser.orgName} logo`} fill className="object-cover" sizes="56px" />
          ) : (
            <span className="w-full h-full flex items-center justify-center font-headline text-xl font-black text-primary">
              {(organiser.orgName ?? "O").charAt(0)}
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block font-headline text-lg font-black tracking-tighter text-light group-hover:text-primary transition-colors leading-tight truncate">
            {organiser.orgName ?? "Organiser"}
          </span>
          <span className="flex items-center gap-2 mt-1 font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
            <span>{organiser.followers} followers</span>
            <span className="text-muted-dark">·</span>
            <span>{organiser.eventsHosted} events</span>
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={unfollow}
        disabled={busy}
        className="mt-4 inline-flex items-center justify-center gap-2 h-10 rounded-xl border border-dark-lighter text-muted hover:text-light hover:border-primary/50 font-headline text-[11px] font-bold uppercase tracking-widest transition-colors"
      >
        <UserCheck className="w-4 h-4" />
        {busy ? "Unfollowing..." : "Unfollow"}
      </button>
    </div>
  );
}

function EmptyState({ tab }: { tab: "registered" | "saved" | "following" }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="font-headline text-xl font-black tracking-tighter text-light">
        Nothing here yet.
      </p>
      <p className="font-headline text-sm text-light text-center max-w-xs leading-relaxed">
        {tab === "registered"
          ? "Register your interest in events to see them here."
          : tab === "saved"
            ? "Save events with the heart icon to find them later."
            : "Follow organisers to keep up with their upcoming events."}
      </p>
      <Link
        href="/events"
        className="mt-3 inline-flex items-center h-[46px] px-6 rounded-xl bg-machined text-dark font-headline text-[13px] font-black uppercase tracking-[0.12em] shadow-machined hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-all duration-150"
      >
        Find Events
      </Link>
    </div>
  );
}

export default function ActivityPage() {
  const { status } = useAuthContext();
  const [activeTab, setActiveTab] = useState<"registered" | "saved" | "following">("registered");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [registeredIds, setRegisteredIds] = useState(() => getRegisteredEventIds());
  const [following, setFollowing] = useState<FollowingOrganiser[]>([]);
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [regMeta, setRegMeta] = useState<Record<string, RegMeta>>({});
  const [eventsLoading, setEventsLoading] = useState(true);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [notifs, setNotifs] = useState<UserNotif[]>([]);
  const [refundTarget, setRefundTarget] = useState<{ meta: RegMeta; title: string } | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState("");

  const confirmRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    setRefundError("");
    try {
      const res = await fetch(`/api/user/registrations/${refundTarget.meta.id}/refund-request`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRefundError(json.error ?? "Could not request a refund.");
        return;
      }
      const { eventId } = refundTarget.meta;
      setRegMeta((prev) => ({
        ...prev,
        [eventId]: { ...prev[eventId], status: "REFUND_REQUESTED" },
      }));
      setRefundTarget(null);
    } catch {
      setRefundError("Could not request a refund. Check your connection.");
    } finally {
      setRefunding(false);
    }
  };

  const markAllRead = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    fetch("/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {});
  };

  useEffect(() => {
    fetch("/api/events")
      .then(r => r.ok ? r.json() : [])
      .then(data => { setEvents(Array.isArray(data) ? toUserEvents(data) : []); })
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    Promise.all([
      fetchSavedEventIds(),
      fetch("/api/user/following").then(r => r.ok ? r.json() : null),
      fetch("/api/user/notifications").then(r => r.ok ? r.json() : null),
      fetch("/api/user/registrations").then(r => r.ok ? r.json() : null),
    ])
      .then(([ids, followingData, notifData, regData]) => {
        if (cancelled) return;
        setSavedIds(ids);
        if (followingData?.organisers) setFollowing(followingData.organisers);
        if (Array.isArray(notifData?.notifications)) setNotifs(notifData.notifications);
        if (regData?.registrations) {
          const meta: Record<string, RegMeta> = {};
          const regIds: string[] = [];
          for (const r of regData.registrations as {
            id: string;
            eventId: string;
            status: RegStatus;
            wave: string | null;
            bibNumber: string | null;
          }[]) {
            meta[r.eventId] = {
              id: r.id,
              eventId: r.eventId,
              status: r.status,
              wave: r.wave,
              bibNumber: r.bibNumber,
            };
            regIds.push(r.eventId);
          }
          setRegMeta(meta);
          if (regIds.length > 0) {
            setRegisteredIds((prev) => Array.from(new Set([...prev, ...regIds])));
          }
        }
      })
      .finally(() => {
        if (!cancelled) setFollowingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  function onStorage(e: StorageEvent) {
    if (e.key === "startline_registered_interest") {
      setRegisteredIds(getRegisteredEventIds());
    }
  }
  function onLocalChange() {
    setRegisteredIds(getRegisteredEventIds());
  }

  useEffect(() => {
    window.addEventListener("storage", onStorage);
    window.addEventListener("startline-lists-changed", onLocalChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("startline-lists-changed", onLocalChange);
    };
  }, []);

  const savedEvents = events.filter((e) => savedIds.includes(String(e.id)));
  const registeredEvents = events.filter((e) => registeredIds.includes(String(e.id)));

  const tabCounts = {
    registered: registeredEvents.length,
    saved: savedEvents.length,
    following: following.length,
  };
  const tabLabels: Record<string, string> = {
    registered: "Registered",
    saved: "Saved",
    following: "Following",
  };

  return (
    <main className="min-h-screen bg-dark-darker">
      <div className="max-w-[1440px] mx-auto px-6 pt-20 pb-16">
        <div className="mb-8">
          <h1 className="font-headline text-5xl sm:text-[52px] font-black tracking-tighter text-light leading-none">
            Your activity<br /><span className="text-primary">calendar.</span>
          </h1>
        </div>

        <NotificationsPanel notifs={notifs} onMarkAllRead={markAllRead} />

        <div className="flex gap-2.5 mb-6">
          {(["registered", "saved", "following"] as const).map((id) => {
            const on = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`inline-flex items-center gap-2 px-[18px] py-2.5 rounded-full font-headline text-[12px] font-bold uppercase tracking-widest transition-all duration-150 ${
                  on
                    ? "bg-primary/10 border border-primary/40 text-primary"
                    : "bg-transparent border border-dark-lighter text-muted hover:text-light"
                }`}
              >
                {tabLabels[id]}
                <span
                  className={`font-headline text-[11px] font-bold ${on ? "text-primary" : "text-muted-dark"}`}
                >
                  {tabCounts[id]}
                </span>
              </button>
            );
          })}
        </div>

        {activeTab === "following" ? (
          followingLoading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-5 h-5 text-muted animate-spin" />
            </div>
          ) : following.length === 0 ? (
            <EmptyState tab="following" />
          ) : (
            <div
              className="grid gap-5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
            >
              {following.map((o) => (
                <OrganiserCard
                  key={o.followId}
                  organiser={o}
                  onUnfollow={(followId) => setFollowing((prev) => prev.filter((x) => x.followId !== followId))}
                />
              ))}
            </div>
          )
        ) : eventsLoading ? (
          <div className="space-y-5 py-2" role="status" aria-label="Loading">
            <div
              className="grid gap-5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
            >
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-dark border border-dark-lighter rounded-2xl overflow-hidden">
                  <Skeleton className="h-40 w-full rounded-none" />
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-8 w-full rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (activeTab === "registered" ? registeredEvents : savedEvents).length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
          >
            {activeTab === "registered"
              ? registeredEvents.map((event) => (
                  <RegisteredCard
                    key={event.id}
                    event={event}
                    meta={regMeta[String(event.id)]}
                    onRequestRefund={(meta) => {
                      setRefundError("");
                      setRefundTarget({ meta, title: event.title });
                    }}
                  />
                ))
              : savedEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
          </div>
        )}
      </div>

      <Dialog open={!!refundTarget} onOpenChange={(open) => { if (!open) setRefundTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a refund</DialogTitle>
            <DialogDescription>
              Ask the organiser of {refundTarget?.title} to refund your entry. You&apos;ll come out of the
              start list while it&apos;s reviewed. The organiser and Startline handle the refund itself.
            </DialogDescription>
          </DialogHeader>
          {refundError && <p className="text-[13px] text-red-300">{refundError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRefundTarget(null)}>Keep my spot</Button>
            <Button onClick={confirmRefund} disabled={refunding}>
              {refunding ? "Requesting…" : "Request refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
