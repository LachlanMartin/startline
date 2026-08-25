import prisma from "@/lib/prisma";
import { getOrganiserRatings } from "@/lib/reviews";
import ProfilePageClient from "@/components/profile/ProfilePageClient";

export const PROFILE_USER_SELECT = {
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
      organiser: { select: { id: true, orgName: true, logoUrl: true, verified: true } },
    },
    take: 1,
    orderBy: { createdAt: "asc" },
  },
} as const;

export type ProfileUser = {
  id: string;
  username: string | null;
  email: string;
  name: string | null;
  bio: string | null;
  profilePicUrl: string | null;
  isPublic: boolean;
  city: string | null;
  state: string | null;
  mobile: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  createdAt: Date;
  memberships: { organiser: { id: string; orgName: string | null; logoUrl: string | null; verified: boolean } }[];
};

/**
 * Renders a user's profile (history + optional owner edit affordances).
 * Shared by /profile (owner by id, no username required) and
 * /profile/[username] (public profile). The caller resolves the user and any
 * privacy gating; this component only fetches race history + ratings.
 */
export default async function ProfileServerView({
  user,
  isOwner,
}: {
  user: ProfileUser;
  isOwner: boolean;
}) {
  const registrations = await prisma.registration.findMany({
    where: { userId: user.id, status: "CONFIRMED" },
    orderBy: { event: { eventDate: "asc" } },
    select: {
      id: true,
      resultTime: true,
      resultPlacement: true,
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
    username: user.username ?? "",
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