"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

interface StripeStatus {
  connected:      boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  error?:         string;
}

export default function PaymentsReturnPage() {
  const router = useRouter();
  const [status,  setStatus]  = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/organiser/stripe/status")
      .then((r) => r.json())
      .then((data: StripeStatus) => setStatus(data))
      .catch(() => setStatus({ connected: false, chargesEnabled: false, payoutsEnabled: false }))
      .finally(() => setLoading(false));
  }, []);

  const verified = status?.chargesEnabled && status?.payoutsEnabled;

  useEffect(() => {
    if (!verified) return;
    const t = setTimeout(() => router.push("/organiser/payments"), 3000);
    return () => clearTimeout(t);
  }, [verified, router]);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="w-full max-w-[440px] text-center">

        {loading && (
          <>
            <div className="flex justify-center mb-6" role="status" aria-label="Loading">
              <Skeleton className="h-16 w-16 rounded-full bg-gray-200" />
            </div>
            <h1 className="font-headline text-2xl font-black italic tracking-tighter text-gray-900 mb-2">
              Checking your account…
            </h1>
            <p className="text-gray-500 text-[14px] mb-6">
              We&apos;re confirming your Stripe setup with Stripe. This only takes a moment.
            </p>
            <div className="space-y-3">
              <Skeleton className="h-3 w-3/4 mx-auto bg-gray-200" />
              <Skeleton className="h-3 w-1/2 mx-auto bg-gray-200" />
            </div>
          </>
        )}

        {!loading && verified && (
          <>
            <div className="w-16 h-16 rounded-full bg-lime-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-lime-500" />
            </div>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-3">
              All done
            </div>
            <h1 className="font-headline text-3xl font-black italic tracking-tighter text-gray-900 mb-3">
              Stripe account connected.
            </h1>
            <p className="text-gray-500 text-[14px] mb-6">
              Your account is verified and ready to receive payouts. Redirecting you back to payments…
            </p>
            <div className="flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-ping" />
              <span className="font-headline text-[11px] uppercase tracking-widest text-gray-400">Redirecting…</span>
            </div>
          </>
        )}

        {!loading && !verified && (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-amber-500" />
            </div>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-amber-600 mb-3">
              Setup incomplete
            </div>
            <h1 className="font-headline text-3xl font-black italic tracking-tighter text-gray-900 mb-3">
              Not quite finished.
            </h1>
            <p className="text-gray-500 text-[14px] mb-6">
              Stripe hasn&apos;t fully verified your account yet. This can happen if you didn&apos;t complete all the steps. Go back to payments to continue where you left off.
            </p>
            <button
              onClick={() => router.push("/organiser/payments")}
              className="inline-flex items-center gap-2 font-headline text-[13px] font-bold uppercase tracking-widest bg-gray-900 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition-colors"
            >
              Back to payments
            </button>
          </>
        )}

      </div>
    </main>
  );
}
