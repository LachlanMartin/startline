"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import AbnField from "@/components/organiser/AbnField";

const inputCls = (err?: string) =>
  `w-full bg-dark border rounded-md px-4 py-3 text-[15px] text-light placeholder:text-muted-dark focus:outline-none transition-colors ${
    err ? "border-orange-500/70 focus:border-orange-500" : "border-dark-lighter focus:border-primary"
  }`;
const areaCls  = "w-full bg-dark border border-dark-lighter rounded-md px-4 py-3 text-[14px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none resize-none transition-colors";

const validators = {
  name:  (v: string) => !v.trim() ? "Required" : v.trim().length < 2 ? "Must be at least 2 characters" : !/^[a-zA-Z\s\-']+$/.test(v.trim()) ? "Letters only" : "",
  phone: (v: string) => !v.trim() ? "Required" : !/^\+?[\d\s\-().]{8,15}$/.test(v.trim()) ? "Enter a valid phone number" : "",
  email: (v: string) => !v.trim() ? "Required" : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "Enter a valid email address" : "",
};

function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between mb-2">
        <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-light">
          {label}{required && <span className="text-primary ml-0.5">*</span>}
        </label>
        {hint && <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-orange-400">{error}</p>}
    </div>
  );
}

const STEPS = [
  { n: "01", label: "Organisation", sub: "Name & bio"           },
  { n: "02", label: "Contact",      sub: "Your contact details" },
  { n: "03", label: "Finish",       sub: "Agree & get started"  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step,      setStep]      = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    orgName: "", abn: "", bio: "",
    firstName: "", lastName: "", phone: "", contactEmail: "",
    agreedToCommunity: false, agreedToTerms: false,
  });

  const u = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  // ── Animated step transition ─────────────────────────────────────────────
  const goTo = (next: number) => {
    if (animating) return;
    setDirection(next > step ? "forward" : "back");
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setError("");
      setFieldErrors({});
      setAnimating(false);
    }, 260);
  };

  const blurField = (field: string, value: string, type: keyof typeof validators) => {
    const err = validators[type](value);
    setFieldErrors((prev) => ({ ...prev, [field]: err }));
  };

  // ── Validation ──────────────────────────────────────────────────────────
  const validateStep = (s: number) => {
    if (s === 0) {
      if (!form.orgName.trim()) { setError("Please fill in all required fields to continue."); return false; }
    }
    if (s === 1) {
      const errs = {
        firstName:    validators.name(form.firstName),
        lastName:     validators.name(form.lastName),
        phone:        validators.phone(form.phone),
        contactEmail: validators.email(form.contactEmail),
      };
      setFieldErrors(errs);
      if (Object.values(errs).some(Boolean)) {
        setError("Please fix the errors above before continuing.");
        return false;
      }
    }
    return true;
  };

  // ── Save / submit ────────────────────────────────────────────────────────
  const setupOrg = async (silent = false): Promise<boolean> => {
    const res = await fetch("/api/organiser/setup", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ orgName: form.orgName, abn: form.abn }),
    });
    const data = await res.json();
    if (!res.ok) { if (!silent) setError(data.error); return false; }
    return true;
  };

  const save = async (submit = false, silent = false) => {
    if (!silent) setError("");
    if (!silent) setSaving(true);
    try {
      if (submit && (!form.agreedToCommunity || !form.agreedToTerms)) {
        setError("Please agree to both commitments to submit your application.");
        return;
      }
      const contactName = `${form.firstName} ${form.lastName}`.trim();
      const res = await fetch("/api/organiser/profile", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          orgName: form.orgName,
          bio: form.bio,
          abn: form.abn,
          contactName,
          contactEmail: form.contactEmail,
          phone: form.phone,
          submit,
        }),
      });
      const data = await res.json();
      if (!res.ok) { if (!silent) setError(data.error); return; }
      if (submit) router.push("/organiser/dashboard");
    } finally {
      if (!silent) setSaving(false);
    }
  };

  const handleNext = async () => {
    if (!validateStep(step)) return;
    if (step < STEPS.length - 1) {
      if (step === 0) {
        setSaving(true);
        const ok = await setupOrg(false);
        setSaving(false);
        if (!ok) return;
      } else {
        save(false, true);
      }
      goTo(step + 1);
    }
  };

  // ── Slide animation classes ──────────────────────────────────────────────
  const slideClass = animating
    ? direction === "forward"
      ? "opacity-0 translate-x-8"
      : "opacity-0 -translate-x-8"
    : "opacity-100 translate-x-0";

  return (
    <main className="min-h-screen bg-dark-darker relative">

      {/* ── Background gradient ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-dark/80 via-dark-darker to-dark/60 opacity-80" />
        <div className="absolute inset-x-0 top-0    h-[30%] bg-gradient-to-b  from-dark-darker to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t  from-dark-darker to-transparent" />
        <div className="absolute inset-y-0 left-0   w-[20%] bg-gradient-to-r  from-dark-darker to-transparent" />
        <div className="absolute inset-y-0 right-0  w-[20%] bg-gradient-to-l  from-dark-darker to-transparent" />
        <div className="absolute inset-0 scan-grid opacity-50" />
      </div>

      {/* ── Logo bar ── */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-center pt-safe pb-2">
        <Image src="/images/logo-title.svg" alt="Startline" width={140} height={36} className="h-8 w-auto" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 pt-14 min-h-screen flex items-start justify-center px-6 py-12 page-in">
        <div className="w-full max-w-[600px]">

          {/* ── Step indicators ── */}
          <div className="flex items-center mb-10">
            {STEPS.map((s, i) => {
              const done = i < step;
              const cur  = i === step;
              return (
                <div key={s.n} className="flex items-center flex-1 last:flex-none">
                  <div className={`flex items-center gap-2.5 transition-opacity ${cur ? "opacity-100" : "opacity-70"}`}>
                    <div className={`w-8 h-8 rounded-md border flex items-center justify-center font-headline font-black italic text-[13px] flex-shrink-0 transition-colors duration-300
                      ${cur  ? "bg-primary text-dark border-primary"
                      : done ? "bg-dark-lighter text-primary border-primary/40"
                      :        "bg-dark border-dark-lighter text-muted-dark"}`}>
                      {done ? <Check className="w-4 h-4" /> : s.n}
                    </div>
                    <div className={`hidden sm:block font-headline text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-300 ${cur ? "text-light" : "text-muted"}`}>
                      {s.label}
                    </div>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="flex-1 h-px mx-3 step-line" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step label */}
          <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4">
            Step {step + 1} of {STEPS.length}
          </div>

          {/* Animated step content */}
          <div
            ref={containerRef}
            className={`transition-all duration-[260ms] ease-in-out ${slideClass}`}
          >

            {/* ── Step 1: Organisation ── */}
            {step === 0 && (
              <>
                <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-2">
                  Tell us about your<br /><span className="text-primary">organisation.</span>
                </h1>
                <p className="text-muted text-[14px] mb-8">
                  This will appear on your organiser profile and event listings.
                </p>

                {error && <div className="mb-5 px-4 py-3 rounded-md bg-orange-500/5 border border-orange-500/30 text-orange-400 font-headline text-[13px]">{error}</div>}

                <Field label="Organisation / company name" required>
                  <input value={form.orgName} onChange={(e) => u({ orgName: e.target.value })}
                    placeholder="Endurance Events Australia" className={inputCls()} />
                </Field>

                <div className="mb-5">
                  <AbnField
                    value={form.abn}
                    onChange={(abn) => u({ abn })}
                    inputClassName={inputCls()}
                    showPaidNote
                  />
                </div>

                <Field label="About your organisation" hint={`${form.bio.length}/500`}>
                  <textarea rows={6} maxLength={500} value={form.bio} onChange={(e) => u({ bio: e.target.value })}
                    placeholder="Briefly describe the types of events you run and your experience as an event organiser."
                    className={areaCls} />
                </Field>
              </>
            )}

            {/* ── Step 2: Contact ── */}
            {step === 1 && (
              <>
                <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-2">
                  Your contact<br /><span className="text-primary">details.</span>
                </h1>
                <p className="text-muted text-[14px] mb-8">
                  This is who athletes and our team will reach out to about your events.
                </p>

                {error && <div className="mb-5 px-4 py-3 rounded-md bg-orange-500/5 border border-orange-500/30 text-orange-400 font-headline text-[13px]">{error}</div>}

                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-4 sm:gap-5">
                  <Field label="First name" required error={fieldErrors.firstName}>
                    <input value={form.firstName}
                      onChange={(e) => u({ firstName: e.target.value })}
                      onBlur={(e) => blurField("firstName", e.target.value, "name")}
                      placeholder="Jane" className={inputCls(fieldErrors.firstName)} />
                  </Field>
                  <Field label="Last name" required error={fieldErrors.lastName}>
                    <input value={form.lastName}
                      onChange={(e) => u({ lastName: e.target.value })}
                      onBlur={(e) => blurField("lastName", e.target.value, "name")}
                      placeholder="Smith" className={inputCls(fieldErrors.lastName)} />
                  </Field>
                </div>

                <Field label="Contact phone" required error={fieldErrors.phone}>
                  <input type="tel" value={form.phone}
                    onChange={(e) => u({ phone: e.target.value })}
                    onBlur={(e) => blurField("phone", e.target.value, "phone")}
                    placeholder="+61 4XX XXX XXX" className={inputCls(fieldErrors.phone)} />
                </Field>

                <Field label="Contact email" required error={fieldErrors.contactEmail}>
                  <input type="email" value={form.contactEmail}
                    onChange={(e) => u({ contactEmail: e.target.value })}
                    onBlur={(e) => blurField("contactEmail", e.target.value, "email")}
                    placeholder="jane@enduranceevents.com.au" className={inputCls(fieldErrors.contactEmail)} />
                </Field>
              </>
            )}

            {/* ── Step 3: Finish ── */}
            {step === 2 && (
              <>
                <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-2">
                  Almost<br /><span className="text-primary">there.</span>
                </h1>
                <p className="text-muted text-[14px] mb-8">
                  Agree to our community standards and terms to complete your setup.
                </p>

                {error && <div className="mb-5 px-4 py-3 rounded-md bg-orange-500/5 border border-orange-500/30 text-orange-400 font-headline text-[13px]">{error}</div>}

                {/* Community commitment */}
                <div className="bg-dark border border-dark-lighter rounded-lg p-6 mb-4">
                  <h2 className="font-headline text-xl font-black italic tracking-tight text-light mb-3">
                    Everyone belongs at<br /><span className="text-primary">the startline.</span>
                  </h2>
                  <p className="text-muted text-[14px] leading-relaxed mb-5">
                    When you join Startline, we ask you to uphold our community standards. I commit to welcoming all athletes regardless of their background, ability, age, or experience level, and to running events that are safe, inclusive, and free from discrimination.
                  </p>
                  <label className="flex items-start gap-4 cursor-pointer group">
                    <div className="relative flex-shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={form.agreedToCommunity}
                        onChange={(e) => u({ agreedToCommunity: e.target.checked })}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${form.agreedToCommunity ? "bg-primary border-primary" : "bg-dark-lighter border-dark-lighter group-hover:border-primary/50"}`}>
                        {form.agreedToCommunity && <Check className="w-3 h-3 text-dark" />}
                      </div>
                    </div>
                    <p className="text-[14px] text-muted leading-relaxed">
                      I agree to uphold Startline&apos;s community standards and treat all athletes with respect.
                    </p>
                  </label>
                </div>

                {/* Terms of service */}
                <label className="flex items-start gap-4 p-5 bg-dark border border-dark-lighter rounded-lg cursor-pointer hover:border-primary/40 transition-colors group">
                  <div className="relative flex-shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={form.agreedToTerms}
                      onChange={(e) => u({ agreedToTerms: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${form.agreedToTerms ? "bg-primary border-primary" : "bg-dark-lighter border-dark-lighter group-hover:border-primary/50"}`}>
                      {form.agreedToTerms && <Check className="w-3 h-3 text-dark" />}
                    </div>
                  </div>
                  <p className="text-[14px] text-muted leading-relaxed">
                    I agree to the{" "}
                    <a href="/terms" target="_blank" className="text-primary hover:underline">Terms of Service</a>
                    {" "}and{" "}
                    <a href="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</a>.
                  </p>
                </label>
              </>
            )}

          </div>

          {/* ── Navigation buttons ── */}
          <div className="pt-6 border-t border-dark-lighter mt-8 space-y-3">
            {step < STEPS.length - 1 ? (
              <button onClick={handleNext} disabled={animating}
                className="w-full bg-machined shadow-machined text-dark font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-4 rounded-md flex items-center justify-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform disabled:opacity-50">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => save(true)} disabled={saving || !form.agreedToTerms || !form.agreedToCommunity}
                className="w-full bg-machined shadow-machined text-dark font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-4 rounded-md flex items-center justify-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? "Saving…" : <>Complete setup <ArrowRight className="w-4 h-4" /></>}
              </button>
            )}
            <div className="flex items-center justify-between">
              <button
                onClick={() => step > 0 ? goTo(step - 1) : router.push("/organiser")}
                className="font-headline text-[13px] font-bold uppercase tracking-widest text-muted hover:text-light flex items-center gap-2 transition-colors py-2"
              >
                <ArrowLeft className="w-4 h-4" /> {step === 0 ? "Back to sign in" : "Back"}
              </button>
              {step < STEPS.length - 1 && (
                <button onClick={() => step === 0 ? setupOrg() : save(false)} disabled={saving}
                  className="font-headline text-[13px] font-bold uppercase tracking-widest text-muted hover:text-light px-4 py-2 transition-colors disabled:opacity-40">
                  Save draft
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
