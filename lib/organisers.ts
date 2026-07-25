import prisma from "@/lib/prisma";

/** Public-safe organiser profile — never exposes contact/legal/payment fields. */
export async function getPublicOrganiser(
  id: string,
  opts?: { requireApproved?: boolean },
) {
  const requireApproved = opts?.requireApproved !== false;
  try {
    const organiser = await prisma.organiser.findUnique({
      where: { id },
      select: {
        id: true,
        orgName: true,
        bio: true,
        logoUrl: true,
        logoPosition: true,
        coverImageUrl: true,
        coverPosition: true,
        photos: true,
        website: true,
        instagram: true,
        facebook: true,
        verified: true,
        status: true,
        createdAt: true,
      },
    });
    if (!organiser) return null;
    if (requireApproved && organiser.status !== "APPROVED") return null;
    return organiser;
  } catch {
    return null;
  }
}
