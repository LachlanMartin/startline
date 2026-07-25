"use client";

import { useEffect, useState } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import SignInModal from "@/components/SignInModal";
import { useAuthContext } from "@/context/AuthContext";
import type { OrganiserPublicStats } from "@/lib/organiser-follows";

type Props = {
  organiserId: string;
  initialStats: OrganiserPublicStats;
};

function formatCount(n: number) {
  return n.toLocaleString("en-AU");
}

export default function OrganiserFollowSection({
  organiserId,
  initialStats,
}: Props) {
  const { status } = useAuthContext();
  const [stats, setStats] = useState(initialStats);
  const [following, setFollowing] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/organisers/${organiserId}/follow`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setFollowing(Boolean(data.following));
        setIsOwnProfile(Boolean(data.isOwnProfile));
        setStats({
          registrations: data.registrations ?? initialStats.registrations,
          followers: data.followers ?? initialStats.followers,
          eventsHosted: data.eventsHosted ?? initialStats.eventsHosted,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [organiserId, initialStats.registrations, initialStats.followers, initialStats.eventsHosted]);

  async function toggleFollow() {
    if (status !== "authenticated") {
      setSignInOpen(true);
      return;
    }
    if (busy || isOwnProfile) return;

    const next = !following;
    setBusy(true);
    setFollowing(next);
    setStats((s) => ({
      ...s,
      followers: Math.max(0, s.followers + (next ? 1 : -1)),
    }));

    try {
      const res = await fetch(`/api/public/organisers/${organiserId}/follow`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) {
        setFollowing(!next);
        setStats((s) => ({
          ...s,
          followers: Math.max(0, s.followers + (next ? -1 : 1)),
        }));
        return;
      }
      const data = await res.json();
      setFollowing(Boolean(data.following));
      setStats({
        registrations: data.registrations ?? stats.registrations,
        followers: data.followers ?? stats.followers,
        eventsHosted: data.eventsHosted ?? stats.eventsHosted,
      });
    } catch {
      setFollowing(!next);
      setStats((s) => ({
        ...s,
        followers: Math.max(0, s.followers + (next ? -1 : 1)),
      }));
    } finally {
      setBusy(false);
    }
  }

  const showFollow = !(isOwnProfile && status === "authenticated");

  return (
    <>
      <div className="flex items-end gap-4 sm:gap-5 ml-auto shrink-0">
        <div className="flex items-end gap-4 sm:gap-5">
          <div className="text-center">
            <div className="font-headline text-xl sm:text-2xl font-black tracking-tighter text-light leading-none">
              {formatCount(stats.registrations)}
            </div>
            <div className="font-headline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted mt-1">
              Registrations
            </div>
          </div>
          <div className="text-center">
            <div className="font-headline text-xl sm:text-2xl font-black tracking-tighter text-light leading-none">
              {formatCount(stats.followers)}
            </div>
            <div className="font-headline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted mt-1">
              Followers
            </div>
          </div>
          <div className="text-center">
            <div className="font-headline text-xl sm:text-2xl font-black tracking-tighter text-light leading-none">
              {formatCount(stats.eventsHosted)}
            </div>
            <div className="font-headline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted mt-1">
              Events hosted
            </div>
          </div>
        </div>

        {showFollow && (
          <Button
            type="button"
            variant={following ? "outline" : "default"}
            size="sm"
            disabled={busy}
            onClick={toggleFollow}
            aria-pressed={following}
            className="shrink-0"
          >
            {following ? (
              <>
                <UserCheck className="w-4 h-4" />
                Following
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Follow
              </>
            )}
          </Button>
        )}
      </div>

      <SignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
    </>
  );
}
