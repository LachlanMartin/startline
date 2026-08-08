"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AlertCircle, Check, CheckCircle, Move, Upload, X } from "lucide-react";
import { GENDER_OPTIONS, maxDateOfBirthForMinAge } from "@/lib/registration-form";

const inputCls =
  "w-full bg-dark-light border border-dark-lighter rounded-lg px-3 py-2.5 text-[14px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors";

type ProfileDraft = {
  name: string;
  username: string;
  bio: string;
  isPublic: boolean;
  city: string;
  state: string;
  profilePicUrl: string;
  coverImageUrl: string;
  coverPosition: string;
  mobile: string;
  dateOfBirth: string;
  gender: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

type Props = {
  open: boolean;
  initial: ProfileDraft & { currentUsername: string | null };
  onClose: () => void;
  onSaved: (data: ProfileDraft & { id?: string; email?: string; createdAt?: string }) => void;
};

function FieldLabel({ label, hint, htmlFor }: { label: string; hint?: string; htmlFor?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <label
        htmlFor={htmlFor}
        className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted"
      >
        {label}
      </label>
      {hint && (
        <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">{hint}</span>
      )}
    </div>
  );
}

function CoverEditor({
  imageUrl,
  position,
  uploading,
  onUpload,
  onPositionChange,
  onRemove,
  fileRef,
}: {
  imageUrl: string;
  position: string;
  uploading: boolean;
  onUpload: (f: File) => void;
  onPositionChange: (p: string) => void;
  onRemove: () => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [reposition, setReposition] = useState(false);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const parsePos = (pos: string) => {
    const [x, y] = pos.split(" ").map((v) => parseFloat(v));
    return { x: Number.isNaN(x) ? 50 : x, y: Number.isNaN(y) ? 50 : y };
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
    const dx = ((e.clientX - dragStart.current.x) / rect.width) * -100;
    const dy = ((e.clientY - dragStart.current.y) / rect.height) * -100;
    const newX = Math.min(100, Math.max(0, dragStart.current.px + dx));
    const newY = Math.min(100, Math.max(0, dragStart.current.py + dy));
    onPositionChange(`${newX.toFixed(1)}% ${newY.toFixed(1)}%`);
  };
  const onMouseUp = () => setDragging(false);

  if (!imageUrl) {
    return (
      <button
        type="button"
        className="relative h-28 w-full rounded-xl overflow-hidden bg-dark-light border border-dark-lighter"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, #b3e153 0%, transparent 50%), radial-gradient(circle at 80% 20%, #86efac 0%, transparent 40%)",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-dark/80 rounded-lg px-3 py-2 flex items-center gap-2 font-headline text-[11px] font-bold uppercase tracking-widest text-muted-light border border-dark-lighter">
            {uploading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" /> Upload cover
              </>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div>
      <div
        ref={containerRef}
        className={`relative h-28 rounded-xl overflow-hidden border border-dark-lighter select-none ${
          reposition ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        }`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <Image
          src={imageUrl}
          alt="Cover"
          fill
          className="object-cover pointer-events-none brightness-[.62] saturate-110"
          style={{ objectPosition: position }}
          draggable={false}
          sizes="(max-width: 768px) 100vw, 448px"
        />
        {reposition && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-1.5 bg-black/60 text-white rounded-lg px-3 py-1.5 font-headline text-[11px] font-bold uppercase tracking-wider">
              <Move className="w-3.5 h-3.5" /> Drag to reposition
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {reposition ? (
          <button
            type="button"
            onClick={() => setReposition(false)}
            className="font-headline text-[11px] font-bold uppercase tracking-widest bg-primary text-dark px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setReposition(true)}
            className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light flex items-center gap-1 transition-colors"
          >
            <Move className="w-3 h-3" /> Reposition
          </button>
        )}
        <span className="text-white/20 text-xs">·</span>
        <button
          type="button"
          onClick={() => {
            setReposition(false);
            fileRef.current?.click();
          }}
          disabled={uploading}
          className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light flex items-center gap-1 transition-colors disabled:opacity-40"
        >
          <Upload className="w-3 h-3" /> {uploading ? "Uploading…" : "Change"}
        </button>
        <span className="text-white/20 text-xs">·</span>
        <button
          type="button"
          onClick={() => {
            setReposition(false);
            onRemove();
          }}
          className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-red-400 transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function AvatarEditor({
  imageUrl,
  initial,
  uploading,
  onUpload,
  onRemove,
  fileRef,
}: {
  imageUrl: string;
  initial: string;
  uploading: boolean;
  onUpload: (f: File) => void;
  onRemove: () => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-dark-lighter bg-dark shrink-0">
        {imageUrl ? (
          <Image src={imageUrl} alt="Profile" fill className="object-cover" sizes="80px" />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-headline text-2xl font-black italic text-primary">
            {initial}
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" /> {uploading ? "Uploading…" : imageUrl ? "Change photo" : "Upload photo"}
          </button>
          {imageUrl && (
            <>
              <span className="text-white/20 text-xs">·</span>
              <button
                type="button"
                onClick={onRemove}
                className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </>
          )}
        </div>
        <p className="text-[11px] text-muted-dark mt-1">PNG or JPG, square recommended.</p>
      </div>
    </div>
  );
}

export default function UserEditProfileModal({ open, initial, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ProfileDraft>({
    name: initial.name,
    username: initial.username,
    bio: initial.bio,
    isPublic: initial.isPublic,
    city: initial.city,
    state: initial.state,
    profilePicUrl: initial.profilePicUrl,
    coverImageUrl: initial.coverImageUrl,
    coverPosition: initial.coverPosition,
    mobile: initial.mobile,
    dateOfBirth: initial.dateOfBirth,
    gender: initial.gender,
    emergencyContactName: initial.emergencyContactName,
    emergencyContactPhone: initial.emergencyContactPhone,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [usernameError, setUsernameError] = useState("");
  const coverRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: initial.name,
      username: initial.username,
      bio: initial.bio,
      isPublic: initial.isPublic,
      city: initial.city,
      state: initial.state,
      profilePicUrl: initial.profilePicUrl,
      coverImageUrl: initial.coverImageUrl,
      coverPosition: initial.coverPosition || "50% 50%",
      mobile: initial.mobile,
      dateOfBirth: initial.dateOfBirth,
      gender: initial.gender,
      emergencyContactName: initial.emergencyContactName,
      emergencyContactPhone: initial.emergencyContactPhone,
    });
    setError("");
    setSaved(false);
    setUsernameStatus("idle");
    setUsernameError("");
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const usernameValidation = useMemo(() => {
    const val = form.username.trim().toLowerCase();
    if (!val || val === (initial.currentUsername ?? "")) return { status: "idle" as const, error: "" };
    if (val.length < 3) return { status: "invalid" as const, error: "Username must be at least 3 characters." };
    if (val.length > 30) return { status: "invalid" as const, error: "Username must be 30 characters or less." };
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(val)) {
      return { status: "invalid" as const, error: "Only lowercase letters, numbers, and hyphens allowed." };
    }
    return null;
  }, [form.username, initial.currentUsername]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    if (usernameValidation) {
      setUsernameStatus(usernameValidation.status);
      setUsernameError(usernameValidation.error);
      return;
    }
    setUsernameStatus("checking");
    if (checkTimer.current) clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/user/profile/check-username?username=${encodeURIComponent(form.username.trim().toLowerCase())}`
        );
        const data = await res.json();
        if (data.available) {
          setUsernameStatus("valid");
          setUsernameError("");
        } else {
          setUsernameStatus("invalid");
          setUsernameError(data.error || "This username is already taken.");
        }
      } catch {
        setUsernameStatus("idle");
        setUsernameError("");
      }
    }, 400);
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [open, usernameValidation, form.username]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const patch = (p: Partial<ProfileDraft>) => setForm((f) => ({ ...f, ...p }));

  const uploadImage = async (file: File, type: "cover" | "avatar") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Upload failed.");
    }
    const { fileUrl } = await res.json();
    return fileUrl as string;
  };

  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true);
    setError("");
    try {
      const url = await uploadImage(file, "cover");
      patch({ coverImageUrl: url, coverPosition: "50% 50%" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cover upload failed.");
    } finally {
      setCoverUploading(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    setAvatarUploading(true);
    setError("");
    try {
      const url = await uploadImage(file, "avatar");
      patch({ profilePicUrl: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    if (usernameStatus === "invalid" || usernameStatus === "checking") return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          username: form.username || null,
          bio: form.bio,
          isPublic: form.isPublic,
          city: form.city || null,
          state: form.state || null,
          profilePicUrl: form.profilePicUrl || null,
          coverImageUrl: form.coverImageUrl || null,
          coverPosition: form.coverPosition || "50% 50%",
          mobile: form.mobile || null,
          dateOfBirth: form.dateOfBirth || null,
          gender: form.gender || null,
          emergencyContactName: form.emergencyContactName || null,
          emergencyContactPhone: form.emergencyContactPhone || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save profile.");
        return;
      }
      setSaved(true);
      onSaved({
        name: data.name ?? form.name,
        username: data.username ?? form.username,
        bio: data.bio ?? form.bio,
        isPublic: data.isPublic ?? form.isPublic,
        city: data.city ?? form.city,
        state: data.state ?? form.state,
        profilePicUrl: data.profilePicUrl ?? form.profilePicUrl,
        coverImageUrl: data.coverImageUrl ?? form.coverImageUrl,
        coverPosition: data.coverPosition ?? form.coverPosition,
        mobile: data.mobile ?? form.mobile,
        dateOfBirth: data.dateOfBirth ?? form.dateOfBirth,
        gender: data.gender ?? form.gender,
        emergencyContactName: data.emergencyContactName ?? form.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone ?? form.emergencyContactPhone,
        id: data.id,
        email: data.email,
        createdAt: data.createdAt,
      });
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 600);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const initialLetter = (form.username || form.name || "A").charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <button
        type="button"
        aria-label="Close edit profile"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="relative z-10 w-full sm:max-w-[560px] max-h-[92vh] bg-dark border border-dark-lighter rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-lighter shrink-0">
          <h2
            id="edit-profile-title"
            className="font-headline text-sm font-bold uppercase tracking-widest text-primary"
          >
            Edit Profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-muted hover:text-light hover:bg-dark-light transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 space-y-6">
          <div>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4">
              Photos
            </div>
            <div className="space-y-4">
              <div>
                <FieldLabel label="Cover photo" hint="Recommended 1200×400" />
                <CoverEditor
                  imageUrl={form.coverImageUrl}
                  position={form.coverPosition}
                  uploading={coverUploading}
                  onUpload={handleCoverUpload}
                  onPositionChange={(pos) => patch({ coverPosition: pos })}
                  onRemove={() => patch({ coverImageUrl: "", coverPosition: "50% 50%" })}
                  fileRef={coverRef}
                />
                <input
                  ref={coverRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCoverUpload(file);
                    e.target.value = "";
                  }}
                />
              </div>
              <div>
                <FieldLabel label="Profile photo" />
                <AvatarEditor
                  imageUrl={form.profilePicUrl}
                  initial={initialLetter}
                  uploading={avatarUploading}
                  onUpload={handleAvatarUpload}
                  onRemove={() => patch({ profilePicUrl: "" })}
                  fileRef={avatarRef}
                />
                <input
                  ref={avatarRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(file);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4">
              Public profile
            </div>
            <div className="space-y-4">
              <div>
                <FieldLabel label="Username" hint="Shown on your profile" />
                <div className="relative">
                  <input
                    className={`${inputCls} pr-10 ${
                      usernameStatus === "invalid"
                        ? "border-red-500/50 focus:border-red-500"
                        : usernameStatus === "valid"
                          ? "border-green-500/50 focus:border-green-500"
                          : ""
                    }`}
                    value={form.username}
                    onChange={(e) => patch({ username: e.target.value.toLowerCase() })}
                    placeholder="e.g. johndoe"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameStatus === "checking" && (
                      <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin block" />
                    )}
                    {usernameStatus === "valid" && <Check className="w-4 h-4 text-green-500" />}
                    {usernameStatus === "invalid" && <X className="w-4 h-4 text-red-500" />}
                  </span>
                </div>
                {usernameError ? (
                  <p className="flex items-center gap-1 font-headline text-[10px] uppercase tracking-widest text-red-400 mt-1">
                    <AlertCircle className="w-3 h-3" /> {usernameError}
                  </p>
                ) : (
                  <p className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-1">
                    Your public identity — letters, numbers, and hyphens.
                  </p>
                )}
              </div>
              <div>
                <FieldLabel label="Bio" hint={`${form.bio.length}/300`} />
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={3}
                  maxLength={300}
                  value={form.bio}
                  onChange={(e) => patch({ bio: e.target.value })}
                  placeholder="A short line about you as an athlete…"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4">
              Private details
            </div>
            <p className="text-[12px] text-muted-dark leading-relaxed mb-4">
              Not shown on your public profile. Used only to prefill your own event
              registrations — organisers receive these details when you register.
            </p>
            <div className="space-y-4">
              <div>
                <FieldLabel label="Full name" htmlFor="edit-profile-name" />
                <input
                  id="edit-profile-name"
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Your legal name"
                  autoComplete="name"
                />
              </div>
              <div>
                <FieldLabel label="Phone" htmlFor="edit-profile-mobile" />
                <input
                  id="edit-profile-mobile"
                  className={inputCls}
                  type="tel"
                  value={form.mobile}
                  onChange={(e) => patch({ mobile: e.target.value })}
                  placeholder="e.g. 0412 345 678"
                  autoComplete="tel"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel label="Date of birth" htmlFor="edit-profile-dob" />
                  <input
                    id="edit-profile-dob"
                    className={inputCls}
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => patch({ dateOfBirth: e.target.value })}
                    max={maxDateOfBirthForMinAge(13)}
                    autoComplete="bday"
                  />
                </div>
                <div>
                  <FieldLabel label="Gender" hint="Optional" htmlFor="edit-profile-gender" />
                  <select
                    id="edit-profile-gender"
                    className={inputCls}
                    value={form.gender}
                    onChange={(e) => patch({ gender: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel label="Emergency contact name" htmlFor="edit-profile-ec-name" />
                  <input
                    id="edit-profile-ec-name"
                    className={inputCls}
                    value={form.emergencyContactName}
                    onChange={(e) => patch({ emergencyContactName: e.target.value })}
                    placeholder="Full name"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <FieldLabel label="Emergency contact phone" htmlFor="edit-profile-ec-phone" />
                  <input
                    id="edit-profile-ec-phone"
                    className={inputCls}
                    type="tel"
                    value={form.emergencyContactPhone}
                    onChange={(e) => patch({ emergencyContactPhone: e.target.value })}
                    placeholder="e.g. 0412 000 111"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4">
              Visibility
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={form.isPublic}
                onClick={() => patch({ isPublic: !form.isPublic })}
                className={`w-10 h-6 rounded-full transition-colors relative ${
                  form.isPublic ? "bg-primary" : "bg-dark-lighter"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-dark absolute top-1 transition-transform ${
                    form.isPublic ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="font-headline text-[12px] uppercase tracking-widest text-muted">
                {form.isPublic ? "Public profile" : "Private profile"}
              </span>
            </label>
            <p className="text-[12px] text-muted-dark mt-2 leading-relaxed">
              When public, other athletes can view your profile at /profile/your-username.
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-400/10 border border-red-400/20 text-red-300 font-headline text-[12px] leading-snug">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-dark-lighter shrink-0">
          <div className="font-headline text-[11px] uppercase tracking-widest min-h-[16px]">
            {saved && (
              <span className="text-primary flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light px-4 py-2.5 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || usernameStatus === "invalid" || usernameStatus === "checking"}
              className="bg-machined shadow-machined text-dark font-headline text-[11px] font-bold uppercase tracking-widest py-2.5 px-5 rounded-md flex items-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-all disabled:opacity-50"
            >
              {saving ? "Saving…" : (<><Check className="w-4 h-4" /> Save</>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
