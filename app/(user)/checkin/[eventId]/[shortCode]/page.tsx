"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  QrCode, UserCheck, CheckCircle2, AlertCircle, LogIn,
  MapPin, Calendar, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SignInModal from "@/components/SignInModal";
import { useAuthContext } from "@/context/AuthContext";

interface CheckinEvent {
  id: string;
  title: string;
  eventDate: string;
  startTime: string;
  venue: string;
  city: string;
  state: string;
}

interface CheckinRegistration {
  athleteName: string;
  category: string | null;
  waveLabel: string | null;
  bibNumber: string | null;
  checkedInAt: string | null;
}

interface CheckinData {
  event: CheckinEvent;
  registration: CheckinRegistration | null;
}

type LoadState = "loading" | "unauth" | "notfound" | "unregistered" | "ready";

function formatDate(dateStr: string, timeStr?: string) {
  try {
    const d = new Date(dateStr + "T00:00:00");
    const date = d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
    if (!timeStr) return date;
    const t = new Date(`1970-01-01T${timeStr}`).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${date} · ${t}`;
  } catch { return dateStr; }
}

function formatTimestamp(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-AU", {
      weekday: "short", day: "numeric", month: "long",
      hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}

export default function CheckinPage({
  params,
}: {
  params: Promise<{ eventId: string; shortCode: string }>;
}) {
  const { eventId, shortCode } = use(params);
  const { status } = useAuthContext();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [data, setData] = useState<CheckinData | null>(null);
  const [isSignInOpen, setIsSignInOpen] = useState(false);

  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState("");

  // Load on mount and re-load once the sign-in gate clears (status flips to
  // "authenticated"). All setState happens after an await so the fetch is
  // cancellable and the effect stays free of synchronous state updates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/checkin/${eventId}/${shortCode}`);
      if (cancelled) return;
      if (res.status === 404) { setLoadState("notfound"); return; }
      if (res.status === 401) { setLoadState("unauth"); return; }
      const d: CheckinData = await res.json();
      if (cancelled) return;
      setData(d);
      setLoadState(d.registration ? "ready" : "unregistered");
    })();
    return () => { cancelled = true; };
  }, [eventId, shortCode, status]);

  const doCheckIn = async () => {
    setError("");
    setCheckingIn(true);
    try {
      const res = await fetch(`/api/checkin/${eventId}`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Something went wrong."); return; }
      setData((prev) => prev ? { ...prev, registration: { ...prev.registration!, checkedInAt: d.checkedInAt } } : prev);
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <main className="min-h-screen bg-dark-darker">
      <div className="max-w-[480px] mx-auto px-4 py-12 sm:py-16">
        {loadState === "loading" && (
          <div className="flex flex-col items-center gap-4 py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-[13px] text-muted">Loading check-in…</p>
          </div>
        )}

        {loadState === "notfound" && (
          <StateCard
            icon={<AlertCircle className="w-8 h-8 text-red-300" />}
            title="Check-in link not found"
            body="This link doesn&apos;t match a live event. Double-check the QR code with the organiser."
          />
        )}

        {loadState === "unregistered" && (
          <StateCard
            icon={<AlertCircle className="w-8 h-8 text-amber-300" />}
            title="You&apos;re not registered for this event"
            body="This check-in code is for a specific event, and your account has no registration for it. If you believe this is a mistake, contact the organiser."
          />
        )}

        {loadState === "unauth" && (
          <>
            <StateCard
              icon={<LogIn className="w-8 h-8 text-primary" />}
              title="Sign in to check in"
              body="Check-in is tied to your Startline account, so you can only confirm your own attendance."
              action={
                <Button variant="default" className="w-full" onClick={() => setIsSignInOpen(true)}>
                  <LogIn className="w-4 h-4" /> Sign in
                </Button>
              }
            />
          </>
        )}

        {loadState === "ready" && data && (
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center mb-2">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <QrCode className="w-6 h-6 text-primary" />
              </div>
              <h1 className="font-headline text-2xl font-black italic tracking-tighter text-white mb-1">
                {data.registration!.checkedInAt ? "You're checked in" : "Check in to this event"}
              </h1>
              <p className="text-[13px] text-muted">{data.event.title}</p>
            </div>

            <div className="bg-dark rounded-xl border border-dark-lighter p-5">
              <div className="font-headline text-[14px] font-bold text-white">{data.registration!.athleteName}</div>
              <div className="flex flex-col gap-1 mt-3 text-[13px] text-muted">
                {data.registration!.waveLabel && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                    {formatDate(data.event.eventDate, data.event.startTime)} · {data.registration!.waveLabel}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  {data.event.venue}, {data.event.city} {data.event.state.toUpperCase()}
                </span>
                {data.registration!.bibNumber && (
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                    Bib {data.registration!.bibNumber}
                  </span>
                )}
              </div>
            </div>

            {data.registration!.checkedInAt ? (
              <div className="flex items-center justify-center gap-2 px-4 py-4 bg-primary/10 border border-primary/30 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                <div className="text-center">
                  <div className="font-headline text-[13px] font-bold text-primary">Checked in</div>
                  <div className="text-[12px] text-muted">{formatTimestamp(data.registration!.checkedInAt)}</div>
                </div>
              </div>
            ) : (
              <>
                {error && (
                  <div className="px-3 py-2 bg-red-400/10 border border-red-400/20 rounded-lg text-[12px] text-red-300 text-center">{error}</div>
                )}
                <Button variant="default" className="w-full" size="lg" onClick={doCheckIn} disabled={checkingIn}>
                  {checkingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Checking in…
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" /> Check In
                    </>
                  )}
                </Button>
                <p className="text-center text-[11px] text-muted-dark">
                  Tap once to confirm you&apos;re here. You can&apos;t be checked in for this event by anyone else.
                </p>
              </>
            )}

            <div className="text-center">
              <Link href="/" className="text-[13px] text-primary hover:underline">Back to Startline</Link>
            </div>
          </div>
        )}
      </div>

      <SignInModal
        isOpen={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
        onSuccess={() => setIsSignInOpen(false)}
      />
    </main>
  );
}

function StateCard({
  icon, title, body, action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-10">
      <div className="w-14 h-14 rounded-2xl bg-dark-light flex items-center justify-center mb-4">
        {icon}
      </div>
      <h1 className="font-headline text-xl font-black italic tracking-tighter text-white mb-2">{title}</h1>
      <p className="text-[13px] text-muted max-w-[340px] leading-relaxed mb-6">{body}</p>
      {action}
    </div>
  );
}
