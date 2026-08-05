import Link from "next/link";
import { ArrowRight, Clock, Layers, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

// Mirrors the real wizard's steps in app/organiser/new-listing/page.tsx (STEPS).
const STEPS = [
  {
    title: "The Basics",
    desc: "Give your event a name, pick the discipline and format, and set how many athletes you can fit.",
    need: "event name · discipline · participant cap",
  },
  {
    title: "Date & Location",
    desc: "Tell athletes where and when it's happening — venue address, date and start time.",
    need: "venue address · date & time",
  },
  {
    title: "Tickets & Pricing",
    desc: "Set up at least one ticket category and price so athletes can register. You can add more — like early bird — later.",
    need: "price · entry categories",
  },
  {
    title: "Media & Description",
    desc: "Add a cover photo and describe your event so athletes know exactly what to expect.",
    need: "one photo · short description",
  },
  {
    title: "Final Review",
    desc: "Check everything over on one screen, then publish when you're happy with it.",
    need: "nothing — just a once-over",
  },
];

export default function WizardGuidePage() {
  return (
    <div className="min-h-screen bg-dark-darker">
      <main className="pt-14">
        <div className="max-w-[640px] mx-auto px-5 sm:px-6 py-11 sm:py-16 pb-24 page-in">

          <div className="flex items-center gap-2 font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-3.5">
            <Layers className="w-3 h-3" strokeWidth={2.5} /> Before you start
          </div>
          <h1 className="font-headline text-[clamp(32px,5vw,46px)] font-black italic tracking-tighter leading-[0.96] text-light mb-4">
            Let&apos;s build<br />your <span className="text-primary">first event.</span>
          </h1>
          <p className="text-[16px] text-muted max-w-[480px] leading-relaxed mb-5">
            Five short steps — that&apos;s all it takes to get an event live. You can save a
            draft and come back anytime, so nothing needs to be perfect on the first pass.
          </p>

          <div className="inline-flex items-center gap-2 bg-dark border border-dark-lighter rounded-full py-2 pl-3 pr-4 font-headline text-[11px] font-bold uppercase tracking-widest text-muted mb-11">
            <Clock className="w-3.5 h-3.5 text-primary" strokeWidth={2.2} /> About 10 minutes
          </div>

          {/* Steps */}
          <div className="mb-9">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className={`flex gap-3.5 sm:gap-5 py-6 first:pt-0 ${i < STEPS.length - 1 ? "border-b border-white/[0.06]" : ""}`}
              >
                <div className="shrink-0 w-10 h-10 sm:w-[46px] sm:h-[46px] rounded-xl bg-dark border border-dark-lighter flex items-center justify-center font-headline font-bold italic text-[17px] sm:text-[20px] text-primary tracking-tight">
                  {i + 1}
                </div>
                <div className="flex-1 pt-0.5">
                  <div className="font-headline text-[18px] font-bold text-light mb-1.5">{step.title}</div>
                  <p className="text-sm text-muted leading-relaxed mb-3">{step.desc}</p>
                  <div className="inline-flex items-center gap-1.5 font-headline text-[10.5px] font-bold uppercase tracking-widest text-muted-dark bg-dark-light border border-dark-lighter rounded-lg px-[11px] py-1.5">
                    Have ready: <b className="text-muted font-bold">{step.need}</b>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Reassurance */}
          <div className="flex items-start gap-3 bg-primary/10 border border-primary/20 rounded-[14px] px-[18px] py-4 mb-9">
            <ShieldCheck className="shrink-0 w-[18px] h-[18px] text-primary mt-0.5" strokeWidth={2.2} />
            <p className="text-[13.5px] text-light leading-relaxed">
              Nothing goes live until you hit <strong className="text-primary font-semibold">Publish</strong>.
              You can save a draft at any step and pick it back up whenever suits.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col items-center gap-4">
            <Button asChild size="lg" className="w-full h-[52px]">
              <Link href="/organiser/new-listing">
                Start creating your event <ArrowRight className="w-4 h-4" strokeWidth={2.4} />
              </Link>
            </Button>
            <Link
              href="/organiser/dashboard"
              className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted-dark hover:text-muted transition-colors"
            >
              I&apos;ll do this later
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}
