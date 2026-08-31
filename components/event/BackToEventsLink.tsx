"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { hasInAppHistory } from "@/components/RouteHistoryTracker";

// Stays an ordinary link to /events, so a direct visit, a new tab, middle click
// and the no-JS path all land on the listing. When the visitor reached this page
// from somewhere else on the site, the click steps back there instead: the
// organiser's page, search results, a home carousel.
export default function BackToEventsLink() {
  const router = useRouter();

  return (
    <Link
      href="/events"
      onClick={e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (!hasInAppHistory()) return;
        e.preventDefault();
        router.back();
      }}
      className="inline-flex items-center gap-2 font-headline text-xs font-bold uppercase tracking-widest border border-dark-lighter text-light hover:border-primary hover:text-primary px-4 py-2 rounded-full transition-colors mb-6"
    >
      <ArrowLeft className="w-3.5 h-3.5" /> Back to Events
    </Link>
  );
}
