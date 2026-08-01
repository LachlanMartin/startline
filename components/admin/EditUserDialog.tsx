"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { validateUsername } from "@/lib/username-validation";
import { STATE_OPTIONS } from "@/types";

const inputCls = "w-full bg-dark-light border border-dark-lighter rounded-md px-3 py-2.5 font-headline text-[14px] text-light placeholder:text-muted focus:border-primary focus:outline-none transition-colors";

interface UserData {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  profilePicUrl: string | null;
  isPublic: boolean;
  city: string | null;
  state: string | null;
}

export default function EditUserDialog({
  userId,
  open,
  onClose,
  onSaved,
}: {
  userId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [usernameError, setUsernameError] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (!res.ok) {
        setForm(null);
        return;
      }
      const data = await res.json();
      setForm({
        id: data.id,
        email: data.email,
        name: data.name ?? "",
        username: data.username ?? "",
        bio: data.bio ?? "",
        profilePicUrl: data.profilePicUrl ?? "",
        isPublic: data.isPublic,
        city: data.city ?? "",
        state: data.state ?? "",
      });
      setUsernameError("");
    } catch {
      setForm(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open && userId) startTransition(() => load());
  }, [open, userId, load]);

  const set = (patch: Partial<UserData>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const handleUsernameChange = (value: string) => {
    set({ username: value });
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) { setUsernameError(""); return; }
    const v = validateUsername(trimmed);
    setUsernameError(v.valid ? "" : v.reason);
  };

  const handleSave = async () => {
    if (!form) return;
    if (form.username?.trim() && usernameError) return;

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          username: form.username,
          bio: form.bio,
          profilePicUrl: form.profilePicUrl,
          isPublic: form.isPublic,
          city: form.city,
          state: form.state,
          email: form.email,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? "Failed to save changes.");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            Update the user&apos;s profile. Email changes also update their login account.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-10 text-center">
            <div className="w-5 h-5 border-2 border-dark-lighter border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <div className="font-headline text-sm text-muted uppercase tracking-widest">Loading…</div>
          </div>
        )}

        {!loading && !form && (
          <div className="py-8 text-center font-headline text-sm text-muted">User not found.</div>
        )}

        {!loading && form && (
          <div className="space-y-4">
            <div>
              <label className="font-headline text-[10px] font-bold uppercase tracking-widest text-light/70 block mb-1.5">
                Email
              </label>
              <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })}
                placeholder="user@example.com" className={inputCls} />
            </div>

            <div>
              <label className="font-headline text-[10px] font-bold uppercase tracking-widest text-light/70 block mb-1.5">
                Full name
              </label>
              <input value={form.name ?? ""} onChange={(e) => set({ name: e.target.value })}
                placeholder="Full name" className={inputCls} />
            </div>

            <div>
              <label className="font-headline text-[10px] font-bold uppercase tracking-widest text-light/70 block mb-1.5">
                Username
              </label>
              <input value={form.username ?? ""} onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="username" className={inputCls} />
              {usernameError && (
                <p className="font-headline text-[11px] uppercase tracking-widest text-red-400 mt-1.5">{usernameError}</p>
              )}
            </div>

            <div>
              <label className="font-headline text-[10px] font-bold uppercase tracking-widest text-light/70 block mb-1.5">
                Bio
              </label>
              <textarea rows={3} value={form.bio ?? ""} onChange={(e) => set({ bio: e.target.value })}
                placeholder="Short bio" className={`${inputCls} resize-none`} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-headline text-[10px] font-bold uppercase tracking-widest text-light/70 block mb-1.5">
                  City
                </label>
                <input value={form.city ?? ""} onChange={(e) => set({ city: e.target.value })}
                  placeholder="e.g. Melbourne" className={inputCls} />
              </div>
              <div>
                <label className="font-headline text-[10px] font-bold uppercase tracking-widest text-light/70 block mb-1.5">
                  State
                </label>
                <select value={form.state ?? ""} onChange={(e) => set({ state: e.target.value })}
                  className={`${inputCls} ${form.state ? "text-light" : "text-muted-dark"}`}>
                  <option value="" className="bg-dark text-muted-dark">None</option>
                  {STATE_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value} className="bg-dark text-light">{s.shortLabel}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={form.isPublic}
                onChange={(e) => set({ isPublic: e.target.checked })}
                className="accent-primary w-4 h-4 cursor-pointer" />
              <span className="font-headline text-[13px] text-muted">
                Public profile — visible to other users
              </span>
            </label>

            {error && (
              <div className="px-4 py-3 rounded-md bg-red-400/10 border border-red-400/20 text-red-300 font-headline text-[13px]">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <button className="font-headline text-[12px] font-bold uppercase tracking-widest border border-dark-lighter text-muted hover:text-light px-4 py-2.5 rounded-md transition-colors">
              Cancel
            </button>
          </DialogClose>
          <button
            onClick={handleSave}
            disabled={saving || loading || !form || (!!form.username?.trim() && !!usernameError)}
            className="flex items-center gap-2 font-headline text-[12px] font-bold uppercase tracking-widest bg-machined shadow-machined text-dark px-5 py-2.5 rounded-md hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving
              ? <><span className="w-3 h-3 border border-dark/40 border-t-dark rounded-full animate-spin" /> Saving…</>
              : "Save changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
