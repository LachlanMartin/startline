"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CalendarDays, ArrowRight, MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import DashboardTrendChart, {
  type TrendDay,
} from "@/components/organiser/DashboardTrendChart";
import CapacityBar from "@/components/ui/CapacityBar";
import { formatAudFromCents } from "@/lib/organiser-dashboard";

type EventStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

const STATUS_ORDER: Record<EventStatus, number> = {
  APPROVED: 0,
  PENDING:  1,
  REJECTED: 2,
  DRAFT:    3,
  ARCHIVED: 4,
};

interface EventRow {
  id: string;
  title: string;
  discipline: string;
  city: string;
  state: string;
  eventDate: string;
  startTime: string;
  status: EventStatus;
  waves: { price: string }[];
  cap?: number | null;
  coverImageUrl?: string | null;
  registrationCount: number;
  registrationUrl?: string | null;
}

type DashboardPayload = {
  current: {
    live: number;
    racingIn30Days: number;
    capacityFilledPct: number | null;
    liveRegistrations: number;
  };
  allTime: {
    registrations: number;
    revenueCents: number;
    followers: number;
    events: number;
  };
  events: EventRow[];
  trend: { days: TrendDay[]; rangeDays?: number };
};

function formatEventDate(dateStr: string, startTime: string) {
  try {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    const time = startTime
      ? new Date(`1970-01-01T${startTime}`).toLocaleTimeString("en-AU", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).toLowerCase()
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

function MetricCell({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="text-center min-w-[72px]">
      <div className="font-headline text-xl sm:text-2xl font-black tracking-tighter text-light leading-none">
        {value}
      </div>
      <div className="font-headline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted mt-1">
        {label}
      </div>
    </div>
  );
}

function MetricStrip({
  eyebrow,
  items,
}: {
  eyebrow: string;
  items: { label: string; value: string | number }[];
}) {
  return (
    <div>
      <p className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-3">
        {eyebrow}
      </p>
      <div className="flex flex-wrap items-end gap-4 sm:gap-6 lg:gap-8">
        {items.map((item) => (
          <MetricCell key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  return n.toLocaleString("en-AU");
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendEventId, setTrendEventId] = useState("");
  const [trendRangeDays, setTrendRangeDays] = useState(30);

  const load = useCallback(async (eventId: string, rangeDays: number) => {
    const params = new URLSearchParams();
    if (eventId) params.set("eventId", eventId);
    params.set("days", String(rangeDays));
    const qs = params.toString();
    const res = await fetch(`/api/organiser/dashboard${qs ? `?${qs}` : ""}`);
    if (!res.ok) return null;
    return (await res.json()) as DashboardPayload;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initial = data == null;
    load(trendEventId, trendRangeDays)
      .then((payload) => {
        if (!cancelled && payload) setData(payload);
      })
      .finally(() => {
        if (!cancelled && initial) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Intentionally omit `data` — only reload when filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, trendEventId, trendRangeDays]);

  const events = data?.events ?? [];

  const recent = [...events]
    .filter((e) => e.status !== "ARCHIVED")
    .sort((a, b) => {
      const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (diff !== 0) return diff;
      return a.eventDate.localeCompare(b.eventDate);
    })
    .slice(0, 3);

  const allTimeItems = loading || !data
    ? [
        { label: "Registrations", value: "—" },
        { label: "Revenue (est.)", value: "—" },
        { label: "Followers", value: "—" },
        { label: "Events", value: "—" },
      ]
    : [
        { label: "Registrations", value: formatCount(data.allTime.registrations) },
        { label: "Revenue (est.)", value: formatAudFromCents(data.allTime.revenueCents) },
        { label: "Followers", value: formatCount(data.allTime.followers) },
        { label: "Events", value: formatCount(data.allTime.events) },
      ];

  return (
    <div className="min-h-screen bg-dark-darker">
      <main className="pt-14">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-5 sm:py-10 pb-24 lg:pb-12 page-in">

          {/* Metrics + actions */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-10">
            <MetricStrip eyebrow="All time" items={allTimeItems} />
            <div className="flex items-center gap-2 self-start sm:self-end shrink-0">
              <Button asChild size="lg" variant="outline">
                <Link href="/organiser/new-listing">
                  <Plus className="w-4 h-4" /> Add listing
                </Link>
              </Button>
              <Button asChild size="lg">
                <Link href="/organiser/listings">
                  <CalendarDays className="w-4 h-4" /> View my events
                </Link>
              </Button>
            </div>
          </div>

          {/* Trend chart */}
          <DashboardTrendChart
            days={data?.trend.days ?? []}
            events={events.map((e) => ({ id: e.id, title: e.title }))}
            eventId={trendEventId}
            onEventChange={setTrendEventId}
            rangeDays={trendRangeDays}
            onRangeDaysChange={setTrendRangeDays}
          />

          {/* Recent events */}
          <section className="stagger-item" style={{ animationDelay: "160ms" }}>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="font-headline text-lg sm:text-xl font-black italic tracking-tighter text-white">
                Your upcoming events
              </h2>
              <Link
                href="/organiser/listings"
                className="font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary flex items-center gap-1 transition-colors"
              >
                See all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <Card>
              <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-white/[0.02] border-b border-dark-lighter font-headline font-bold text-[11px] uppercase tracking-widest text-muted-dark rounded-t-xl">
                <div className="col-span-5">Event</div>
                <div className="col-span-2 text-center">Date</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-2">Registered / Cap</div>
                <div className="col-span-1" />
              </div>

              {loading && <TableSkeleton rows={4} cols={3} className="p-6" />}

              {!loading && recent.length === 0 && (
                <div className="p-10 text-center">
                  <div className="font-headline text-lg font-black italic text-white mb-1">
                    Nothing here yet
                  </div>
                  <div className="text-muted-dark text-sm mb-5">
                    Create your first listing to get started.
                  </div>
                  <Button asChild>
                    <Link href="/organiser/new-listing">
                      <CalendarDays className="w-4 h-4" /> Add new listing
                    </Link>
                  </Button>
                </div>
              )}

              {!loading &&
                recent.map((e, i) => {
                  const s = STATUS_STYLE[e.status];
                  const price = (e.waves as { price: string }[])?.[0]?.price;
                  const href =
                    e.status === "APPROVED"
                      ? `/organiser/events/${e.id}/dashboard`
                      : `/organiser/events/${e.id}`;
                  return (
                    <div
                      key={e.id}
                      className={i < recent.length - 1 ? "border-b border-white/5" : ""}
                    >
                      {/* Mobile card */}
                      <div
                        className="sm:hidden flex items-center gap-3 px-4 py-3.5 cursor-pointer active:bg-white/5 transition-colors"
                        onClick={() => router.push(href)}
                      >
                        <div className="relative w-12 h-12 rounded-lg bg-dark-light flex items-center justify-center shrink-0 overflow-hidden">
                          {e.coverImageUrl ? (
                            <Image
                              src={e.coverImageUrl}
                              alt={e.title}
                              fill
                              className="pointer-events-none object-cover brightness-[.62] saturate-110"
                              sizes="48px"
                            />
                          ) : (
                            <div className="font-mono text-[9px] text-muted-dark uppercase">
                              {e.discipline.slice(0, 4)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 mb-0.5">
                            <div className="font-headline text-[14px] font-black italic tracking-tighter text-white leading-tight line-clamp-1 flex-1">
                              {e.title}
                            </div>
                            <Badge className={`${s.bg} ${s.text} border-0 text-[10px] shrink-0`}>
                              {s.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 font-headline text-[10px] text-muted-dark uppercase tracking-widest mb-1">
                            <MapPin className="w-3 h-3 text-primary shrink-0" /> {e.city},{" "}
                            {e.state.toUpperCase()}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-headline text-[11px] text-muted">
                              {formatEventDate(e.eventDate, e.startTime)}
                            </div>
                            <div className="text-right shrink-0 w-[112px]">
                              <div className="font-headline text-[12px] font-bold text-white tabular-nums">
                                {(e.registrationCount ?? 0).toLocaleString()}
                                {e.cap != null ? (
                                  <span className="text-muted-dark font-normal">
                                    {" "}
                                    / {e.cap.toLocaleString()}
                                  </span>
                                ) : null}
                              </div>
                              <CapacityBar
                                count={e.registrationCount ?? 0}
                                cap={e.cap}
                                className="mt-1.5 w-full"
                              />
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-dark shrink-0" />
                      </div>

                      {/* Desktop row — inset rail (no layout shift vs hover:border-l) */}
                      <div
                        className={`hidden sm:grid grid-cols-12 gap-4 px-5 py-4 items-center cursor-pointer transition-colors
                        ${
                          e.status === "APPROVED"
                            ? "hover:bg-primary/5 hover:shadow-[inset_2px_0_0_0_#B3E153]"
                            : "hover:bg-white/5 hover:shadow-[inset_2px_0_0_0_#353535]"
                        }`}
                        onClick={() => router.push(href)}
                      >
                        <div className="col-span-5 flex items-center gap-4 min-w-0">
                          <div className="relative w-14 h-14 rounded-lg bg-dark-light flex items-center justify-center shrink-0 overflow-hidden">
                            {e.coverImageUrl ? (
                              <Image
                                src={e.coverImageUrl}
                                alt={e.title}
                                fill
                                className="pointer-events-none object-cover brightness-[.62] saturate-110"
                                sizes="56px"
                              />
                            ) : (
                              <div className="font-mono text-[9px] text-muted-dark uppercase">
                                {e.discipline.slice(0, 4)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-headline text-[15px] font-black italic tracking-tighter text-white">
                              {e.title}
                            </div>
                            <div className="flex items-center gap-1 font-headline text-[11px] text-muted-dark uppercase tracking-widest mt-0.5">
                              <MapPin className="w-3 h-3 text-primary" /> {e.city},{" "}
                              {e.state.toUpperCase()}
                            </div>
                          </div>
                        </div>
                        <div className="col-span-2 text-center">
                          <div className="font-headline text-sm font-bold text-muted">
                            {formatEventDate(e.eventDate, e.startTime)}
                          </div>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <Badge className={`${s.bg} ${s.text} border-0`}>{s.label}</Badge>
                        </div>
                        <div className="col-span-2">
                          <div className="font-headline text-sm font-bold text-white">
                            {(e.registrationCount ?? 0).toLocaleString()}
                            {e.cap ? (
                              <span className="text-muted-dark font-normal">
                                {" "}
                                / {e.cap.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-muted-dark font-normal"> / —</span>
                            )}
                          </div>
                          <CapacityBar
                            count={e.registrationCount ?? 0}
                            cap={e.cap}
                            className="mt-1.5 w-full max-w-[88px]"
                          />
                          {price && (
                            <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-0.5">
                              from A${price}
                            </div>
                          )}
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <ArrowRight className="w-4 h-4 text-muted-dark" />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
