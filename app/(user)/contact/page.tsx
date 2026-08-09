"use client";

import { useState } from "react";
import Link from "next/link";
import { Send, Check, RotateCcw } from "lucide-react";

const inputCls =
  "w-full bg-dark-light border border-dark-lighter rounded-[10px] px-[15px] py-3 text-[14.5px] text-light placeholder:text-muted-dark outline-none transition-[border-color,box-shadow] duration-180 focus:border-primary focus:shadow-[0_0_0_3px_rgba(179,225,83,0.1)]";

const labelCls =
  "font-headline font-bold text-[10.5px] uppercase tracking-[0.15em] text-muted";

export default function ContactPage() {
  const [name, setSubmitName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setSubmitError("Please fill out all fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setSubmitError("Please enter a valid email address.");
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
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error ?? "Could not send your message. Please try again."); return; }
      setSent(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitError("Could not send your message. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitName(""); setEmail(""); setSubject(""); setMessage("");
    setSubmitError(""); setSent(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-dark-darker">
      <main className="max-w-[600px] mx-auto px-8 pt-16 pb-32">

        {!sent ? (
          <>
            {/* Header */}
            <p className="font-headline font-bold text-[10px] uppercase tracking-[0.25em] text-primary mb-3.5">
              Contact
            </p>
            <h1 className="font-headline font-black italic text-[42px] tracking-[-0.04em] leading-[0.95] text-light mb-4">
              Say hello<br /><em className="text-primary not-italic">to the team.</em>
            </h1>
            <p className="text-[15px] text-muted leading-relaxed mb-11">
              Questions, partnership ideas, or just want to talk events? Drop us a line and we&apos;ll get back to you.
            </p>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[22px]">
              <div className="flex flex-col gap-2">
                <label htmlFor="c-name" className={labelCls}>
                  Name <span className="text-primary ml-0.5">*</span>
                </label>
                <input
                  id="c-name"
                  type="text"
                  value={name}
                  onChange={e => setSubmitName(e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                  className={inputCls}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="c-email" className={labelCls}>
                  Email <span className="text-primary ml-0.5">*</span>
                </label>
                <input
                  id="c-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={inputCls}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="c-subject" className={labelCls}>
                  Subject <span className="text-primary ml-0.5">*</span>
                </label>
                <input
                  id="c-subject"
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="How can we help?"
                  autoComplete="off"
                  className={inputCls}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="c-message" className={labelCls}>
                  Message <span className="text-primary ml-0.5">*</span>
                </label>
                <textarea
                  id="c-message"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="What&apos;s on your mind?"
                  rows={6}
                  className={`${inputCls} resize-none leading-relaxed`}
                  style={{ minHeight: 160 }}
                />
              </div>

              {submitError && (
                <p className="text-[13px] text-red-400 leading-relaxed">{submitError}</p>
              )}

              <div className="flex items-center justify-between gap-4 pt-1">
                <p className="text-[12.5px] text-muted-dark leading-relaxed">
                  We read every message.<br />
                  Response within one business day.
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 font-headline font-bold text-[11.5px] uppercase tracking-[0.13em] text-dark bg-machined shadow-machined px-[26px] py-[13px] rounded-[10px] shrink-0 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-[transform,box-shadow] duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-machined"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? "Sending…" : "Send Message"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            {/* Confirmation */}
            <div className="flex flex-col items-start">
              <div className="w-16 h-16 rounded-2xl bg-primary/[0.12] border border-primary/30 flex items-center justify-center mb-7">
                <Check className="w-7 h-7 text-primary" strokeWidth={2} />
              </div>

              <h1 className="font-headline font-black italic text-[42px] tracking-[-0.04em] leading-[0.95] text-light mb-1.5">
                Message<br /><em className="text-primary not-italic">sent.</em>
              </h1>
              <p className="text-[15px] text-muted leading-[1.65] mb-10 max-w-[460px]">
                Thanks for reaching out. Our team has been notified and will get back to you shortly.
              </p>

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 font-headline font-bold text-[11.5px] uppercase tracking-[0.13em] text-dark bg-machined shadow-machined px-[26px] py-[13px] rounded-[10px] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-[transform,box-shadow] duration-150"
                >
                  Back to Startline
                </Link>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 font-headline font-bold text-[11px] uppercase tracking-[0.13em] text-muted border border-dark-lighter px-[22px] py-3 rounded-[10px] hover:text-light hover:border-white/25 hover:bg-white/[0.04] transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Send Another
                </button>
              </div>
            </div>
          </>
        )}

      </main>
    </div>
  );
}
