"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, User, ChevronDown, Check, AtSign, ShieldAlert } from "lucide-react";
import { signIn, signUp, signOut, resetPassword, confirmResetPassword, confirmSignIn } from "aws-amplify/auth";
import { useAuthContext } from "@/context/AuthContext";
import { validateUsername } from "@/lib/username-validation";

type View = "signin" | "signup" | "onboarding" | "username" | "mfa";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function calcAge(dobStr: string): number {
  const dob   = new Date(dobStr);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function totpUri(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const fn = (details as Record<string, unknown>).getSetupUri;
  if (typeof fn !== "function") return null;
  const uri = fn("Startline");
  return uri && typeof uri.toString === "function" ? uri.toString() : null;
}

export default function SignInModal({ isOpen, onClose, onSuccess }: SignInModalProps) {
  const router      = useRouter();
  const { refresh } = useAuthContext();

  const [view,            setView]            = useState<View>("signin");
  const [email,           setEmail]           = useState("");
  const [firstName,       setFirstName]       = useState("");
  const [lastName,        setLastName]        = useState("");
  const [dobDay,          setDobDay]          = useState("");
  const [dobMonth,        setDobMonth]        = useState("");
  const [dobYear,         setDobYear]         = useState("");

  const [acceptedTerms,   setAcceptedTerms]   = useState(false);
  const [showTerms,       setShowTerms]       = useState(false);
  const [showPrivacy,     setShowPrivacy]     = useState(false);
  const [password,        setPassword]        = useState("");
  const [confirm,         setConfirm]         = useState("");
  const [showPw,          setShowPw]          = useState(false);
  const [error,           setError]           = useState("");
  const [loading,         setLoading]         = useState(false);
  const [username,        setUsername]        = useState("");
  const [usernameStatus,  setUsernameStatus]  = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [usernameError,   setUsernameError]   = useState("");

  const [checkingEmail,   setCheckingEmail]   = useState(false);
  const [userExists,      setUserExists]      = useState<boolean | null>(null);
  const [userStatus,      setUserStatus]      = useState<string | null>(null);
  const [resetCode,       setResetCode]       = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [newPwConfirm,    setNewPwConfirm]    = useState("");
  const [resetSent,       setResetSent]       = useState(false);
  const [newPwStep,       setNewPwStep]       = useState<"initial" | "sent" | "done">("initial");
  // When signIn returned CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED
  const [challengeFlow,   setChallengeFlow]   = useState(false);
  const [mfaStep,         setMfaStep]         = useState<"none" | "select" | "setup" | "challenge">("none");
  const [totpCode,        setTotpCode]        = useState("");
  const [totpSetupUri,    setTotpSetupUri]    = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      /* eslint-disable react-hooks/set-state-in-effect */
      setView("signin");
      setEmail(""); setFirstName(""); setLastName("");
      setDobDay(""); setDobMonth(""); setDobYear("");
      setAcceptedTerms(false); setShowTerms(false); setShowPrivacy(false);
      setPassword(""); setConfirm("");
      setError(""); setShowPw(false);
      setUsername(""); setUsernameStatus("idle"); setUsernameError("");
      setCheckingEmail(false); setUserExists(null); setUserStatus(null);
      setResetCode(""); setNewPassword(""); setNewPwConfirm("");
      setResetSent(false); setNewPwStep("initial"); setChallengeFlow(false);
      setMfaStep("none"); setTotpCode(""); setTotpSetupUri(null);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Username validation — format + profanity checked client-side.
  const usernameStatus_ = useMemo(() => {
    const val = username.trim().toLowerCase();
    if (!val) return { status: "idle" as const, error: "" };
    const result = validateUsername(val);
    if (!result.valid) return { status: "invalid" as const, error: result.reason };
    return { status: "valid" as const, error: "" };
  }, [username]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setUsernameStatus(usernameStatus_.status);
    setUsernameError(usernameStatus_.error);
  }, [usernameStatus_]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.includes("@")) { setError("Please enter a valid email."); return; }
    setCheckingEmail(true);
    try {
      const res = await fetch("/api/user/exists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setUserExists(true);
        setUserStatus("CONFIRMED");
        return;
      }
      const data = await res.json();
      if (!data.exists) {
        setUserExists(false);
        setUserStatus(null);
      } else {
        setUserExists(true);
        setUserStatus(data.status === "UNCONFIRMED" ? "CONFIRMED" : data.status);
      }
    } catch {
      setUserExists(true);
      setUserStatus("CONFIRMED");
    } finally {
      setCheckingEmail(false);
    }
  };

  // ── Sign in ────────────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signOut({ global: false }).catch(() => {});
      const result = await signIn({ username: email, password });

      if (result.nextStep.signInStep === "CONFIRM_SIGN_UP") {
        onClose(); router.push("/auth/verify-email?email=" + encodeURIComponent(email)); return;
      }
      if (result.nextStep.signInStep === "RESET_PASSWORD") {
        onClose(); router.push("/auth/forgot-password?email=" + encodeURIComponent(email)); return;
      }
      if (result.nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_TOTP_CODE") {
        setView("mfa"); setMfaStep("challenge"); return;
      }
      if (result.nextStep.signInStep === "CONTINUE_SIGN_IN_WITH_TOTP_SETUP") {
        setTotpSetupUri(totpUri(result.nextStep.totpSetupDetails));
        setView("mfa"); setMfaStep("setup"); return;
      }
      if (result.nextStep.signInStep === "CONTINUE_SIGN_IN_WITH_MFA_SELECTION") {
        setView("mfa"); setMfaStep("select"); return;
      }
      if (result.nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
        setPassword("");
        setNewPassword("");
        setNewPwConfirm("");
        setChallengeFlow(true);
        return;
      }
      if (result.nextStep.signInStep !== "DONE") {
        setError("Additional verification required. Please contact support."); return;
      }

      await fetch("/api/user/auth/session", { method: "POST" });

      try {
        const pendingName     = sessionStorage.getItem("startline_pending_name");
        const pendingUsername = sessionStorage.getItem("startline_pending_username");
        if (pendingName || pendingUsername) {
          await fetch("/api/user/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(pendingName     ? { name: pendingName }         : {}),
              ...(pendingUsername ? { username: pendingUsername }  : {}),
            }),
          });
          sessionStorage.removeItem("startline_pending_name");
          sessionStorage.removeItem("startline_pending_username");
        }
      } catch {}

      await refresh();
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const errName = (err as { name?: string })?.name ?? "";
      const msg     = err instanceof Error ? err.message : "";
      if (errName === "NotAuthorizedException" || msg.includes("Incorrect username or password")) {
        setError("Incorrect email or password.");
      } else if (errName === "UserNotConfirmedException") {
        onClose(); router.push("/auth/verify-email?email=" + encodeURIComponent(email));
      } else if (errName === "UserNotFoundException") {
        setUserExists(false);
        setError("");
      } else {
        setError(msg || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── MFA confirm ──────────────────────────────────────────────────────────────
  const handleMfaConfirm = async () => {
    setError("");
    if (totpCode.length < 6) { setError("Please enter the full code."); return; }
    setLoading(true);
    try {
      const result = await confirmSignIn({ challengeResponse: totpCode });
      if (result.nextStep.signInStep === "DONE") {
        await fetch("/api/user/auth/session", { method: "POST" });
        await refresh();
        onSuccess?.();
        onClose();
      } else {
        setError("Verification failed. Please try again.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg || "Invalid code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── MFA setup confirm ──────────────────────────────────────────────────────
  const handleMfaSetupConfirm = async () => {
    setError("");
    if (totpCode.length < 6) { setError("Please enter the full code."); return; }
    setLoading(true);
    try {
      const result = await confirmSignIn({ challengeResponse: totpCode });
      if (result.nextStep.signInStep === "DONE") {
        await fetch("/api/user/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "enable" }) });
        await fetch("/api/user/auth/session", { method: "POST" });
        await refresh();
        onSuccess?.();
        onClose();
      } else {
        setError("Verification failed. Please try again.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg || "Invalid code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Handle MFA selection ───────────────────────────────────────────────────
  const handleMfaSelect = async (type: string) => {
    setError("");
    setLoading(true);
    try {
      const result = await confirmSignIn({ challengeResponse: type });
      if (result.nextStep.signInStep === "CONTINUE_SIGN_IN_WITH_TOTP_SETUP") {
        setTotpSetupUri(totpUri(result.nextStep.totpSetupDetails));
        setMfaStep("setup");
      } else if (result.nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_TOTP_CODE") {
        setMfaStep("challenge");
      } else if (result.nextStep.signInStep === "DONE") {
        await fetch("/api/user/auth/session", { method: "POST" });
        await refresh();
        onSuccess?.();
        onClose();
      } else {
        setError("Something went wrong. Try again.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg || "Failed to select MFA method.");
    } finally {
      setLoading(false);
    }
  };

  // ── Handle new‑password challenge from sign-in ──────────────────────────────
  const handleConfirmNewPassword = async () => {
    setError("");
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPassword !== newPwConfirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const result = await confirmSignIn({ challengeResponse: newPassword });

      if (result.nextStep.signInStep !== "DONE") {
        setError("Something went wrong. Please try again."); return;
      }

      await fetch("/api/user/auth/session", { method: "POST" });
      await refresh();
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to set password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Handle in‑modal password reset (FORCE_CHANGE_PASSWORD) ──────────────────
  const handleStartReset = async () => {
    setError("");
    setLoading(true);
    try {
      await resetPassword({ username: email });
      setResetSent(true);
      setNewPwStep("sent");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send reset code.";
      if (msg.includes("LimitExceededException")) {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteReset = async () => {
    setError("");
    if (resetCode.length < 6) { setError("Please enter the full verification code."); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPassword !== newPwConfirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: resetCode,
        newPassword,
      });
      // Sign in immediately with the new password
      setPassword(newPassword);
      setError("");
      try {
        await signOut({ global: false }).catch(() => {});
        const result = await signIn({ username: email, password: newPassword });
        if (result.nextStep.signInStep === "DONE") {
          await fetch("/api/user/auth/session", { method: "POST" });
          await refresh();
          onSuccess?.();
          onClose();
          return;
        }
      } catch {}
      // Fallback: show the password field
      setUserExists(true);
      setUserStatus("CONFIRMED");
      setNewPwStep("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset password.";
      if (msg.includes("CodeMismatchException")) {
        setError("That code is incorrect.");
      } else if (msg.includes("ExpiredCodeException")) {
        setError("That code has expired. Please request a new one.");
      } else if (msg.includes("InvalidPasswordException")) {
        setError("Password must be at least 8 characters with upper, lower and a number.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Sign up step 1 ─────────────────────────────────────────────────────────
  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }
    if (!/[A-Z]/.test(password)) { setError("Password must contain at least one uppercase letter."); return; }
    if (!/[a-z]/.test(password)) { setError("Password must contain at least one lowercase letter."); return; }
    if (!/[0-9]/.test(password)) { setError("Password must contain at least one number."); return; }
    setFirstName(""); setLastName(""); setDobDay(""); setDobMonth(""); setDobYear("");
    setAcceptedTerms(false); setShowTerms(false); setShowPrivacy(false);
    setView("onboarding");
  };

  // ── Onboarding step 2 → creates Cognito account ───────────────────────────
  const handleContinueOnboarding = async () => {
    setError("");
    if (!firstName.trim()) { setError("Please enter your first name."); return; }
    if (!lastName.trim())  { setError("Please enter your last name."); return; }

    const day   = parseInt(dobDay,   10);
    const month = parseInt(dobMonth, 10);
    const year  = parseInt(dobYear,  10);
    if (!dobDay || !dobMonth || !dobYear || isNaN(day) || isNaN(month) || isNaN(year)) {
      setError("Please enter your date of birth."); return;
    }
    if (month < 1 || month > 12) { setError("Please enter a valid month (1-12)."); return; }
    if (day < 1 || day > 31)     { setError("Please enter a valid day (1-31)."); return; }
    if (year < 1900 || year > new Date().getFullYear()) { setError("Please enter a valid year."); return; }

    const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const testDate = new Date(isoDate + "T00:00:00");
    if (isNaN(testDate.getTime()) || testDate.getDate() !== day) {
      setError("Please enter a valid date of birth."); return;
    }

    const age = calcAge(isoDate);
    if (age < 13)  { setError("You must be at least 13 years old to create an account."); return; }
    if (age > 120) { setError("Please enter a valid date of birth."); return; }

    if (!acceptedTerms) { setError("You must accept the Terms & Conditions and Privacy Policy to continue."); return; }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    const userAttributes: Record<string, string> = {
      email,
      name:      fullName,
      birthdate: isoDate,
    };
    setLoading(true);
    try {
      await signUp({
        username: email,
        password,
        options: { userAttributes, autoSignIn: true },
      });
      try {
        sessionStorage.setItem("startline_pending_name",  fullName);
        sessionStorage.setItem("startline_pending_dob",   isoDate);
      } catch {}
      setError("");
      setView("username");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("UsernameExistsException")) {
        setError("An account with that email already exists.");
      } else if (msg.includes("InvalidPasswordException")) {
        setError("Password must be at least 8 characters with upper, lower and a number.");
      } else {
        setError(msg || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Username step → store handle and redirect to verify ────────────────────
  const handleContinueUsername = (skip = false) => {
    if (!skip && (usernameStatus === "invalid" || usernameStatus === "checking")) return;
    if (!skip && username.trim()) {
      try { sessionStorage.setItem("startline_pending_username", username.trim().toLowerCase()); } catch {}
    }
    onClose();
    router.push("/auth/verify-email?email=" + encodeURIComponent(email));
  };

  const switchView = (v: "signin" | "signup") => {
    setView(v); setError(""); setPassword(""); setConfirm("");
    setCheckingEmail(false); setUserExists(null); setUserStatus(null);
    setResetCode(""); setNewPassword(""); setNewPwConfirm("");
    setResetSent(false); setNewPwStep("initial"); setChallengeFlow(false);
    setMfaStep("none"); setTotpCode(""); setTotpSetupUri(null);
  };

  const goBackToEmail = () => {
    setUserExists(null);
    setUserStatus(null);
    setPassword("");
    setError("");
    setResetCode(""); setNewPassword(""); setNewPwConfirm("");
    setResetSent(false); setNewPwStep("initial"); setChallengeFlow(false);
    setMfaStep("none"); setTotpCode(""); setTotpSetupUri(null);
  };

  const dobDayRef   = useRef<HTMLInputElement>(null);
  const dobMonthRef = useRef<HTMLInputElement>(null);
  const dobYearRef  = useRef<HTMLInputElement>(null);

  if (!isOpen || typeof document === "undefined") return null;

  const inputCls    = "w-full bg-dark border border-dark-lighter rounded-md pl-10 pr-4 py-2.5 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors";
  const dobInputCls = "w-full bg-dark border border-dark-lighter rounded-md px-3 py-2.5 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors text-center";
  const labelCls    = "font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1";
  const btnCls      = "bg-machined shadow-machined w-full text-dark font-headline text-sm font-bold uppercase tracking-widest py-3 rounded-md flex items-center justify-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-50 disabled:cursor-not-allowed";
  const errCls      = "mb-3 px-3 py-2.5 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]";

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-[440px] bg-dark-darker border border-dark-lighter rounded-2xl p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">

        {/* Header */}
        {view !== "onboarding" && view !== "username" ? (
          <div className="flex items-center gap-2 mb-6">
            <div className="flex flex-1 gap-1 p-1 bg-dark rounded-lg">
              {(["signin", "signup"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => switchView(v)}
                  className={`flex-1 py-2 rounded-md font-headline text-[12px] font-bold uppercase tracking-widest transition-all ${
                    view === v ? "bg-primary text-dark" : "text-muted hover:text-light"
                  }`}
                >
                  {v === "signin" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="flex-shrink-0 text-muted hover:text-primary transition-colors p-1" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-primary transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        )}

        {/* ── Sign In – Email step ── */}
        {view === "signin" && userExists === null && !challengeFlow && (
          <>
            <div className="mb-6">
              <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary block mb-2">User Portal</span>
              <h2 className="font-headline text-5xl font-black italic tracking-tighter leading-[0.9] mb-3">
                Welcome<br /><span className="text-primary">back.</span>
              </h2>
              <p className="text-muted text-[14px] leading-relaxed">Enter your email to get started.</p>
            </div>

            {error && <div className={errCls}>{error}</div>}

            <form onSubmit={handleCheckEmail} className="space-y-4">
              <div>
                <label htmlFor="signin-email" className={labelCls}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input
                    id="signin-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputCls}
                    autoFocus
                  />
                </div>
              </div>
              <button type="submit" disabled={checkingEmail} className={btnCls}>
                {checkingEmail ? (
                  <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Checking…</>
                ) : (
                  <>Continue <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </>
        )}

        {/* ── Sign In – No account found ── */}
        {view === "signin" && userExists === false && (
          <>
            <div className="mb-6">
              <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary block mb-2">User Portal</span>
              <h2 className="font-headline text-5xl font-black italic tracking-tighter leading-[0.9] mb-3">
                No account<br /><span className="text-primary">found.</span>
              </h2>
              <p className="text-muted text-[14px] leading-relaxed">
                No account exists with <strong className="text-light">{email}</strong>. Would you like to create one?
              </p>
            </div>

            <div className="space-y-3">
              <button onClick={() => switchView("signup")} className={btnCls}>
                Create account <ArrowRight className="w-4 h-4" />
              </button>
              <button type="button" onClick={goBackToEmail} className="w-full font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary transition-colors py-1">
                Use a different email
              </button>
            </div>
          </>
        )}

        {/* ── Sign In – Password step ── */}
        {view === "signin" && userExists === true && userStatus === "CONFIRMED" && !challengeFlow && (
          <>
            <div className="mb-6">
              <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary block mb-2">User Portal</span>
              <h2 className="font-headline text-5xl font-black italic tracking-tighter leading-[0.9] mb-3">
                Welcome<br /><span className="text-primary">back.</span>
              </h2>
              <p className="text-muted text-[14px] leading-relaxed">
                Sign in as <strong className="text-light">{email}</strong>
              </p>
            </div>

            {error && <div className={errCls}>{error}</div>}

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="signin-password" className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted">Password</label>
                  <Link href="/auth/forgot-password" onClick={onClose} className="font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary transition-colors">Forgot?</Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input
                    id="signin-password"
                    type={showPw ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className={inputCls + " pr-11"}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark hover:text-primary transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className={btnCls}>
                {loading ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Signing in…</> : <>Sign in <ArrowRight className="w-4 h-4" /></>}
              </button>
              <button type="button" onClick={goBackToEmail} className="w-full font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary transition-colors py-1">
                Use a different email
              </button>
            </form>
          </>
        )}

        {/* ── Sign In – New password challenge (CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED) ── */}
        {view === "signin" && challengeFlow && (
          <>
            <div className="mb-6">
              <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary block mb-2">Set New Password</span>
              <h2 className="font-headline text-4xl font-black italic tracking-tighter leading-[0.9] mb-2">
                Update your<br /><span className="text-primary">password.</span>
              </h2>
              <p className="text-muted text-[14px] leading-relaxed">Your account requires a new password before you can sign in.</p>
            </div>

            {error && <div className={errCls}>{error}</div>}

            <form onSubmit={(e) => { e.preventDefault(); handleConfirmNewPassword(); }} className="space-y-3">
              <div>
                <label htmlFor="challenge-new-password" className={labelCls}>New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input
                    id="challenge-new-password"
                    type={showPw ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className={inputCls + " pr-11"}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark hover:text-primary transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="challenge-confirm-password" className={labelCls}>Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input
                    id="challenge-confirm-password"
                    type={showPw ? "text" : "password"}
                    required
                    value={newPwConfirm}
                    onChange={(e) => setNewPwConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    className={inputCls}
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className={btnCls}>
                {loading ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Updating…</> : <>Set password <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </>
        )}

        {/* ── MFA ── */}
        {view === "mfa" && (
          <>
            <div className="mb-6">
              <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary block mb-2">Two-Factor Authentication</span>
              <h2 className="font-headline text-4xl font-black italic tracking-tighter leading-[0.9] mb-2">
                {mfaStep === "select" ? <><span>Choose your</span><br /><span className="text-primary">method.</span></> :
                 mfaStep === "setup"  ? <><span>Set up</span><br /><span className="text-primary">MFA.</span></> :
                                        <><span>Enter your</span><br /><span className="text-primary">code.</span></>}
              </h2>
              <p className="text-muted text-[14px] leading-relaxed">
                {mfaStep === "select" && "Select how you'd like to verify your identity."}
                {mfaStep === "setup"  && "Scan the QR code with your authenticator app, then enter the code shown."}
                {mfaStep === "challenge" && "Enter the 6-digit code from your authenticator app."}
              </p>
            </div>

            {error && <div className={errCls}>{error}</div>}

            {mfaStep === "select" && (
              <div className="space-y-3">
                <button onClick={() => handleMfaSelect("TOTP")} disabled={loading} className={btnCls}>
                  <ShieldAlert className="w-4 h-4" /> Authenticator App
                </button>
              </div>
            )}

            {mfaStep === "setup" && totpSetupUri && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpSetupUri)}`}
                    alt="TOTP QR Code"
                    className="w-48 h-48 rounded-lg"
                  />
                </div>
                <form onSubmit={(e) => { e.preventDefault(); handleMfaSetupConfirm(); }} className="space-y-3">
                  <div>
                    <label htmlFor="mfa-setup-code" className={labelCls}>Verification Code</label>
                    <div className="relative">
                      <ShieldAlert className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                      <input
                        id="mfa-setup-code"
                        type="text"
                        inputMode="numeric"
                        required
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        className={inputCls + " tracking-[0.5em] text-center font-bold"}
                        autoFocus
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={loading || totpCode.length < 6} className={btnCls}>
                    {loading ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Verifying…</> : <>Verify & sign in <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              </div>
            )}

            {mfaStep === "challenge" && (
              <form onSubmit={(e) => { e.preventDefault(); handleMfaConfirm(); }} className="space-y-4">
                <div>
                  <label htmlFor="mfa-challenge-code" className={labelCls}>Authentication Code</label>
                  <div className="relative">
                    <ShieldAlert className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                    <input
                      id="mfa-challenge-code"
                      type="text"
                      inputMode="numeric"
                      required
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      className={inputCls + " tracking-[0.5em] text-center font-bold"}
                      autoFocus
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading || totpCode.length < 6} className={btnCls}>
                  {loading ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Verifying…</> : <>Verify & sign in <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            )}
          </>
        )}

        {/* ── Sign Up ── */}
        {view === "signup" && (
          <>
            <div className="mb-4">
              <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary block mb-2">User Portal</span>
              <h2 className="font-headline text-4xl font-black italic tracking-tighter leading-[0.9] mb-2">
                Join<br /><span className="text-primary">Startline.</span>
              </h2>
              <p className="text-muted text-[13px] leading-snug">Free account to save events and track registrations.</p>
            </div>

            {error && <div className={errCls}>{error}</div>}

            <form onSubmit={handleSignUp} className="space-y-3">
              <div>
                <label htmlFor="signup-email" className={labelCls}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input id="signup-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
                </div>
              </div>
              <div>
                <label htmlFor="signup-password" className={labelCls}>Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input id="signup-password" type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" className={inputCls + " pr-11"} />
                  <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark hover:text-primary transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="signup-confirm-password" className={labelCls}>Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input id="signup-confirm-password" type={showPw ? "text" : "password"} required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" className={inputCls} />
                </div>
              </div>
              <button type="submit" disabled={loading} className={btnCls}>
                {loading ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Creating account…</> : <>Create account <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </>
        )}

        {/* ── Onboarding ── */}
        {view === "onboarding" && (
          <>
            <div className="mb-5 pt-2">
              <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary block mb-2">Account Creation</span>
              <h2 className="font-headline text-4xl font-black italic tracking-tighter leading-[0.9] mb-2">
                Welcome to<br /><span className="text-primary">Startline.</span>
              </h2>
              <p className="text-muted text-[13px] leading-snug">Tell us a bit about yourself to get started.</p>
            </div>

            {error && <div className={errCls}>{error}</div>}

            <div className="space-y-3">
              {/* First / Last name */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="onboarding-first-name" className={labelCls}>First Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                    <input id="onboarding-first-name" autoFocus type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label htmlFor="onboarding-last-name" className={labelCls}>Last Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                    <input id="onboarding-last-name" type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last" className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Date of birth — three text inputs */}
              <div>
                <label id="onboarding-dob-label" className={labelCls}>Date of Birth</label>
                <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="onboarding-dob-label">
                  <div>
                    <input
                      ref={dobDayRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={dobDay}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        setDobDay(v);
                        if (v.length === 2) dobMonthRef.current?.focus();
                      }}
                      placeholder="DD"
                      aria-label="Day"
                      className={dobInputCls}
                    />
                  </div>
                  <div>
                    <input
                      ref={dobMonthRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={dobMonth}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        setDobMonth(v);
                        if (v.length === 2) dobYearRef.current?.focus();
                      }}
                      placeholder="MM"
                      aria-label="Month"
                      className={dobInputCls}
                    />
                  </div>
                  <div>
                    <input
                      ref={dobYearRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={dobYear}
                      onChange={(e) => setDobYear(e.target.value.replace(/\D/g, ""))}
                      placeholder="YYYY"
                      aria-label="Year"
                      className={dobInputCls}
                    />
                  </div>
                </div>
              </div>

              
              {/* T&C */}
              <div className="pt-1 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex-shrink-0 mt-0.5">
                    <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="sr-only" />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      acceptedTerms ? "bg-primary border-primary" : "border-dark-lighter bg-dark group-hover:border-primary/50"
                    }`}>
                      {acceptedTerms && (
                        <svg className="w-3 h-3 text-dark" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="font-headline text-[11px] uppercase tracking-widest text-muted leading-relaxed">
                    I agree to the{" "}
                    <button type="button" onClick={(e) => { e.preventDefault(); setShowTerms(s => !s); setShowPrivacy(false); }} className="text-primary hover:underline">
                      Terms &amp; Conditions
                    </button>
                    {" "}and{" "}
                    <button type="button" onClick={(e) => { e.preventDefault(); setShowPrivacy(s => !s); setShowTerms(false); }} className="text-primary hover:underline">
                      Privacy Policy
                    </button>
                  </span>
                </label>

                {showTerms && (
                  <div className="rounded-lg border border-dark-lighter bg-dark overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-dark-lighter">
                      <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary">Terms &amp; Conditions</span>
                      <button type="button" onClick={() => setShowTerms(false)}><ChevronDown className="w-4 h-4 text-muted rotate-180" /></button>
                    </div>
                    <div className="px-4 py-3 max-h-36 overflow-y-auto text-muted text-[12px] leading-relaxed space-y-2">
                      <p>Terms and Conditions content coming soon.</p>
                      <p>By creating an account you agree to use this platform in accordance with our guidelines and applicable laws.</p>
                    </div>
                  </div>
                )}

                {showPrivacy && (
                  <div className="rounded-lg border border-dark-lighter bg-dark overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-dark-lighter">
                      <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary">Privacy Policy</span>
                      <button type="button" onClick={() => setShowPrivacy(false)}><ChevronDown className="w-4 h-4 text-muted rotate-180" /></button>
                    </div>
                    <div className="px-4 py-3 max-h-36 overflow-y-auto text-muted text-[12px] leading-relaxed space-y-2">
                      <p>Privacy Policy content coming soon.</p>
                      <p>We are committed to protecting your personal information and will only use your data in accordance with applicable privacy legislation.</p>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={handleContinueOnboarding} disabled={loading} className={btnCls}>
                {loading ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Saving…</> : <>Continue <ArrowRight className="w-4 h-4" /></>}
              </button>
              <button type="button" onClick={() => switchView("signup")} className="w-full font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary transition-colors py-1 mt-2 flex items-center justify-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to signup
              </button>
            </div>
          </>
        )}

        {/* ── Username ── */}
        {view === "username" && (
          <>
            <div className="mb-6 pt-2">
              <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary block mb-2">One last thing</span>
              <h2 className="font-headline text-4xl font-black italic tracking-tighter leading-[0.9] mb-2">
                Choose your<br /><span className="text-primary">handle.</span>
              </h2>
              <p className="text-muted text-[13px] leading-snug">Pick a unique username for your public profile. You can always change it later.</p>
            </div>

            {error && <div className={errCls}>{error}</div>}

            <div className="space-y-4">
              <div>
                <label htmlFor="username-input" className={labelCls}>Username</label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input
                    id="username-input"
                    autoFocus
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. janedoe"
                    className={`${inputCls} pr-10 ${
                      usernameStatus === "invalid" ? "border-red-500/50 focus:border-red-500" :
                      usernameStatus === "valid"   ? "border-green-500/50 focus:border-green-500" : ""
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameStatus === "checking" && <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin block" />}
                    {usernameStatus === "valid"    && <Check className="w-4 h-4 text-green-500" />}
                  </span>
                </div>
                {usernameError ? (
                  <p className="font-headline text-[10px] uppercase tracking-widest text-red-400 mt-1">{usernameError}</p>
                ) : (
                  <p className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-1">
                    3–30 characters — lowercase letters, numbers, hyphens only.
                  </p>
                )}
              </div>

              <button
                onClick={() => handleContinueUsername(false)}
                disabled={loading || usernameStatus === "invalid" || usernameStatus === "checking" || !username.trim()}
                className={btnCls}
              >
                {loading ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Creating account…</> : <>Create account <ArrowRight className="w-4 h-4" /></>}
              </button>

              <button
                type="button"
                onClick={() => handleContinueUsername(true)}
                disabled={loading}
                className="w-full font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary transition-colors py-1"
              >
                Skip for now
              </button>
            </div>
          </>
        )}

      </div>
    </div>,
    document.body
  );
}
