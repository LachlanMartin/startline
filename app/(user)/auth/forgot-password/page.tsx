"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight, KeyRound } from "lucide-react";
import { resetPassword, confirmResetPassword } from "aws-amplify/auth";
import { mapResetPasswordError } from "@/lib/auth-errors";

type Step = "request" | "confirm";

function ForgotPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [step,        setStep]        = useState<Step>("request");
  const [email,       setEmail]       = useState(searchParams.get("email") ?? "");
  const [code,        setCode]        = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPw,      setShowPw]      = useState(false);
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await resetPassword({ username: email });
      setStep("confirm");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("UserNotFoundException") || msg.includes("NotAuthorizedException")) {
        setStep("confirm"); // Don't reveal if email exists
      } else {
        setError("Could not send reset code. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) { setError("Passwords do not match."); return; }
    if (newPassword.length < 8)  { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    try {
      await confirmResetPassword({ username: email, confirmationCode: code.trim(), newPassword });
      router.push("/?reset=1");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(mapResetPasswordError(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-dark-darker flex items-center justify-center px-6">
      <div className="w-full max-w-[440px] page-in">
        <Link href="/">
          <Image src="/images/logo-title.svg" alt="Startline" width={160} height={40} className="h-10 w-auto mx-auto mb-12 opacity-80" />
        </Link>

        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-6">
          <KeyRound className="w-7 h-7 text-primary" />
        </div>

        {step === "request" ? (
          <>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4 text-center">Reset password</div>
            <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-4 text-center">
              Forgot your<br /><span className="text-primary">password?</span>
            </h1>
            <p className="text-muted text-[15px] leading-relaxed mb-8 text-center">
              Enter your email and we&apos;ll send you a 6-digit reset code.
            </p>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">{error}</div>
            )}

            <form onSubmit={handleRequest} className="space-y-5">
              <div>
                <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-2">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-dark border border-dark-lighter rounded-md pl-10 pr-4 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors" />
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="bg-machined shadow-machined w-full text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 rounded-md flex items-center justify-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Sending…</> : <>Send reset code <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4 text-center">New password</div>
            <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-4 text-center">
              Enter your<br /><span className="text-primary">reset code.</span>
            </h1>
            <p className="text-muted text-[15px] leading-relaxed mb-8 text-center">
              Check <strong className="text-light">{email}</strong> for your 6-digit code, then choose a new password.
            </p>
            <p className="text-muted text-[13px] leading-relaxed mb-8 text-center mt-1">
              Can&apos;t see it? Check your spam or junk folder.
            </p>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">{error}</div>
            )}

            <form onSubmit={handleConfirm} className="space-y-5">
              <div>
                <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-2">Reset code</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} required
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full bg-dark border border-dark-lighter rounded-md px-4 py-3 text-[22px] text-light tracking-[0.5em] text-center placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors font-headline font-black" />
              </div>
              <div>
                <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-2">New password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input type={showPw ? "text" : "password"} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full bg-dark border border-dark-lighter rounded-md pl-10 pr-11 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors" />
                  <button type="button" onClick={() => setShowPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark hover:text-primary transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-2">Confirm new password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input type={showPw ? "text" : "password"} required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-dark border border-dark-lighter rounded-md pl-10 pr-4 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors" />
                </div>
              </div>
              <button type="submit" disabled={loading || code.length < 6}
                className="bg-machined shadow-machined w-full text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 rounded-md flex items-center justify-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Resetting…</> : <>Set new password <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>

            <button onClick={() => { setStep("request"); setError(""); }}
              className="mt-6 w-full text-center font-headline text-[12px] uppercase tracking-widest text-muted hover:text-primary transition-colors">
              ← Use a different email
            </button>
          </>
        )}

        <p className="mt-6 text-center font-headline text-[12px] uppercase tracking-widest text-muted">
          Remembered it?{" "}
          <Link href="/" className="text-primary hover:underline">Back to home</Link>
        </p>
      </div>
    </main>
  );
}

export default function UserForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
