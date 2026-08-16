"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Send, Mail } from "lucide-react";
import TurnstileWidget from "@/components/TurnstileWidget";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const inputCls =
  "w-full bg-dark-light border border-dark-lighter rounded-[10px] px-[15px] py-3 text-[14.5px] text-light placeholder:text-light/70 outline-none transition-[border-color,box-shadow] duration-180 focus:border-primary focus:shadow-[0_0_0_3px_rgba(179,225,83,0.1)]";

const labelCls =
  "font-headline font-bold text-[10.5px] uppercase tracking-[0.15em] text-light";

type Submitted = {
  name: string;
  email: string;
  subject: string;
};

export default function ContactForm() {
  const [view, setView] = useState<"form" | "confirm">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      nameRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          turnstileToken: turnstileToken ?? undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSubmitError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSubmitted({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
      });
      setView("confirm");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitError("Could not send your message. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-darker">
      <main className="max-w-[600px] mx-auto px-8 pt-16 pb-32 page-in">
        {view === "form" && (
          <>
            <h1 className="font-headline font-black italic text-[42px] tracking-[-0.04em] leading-[0.95] text-light mb-4">
              Send us a<br />
              <em className="text-primary not-italic">message.</em>
            </h1>
            <p className="text-[15px] text-light leading-relaxed mb-11">
              For all enquiries, please send us a message by filling out the form
              below. We aim to respond within 24 hours.
            </p>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[22px]">
              <div className="flex flex-col gap-2">
                <label htmlFor="c-name" className={labelCls}>
                  Name <span className="text-primary ml-0.5 text-[15px] leading-none">*</span>
                </label>
                <input
                  ref={nameRef}
                  id="c-name"
                  name="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  required
                  className={inputCls}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="c-email" className={labelCls}>
                  Email <span className="text-primary ml-0.5 text-[15px] leading-none">*</span>
                </label>
                <input
                  id="c-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                  required
                  className={inputCls}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="c-subject" className={labelCls}>
                  Subject <span className="text-primary ml-0.5 text-[15px] leading-none">*</span>
                </label>
                <input
                  id="c-subject"
                  name="subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What is this about?"
                  autoComplete="off"
                  required
                  className={inputCls}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="c-message" className={labelCls}>
                  Message <span className="text-primary ml-0.5 text-[15px] leading-none">*</span>
                </label>
                <textarea
                  id="c-message"
                  name="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we help?"
                  rows={6}
                  required
                  className={`${inputCls} resize-none leading-relaxed`}
                  style={{ minHeight: 160 }}
                />
              </div>

              {submitError && (
                <p className="text-[13px] text-red-400 leading-relaxed" role="alert">
                  {submitError}
                </p>
              )}

              {TURNSTILE_SITE_KEY && (
                <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onTokenChange={setTurnstileToken} />
              )}

              <div className="flex items-center justify-end pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 font-headline font-bold text-[11.5px] uppercase tracking-[0.13em] text-dark bg-machined shadow-machined px-[26px] py-[13px] rounded-[10px] shrink-0 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-[transform,box-shadow] duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-machined"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? "Sending…" : "Send Message"}
                </button>
              </div>

              <div className="mt-2 pt-6 border-t border-dark-lighter">
                <div className="flex items-center gap-3.5 rounded-[12px] border border-dark-lighter bg-dark px-4 py-4">
                  <div className="w-10 h-10 rounded-[10px] bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-headline font-bold text-[10.5px] uppercase tracking-[0.18em] text-light mb-1">
                      Startline contact
                    </p>
                    <a
                      href="mailto:admin@startlineau.com"
                      className="font-headline text-[15px] font-bold text-light hover:text-primary transition-colors break-all"
                    >
                      admin@startlineau.com
                    </a>
                  </div>
                </div>
              </div>
            </form>
          </>
        )}

        {view === "confirm" && submitted && (
          <div className="flex flex-col items-start">
            <h1 className="font-headline font-black italic text-[42px] tracking-[-0.04em] leading-[0.95] text-light mb-4">
              Message<br />
              <em className="text-primary not-italic">sent.</em>
            </h1>
            <p className="text-[15px] text-light leading-[1.65] mb-10 max-w-[460px]">
              Thanks for getting in touch. Our team has been notified and will
              get back to you at{" "}
              <strong className="font-bold text-light">{submitted.email}</strong> within 24 hours.
            </p>

            <Link
              href="/"
              className="inline-flex items-center gap-2 font-headline font-bold text-[11.5px] uppercase tracking-[0.13em] text-dark bg-machined shadow-machined px-[26px] py-[13px] rounded-[10px] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-[transform,box-shadow] duration-150"
            >
              Back to the Startline
            </Link>

            <div className="w-full mt-[52px] pt-8 border-t border-dark-lighter">
              <p className="font-headline font-bold text-[10px] uppercase tracking-[0.25em] text-primary mb-[18px]">
                Message Summary
              </p>
              <div className="flex flex-col gap-3">
                {[
                  { key: "Name", val: submitted.name },
                  { key: "Email", val: submitted.email },
                  { key: "Subject", val: submitted.subject },
                ].map(({ key, val }) => (
                  <div key={key} className="flex gap-5 items-baseline text-[13.5px]">
                    <span className="font-headline font-bold text-[10px] uppercase tracking-[0.15em] text-light w-[100px] shrink-0">
                      {key}
                    </span>
                    <span className={`text-light leading-relaxed ${key === "Email" ? "font-bold" : ""}`}>
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
