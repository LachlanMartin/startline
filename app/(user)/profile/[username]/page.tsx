import Image from "next/image";
import Link from "next/link";
import { MapPin, User } from "lucide-react";
import { STATE_LABELS } from "@/types";
import type { AustralianState } from "@/types";
import { formatDiscipline, formatMediumDate } from "@/lib/utils";

interface PublicProfilePageProps {
  params: Promise<{ username: string }>;
}

async function getProfile(username: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/user/profile/${username}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

interface Registration {
  id: string;
  eventId: string;
  category: string | null;
  resultDistance: string | null;
  resultTime: string | null;
  resultPlacement: string | null;
  isPersonalBest: boolean;
  isTopResult: boolean;
  event: { title: string; discipline: string; eventDate: string; city: string; state: string };
}

interface Profile {
  id: string;
  name: string | null;
  username: string;
  bio: string | null;
  profilePicUrl: string | null;
  isPublic: boolean;
  city: string | null;
  state: string | null;
  createdAt: string;
  registrations: Registration[];
}

function getInitials(name: string | null, username: string): string {
  const source = (name?.trim() || username).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params;
  const profile: Profile | null = await getProfile(username);

  if (!profile) {
    return (
      <main className="min-h-screen bg-dark-darker flex items-center justify-center pt-20">
        <div className="text-center">
          <User className="w-16 h-16 text-muted mx-auto mb-4" />
          <h1 className="font-headline text-3xl font-black italic tracking-tighter text-light mb-2">
            Profile not found
          </h1>
          <p className="text-muted text-sm mb-6">This user doesn&apos;t exist or their profile is private.</p>
          <Link href="/" className="font-headline text-xs font-bold uppercase tracking-widest text-primary hover:underline">
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  const initials = getInitials(profile.name, profile.username);
  const location = [profile.city, profile.state ? STATE_LABELS[profile.state as AustralianState] : null]
    .filter(Boolean)
    .join(", ");
  const memberSince = new Date(profile.createdAt).getFullYear();
  const metaLine = [location, `Racing since ${memberSince}`].filter(Boolean).join(" · ");
  const withResults = profile.registrations.filter(
    (r) => r.resultTime || r.resultPlacement
  );

  return (
    <main className="min-h-screen bg-dark-darker pt-14">
      <div className="relative h-[190px] overflow-hidden bg-gradient-to-br from-dark via-dark-lighter to-dark-darker">
        <div className="absolute inset-0 placeholder-stripes scan-grid opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-dark-darker/35 to-transparent" />
      </div>

      <div className="max-w-[1240px] mx-auto px-8 pb-24">
        <div className="flex items-end gap-6 -mt-[52px] relative z-[2] flex-wrap">
          <div className="relative w-28 h-28 rounded-full bg-dark border-[3px] border-dark-darker outline outline-1 outline-dark-lighter flex items-center justify-center shrink-0 overflow-hidden">
            {profile.profilePicUrl ? (
              <Image
                src={profile.profilePicUrl}
                alt={profile.name ?? profile.username}
                fill
                className="pointer-events-none object-cover"
                sizes="112px"
              />
            ) : (
              <span className="font-headline font-black italic text-[40px] text-primary leading-none">
                {initials}
              </span>
            )}
          </div>

          <div className="pb-1 min-w-0">
            <h1
              className="font-headline font-black italic tracking-tighter text-light leading-[1.02]"
              style={{ fontSize: "clamp(32px, 4vw, 44px)" }}
            >
              {profile.name ?? profile.username}
            </h1>
            <p className="flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-[0.16em] text-muted mt-2.5">
              <MapPin className="w-[13px] h-[13px] text-primary shrink-0" />
              {metaLine}
            </p>
          </div>
        </div>

        {profile.bio && (
          <p className="text-muted text-[15px] leading-relaxed mt-6 max-w-[640px]">{profile.bio}</p>
        )}

        <section className="mt-12">
          <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-4">
            Race history
          </h2>
          {withResults.length === 0 ? (
            <p className="text-[14px] text-muted-dark">No recorded results yet.</p>
          ) : (
            <div className="overflow-x-auto border border-dark-lighter rounded-xl bg-dark">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr className="border-b border-dark-lighter">
                    {["Event", "Discipline", "Date", "Division", "Time", "Place"].map((h) => (
                      <th
                        key={h}
                        className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark text-left px-3.5 py-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {withResults.map((reg) => (
                    <tr key={reg.id} className="border-b border-dark-lighter last:border-0">
                      <td className="py-4 px-3.5">
                        <Link
                          href={`/events/${reg.eventId}`}
                          className="font-headline text-[14px] font-bold italic tracking-tighter text-light hover:text-primary transition-colors"
                        >
                          {reg.event.title}
                        </Link>
                      </td>
                      <td className="py-4 px-3.5">
                        <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5">
                          {formatDiscipline(reg.event.discipline)}
                        </span>
                      </td>
                      <td className="py-4 px-3.5 font-headline text-[12px] text-muted whitespace-nowrap">
                        {formatMediumDate(reg.event.eventDate)}
                      </td>
                      <td className="py-4 px-3.5 font-headline text-[13px] text-muted-light whitespace-nowrap">
                        {reg.category?.trim() || reg.resultDistance || "—"}
                      </td>
                      <td className="py-4 px-3.5 font-headline text-[13px] font-bold text-light whitespace-nowrap">
                        {reg.resultTime ?? "—"}
                        {reg.isPersonalBest && (
                          <span className="ml-1.5 font-black text-primary text-[10px] uppercase tracking-widest">PB</span>
                        )}
                      </td>
                      <td className={`py-4 px-3.5 font-headline font-bold text-[13px] whitespace-nowrap ${reg.isTopResult ? "text-primary" : "text-muted"}`}>
                        {reg.resultPlacement ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
