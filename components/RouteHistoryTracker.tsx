"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Per-tab record of where the visitor has been inside the site. history.length
// cannot answer "did they arrive from one of our own pages": a fresh tab already
// counts the blank entry it opened on, so a direct visit is indistinguishable
// from a click-through. sessionStorage is per tab, survives a hard navigation
// between our pages, and starts empty in a new tab, which is exactly the
// distinction a back control needs.
const CURRENT = "startline:path";
const PREVIOUS = "startline:previous-path";

export function hasInAppHistory(): boolean {
  try {
    return !!sessionStorage.getItem(PREVIOUS);
  } catch {
    return false;
  }
}

export default function RouteHistoryTracker() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      const current = sessionStorage.getItem(CURRENT);
      if (current && current !== pathname) sessionStorage.setItem(PREVIOUS, current);
      sessionStorage.setItem(CURRENT, pathname);
    } catch {
      // Private windows and blocked site data: callers fall back to a plain link.
    }
  }, [pathname]);

  return null;
}
