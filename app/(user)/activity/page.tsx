"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, RefreshCw, UserCheck, Flag, Megaphone, Undo2, Banknote } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserEvent } from "@/types";
import { getRegisteredEventIds, fetchSavedEventIds } from "@/lib/client-lists";
import { toUserEvents } from "@/lib/user-events";
import { REFUND_PROCESS_COPY } from "@/lib/refund-policy";
import { ADDON_REFUND_NOTICE } from "@/lib/add-on-refunds";
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

type RegStatus = "CONFIRMED" | "REFUND_REQUESTED" | "REFUNDED";
type RegMeta = {
  id: string;
  eventId: string;
  status: RegStatus;
  wave: string | null;
  bibNumber: string | null;
  paidCents: number;
  refundAmountCents: number;
  refundPercent: number;
  outsidePolicy: boolean;
  policyLines: string[];
  daysUntilEvent: number;
  addOns: RegAddOn[];
};

/**
 * Merchandise bought with an entry. Refunded per item and independently of the
 * entry: no policy percentage, and the organiser decides.
 */
type RegAddOn = {
  id: string;
  name: string;
  optionLabel: string;
  variantLabel: string;
  imageUrl: string | null;
  quantity: number;
  status: string;
  paidCents: number;
  refundAmountCents: number;
  refundDeclinedAt: string | null;
  refundDeclineReason: string | null;
  canRequestRefund: boolean;
};

const money = (cents: number) => `A$${(cents / 100).toFixed(2)}`;

type UserNotif = {
  id: string;
  type?: string;
  title: string;
  body: string;
  eventId: string | null;
  read: boolean;
  createdAt: string;
};

/* One Bell on every row told you nothing about what had happened. Each type now
   gets its own silhouette - start flag, megaphone, return arrow, banknote - so
   the kind of update is readable before you read the text. Mirrors the organiser
   nav's notification tiles. */
const USER_NOTIF_STYLE: Record<string, { Icon: LucideIcon; tone: string }> = {
  WAVE_UPDATE:              { Icon: Flag,      tone: "bg-white/[0.06] text-light"   },
  ORGANISER_EVENT_LIVE:     { Icon: Megaphone, tone: "bg-primary/10 text-primary"   },
  ORGANISER_REFUND_REQUEST: { Icon: Undo2,     tone: "bg-amber-400/10 text-amber-300" },
  REFUND_PROCESSED:         { Icon: Banknote,  tone: "bg-primary/10 text-primary"   },
};

const FALLBACK_NOTIF_STYLE = { Icon: Bell, tone: "bg-white/[0.06] text-muted" };

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
      <div className="scroll-slim space-y-2 max-h-[22rem] overflow-y-auto overscroll-contain pr-1">
        {notifs.map((n) => {
          const href =
            n.type === "ORGANISER_EVENT_LIVE" && n.eventId
              ? `/events/${n.eventId}`
              : null;
          const className = `flex items-start gap-3 rounded-xl border px-4 py-3 ${
            n.read ? "bg-dark border-dark-lighter" : "bg-primary/[0.07] border-primary/25"
          }${href ? " hover:border-primary/40 transition-colors" : ""}`;
          const { Icon, tone } = USER_NOTIF_STYLE[n.type ?? ""] ?? FALLBACK_NOTIF_STYLE;
          const inner = (
            <>
              <span className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg ${tone}`}>
                <Icon className="w-4 h-4" strokeWidth={2.5} />
              </span>
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
  onRequestAddOnRefund,
}: {
  event: UserEvent;
  meta?: RegMeta;
  onRequestRefund: (meta: RegMeta) => void;
  onRequestAddOnRefund: (meta: RegMeta, addOn: RegAddOn) => void;
}) {
  const refundRequested = meta?.status === "REFUND_REQUESTED";
  const refunded = meta?.status === "REFUNDED";
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
      {meta && meta.addOns.length > 0 && (
        <div className="mt-1.5 rounded-xl border border-dark-lighter px-4 py-3">
          <p className="font-headline text-[9.5px] font-bold uppercase tracking-widest text-muted-dark leading-none mb-2">
            Extras
          </p>
          <div className="space-y-2">
            {meta.addOns.map((addOn) => {
              const label = addOn.variantLabel
                ? `${addOn.name} (${addOn.variantLabel})`
                : addOn.name;
              return (
                <div key={addOn.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12.5px] text-light truncate">
                      {addOn.quantity} x {label}
                    </p>
                    {addOn.refundDeclinedAt && addOn.status === "PURCHASED" && (
                      <p className="text-[11px] text-muted-dark mt-0.5">
                        Refund declined
                        {addOn.refundDeclineReason ? `: ${addOn.refundDeclineReason}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {addOn.status === "REFUNDED" ? (
                      <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted">
                        Refunded {money(addOn.refundAmountCents)}
                      </span>
                    ) : addOn.status === "REFUND_REQUESTED" ? (
                      <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-amber-300">
                        Refund requested
                      </span>
                    ) : addOn.canRequestRefund ? (
                      <button
                        type="button"
                        onClick={() => onRequestAddOnRefund(meta, addOn)}
                        className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark hover:text-red-300 transition-colors"
                      >
                        Request refund
                      </button>
                    ) : (
                      <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark">
                        {money(addOn.paidCents)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {meta && (
        <div className="mt-1.5 flex justify-end">
          {refunded ? (
            <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted">
              Refunded {money(meta.refundAmountCents)}
            </span>
          ) : refundRequested ? (
            <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-amber-300">
              Refund requested{meta.refundAmountCents > 0 ? ` · ${money(meta.refundAmountCents)}` : ""}
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
  const [addOnRefundTarget, setAddOnRefundTarget] = useState<{
    meta: RegMeta;
    addOn: RegAddOn;
    title: string;
  } | null>(null);

  const confirmAddOnRefund = async () => {
    if (!addOnRefundTarget) return;
    setRefunding(true);
    setRefundError("");
    try {
      const { meta, addOn } = addOnRefundTarget;
      const res = await fetch(
        `/api/user/registrations/${meta.id}/add-ons/${addOn.id}/refund-request`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRefundError(data.error ?? "Could not send that request.");
        return;
      }
      // Reflect it immediately; the organiser decides from here.
      setRegMeta((prev) => {
        const current = prev[String(meta.eventId)];
        if (!current) return prev;
        return {
          ...prev,
          [String(meta.eventId)]: {
            ...current,
            addOns: current.addOns.map((a) =>
              a.id === addOn.id
                ? { ...a, status: "REFUND_REQUESTED", canRequestRefund: false }
                : a,
            ),
          },
        };
      });
      setAddOnRefundTarget(null);
    } finally {
      setRefunding(false);
    }
  };

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
      // Take the server's frozen snapshot rather than keeping the local estimate,
      // so the card shows exactly what was recorded against the entry.
      setRegMeta((prev) => ({
        ...prev,
        [eventId]: {
          ...prev[eventId],
          status: "REFUND_REQUESTED",
          refundAmountCents: json.refundAmountCents ?? prev[eventId]?.refundAmountCents ?? 0,
          refundPercent: json.refundPercent ?? prev[eventId]?.refundPercent ?? 0,
          outsidePolicy: json.outsidePolicy ?? prev[eventId]?.outsidePolicy ?? false,
        },
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
          for (const r of regData.registrations as RegMeta[]) {
            meta[r.eventId] = {
              id: r.id,
              eventId: r.eventId,
              status: r.status,
              wave: r.wave,
              bibNumber: r.bibNumber,
              paidCents: r.paidCents ?? 0,
              refundAmountCents: r.refundAmountCents ?? 0,
              refundPercent: r.refundPercent ?? 0,
              outsidePolicy: r.outsidePolicy ?? false,
              policyLines: r.policyLines ?? [],
              addOns: Array.isArray(r.addOns) ? r.addOns : [],
              daysUntilEvent: r.daysUntilEvent ?? 0,
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
                    onRequestAddOnRefund={(meta, addOn) => {
                      setRefundError("");
                      setAddOnRefundTarget({ meta, addOn, title: event.title });
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
              {refundTarget?.title}. You will come out of the start list and free your spot.
            </DialogDescription>
          </DialogHeader>

          {refundTarget && (
            <div className="space-y-3">
              {/* The number first. This is what the athlete is actually deciding on. */}
              <div className="rounded-md bg-dark px-4 py-3">
                {refundTarget.meta.outsidePolicy ? (
                  <>
                    <p className="font-headline text-[13px] font-bold uppercase tracking-widest text-amber-300">
                      No refund at this date
                    </p>
                    <p className="text-[13px] text-muted leading-relaxed mt-1">
                      The event is {refundTarget.meta.daysUntilEvent} day
                      {refundTarget.meta.daysUntilEvent === 1 ? "" : "s"} away, which falls outside this
                      event&apos;s policy. You can still ask the organiser to consider it, and they will see
                      it is a discretionary request.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-headline text-[20px] font-black italic tracking-tighter text-primary">
                      {money(refundTarget.meta.refundAmountCents)} back
                    </p>
                    <p className="text-[13px] text-muted leading-relaxed mt-1">
                      You paid {money(refundTarget.meta.paidCents)}. The event is{" "}
                      {refundTarget.meta.daysUntilEvent} day
                      {refundTarget.meta.daysUntilEvent === 1 ? "" : "s"} away, so this event&apos;s policy
                      returns {refundTarget.meta.refundPercent}%.
                    </p>
                  </>
                )}
              </div>

              <div>
                <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark mb-1">
                  This event&apos;s policy
                </p>
                {refundTarget.meta.policyLines.map((line, i) => (
                  <p key={i} className="text-[12px] text-muted leading-relaxed">{line}</p>
                ))}
              </div>

              <p className="text-[12px] text-muted-dark leading-relaxed">{REFUND_PROCESS_COPY}</p>
            </div>
          )}

          {refundError && <p className="text-[13px] text-red-300">{refundError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRefundTarget(null)}>Keep my spot</Button>
            <Button onClick={confirmRefund} disabled={refunding}>
              {refunding
                ? "Requesting…"
                : refundTarget?.meta.outsidePolicy
                  ? "Ask anyway"
                  : `Request ${money(refundTarget?.meta.refundAmountCents ?? 0)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add-on refunds are a different transaction from an entry refund: no
          policy percentage, no effect on the start list, and the organiser
          decides. The copy says exactly that and nothing more. */}
      <Dialog
        open={!!addOnRefundTarget}
        onOpenChange={(open) => { if (!open) setAddOnRefundTarget(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a refund for this item</DialogTitle>
            <DialogDescription>
              {addOnRefundTarget?.title}. Your entry is not affected.
            </DialogDescription>
          </DialogHeader>

          {addOnRefundTarget && (
            <div className="space-y-3">
              <div className="rounded-md bg-dark px-4 py-3">
                <p className="font-headline text-[20px] font-black italic tracking-tighter text-primary">
                  {money(addOnRefundTarget.addOn.refundAmountCents)} back
                </p>
                <p className="text-[13px] text-muted leading-relaxed mt-1">
                  {addOnRefundTarget.addOn.quantity} x{" "}
                  {addOnRefundTarget.addOn.variantLabel
                    ? `${addOnRefundTarget.addOn.name} (${addOnRefundTarget.addOn.variantLabel})`
                    : addOnRefundTarget.addOn.name}
                  , which you paid {money(addOnRefundTarget.addOn.paidCents)} for.
                </p>
              </div>

              <p className="text-[12px] text-muted-dark leading-relaxed">
                {ADDON_REFUND_NOTICE} Your race entry, start wave and bib stay exactly as they are.
              </p>
            </div>
          )}

          {refundError && <p className="text-[13px] text-red-300">{refundError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOnRefundTarget(null)}>
              Keep it
            </Button>
            <Button onClick={confirmAddOnRefund} disabled={refunding}>
              {refunding
                ? "Requesting…"
                : `Request ${money(addOnRefundTarget?.addOn.refundAmountCents ?? 0)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
