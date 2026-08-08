import Link from "next/link";
import Image from "next/image";
import { Calendar, MapPin, ArrowLeft, User } from "lucide-react";

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

interface Profile {
  id: string;
  username: string;
  bio: string | null;
  profilePicUrl: string | null;
  coverImageUrl: string | null;
  coverPosition: string | null;
  isPublic: boolean;
  city: string | null;
  state: string | null;
  createdAt: string;
  registrations: {
    eventId: string;
    event: { title: string; eventDate: string; city: string; state: string };
  }[];
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

  const initial = profile.username[0].toUpperCase();

  return (
    <main className="min-h-screen bg-dark-darker pt-14">
      <div className="relative w-full h-44 sm:h-60 overflow-hidden">
        {profile.coverImageUrl ? (
          <Image
            src={profile.coverImageUrl}
            alt=""
            fill
            className="object-cover brightness-[0.55]"
            style={{ objectPosition: profile.coverPosition ?? "50% 50%" }}
            sizes="100vw"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-dark via-dark-lighter to-dark-darker" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-dark-darker/40 to-transparent" />
      </div>

      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 pb-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-headline text-xs uppercase tracking-widest text-muted hover:text-primary transition-colors mb-6 relative z-10"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 -mt-12 sm:-mt-14 relative z-10">
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-dark-lighter bg-dark shrink-0">
            {profile.profilePicUrl ? (
              <Image
                src={profile.profilePicUrl}
                alt={profile.username}
                fill
                className="object-cover"
                sizes="112px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-headline text-3xl font-black text-primary">
                {initial}
              </div>
            )}
          </div>

          <div className="min-w-0 pb-1">
            <h1 className="font-headline text-3xl sm:text-4xl font-black tracking-tighter text-light leading-tight">
              {profile.username}
            </h1>
          </div>
        </div>

        {profile.bio && (
          <div className="mt-6 max-w-3xl">
            <p className="text-sm font-medium text-muted leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {profile.registrations.length > 0 && (
          <div className="mt-10">
            <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-4">
              Events Attended ({profile.registrations.length})
            </h2>
            <div className="space-y-2">
              {profile.registrations.map((reg) => (
                <Link
                  key={reg.eventId}
                  href={`/events/${reg.eventId}`}
                  className="flex items-center gap-4 p-4 bg-dark rounded-xl border border-dark-lighter hover:border-primary/40 transition-colors group"
                >
                  <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-headline text-sm font-bold italic tracking-tighter text-light group-hover:text-primary transition-colors truncate">
                      {reg.event.title}
                    </p>
                    <div className="flex items-center gap-3 text-muted font-headline text-[10px] uppercase tracking-widest mt-0.5">
                      <span>{reg.event.eventDate}</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {reg.event.city}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
