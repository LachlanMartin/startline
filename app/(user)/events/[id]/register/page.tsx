"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Plus, Minus, LogIn, Check, ChevronDown } from "lucide-react";
import SignInModal from "@/components/SignInModal";
import ParticipantFormSection from "@/components/registration/ParticipantFormSection";
import SharedEmergencyContactSection from "@/components/registration/SharedEmergencyContactSection";
import GuestEmailVerificationStep from "@/components/registration/GuestEmailVerificationStep";
import StepRail from "@/components/registration/StepRail";
import OrderSummary from "@/components/registration/OrderSummary";
import ReviewPayStep, { type ReviewRow } from "./ReviewPayStep";
import { useAuthContext } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  Skeleton, PageHeaderSkeleton, PageShellSkeleton,
} from "@/components/ui/skeleton";
import {
  splitFullName,
  validateParticipants,
  getRegistrationFormErrors,
  formatPhoneForDisplay,
  createEmptyParticipant,
  MAX_REGISTRATION_PARTICIPANTS,
  type ParticipantFormErrors,
  type RegistrationFormData,
  type EmergencyContact,
  type EmergencyContactErrors,
  getEmailsRequiringVerification,
} from "@/lib/registration-form";

interface Wave {
  label: string;
  price: string;
  qty?: number;
  date?: string;
  closes?: string;
  startTime?: string;
}

interface EventData {
  id: string;
  title: string;
  eventDate: string;
  startTime: string;
  venue: string;
  city: string;
  state: string;
  waves: Wave[];
  feeStructure: string;
  registrationType: string;
  coverImageUrl: string | null;
  organiser: { id: string; orgName: string | null; logoUrl: string | null };
}

interface ProfilePrefill {
  email: string;
  firstName: string;
  lastName: string;
  mobile: string;
  dateOfBirth: string;
  gender: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

interface WaveAvailability {
  label: string;
  qty: number | null;
  confirmed: number;
}
interface Availability {
  cap: number | null;
  confirmed: number;
  waves: WaveAvailability[];
}

const PLATFORM_FEE_PCT = 0.0395;
const PLATFORM_FEE_FIXED = 1.45;
// Show a "limited remaining" nudge once a tier (or the event) is at or below
// this many spots — enough urgency without exposing precise sales figures.
const LOW_STOCK_THRESHOLD = 10;

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function waveIsOpen(wave: Wave, today = todayIso()): boolean {
  const closes = wave.closes || wave.date;
  return !closes || closes >= today;
}
function formatEventDate(dateStr: string, timeStr?: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    const date = d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    if (!timeStr) return date;
    const t = new Date(`1970-01-01T${timeStr}`).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${date} · ${t}`;
  } catch {
    return dateStr;
  }
}
const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * Keep already-entered details attached to the right ticket when the buyer
 * goes back and changes quantities: match previous participants to the new
 * ticket list by tier first, then fill remaining slots positionally.
 */
function reconcileParticipants(
  prev: RegistrationFormData[],
  prevWaves: string[],
  nextWaves: string[]
): RegistrationFormData[] {
  const pool = prev.map((participant, i) => ({ participant, wave: prevWaves[i] ?? null, used: false }));
  const matched = nextWaves.map((wave) => {
    const hit = pool.find((entry) => !entry.used && entry.wave === wave);
    if (hit) {
      hit.used = true;
      return hit.participant;
    }
    return null;
  });
  return matched.map((participant) => {
    if (participant) return participant;
    const leftover = pool.find((entry) => !entry.used);
    if (leftover) {
      leftover.used = true;
      return leftover.participant;
    }
    return createEmptyParticipant();
  });
}

const continueBtnCls =
  "inline-flex items-center gap-2 h-11 px-[22px] rounded-xl bg-machined text-dark font-headline text-[12px] font-bold uppercase tracking-[0.13em] shadow-machined hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-all disabled:opacity-40 disabled:pointer-events-none";

const stepperBtnCls =
  "w-[30px] h-[30px] p-0 rounded-full border-2 border-dark-lighter grid place-items-center leading-none text-light hover:border-primary hover:text-primary transition-colors disabled:opacity-30 disabled:pointer-events-none";

export default function RegisterPage() {
  return <RegisterContent />;
}

function RegisterContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const eventId = params.id as string;
  const preselectedWave = searchParams.get("wave") ?? "";
  const { status, user } = useAuthContext();

  const [event, setEvent] = useState<EventData | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [payPhase, setPayPhase] = useState<"verify" | "pay">("pay");
  const [error, setError] = useState("");
  const [isSignInOpen, setIsSignInOpen] = useState(false);

  // Tickets chosen on step 1: wave label → quantity. Locked once the buyer
  // moves on; changing it means going Back to this step.
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    preselectedWave ? { [preselectedWave]: 1 } : {}
  );
  // Wave label per participant, aligned with `participants` (set on Continue).
  const [ticketWaves, setTicketWaves] = useState<string[]>([]);
  const [participants, setParticipants] = useState<RegistrationFormData[]>(() => [createEmptyParticipant()]);
  const [openTicket, setOpenTicket] = useState(0);
  const [useSharedContact, setUseSharedContact] = useState(true);
  const [sharedEmergencyContact, setSharedEmergencyContact] = useState<EmergencyContact>({ name: "", phone: "" });
  const [fieldErrors, setFieldErrors] = useState<ParticipantFormErrors>({});
  const [emergencyContactErrors, setEmergencyContactErrors] = useState<EmergencyContactErrors>({});

  const [clientSecret, setClientSecret] = useState("");
  const [processing, setProcessing] = useState(false);
  const [confirmed, setConfirmed] = useState<{ ref: string; email: string; tierSummary: string; count: number; amount: string } | null>(null);

  const prefilledRef = useRef(false);

  // ── Load event ──
  useEffect(() => {
    fetch(`/api/events`)
      .then((r) => r.json())
      .then((events: EventData[]) => {
        const found = events.find((e) => e.id === eventId);
        if (found) setEvent(found);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [eventId]);

  // ── Load live availability (cap + per-tier confirmed counts) ──
  useEffect(() => {
    fetch(`/api/events/${eventId}/availability`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Availability | null) => {
        if (!data) return;
        setAvailability(data);
        // Trim any preselected/held quantities that exceed what's actually left
        // (e.g. a `?wave=` deep link into a now-sold-out or nearly-full tier).
        const byLabel: Record<string, WaveAvailability> = {};
        for (const w of data.waves) byLabel[w.label] = w;
        setQuantities((prev) => {
          let changed = false;
          let running = 0;
          const next: Record<string, number> = {};
          for (const [label, qty] of Object.entries(prev)) {
            const w = byLabel[label];
            const tierLeft = w && w.qty != null ? Math.max(0, w.qty - w.confirmed) : Infinity;
            const capLeft = data.cap != null ? Math.max(0, data.cap - data.confirmed - running) : Infinity;
            const allowed = Math.max(0, Math.min(qty, tierLeft, capLeft));
            if (allowed !== qty) changed = true;
            next[label] = allowed;
            running += allowed;
          }
          return changed ? next : prev;
        });
      })
      .catch(() => {});
  }, [eventId]);

  // ── Prefill first participant from profile (signed-in) ──
  useEffect(() => {
    if (status !== "authenticated" || prefilledRef.current) return;
    prefilledRef.current = true;
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((profile: {
        email?: string;
        name?: string | null;
        mobile?: string | null;
        dateOfBirth?: string | null;
        gender?: string | null;
        emergencyContactName?: string | null;
        emergencyContactPhone?: string | null;
      } | null) => {
        if (!profile) return;
        const { firstName, lastName } = splitFullName(profile.name);
        const prefill: ProfilePrefill = {
          email: profile.email ?? "",
          firstName,
          lastName,
          mobile: profile.mobile ? formatPhoneForDisplay(profile.mobile) : "",
          dateOfBirth: profile.dateOfBirth ?? "",
          gender: profile.gender ?? "",
          emergencyContactName: profile.emergencyContactName ?? "",
          emergencyContactPhone: profile.emergencyContactPhone
            ? formatPhoneForDisplay(profile.emergencyContactPhone)
            : "",
        };
        setParticipants((prev) => {
          const first = prev[0];
          if (first.firstName || first.lastName || first.email) return prev;
          const next = [...prev];
          next[0] = { ...first, ...prefill };
          return next;
        });
      })
      .catch(() => {});
  }, [status]);

  // ── Derived selection / pricing ──
  const openWaves = useMemo(() => (event?.waves ?? []).filter((w) => waveIsOpen(w)), [event]);
  const tierLines = useMemo(
    () =>
      openWaves
        .map((w) => ({ label: w.label, price: parseFloat(w.price || "0"), qty: quantities[w.label] ?? 0 }))
        .filter((t) => t.qty > 0),
    [openWaves, quantities]
  );
  const totalTickets = tierLines.reduce((sum, t) => sum + t.qty, 0);

  // ── Live availability (spots left) ──
  const availByWave = useMemo(() => {
    const map: Record<string, WaveAvailability> = {};
    for (const w of availability?.waves ?? []) map[w.label] = w;
    return map;
  }, [availability]);
  // Spots left across the whole event (Infinity when uncapped or still loading).
  const eventRemaining =
    availability && availability.cap != null
      ? Math.max(0, availability.cap - availability.confirmed)
      : Infinity;
  // Spots left in a single tier, bounded by the event cap.
  const waveRemaining = useCallback(
    (label: string): number => {
      const w = availByWave[label];
      const tierLeft = w && w.qty != null ? Math.max(0, w.qty - w.confirmed) : Infinity;
      return Math.min(tierLeft, eventRemaining);
    },
    [availByWave, eventRemaining]
  );
  const eventSoldOut = eventRemaining <= 0;

  const athletePaysFee = event?.feeStructure === "athlete";
  const feeTotal = athletePaysFee
    ? tierLines.reduce((sum, t) => sum + (t.price * PLATFORM_FEE_PCT + PLATFORM_FEE_FIXED) * t.qty, 0)
    : 0;
  const subtotal = tierLines.reduce((sum, t) => sum + t.price * t.qty, 0);
  const total = subtotal + feeTotal;
  const tierSummary = tierLines.map((t) => (t.qty > 1 ? `${t.qty} × ${t.label}` : t.label)).join(", ");

  const isMulti = participants.length > 1;
  const sharedContactActive = isMulti && useSharedContact;

  const setQty = (label: string, delta: number) => {
    setQuantities((prev) => {
      const next = Math.max(0, (prev[label] ?? 0) + delta);
      return { ...prev, [label]: next };
    });
    setError("");
  };

  // A tier is sold out when it (or the whole event) has no confirmed capacity
  // left. Steppers can add only up to what remains in the tier, the event, and
  // the per-order maximum.
  const waveSoldOut = (label: string): boolean => {
    if (eventSoldOut) return true;
    const w = availByWave[label];
    return w?.qty != null && w.qty - w.confirmed <= 0;
  };
  const canIncrement = (label: string): boolean => {
    if (totalTickets >= MAX_REGISTRATION_PARTICIPANTS) return false;
    if (totalTickets >= eventRemaining) return false;
    const w = availByWave[label];
    const tierLeft = w?.qty != null ? Math.max(0, w.qty - w.confirmed) : Infinity;
    return (quantities[label] ?? 0) < tierLeft;
  };

  const emailsToVerify = useMemo(
    () =>
      getEmailsRequiringVerification(
        participants.map((p) => p.email),
        status === "authenticated" ? user?.email : null
      ),
    [participants, status, user?.email]
  );
  const requiresEmailVerification = emailsToVerify.length > 0;

  const detailsValid = useMemo(
    () =>
      validateParticipants(participants, {
        groupRegistration: sharedContactActive,
        sharedEmergencyContact: sharedContactActive ? sharedEmergencyContact : undefined,
        includeWaiver: false,
      }).firstMessage === null,
    [participants, sharedContactActive, sharedEmergencyContact]
  );

  const ticketComplete = useCallback(
    (index: number) =>
      Object.keys(
        getRegistrationFormErrors(participants[index], {
          includeEmergencyContact: !sharedContactActive,
          includeWaiver: false,
        })
      ).length === 0,
    [participants, sharedContactActive]
  );

  // ── Participant handlers ──
  const updateParticipant = (index: number, field: keyof RegistrationFormData, value: string | boolean) => {
    setParticipants((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
    setFieldErrors((prev) => {
      const current = prev[index];
      if (!current?.[field as keyof typeof current]) return prev;
      const next = { ...prev, [index]: { ...current } };
      delete next[index][field as keyof (typeof next)[number]];
      if (Object.keys(next[index]).length === 0) delete next[index];
      return next;
    });
  };
  const updateSharedEmergencyContact = (field: "name" | "phone", value: string) => {
    setSharedEmergencyContact((prev) => ({ ...prev, [field]: value }));
    setEmergencyContactErrors((prev) => {
      const key = field === "name" ? "emergencyContactName" : "emergencyContactPhone";
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };
  const toggleSharedContact = () => {
    setUseSharedContact((v) => !v);
    setFieldErrors({});
    setEmergencyContactErrors({});
  };

  // ── Checkout (create PaymentIntent) ──
  const startCheckout = useCallback(async () => {
    setError("");
    setProcessing(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          waveLabel: ticketWaves[0],
          participants: participants.map((p, i) => ({ ...p, waveLabel: ticketWaves[i] })),
          ...(sharedContactActive && { groupRegistration: true, emergencyContact: sharedEmergencyContact }),
        }),
      });
      const data = (await res.json()) as { clientSecret?: string; error?: string };
      if (!res.ok || !data.clientSecret) {
        setError(data.error ?? "Failed to start payment.");
        setProcessing(false);
        return;
      }
      setClientSecret(data.clientSecret);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setProcessing(false);
  }, [eventId, ticketWaves, participants, sharedContactActive, sharedEmergencyContact]);

  // ── Step navigation ──
  const goToTicket = () => {
    setStep(0);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goToDetails = () => {
    if (!event || totalTickets === 0) return;
    // One ticket slot per selected quantity, in tier display order.
    const nextWaves: string[] = [];
    for (const wave of event.waves) {
      if (!waveIsOpen(wave)) continue;
      for (let i = 0; i < (quantities[wave.label] ?? 0); i++) nextWaves.push(wave.label);
    }
    setParticipants((prev) => reconcileParticipants(prev, ticketWaves, nextWaves));
    setTicketWaves(nextWaves);
    setFieldErrors({});
    setEmergencyContactErrors({});
    setOpenTicket(0);
    setStep(1);
    setError("");
    setClientSecret("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goToReview = () => {
    const { errors, emergencyContactErrors: ecErrors, firstMessage } = validateParticipants(participants, {
      groupRegistration: sharedContactActive,
      sharedEmergencyContact: sharedContactActive ? sharedEmergencyContact : undefined,
      includeWaiver: false,
    });
    setFieldErrors(errors);
    setEmergencyContactErrors(ecErrors);
    if (firstMessage) {
      setError("Please fix the highlighted fields.");
      const firstInvalid = participants.findIndex((_, i) => errors[i]);
      if (firstInvalid >= 0) setOpenTicket(firstInvalid);
      requestAnimationFrame(() => {
        document.querySelector("[data-invalid]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setError("");
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (requiresEmailVerification) {
      setPayPhase("verify");
    } else {
      setPayPhase("pay");
      startCheckout();
    }
  };
  const goToNextTicket = (index: number) => {
    const errors = getRegistrationFormErrors(participants[index], {
      includeEmergencyContact: !sharedContactActive,
      includeWaiver: false,
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, [index]: errors }));
      requestAnimationFrame(() => {
        document.querySelector("[data-invalid]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setOpenTicket(index + 1);
  };
  const onVerified = () => {
    setPayPhase("pay");
    startCheckout();
  };

  const onConfirmed = (paymentIntentId: string) => {
    const ref = "SL-" + paymentIntentId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
    setConfirmed({ ref, email: participants[0].email, tierSummary, count: participants.length, amount: money(total) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Review rows ──
  const reviewRows: ReviewRow[] = useMemo(() => {
    const rows: ReviewRow[] = tierLines.map((t) => ({
      label: t.qty > 1 ? `${t.qty} × ${t.label}` : t.label,
      value: money(t.price * t.qty),
    }));
    if (participants.length === 1) {
      const p = participants[0];
      rows.push({ label: "Name", value: `${p.firstName} ${p.lastName}`.trim() });
      rows.push({ label: "Email", value: p.email });
      rows.push({ label: "Date of birth", value: p.dateOfBirth || "—" });
      rows.push({ label: "Gender", value: p.gender || "—" });
      if (p.estimatedFinish.trim()) rows.push({ label: "Estimated finish", value: p.estimatedFinish });
      rows.push({ label: "Emergency contact", value: `${p.emergencyContactName} · ${p.emergencyContactPhone}` });
      if (p.medicalNotes.trim()) rows.push({ label: "Medical notes", value: p.medicalNotes });
    } else {
      participants.forEach((p, i) =>
        rows.push({
          label: `Ticket ${i + 1} · ${ticketWaves[i]}`,
          value: `${p.firstName} ${p.lastName}`.trim() + ` · ${p.email}`,
        })
      );
      if (sharedContactActive) {
        rows.push({ label: "Emergency contact", value: `${sharedEmergencyContact.name} · ${sharedEmergencyContact.phone}` });
      }
    }
    return rows;
  }, [participants, tierLines, ticketWaves, sharedContactActive, sharedEmergencyContact]);

  // ── Loading / not-found ──
  if (loading || status === "loading") {
    return (
      <PageShellSkeleton maxWidth="max-w-[1100px]">
        <Skeleton className="h-3 w-28 mb-6" />
        <PageHeaderSkeleton actions={0} />
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </PageShellSkeleton>
    );
  }
  if (!event) {
    return (
      <div className="min-h-screen bg-dark-darker flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-headline text-2xl font-black italic text-light mb-2">Event not found</h1>
          <Link href="/events" className="font-headline text-xs uppercase tracking-widest text-primary hover:text-primary/80">
            Back to events
          </Link>
        </div>
      </div>
    );
  }

  const dateLabel = formatEventDate(event.eventDate, event.startTime);
  const locationLabel = [event.venue, event.city].filter(Boolean).join(", ") + ` ${event.state.toUpperCase()}`;

  // ── Confirmation screen ──
  if (confirmed) {
    return (
      <div className="min-h-screen bg-dark-darker">
        <div className="max-w-[520px] mx-auto px-5 pt-[96px] pb-[60px] text-center">
          <div className="w-[68px] h-[68px] rounded-full bg-primary/10 border-2 border-primary/40 inline-flex items-center justify-center mb-[22px]">
            <Check className="w-[30px] h-[30px] text-primary" strokeWidth={2.5} />
          </div>
          <div className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-2.5">You&apos;re in.</div>
          <h1 className="font-headline text-[clamp(30px,4vw,46px)] font-bold italic tracking-[-0.04em] text-light leading-[.95] mb-3.5">
            Registration<br /><span className="text-primary">confirmed.</span>
          </h1>
          <p className="text-[14px] text-muted max-w-[360px] mx-auto mb-7 leading-relaxed">
            {confirmed.count === 1 ? (
              <>Your spot in <strong className="text-light">{confirmed.tierSummary}</strong> at <strong className="text-light">{event.title}</strong> is locked in.</>
            ) : (
              <>Your <strong className="text-light">{confirmed.count} tickets</strong> to <strong className="text-light">{event.title}</strong> are locked in.</>
            )}
          </p>
          <div className="bg-dark-light border border-dark-lighter rounded-[14px] px-[22px] py-[18px] mb-[26px] text-left">
            {[
              ["Reference", confirmed.ref],
              ["Event", event.title],
              ["Tickets", confirmed.tierSummary],
              ["Date", dateLabel],
              ["Venue", locationLabel],
              ["Amount paid", confirmed.amount],
            ].map(([l, v], i) => (
              <div key={l} className={cn("flex justify-between items-baseline gap-4 py-[11px]", i < 5 && "border-b border-white/[0.06]")}>
                <span className="text-[13px] text-muted shrink-0">{l}</span>
                <span className={cn("font-headline text-[13px] font-bold text-right max-w-[60%]", l === "Reference" ? "text-primary" : "text-light")}>{v}</span>
              </div>
            ))}
          </div>
          <div className="text-[12.5px] text-muted-dark mb-6 leading-relaxed">
            Confirmation sent to <strong className="text-muted">{confirmed.email}</strong>
          </div>
          <Link
            href={`/events/${eventId}`}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border border-dark-lighter text-light font-headline text-[12px] font-bold uppercase tracking-[0.12em] hover:border-primary hover:bg-dark-light transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to event
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-darker">
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pt-24 pb-24">
        <Link
          href={`/events/${eventId}`}
          className="inline-flex items-center gap-2 font-headline text-[11px] font-bold uppercase tracking-[0.15em] text-muted hover:text-primary transition-colors mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to event
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-7 items-start">
          {/* ── LEFT: form ── */}
          <div>
            <div className="mb-7">
              <div className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-2.5">
                Registration · {event.title}
              </div>
              <h1 className="font-headline text-[clamp(28px,3.5vw,42px)] font-bold italic tracking-[-0.04em] text-light leading-[.92]">
                Secure your<br /><span className="text-primary">spot.</span>
              </h1>
            </div>

            <StepRail current={step} />

            {error && (
              <div className="mb-4 bg-red-900/30 border border-red-500/30 rounded-lg px-4 py-3 text-[13px] text-red-300">
                {error}
              </div>
            )}

            {/* ── STEP 0: Select tickets ── */}
            {step === 0 && (
              <>
                <div className="bg-dark border border-dark-lighter rounded-[14px] p-6">
                  <div className="font-headline text-[10.5px] font-bold uppercase tracking-[0.15em] text-muted mb-4">
                    Choose your tickets
                  </div>
                  {eventSoldOut && (
                    <div className="mb-4 bg-red-900/20 border border-red-500/25 rounded-lg px-4 py-3 font-headline text-[11px] font-bold uppercase tracking-[0.13em] text-red-300">
                      This event is sold out.
                    </div>
                  )}
                  <div className="space-y-2.5">
                    {event.waves?.map((wave) => {
                      const closed = !waveIsOpen(wave);
                      const soldOut = !closed && waveSoldOut(wave.label);
                      const disabled = closed || soldOut;
                      const qty = disabled ? 0 : (quantities[wave.label] ?? 0);
                      const closeDate = wave.closes || wave.date;
                      const left = waveRemaining(wave.label);
                      const lowStock = !disabled && Number.isFinite(left) && left > 0 && left <= LOW_STOCK_THRESHOLD;
                      return (
                        <div
                          key={wave.label}
                          className={cn(
                            "grid grid-cols-[1fr_auto_1fr] items-center gap-3.5 px-[18px] py-4 rounded-xl border-2 transition-colors",
                            disabled
                              ? "border-dark-lighter bg-dark-light opacity-40"
                              : qty > 0
                                ? "border-primary bg-primary/[0.07]"
                                : "border-dark-lighter bg-dark-light"
                          )}
                        >
                          <div>
                            <div className="font-headline text-[14.5px] font-bold text-light">{wave.label}</div>
                            {closed ? (
                              <div className="font-headline text-[10px] font-bold uppercase tracking-[0.13em] text-red-400 mt-1">Closed</div>
                            ) : soldOut ? (
                              <div className="font-headline text-[10px] font-bold uppercase tracking-[0.13em] text-red-400 mt-1">Sold out</div>
                            ) : (
                              <>
                                {lowStock && (
                                  <div className="font-headline text-[10px] font-bold uppercase tracking-[0.13em] text-amber-400 mt-1">
                                    Only {left} left
                                  </div>
                                )}
                                {closeDate && (
                                  <div className="font-headline text-[10px] uppercase tracking-[0.12em] text-muted-dark mt-1">
                                    Closes {closeDate}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          {disabled ? (
                            <div />
                          ) : (
                            <div className="flex items-center gap-2 justify-self-center">
                              <button
                                type="button"
                                aria-label={`Remove one ${wave.label} ticket`}
                                onClick={() => setQty(wave.label, -1)}
                                disabled={qty === 0}
                                className={stepperBtnCls}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span
                                aria-label={`${wave.label} quantity`}
                                className={cn("w-6 text-center font-headline text-[15px] font-bold tabular-nums", qty > 0 ? "text-light" : "text-muted-dark")}
                              >
                                {qty}
                              </span>
                              <button
                                type="button"
                                aria-label={`Add one ${wave.label} ticket`}
                                onClick={() => setQty(wave.label, 1)}
                                disabled={!canIncrement(wave.label)}
                                className={stepperBtnCls}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          <div className={cn("justify-self-end font-headline text-[24px] font-bold italic tracking-[-0.02em]", disabled ? "text-muted-dark" : "text-primary")}>
                            {money(parseFloat(wave.price || "0"))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="font-headline text-[10px] uppercase tracking-[0.13em] text-muted-dark mt-4">
                    Mix tiers as needed · up to {MAX_REGISTRATION_PARTICIPANTS} tickets per order
                  </p>
                </div>

                <div className="flex justify-between items-center mt-5">
                  <Link
                    href={`/events/${eventId}`}
                    className="inline-flex items-center gap-2 h-11 px-4 rounded-xl font-headline text-[12px] font-bold uppercase tracking-[0.12em] text-muted hover:bg-dark-light hover:text-light transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to event
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="font-headline text-[10px] uppercase tracking-[0.15em] text-muted-dark">1 / 3</span>
                    <button type="button" onClick={goToDetails} disabled={totalTickets === 0} className={continueBtnCls}>
                      Continue <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 1: Your details ── */}
            {step === 1 && (
              <>
                {status !== "authenticated" && (
                  <button
                    type="button"
                    onClick={() => setIsSignInOpen(true)}
                    className="w-full mb-4 flex items-center justify-center gap-2 py-3 rounded-xl border border-dark-lighter text-muted hover:border-primary hover:text-primary font-headline text-[12px] font-bold uppercase tracking-[0.12em] transition-colors"
                  >
                    <LogIn className="w-4 h-4" /> Have an account? Sign in to prefill
                  </button>
                )}

                <div className="space-y-4">
                  {!isMulti ? (
                    <ParticipantFormSection
                      index={0}
                      title={ticketWaves[0]}
                      participant={participants[0]}
                      errors={fieldErrors[0]}
                      onChange={(field, value) => updateParticipant(0, field, value)}
                    />
                  ) : (
                    participants.map((participant, index) => {
                      const isOpen = openTicket === index;
                      const complete = ticketComplete(index);
                      const hasErrors = !!fieldErrors[index];
                      const name = `${participant.firstName} ${participant.lastName}`.trim();
                      return (
                        <div
                          key={index}
                          className={cn(
                            "bg-dark border rounded-[14px] overflow-hidden transition-colors",
                            isOpen ? "border-primary/50" : hasErrors ? "border-red-500/40" : "border-dark-lighter"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenTicket(isOpen ? -1 : index)}
                            aria-expanded={isOpen}
                            className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={cn(
                                  "w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center shrink-0 font-headline text-[11px] font-bold transition-colors",
                                  complete
                                    ? "bg-primary border-primary text-dark"
                                    : hasErrors
                                      ? "border-red-500/60 text-red-400"
                                      : isOpen
                                        ? "border-primary text-primary"
                                        : "border-dark-lighter text-muted-dark"
                                )}
                              >
                                {complete ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : index + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="font-headline text-[12px] font-bold uppercase tracking-[0.13em] text-light">
                                  Ticket {index + 1} of {participants.length} · <span className="text-primary">{ticketWaves[index]}</span>
                                </div>
                                {!isOpen && (
                                  <div className={cn("text-[12px] truncate mt-0.5", complete ? "text-muted" : "text-muted-dark")}>
                                    {complete ? `${name} · ${participant.email}` : "Not completed yet"}
                                  </div>
                                )}
                              </div>
                            </div>
                            <ChevronDown className={cn("w-4 h-4 text-muted-dark shrink-0 transition-transform", isOpen && "rotate-180")} />
                          </button>
                          {isOpen && (
                            <div className="px-6 pb-6">
                              <ParticipantFormSection
                                frameless
                                index={index}
                                participant={participant}
                                errors={fieldErrors[index]}
                                hideEmergencyContact={sharedContactActive}
                                onChange={(field, value) => updateParticipant(index, field, value)}
                              />
                              {index < participants.length - 1 && (
                                <div className="flex justify-end mt-5">
                                  <button
                                    type="button"
                                    onClick={() => goToNextTicket(index)}
                                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-dark-lighter text-light font-headline text-[11px] font-bold uppercase tracking-[0.12em] hover:border-primary hover:text-primary transition-colors"
                                  >
                                    Next ticket <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {isMulti && (
                    <>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={useSharedContact}
                        onClick={toggleSharedContact}
                        className="flex items-start gap-3 text-left w-full px-1 py-1"
                      >
                        <span
                          className={cn(
                            "w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                            useSharedContact ? "bg-primary border-primary" : "border-dark-lighter"
                          )}
                        >
                          {useSharedContact && <Check className="w-3 h-3 text-dark" strokeWidth={3} />}
                        </span>
                        <span className="text-[12.5px] text-muted leading-relaxed">
                          Use one emergency contact for all tickets
                        </span>
                      </button>

                      {useSharedContact && (
                        <SharedEmergencyContactSection
                          name={sharedEmergencyContact.name}
                          phone={sharedEmergencyContact.phone}
                          errors={emergencyContactErrors}
                          onChange={updateSharedEmergencyContact}
                        />
                      )}
                    </>
                  )}
                </div>

                <div className="flex justify-between items-center mt-5">
                  <button
                    type="button"
                    onClick={goToTicket}
                    className="inline-flex items-center gap-2 h-11 px-4 rounded-xl font-headline text-[12px] font-bold uppercase tracking-[0.12em] text-muted hover:bg-dark-light hover:text-light transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="font-headline text-[10px] uppercase tracking-[0.15em] text-muted-dark">2 / 3</span>
                    <button type="button" onClick={goToReview} disabled={!detailsValid} className={continueBtnCls}>
                      Continue <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 2: Review & pay ── */}
            {step === 2 && payPhase === "verify" && (
              <GuestEmailVerificationStep
                eventId={eventId}
                eventTitle={event.title}
                emails={emailsToVerify}
                onBack={() => {
                  setError("");
                  setStep(1);
                }}
                onComplete={onVerified}
              />
            )}

            {step === 2 && payPhase === "pay" && (
              !clientSecret ? (
                error && !processing ? (
                  // Checkout could not start (e.g. the event sold out mid-session).
                  // Offer recovery instead of an endless spinner. The message is
                  // already shown in the error banner above.
                  <div className="bg-dark border border-dark-lighter rounded-[14px] p-8 text-center">
                    <p className="text-[13px] text-muted mb-6">We couldn&apos;t start your payment.</p>
                    <div className="flex flex-wrap justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => { setError(""); setStep(1); }}
                        className="inline-flex items-center gap-2 h-11 px-4 rounded-xl font-headline text-[12px] font-bold uppercase tracking-[0.12em] text-muted border border-dark-lighter hover:text-light hover:border-primary transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to details
                      </button>
                      <button type="button" onClick={startCheckout} className={continueBtnCls}>
                        Try again <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-dark border border-dark-lighter rounded-[14px] p-6 space-y-4" role="status" aria-label="Loading payment">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-11 w-full rounded-lg" />
                  </div>
                )
              ) : (
                <ReviewPayStep
                  clientSecret={clientSecret}
                  eventId={eventId}
                  reviewRows={reviewRows}
                  confirmAmountLabel={money(total)}
                  onBack={() => {
                    setError("");
                    setClientSecret("");
                    setStep(1);
                  }}
                  onConfirmed={onConfirmed}
                  onError={setError}
                />
              )
            )}
          </div>

          {/* ── RIGHT: order summary ── */}
          <OrderSummary
            eventTitle={event.title}
            dateLabel={dateLabel}
            locationLabel={locationLabel}
            coverImageUrl={event.coverImageUrl}
            lines={tierLines.map((t) => ({
              label: t.qty > 1 ? `${t.qty} × ${t.label}` : t.label,
              value: money(t.price * t.qty),
            }))}
            feeLine={totalTickets > 0 && athletePaysFee ? { label: "Service fee", value: money(feeTotal) } : null}
            totalLabel={totalTickets > 0 ? money(total) : null}
          />
        </div>
      </div>

      <SignInModal
        isOpen={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
        onSuccess={() => {
          setIsSignInOpen(false);
          prefilledRef.current = false;
        }}
      />
    </div>
  );
}
