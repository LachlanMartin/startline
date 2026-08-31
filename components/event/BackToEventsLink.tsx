"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Stays an ordinary link to /events so new-tab, middle-click and the no-JS path
// still work. A plain click inside the app steps back to wherever the listing was
// opened from instead: the organiser's page, search results, a home carousel.
export default function BackToEventsLink() {
  const router = useRouter();

  return (
    <Link
      href="/events"
      onClick={e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (window.history.length <= 1) return;
        e.preventDefault();
        router.back();
      }}
      className="inline-flex items-center gap-2 font-headline text-xs font-bold uppercase tracking-widest border border-dark-lighter text-light hover:border-primary hover:text-primary px-4 py-2 rounded-full transition-colors mb-6"
    >
      <ArrowLeft className="w-3.5 h-3.5" /> Back to Events
    </Link>
  );
}
