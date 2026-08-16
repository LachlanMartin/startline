"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  X, ChevronRight, Upload, Move, Mail, Phone,
  CheckCircle, User, Lock, Bell, CreditCard, Cookie,
} from "lucide-react";
import { useSettings, type SettingsSection } from "@/context/SettingsContext";
import { Skeleton } from "@/components/ui/skeleton";

// ── shared form primitives ──────────────────────────────────────────────────

const inputCls = "w-full bg-dark-light border border-dark-lighter rounded-lg px-3 py-2.5 text-[14px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors";

function FieldLabel({ label, hint, required }: { label: string; hint?: string; required?: boolean }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted-light">
        {label}{required && <span className="text-primary font-black text-[14px] leading-none ml-0.5">*</span>}
      </label>
      {hint && <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">{hint}</span>}
    </div>
  );
}

// ── CoverEditor ─────────────────────────────────────────────────────────────

function CoverEditor({
  imageUrl, position, uploading, onUpload, onPositionChange, onRemove, fileRef, onDone,
}: {
  imageUrl: string; position: string; uploading: boolean;
  onUpload: (f: File) => void; onPositionChange: (p: string) => void;
  onRemove: () => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onDone?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging,   setDragging]   = useState(false);
  const [reposition, setReposition] = useState(false);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const parsePos = (pos: string) => {
    const [x, y] = pos.split(" ").map(v => parseFloat(v));
    return { x: isNaN(x) ? 50 : x, y: isNaN(y) ? 50 : y };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!reposition || !imageUrl) return;
    e.preventDefault();
    const { x, y } = parsePos(position);
    dragStart.current = { x: e.clientX, y: e.clientY, px: x, py: y };
    setDragging(true);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx   = ((e.clientX - dragStart.current.x) / rect.width)  * -100;
    const dy   = ((e.clientY - dragStart.current.y) / rect.height) * -100;
    const newX = Math.min(100, Math.max(0, dragStart.current.px + dx));
    const newY = Math.min(100, Math.max(0, dragStart.current.py + dy));
    onPositionChange(`${newX.toFixed(1)}% ${newY.toFixed(1)}%`);
  };
  const onMouseUp = () => setDragging(false);

  if (!imageUrl) return (
    <div
      className="relative h-28 rounded-xl overflow-hidden bg-dark-light border border-dark-lighter cursor-pointer"
      onClick={() => fileRef.current?.click()}
    >
      <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #b3e153 0%, transparent 50%), radial-gradient(circle at 80% 20%, #86efac 0%, transparent 40%)" }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-dark/80 rounded-lg px-3 py-2 flex items-center gap-2 font-headline text-[11px] font-bold uppercase tracking-widest text-muted-light border border-dark-lighter">
          {uploading
            ? <><div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Uploading…</>
            : <><Upload className="w-3.5 h-3.5" /> Upload cover</>}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div
        ref={containerRef}
        className={`relative h-28 rounded-xl overflow-hidden border border-dark-lighter select-none ${reposition ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      >
        <Image src={imageUrl} alt="Cover" fill className="object-cover pointer-events-none brightness-[.62] saturate-110"
          style={{ objectPosition: position }} draggable={false} sizes="(max-width: 768px) 100vw, 448px" />
        {reposition && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-1.5 bg-black/60 text-white rounded-lg px-3 py-1.5 font-headline text-[11px] font-bold uppercase tracking-wider">
              <Move className="w-3.5 h-3.5" /> Drag to reposition
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2">
        {reposition ? (
          <button onClick={() => { setReposition(false); onDone?.(); }}
            className="font-headline text-[11px] font-bold uppercase tracking-widest bg-primary text-dark px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity">
            Done
          </button>
        ) : (
          <button onClick={() => setReposition(true)}
            className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light flex items-center gap-1 transition-colors">
            <Move className="w-3 h-3" /> Reposition
          </button>
        )}
        <span className="text-white/20 text-xs">·</span>
        <button onClick={() => { setReposition(false); fileRef.current?.click(); }} disabled={uploading}
          className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light flex items-center gap-1 transition-colors disabled:opacity-40">
          <Upload className="w-3 h-3" /> {uploading ? "Uploading…" : "Change photo"}
        </button>
      </div>
    </div>
  );
}

// ── LogoEditor ──────────────────────────────────────────────────────────────

function LogoEditor({
  imageUrl, position, initial, uploading, onUpload, onPositionChange, fileRef, onDone,
}: {
  imageUrl: string; position: string; initial: string; uploading: boolean;
  onUpload: (f: File) => void; onPositionChange: (p: string) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onDone?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [reposition, setReposition] = useState(false);
  const [dragging,   setDragging]   = useState(false);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const parsePos = (pos: string) => {
    const [x, y] = pos.split(" ").map(v => parseFloat(v));
    return { x: isNaN(x) ? 50 : x, y: isNaN(y) ? 50 : y };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!reposition || !imageUrl) return;
    e.preventDefault();
    const { x, y } = parsePos(position);
    dragStart.current = { x: e.clientX, y: e.clientY, px: x, py: y };
    setDragging(true);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx   = ((e.clientX - dragStart.current.x) / rect.width)  * -100;
    const dy   = ((e.clientY - dragStart.current.y) / rect.height) * -100;
    const newX = Math.min(100, Math.max(0, dragStart.current.px + dx));
    const newY = Math.min(100, Math.max(0, dragStart.current.py + dy));
    onPositionChange(`${newX.toFixed(1)}% ${newY.toFixed(1)}%`);
  };
  const onMouseUp = () => setDragging(false);

  return (
    <div className="flex items-start gap-4">
      <div
        ref={containerRef}
        className={`relative w-24 h-24 rounded-2xl overflow-hidden bg-primary border border-dark-lighter shrink-0 select-none
          ${reposition && imageUrl ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      >
        {imageUrl
          ? <Image src={imageUrl} alt="Logo" fill className="object-cover pointer-events-none"
              style={{ objectPosition: position }} draggable={false} sizes="96px" />
          : <span className="font-headline font-black italic text-2xl text-dark flex items-center justify-center w-full h-full">{initial}</span>}
        {reposition && imageUrl && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
            <Move className="w-4 h-4 text-white" />
          </div>
        )}
        {!reposition && (
          <div className="absolute inset-0 bg-black/0 hover:bg-black/25 transition-colors flex items-center justify-center"
            onClick={() => !imageUrl && fileRef.current?.click()}>
            {uploading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { setReposition(false); fileRef.current?.click(); }} disabled={uploading}
            className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors disabled:opacity-40 flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> {uploading ? "Uploading…" : "Upload new photo"}
          </button>
          {imageUrl && (
            <>
              <span className="text-white/20 text-xs">·</span>
              {reposition ? (
                <button onClick={() => { setReposition(false); onDone?.(); }}
                  className="font-headline text-[12px] font-bold uppercase tracking-widest bg-primary text-dark px-2.5 py-1 rounded-md hover:opacity-90 transition-opacity">
                  Done
                </button>
              ) : (
                <button onClick={() => setReposition(true)}
                  className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light flex items-center gap-1 transition-colors">
                  <Move className="w-3 h-3" /> Reposition
                </button>
              )}
            </>
          )}
        </div>
        <p className="text-[11px] text-muted-dark mt-0.5">PNG or JPG, square recommended.</p>
      </div>
    </div>
  );
}

// ── Personal information form ────────────────────────────────────────────────

interface ProfileForm {
  orgName: string; bio: string; contactName: string;
  contactEmail: string; phone: string; facebook: string;
  logoUrl: string; logoPosition: string; coverImageUrl: string; coverPosition: string;
}

const EMPTY_FORM: ProfileForm = {
  orgName: "", bio: "", contactName: "", contactEmail: "",
  phone: "", facebook: "", logoUrl: "", logoPosition: "50% 50%", coverImageUrl: "", coverPosition: "50% 50%",
};

function PersonalInfoForm() {
  const { notifyProfileSaved } = useSettings();
  const router = useRouter();
  const [form,           setForm]           = useState<ProfileForm>(EMPTY_FORM);
  const [loadingForm,    setLoadingForm]     = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [error,          setError]          = useState("");
  const [logoUploading,  setLogoUploading]  = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const logoRef  = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/organiser/profile")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setForm({
          orgName:       data.orgName       ?? "",
          bio:           data.bio           ?? "",
          contactName:   data.contactName   ?? "",
          contactEmail:  data.contactEmail  ?? "",
          phone:         data.phone         ?? "",
          facebook:      data.facebook      ?? "",
          logoUrl:       data.logoUrl       ?? "",
          logoPosition:  data.logoPosition  ?? "50% 50%",
          coverImageUrl: data.coverImageUrl ?? "",
          coverPosition: data.coverPosition ?? "50% 50%",
        });
      })
      .catch(() => {})
      .finally(() => setLoadingForm(false));
  }, []);

  const patch = (p: Partial<ProfileForm>) => setForm(f => ({ ...f, ...p }));

  const uploadImage = async (file: File, type: "logo" | "cover") => {
    const fd = new FormData();
    fd.append("file", file); fd.append("type", type);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Upload failed.");
    const { fileUrl } = await res.json();
    return fileUrl as string;
  };

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const url = await uploadImage(file, "logo");
      const updated = { ...form, logoUrl: url };
      await fetch("/api/organiser/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
      patch({ logoUrl: url });
      router.refresh();
    } catch { setError("Logo upload failed."); }
    finally { setLogoUploading(false); }
  };

  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true);
    try {
      const url = await uploadImage(file, "cover");
      const updated = { ...form, coverImageUrl: url };
      await fetch("/api/organiser/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
      patch({ coverImageUrl: url });
      router.refresh();
    } catch { setError("Cover upload failed."); }
    finally { setCoverUploading(false); }
  };

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/organiser/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed."); return; }
      setSaved(true);
      notifyProfileSaved();
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } catch { setError("Something went wrong."); }
    finally { setSaving(false); }
  };

  const initial = (form.orgName || "O").charAt(0).toUpperCase();

  if (loadingForm) {
    return (
      <div className="space-y-6 py-2" role="status" aria-label="Loading profile">
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="flex gap-4">
          <Skeleton className="h-16 w-16 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Photos */}
      <div>
        <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4">Photos</div>
        <div className="mb-4">
          <FieldLabel label="Cover photo" hint="Recommended 1200×400" />
          <CoverEditor
            imageUrl={form.coverImageUrl} position={form.coverPosition}
            uploading={coverUploading} onUpload={handleCoverUpload}
            onPositionChange={pos => patch({ coverPosition: pos })}
            onRemove={() => patch({ coverImageUrl: "" })}
            onDone={handleSave}
            fileRef={coverRef}
          />
          <input ref={coverRef} type="file" accept="image/*" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); }} />
        </div>
        <div>
          <FieldLabel label="Profile photo" />
          <LogoEditor
            imageUrl={form.logoUrl} position={form.logoPosition} initial={initial}
            uploading={logoUploading} onUpload={handleLogoUpload}
            onPositionChange={pos => patch({ logoPosition: pos })} onDone={handleSave} fileRef={logoRef}
          />
          <input ref={logoRef} type="file" accept="image/*" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
        </div>
      </div>

      {/* Organisation */}
      <div>
        <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4">Organisation</div>
        <div className="space-y-4">
          <div>
            <FieldLabel label="Organisation name" required />
            <input className={inputCls} value={form.orgName} onChange={e => patch({ orgName: e.target.value })} placeholder="e.g. Endurance Events Australia" />
          </div>
          <div>
            <FieldLabel label="About" hint={`${form.bio.length}/600`} />
            <textarea
              className="w-full bg-dark-light border border-dark-lighter rounded-lg px-3 py-2.5 text-[13px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors resize-none"
              rows={4} maxLength={600} value={form.bio} onChange={e => patch({ bio: e.target.value })}
              placeholder="Tell athletes what you run and who you are…" />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div>
        <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4">Contact</div>
        <div className="space-y-4">
          <div>
            <FieldLabel label="Contact name" required />
            <input className={inputCls} value={form.contactName} onChange={e => patch({ contactName: e.target.value })} placeholder="Full name" />
          </div>
          <div>
            <FieldLabel label="Contact email" required />
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
              <input className={`${inputCls} pl-9`} type="email" value={form.contactEmail}
                onChange={e => patch({ contactEmail: e.target.value })} placeholder="events@yourorg.com.au" />
            </div>
          </div>
          <div>
            <FieldLabel label="Phone" />
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
              <input className={`${inputCls} pl-9`} type="tel" value={form.phone}
                onChange={e => patch({ phone: e.target.value })} placeholder="+61 4xx xxx xxx" />
            </div>
          </div>
        </div>
      </div>

      {/* Save footer */}
      {error && (
        <div className="mx-0 mb-3 px-4 py-3 rounded-lg bg-red-400/10 border border-red-400/20 text-red-300 font-headline text-[12px] leading-snug">
          {error}
        </div>
      )}
      <div className="pt-2 flex items-center justify-between gap-4 border-t border-dark-lighter">
        <div className="font-headline text-[11px] uppercase tracking-widest">
          {saved && <span className="text-primary flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Saved</span>}
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-gradient-to-br from-[rgb(194,236,119)] to-[rgb(179,225,83)] text-dark font-headline text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-lg shadow-machined hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform disabled:opacity-50">
          <CheckCircle className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ── Section content ──────────────────────────────────────────────────────────

function SectionContent({ section }: { section: SettingsSection }) {
  switch (section) {
    case "personal":
      return <PersonalInfoForm />;
    case "security":
      return (
        <div>
          <p className="text-[13px] text-muted leading-relaxed mb-6">
            Password changes are handled via your Cognito account. Use &ldquo;Forgot password&rdquo; on the sign-in page to reset.
          </p>
          <div className="border border-dark-lighter rounded-lg p-4">
            <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted-dark mb-1">Password</div>
            <div className="text-[13px] text-muted">Reset via the sign-in page using &ldquo;Forgot password&rdquo;.</div>
          </div>
        </div>
      );
    case "notifications":
      return (
        <div>
          <p className="text-[13px] text-muted leading-relaxed mb-6">
            You receive notifications when events are approved or rejected, and when new registrations come in.
          </p>
          <div className="space-y-1">
            {[
              { label: "Event approved",   desc: "When your event is approved by admin"      },
              { label: "Event rejected",   desc: "When your event is rejected with feedback" },
              { label: "New registration", desc: "When an athlete registers for your event"  },
            ].map(({ label, desc }) => (
              <div key={label} className="flex items-center justify-between py-3 border-b border-dark-lighter last:border-0">
                <div>
                  <div className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted-light">{label}</div>
                  <div className="text-[11px] text-muted-dark mt-0.5">{desc}</div>
                </div>
                <div className="w-8 h-4 bg-primary rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </div>
      );
    case "payments":
      return (
        <div>
          <p className="text-[13px] text-muted leading-relaxed mb-6">
            Manage your Stripe Express account for payouts, view payout history, and update banking details.
          </p>
          <Link href="/organiser/payments"
            className="inline-flex items-center gap-2 border border-primary/40 bg-primary/10 text-primary font-headline text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-md hover:bg-primary/20 transition-colors">
            Manage payments <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      );
    case "cookies":
      return (
        <div>
          <p className="text-[13px] text-muted leading-relaxed mb-6">
            Startline uses essential cookies to keep you signed in. No advertising or tracking cookies are used.
          </p>
          <div className="space-y-1">
            {[
              { label: "Essential cookies", desc: "Required for the platform to function",       enabled: true,  locked: true  },
              { label: "Analytics",         desc: "Help us understand how the platform is used", enabled: false, locked: false },
            ].map(({ label, desc, enabled, locked }) => (
              <div key={label} className="flex items-center justify-between py-3 border-b border-dark-lighter last:border-0">
                <div>
                  <div className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted-light">{label}</div>
                  <div className="text-[11px] text-muted-dark mt-0.5">{desc}</div>
                </div>
                <div className={`w-8 h-4 rounded-full shrink-0 ${enabled ? "bg-primary" : "bg-white/10"} ${locked ? "opacity-50 cursor-not-allowed" : ""}`} />
              </div>
            ))}
          </div>
        </div>
      );
  }
}

const SECTIONS: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
  { id: "personal",      label: "Personal information", icon: User       },
  { id: "security",      label: "Login & security",     icon: Lock       },
  { id: "notifications", label: "Notifications",        icon: Bell       },
  { id: "payments",      label: "Payments",             icon: CreditCard },
  { id: "cookies",       label: "Cookies",              icon: Cookie     },
];

// ── Modal ────────────────────────────────────────────────────────────────────

export default function SettingsModal() {
  const { isOpen, section, setSection, close } = useSettings();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  if (!isOpen) return null;

  const active = SECTIONS.find(s => s.id === section)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />

      <div className="relative w-full max-w-2xl bg-dark border border-dark-lighter rounded-2xl shadow-2xl flex overflow-hidden modal-in"
        style={{ height: "85vh" }}>

        {/* Close */}
        <button onClick={close}
          className="absolute top-4 right-4 z-10 w-7 h-7 flex items-center justify-center text-muted hover:text-light transition-colors"
          aria-label="Close settings">
          <X className="w-4 h-4" />
        </button>

        {/* Left sidebar */}
        <div className="w-52 shrink-0 border-r border-dark-lighter flex flex-col bg-dark-darker rounded-l-2xl">
          <div className="px-4 py-4 border-b border-dark-lighter">
            <div className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark">Settings</div>
          </div>
          <nav className="py-2 flex-1">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setSection(id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                  ${section === id
                    ? "bg-dark-light text-white border-r-2 border-r-primary"
                    : "text-muted hover:text-light hover:bg-white/5"}`}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="font-headline text-[11px] font-bold uppercase tracking-widest">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-dark">
          <div className="px-6 py-5 border-b border-dark-lighter shrink-0">
            <h2 className="font-headline text-[22px] font-black italic tracking-tight text-white">
              {active.label}
            </h2>
          </div>
          <div className="px-6 py-5">
            <SectionContent section={section} />
          </div>
        </div>

      </div>
    </div>
  );
}
