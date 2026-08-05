"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Building2, ShieldCheck, CreditCard, Users } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import {
  Skeleton, PageHeaderSkeleton, PageShellSkeleton,
} from "@/components/ui/skeleton";

export default function OrganiserSetupPage() {
  const router = useRouter();
  const { status } = useAuthContext();
  const [step, setStep] = useState<"info" | "form">("info");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (status === "unauthenticated") {
    try { sessionStorage.setItem("startline_intent_organiser", "true"); } catch {}
    return (
      <main className="min-h-screen bg-dark-darker flex items-center justify-center pt-20">
        <div className="text-center max-w-md px-6">
          <Building2 className="w-16 h-16 text-muted mx-auto mb-4" />
          <h1 className="font-headline text-3xl font-black italic tracking-tighter text-light mb-2">
            Sign in to continue
          </h1>
          <p className="text-muted text-sm mb-8">You need a Startline account before you can set one up. Sign in or create an account and we&apos;ll bring you straight back here.</p>
          <Link
            href="/?signin=true"
            className="bg-machined shadow-machined inline-flex items-center gap-2 text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 px-8 rounded-md hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform"
          >
            Sign in or create account <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    );
  }

  if (status === "loading") {
    return (
      <PageShellSkeleton maxWidth="max-w-lg">
        <PageHeaderSkeleton actions={0} />
        <Skeleton className="h-40 w-full rounded-2xl mb-4" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </PageShellSkeleton>
    );
  }

  const handleCreate = async () => {
    if (!orgName.trim()) {
      setError("Please enter an organisation name.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/organiser/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: orgName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create organiser profile.");
      }

      router.push("/organiser/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    { icon: Users, label: "Publish events", desc: "List your events on Australia's fitness calendar and put them in front of thousands of athletes." },
    { icon: CreditCard, label: "Take entries", desc: "Sell tickets on Startline and get paid out to your bank account through Stripe." },
    { icon: ShieldCheck, label: "Manage it all", desc: "Track entries, message athletes and run race day from a single organiser dashboard." },
  ];

  return (
    <main className="min-h-screen bg-dark-darker pt-24 pb-16">
      <div className="max-w-[640px] mx-auto px-6">

        {step === "info" && (
          <>
            <div className="text-center mb-10">
              <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary block mb-4">
                Step 1 of 2
              </span>
              <h1 className="font-headline text-4xl sm:text-5xl font-black italic tracking-tighter leading-[0.9] text-light mb-4">
                Publish your events<br />
                <span className="text-primary">on Startline.</span>
              </h1>
              <p className="text-muted text-[15px] leading-relaxed max-w-md mx-auto">
                Set up an organiser profile once, then list events, take entries and manage race day from one dashboard. It takes about a minute.
              </p>
            </div>

            <div className="space-y-4 mb-10">
              {benefits.map((s, i) => (
                <div key={i} className="flex gap-4 bg-dark rounded-xl p-5 border border-dark-lighter">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <s.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-headline text-sm font-bold text-light">{s.label}</h3>
                    <p className="text-muted text-[13px] leading-relaxed mt-1">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-dark rounded-xl p-6 border border-dark-lighter mb-8">
              <h3 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> How verification works
              </h3>
              <div className="space-y-4 text-muted text-[13px] leading-relaxed">
                <div>
                  <p className="font-headline text-[12px] font-bold text-light mb-1">Do I need to be verified to list an event?</p>
                  <p>No. You can build a listing as soon as your profile exists. While you are unverified, our team checks each event before it goes live.</p>
                </div>
                <div>
                  <p className="font-headline text-[12px] font-bold text-light mb-1">How long does that check take?</p>
                  <p>Usually 24 to 48 hours on business days. We notify you as soon as your event is approved.</p>
                </div>
                <div>
                  <p className="font-headline text-[12px] font-bold text-light mb-1">How do I get verified?</p>
                  <p>Our team grants verification once you have run events with us. We look at event quality, consistency and athlete feedback. Verified organisers publish straight away.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep("form")}
              className="bg-machined shadow-machined w-full text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 rounded-md flex items-center justify-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>

            <p className="mt-4 text-center font-headline text-[11px] uppercase tracking-widest text-muted">
              By continuing you agree to our{" "}
              <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
            </p>
          </>
        )}

        {step === "form" && (
          <>
            <div className="mb-8">
              <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary block mb-2">
                Step 2 of 2
              </span>
              <h2 className="font-headline text-3xl font-black italic tracking-tighter leading-[0.9] text-light mb-2">
                Name your<br />
                <span className="text-primary">organisation.</span>
              </h2>
              <p className="text-muted text-[14px] leading-relaxed">
                This is the name athletes see on your listings. You can add your logo, bio and contact details straight after.
              </p>
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-2">
                  Organisation name <span className="text-primary">*</span>
                </label>
                <input
                  type="text" required value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Apex Endurance Events"
                  className="w-full bg-dark border border-dark-lighter rounded-md px-4 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors"
                />
              </div>

              <button
                onClick={handleCreate}
                disabled={loading}
                className="bg-machined shadow-machined w-full text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 rounded-md flex items-center justify-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Creating…</>
                ) : (
                  <><Check className="w-5 h-5" /> Create Organiser Profile</>
                )}
              </button>

              <button
                onClick={() => setStep("info")}
                className="w-full text-center font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary transition-colors"
              >
                Back
              </button>
            </div>
          </>
        )}

      </div>
    </main>
  );
}
