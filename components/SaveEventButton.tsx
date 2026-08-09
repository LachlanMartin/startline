"use client";

import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { fetchSavedEventIds, saveEventId, unsaveEventId } from "@/lib/client-lists";
import { useAuthContext } from "@/context/AuthContext";
import SignInModal from "@/components/SignInModal";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SaveEventButtonProps {
  eventId: string;
  className?: string;
}

export default function SaveEventButton({ eventId, className = "" }: SaveEventButtonProps) {
  const { status } = useAuthContext();
  const [saved, setSaved] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  // A ref, not state: the guard has to be read synchronously so a double click
  // in the same tick can't fire two requests, and it must never disable the
  // button (that flashes the dimmed / not-allowed cursor mid-save).
  const pending = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    fetchSavedEventIds()
      .then((ids) => {
        if (!cancelled) setSaved(ids.includes(eventId));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status, eventId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (status !== "authenticated") {
      setSignInOpen(true);
      return;
    }
    if (pending.current) return;

    // Flip the heart straight away and roll back if the request fails, so the
    // control never sits in a dead state waiting on the network.
    const next = !saved;
    pending.current = true;
    setSaved(next);
    const ok = next ? await saveEventId(eventId) : await unsaveEventId(eventId);
    if (!ok) setSaved(!next);
    pending.current = false;
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-pressed={saved}
        aria-label={saved ? "Unsave event" : "Save event"}
        title={saved ? "Remove from saved" : "Save event"}
        className={cn(
          // chip-sm opts out of the global 44px mobile min-height, which
          // stretched this circle into an oval; the ::after ring restores the
          // 44px tap area without growing the visible button.
          "chip-sm relative h-auto w-auto p-2 rounded-full cursor-pointer transition-all",
          "after:absolute after:-inset-1.5 after:content-[''] lg:after:hidden",
          saved
            ? "text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary"
            : "text-muted hover:text-primary hover:bg-dark-light",
          className
        )}
      >
        <Heart className={cn("w-4 h-4", saved && "fill-primary")} />
      </Button>
      <SignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
    </>
  );
}
