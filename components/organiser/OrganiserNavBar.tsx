"use client";

import { useState, useEffect, useRef, useCallback, startTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  User, LogOut, Building2, Shield, Plus, Settings, Bell,
  CheckCircle2, XCircle, Menu, X, ChevronDown, Users, UserCircle,
} from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";

type NavItem = { href: string; label: string };

const ORGANISER_NAV: NavItem[] = [
  { href: "/organiser/dashboard", label: "Dashboard" },
  { href: "/organiser/listings", label: "Listings" },
  { href: "/organiser/profile", label: "Organisation" },
  { href: "/organiser/members", label: "Members" },
  { href: "/organiser/payments", label: "Payments" },
  { href: "/organiser/how-it-works", label: "Guide" },
];

interface Notification {
  id: string;
  type: "EVENT_APPROVED" | "EVENT_REJECTED" | "NEW_REGISTRATION";
  title: string;
  body: string;
  eventId: string | null;
  read: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const NOTIF_ICON: Record<Notification["type"], React.ReactNode> = {
  EVENT_APPROVED:   <CheckCircle2 className="w-4 h-4 text-lime-400" />,
  EVENT_REJECTED:   <XCircle      className="w-4 h-4 text-red-400"  />,
  NEW_REGISTRATION: <User         className="w-4 h-4 text-blue-400" />,
};

export default function OrganiserNavBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, status, logout } = useAuthContext();
  const { open: openSettingsModal } = useSettings();

  const [isMenuOpen,   setIsMenuOpen]   = useState(false);
  const [isUserOpen,   setIsUserOpen]   = useState(false);
  const [isNavOpen,    setIsNavOpen]    = useState(false);
  const [orgName,      setOrgName]      = useState("");
  const [orgLogo,      setOrgLogo]      = useState<string | null>(null);
  const [activeOrgId,  setActiveOrgId]  = useState<string | null>(null);
  const [role,         setRole]         = useState<string | null>(null);
  const [memberships,  setMemberships]  = useState<{ organiserId: string; organiserName: string | null; role: string; logoUrl: string | null }[]>([]);
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,  setUnreadCount]  = useState(0);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef  = useRef<HTMLDivElement>(null);
  const navRef   = useRef<HTMLDivElement>(null);

  const fetchOrgInfo = useCallback(async () => {
    try {
      const r = await fetch("/api/organiser/memberships");
      if (!r.ok) return;
      const data = await r.json();
      const active = data.memberships?.find((m: { organiserId: string }) => m.organiserId === data.activeOrganiserId)
        ?? data.memberships?.[0];
      startTransition(() => {
        setMemberships(data.memberships ?? []);
        setOrgName(active?.organiserName ?? "");
        setOrgLogo(active?.logoUrl ?? null);
        setActiveOrgId(active?.organiserId ?? null);
        setRole(active?.role ?? null);
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (status === "authenticated") startTransition(() => fetchOrgInfo());
  }, [status, fetchOrgInfo]);

  const fetchNotifications = useCallback(async () => {
    try {
      const r = await fetch("/api/organiser/notifications");
      if (!r.ok) return;
      const data: { notifications: Notification[]; unreadCount: number } = await r.json();
      startTransition(() => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    startTransition(() => fetchNotifications());
    const interval = setInterval(() => startTransition(() => fetchNotifications()), 30_000);
    return () => clearInterval(interval);
  }, [status, fetchNotifications]);

  useEffect(() => {
    if (!isUserOpen && !notifOpen && !isNavOpen) return;
    const handler = (e: MouseEvent) => {
      if (userRef.current  && !userRef.current.contains(e.target as Node))  setIsUserOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (navRef.current   && !navRef.current.contains(e.target as Node))   setIsNavOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isUserOpen, notifOpen, isNavOpen]);

  const handleSignOut = async () => {
    await logout();
    router.push("/");
  };

  const switchOrganiser = async (organiserId: string) => {
    try {
      await fetch("/api/organiser/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organiserId }),
      });
    } catch {}
    setIsUserOpen(false);
    await fetchOrgInfo();
    router.push("/organiser/dashboard");
  };

  const openNotifPanel = () => {
    setNotifOpen(o => !o);
    setIsUserOpen(false);
    if (unreadCount > 0) {
      fetch("/api/organiser/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
        .then(() => { setUnreadCount(0); setNotifications(ns => ns.map(n => ({ ...n, read: true }))); })
        .catch(() => {});
    }
  };

  const displayName = orgName || user?.email || "";
  const initial     = displayName[0]?.toUpperCase() ?? "A";
  const activePage  = ORGANISER_NAV.find(({ href }) =>
    pathname === href || (pathname?.startsWith(href + "/") ?? false)
  );

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-darker/80 backdrop-blur-xl border-b-2 border-primary">
        <div className="flex items-center justify-between h-14 max-w-[1200px] mx-auto px-4 sm:px-6 gap-4">

          {/* ── Logo ── */}
          <div className="shrink-0 flex items-center gap-3 min-w-0">
            <Link href="/organiser/dashboard" className="py-1 flex items-center gap-2">
              <Image src="/images/logo-title.svg" alt="Startline" width={110} height={28} className="h-6 w-auto" />
            </Link>
          </div>

          {/* ── Desktop nav links ── */}
          <div className="hidden md:flex items-center gap-0.5">
            {ORGANISER_NAV.map(({ href, label }) => {
              const isActive = href === "/organiser/listings"
                ? pathname === href || (pathname?.startsWith(href + "/") ?? false)
                : pathname?.startsWith(href) ?? false;
              return (
                <Link key={href} href={href}
                  className={`px-3 py-2 rounded-md font-headline text-[12px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-150
                    ${isActive ? "bg-primary/15 text-primary" : "text-white/50 hover:text-white hover:bg-white/10"}`}>
                  {label}
                </Link>
              );
            })}
          </div>

          {/* ── Right side ── */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Portal badge */}
            <span className="hidden md:inline-flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest text-primary/80 border border-primary/40 rounded px-1.5 py-0.5">
              <Building2 className="w-2.5 h-2.5" /> Organiser
            </span>

            {/* Notifications */}
            <div ref={notifRef} className="relative">
              <button onClick={openNotifPanel}
                className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Notifications">
                <Bell className="w-4 h-4 text-white/60" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] bg-primary text-dark font-headline font-black text-[9px] rounded-full flex items-center justify-center px-0.5 leading-none">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-dark-darker border border-primary/40 rounded-xl shadow-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <span className="font-headline text-[12px] font-bold uppercase tracking-widest text-white/60">Notifications</span>
                    {notifications.length > 0 && (
                      <button onClick={() => fetchNotifications()} className="font-headline text-[10px] uppercase tracking-widest text-white/30 hover:text-white/60">Refresh</button>
                    )}
                  </div>
                  <div className="max-h-[380px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <Bell className="w-6 h-6 text-white/20 mx-auto mb-2" />
                        <div className="font-headline text-[12px] uppercase tracking-widest text-white/30">No notifications yet</div>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-0 ${!n.read ? "bg-white/5" : ""}`}>
                          <div className="mt-0.5 shrink-0">{NOTIF_ICON[n.type]}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-headline text-[12px] font-bold text-white leading-snug">{n.title}</span>
                              {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1" />}
                            </div>
                            <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="font-headline text-[10px] uppercase tracking-widest text-white/30">{timeAgo(n.createdAt)}</span>
                              {n.eventId && (
                                <Link href={`/organiser/events/${n.eventId}/dashboard`} onClick={() => setNotifOpen(false)}
                                  className="font-headline text-[10px] uppercase tracking-widest text-primary/70 hover:text-primary">View event →</Link>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            <div ref={userRef} className="relative">
              <button onClick={() => { setIsUserOpen(o => !o); setNotifOpen(false); }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
                {orgLogo ? (
                  <Image src={orgLogo} alt="" width={28} height={28} className="w-7 h-7 rounded-lg object-cover shrink-0" />
                ) : (
                  <span className="w-7 h-7 rounded-lg bg-primary text-dark font-headline font-black italic text-sm flex items-center justify-center shrink-0">
                    {initial}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${isUserOpen ? "rotate-180" : ""}`} />
              </button>

              {isUserOpen && (
                <div className="absolute right-0 top-full mt-1 min-w-[220px] bg-dark-darker border border-primary/40 rounded-xl shadow-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10">
                    <div className="font-headline text-[10px] font-bold uppercase tracking-widest text-white/40 mb-0.5">{orgName || "Organisation"}</div>
                    {user?.email && <div className="font-headline text-[12px] text-white/70 truncate">{user.email}</div>}
                  </div>

                  {/* Organiser */}
                  <div className="px-4 pt-3 pb-1 font-headline text-[10px] font-bold uppercase tracking-widest text-white/40">Organiser</div>
                  <Link href="/organiser/new-listing" onClick={() => setIsUserOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                    <Plus className="w-4 h-4" /> Post an Event
                  </Link>
                  {memberships.length > 0 && (
                    <div className="pb-1.5">
                      {memberships.map((m) => {
                        const isActive = m.organiserId === activeOrgId;
                        return (
                          <button key={m.organiserId} onClick={() => { setIsUserOpen(false); switchOrganiser(m.organiserId); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 font-headline text-[12px] font-bold uppercase tracking-widest text-left transition-colors
                              ${isActive ? "text-primary bg-primary/10" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
                            {m.logoUrl
                              ? <Image src={m.logoUrl} alt="" width={20} height={20} className="w-5 h-5 rounded object-cover shrink-0" />
                              : <Building2 className="w-3.5 h-3.5 shrink-0 text-white/40" />}
                            <span className="truncate flex-1">{m.organiserName ?? "Organisation"}</span>
                            {m.role === "OWNER"
                              ? <span className="shrink-0 text-[9px] text-primary border border-primary/40 rounded px-1.5 py-0.5">OWNER</span>
                              : <span className="shrink-0 text-[9px] text-white/40 border border-white/15 rounded px-1.5 py-0.5">MANAGER</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* User */}
                  <div className="border-t border-white/10 my-1" />
                  <div className="px-4 pt-2 pb-1 font-headline text-[10px] font-bold uppercase tracking-widest text-white/40">User</div>
                  <Link href="/profile" onClick={() => setIsUserOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                    <UserCircle className="w-4 h-4" /> My profile
                  </Link>
                  <Link href="/settings/security" onClick={() => setIsUserOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                    <Shield className="w-4 h-4" /> Security
                  </Link>
                  <button onClick={() => { setIsUserOpen(false); openSettingsModal("personal"); }}
                    className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                    <Settings className="w-4 h-4" /> Settings
                  </button>
                  <Link href="/" onClick={() => setIsUserOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                    <User className="w-4 h-4" /> User
                  </Link>
                  <div className="border-t border-white/10" />
                  <button onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-red-400/80 hover:text-red-400 hover:bg-white/5 transition-colors">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button onClick={() => { setIsMenuOpen(!isMenuOpen); setNotifOpen(false); }}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Toggle menu" aria-expanded={isMenuOpen}>
              {isMenuOpen ? <X className="w-4 h-4 text-white/70" /> : <Menu className="w-4 h-4 text-white/70" />}
            </button>
          </div>
        </div>

        {/* ── Mobile dropdown ── */}
        {isMenuOpen && (
          <div className="md:hidden bg-dark-darker/95 backdrop-blur-xl border-t border-white/[0.05] max-h-[calc(100dvh-3.5rem)] overflow-y-auto">
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-1.5">
              <div className="flex items-center gap-1.5 px-4 py-2 mb-1">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-white/30">{orgName || "Organiser"}</span>
              </div>

              {ORGANISER_NAV.map(({ href, label }) => {
                const isActive = href === "/organiser/listings"
                  ? pathname === href || (pathname?.startsWith(href + "/") ?? false)
                  : pathname?.startsWith(href) ?? false;
                return (
                  <Link key={href} href={href} onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-headline text-[13px] font-bold uppercase tracking-widest transition-colors
                      ${isActive ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
                    {label}
                  </Link>
                );
              })}

              {memberships.length > 1 && (
                <>
                  <div className="border-t border-white/10 my-1.5" />
                  {memberships.map((m) => (
                    <button key={m.organiserId} onClick={() => { setIsMenuOpen(false); switchOrganiser(m.organiserId); }}
                      className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[12px] font-bold uppercase tracking-widest text-primary hover:bg-white/10 transition-colors text-left">
                      {m.logoUrl
                        ? <Image src={m.logoUrl} alt="" width={20} height={20} className="w-5 h-5 rounded object-cover shrink-0" />
                        : <Users className="w-4 h-4 shrink-0" />}
                      {m.organiserName ?? "Organisation"}
                    </button>
                  ))}
                </>
              )}

              <div className="border-t border-white/10 mt-1.5 pt-3 pb-2">
                <button onClick={() => { setIsMenuOpen(false); handleSignOut(); }}
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest text-red-400/80 border border-white/10 hover:text-red-400 hover:border-red-400/30 transition-colors">
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
