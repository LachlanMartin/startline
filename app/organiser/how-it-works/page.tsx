"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, CheckCircle2, Clock, FileEdit, Globe,
  MapPin, Calendar, Star, Zap, Eye,
  Search, ChevronRight, Award, Layers, UserCircle2,
  BarChart2, Ticket, ImageIcon, Mail, CheckCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/* ── Scroll-reveal hook ──────────────────────────────────────────────────── */
function useReveal(threshold = 0.08) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = "" }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
    >
      {children}
    </div>
  );
}

/* ── Section label ───────────────────────────────────────────────────────── */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-3">
      {children}
    </div>
  );
}

/* ── Step indicator ──────────────────────────────────────────────────────── */
function StepPill({ n, label }: { n: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 mb-5">
      <span className="w-7 h-7 rounded-lg bg-primary text-dark font-headline font-black italic text-[12px] flex items-center justify-center shrink-0">
        {n}
      </span>
      <span className="font-headline text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
        Step {n} — {label}
      </span>
    </div>
  );
}

/* ── Mock event card (athlete site style) ────────────────────────────────── */
function MockEventCard({ title, type, city, state, date, price, status }: {
  title: string; type: string; city: string; state: string;
  date: string; price: string; status?: "live";
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#1c1c1c] flex flex-col">
      <div className="aspect-[16/9] bg-gradient-to-br from-[#1a2a0a] to-[#0d1500] flex items-center justify-center relative">
        <ImageIcon className="w-5 h-5 text-white/10" />
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded bg-primary text-[#111] font-headline text-[8px] font-bold uppercase tracking-widest">{type}</span>
          {status === "live" && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/15 border border-lime-500/30 text-primary/80 font-headline text-[8px] font-bold uppercase tracking-widest">
              <span className="w-1 h-1 rounded-full bg-primary animate-pulse" /> Live
            </span>
          )}
        </div>
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <div className="font-headline text-[12px] font-black italic tracking-tighter text-white leading-tight">{title}</div>
        <div className="flex items-center gap-1 font-headline text-[9px] uppercase tracking-widest text-white/40">
          <Calendar className="w-2.5 h-2.5 text-primary shrink-0" /> {date}
        </div>
        <div className="flex items-center gap-1 font-headline text-[9px] uppercase tracking-widest text-white/40">
          <MapPin className="w-2.5 h-2.5 text-primary shrink-0" /> {city}, {state}
        </div>
        <div className="mt-1.5 pt-2 border-t border-white/[0.06] flex items-center justify-between">
          <span className="font-headline text-[12px] font-black italic text-primary/80">{price}</span>
          <span className="font-headline text-[8px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-0.5">
            Register <ArrowRight className="w-2 h-2" />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Browser chrome ──────────────────────────────────────────────────────── */
function BrowserFrame({ children, url }: { children: React.ReactNode; url: string }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-dark-lighter shadow-xl">
      <div className="bg-[#f0f0f0] px-4 py-2.5 flex items-center gap-3 border-b border-dark-lighter">
        <div className="flex gap-1.5 shrink-0">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 bg-dark rounded-md px-3 py-1 text-[11px] text-muted-dark font-mono flex items-center gap-1.5 border border-dark-lighter max-w-xs">
          <Globe className="w-3 h-3 text-white/30 shrink-0" />
          {url}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ── Dashed step divider ─────────────────────────────────────────────────── */
function StepDivider() {
  return (
    <div className="flex items-center gap-4 my-2">
      <div className="flex-1 border-t border-dashed border-dark-lighter" />
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-lime-300" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
        <div className="w-1.5 h-1.5 rounded-full bg-lime-300" />
      </div>
      <div className="flex-1 border-t border-dashed border-dark-lighter" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function HowItWorksPage() {
  const [activeTab, setActiveTab] = useState<"home" | "events">("home");

  return (
    <div className="min-h-screen bg-dark-light">

      <main className="pt-14 page-in">

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <div className="bg-dark border-b border-dark-lighter">
          <div className="max-w-[1200px] mx-auto px-6 py-16 lg:py-20">
            <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-end">
              <div>
                <Reveal>
                  <Label>Organiser Guide</Label>
                  <h1 className="font-headline text-[52px] lg:text-[68px] font-black italic tracking-tighter leading-[0.92] text-light mb-6">
                    Launch your first<br />event in <span className="text-primary">four<br />steps.</span>
                  </h1>
                  <p className="text-muted text-[17px] leading-relaxed max-w-[480px]">
                    From building your organiser profile to going live on Australia&apos;s competitive fitness calendar — here&apos;s exactly how it works.
                  </p>
                </Reveal>
              </div>
              {/* Step chips */}
              <Reveal delay={120}>
                <div className="mt-10 lg:mt-0 space-y-2.5">
                  {[
                    { n: "01", l: "Set up your organiser profile" },
                    { n: "02", l: "Create your event listing"     },
                    { n: "03", l: "Submit for review"             },
                    { n: "04", l: "Go live on Startline"          },
                  ].map(({ n, l }) => (
                    <div key={n} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-dark-light border border-dark-lighter hover:border-primary/40 hover:bg-primary/10 transition-colors">
                      <span className="w-7 h-7 rounded-lg bg-primary text-dark font-headline font-black italic text-[12px] flex items-center justify-center shrink-0">{n}</span>
                      <span className="font-headline text-[13px] font-bold uppercase tracking-widest text-white/70">{l}</span>
                      <ChevronRight className="w-4 h-4 text-white/30 ml-auto shrink-0" />
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Stats row */}
            <Reveal delay={200}>
              <div className="mt-12 pt-10 border-t border-white/[0.05] grid grid-cols-3 gap-8 max-w-lg">
                {[
                  { v: "42K+",   l: "Athletes on platform"      },
                  { v: "< 48h",  l: "Average review time"       },
                  { v: "8",      l: "States covered"            },
                ].map(({ v, l }) => (
                  <div key={l}>
                    <div className="font-headline text-[28px] font-black italic tracking-tighter text-primary leading-none mb-1">{v}</div>
                    <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark">{l}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto px-6">

          {/* ── STEP 1: Profile ─────────────────────────────────────────── */}
          <section className="py-20 lg:py-24">
            <div className="lg:grid lg:grid-cols-[1fr_1.1fr] lg:gap-20 lg:items-start">

              {/* Text */}
              <Reveal>
                <StepPill n="01" label="Your Profile" />
                <h2 className="font-headline text-[40px] lg:text-[50px] font-black italic tracking-tighter leading-[0.92] text-light mb-6">
                  Build your<br />organiser profile.
                </h2>
                <p className="text-muted text-[16px] leading-relaxed mb-5">
                  Before your first event goes live, set up your organiser profile. Athletes don&apos;t just sign up for events — they choose organisers they trust.
                </p>
                <p className="text-muted text-[16px] leading-relaxed mb-8">
                  Upload your logo, write a short bio, and link your website and socials. Your profile appears on every event you list, building credibility with every click.
                </p>
                <div className="space-y-3 mb-8">
                  {[
                    { icon: UserCircle2, text: "Your logo on every event card"     },
                    { icon: Star,        text: "Bio & credentials for athletes"    },
                    { icon: Globe,       text: "Website, Instagram & Facebook"     },
                    { icon: BarChart2,   text: "Boosts event visibility in search" },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-headline text-[13px] font-bold uppercase tracking-wide text-white/70">{text}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3.5 rounded-xl bg-primary/10 border border-primary/30 flex items-start gap-3">
                  <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-[13px] text-muted leading-relaxed">
                    <span className="font-semibold text-light">Profiles with logos get 3× more clicks.</span>{" "}
                    Takes under 5 minutes to complete.
                  </p>
                </div>
              </Reveal>

              {/* Profile card mockup */}
              <Reveal delay={150}>
                <div className="mt-12 lg:mt-0">
                  <Card className="overflow-hidden shadow-xl border-dark-lighter">
                    {/* Cover */}
                    <div className="h-32 bg-gradient-to-br from-lime-100 to-lime-50 relative overflow-hidden">
                      <div className="absolute inset-0 opacity-25"
                        style={{ backgroundImage: "repeating-linear-gradient(45deg, #84cc16 0, #84cc16 1px, transparent 0, transparent 50%)", backgroundSize: "10px 10px" }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-headline text-[11px] uppercase tracking-widest text-primary/50 select-none">Cover Photo</span>
                      </div>
                    </div>
                    <CardContent className="px-6 pb-6 -mt-8 relative">
                      <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center font-headline font-black italic text-2xl text-white shadow-lg mb-3 border-[3px] border-white">
                        E
                      </div>
                      <div className="font-headline text-[20px] font-black italic tracking-tight text-light leading-tight">Endurance Events AU</div>
                      <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark mt-1 mb-4">
                        Sydney, NSW · Est. 2019
                      </div>
                      <p className="text-muted text-[13px] leading-relaxed mb-5">
                        Australia&apos;s leading ultra-distance event series, specialising in trail running and hybrid events across all states.
                      </p>
                      <div className="grid grid-cols-3 gap-3 mb-5">
                        {[{ v: "12", l: "Events" }, { v: "3.2K", l: "Athletes" }, { v: "4.8★", l: "Rating" }].map(({ v, l }) => (
                          <div key={l} className="bg-dark-light border border-dark-lighter rounded-xl p-3 text-center">
                            <div className="font-headline text-[20px] font-black italic tracking-tighter text-primary">{v}</div>
                            <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">{l}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        {["Website", "Instagram", "Facebook"].map(l => (
                          <div key={l} className="flex-1 py-2 rounded-lg border border-dark-lighter text-center font-headline text-[10px] uppercase tracking-widest text-muted hover:border-primary hover:text-primary transition-colors cursor-pointer">
                            {l}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </Reveal>

            </div>
          </section>

          <StepDivider />

          {/* ── STEP 2: Create listing ───────────────────────────────────── */}
          <section className="py-20 lg:py-24">
            <div className="lg:grid lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:items-start">

              {/* Form mockup */}
              <Reveal delay={80} className="order-2 lg:order-1">
                <Card className="overflow-hidden shadow-xl border-dark-lighter">
                  {/* Progress */}
                  <div className="px-6 pt-5 pb-4 border-b border-white/[0.05] bg-dark-light/50">
                    <div className="flex items-center gap-1.5 mb-2.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${s <= 2 ? "bg-primary" : "bg-dark-lighter"}`} />
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-headline text-[11px] uppercase tracking-widest text-muted-dark">Step 2 of 5</span>
                      <span className="font-headline text-[11px] uppercase tracking-widest text-primary font-bold">Event Details</span>
                    </div>
                  </div>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark mb-1.5">Event Title</div>
                      <div className="bg-dark-light border border-dark-lighter rounded-lg px-4 py-3 text-[14px] text-light font-medium">
                        Ultra Trail Hobart 2026
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark mb-1.5">Date</div>
                        <div className="bg-dark-light border border-dark-lighter rounded-lg px-3 py-2.5 text-[13px] text-white/70 flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-primary shrink-0" /> 14 Mar 2026
                        </div>
                      </div>
                      <div>
                        <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark mb-1.5">Location</div>
                        <div className="bg-dark-light border border-dark-lighter rounded-lg px-3 py-2.5 text-[13px] text-white/70 flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" /> Hobart, TAS
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark mb-2">Discipline</div>
                      <div className="grid grid-cols-3 gap-2">
                        {[["Running", true], ["CrossFit", false], ["Cycling", false]].map(([d, sel]) => (
                          <div key={d as string}
                            className={`rounded-lg px-3 py-2.5 text-center font-headline text-[11px] font-bold uppercase tracking-widest border transition-colors
                              ${sel ? "bg-primary/10 border-primary text-primary" : "bg-dark border-dark-lighter text-muted-dark"}`}>
                            {d as string}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl bg-dark-light border border-dark-lighter p-4">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted">Ticket Wave 1</span>
                        <span className="font-headline text-[10px] uppercase tracking-widest text-primary font-bold cursor-pointer">+ Add Wave</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2 bg-dark border border-dark-lighter rounded-lg px-3 py-2.5 text-[13px] text-muted">General Entry</div>
                        <div className="bg-dark border border-primary rounded-lg px-3 py-2.5 text-[13px] text-primary text-center font-semibold">A$149</div>
                      </div>
                    </div>
                    <div className="w-full bg-primary hover:brightness-95 transition-colors rounded-xl py-3 text-white font-headline text-[12px] font-bold uppercase tracking-widest text-center flex items-center justify-center gap-2 cursor-pointer">
                      Save & Continue <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </CardContent>
                </Card>
              </Reveal>

              {/* Text */}
              <div className="order-1 lg:order-2 mb-12 lg:mb-0">
                <Reveal>
                  <StepPill n="02" label="Create a Listing" />
                  <h2 className="font-headline text-[40px] lg:text-[50px] font-black italic tracking-tighter leading-[0.92] text-light mb-6">
                    Create your<br />event listing.
                  </h2>
                  <p className="text-muted text-[16px] leading-relaxed mb-5">
                    Use our guided five-step form to build your listing. Enter your event details, venue, ticket categories and what&apos;s included — everything an athlete needs to decide and register.
                  </p>
                  <p className="text-muted text-[16px] leading-relaxed mb-8">
                    Save a draft at any stage and come back later. Your listing won&apos;t go live until you choose to submit for review.
                  </p>
                  <div className="space-y-3">
                    {[
                      { icon: FileEdit, text: "Guided five-step form"                        },
                      { icon: Calendar, text: "Event date, start & end time, venue"           },
                      { icon: Ticket,   text: "Multiple ticket waves & pricing"               },
                      { icon: Layers,   text: "Divisions & categories (Running, Cycling, Swimming)" },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-headline text-[13px] font-bold uppercase tracking-wide text-white/70">{text}</span>
                      </div>
                    ))}
                  </div>
                </Reveal>
              </div>

            </div>
          </section>

          <StepDivider />

          {/* ── STEP 3: Review ──────────────────────────────────────────── */}
          <section className="py-20 lg:py-24">
            <div className="lg:grid lg:grid-cols-[1fr_1.1fr] lg:gap-20 lg:items-start">

              {/* Text */}
              <Reveal>
                <StepPill n="03" label="Submit for Review" />
                <h2 className="font-headline text-[40px] lg:text-[50px] font-black italic tracking-tighter leading-[0.92] text-light mb-6">
                  Submit for<br />review.
                </h2>
                <p className="text-muted text-[16px] leading-relaxed mb-5">
                  When you&apos;re happy with your listing, hit submit. Our team reviews every event for accuracy and community standards — usually within 48 hours.
                </p>
                <p className="text-muted text-[16px] leading-relaxed mb-8">
                  You&apos;ll receive an email the moment your event is approved and goes live on the platform. From there, athletes can find and register immediately.
                </p>
                <div className="space-y-3">
                  {[
                    { icon: Clock,      text: "Average review time under 48 hours" },
                    { icon: CheckCheck, text: "Accuracy & community standards check" },
                    { icon: Mail,       text: "Email notification on approval"      },
                    { icon: FileEdit,   text: "Edit anytime before you submit"      },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-headline text-[13px] font-bold uppercase tracking-wide text-white/70">{text}</span>
                    </div>
                  ))}
                </div>
              </Reveal>

              {/* Review + email mockup */}
              <Reveal delay={150}>
                <div className="mt-12 lg:mt-0 space-y-4">
                  <Card className="overflow-hidden shadow-xl border-dark-lighter">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <span className="font-headline text-[15px] font-black italic tracking-tight text-light">Ultra Trail Hobart 2026</span>
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 font-headline text-[10px] font-bold uppercase tracking-widest">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Under Review
                        </span>
                      </div>
                      {/* Timeline */}
                      <div className="relative pl-7">
                        <div className="absolute left-3 top-1 bottom-1 w-px bg-dark-lighter" />
                        {[
                          { text: "Listing submitted",        sub: "Today at 9:41 am",  done: true,  active: false },
                          { text: "Details verified",          sub: "Today at 10:02 am", done: true,  active: false },
                          { text: "Community standards check", sub: "In progress",       done: false, active: true  },
                          { text: "Approved & published",      sub: "Pending",           done: false, active: false },
                        ].map(({ text, sub, done, active }) => (
                          <div key={text} className="relative flex items-start gap-3 mb-6 last:mb-0">
                            <div className={`absolute -left-4 w-5 h-5 rounded-full flex items-center justify-center border-2 shrink-0 mt-0.5
                              ${done ? "bg-primary border-lime-500" : active ? "bg-dark border-blue-400" : "bg-dark border-dark-lighter"}`}>
                              {done && <CheckCircle2 className="w-3 h-3 text-white" />}
                              {active && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
                            </div>
                            <div>
                              <div className={`font-headline text-[12px] font-bold uppercase tracking-widest ${done ? "text-primary" : active ? "text-light" : "text-muted-dark"}`}>{text}</div>
                              <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-0.5">{sub}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Email notification */}
                  <div className="rounded-xl border border-dark-lighter bg-dark overflow-hidden shadow-sm">
                    <div className="flex items-center gap-3 px-4 py-3 bg-dark-light border-b border-white/[0.05]">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="font-headline text-[12px] font-bold text-light">
                          Startline &nbsp;<span className="text-muted-dark font-normal text-[11px]">hello@startlineau.com.au</span>
                        </div>
                        <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">
                          Your event is approved and live!
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3.5">
                      <p className="text-[13px] text-muted leading-relaxed">
                        <span className="font-semibold text-light">Ultra Trail Hobart 2026</span> is now live on Startline and visible to athletes across Australia. 🎉
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>

            </div>
          </section>

          <StepDivider />

          {/* ── STEP 4: Go live ─────────────────────────────────────────── */}
          <section className="py-20 lg:py-24">

            <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-end mb-10">
              <Reveal>
                <StepPill n="04" label="Go Live" />
                <h2 className="font-headline text-[40px] lg:text-[50px] font-black italic tracking-tighter leading-[0.92] text-light mb-5">
                  Watch it go live<br />on Startline.
                </h2>
                <p className="text-muted text-[16px] leading-relaxed max-w-[420px]">
                  Once approved, your event is instantly visible to thousands of athletes searching for their next race. Here&apos;s exactly how it looks across the platform.
                </p>
              </Reveal>

              {/* Tab toggle */}
              <Reveal delay={80} className="flex lg:justify-end items-end mt-8 lg:mt-0 pb-1">
                <div className="flex gap-2">
                  {(["home", "events"] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg border transition-all duration-200
                        ${activeTab === tab
                          ? "bg-primary text-dark border-lime-500 shadow-sm"
                          : "bg-dark border-dark-lighter text-muted hover:border-primary hover:text-primary"}`}>
                      {tab === "home" ? "Homepage" : "Events Page"}
                    </button>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Full-width browser mockup */}
            <Reveal delay={60}>
              <BrowserFrame url={activeTab === "home" ? "startlineau.com.au" : "startlineau.com.au/events"}>
                <div className="bg-[#0f0f0f] overflow-hidden">
                  {/* Mock nav */}
                  <div className="flex items-center justify-between px-6 py-3 bg-[#0a0a0a] border-b border-white/[0.06]">
                    <Image src="/images/logo-title.svg" alt="Startline" width={90} height={22} className="h-5 w-auto opacity-90" />
                    <div className="hidden md:flex items-center gap-5">
                      {["Events", "By State", "By Type", "About"].map(l => (
                        <span key={l} className="font-headline text-[10px] uppercase tracking-widest text-white/30">{l}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <Search className="w-3.5 h-3.5 text-white/25" />
                      <div className="px-3 py-1.5 rounded-lg bg-primary/15 border border-lime-500/25">
                        <span className="font-headline text-[9px] uppercase tracking-widest text-primary/80 font-bold">Sign In</span>
                      </div>
                    </div>
                  </div>

                  {/* ── HOME TAB ── */}
                  {activeTab === "home" && (
                    <div>
                      {/* Hero */}
                      <div className="relative px-8 pt-[3.5rem] pb-12 overflow-hidden"
                        style={{ background: "linear-gradient(135deg, #0a1a04 0%, #111305 40%, #0f0f0f 70%)" }}>
                        <div className="absolute inset-0 opacity-20"
                          style={{ backgroundImage: "radial-gradient(ellipse at 75% 40%, #65a30d 0%, transparent 55%)" }} />
                        <div className="relative">
                          <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full bg-primary/10 border border-lime-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            <span className="font-headline text-[9px] uppercase tracking-widest text-primary/80 font-bold">Australia&apos;s Competitive Fitness Calendar</span>
                          </div>
                          <h3 className="font-headline text-[36px] font-black italic tracking-tighter leading-[0.9] text-white mb-4">
                            Find Your<br /><span className="text-primary/80">Start Line.</span>
                          </h3>
                          <p className="text-white/40 text-[13px] leading-relaxed mb-6 max-w-xs">
                            Discover CrossFit, running, cycling and hybrid events across Australia.
                          </p>
                          {/* Search */}
                          <div className="flex gap-2 max-w-md mb-5">
                            <div className="flex-1 bg-dark/8 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-2">
                              <Search className="w-3.5 h-3.5 text-white/20 shrink-0" />
                              <span className="font-headline text-[11px] text-white/20 uppercase tracking-widest">Search events…</span>
                            </div>
                            <div className="px-5 py-3 rounded-xl bg-primary flex items-center cursor-pointer">
                              <span className="font-headline text-[11px] uppercase tracking-widest text-white font-bold">Search</span>
                            </div>
                          </div>
                          {/* Category pills */}
                          <div className="flex gap-2 flex-wrap">
                            {["CrossFit", "Running", "Hybrid", "Cycling", "Swimming"].map((t, i) => (
                              <div key={t}
                                className={`px-3 py-1.5 rounded-full border font-headline text-[9px] uppercase tracking-widest cursor-pointer transition-colors
                                  ${i === 1 ? "bg-primary/20 border-lime-500/40 text-primary/80" : "border-white/10 text-white/30 hover:border-white/20"}`}>
                                {t}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Events section */}
                      <div className="px-8 py-7 bg-[#0f0f0f]">
                        <div className="flex items-center justify-between mb-5">
                          <div>
                            <div className="font-headline text-[9px] uppercase tracking-[0.2em] text-primary mb-1">Trending Now</div>
                            <span className="font-headline text-[16px] font-black italic tracking-tight text-white">Most Popular Events</span>
                          </div>
                          <span className="font-headline text-[10px] uppercase tracking-widest text-primary/80 flex items-center gap-0.5 cursor-pointer hover:text-primary/60 transition-colors">
                            View all <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <MockEventCard title="Ultra Trail Hobart 2026" type="Running" city="Hobart" state="TAS" date="14 Mar 2026" price="A$149" status="live" />
                          <MockEventCard title="Sydney Criterium Series" type="Cycling" city="Sydney" state="NSW" date="22 Mar 2026" price="A$89" />
                          <MockEventCard title="CrossFit Open Melbourne" type="CrossFit" city="Melbourne" state="VIC" date="5 Apr 2026" price="A$120" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── EVENTS TAB ── */}
                  {activeTab === "events" && (
                    <div className="flex" style={{ minHeight: 480 }}>
                      {/* Left panel — search + event list */}
                      <div className="w-60 border-r border-white/[0.06] flex flex-col shrink-0">
                        <div className="p-3 border-b border-white/[0.06] space-y-2">
                          <div className="bg-dark/5 border border-white/8 rounded-lg px-3 py-2.5 flex items-center gap-2">
                            <Search className="w-3.5 h-3.5 text-white/20 shrink-0" />
                            <span className="font-headline text-[10px] uppercase tracking-widest text-white/20">Search events…</span>
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            {["Running", "NSW", "2026"].map(c => (
                              <span key={c} className="px-2 py-0.5 rounded-full bg-primary/15 border border-lime-500/25 font-headline text-[8px] uppercase tracking-widest text-primary/80">{c}</span>
                            ))}
                          </div>
                        </div>
                        <div className="font-headline text-[9px] uppercase tracking-widest text-white/25 px-3 pt-3 pb-1.5">3 events found</div>
                        <div className="flex-1 overflow-hidden divide-y divide-white/[0.04]">
                          {[
                            { title: "Ultra Trail Hobart 2026", type: "Running",  date: "14 Mar", city: "Hobart, TAS",    sel: true  },
                            { title: "Sydney Criterium Series", type: "Cycling",  date: "22 Mar", city: "Sydney, NSW",    sel: false },
                            { title: "Qld Open Water Classic",  type: "Swimming", date: "1 Apr",  city: "Brisbane, QLD",  sel: false },
                          ].map(e => (
                            <div key={e.title}
                              className={`p-3 cursor-pointer transition-colors relative ${e.sel ? "bg-dark/[0.04]" : "hover:bg-dark/[0.02]"}`}>
                              {e.sel && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-r" />}
                              <div className={`font-headline text-[11px] font-black italic tracking-tight mb-1.5 leading-tight ${e.sel ? "text-white" : "text-white/50"}`}>{e.title}</div>
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-primary text-[#111] font-headline text-[7px] font-bold uppercase tracking-widest">{e.type}</span>
                                <span className="font-headline text-[9px] uppercase tracking-widest text-white/25">{e.date}</span>
                              </div>
                              <div className="font-headline text-[9px] uppercase tracking-widest text-white/20 mt-0.5">{e.city}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right panel — event detail */}
                      <div className="flex-1 overflow-hidden flex flex-col">
                        <div className="aspect-[16/7] bg-gradient-to-br from-[#1a3d08] to-[#080f03] relative flex-shrink-0">
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-0 left-0 p-6">
                            <span className="inline-block mb-2 px-2 py-0.5 rounded bg-primary text-[#111] font-headline text-[8px] font-bold uppercase tracking-widest">Running</span>
                            <h4 className="font-headline text-[22px] font-black italic tracking-tighter text-white leading-tight">
                              Ultra Trail<br />Hobart 2026
                            </h4>
                          </div>
                          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/15 border border-lime-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            <span className="font-headline text-[8px] uppercase tracking-widest text-primary/80 font-bold">Live</span>
                          </div>
                        </div>
                        <div className="flex-1 p-5 space-y-3">
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { l: "Date",     v: "14 Mar 2026" },
                              { l: "Location", v: "Hobart, TAS" },
                              { l: "From",     v: "A$149"       },
                            ].map(({ l, v }) => (
                              <div key={l} className="bg-dark/[0.04] rounded-lg p-3 border border-white/[0.06]">
                                <div className="font-headline text-[9px] uppercase tracking-widest text-white/30 mb-1">{l}</div>
                                <div className="font-headline text-[12px] font-black italic text-white leading-tight">{v}</div>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1 py-2.5 rounded-lg border border-white/10 font-headline text-[10px] uppercase tracking-widest text-white/40 text-center cursor-pointer hover:border-white/20 transition-colors">More Info</div>
                            <div className="flex-1 py-2.5 rounded-lg bg-primary font-headline text-[10px] uppercase tracking-widest text-[#111] text-center font-bold cursor-pointer hover:bg-primary transition-colors">Register Now</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </BrowserFrame>
            </Reveal>

            {/* Discovery callouts */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Eye,    title: "Homepage featured",       body: "New and upcoming events appear on the homepage, seen by every visitor."          },
                { icon: Search, title: "Search & filter",         body: "Athletes filter by discipline, state, date and format — matching to your event." },
                { icon: Award,  title: "Discipline pages",        body: "Your event is listed on dedicated CrossFit, Running, Cycling and Swimming pages." },
              ].map(({ icon: Icon, title, body }, i) => (
                <Reveal key={title} delay={i * 70}>
                  <Card className="hover:shadow-sm transition-shadow duration-200 h-full">
                    <CardContent className="p-5 flex items-start gap-3 h-full">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-headline text-[13px] font-black italic tracking-tight text-light mb-1">{title}</div>
                        <div className="text-muted text-[12px] leading-relaxed">{body}</div>
                      </div>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          </section>

        </div>

        {/* ── MANAGE — full-width grey band ───────────────────────────────── */}
        <div className="bg-dark border-y border-dark-lighter">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <Reveal>
              <Label>After You&apos;re Live</Label>
              <h2 className="font-headline text-[40px] lg:text-[48px] font-black italic tracking-tighter leading-[0.92] text-light mb-12">
                Manage everything<br />in one place.
              </h2>
            </Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: BarChart2, n: "01", title: "Track registrations",   body: "Live count of registrations across all your events from the dashboard."                 },
                { icon: FileEdit,  n: "02", title: "Edit anytime",           body: "Update pricing, dates, descriptions or images — changes reflect immediately."             },
                { icon: Ticket,    n: "03", title: "Multiple ticket tiers",  body: "Add early-bird, general and VIP waves with individual closing dates. Free events too."    },
                { icon: Layers,    n: "04", title: "Pin your best events",   body: "Pin flagship events to the top of your listing page for maximum visibility."              },
              ].map(({ icon: Icon, n, title, body }, i) => (
                <Reveal key={title} delay={i * 70}>
                  <Card className="h-full hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 group border-dark-lighter">
                    <CardContent className="p-6 flex flex-col gap-4 h-full">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-lime-100 transition-colors flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-headline text-[13px] font-black italic text-white/25">{n}</span>
                      </div>
                      <div>
                        <div className="font-headline text-[15px] font-black italic tracking-tight text-light mb-2">{title}</div>
                        <div className="text-muted text-[13px] leading-relaxed">{body}</div>
                      </div>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </div>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <div className="max-w-[1200px] mx-auto px-6">
          <section className="py-20">
            <Reveal>
              <div className="bg-dark border border-dark-lighter rounded-2xl p-12 lg:p-16 text-center shadow-sm overflow-hidden relative">
                {/* Subtle background accent */}
                <div className="absolute inset-0 opacity-[0.03]"
                  style={{ backgroundImage: "radial-gradient(ellipse at 50% 0%, #84cc16 0%, transparent 60%)" }} />
                <div className="relative">
                  <Label>Ready to go?</Label>
                  <h2 className="font-headline text-[48px] lg:text-[60px] font-black italic tracking-tighter leading-[0.92] text-light mb-4">
                    Race day starts<br /><span className="text-primary">here.</span>
                  </h2>
                  <p className="text-muted text-[17px] leading-relaxed mb-10 max-w-[440px] mx-auto">
                    Create your first listing in under 10 minutes. Set up your profile and our team will have you live in no time.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button asChild size="lg">
                      <Link href="/organiser/new-listing">
                        Create your first event <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline">
                      <Link href="/organiser/profile">
                        Complete your profile
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </Reveal>
          </section>
        </div>

      </main>
    </div>
  );
}
