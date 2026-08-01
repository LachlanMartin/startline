"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut, ShieldCheck, Menu, X, ChevronDown, User,
  LayoutDashboard, CalendarDays, Users, UserCircle, ClipboardList,
  Star, BarChart2, Send, ScrollText,
} from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const DASHBOARD: NavItem = { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Content",
    items: [
      { href: "/admin/events", label: "Events", icon: CalendarDays },
      { href: "/admin/registrations", label: "Registrations", icon: ClipboardList },
      { href: "/admin/reviews", label: "Reviews", icon: Star },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/admin/organisers", label: "Organisers", icon: Users },
      { href: "/admin/users", label: "Users", icon: UserCircle },
    ],
  },
  {
    label: "Overview",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
      { href: "/admin/payouts", label: "Payouts", icon: Send },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    ],
  },
];

export default function AdminNavBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, status, logout } = useAuthContext();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);
  const [openGroup,  setOpenGroup]  = useState<string | null>(null);

  const userRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!isUserOpen && !openGroup && !isMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setIsUserOpen(false);
      for (const [label, el] of Object.entries(groupRefs.current)) {
        if (el && !el.contains(e.target as Node) && openGroup === label) setOpenGroup(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isUserOpen, openGroup, isMenuOpen]);

  const handleSignOut = async () => {
    await logout();
    router.push("/admin/login");
  };

  if (pathname?.startsWith("/admin/login")) return null;

  const initial    = user?.email?.[0]?.toUpperCase() ?? "A";
  const isActivePage = (href: string) => pathname === href || (pathname?.startsWith(href + "/") ?? false);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-darker/80 backdrop-blur-xl border-b-2 border-primary">
        <div className="flex items-center justify-between h-14 max-w-[1200px] mx-auto px-4 sm:px-6 gap-4">

          {/* ── Logo + badge ── */}
          <div className="shrink-0 flex items-center gap-3 min-w-0">
            <Link href="/admin/dashboard" className="py-1 flex items-center gap-2">
              <Image src="/images/logo-title.svg" alt="Startline" width={110} height={28} className="h-6 w-auto" />
            </Link>
            <span className="hidden lg:inline-flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest text-primary/80 border border-primary/40 rounded px-1.5 py-0.5">
              <ShieldCheck className="w-2.5 h-2.5" /> Admin
            </span>
          </div>

          {/* ── Desktop grouped nav dropdowns ── */}
          <div className="hidden md:flex items-center gap-0.5">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} ref={(el) => { groupRefs.current[group.label] = el; }} className="relative">
                <button
                  onClick={() => { setOpenGroup(o => o === group.label ? null : group.label); setIsUserOpen(false); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest transition-colors
                    ${openGroup === group.label ? "bg-white/15 text-white" : "text-white/60 hover:text-white hover:bg-white/10"}`}
                >
                  <span className="hidden sm:block">{group.label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${openGroup === group.label ? "rotate-180" : ""}`} />
                </button>
                {openGroup === group.label && (
                  <div className="absolute left-0 top-full mt-2 w-56 bg-dark-darker border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden">
                    <div className="py-1.5">
                      {group.items.map(({ href, label, icon: Icon }) => {
                        const isActive = isActivePage(href);
                        return (
                          <Link key={href} href={href} onClick={() => setOpenGroup(null)}
                            className={`flex items-center gap-3 px-4 py-2.5 font-headline text-[12px] font-bold uppercase tracking-widest transition-colors
                              ${isActive ? "text-primary bg-primary/10" : "text-white/60 hover:text-white hover:bg-white/[0.06]"}`}
                          >
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-white/40"}`} />
                            {label}
                            {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Right side ── */}
          <div className="flex items-center gap-1 shrink-0">

            {/* Desktop: user menu */}
            {status === "authenticated" && (
              <div ref={userRef} className="hidden md:block relative">
                <button onClick={() => { setIsUserOpen(o => !o); setOpenGroup(null); }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <span className="w-7 h-7 rounded-lg bg-primary text-dark font-headline font-black italic text-sm flex items-center justify-center shrink-0">
                    {initial}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${isUserOpen ? "rotate-180" : ""}`} />
                </button>

                {isUserOpen && (
                  <div className="absolute right-0 top-full mt-1 min-w-[180px] bg-dark-darker/95 backdrop-blur-xl border border-white/[0.05] rounded-xl shadow-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.08]">
                      <div className="font-headline text-[10px] font-bold uppercase tracking-widest text-white/40 mb-0.5">Admin account</div>
                      {user?.email && <div className="font-headline text-[12px] text-white/70 truncate">{user.email}</div>}
                    </div>
                    <Link href="/" onClick={() => setIsUserOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                      <User className="w-4 h-4" /> User Portal
                    </Link>
                    <button onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-red-400/80 hover:text-red-400 hover:bg-white/5 transition-colors">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mobile hamburger */}
            <button onClick={() => { setIsMenuOpen(!isMenuOpen); }}
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
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-white/30">Admin</span>
              </div>

              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="px-4 pt-3 pb-1 font-headline text-[10px] font-bold uppercase tracking-widest text-white/30">
                    {group.label}
                  </div>
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const isActive = isActivePage(href);
                    return (
                      <Link key={href} href={href} onClick={() => setIsMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg font-headline text-[13px] font-bold uppercase tracking-widest transition-colors
                          ${isActive ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-white/40"}`} />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              ))}

              <div className="border-t border-white/10 mt-1.5 pt-3 pb-2">
                {status === "authenticated" && (
                  <Link href="/" onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center gap-2 h-10 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest text-white/60 border border-white/10 hover:text-white transition-colors mb-2">
                    <User className="w-3.5 h-3.5" /> User Portal
                  </Link>
                )}
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
