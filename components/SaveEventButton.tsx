"use client";

import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

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
    if (loading) return;

    const next = !saved;
    setLoading(true);
    const ok = next ? await saveEventId(eventId) : await unsaveEventId(eventId);
    if (ok) setSaved(next);
    setLoading(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={toggle}
        disabled={loading}
        aria-label={saved ? "Unsave event" : "Save event"}
        title={saved ? "Remove from saved" : "Save event"}
        className={cn(
          "h-auto w-auto p-2 rounded-full transition-all",
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
