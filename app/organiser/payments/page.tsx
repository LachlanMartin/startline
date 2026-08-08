"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, AlertCircle, CreditCard, ArrowRight, ExternalLink, ShieldCheck, RefreshCw, UserCog } from "lucide-react";
import Link from "next/link";
import {
  Skeleton, PageHeaderSkeleton, PageShellSkeleton,
} from "@/components/ui/skeleton";
import { isNative, openExternal } from "@/lib/capacitor";
import AbnField, { isAbnAcceptableForPaid, type AbnLookupState } from "@/components/organiser/AbnField";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full bg-dark-light border border-dark-lighter rounded-xl px-4 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors";

interface Profile {
  orgName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  legalName: string | null;
  abn: string | null;
  dob: string | null;
  insuranceDeclared: boolean;
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
}

function maskAccountId(id: string) {
  if (id.length <= 8) return id;
  return id.slice(0, 8) + "•".repeat(id.length - 8);
}

async function goToStripe(url: string) {
  if (isNative()) {
    await openExternal(url);
  } else {
    window.location.href = url;
  }
}

function PaymentsContent() {
  const searchParams = useSearchParams();
  const refreshed    = searchParams.get("refresh") === "1";

  const [profile,    setProfile]    = useState<Profile | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error,      setError]      = useState("");

  const [legalName,         setLegalName]         = useState("");
  const [abn,               setAbn]               = useState("");
  const [abnLookup,         setAbnLookup]         = useState<AbnLookupState>({ status: "idle" });
  const [dob,               setDob]               = useState("");
  const [insuranceDeclared, setInsuranceDeclared] = useState(false);

  useEffect(() => {
    fetch("/api/organiser/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((data: Profile | null) => {
        if (!data) return;
        setProfile(data);
        setLegalName(data.legalName ?? "");
        setAbn(data.abn ?? "");
        setDob(data.dob ?? "");
        setInsuranceDeclared(data.insuranceDeclared ?? false);
      })
      .finally(() => setLoading(false));
  }, []);

  const profileIncomplete =
    !profile?.orgName || !profile?.contactName || !profile?.contactEmail || !profile?.phone;

  const saveAndConnect = async () => {
    setError("");

    if (profileIncomplete) {
      setError("Please complete your organiser profile before connecting Stripe.");
      return;
    }
    if (!legalName.trim()) {
      setError("Legal name is required before connecting your Stripe account.");
      return;
    }
    if (!abn.trim()) {
      setError("ABN is required before connecting your Stripe account. Without an ABN you cannot host paid events on Startline.");
      return;
    }
    if (!isAbnAcceptableForPaid(abnLookup, abn)) {
      setError("Enter a valid active ABN before connecting Stripe. Without an ABN you cannot host paid events on Startline.");
      return;
    }
    if (!insuranceDeclared) {
      setError("You must declare that you hold current public liability insurance ($10M minimum) before connecting.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/organiser/profile", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          orgName:      profile?.orgName      ?? "",
          contactName:  profile?.contactName  ?? "",
          contactEmail: profile?.contactEmail ?? "",
          phone:        profile?.phone        ?? "",
          legalName,
          abn,
          dob: dob || undefined,
          insuranceDeclared,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError((d as { error?: string }).error ?? "Failed to save profile.");
        return;
      }
    } finally {
      setSaving(false);
    }

    setConnecting(true);
    try {
      const res  = await fetch("/api/organiser/stripe/connect", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Failed to generate Stripe onboarding link. Please try again.");
        return;
      }
      await goToStripe(data.url);
    } finally {
      setConnecting(false);
    }
  };

  const continueSetup = async () => {
    setConnecting(true);
    try {
      const res  = await fetch("/api/organiser/stripe/connect", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Failed to generate Stripe link.");
        return;
      }
      await goToStripe(data.url);
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <PageShellSkeleton maxWidth="max-w-[760px]" className="pt-14 px-6">
        <PageHeaderSkeleton actions={0} />
        <Skeleton className="h-40 w-full rounded-2xl mb-4" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </PageShellSkeleton>
    );
  }

  const isConnected = profile?.stripeOnboardingComplete === true;
  const inProgress  = !!profile?.stripeAccountId && !isConnected;

  return (
      <div className="min-h-screen bg-dark-darker">

      <main className="pt-14">
        <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-24 lg:pb-12 page-in">

          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <div className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-2">
              Payments
            </div>
            <h1 className="font-headline text-[32px] sm:text-[44px] font-black italic tracking-tighter leading-none text-white mb-3">
              Get paid for<br /><span className="text-primary">your events.</span>
            </h1>
            <p className="text-muted text-[14px] sm:text-[15px] max-w-lg">
              To accept registrations and receive payouts through Startline, you need to connect a Stripe Express account. This is only required for marketplace listings — directory listings linking to an external platform don&apos;t need this.
            </p>
          </div>

          {/* Refresh banner */}
          {refreshed && !isConnected && (
            <div className="mb-6 flex items-start gap-3 bg-amber-400/10 border border-amber-400/20 rounded-xl px-5 py-4">
              <RefreshCw className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
              <div>
                <div className="font-headline text-[13px] font-bold text-amber-200 uppercase tracking-widest mb-0.5">Setup not complete</div>
                <div className="text-[13px] text-amber-300/80">It looks like you left Stripe before finishing. Click continue below to pick up where you left off.</div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 flex items-start gap-3 bg-red-400/10 border border-red-400/20 rounded-xl px-5 py-4">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div className="text-[13px] text-red-300">{error}</div>
            </div>
          )}

          {/* ── State 1: Connected ── */}
          {isConnected && (
            <Card className="mb-6 border-primary/20 bg-primary/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-primary mb-1">
                      Stripe account connected
                    </div>
                    <div className="text-[13px] text-muted mb-3">
                      Your Stripe Express account is verified and ready to receive payouts.
                      Account: <span className="font-mono text-muted-light">{maskAccountId(profile?.stripeAccountId ?? "")}</span>
                    </div>
                    <a
                      href="https://connect.stripe.com/express_login"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest text-primary hover:text-white transition-colors"
                    >
                      Manage payouts in Stripe <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── State 2: In progress ── */}
          {inProgress && (
            <Card className="mb-6 border-blue-400/20 bg-blue-400/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-400/15 border border-blue-400/30 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5 text-blue-300" />
                  </div>
                  <div className="flex-1">
                    <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-blue-300 mb-1">
                      Stripe setup in progress
                    </div>
                    <div className="text-[13px] text-muted mb-4">
                      Your Stripe account has been created but identity verification is not yet complete. Continue where you left off to start accepting payments.
                    </div>
                    <button
                      onClick={continueSetup}
                      disabled={connecting}
                      className="inline-flex items-center gap-2 font-headline text-[13px] font-bold uppercase tracking-widest bg-gradient-to-br from-[rgb(194,236,119)] to-[rgb(179,225,83)] text-dark px-5 py-3 rounded-lg shadow-machined hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connecting
                        ? <><span className="w-4 h-4 border-2 border-dark/40 border-t-dark rounded-full animate-spin" /> Opening Stripe…</>
                        : <>Continue Stripe setup <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Profile-incomplete warning */}
          {profileIncomplete && (
            <div className="mb-6 flex items-start gap-3 bg-amber-400/10 border border-amber-400/20 rounded-xl px-5 py-4">
              <UserCog className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
              <div>
                <div className="font-headline text-[13px] font-bold text-amber-200 uppercase tracking-widest mb-0.5">
                  Complete your profile first
                </div>
                <div className="text-[13px] text-amber-300/80 mb-2">
                  Your organiser profile is missing required fields (organisation name, contact name, phone, and contact email).
                  These are needed before you can connect Stripe.
                </div>
                <Link
                  href="/organiser/profile"
                  className="inline-flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest text-amber-200 underline hover:text-white transition-colors"
                >
                  Go to profile <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}

          {/* ── Form ── */}
          <Card>
            <CardContent className="p-4 sm:p-6 lg:p-8">
              <h2 className="font-headline text-xl font-black italic tracking-tighter text-white mb-1">
                {isConnected ? "Your details" : "Step 1 — Your details"}
              </h2>
              <p className="text-[13px] text-muted mb-6">
                Required for ATO tax reporting under the Sharing Economy Reporting Regime (SERR). Stripe holds your bank account and identity details — Startline only stores your legal name, ABN, and a Stripe account reference.
              </p>

              <div className="space-y-5">
                <div>
                  <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted-light block mb-2">
                    Legal name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Jane Smith"
                    className={inputCls}
                  />
                  <p className="text-[11px] text-muted-dark mt-1.5">Your legal first and last name as it appears on your ID. Required for ATO SERR reporting.</p>
                </div>

                <AbnField
                  value={abn}
                  onChange={setAbn}
                  onLookupChange={setAbnLookup}
                  inputClassName={inputCls}
                  required
                  showPaidNote
                />

                <div>
                  <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted-light block mb-2">
                    Date of birth
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className={inputCls}
                  />
                  <p className="text-[11px] text-muted-dark mt-1.5">Used for identity verification with Stripe and ATO SERR reporting. Not required if you only list external-link events.</p>
                </div>
              </div>

              {/* Insurance declaration */}
              <div className="mt-6 bg-white/[0.03] border border-dark-lighter rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <ShieldCheck className="w-5 h-5 text-muted mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-muted-light mb-2">
                      Public liability insurance declaration
                    </div>
                    <p className="text-[13px] text-muted leading-relaxed mb-4">
                      Before listing events on Startline, you must hold and maintain current public liability insurance with a minimum coverage of <strong className="text-muted-light">$10 million per occurrence</strong>, underwritten by an APRA-registered insurer, covering the full duration of each event. Startline does not collect or verify insurance certificates — this is a self-declaration on your honour (ToS §5.3).
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex-shrink-0 mt-0.5">
                        <input
                          type="checkbox"
                          checked={insuranceDeclared}
                          onChange={(e) => setInsuranceDeclared(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${insuranceDeclared ? "bg-primary border-primary" : "bg-dark-light border-dark-lighter group-hover:border-muted"}`}>
                          {insuranceDeclared && (
                            <svg className="w-3 h-3 text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <span className="text-[13px] text-muted leading-relaxed">
                        I declare that I currently hold public liability insurance meeting Startline&apos;s minimum requirements, and I will maintain this coverage for the full duration of every event I list.
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Connect / update button */}
              {!isConnected && (
                <div className="mt-8 pt-6 border-t border-dark-lighter">
                  <h2 className="font-headline text-xl font-black italic tracking-tighter text-white mb-1">
                    Step 2 — Connect Stripe
                  </h2>
                  <p className="text-[13px] text-muted mb-5">
                    You&apos;ll be taken to Stripe&apos;s secure, hosted onboarding. Stripe will collect your date of birth (for identity verification) and bank account details for payouts. Startline never sees or stores this information.
                  </p>
                  <button
                    onClick={saveAndConnect}
                    disabled={saving || connecting}
                    className="w-full inline-flex items-center justify-center gap-2 font-headline text-[13px] font-bold uppercase tracking-widest bg-gradient-to-br from-[rgb(194,236,119)] to-[rgb(179,225,83)] text-dark px-8 py-4 rounded-xl shadow-machined hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving || connecting
                      ? <><span className="w-4 h-4 border-2 border-dark/40 border-t-dark rounded-full animate-spin" /> {saving ? "Saving…" : "Opening Stripe…"}</>
                      : <>{inProgress ? "Continue Stripe setup" : "Connect with Stripe"} <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense>
      <PaymentsContent />
    </Suspense>
  );
}
