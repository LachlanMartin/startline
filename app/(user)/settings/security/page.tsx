"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, ShieldAlert, Trash2, KeyRound, Plus, ArrowRight, Check, Copy, Eye, EyeOff } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";

export default function SecuritySettingsPage() {
  const router = useRouter();
  const { status } = useAuthContext();

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // MFA setup state
  const [setupStep, setSetupStep] = useState<"idle" | "loading" | "qr" | "verify">("idle");
  const [secretCode, setSecretCode] = useState("");
  const [secretCopied, setSecretCopied] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [qrUri, setQrUri] = useState("");

  // Change password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/user/mfa")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setMfaEnabled(data.mfaEnabled); })
      .catch(() => {});
  }, [status]);

  const clearMessages = () => { setError(""); setSuccess(""); };

  const handleStartSetup = async () => {
    clearMessages();
    setSetupStep("loading");
    try {
      const r = await fetch("/api/user/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup" }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Failed to start setup."); setSetupStep("idle"); return; }
      const uri = `otpauth://totp/Startline:${data.secretCode}?secret=${data.secretCode}&issuer=Startline`;
      setSecretCode(data.secretCode);
      setQrUri(uri);
      setSetupStep("qr");
    } catch { setError("Something went wrong."); setSetupStep("idle"); }
  };

  const handleVerifySetup = async () => {
    clearMessages();
    if (totpCode.length < 6) { setError("Enter the full code."); return; }
    setSetupStep("verify");
    try {
      const r = await fetch("/api/user/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify-setup", code: totpCode }),
      });
      if (r.ok) {
        setMfaEnabled(true);
        setSetupStep("idle");
        setTotpCode("");
        setQrUri("");
        setSecretCode("");
        setSuccess("MFA enabled successfully.");
      } else {
        const data = await r.json();
        setError(data.error || "Invalid code. Try again.");
        setSetupStep("qr");
      }
    } catch { setError("Something went wrong."); setSetupStep("qr"); }
  };

  const handleDisableMfa = async () => {
    clearMessages();
    setLoading(true);
    try {
      const r = await fetch("/api/user/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable" }),
      });
      if (r.ok) {
        setMfaEnabled(false);
        setSuccess("MFA disabled.");
      } else {
        const data = await r.json();
        setError(data.error || "Failed to disable MFA.");
      }
    } catch { setError("Something went wrong."); } finally { setLoading(false); }
  };

  const handleChangePassword = async () => {
    clearMessages();
    if (newPw.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setError("Passwords do not match."); return; }
    setPwLoading(true);
    try {
      const r = await fetch("/api/user/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change-password", currentPassword: currentPw, newPassword: newPw }),
      });
      if (r.ok) {
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
        setSuccess("Password changed successfully.");
      } else {
        const data = await r.json();
        setError(data.error || "Failed to change password.");
      }
    } catch { setError("Something went wrong."); } finally { setPwLoading(false); }
  };

  if (status === "loading" || status === "unauthenticated") return null;

  const sectionCls = "border border-dark-lighter rounded-xl p-5 space-y-4";
  const btnCls = "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-headline text-[11px] font-bold uppercase tracking-widest border transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <main className="min-h-screen pt-20 pb-16 px-4 sm:px-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-headline text-4xl font-black italic tracking-tighter leading-[0.9]">
          Security<br /><span className="text-primary">settings.</span>
        </h1>
        <p className="text-muted text-[14px] leading-relaxed mt-2">Manage your multi-factor authentication and security keys.</p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">{error}</div>
      )}
      {success && (
        <div className="mb-5 px-4 py-3 rounded-md bg-green-900/20 border border-green-500/30 text-green-400 font-headline text-[13px] flex items-center gap-2">
          <Check className="w-4 h-4" /> {success}
        </div>
      )}

      {/* MFA Section */}
      <div className={sectionCls + " mb-6"}>
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-headline text-[13px] font-bold uppercase tracking-widest">Multi-Factor Authentication</h2>
            <p className="text-muted text-[12px] mt-0.5">
              {mfaEnabled ? "TOTP authenticator app is active." : "Add an extra layer of security to your account."}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between py-3 px-4 bg-dark rounded-lg">
          <div className="flex items-center gap-3">
            <Shield className={`w-5 h-5 ${mfaEnabled ? "text-green-500" : "text-muted-dark"}`} />
            <div>
              <span className="font-headline text-[12px] font-bold uppercase tracking-widest">TOTP Authenticator</span>
              <p className="text-muted text-[11px]">{mfaEnabled ? "Active" : "Not configured"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {!mfaEnabled && setupStep === "idle" && (
              <button onClick={handleStartSetup} disabled={loading}
                className={btnCls + " border-primary/30 text-primary hover:bg-primary/10"}>
                <Plus className="w-3.5 h-3.5" /> Set up
              </button>
            )}
            {mfaEnabled && (
              <button onClick={handleDisableMfa} disabled={loading}
                className={btnCls + " border-red-500/30 text-red-400 hover:bg-red-500/10"}>
                <Trash2 className="w-3.5 h-3.5" /> Disable
              </button>
            )}
          </div>
        </div>

        {/* MFA setup flow */}
        {!mfaEnabled && (setupStep === "qr" || setupStep === "verify") && qrUri && (
          <div className="border-t border-dark-lighter pt-4 space-y-4">
            <p className="font-headline text-[11px] uppercase tracking-widest text-muted">
              {setupStep === "qr" ? "Scan this QR code with your authenticator app:" : "Enter the code from your authenticator app:"}
            </p>
            {setupStep === "qr" && (
              <>
                <div className="flex justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`}
                    alt="TOTP QR Code"
                    className="w-48 h-48 rounded-lg"
                  />
                </div>
                <div className="bg-dark rounded-lg p-3">
                  <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-2">Or enter this key manually:</p>
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-[14px] tracking-[0.3em] text-light select-all">
                      {secretCode.match(/.{1,4}/g)?.join(" ")}
                    </code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(secretCode); setSecretCopied(true); setTimeout(() => setSecretCopied(false), 2000); }}
                      className="flex-shrink-0 text-muted hover:text-primary transition-colors p-1"
                    >
                      {secretCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
            <div className="flex gap-2">
              <input
                type="text" inputMode="numeric"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="flex-1 bg-dark border border-dark-lighter rounded-md px-4 py-2.5 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors tracking-[0.5em] text-center font-bold"
                autoFocus
              />
              <button onClick={handleVerifySetup} disabled={totpCode.length < 6 || setupStep === "verify"}
                className={btnCls + " bg-machined shadow-machined text-dark border-0"}>
                {setupStep === "verify" ? <>Verifying…</> : <><ArrowRight className="w-3.5 h-3.5" /> Verify</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Change Password Section */}
      <div className={sectionCls}>
        <div className="flex items-center gap-3">
          <KeyRound className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-headline text-[13px] font-bold uppercase tracking-widest">Password</h2>
            <p className="text-muted text-[12px] mt-0.5">Change your account password.</p>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }} className="space-y-3">
          <div>
            <label htmlFor="current-pw" className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1">Current Password</label>
            <div className="relative">
              <input id="current-pw" type={showPw ? "text" : "password"} required value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)} placeholder="Enter current password"
                className="w-full bg-dark border border-dark-lighter rounded-md px-4 py-2.5 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors pr-11" />
              <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark hover:text-primary">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="new-pw" className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1">New Password</label>
            <div className="relative">
              <input id="new-pw" type={showPw ? "text" : "password"} required value={newPw}
                onChange={(e) => setNewPw(e.target.value)} placeholder="Min 8 characters"
                className="w-full bg-dark border border-dark-lighter rounded-md px-4 py-2.5 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors pr-11" />
            </div>
          </div>
          <div>
            <label htmlFor="confirm-pw" className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1">Confirm New Password</label>
            <input id="confirm-pw" type={showPw ? "text" : "password"} required value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)} placeholder="Re-enter new password"
              className="w-full bg-dark border border-dark-lighter rounded-md px-4 py-2.5 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors" />
          </div>
          <button type="submit" disabled={pwLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-headline text-[11px] font-bold uppercase tracking-widest border transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-primary/30 text-primary hover:bg-primary/10">
            {pwLoading ? <>Updating…</> : <>Change password <ArrowRight className="w-3.5 h-3.5" /></>}
          </button>
        </form>
      </div>
    </main>
  );
}
