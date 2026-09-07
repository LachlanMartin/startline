"use client";

import { useState } from "react";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { ArrowLeft, Check, ChevronDown, CreditCard } from "lucide-react";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripe() {
  if (!stripePromise && stripePublishableKey) stripePromise = loadStripe(stripePublishableKey);
  return stripePromise;
}

export interface ReviewRow {
  label: string;
  value: string;
}

interface ReviewPayStepProps {
  clientSecret: string;
  eventId: string;
  reviewRows: ReviewRow[];
  confirmAmountLabel: string;
  /** This event's actual refund policy, so terms are concrete rather than boilerplate. */
  refundLines: string[];
  /** What cancelling right now would return, e.g. "Cancel today and you get A$134.55 back." */
  refundHeadline: string;
  onBack: () => void;
  onConfirmed: (paymentIntentId: string) => void;
  onError: (msg: string) => void;
}

export default function ReviewPayStep(props: ReviewPayStepProps) {
  const stripe = getStripe();

  if (!stripe || !props.clientSecret) {
    return (
      <div className="bg-dark border border-dark-lighter rounded-[14px] p-6 text-center">
        <p className="text-[13px] text-muted">
          Stripe is not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable payments.
        </p>
      </div>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret: props.clientSecret,
    appearance: {
      theme: "night",
      variables: {
        colorPrimary: "#B3E153",
        colorBackground: "#2a2a2a",
        colorText: "#f5f7fa",
        colorDanger: "#ef4444",
        fontFamily: "Chakra Petch, system-ui, sans-serif",
        borderRadius: "10px",
      },
    },
  };

  return (
    <Elements stripe={stripe} options={options}>
      <ReviewPayForm {...props} />
    </Elements>
  );
}

function ReviewPayForm({
  clientSecret,
  eventId,
  reviewRows,
  confirmAmountLabel,
  refundLines,
  refundHeadline,
  onBack,
  onConfirmed,
  onError,
}: ReviewPayStepProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [terms, setTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!stripe || !elements || !terms) return;
    setSubmitting(true);
    onError("");

    const { error: submitError } = await elements.submit();
    if (submitError) {
      onError(submitError.message ?? "Payment failed.");
      setSubmitting(false);
      return;
    }

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/events/${eventId}/register/confirmation`,
      },
      redirect: "if_required",
    });

    if (error) {
      onError(error.message ?? "Payment failed.");
      setSubmitting(false);
      return;
    }
    if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
      onConfirmed(paymentIntent.id);
      return;
    }
    setSubmitting(false);
  };

  return (
    <>
      <div className="bg-dark border border-dark-lighter rounded-[14px] p-6">
        <div className="font-headline text-[10.5px] font-bold uppercase tracking-[0.15em] text-muted mb-4">
          Review your registration
        </div>

        <div className="mb-5">
          {reviewRows.map((r) => (
            <div
              key={r.label}
              className="flex justify-between items-baseline gap-4 py-[11px] border-b border-white/[0.06] last:border-b-0"
            >
              <span className="text-[13px] text-muted shrink-0">{r.label}</span>
              <span className="font-headline text-[13px] font-bold text-light text-right max-w-[60%]">{r.value}</span>
            </div>
          ))}
        </div>

        {/* Payment */}
        <div className="bg-dark-light border border-dark-lighter rounded-[12px] p-5 mb-5">
          <div className="font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-muted mb-4">
            Payment
          </div>
          <PaymentElement />
        </div>

        {/* What cancelling would return, stated before they pay rather than buried in
            terms. Empty on a free event, which has no refund policy to state. */}
        {refundHeadline && (
          <div className="rounded-[12px] border border-dark-lighter bg-dark px-4 py-3 mb-4">
            <p className="text-[12.5px] text-light leading-relaxed">{refundHeadline}</p>
          </div>
        )}

        {/* Terms */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            role="checkbox"
            aria-checked={terms}
            onClick={() => setTerms((t) => !t)}
            className="shrink-0 mt-0.5"
          >
            <span
              className={`w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center transition-colors ${
                terms ? "bg-primary border-primary" : "border-dark-lighter"
              }`}
            >
              {terms && <Check className="w-3 h-3 text-dark" strokeWidth={3} />}
            </span>
          </button>
          <div className="text-[12.5px] text-muted leading-relaxed">
            <button type="button" onClick={() => setTerms((t) => !t)} className="text-left">
              I agree to the event{" "}
            </button>
            <button
              type="button"
              onClick={() => setShowTerms((s) => !s)}
              aria-expanded={showTerms}
              className="text-primary hover:underline"
            >
              terms &amp; conditions
            </button>
            <button type="button" onClick={() => setTerms((t) => !t)} className="text-left">
              {" "}and confirm the above information is correct.
            </button>
          </div>
        </div>

        {showTerms && (
          <div className="mt-3 rounded-lg border border-dark-lighter bg-dark-light overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-dark-lighter">
              <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary">Terms &amp; Conditions</span>
              <button type="button" onClick={() => setShowTerms(false)} aria-label="Close terms">
                <ChevronDown className="w-4 h-4 text-muted rotate-180" />
              </button>
            </div>
            <div className="px-4 py-3 max-h-40 overflow-y-auto text-muted text-[12px] leading-relaxed space-y-2">
              <p>Event terms and conditions are set by the organiser. By registering you agree to participate in accordance with the organiser&apos;s rules and the Startline platform guidelines.</p>
              {refundLines.length > 0 && (
                <div>
                  <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Refund policy</p>
                  {refundLines.map((line, i) => <p key={i}>{line}</p>)}
                </div>
              )}
              <p>Ensure the details you have provided are accurate before paying.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 h-11 px-4 rounded-xl font-headline text-[12px] font-bold uppercase tracking-[0.12em] text-muted hover:bg-dark-light hover:text-light transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className="flex items-center gap-3">
          <span className="font-headline text-[10px] uppercase tracking-[0.15em] text-muted-dark">3 / 3</span>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!terms || !stripe || submitting}
            className="inline-flex items-center gap-2 h-11 px-[22px] rounded-xl bg-machined text-dark font-headline text-[12px] font-bold uppercase tracking-[0.13em] shadow-machined hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            {submitting ? (
              <><span className="w-4 h-4 border-2 border-dark/40 border-t-dark rounded-full animate-spin" /> Processing…</>
            ) : (
              <><CreditCard className="w-3.5 h-3.5" /> Confirm &amp; pay {confirmAmountLabel}</>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
