"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { RefreshCw, UserCheck } from "lucide-react";
import type { UserEvent } from "@/types";
import { getRegisteredEventIds } from "@/lib/client-lists";
import { fetchSavedEventIds } from "@/lib/client-lists";
import { toUserEvents } from "@/lib/user-events";
import { useAuthContext } from "@/context/AuthContext";
import EventCard from "@/components/EventCard";

type FollowingOrganiser = {
  followId: string;
  id: string;
  orgName: string | null;
  logoUrl: string | null;
  followers: number;
  eventsHosted: number;
  registrations: number;
};

function RegisteredCard({ event }: { event: UserEvent }) {
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
            —
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-headline text-[9.5px] font-bold uppercase tracking-widest text-muted-dark leading-none">
            Bib
          </p>
          <p className="font-headline text-[13px] font-black italic text-muted-dark mt-1">
            —
          </p>
        </div>
      </div>
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
            <span className="w-full h-full flex items-center justify-center font-headline text-xl font-black italic text-primary">
              {(organiser.orgName ?? "O").charAt(0)}
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block font-headline text-lg font-black italic tracking-tighter text-light group-hover:text-primary transition-colors leading-tight truncate">
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
      <p className="font-headline text-xl font-black italic tracking-tighter text-light">
        Nothing here yet.
      </p>
      <p className="font-headline text-sm text-muted text-center max-w-xs leading-relaxed">
        {tab === "registered"
          ? "Register your interest in events to see them here."
          : tab === "saved"
            ? "Save events with the heart icon to find them later."
            : "Follow organisers to keep up with their upcoming events."}
      </p>
      <Link
        href={tab === "following" ? "/organisers" : "/events"}
        className="mt-2 font-headline text-[11px] font-bold uppercase tracking-widest text-primary hover:underline"
      >
        {tab === "following" ? "Browse Organisers" : "Browse Events"}
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
  const [eventsLoading, setEventsLoading] = useState(true);
  const [followingLoading, setFollowingLoading] = useState(false);

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
    Promise.all([fetchSavedEventIds(), fetch("/api/user/following").then(r => r.ok ? r.json() : null)])
      .then(([ids, followingData]) => {
        if (cancelled) return;
        setSavedIds(ids);
        if (followingData?.organisers) setFollowing(followingData.organisers);
      })
      .finally(() => setFollowingLoading(false));
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

        {/* Page header */}
        <div className="flex items-end justify-between gap-6 flex-wrap mb-8">
          <div>
            <p className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-2.5">
              Your Activity
            </p>
            <h1 className="font-headline text-5xl sm:text-[52px] font-black italic tracking-tighter text-light leading-none">
              Your race<br /><span className="text-primary">calendar.</span>
            </h1>
            <p className="font-headline text-[15px] text-muted max-w-[460px] leading-relaxed mt-4">
              Everything you&apos;ve entered, saved, and who you follow. Keep your start lines in one place.
            </p>
          </div>
          <Link
            href="/events"
            className="inline-flex items-center h-[46px] px-6 rounded-xl bg-machined text-dark font-headline text-[13px] font-black uppercase tracking-[0.12em] shadow-machined hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-all duration-150 flex-shrink-0"
          >
            Find Events
          </Link>
        </div>

        {/* KPI strip */}
        <div className="flex gap-4 flex-wrap mb-9">
          {[
            { n: registeredEvents.length, l: "Registered" },
            { n: savedEvents.length, l: "Saved" },
            { n: following.length, l: "Following" },
          ].map(({ n, l }) => (
            <div
              key={l}
              className="flex-1 min-w-[140px] bg-dark border border-dark-lighter rounded-xl"
              style={{ padding: "18px 20px" }}
            >
              <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted">{l}</p>
              <p className="font-headline text-[34px] font-black italic tracking-tighter text-light leading-none mt-2">
                {n}
              </p>
            </div>
          ))}
        </div>

        {/* Tab pills */}
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

        {/* Grid */}
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
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-5 h-5 text-muted animate-spin" />
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
                  <RegisteredCard key={event.id} event={event} />
                ))
              : savedEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
          </div>
        )}
      </div>
    </main>
  );
}
