"use client";

import { useState } from "react";
import { Check, Copy, Facebook, Link2, Mail, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShareEventButtonProps {
  eventId: string;
  title: string;
  className?: string;
}

function eventUrl(eventId: string) {
  if (typeof window === "undefined") return `/events/${eventId}`;
  return `${window.location.origin}/events/${eventId}`;
}

export default function ShareEventButton({ eventId, title, className = "" }: ShareEventButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = eventUrl(eventId);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function toggleMenu() {
    setOpen((v) => !v);
  }

  async function nativeShare() {
    const url = eventUrl(eventId);
    // Prefer the explicit menu in desktop browsers so Copy link is always available.
    if (navigator.share && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
      try {
        await navigator.share({ title, text: title, url });
        setOpen(false);
        return;
      } catch {
        // User cancelled or share failed — fall through to menu
      }
    }
    toggleMenu();
  }

  const url = typeof window !== "undefined" ? eventUrl(eventId) : `/events/${eventId}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={nativeShare}
        aria-label="Share event"
        title="Share event"
        aria-expanded={open}
        className="h-auto w-auto p-2 rounded-full text-muted hover:text-primary hover:bg-dark-light transition-all"
      >
        <Share2 className="w-4 h-4" />
      </Button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close share menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 bottom-full mb-2 z-50 min-w-[200px] rounded-xl border border-dark-lighter bg-dark-darker shadow-2xl overflow-hidden">
            <button
              type="button"
              onClick={copyLink}
              className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[12px] font-bold uppercase tracking-widest text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
              {copied ? "Link copied" : "Copy link"}
            </button>
            <a
              href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[12px] font-bold uppercase tracking-widest text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Link2 className="w-4 h-4" />
              Share on X
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[12px] font-bold uppercase tracking-widest text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Facebook className="w-4 h-4" />
              Facebook
            </a>
            <a
              href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[12px] font-bold uppercase tracking-widest text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              WhatsApp
            </a>
            <a
              href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`}
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[12px] font-bold uppercase tracking-widest text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Email
            </a>
          </div>
        </>
      )}
    </div>
  );
}
