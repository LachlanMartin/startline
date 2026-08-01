"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Calendar, Check, X, AlertCircle, Trophy, Timer } from "lucide-react";
import { STATE_OPTIONS, STATE_LABELS } from "@/types";
import type { AustralianState } from "@/types";
import { formatDiscipline, formatLongDate } from "@/lib/utils";
import { useAuthContext } from "@/context/AuthContext";

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
  memberships: {
    organiser: { id: string; orgName: string | null; logoUrl: string | null; verified: boolean };
  }[];
};

type RaceHistory = {
  completed: number;
  statesRaced: number;
  disciplines: number;
  registrations: {
    id: string;
    finishTime: string | null;
    result: string | null;
    event: {
      id: string;
      title: string;
      discipline: string;
      eventDate: string;
      city: string;
      state: string;
      coverImageUrl: string | null;
      organiser: { id: string; orgName: string | null };
    };
  }[];
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
  const [history, setHistory] = useState<RaceHistory | null>(null);

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
        setHistory(data.history ?? null);
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
              <select
                value={editState}
                onChange={(e) => setEditState(e.target.value)}
                className="w-full bg-dark border border-dark-lighter rounded-xl px-4 py-2.5 text-[15px] text-light focus:border-primary focus:outline-none transition-colors"
              >
                <option value="">—</option>
                {STATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
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
                      {userData?.memberships?.[0] && (
                        <Link
                          href="/organiser/dashboard"
                          className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary hover:underline"
                        >
                          {userData.memberships[0].organiser.orgName ?? "Organiser Dashboard"}
                        </Link>
                      )}
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

              {/* KStats */}
              <div className="flex gap-3.5 flex-wrap mb-10">
                <KStat n={history?.completed ?? 0} l="Events Completed" />
                <KStat n={history?.statesRaced ?? 0} l="States Raced" />
                <KStat n={history?.disciplines ?? 0} l="Disciplines" />
              </div>

              {/* Race History */}
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="font-headline text-2xl font-black italic tracking-tighter text-light">
                  Race History
                </h3>
                <span className="font-headline text-[10.5px] font-bold uppercase tracking-widest text-muted-dark">
                  {history?.completed ?? 0} {history?.completed === 1 ? "event" : "events"}
                </span>
              </div>

              {profileLoading ? (
                <div className="space-y-4">
                  {[0, 1].map((i) => (
                    <div key={i} className="flex items-start gap-4 animate-pulse">
                      <div className="w-3 h-3 rounded-full bg-dark-lighter mt-1 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="w-40 h-3 bg-dark-lighter rounded" />
                        <div className="w-64 h-5 bg-dark-lighter rounded" />
                        <div className="w-48 h-3 bg-dark-lighter rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : history && history.registrations.length > 0 ? (
                <ol className="relative border-l-2 border-dark-lighter ml-2 space-y-6">
                  {history.registrations.map((reg) => (
                    <li key={reg.id} className="relative pl-6">
                      <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-dark-darker" />
                      <Link href={`/events/${reg.event.id}`} className="group block">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted">
                              {formatLongDate(reg.event.eventDate)}
                            </p>
                            <h4 className="font-headline text-lg font-black italic tracking-tighter text-light group-hover:text-primary transition-colors leading-tight mt-0.5">
                              {reg.event.title}
                            </h4>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                              <span className="flex items-center gap-1.5 font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
                                <Trophy className="w-3 h-3 text-primary" />
                                {formatDiscipline(reg.event.discipline)}
                              </span>
                              <span className="flex items-center gap-1.5 font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
                                <MapPin className="w-3 h-3 text-primary" />
                                {reg.event.city}, {STATE_LABELS[reg.event.state as AustralianState]}
                              </span>
                              {reg.event.organiser?.orgName && (
                                <span className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
                                  {reg.event.organiser.orgName}
                                </span>
                              )}
                            </div>
                          </div>
                          {(reg.finishTime || reg.result) && (
                            <div className="text-right flex-shrink-0">
                              {reg.result && (
                                <span className="block font-headline text-base font-black italic text-primary leading-none">
                                  {reg.result}
                                </span>
                              )}
                              {reg.finishTime && (
                                <span className="flex items-center justify-end gap-1 font-headline text-[11px] font-bold uppercase tracking-widest text-light mt-1">
                                  <Timer className="w-3 h-3 text-primary" />
                                  {reg.finishTime}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-3 border border-dashed border-dark-lighter rounded-2xl">
                  <p className="font-headline text-lg font-black italic tracking-tighter text-light">
                    No race history yet.
                  </p>
                  <p className="font-headline text-sm text-muted text-center max-w-xs leading-relaxed">
                    Completed events will appear here once you&apos;ve finished a race.
                  </p>
                  <Link
                    href="/events"
                    className="mt-2 font-headline text-[11px] font-bold uppercase tracking-widest text-primary hover:underline"
                  >
                    Find Events
                  </Link>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </main>
  );
}
