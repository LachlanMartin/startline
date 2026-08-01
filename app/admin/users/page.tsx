"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import { Search, RefreshCw, Ban, CheckCircle2, Building2, UserX } from "lucide-react";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  isPublic: boolean;
  isBanned: boolean;
  city: string | null;
  state: string | null;
  createdAt: string;
  memberships: { organiser: { id: string; orgName: string | null; status: string } }[];
  _count: { registrations: number };
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}

function UserRowItem({
  user,
  onBanToggled,
}: {
  user: UserRow;
  onBanToggled: (id: string, isBanned: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);

  const displayName = user.name || user.username || user.email;
  const initial     = displayName.charAt(0).toUpperCase();

  const handleToggleBan = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/ban`, { method: "PATCH" });
      if (res.ok) {
        const data = await res.json() as { isBanned: boolean };
        onBanToggled(user.id, data.isBanned);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-b border-white/[0.06] last:border-0 px-5 py-4">
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 rounded-lg font-headline font-black italic flex items-center justify-center shrink-0 text-sm
          ${user.isBanned ? "bg-red-500/10 text-red-400" : "bg-dark-light text-muted"}`}>
          {initial}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
            <span className="font-headline text-[15px] font-black italic tracking-tighter text-light truncate">
              {displayName}
            </span>

            {user.isBanned && (
              <span className="inline-flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-400/10 text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Banned
              </span>
            )}

            {user.memberships?.map(({ organiser }) => (
              <span key={organiser.id} className={`inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest
                ${organiser.status === "SUSPENDED" ? "text-red-400" : "text-primary"}`}>
                <Building2 className="w-3.5 h-3.5" />
                {organiser.orgName ?? "Organiser"}
                {organiser.status === "SUSPENDED" && " (suspended)"}
              </span>
            ))}
          </div>

          <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark mb-1">
            {user.email}
            {user.username && <span> · @{user.username}</span>}
            {(user.city || user.state) && (
              <span>
                {" · "}{[user.city, user.state?.toUpperCase()].filter(Boolean).join(", ")}
              </span>
            )}
          </div>

          <div className="font-headline text-[11px] uppercase tracking-widest text-muted">
            {user._count.registrations} registration{user._count.registrations !== 1 ? "s" : ""}
            <span className="text-muted-dark"> · Joined {formatDate(user.createdAt)}</span>
            {!user.isPublic && <span className="text-muted-dark"> · Private profile</span>}
          </div>
        </div>

        <div className="shrink-0 ml-auto pl-2">
          <button
            onClick={handleToggleBan}
            disabled={loading}
            className={`flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest px-3 py-2 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed
              ${user.isBanned
                ? "border border-primary/40 text-primary hover:bg-primary/10"
                : "border border-red-500/30 text-red-400 hover:bg-red-500/10"
              }`}
          >
            {loading
              ? <span className="w-3 h-3 border border-current/40 border-t-current rounded-full animate-spin" />
              : user.isBanned
                ? <><CheckCircle2 className="w-3.5 h-3.5" /> Unban</>
                : <><Ban className="w-3.5 h-3.5" /> Ban</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users,      setUsers]      = useState<UserRow[] | null>(null);
  const loading = users === null;
  const [search,     setSearch]     = useState("");
  const [query,      setQuery]      = useState("");
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = useCallback(async (q: string, p: number) => {
    try {
      const params = new URLSearchParams({ page: String(p), limit: "50" });
      if (q) params.set("search", q);
      const res  = await fetch(`/api/admin/users?${params}`);
      const data = await res.json() as { users: UserRow[]; total: number; totalPages: number };
      if (res.ok) {
        setUsers(data.users);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => { startTransition(() => fetchUsers(query, page)); }, [query, page, fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(search);
  };

  const handleBanToggled = (id: string, isBanned: boolean) => {
    setUsers((prev) => (prev ?? []).map((u) => u.id === id ? { ...u, isBanned } : u));
  };

  return (
    <div className="min-h-screen bg-dark-darker">


      <main className="pt-14">
        <div className="max-w-[1200px] mx-auto px-6 py-10 page-in">

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-2">
                Admin portal
              </div>
              <h1 className="font-headline text-[44px] font-black italic tracking-tighter leading-none text-light">
                Users.
              </h1>
            </div>
            <button
              onClick={() => fetchUsers(query, page)}
              className="self-start sm:self-end flex items-center gap-2 font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
              <input
                type="text"
                placeholder="Search by name, email, or username…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-[14px] bg-dark-light border border-dark-lighter rounded-lg text-light placeholder:text-muted-dark focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <button
              type="submit"
              className="font-headline text-[12px] font-bold uppercase tracking-widest bg-machined shadow-machined text-dark px-5 py-2.5 rounded-lg hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform"
            >
              Search
            </button>
            {query && (
              <button
                type="button"
                onClick={() => { setSearch(""); setQuery(""); setPage(1); }}
                className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light px-3 py-2.5 transition-colors"
              >
                Clear
              </button>
            )}
          </form>

          <Card className="overflow-hidden">
            {loading && (
              <div className="p-12 text-center">
                <div className="w-5 h-5 border-2 border-dark-lighter border-t-primary rounded-full animate-spin mx-auto mb-3" />
                <div className="font-headline text-sm text-muted uppercase tracking-widest">Loading…</div>
              </div>
            )}

            {!loading && users.length === 0 && (
              <div className="p-12 text-center">
                <UserX className="w-8 h-8 text-dark-lighter mx-auto mb-3" />
                <div className="font-headline text-lg font-black italic text-light mb-1">
                  {query ? "No users found" : "No users yet"}
                </div>
                <div className="text-muted text-sm">
                  {query ? `No users match "${query}".` : "User accounts will appear here once they sign up."}
                </div>
              </div>
            )}

            {!loading && users.map((u) => (
              <UserRowItem key={u.id} user={u} onBanToggled={handleBanToggled} />
            ))}
          </Card>

          {!loading && users.length > 0 && (
            <div className="mt-4 flex items-center justify-between font-headline text-[12px] uppercase tracking-widest text-muted">
              <span>{total} user{total !== 1 ? "s" : ""}</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1 rounded border border-dark-lighter text-muted hover:border-primary/50 hover:text-light disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  <span>Page {page} of {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages}
                    className="px-3 py-1 rounded border border-dark-lighter text-muted hover:border-primary/50 hover:text-light disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
