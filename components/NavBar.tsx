"use client";

import { useState, useEffect, useRef, useCallback, startTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  User, LogOut, Building2, ShieldCheck, Shield, Plus, Settings, Bell,
  CheckCircle2, XCircle, Menu, X, LayoutDashboard, CalendarDays,
  CreditCard, BookOpen, ArrowLeft, ChevronDown, Users, Star,
  UserCircle, ClipboardList, BarChart2, ScrollText, Send,
} from "lucide-react";
import SignInModal from "@/components/SignInModal";
import { useAuthContext, type Role } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";

type NavItem = { href: string; label: string; icon?: React.ComponentType<{ className?: string }> };

const USER_NAV: NavItem[] = [
  { href: "/", label: "HOME" },
  { href: "/events", label: "EVENTS" },
  { href: "/activity", label: "ACTIVITY" },
];

const ORGANISER_NAV: NavItem[] = [
  { href: "/organiser/dashboard", label: "Dashboard" },
  { href: "/organiser/listings", label: "Listings" },
  { href: "/organiser/profile", label: "Profile" },
  { href: "/organiser/payments", label: "Payments" },
  { href: "/organiser/how-it-works", label: "Guide" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/organisers", label: "Organisers", icon: Users },
  { href: "/admin/users", label: "Users", icon: UserCircle },
  { href: "/admin/registrations", label: "Registrations", icon: ClipboardList },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/admin/payouts", label: "Payouts", icon: Send },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

const ROLE_BADGE: Record<Role, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  user:      { icon: User,      label: "User" },
  organiser: { icon: Building2, label: "Organiser" },
  admin:     { icon: ShieldCheck, label: "Admin" },
};

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

const CUSTOMER_URL = process.env.NODE_ENV === "development" ? "/" : "https://startlineau.com";

export default function NavBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, role, status, logout } = useAuthContext();
  const { open: openSettingsModal } = useSettings();

  const [isMenuOpen,   setIsMenuOpen]   = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isUserOpen,   setIsUserOpen]   = useState(false);
  const [isNavOpen,    setIsNavOpen]    = useState(false);
  const [orgName,      setOrgName]      = useState("");
  const [profileName,  setProfileName]  = useState<string | null>(null);
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,  setUnreadCount]  = useState(0);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef  = useRef<HTMLDivElement>(null);
  const navRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("signin") === "true" && status !== "authenticated") {
      startTransition(() => setIsSignInOpen(true));
    }
  }, [status]);

  const fetchName = useCallback(async () => {
    if (role === "organiser") {
      try {
        const r = await fetch("/api/organiser/profile");
        if (!r.ok) return;
        const data = await r.json();
        setOrgName(data.orgName || data.contactName || data.email || "");
      } catch {}
    } else if (role === "user") {
      try {
        const r = await fetch("/api/user/profile");
        if (!r.ok) return;
        const data = await r.json();
        setProfileName(data.name ?? null);
      } catch {}
    }
  }, [role]);

  useEffect(() => {
    if (status === "authenticated" && role) startTransition(() => fetchName());
  }, [status, role, fetchName]);

  const fetchNotifications = useCallback(async () => {
    if (role !== "organiser") return;
    try {
      const r = await fetch("/api/organiser/notifications");
      if (!r.ok) return;
      const data: { notifications: Notification[]; unreadCount: number } = await r.json();
      startTransition(() => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      });
    } catch {}
  }, [role]);

  useEffect(() => {
    if (role !== "organiser") return;
    startTransition(() => fetchNotifications());
    const interval = setInterval(() => startTransition(() => fetchNotifications()), 30_000);
    return () => clearInterval(interval);
  }, [role, fetchNotifications]);

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
    setIsUserOpen(false);
    setIsMenuOpen(false);
    await logout();
    if (role === "admin") router.push("/admin/login");
    else if (role === "organiser") router.push("/organiser");
    else router.push("/");
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

  if (pathname?.startsWith("/admin/login")) return null;

  const displayName = profileName ?? orgName ?? user?.email ?? "";
  const initial     = displayName[0]?.toUpperCase() ?? "A";
  const activePage  = ADMIN_NAV.find(({ href }) => pathname === href || (pathname?.startsWith(href + "/") ?? false));
  const ActiveIcon  = activePage?.icon ?? LayoutDashboard;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-dark-darker/80 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="flex items-center justify-between h-full max-w-[1200px] mx-auto px-4 sm:px-6 gap-4">

          {/* ── Logo + Role badge ── */}
          <Link href="/" className="shrink-0 py-1 flex items-center gap-2">
            <Image src="/images/logo-title.svg" alt="Startline" width={110} height={28} className="h-6 w-auto" />
            {role && (() => {
              const BadgeIcon = ROLE_BADGE[role].icon;
              return (
                <span className="hidden sm:flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-white/30 border border-white/15 rounded px-1.5 py-0.5">
                  <BadgeIcon className="w-2.5 h-2.5" /> {ROLE_BADGE[role].label}
                </span>
              );
            })()}
          </Link>

          {/* ── Desktop nav links ── */}
          <div className="hidden md:flex items-center gap-0.5">
            {role === "admin" ? (
              <div ref={navRef} className="relative">
                <button
                  onClick={() => { setIsNavOpen(o => !o); setIsUserOpen(false); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest transition-colors
                    ${isNavOpen ? "bg-white/15 text-white" : "text-white/60 hover:text-white hover:bg-white/10"}`}
                >
                  <ActiveIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:block">{activePage?.label ?? "Menu"}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${isNavOpen ? "rotate-180" : ""}`} />
                </button>
                {isNavOpen && (
                  <div className="absolute left-0 top-full mt-2 w-56 bg-dark-darker border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden">
                    <div className="py-1.5">
                      {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
                        const isActive = pathname === href || (pathname?.startsWith(href + "/") ?? false);
                        return (
                          <Link key={href} href={href} onClick={() => setIsNavOpen(false)}
                            className={`flex items-center gap-3 px-4 py-2.5 font-headline text-[12px] font-bold uppercase tracking-widest transition-colors
                              ${isActive ? "text-primary bg-primary/10" : "text-white/60 hover:text-white hover:bg-white/[0.06]"}`}
                          >
                            {Icon && <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-white/40"}`} />}
                            {label}
                            {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              (role === "organiser" ? ORGANISER_NAV : USER_NAV).map(({ href, label }) => {
                const isActive = href === "/" ? pathname === "/" : pathname?.startsWith(href) ?? false;
                return (
                  <Link key={label} href={href}
                    className={`px-3 py-2 rounded-md font-headline text-[12px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-150
                      ${isActive ? "bg-white/15 text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
                  >
                    {label}
                  </Link>
                );
              })
            )}
          </div>

          {/* ── Right side ── */}
          <div className="flex items-center gap-1 shrink-0">

            {/* Notifications (organiser only) */}
            {role === "organiser" && (
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
                  <div className="absolute right-0 top-full mt-1 w-80 bg-dark-darker/95 backdrop-blur-xl border border-white/[0.05] rounded-xl shadow-2xl overflow-hidden">
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
            )}

            {/* Desktop: unauthenticated */}
            {status !== "authenticated" && (
              <button onClick={() => setIsSignInOpen(true)} disabled={status === "loading"}
                className="hidden md:inline-flex items-center justify-center h-8 px-3 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest text-white/60 border border-white/10 hover:border-primary hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-default">
                SIGN IN
              </button>
            )}

            {/* Desktop: authenticated user menu */}
            {status === "authenticated" && (
              <div ref={userRef} className="hidden md:block relative">
                <button onClick={() => { setIsUserOpen(o => !o); setNotifOpen(false); setIsNavOpen(false); }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <span className="w-7 h-7 rounded-lg bg-primary text-dark font-headline font-black italic text-sm flex items-center justify-center shrink-0">
                    {initial}
                  </span>
                  <span className="font-headline text-[12px] font-bold uppercase tracking-widest text-white/70 max-w-[120px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${isUserOpen ? "rotate-180" : ""}`} />
                </button>

                {isUserOpen && (
                  <div className="absolute right-0 top-full mt-1 min-w-[180px] bg-dark-darker/95 backdrop-blur-xl border border-white/[0.05] rounded-xl shadow-2xl overflow-hidden">
                    {role === "admin" ? (
                      <div className="px-4 py-3 border-b border-white/[0.08]">
                        <div className="font-headline text-[10px] font-bold uppercase tracking-widest text-white/40 mb-0.5">Admin account</div>
                        {user?.email && <div className="font-headline text-[12px] text-white/70 truncate">{user.email}</div>}
                      </div>
                    ) : (
                      <Link href={role === "organiser" ? "/organiser/profile" : "/profile"} onClick={() => setIsUserOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                        <User className="w-4 h-4" /> Profile
                      </Link>
                    )}

                    {role !== "admin" && (
                      <Link href="/settings/security" onClick={() => setIsUserOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                        <Shield className="w-4 h-4" /> Security
                      </Link>
                    )}

                    {role === "organiser" && (
                      <>
                        <Link href="/organiser/new-listing" onClick={() => setIsUserOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                          <Plus className="w-4 h-4" /> Post an Event
                        </Link>
                        <button onClick={() => { setIsUserOpen(false); openSettingsModal("personal"); }}
                          className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                          <Settings className="w-4 h-4" /> Settings
                        </button>
                      </>
                    )}

                    {role === "organiser" && (
                      <>
                        <div className="border-t border-white/10" />
                        <Link href={CUSTOMER_URL} onClick={() => setIsUserOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-primary/80 hover:text-primary hover:bg-white/5 transition-colors">
                          <ArrowLeft className="w-4 h-4" /> Switch to User
                        </Link>
                      </>
                    )}

                    <div className="border-t border-white/10" />
                    <button onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-red-400/80 hover:text-red-400 hover:bg-white/5 transition-colors">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}

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
              {role && (() => {
                const BadgeIcon = ROLE_BADGE[role].icon;
                return (
                  <div className="flex items-center gap-1.5 px-4 py-2 mb-1">
                    <BadgeIcon className="w-3.5 h-3.5 text-white/30" />
                    <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-white/30">{ROLE_BADGE[role].label}</span>
                  </div>
                );
              })()}

              {(role === "organiser" ? ORGANISER_NAV : role === "admin" ? ADMIN_NAV : USER_NAV).map(({ href, label, icon: Icon }) => {
                const isActive = href === "/" ? pathname === "/" : pathname?.startsWith(href) ?? false;
                return (
                  <Link key={label} href={href} onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-headline text-[13px] font-bold uppercase tracking-widest transition-colors
                      ${isActive ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
                    {Icon && <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-white/40"}`} />}
                    {label}
                  </Link>
                );
              })}

              {status === "authenticated" && role === "organiser" && (
                <>
                  <div className="border-t border-white/10 my-1.5" />
                  <Link href="/organiser/new-listing" onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                    <Plus className="w-4 h-4" /> Post an Event
                  </Link>
                </>
              )}

              {status === "authenticated" && role !== "admin" && (
                <Link href="/settings/security" onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                  <Shield className="w-4 h-4" /> Security
                </Link>
              )}

              <div className="border-t border-white/10 mt-1.5 pt-3 pb-2">
                {status === "authenticated" ? (
                  <>
                    {role === "organiser" && (
                      <Link href={CUSTOMER_URL} onClick={() => setIsMenuOpen(false)}
                        className="w-full flex items-center justify-center gap-2 h-10 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest text-primary/80 border border-white/10 hover:text-primary hover:border-primary/30 transition-colors mb-2">
                        <ArrowLeft className="w-3.5 h-3.5" /> Switch to User
                      </Link>
                    )}
                    <button onClick={() => { setIsMenuOpen(false); handleSignOut(); }}
                      className="w-full flex items-center justify-center gap-2 h-10 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest text-red-400/80 border border-white/10 hover:text-red-400 hover:border-red-400/30 transition-colors">
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setIsMenuOpen(false); setIsSignInOpen(true); }} disabled={status === "loading"}
                    className="w-full h-10 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest text-white/60 border border-white/10 hover:border-primary hover:text-primary transition-colors disabled:opacity-30">
                    SIGN IN
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── Mobile bottom nav (organiser only) ── */}
      {role === "organiser" && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-dark border-t border-dark-lighter" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="flex items-stretch h-16">
            {[
              { href: "/organiser/dashboard", label: "Home", icon: LayoutDashboard },
              { href: "/organiser/listings", label: "Listings", icon: CalendarDays },
              null,
              { href: "/organiser/payments", label: "Payments", icon: CreditCard },
              { href: "/organiser/profile", label: "Profile", icon: User },
            ].map((item, i) => {
              if (item === null) {
                return (
                  <div key="fab" className="flex-1 flex items-center justify-center">
                    <Link href="/organiser/new-listing" aria-label="Create new listing"
                      className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95
                        ${pathname?.startsWith("/organiser/new-listing") ? "bg-primary/80 ring-2 ring-primary/40" : "bg-primary"}`}>
                      <Plus className="w-6 h-6 text-dark" strokeWidth={2.5} />
                    </Link>
                  </div>
                );
              }
              const isActive = item.href === "/organiser/listings"
                ? pathname === item.href || (pathname?.startsWith(item.href + "/") ?? false)
                : pathname === item.href;
              return (
                <Link key={item.href} href={item.href}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors
                    ${isActive ? "text-primary" : "text-muted"}`}>
                  <item.icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.5 : 2} />
                  <span className="font-headline text-[10px] uppercase tracking-widest font-bold">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      <SignInModal isOpen={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
    </>
  );
}
