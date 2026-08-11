"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { Upload, Send, RotateCcw, Check, File, X, ChevronDown } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type FeedbackType = "bug" | "feature" | "feedback" | "content" | "performance";

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug:         "Bug Report",
  feature:     "Feature Request",
  feedback:    "General Feedback",
  content:     "Content Issue",
  performance: "Performance Issue",
};

const SUBMIT_LABELS: Record<FeedbackType, string> = {
  bug:         "Submit Report",
  feature:     "Submit Request",
  feedback:    "Submit Feedback",
  content:     "Report Issue",
  performance: "Submit Report",
};

// ── Shared input classes ──────────────────────────────────────────────────────

const inputCls =
  "w-full bg-dark-light border border-dark-lighter rounded-[10px] px-[15px] py-3 text-[14.5px] text-light placeholder:text-muted-dark outline-none transition-[border-color,box-shadow] duration-180 focus:border-primary focus:shadow-[0_0_0_3px_rgba(179,225,83,0.1)]";

const labelCls =
  "font-headline font-bold text-[10.5px] uppercase tracking-[0.15em] text-muted";

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FeedbackForm() {
  const [view,          setView]          = useState<"form" | "confirm">("form");
  const [type,          setType]          = useState<FeedbackType>("bug");
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [files,         setFiles]         = useState<File[]>([]);
  const [dragOver,      setDragOver]      = useState(false);
  const [title,         setTitle]         = useState("");
  const [details,       setDetails]       = useState("");
  const [email,         setEmail]         = useState("");
  const [confirmRef,    setConfirmRef]    = useState("");
  const [submitted,     setSubmitted]     = useState<{ type: string; title: string; email: string; files: string[] } | null>(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState("");

  const titleRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const next = [...incoming].filter(f => {
      if (f.size > 10 * 1024 * 1024) return false;
      return !files.find(x => x.name === f.name);
    });
    setFiles(prev => [...prev, ...next]);
  }, [files]);

  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f.name !== name));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { titleRef.current?.focus(); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:      TYPE_LABELS[type],
          title:     title.trim(),
          details:   details.trim(),
          email:     email.trim() || undefined,
          filenames: files.map(f => f.name),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error ?? "Something went wrong. Please try again."); return; }
      setConfirmRef(data.ref);
      setSubmitted({ type: TYPE_LABELS[type], title: title.trim(), email: email.trim(), files: files.map(f => f.name) });
      setView("confirm");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitError("Could not send your report. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setTitle(""); setDetails(""); setEmail(""); setFiles([]); setType("bug");
    setSubmitted(null); setSubmitError(""); setView("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-dark-darker">
      <main className="max-w-[600px] mx-auto px-8 pt-16 pb-32">

        {/* ── FORM VIEW ── */}
        {view === "form" && (
          <>
            {/* Header */}
            <p className="font-headline font-bold text-[10px] uppercase tracking-[0.25em] text-primary mb-3.5">
              Contact
            </p>
            <h1 className="font-headline font-black italic text-[42px] tracking-[-0.04em] leading-[0.95] text-light mb-4">
              Tell us what&apos;s<br /><em className="text-primary not-italic">going on.</em>
            </h1>
            <p className="text-[15px] text-muted leading-relaxed mb-11">
              Spotted a bug, got a request, or just have something to say? We read every submission and triage within one business day.
            </p>

            {/* Type dropdown */}
            <div className="mb-7">
              <label className={`${labelCls} block mb-2`}>
                Type <span className="text-primary ml-0.5">*</span>
              </label>
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(o => !o)}
                  className={`w-full flex items-center justify-between gap-3 bg-dark-light border px-[15px] py-3 text-[14.5px] text-light cursor-pointer select-none transition-[border-color,box-shadow,border-radius] duration-200
                    ${dropdownOpen
                      ? "border-primary shadow-[0_0_0_3px_rgba(179,225,83,0.1)] rounded-t-[10px]"
                      : "border-dark-lighter rounded-[10px] hover:border-white/20"}`}
                >
                  <span>{TYPE_LABELS[type]}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-dark shrink-0 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute left-0 right-0 top-full z-50 bg-dark border border-primary border-t-0 rounded-b-[10px] shadow-[0_12px_32px_rgba(0,0,0,0.5)] overflow-hidden">
                    {(Object.keys(TYPE_LABELS) as FeedbackType[]).map((k, i, arr) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => { setType(k); setDropdownOpen(false); }}
                        className={`w-full flex items-center gap-3 px-[15px] py-[11px] text-[14px] text-left transition-colors
                          ${i < arr.length - 1 ? "border-b border-dark-lighter" : ""}
                          ${type === k
                            ? "text-primary bg-[rgba(179,225,83,0.06)]"
                            : "text-muted hover:bg-white/[0.04] hover:text-light"}`}
                      >
                        {TYPE_LABELS[k]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[22px]">

              {/* Title */}
              <div className="flex flex-col gap-2">
                <label htmlFor="f-title" className={labelCls}>
                  Title <span className="text-primary ml-0.5">*</span>
                </label>
                <input
                  ref={titleRef}
                  id="f-title"
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Brief description of the issue"
                  autoComplete="off"
                  className={inputCls}
                />
              </div>

              {/* Details */}
              <div className="flex flex-col gap-2">
                <label htmlFor="f-details" className={labelCls}>
                  Details <span className="text-primary ml-0.5">*</span>
                </label>
                <textarea
                  id="f-details"
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder="What happened? What did you expect? Include any steps to reproduce."
                  rows={5}
                  className={`${inputCls} resize-none leading-relaxed`}
                  style={{ minHeight: 140 }}
                />
              </div>

              {/* File upload */}
              <div className="flex flex-col gap-2">
                <label className={labelCls}>Screenshot or file</label>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-[1.5px] border-dashed rounded-xl px-5 py-7 text-center cursor-pointer transition-[border-color,background] duration-180
                    ${dragOver
                      ? "border-primary/50 bg-primary/[0.04]"
                      : "border-dark-lighter bg-dark-light hover:border-primary/50 hover:bg-primary/[0.04]"}`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt,.zip"
                    className="hidden"
                    onChange={e => { if (e.target.files) addFiles(e.target.files); }}
                  />
                  <div className="w-10 h-10 rounded-[10px] bg-dark-lighter flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-5 h-5 text-muted" />
                  </div>
                  <p className="font-headline font-bold text-[12px] uppercase tracking-[0.1em] text-light mb-1">
                    Drop files here or click to browse
                  </p>
                  <p className="text-[12.5px] text-muted-dark">PNG, JPG, PDF up to 10 MB</p>

                  {files.length > 0 && (
                    <div
                      className="mt-3.5 flex flex-col gap-1.5"
                      onClick={e => e.stopPropagation()}
                    >
                      {files.map(f => (
                        <div key={f.name} className="flex items-center gap-2.5 bg-dark border border-dark-lighter rounded-lg px-3 py-2.5 text-[13px] text-muted text-left">
                          <File className="w-3.5 h-3.5 shrink-0" />
                          <span className="flex-1 truncate">{f.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(f.name)}
                            className="text-muted-dark hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-dark-lighter" />

              {/* Email */}
              <div className="flex flex-col gap-2">
                <label htmlFor="f-email" className={labelCls}>Your email</label>
                <input
                  id="f-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="For follow-up (optional)"
                  autoComplete="email"
                  className={inputCls}
                />
              </div>

              {/* Error */}
              {submitError && (
                <p className="text-[13px] text-red-400 leading-relaxed">{submitError}</p>
              )}

              {/* Submit row */}
              <div className="flex items-center justify-between gap-4 pt-1">
                <p className="text-[12.5px] text-muted-dark leading-relaxed">
                  We never share your details.<br />
                  Response within one business day.
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 font-headline font-bold text-[11.5px] uppercase tracking-[0.13em] text-dark bg-machined shadow-machined px-[26px] py-[13px] rounded-[10px] shrink-0 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-[transform,box-shadow] duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-machined"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? "Sending…" : SUBMIT_LABELS[type]}
                </button>
              </div>

            </form>
          </>
        )}

        {/* ── CONFIRMATION VIEW ── */}
        {view === "confirm" && submitted && (
          <div className="flex flex-col items-start">
            {/* Icon chip */}
            <div className="w-16 h-16 rounded-2xl bg-primary/[0.12] border border-primary/30 flex items-center justify-center mb-7">
              <Check className="w-7 h-7 text-primary" strokeWidth={2} />
            </div>

            <h1 className="font-headline font-black italic text-[42px] tracking-[-0.04em] leading-[0.95] text-light mb-1.5">
              Report<br /><em className="text-primary not-italic">received.</em>
            </h1>
            <p className="font-headline font-bold text-[10.5px] uppercase tracking-[0.2em] text-muted-dark mb-6">
              REF #{confirmRef}
            </p>
            <p className="text-[15px] text-muted leading-[1.65] mb-10 max-w-[460px]">
              Thanks for taking the time. Our team has been notified and will review your submission shortly. If you included an email address, you&apos;ll hear back from us within one business day.
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
                Submit Another
              </button>
            </div>

            {/* Submission summary */}
            <div className="w-full mt-[52px] pt-8 border-t border-dark-lighter">
              <p className="font-headline font-bold text-[10px] uppercase tracking-[0.25em] text-primary mb-[18px]">
                Submission Summary
              </p>
              <div className="flex flex-col gap-3">
                {[
                  { key: "Type",  val: submitted.type },
                  { key: "Title", val: submitted.title },
                  ...(submitted.email ? [{ key: "Email", val: submitted.email }] : []),
                  ...(submitted.files.length ? [{ key: "Attachments", val: submitted.files.join(", ") }] : []),
                ].map(({ key, val }) => (
                  <div key={key} className="flex gap-5 items-baseline text-[13.5px]">
                    <span className="font-headline font-bold text-[10px] uppercase tracking-[0.15em] text-muted-dark w-[100px] shrink-0">
                      {key}
                    </span>
                    <span className="text-muted leading-relaxed">{val}</span>
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
