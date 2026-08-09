"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Calendar, Check, X, AlertCircle } from "lucide-react";
import { STATE_OPTIONS, STATE_LABELS } from "@/types";
import type { AustralianState } from "@/types";
import { formatDiscipline, formatMediumDate } from "@/lib/utils";
import { useAuthContext } from "@/context/AuthContext";
import SelectMenu from "@/components/ui/SelectMenu";

type RaceRegistration = {
  id: string;
  eventId: string;
  category: string | null;
  resultDistance: string | null;
  resultTime: string | null;
  resultPlacement: string | null;
  isPersonalBest: boolean;
  isTopResult: boolean;
  event: { title: string; discipline: string; eventDate: string; city: string; state: string };
};

type UserData = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  profilePicUrl: string | null;
  isPublic: boolean;
  city: string | null;
  state: string | null;
  registrations?: RaceRegistration[];
};

function KStat({ n, l }: { n: number; l: string }) {
  return (
    <div
      className="flex-1 min-w-[100px] bg-dark border border-dark-lighter border-t-2 border-t-primary rounded-xl"
      style={{ padding: "16px 18px" }}
    >
      <p className="font-headline text-[9.5px] font-bold uppercase tracking-widest text-muted">{l}</p>
      <p className="font-headline text-[30px] font-black italic tracking-tighter text-light leading-none mt-2">
        {n}
      </p>
    </div>
  );
}

export default function ProfilePage() {
  const { user, status } = useAuthContext();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [usernameError, setUsernameError] = useState("");
  const checkTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const usernameValidation = useMemo(() => {
    const val = editUsername.trim().toLowerCase();
    if (!val || val === userData?.username) return { status: "idle" as const, error: "" };
    if (val.length < 3) return { status: "invalid" as const, error: "Username must be at least 3 characters." };
    if (val.length > 30) return { status: "invalid" as const, error: "Username must be 30 characters or less." };
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(val)) return { status: "invalid" as const, error: "Only lowercase letters, numbers, and hyphens allowed." };
    return null;
  }, [editUsername, userData?.username]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (usernameValidation) { setUsernameStatus(usernameValidation.status); setUsernameError(usernameValidation.error); return; }
    setUsernameStatus("checking");
    if (checkTimer.current) clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/user/profile/check-username?username=${encodeURIComponent(editUsername.trim().toLowerCase())}`);
        const data = await res.json();
        if (data.available) { setUsernameStatus("valid"); setUsernameError(""); }
        else { setUsernameStatus("invalid"); setUsernameError(data.error || "This username is already taken."); }
      } catch { setUsernameStatus("idle"); setUsernameError(""); }
    }, 400);
    return () => { if (checkTimer.current) clearTimeout(checkTimer.current); };
  }, [usernameValidation, editUsername, userData?.username]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (status !== "authenticated") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfileLoading(false);
      return;
    }
    fetch("/api/user/profile")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setUserData(data);
        setEditName(data.name ?? "");
        setEditUsername(data.username ?? "");
        setEditBio(data.bio ?? "");
        setEditIsPublic(data.isPublic);
        setEditCity(data.city ?? "");
        setEditState(data.state ?? "");
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [status]);

  const handleSaveProfile = async () => {
    setEditSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          username: editUsername || null,
          bio: editBio,
          isPublic: editIsPublic,
          city: editCity || null,
          state: editState || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setUserData((prev) => prev ? { ...prev, ...data } : prev);
        setEditing(false);
      }
    } catch {
      // silent
    } finally {
      setEditSaving(false);
    }
  };

  const initial = userData?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "A";
  const locationStr = [userData?.city, userData?.state ? STATE_LABELS[userData.state as AustralianState] : null]
    .filter(Boolean)
    .join(", ");

  if (status !== "authenticated") {
    return (
      <main className="min-h-screen bg-dark-darker pt-20">
        <section className="max-w-[1440px] mx-auto px-6 py-24 text-center">
          <h1 className="font-headline text-3xl font-black italic tracking-tighter text-light mb-4">
            Sign in to see your profile
          </h1>
          <p className="font-headline text-sm text-muted mb-8">
            Save events, track registrations, and manage your account.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-dark-darker">
      <div className="max-w-[1200px] mx-auto px-6 pt-20 pb-16">

        {/* Edit form — full-width, replaces main content when open */}
        {editing && (
          <div className="max-w-[640px] mx-auto space-y-5 py-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
                Edit Profile
              </h2>
              <button
                onClick={() => setEditing(false)}
                className="font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary transition-colors"
              >
                Cancel
              </button>
            </div>

            <div>
              <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1.5">
                Full name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-dark border border-dark-lighter rounded-xl px-4 py-2.5 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1.5">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="e.g. johndoe"
                  className={`w-full bg-dark border rounded-xl px-4 py-2.5 pr-10 text-[15px] text-light placeholder:text-muted-dark focus:outline-none transition-colors ${
                    usernameStatus === "invalid"
                      ? "border-red-500/50 focus:border-red-500"
                      : usernameStatus === "valid"
                      ? "border-green-500/50 focus:border-green-500"
                      : "border-dark-lighter focus:border-primary"
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === "checking" && (
                    <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin block" />
                  )}
                  {usernameStatus === "valid" && <Check className="w-4 h-4 text-green-500" />}
                  {usernameStatus === "invalid" && <X className="w-4 h-4 text-red-500" />}
                </span>
              </div>
              {usernameError && (
                <p className="flex items-center gap-1 font-headline text-[10px] uppercase tracking-widest text-red-400 mt-1">
                  <AlertCircle className="w-3 h-3" /> {usernameError}
                </p>
              )}
              {usernameStatus === "idle" && !usernameError && (
                <p className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-1">
                  3–30 characters, lowercase letters, numbers, and hyphens only.
                </p>
              )}
            </div>

            <div>
              <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1.5">
                Bio
              </label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows={3}
                className="w-full bg-dark border border-dark-lighter rounded-xl px-4 py-2.5 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors resize-none"
              />
            </div>

            <div>
              <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1.5">
                City
              </label>
              <input
                type="text"
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                placeholder="e.g. Melbourne"
                className="w-full bg-dark border border-dark-lighter rounded-xl px-4 py-2.5 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1.5">
                State
              </label>
              <SelectMenu
                value={editState}
                onChange={setEditState}
                placeholder="Select state…"
                ariaLabel="State"
                options={STATE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <button
                onClick={() => setEditIsPublic(!editIsPublic)}
                className={`w-10 h-6 rounded-full transition-colors relative ${editIsPublic ? "bg-primary" : "bg-dark-lighter"}`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-dark absolute top-1 transition-transform ${editIsPublic ? "translate-x-5" : "translate-x-1"}`}
                />
              </button>
              <span className="font-headline text-[12px] uppercase tracking-widest text-muted">
                {editIsPublic ? "Public profile" : "Private profile"}
              </span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSaveProfile}
                disabled={editSaving || usernameStatus === "invalid" || usernameStatus === "checking"}
                className="bg-machined shadow-machined text-dark font-headline text-[11px] font-bold uppercase tracking-widest py-2.5 px-6 rounded-xl flex items-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-all disabled:opacity-50"
              >
                {editSaving ? "Saving…" : <><Check className="w-4 h-4" /> Save</>}
              </button>
            </div>

            <div className="pt-4 border-t border-dark-lighter">
              <label className="font-headline text-[10px] uppercase tracking-widest text-muted-dark block mb-1">
                User ID
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-[12px] text-muted bg-dark px-3 py-2 rounded-xl truncate">
                  {userData?.id ?? ""}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(userData?.id ?? "")}
                  className="font-headline text-[10px] uppercase tracking-widest text-primary hover:underline flex-shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Single-column layout */}
        {!editing && (
          <div>

            {/* Profile header — horizontal banner */}
            <div className="bg-dark border border-dark-lighter rounded-2xl p-6 flex items-center gap-6 mb-8 flex-wrap">
              {profileLoading ? (
                <div className="flex items-center gap-6 w-full">
                  <div className="w-20 h-20 rounded-full bg-dark-lighter animate-pulse flex-shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="w-48 h-5 bg-dark-lighter rounded animate-pulse" />
                    <div className="w-32 h-3 bg-dark-lighter rounded animate-pulse" />
                  </div>
                </div>
              ) : (
                <>
                  {/* Avatar */}
                    <div
                      className="relative w-20 h-20 rounded-full bg-primary border-2 border-primary flex items-center justify-center overflow-hidden flex-shrink-0"
                      style={{ boxShadow: "3px 3px 0 rgba(179, 225, 83, 0.25)" }}
                    >
                      {userData?.profilePicUrl ? (
                        <Image
                          src={userData.profilePicUrl}
                          alt={userData?.name ?? "Profile"}
                          fill
                          className="pointer-events-none object-cover"
                          sizes="80px"
                        />
                    ) : (
                      <span className="font-headline text-3xl font-black text-dark">{initial}</span>
                    )}
                  </div>

                  {/* Name + handle + bio + meta */}
                  <div className="flex-1 min-w-0">
                    <h1 className="font-headline text-2xl font-black italic tracking-tighter text-light leading-none">
                      {userData?.name ?? user?.email}
                    </h1>
                    {userData?.username && (
                      <p className="font-headline text-[10.5px] font-bold uppercase tracking-widest text-muted mt-1.5">
                        @{userData.username}
                      </p>
                    )}
                    {userData?.bio && (
                      <p className="font-headline text-sm text-muted leading-relaxed mt-2 max-w-xl">
                        {userData.bio}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 mt-3">
                      {locationStr && (
                        <div className="flex items-center gap-1.5 font-headline text-[11px] font-medium uppercase tracking-widest text-muted">
                          <MapPin className="w-[13px] h-[13px] text-primary flex-shrink-0" />
                          {locationStr}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 font-headline text-[11px] font-medium uppercase tracking-widest text-muted">
                        <Calendar className="w-[13px] h-[13px] text-primary flex-shrink-0" />
                        Member since Startline
                      </div>
                    </div>
                  </div>

                  {/* Edit button */}
                  <button
                    onClick={() => setEditing(true)}
                    className="h-10 px-5 rounded-xl bg-transparent border border-dark-lighter font-headline text-[12px] font-bold uppercase tracking-[0.12em] text-muted hover:border-primary hover:text-primary transition-colors flex-shrink-0"
                  >
                    Edit Profile
                  </button>
                </>
              )}
            </div>

            {/* Stats + history */}
            <div>
              {(() => {
                const withResults = (userData?.registrations ?? []).filter(
                  (r) => r.resultTime || r.resultPlacement,
                );
                const statesRaced = new Set(
                  withResults.map((r) => r.event.state).filter(Boolean),
                ).size;
                const disciplines = new Set(
                  withResults.map((r) => r.event.discipline).filter(Boolean),
                ).size;

                return (
                  <>
                    <div className="flex gap-3.5 flex-wrap mb-10">
                      <KStat n={withResults.length} l="Events Completed" />
                      <KStat n={statesRaced} l="States Raced" />
                      <KStat n={disciplines} l="Disciplines" />
                    </div>

                    <div className="flex items-baseline justify-between mb-4">
                      <h3 className="font-headline text-2xl font-black italic tracking-tighter text-light">
                        Race History
                      </h3>
                      <span className="font-headline text-[10.5px] font-bold uppercase tracking-widest text-muted-dark">
                        {withResults.length} {withResults.length === 1 ? "event" : "events"}
                      </span>
                    </div>

                    {withResults.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 border border-dashed border-dark-lighter rounded-2xl">
                        <p className="font-headline text-lg font-black italic tracking-tighter text-light">
                          No race history yet.
                        </p>
                        <p className="font-headline text-sm text-muted text-center max-w-xs leading-relaxed">
                          Completed events will appear here once race results are available.
                        </p>
                        <Link
                          href="/events"
                          className="mt-2 font-headline text-[11px] font-bold uppercase tracking-widest text-primary hover:underline"
                        >
                          Find Events
                        </Link>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-dark-lighter rounded-xl bg-dark">
                        <table className="w-full min-w-[640px] border-collapse">
                          <thead>
                            <tr className="border-b border-dark-lighter">
                              {["Event", "Discipline", "Date", "Division", "Time", "Place"].map((h) => (
                                <th
                                  key={h}
                                  className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark text-left px-3.5 py-3"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {withResults.map((reg) => (
                              <tr key={reg.id} className="border-b border-dark-lighter last:border-0">
                                <td className="py-4 px-3.5">
                                  <Link
                                    href={`/events/${reg.eventId}`}
                                    className="font-headline text-[14px] font-bold italic tracking-tighter text-light hover:text-primary transition-colors"
                                  >
                                    {reg.event.title}
                                  </Link>
                                </td>
                                <td className="py-4 px-3.5">
                                  <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5">
                                    {formatDiscipline(reg.event.discipline)}
                                  </span>
                                </td>
                                <td className="py-4 px-3.5 font-headline text-[12px] text-muted whitespace-nowrap">
                                  {formatMediumDate(reg.event.eventDate)}
                                </td>
                                <td className="py-4 px-3.5 font-headline text-[13px] text-muted-light whitespace-nowrap">
                                  {reg.category?.trim() || reg.resultDistance || "—"}
                                </td>
                                <td className="py-4 px-3.5 font-headline text-[13px] font-bold text-light whitespace-nowrap">
                                  {reg.resultTime ?? "—"}
                                  {reg.isPersonalBest && (
                                    <span className="ml-1.5 font-black text-primary text-[10px] uppercase tracking-widest">PB</span>
                                  )}
                                </td>
                                <td className={`py-4 px-3.5 font-headline font-bold text-[13px] whitespace-nowrap ${reg.isTopResult ? "text-primary" : "text-muted"}`}>
                                  {reg.resultPlacement ?? "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

          </div>
        )}
      </div>
    </main>
  );
}
