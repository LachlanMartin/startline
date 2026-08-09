import Link from "next/link";
import { User } from "lucide-react";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/amplify-server";
import { getOrganiserRatings } from "@/lib/reviews";
import ProfilePageClient from "@/components/profile/ProfilePageClient";

interface PublicProfilePageProps {
  params: Promise<{ username: string }>;
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      bio: true,
      profilePicUrl: true,
      isPublic: true,
      city: true,
      state: true,
      mobile: true,
      dateOfBirth: true,
      gender: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      createdAt: true,
      memberships: {
        select: {
          organiser: {
            select: { id: true, orgName: true, logoUrl: true, verified: true },
          },
        },
        take: 1,
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user) {
    return <ProfileNotFound />;
  }

  const session = await getServerSession();
  const isOwner = session?.sub === user.id || (!!session?.email && session.email === user.email);

  // Private profiles are only visible to their owner.
  if (!isOwner && !user.isPublic) {
    return <ProfileNotFound />;
  }

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

  const profile = {
    username: user.username!,
    bio: user.bio,
    profilePicUrl: user.profilePicUrl,
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

  const ownerData = isOwner
    ? {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        bio: user.bio,
        isPublic: user.isPublic,
        city: user.city,
        state: user.state,
        profilePicUrl: user.profilePicUrl,
        mobile: user.mobile,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        emergencyContactName: user.emergencyContactName,
        emergencyContactPhone: user.emergencyContactPhone,
        createdAt: user.createdAt,
        organiser: user.memberships[0]?.organiser ?? null,
      }
    : null;

  return (
    <ProfilePageClient
      profile={profile}
      isOwner={isOwner}
      ownerData={ownerData}
    />
  );
}

function ProfileNotFound() {
  return (
    <main className="min-h-screen bg-dark-darker flex items-center justify-center pt-20">
      <div className="text-center">
        <User className="w-16 h-16 text-muted mx-auto mb-4" />
        <h1 className="font-headline text-3xl font-black italic tracking-tighter text-light mb-2">
          Profile not found
        </h1>
        <p className="text-muted text-sm mb-6">
          This user doesn&apos;t exist or their profile is private.
        </p>
        <Link
          href="/"
          className="font-headline text-xs font-bold uppercase tracking-widest text-primary hover:underline"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
