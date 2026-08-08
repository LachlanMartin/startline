"use client";

import { useState, useEffect, useRef, useCallback, startTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  User, LogOut, Building2, Shield, ShieldCheck, Menu, X, ChevronDown,
} from "lucide-react";
import SignInModal from "@/components/SignInModal";
import { useAuthContext } from "@/context/AuthContext";

type NavItem = { href: string; label: string };

const USER_NAV: NavItem[] = [
  { href: "/", label: "HOME" },
  { href: "/events", label: "EVENTS" },
];

export default function NavBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, role, organiserCount, memberships, status, logout } = useAuthContext();

  const [isMenuOpen,   setIsMenuOpen]   = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isUserOpen,   setIsUserOpen]   = useState(false);
  const [profileName,  setProfileName]  = useState<string | null>(null);
  const [profilePic,   setProfilePic]   = useState<string | null>(null);

  const userRef = useRef<HTMLDivElement>(null);
  const navRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("signin") === "true" && status !== "authenticated") {
      startTransition(() => setIsSignInOpen(true));
    }
  }, [status]);

  useEffect(() => {
    if (status === "authenticated") {
      try {
        fetch("/api/user/profile")
          .then(r => (r.ok ? r.json() : null))
          .then(data => {
            if (!data) return;
            startTransition(() => {
              if (data.name) setProfileName(data.name);
              if (data.profilePicUrl) setProfilePic(data.profilePicUrl);
            });
          })
          .catch(() => {});
      } catch {}
    }
  }, [status]);

  useEffect(() => {
    if (!isUserOpen && !isMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setIsUserOpen(false);
      if (navRef.current  && !navRef.current.contains(e.target as Node))  setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isUserOpen, isMenuOpen]);

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
    router.push("/organiser/dashboard");
  };

  if (pathname?.startsWith("/admin/login")) return null;

  const displayName = profileName ?? user?.email ?? "";
  const initial     = displayName[0]?.toUpperCase() ?? "A";
  const isAdmin      = role === "admin";

  const portalLinks = (
    <>
      {(memberships.length > 0 || isAdmin) && (
        <>
          <div className="border-t border-white/10 my-1" />
          {memberships.length > 0 && (
            <div>
              <div className="px-4 pt-2 pb-1 font-headline text-[10px] font-bold uppercase tracking-widest text-white/40">Organiser</div>
              {memberships.map((m) => (
                <button key={m.organiserId} onClick={() => switchOrganiser(m.organiserId)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 font-headline text-[12px] font-bold uppercase tracking-widest text-left text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                  {m.logoUrl
                    ? <Image src={m.logoUrl} alt="" width={20} height={20} className="w-5 h-5 rounded object-cover shrink-0" />
                    : <Building2 className="w-3.5 h-3.5 shrink-0 text-primary/70" />}
                  <span className="truncate flex-1">{m.organiserName ?? "Organisation"}</span>
                  {m.role === "OWNER"
                    ? <span className="shrink-0 text-[9px] text-primary border border-primary/40 rounded px-1.5 py-0.5">OWNER</span>
                    : <span className="shrink-0 text-[9px] text-white/40 border border-white/15 rounded px-1.5 py-0.5">MANAGER</span>}
                </button>
              ))}
            </div>
          )}
          {isAdmin && (
            <div>
              <div className="px-4 pt-2 pb-1 font-headline text-[10px] font-bold uppercase tracking-widest text-white/40">Admin</div>
              <Link href="/admin/dashboard" onClick={() => setIsUserOpen(false)}
                className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <ShieldCheck className="w-4 h-4 text-primary/70" /> Dashboard
              </Link>
            </div>
          )}
        </>
      )}
    </>
  );

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-darker/80 backdrop-blur-xl border-b border-white/[0.05] pt-safe">
        <div className="flex items-center justify-between h-14 max-w-[1200px] mx-auto px-4 sm:px-6 gap-4">

          {/* ── Logo ── */}
          <Link href="/" className="shrink-0 py-1 flex items-center gap-2">
            <Image src="/images/logo-title.svg" alt="Startline" width={110} height={28} className="h-6 w-auto" />
          </Link>

          {/* ── Desktop nav links ── */}
          <div className="hidden md:flex items-center gap-0.5">
            {USER_NAV.map(({ href, label }) => {
              const isActive = href === "/" ? pathname === "/" : pathname?.startsWith(href) ?? false;
              return (
                <Link key={label} href={href}
                  className={`px-3 py-2 rounded-md font-headline text-[12px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-150
                    ${isActive ? "bg-white/15 text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
                >
                  {label}
                </Link>
              );
            })}
            {status === "authenticated" && (
              <Link href="/activity"
                className={`px-3 py-2 rounded-md font-headline text-[12px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-150
                  ${pathname?.startsWith("/activity") ? "bg-white/15 text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
              >
                ACTIVITY
              </Link>
            )}
          </div>

          {/* ── Right side ── */}
          <div className="flex items-center gap-2 shrink-0">

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
                <button onClick={() => setIsUserOpen(o => !o)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  {profilePic ? (
                    <Image src={profilePic} alt="" width={28} height={28} className="w-7 h-7 rounded-lg object-cover shrink-0" />
                  ) : (
                    <span className="w-7 h-7 rounded-lg bg-primary text-dark font-headline font-black italic text-sm flex items-center justify-center shrink-0">
                      {initial}
                    </span>
                  )}
                  <span className="font-headline text-[12px] font-bold uppercase tracking-widest text-white/70 max-w-[120px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${isUserOpen ? "rotate-180" : ""}`} />
                </button>

                {isUserOpen && (
                  <div className="absolute right-0 top-full mt-1 min-w-[200px] bg-dark-darker border border-white/[0.05] rounded-xl shadow-2xl overflow-hidden">
                    <div className="px-4 pt-3 pb-1 font-headline text-[10px] font-bold uppercase tracking-widest text-white/40">User</div>
                    <Link href="/profile" onClick={() => setIsUserOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                      <User className="w-4 h-4" /> Profile
                    </Link>

                    <Link href="/settings/security" onClick={() => setIsUserOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                      <Shield className="w-4 h-4" /> Security
                    </Link>

                    {portalLinks}

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
              {USER_NAV.map(({ href, label }) => {
                const isActive = href === "/" ? pathname === "/" : pathname?.startsWith(href) ?? false;
                return (
                  <Link key={label} href={href} onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-headline text-[13px] font-bold uppercase tracking-widest transition-colors
                      ${isActive ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
                    {label}
                  </Link>
                );
              })}
              {status === "authenticated" && (
                <Link href="/activity" onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-headline text-[13px] font-bold uppercase tracking-widest transition-colors
                    ${pathname?.startsWith("/activity") ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
                  ACTIVITY
                </Link>
              )}

              {status === "authenticated" && (
                <>
                  <div className="border-t border-white/10 my-1.5" />
                  <div className="px-4 pt-3 pb-1 font-headline text-[10px] font-bold uppercase tracking-widest text-white/30">User</div>
                  <Link href="/profile" onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-headline text-[13px] font-bold uppercase tracking-widest transition-colors
                      ${pathname?.startsWith("/profile") ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
                    <User className="w-4 h-4" /> Profile
                  </Link>
                  <Link href="/settings/security" onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-headline text-[13px] font-bold uppercase tracking-widest transition-colors
                      ${pathname?.startsWith("/settings/security") ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
                    <Shield className="w-4 h-4" /> Security
                  </Link>
                </>
              )}

              {status === "authenticated" && (memberships.length > 0 || isAdmin) && (
                <>
                  <div className="border-t border-white/10 my-1.5" />
                  {memberships.length > 0 && (
                    <div className="px-4 pt-3 pb-1 font-headline text-[10px] font-bold uppercase tracking-widest text-white/30">Organiser</div>
                  )}
                  {memberships.map((m) => (
                    <button key={m.organiserId} onClick={() => { setIsMenuOpen(false); switchOrganiser(m.organiserId); }}
                      className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-primary hover:bg-white/10 transition-colors text-left">
                      {m.logoUrl
                        ? <Image src={m.logoUrl} alt="" width={20} height={20} className="w-5 h-5 rounded object-cover shrink-0" />
                        : <Building2 className="w-4 h-4 shrink-0" />}
                      {m.organiserName ?? "Organisation"}
                    </button>
                  ))}
                  {isAdmin && (
                    <>
                      <div className="px-4 pt-3 pb-1 font-headline text-[10px] font-bold uppercase tracking-widest text-white/30">Admin</div>
                      <Link href="/admin/dashboard" onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-primary hover:bg-white/10 transition-colors">
                        <ShieldCheck className="w-4 h-4" /> Dashboard
                      </Link>
                    </>
                  )}
                </>
              )}

              <div className="border-t border-white/10 mt-1.5 pt-3 pb-2">
                {status === "authenticated" ? (
                  <button onClick={() => { setIsMenuOpen(false); handleSignOut(); }}
                    className="w-full flex items-center justify-center gap-2 h-10 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest text-red-400/80 border border-white/10 hover:text-red-400 hover:border-red-400/30 transition-colors">
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
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

      <SignInModal isOpen={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
    </>
  );
}
