import Link from "next/link";
import { User } from "lucide-react";
import prisma from "@/lib/prisma";
import { getOrganiserRatings } from "@/lib/reviews";
import UserProfileView from "@/components/profile/UserProfileView";

interface PublicProfilePageProps {
  params: Promise<{ username: string }>;
}

async function getProfile(username: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      bio: true,
      profilePicUrl: true,
      coverImageUrl: true,
      coverPosition: true,
      isPublic: true,
    },
  });

  if (!user || !user.isPublic) return null;

  const registrations = await prisma.registration.findMany({
    where: { userId: user.id, status: "CONFIRMED" },
    orderBy: { event: { eventDate: "asc" } },
    select: {
      id: true,
      finishTime: true,
      result: true,
      event: {
        select: {
          id: true,
          title: true,
          discipline: true,
          eventDate: true,
          city: true,
          state: true,
          coverImageUrl: true,
          organiser: { select: { id: true, orgName: true, logoUrl: true } },
        },
      },
    },
  });

  const ratings = await getOrganiserRatings(
    registrations.map((r) => r.event.organiser.id),
  );

  return {
    username: user.username!,
    bio: user.bio,
    profilePicUrl: user.profilePicUrl,
    coverImageUrl: user.coverImageUrl,
    coverPosition: user.coverPosition,
    history: {
      completed: registrations.length,
      registrations: registrations.map((r) => ({
        ...r,
        event: {
          ...r.event,
          organiser: {
            ...r.event.organiser,
            rating: ratings.get(r.event.organiser.id) ?? null,
          },
        },
      })),
    },
  };
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params;
  const profile = await getProfile(username);

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

  return (
    <UserProfileView
      username={profile.username}
      bio={profile.bio}
      profilePicUrl={profile.profilePicUrl}
      coverImageUrl={profile.coverImageUrl}
      coverPosition={profile.coverPosition}
      history={profile.history}
    />
  );
}
