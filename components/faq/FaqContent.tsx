"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { animate, splitText, stagger } from "animejs";
import { cn } from "@/lib/utils";

export type FaqItem = {
  q: string;
  a: string;
};

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Staggered word reveal via anime.js splitText.
 * `el` must not have React-managed text children — set text via the DOM first.
 */
function animateWordsIn(el: HTMLElement, delayStart = 0) {
  const split = splitText(el, { words: true });
  const words = (split.words ?? []) as HTMLElement[];

  if (!words.length) {
    el.style.opacity = "1";
    return () => {
      el.style.opacity = "1";
    };
  }

  for (const word of words) {
    word.style.opacity = "0";
    word.style.display = "inline-block";
  }

  const animation = animate(words, {
    opacity: [0, 1],
    translateY: [12, 0],
    duration: 520,
    ease: "out(3)",
    delay: stagger(26, { start: delayStart }),
  });

  return () => {
    try {
      animation.pause();
    } catch {
      /* ignore */
    }
    try {
      split.revert();
    } catch {
      /* ignore */
    }
    el.style.opacity = "1";
  };
}

function FaqTitle() {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const title = titleRef.current;
    if (!title) return;

    title.replaceChildren();
    const before = document.createElement("span");
    before.textContent = "Frequently Asked ";
    const accent = document.createElement("span");
    accent.className = "text-primary";
    accent.textContent = "Questions";
    title.append(before, accent);

    if (prefersReducedMotion()) {
      title.style.opacity = "1";
      return;
    }

    const cleanup = animateWordsIn(title, 0);
    const safetyTimer = window.setTimeout(() => {
      title.style.opacity = "1";
      title.querySelectorAll<HTMLElement>("span").forEach((w) => {
        w.style.opacity = "1";
        w.style.transform = "";
      });
    }, 1600);

    return () => {
      window.clearTimeout(safetyTimer);
      cleanup();
    };
  }, []);

  return (
    <h1
      ref={titleRef}
      aria-label="Frequently Asked Questions"
      className="font-headline text-[32px] sm:text-4xl font-black leading-none tracking-tighter text-light mb-10 text-center min-h-[2.5rem]"
    />
  );
}

function FaqAccordionItem({
  item,
  index,
  open,
  onToggle,
}: {
  item: FaqItem;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const buttonId = `${baseId}-button`;
  const cardRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    const question = questionRef.current;
    if (!card || !question) return;

    question.textContent = item.q;

    let cleanup: (() => void) | null = null;
    let done = false;
    let safetyTimer: number | undefined;

    const play = () => {
      if (done) return;
      done = true;
      if (prefersReducedMotion()) {
        question.style.opacity = "1";
        return;
      }
      cleanup = animateWordsIn(question, Math.min(index, 6) * 30);
      safetyTimer = window.setTimeout(() => {
        question.style.opacity = "1";
        question.querySelectorAll<HTMLElement>("span").forEach((w) => {
          w.style.opacity = "1";
          w.style.transform = "";
        });
      }, 1600);
    };

    const rect = card.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;

    let raf = 0;
    let io: IntersectionObserver | null = null;

    if (inView) {
      raf = window.requestAnimationFrame(play);
    } else {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            play();
            io?.disconnect();
          }
        },
        { rootMargin: "0px 0px -6% 0px", threshold: 0.1 },
      );
      io.observe(card);
    }

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      if (safetyTimer) window.clearTimeout(safetyTimer);
      io?.disconnect();
      cleanup?.();
      question.textContent = item.q;
      question.style.opacity = "1";
    };
  }, [item.q, index]);

  return (
    <div
      ref={cardRef}
      className="border border-dark-lighter rounded-xl bg-dark overflow-hidden"
    >
      <button
        id={buttonId}
        type="button"
        aria-label={item.q}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 p-6 text-left hover:bg-dark-lighter/40 transition-colors"
      >
        <span
          ref={questionRef}
          className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light"
        />
        <ChevronDown
          className={cn(
            "w-5 h-5 shrink-0 text-primary transition-transform duration-300",
            open && "rotate-180"
          )}
        />
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-6 text-[15px] text-light leading-relaxed">
            {item.a}
          </p>
        </div>
      </div>
    </div>
  );
}

function FaqList({ faqs }: { faqs: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {faqs.map((faq, i) => (
        <FaqAccordionItem
          key={faq.q}
          item={faq}
          index={i}
          open={openIndex === i}
          onToggle={() => setOpenIndex((prev) => (prev === i ? null : i))}
        />
      ))}
    </div>
  );
}

export default function FaqContent({ faqs }: { faqs: FaqItem[] }) {
  return (
    <main className="min-h-screen bg-dark-darker">
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="max-w-3xl mx-auto">
          <FaqTitle />
          <FaqList faqs={faqs} />
        </div>
      </section>
    </main>
  );
}
