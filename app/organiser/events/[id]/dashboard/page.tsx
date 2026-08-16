"use client";

import { useState, useEffect, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, Megaphone, Plus, Pencil,
  MapPin, Calendar, ChevronRight, ChevronDown, AlertCircle, Trash2, Users, QrCode, CheckCheck, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Skeleton, PageHeaderSkeleton, PageShellSkeleton,
} from "@/components/ui/skeleton";
import RaceManagementPanel from "@/components/organiser/RaceManagementPanel";
import RichTextEditor from "@/components/ui/RichTextEditor";
import CapacityBar from "@/components/ui/CapacityBar";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { stripHtml } from "@/lib/utils";

interface Wave { label: string; price: string; qty?: number; sold?: number }

interface DashboardData {
  event: {
    id: string; title: string; discipline: string;
    eventDate: string; endDate?: string | null;
    startTime: string; endTime: string;
    venue: string; city: string; state: string;
    cap?: number | null; registrationCount: number;
    checkedInCount: number; checkInCode: string | null;
    coverImageUrl?: string | null; waves: Wave[];
    feeStructure: string; categories: string[];
  };
  payout: {
    registrationCount: number; lowestTicketPrice: number;
    grossRevenue: number; platformFees: number;
    estimatedPayout: number; feeStructure: string; note: string;
    isEstimate: boolean;
  };
  recentRegistrations: Registration[];
  announcements: Announcement[];
}

interface Registration {
  id: string;
  name: string;
  email: string;
  category: string | null;
  wave: string | null;
  gender: string | null;
  medicalNotes: string | null;
  checkedInAt: string | null;
  amount: number;
  createdAt: string;
}

interface Announcement {
  id: string; title: string; body: string; createdAt: string;
}

function formatDate(dateStr: string, timeStr?: string) {
  try {
    const d    = new Date(dateStr + "T00:00:00");
    const date = d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
    if (!timeStr) return date;
    const t = new Date(`1970-01-01T${timeStr}`).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${date} · ${t}`;
  } catch { return dateStr; }
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function EventDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={
      <PageShellSkeleton>
        <PageHeaderSkeleton />
      </PageShellSkeleton>
    }>
      <EventDashboardInner params={params} />
    </Suspense>
  );
}

function EventDashboardInner({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router  = useRouter();
  const searchParams = useSearchParams();
  const panel = searchParams.get("panel");
  const managePanel = panel === "manage";
  const announcePanel = panel === "announce";
  const panelActive = managePanel || announcePanel;

  const setPanel = (next: "manage" | "announce" | null) => {
    router.replace(
      next
        ? `/organiser/events/${id}/dashboard?panel=${next}`
        : `/organiser/events/${id}/dashboard`,
      { scroll: false },
    );
  };

  const setManagePanel = (on: boolean) => setPanel(on ? "manage" : null);

  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const [annTitle,    setAnnTitle]      = useState("");
  const [annBody,     setAnnBody]       = useState("");
  const [posting,     setPosting]       = useState(false);
  const [postError,   setPostError]     = useState("");

  const [delAnn,    setDelAnn]    = useState<Announcement | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  const [tiersOpen, setTiersOpen] = useState(true);
  const [regsOpen, setRegsOpen] = useState(true);
  const [announcementsOpen, setAnnouncementsOpen] = useState(true);

  const [qrOpen,    setQrOpen]    = useState(false);
  const [qr,        setQr]        = useState<{ url: string; qrDataUrl: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError,   setQrError]   = useState("");
  const [copied,    setCopied]    = useState(false);

  const openCheckInQr = async () => {
    setQrOpen(true);
    setQrLoading(true);
    setQrError("");
    setQr(null);
    try {
      const res = await fetch(`/api/organiser/events/${id}/check-in-qr`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) { setQrError(d.error ?? "Failed to generate the QR code."); return; }
      setQr(d);
    } catch {
      setQrError("Failed to generate the QR code.");
    } finally {
      setQrLoading(false);
    }
  };

  const copyLink = async () => {
    if (!qr) return;
    try {
      await navigator.clipboard.writeText(qr.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  useEffect(() => {
    fetch(`/api/organiser/events/${id}/dashboard`)
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error ?? "Failed to load")))
      .then((d: DashboardData) => setData(d))
      .catch((e: string) => setError(e))
      .finally(() => setLoading(false));
  }, [id]);

  // Clear the announcement draft when the panel closes. Adjusting state during
  // render (rather than in an effect) keeps this to a single render pass — the
  // panel is derived from the URL, so an effect would repaint the stale draft first.
  const [wasAnnouncing, setWasAnnouncing] = useState(announcePanel);
  if (wasAnnouncing !== announcePanel) {
    setWasAnnouncing(announcePanel);
    if (!announcePanel) {
      setAnnTitle("");
      setAnnBody("");
      setPostError("");
    }
  }

  const postAnnouncement = async () => {
    setPostError("");
    if (!annTitle.trim()) { setPostError("Title is required."); return; }
    if (!stripHtml(annBody)) { setPostError("Message is required."); return; }
    setPosting(true);
    try {
      const res = await fetch(`/api/organiser/events/${id}/announcements`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: annTitle, body: annBody }),
      });
      const ann = await res.json() as Announcement & { error?: string };
      if (!res.ok) { setPostError(ann.error ?? "Failed to post announcement."); return; }
      setData(d => d ? { ...d, announcements: [ann, ...d.announcements] } : d);
      setAnnTitle("");
      setAnnBody("");
      setAnnouncementsOpen(true);
      setPanel(null);
    } finally {
      setPosting(false);
    }
  };

  const deleteAnnouncement = async () => {
    if (!delAnn) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/organiser/events/${id}/announcements/${delAnn.id}`, { method: "DELETE" });
      if (res.ok) {
        setData(d => d ? { ...d, announcements: d.announcements.filter(a => a.id !== delAnn.id) } : d);
        setDelAnn(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <PageShellSkeleton maxWidth="max-w-[1100px]" className="pt-14 px-6">
        <Skeleton className="h-3 w-28 mb-6" />
        <PageHeaderSkeleton actions={2} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </PageShellSkeleton>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-dark-darker">
        <main className="pt-14">
          <div className="max-w-[1100px] mx-auto px-6 py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-red-400/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-300" />
            </div>
            <div className="font-headline text-xl font-black italic text-white mb-2">Unable to load dashboard</div>
            <div className="text-muted text-sm mb-6">{error || "This event's dashboard is unavailable."}</div>
            <Button variant="outline" onClick={() => router.push("/organiser/listings")}>
              <ArrowLeft className="w-4 h-4" /> Back to listings
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const { event, payout, announcements, recentRegistrations } = data;

  return (
      <div className="min-h-screen bg-dark-darker">

      <main className="pt-14">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 lg:pb-12 page-in">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 font-headline text-[11px] uppercase tracking-widest text-muted-dark mb-6">
            <Link href="/organiser/listings" className="hover:text-muted transition-colors">Listings</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-muted truncate max-w-[200px]">{event.title}</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-primary">Dashboard</span>
          </div>

          {/* Event header */}
          <div className="flex flex-col lg:flex-row lg:items-start gap-6 mb-8">
            {event.coverImageUrl && (
              <div className="relative w-full lg:w-48 h-32 lg:h-32 rounded-xl overflow-hidden shrink-0">
                <Image src={event.coverImageUrl} alt={event.title} fill className="pointer-events-none object-cover brightness-[.62] saturate-110" sizes="(max-width: 1024px) 100vw, 192px" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge className="bg-primary/10 text-primary border-0">
                  Live
                </Badge>
                <span className="font-headline text-[11px] uppercase tracking-widest text-muted-dark">
                  {event.discipline.replace(/_/g, " ")}
                </span>
              </div>
              <h1 className="font-headline text-[36px] lg:text-[44px] font-black italic tracking-tighter leading-none text-white mb-3">
                {event.title}
              </h1>
              <div className="flex flex-col gap-1 text-[13px] text-muted">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                  {formatDate(event.eventDate, event.startTime)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  {event.venue}, {event.city} {event.state.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex items-end gap-6 sm:gap-8 shrink-0 self-start lg:self-center">
              <div className="text-center">
                <div className="font-headline text-xl sm:text-2xl font-black tracking-tighter text-light leading-none">
                  {event.registrationCount.toLocaleString()}
                  {event.cap != null && (
                    <span className="text-muted-dark font-normal"> / {event.cap.toLocaleString()}</span>
                  )}
                </div>
                <div className="font-headline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted mt-1">
                  Registered
                </div>
              </div>
              <div className="text-center">
                <div className="font-headline text-xl sm:text-2xl font-black tracking-tighter text-primary leading-none">
                  {event.checkedInCount.toLocaleString()}
                </div>
                <div className="font-headline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted mt-1">
                  Checked in
                </div>
              </div>
              <div className="text-center">
                <div className="font-headline text-xl sm:text-2xl font-black tracking-tighter text-light leading-none">
                  {fmt(payout.estimatedPayout)}
                </div>
                <div
                  className="font-headline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted mt-1"
                  title={payout.note}
                >
                  {payout.isEstimate ? "Est. payout (after fees)" : "Payout (after fees)"}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-8">
            {panelActive ? (
              <Button
                variant="outline"
                type="button"
                className="w-full opacity-40 pointer-events-none"
                aria-disabled
                tabIndex={-1}
              >
                <Pencil className="w-4 h-4" /> Edit event
              </Button>
            ) : (
              <Button variant="outline" asChild className="w-full">
                <Link href={`/organiser/new-listing?id=${event.id}&from=${encodeURIComponent(`/organiser/events/${event.id}/dashboard`)}`}>
                  <Pencil className="w-4 h-4" /> Edit event
                </Link>
              </Button>
            )}
            <Button
              variant={managePanel ? "default" : "outline"}
              type="button"
              className={`w-full ${announcePanel ? "opacity-40 pointer-events-none" : ""}`}
              aria-disabled={announcePanel || undefined}
              tabIndex={announcePanel ? -1 : undefined}
              onClick={() => { if (!announcePanel) setManagePanel(!managePanel); }}
            >
              {managePanel ? (
                <>
                  <ArrowLeft className="w-4 h-4" /> Back to overview
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" /> Manage registrations
                </>
              )}
            </Button>
            <Button
              variant={announcePanel ? "default" : "outline"}
              type="button"
              className={`w-full ${managePanel ? "opacity-40 pointer-events-none" : ""}`}
              aria-disabled={managePanel || undefined}
              tabIndex={managePanel ? -1 : undefined}
              onClick={() => { if (!managePanel) setPanel(announcePanel ? null : "announce"); }}
            >
              {announcePanel ? (
                <>
                  <ArrowLeft className="w-4 h-4" /> Back to overview
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> New announcement
                </>
              )}
            </Button>
            <Button
              variant="outline"
              type="button"
              className="w-full"
              onClick={openCheckInQr}
            >
              <QrCode className="w-4 h-4" /> Check-in QR
            </Button>
          </div>

          {announcePanel && (
            <Card className="mb-8">
              <CardContent className="p-6">
                <div className="mb-6">
                  <h2 className="font-headline text-lg font-black italic tracking-tighter text-white">
                    New announcement
                  </h2>
                  <p className="text-[13px] text-muted-dark mt-0.5 max-w-lg">
                    Notify registered athletes about schedule changes, logistics, or event updates.
                  </p>
                </div>
                {postError && (
                  <div className="mb-3 px-3 py-2 bg-red-400/10 border border-red-400/20 rounded-lg text-[12px] text-red-300">{postError}</div>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1.5">Title</label>
                    <input
                      type="text"
                      value={annTitle}
                      onChange={e => setAnnTitle(e.target.value)}
                      placeholder="e.g. Schedule update — Saturday heat times"
                      className="w-full bg-dark border border-dark-lighter rounded-lg px-3 py-2.5 text-[14px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1.5">Message</label>
                    <RichTextEditor
                      value={annBody}
                      onChange={setAnnBody}
                      placeholder="Write your announcement here…"
                      editorClassName="min-h-[180px] bg-dark"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button variant="ghost" onClick={() => setPanel(null)}>Cancel</Button>
                    <Button onClick={postAnnouncement} disabled={posting}>
                      {posting ? "Posting…" : "Post announcement"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Announcements — overview + under compose; hidden on manage registrations */}
          {!managePanel && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <button
                type="button"
                onClick={() => setAnnouncementsOpen((o) => !o)}
                aria-expanded={announcementsOpen}
                className="w-full flex items-center justify-between gap-3 text-left"
              >
                <h2 className="font-headline text-lg font-black italic tracking-tighter text-white">
                  Announcements
                </h2>
                <span className="flex items-center gap-3 shrink-0">
                  <Badge className="bg-primary/10 text-primary border-0">
                    {announcements.length} posted
                  </Badge>
                  <ChevronDown className={`w-4 h-4 text-muted-light transition-transform ${announcementsOpen ? "rotate-180" : ""}`} />
                </span>
              </button>

              {announcementsOpen && (
                <div className="mt-5">
                  {announcements.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="w-10 h-10 rounded-full bg-dark-light flex items-center justify-center mx-auto mb-3">
                        <Megaphone className="w-5 h-5 text-muted-dark" />
                      </div>
                      <div className="font-headline text-sm font-bold uppercase tracking-widest text-muted mb-1">No announcements yet</div>
                      <div className="text-[13px] text-muted-dark">Use New announcement to notify registered athletes.</div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {announcements.map(ann => (
                        <div key={ann.id} className="flex items-start gap-4 p-4 bg-dark-light border border-dark-lighter rounded-xl">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Megaphone className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="font-headline text-[14px] font-bold text-white">{ann.title}</div>
                              <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark shrink-0">{timeAgo(ann.createdAt)}</div>
                            </div>
                            {/<[a-z][\s\S]*>/i.test(ann.body) ? (
                              <div
                                className="text-[13px] text-muted-light mt-1 leading-relaxed
                                  [&_h3]:font-headline [&_h3]:font-black [&_h3]:text-[15px] [&_h3]:text-white [&_h3]:mt-3 [&_h3]:mb-1
                                  [&_h4]:font-headline [&_h4]:font-bold [&_h4]:text-[13px] [&_h4]:text-white [&_h4]:mt-2 [&_h4]:mb-1
                                  [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_li]:mb-0.5
                                  [&_strong]:text-white [&_b]:text-white"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(ann.body) }}
                              />
                            ) : (
                              <p className="text-[13px] text-muted-light mt-1 leading-relaxed whitespace-pre-wrap">{ann.body}</p>
                            )}
                          </div>
                          <button
                            onClick={() => setDelAnn(ann)}
                            className="shrink-0 text-muted-dark hover:text-red-400 transition-colors mt-0.5"
                            title="Delete announcement"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {managePanel ? (
            <div className="mb-8">
              <RaceManagementPanel eventId={id} />
            </div>
          ) : announcePanel ? null : (
          <>
          {/* Ticket tiers */}
          {event.waves.length > 0 && (
            <Card className="mb-8">
              <CardContent className="p-6">
                <button
                  type="button"
                  onClick={() => setTiersOpen((o) => !o)}
                  aria-expanded={tiersOpen}
                  className="w-full flex items-center justify-between gap-3 text-left"
                >
                  <h2 className="font-headline text-lg font-black italic tracking-tighter text-white">
                    Ticket tiers
                  </h2>
                  <span className="flex items-center gap-3 shrink-0">
                    <Badge className="bg-primary/10 text-primary border-0">
                      {event.waves.length} {event.waves.length === 1 ? "tier" : "tiers"}
                    </Badge>
                    <ChevronDown className={`w-4 h-4 text-muted-light transition-transform ${tiersOpen ? "rotate-180" : ""}`} />
                  </span>
                </button>

                {tiersOpen && (
                  <>
                    <div className="divide-y divide-white/5 mt-5">
                      {event.waves.map((w, i) => {
                        const sold = w.sold ?? 0;
                        const capped = w.qty != null;
                        return (
                          <div key={i} className="py-3 gap-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="font-headline text-[14px] font-bold text-white/90 min-w-0 truncate">{w.label}</div>
                              <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                                <div className="font-headline text-[14px] font-black italic text-white">A${w.price}</div>
                                <div className="text-right">
                                  <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">Sold / Cap</div>
                                  <div className="font-headline text-[13px] text-muted-light">
                                    {sold.toLocaleString()}
                                    {capped ? ` / ${w.qty!.toLocaleString()}` : ""}
                                  </div>
                                </div>
                              </div>
                            </div>
                            {capped && (
                              <CapacityBar
                                count={sold}
                                cap={w.qty}
                                className="mt-2.5 w-full max-w-[360px]"
                                label={`${w.label}: ${sold} of ${w.qty} sold`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5">
                      <p className="text-[11px] text-muted-dark">
                        Tiers without a cap show sold count only. Athletes register per tier; see the Registrations list below for each athlete&apos;s wave.
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Registrations */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <button
                type="button"
                onClick={() => setRegsOpen((o) => !o)}
                aria-expanded={regsOpen}
                className="w-full flex flex-wrap items-center justify-between gap-3 text-left"
              >
                <h2 className="font-headline text-lg font-black italic tracking-tighter text-white">
                  Registrations
                </h2>
                <span className="flex items-center gap-3 shrink-0">
                  <Badge className="bg-primary/10 text-primary border-0">
                    {event.registrationCount.toLocaleString()} {event.registrationCount === 1 ? "athlete" : "athletes"}
                  </Badge>
                  <ChevronDown className={`w-4 h-4 text-muted-light transition-transform ${regsOpen ? "rotate-180" : ""}`} />
                </span>
              </button>

              {regsOpen && (
                <div className="mt-4">
                  {recentRegistrations.length > 0 ? (
                    <div className="overflow-x-auto -mx-2">
                      <table className="w-full min-w-[560px] border-collapse">
                        <thead>
                          <tr className="border-b border-white/5">
                            {["Athlete", "Wave", "Registered", "Paid", "Check-in"].map((h) => (
                              <th key={h} className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark text-left px-2 py-2 last:text-right">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {recentRegistrations.map((r) => (
                            <tr key={r.id} className="border-b border-white/5 last:border-0">
                              <td className="px-2 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-headline text-[14px] font-bold text-white/90 truncate max-w-[200px]">{r.name}</span>
                                  {r.medicalNotes && (
                                    <span
                                      title={`Medical: ${r.medicalNotes}`}
                                      className="shrink-0 inline-flex items-center gap-1 font-headline text-[9px] font-bold uppercase tracking-widest text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded px-1.5 py-0.5"
                                    >
                                      <AlertCircle className="w-2.5 h-2.5" /> Medical
                                    </span>
                                  )}
                                </div>
                                <div className="text-[12px] text-muted-dark truncate max-w-[220px]">{r.email}</div>
                              </td>
                              <td className="px-2 py-3">
                                {r.wave
                                  ? <span className="font-headline text-[12px] text-muted-light">{r.wave}</span>
                                  : <span className="text-[12px] text-muted-dark">—</span>}
                              </td>
                              <td className="px-2 py-3 text-[12px] text-muted-light whitespace-nowrap">{timeAgo(r.createdAt)}</td>
                              <td className="px-2 py-3 font-headline text-[13px] font-black italic text-white text-right whitespace-nowrap">{fmt(r.amount)}</td>
                              <td className="px-2 py-3 text-right">
                                {r.checkedInAt ? (
                                  <span className="inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 border border-primary/30 rounded px-1.5 py-0.5 whitespace-nowrap">
                                    <CheckCheck className="w-3 h-3" /> {timeAgo(r.checkedInAt)}
                                  </span>
                                ) : (
                                  <span className="text-[12px] text-muted-dark">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {event.registrationCount > recentRegistrations.length && (
                        <p className="text-[11px] text-muted-dark mt-3 px-2">
                          Showing the {recentRegistrations.length} most recent of {event.registrationCount.toLocaleString()}.{" "}
                          <button
                            type="button"
                            onClick={() => setManagePanel(true)}
                            className="text-primary hover:underline font-headline"
                          >
                            Manage all
                          </button>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-8 h-8 mx-auto mb-3 text-muted-dark" />
                      <div className="font-headline text-sm font-bold uppercase tracking-widest text-muted mb-1">No registrations yet</div>
                      <div className="text-[13px] text-muted-dark">Athletes who register will appear here.</div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          </>
          )}

        </div>
      </main>

      {/* Check-in QR */}
      <Dialog open={qrOpen} onOpenChange={open => { if (!open) setQrOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5 text-primary" />
              </div>
              <DialogTitle>Check-in QR</DialogTitle>
            </div>
            <DialogDescription>
              Display this QR on a screen or print it at the gate. Athletes scan it with their phone camera to check themselves in.
            </DialogDescription>
          </DialogHeader>

          {qrLoading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
              <p className="text-[13px] text-muted">Generating QR code…</p>
            </div>
          ) : qrError ? (
            <div className="px-3 py-3 bg-red-400/10 border border-red-400/20 rounded-lg text-[13px] text-red-300">{qrError}</div>
          ) : qr ? (
            <div className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr.qrDataUrl}
                alt={`Check-in QR code for ${event.title}`}
                className="w-56 h-56 rounded-lg border border-dark-lighter"
              />
              <div className="mt-4 w-full flex items-center gap-2">
                <input
                  readOnly
                  value={qr.url}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 bg-dark border border-dark-lighter rounded-lg px-3 py-2 text-[12px] text-muted-light focus:border-primary focus:outline-none"
                />
                <Button variant="outline" type="button" className="shrink-0" onClick={copyLink}>
                  {copied ? <CheckCheck className="w-4 h-4" /> : "Copy"}
                </Button>
              </div>
              <div className="mt-4 w-full text-center font-headline text-[11px] uppercase tracking-widest text-muted">
                {event.checkedInCount} of {event.registrationCount} checked in
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete announcement confirm */}
      <Dialog open={!!delAnn} onOpenChange={open => { if (!open) setDelAnn(null); }}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-300" />
              </div>
              <DialogTitle>Delete this announcement?</DialogTitle>
            </div>
            <DialogDescription>
              &ldquo;{delAnn?.title}&rdquo; will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDelAnn(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteAnnouncement} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
