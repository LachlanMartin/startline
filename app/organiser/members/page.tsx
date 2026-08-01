"use client";

import { useCallback, useEffect, useState, startTransition } from "react";
import Link from "next/link";
import {
  Building2, Crown, UserCog, Mail, Plus, Trash2, RefreshCw, ArrowLeft, X,
} from "lucide-react";

interface Member {
  id: string;
  role: "OWNER" | "MANAGER";
  createdAt: string;
  user: { id: string; name: string | null; email: string };
}

export default function MembersPage() {
  const [members,       setMembers]       = useState<Member[] | null>(null);
  const [role,          setRole]          = useState<"OWNER" | "MANAGER" | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [addEmail,      setAddEmail]      = useState("");
  const [adding,        setAdding]        = useState(false);
  const [addMsg,        setAddMsg]        = useState("");
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [transferTo,    setTransferTo]    = useState<Member | null>(null);
  const [busy,          setBusy]          = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/organiser/members");
      if (!r.ok) {
        setError("You do not have access to members.");
        setMembers([]);
        return;
      }
      const data = await r.json();
      startTransition(() => {
        setMembers(data.members ?? []);
        setRole(data.role ?? null);
      });
    } catch {
      setError("Could not load members.");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startTransition(() => fetchMembers());
  }, [fetchMembers]);

  const isOwner = role === "OWNER";

  const handleAdd = async () => {
    const email = addEmail.trim();
    if (!email) return;
    setAdding(true);
    setAddMsg("");
    try {
      const r = await fetch("/api/organiser/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await r.json();
      if (!r.ok) {
        setAddMsg(data.error ?? "Could not add member.");
      } else {
        setAddMsg("");
        setAddEmail("");
        startTransition(() => fetchMembers());
      }
    } catch {
      setAddMsg("Could not add member.");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (member: Member) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/organiser/members/${member.id}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Could not remove member.");
      } else {
        setError("");
        setConfirmRemove(null);
        startTransition(() => fetchMembers());
      }
    } catch {
      setError("Could not remove member.");
    } finally {
      setBusy(false);
    }
  };

  const handleTransfer = async (member: Member) => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/organiser/members/${member.id}/transfer-ownership`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Could not transfer ownership.");
      } else {
        setTransferTo(null);
        startTransition(() => fetchMembers());
      }
    } catch {
      setError("Could not transfer ownership.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10">
      <Link href="/organiser/dashboard" className="inline-flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
      </Link>

      <div className="mb-8">
        <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary mb-1.5">Team</p>
        <h1 className="font-headline text-4xl font-black italic tracking-tighter text-white">Members.</h1>
        <p className="text-muted mt-2 text-sm">
          People who help manage this organisation. An Owner has full control; Managers manage content.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <span className="font-headline text-[12px] font-bold uppercase tracking-widest text-red-400">{error}</span>
        </div>
      )}

      {/* Add member (Owner only) */}
      {isOwner && (
        <div className="mb-8 bg-dark border border-dark-lighter rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="team@email.com"
                className="w-full bg-dark-light border border-dark-lighter rounded-xl pl-10 pr-4 py-2.5 text-[14px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={adding || !addEmail.trim()}
              className="inline-flex items-center justify-center gap-2 h-[42px] px-5 rounded-xl bg-primary text-dark font-headline text-[12px] font-bold uppercase tracking-widest hover:brightness-95 transition-all disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> {adding ? "Adding…" : "Add member"}
            </button>
          </div>
          {addMsg && <p className="mt-2 font-headline text-[12px] font-bold uppercase tracking-widest text-red-400">{addMsg}</p>}
          <p className="mt-2 text-[12px] text-muted-dark">
            The person must already have a Startline account. They are added as an Admin.
          </p>
        </div>
      )}

      {/* Members list */}
      <div className="bg-dark border border-dark-lighter rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading members…
          </div>
        ) : members?.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <p className="font-headline text-[13px] font-bold uppercase tracking-widest text-muted">No members yet</p>
          </div>
        ) : (
          <div>
            {members?.map((m) => (
              <div key={m.id} className="flex items-center gap-4 px-4 sm:px-6 py-4 border-b border-white/[0.06] last:border-0">
                <div className={`w-10 h-10 rounded-lg font-headline font-black italic flex items-center justify-center shrink-0 text-sm
                  ${m.role === "OWNER" ? "bg-primary text-dark" : "bg-dark-light text-muted"}`}>
                  {(m.user.name ?? m.user.email)[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-headline text-[15px] font-black italic tracking-tighter text-light truncate">
                      {m.user.name ?? m.user.email}
                    </span>
                    {m.role === "OWNER" ? (
                      <span className="inline-flex items-center gap-1 font-headline text-[9px] font-bold uppercase tracking-widest text-dark bg-primary rounded px-1.5 py-0.5">
                        <Crown className="w-3 h-3" /> Owner
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-headline text-[9px] font-bold uppercase tracking-widest text-white/40 border border-white/15 rounded px-1.5 py-0.5">
                        <UserCog className="w-3 h-3" /> Manager
                      </span>
                    )}
                  </div>
                  <p className="font-headline text-[11px] uppercase tracking-widest text-muted mt-0.5 truncate">{m.user.email}</p>
                </div>

                {/* Actions (Owner only, not on self) */}
                {isOwner && m.role === "MANAGER" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setTransferTo(m)}
                      className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary/80 border border-primary/30 rounded-lg px-3 py-2 hover:bg-primary/10 transition-colors"
                    >
                      Transfer ownership
                    </button>
                    <button
                      onClick={() => setConfirmRemove(m)}
                      className="flex items-center justify-center w-9 h-9 rounded-lg border border-white/10 text-muted hover:text-red-400 hover:border-red-400/30 transition-colors"
                      aria-label={`Remove ${m.user.email}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {isOwner && m.role === "OWNER" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setConfirmRemove(m)}
                      className="flex items-center justify-center w-9 h-9 rounded-lg border border-white/10 text-muted hover:text-red-400 hover:border-red-400/30 transition-colors"
                      aria-label={`Remove ${m.user.email}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm remove modal */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => !busy && setConfirmRemove(null)}>
          <div className="bg-dark border border-dark-lighter rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-headline text-lg font-black italic tracking-tighter text-white">Remove member?</h3>
              <button onClick={() => !busy && setConfirmRemove(null)} className="text-muted hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-muted mb-6">
              {confirmRemove.role === "OWNER"
                ? `Remove ${confirmRemove.user.email}? If you are the only Owner, this is blocked to keep one owner.`
                : `Remove ${confirmRemove.user.email}? They will lose access to this organisation.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => !busy && setConfirmRemove(null)} disabled={busy}
                className="px-4 py-2 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest text-muted border border-white/10 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={() => handleRemove(confirmRemove)} disabled={busy}
                className="px-4 py-2 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest text-white bg-red-500/80 hover:bg-red-500 transition-colors disabled:opacity-40">
                {busy ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer ownership modal */}
      {transferTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => !busy && setTransferTo(null)}>
          <div className="bg-dark border border-dark-lighter rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-headline text-lg font-black italic tracking-tighter text-white">Transfer ownership?</h3>
              <button onClick={() => !busy && setTransferTo(null)} className="text-muted hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-muted mb-6">
              Make <span className="text-white font-bold">{transferTo.user.email}</span> the new Owner? You will become a Manager.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => !busy && setTransferTo(null)} disabled={busy}
                className="px-4 py-2 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest text-muted border border-white/10 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={() => handleTransfer(transferTo)} disabled={busy}
                className="px-4 py-2 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest text-dark bg-primary hover:brightness-95 transition-colors disabled:opacity-40">
                {busy ? "Transferring…" : "Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
