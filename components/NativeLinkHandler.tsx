"use client";

import { useEffect } from "react";
import { isNative, openExternal } from "@/lib/capacitor";

export default function NativeLinkHandler() {
  useEffect(() => {
    if (!isNative()) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element;
      const anchor = target.closest?.('a[target="_blank"]') as HTMLAnchorElement | null;
      const href = anchor?.getAttribute("href");
      if (!href) return;
      e.preventDefault();
      const url = new URL(href, window.location.origin).toString();
      openExternal(url);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
