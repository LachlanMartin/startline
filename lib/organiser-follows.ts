import prisma from "@/lib/prisma";

export type OrganiserPublicStats = {
  registrations: number;
  followers: number;
  eventsHosted: number;
};

/** Public counters for an approved organiser profile. */
export async function getOrganiserPublicStats(organiserId: string): Promise<OrganiserPublicStats> {
  const [registrations, followers, eventsHosted] = await Promise.all([
    prisma.registration.count({
      where: { organiserId, status: "CONFIRMED" },
    }),
    prisma.organiserFollow.count({
      where: { organiserId },
    }),
    prisma.event.count({
      where: { organiserId, status: "APPROVED" },
    }),
  ]);

  return { registrations, followers, eventsHosted };
}

export async function isFollowingOrganiser(userId: string, organiserId: string): Promise<boolean> {
  const row = await prisma.organiserFollow.findUnique({
    where: {
      userId_organiserId: { userId, organiserId },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function followOrganiser(userId: string, organiserId: string) {
  return prisma.organiserFollow.create({
    data: { userId, organiserId },
    select: { id: true },
  });
}

export async function unfollowOrganiser(userId: string, organiserId: string) {
  return prisma.organiserFollow.delete({
    where: {
      userId_organiserId: { userId, organiserId },
    },
  });
}
