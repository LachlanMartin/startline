import prisma from "@/lib/prisma";
import { sendFollowedOrganiserEventEmail } from "@/lib/email";

export type NotifyOrganiserFollowersInput = {
  organiserId: string;
  eventId: string;
  eventTitle: string;
  organiserName?: string | null;
  eventDate?: string | null;
  city?: string | null;
};

/**
 * Notify every follower of an organiser that a new event is live.
 * Call only on transitions into APPROVED (not on every edit).
 * Returns counts; email failures are swallowed per-recipient.
 */
export async function notifyOrganiserFollowers(
  input: NotifyOrganiserFollowersInput,
): Promise<{ notified: number; emailed: number }> {
  const follows = await prisma.organiserFollow.findMany({
    where: { organiserId: input.organiserId },
    select: {
      userId: true,
      user: { select: { email: true, name: true } },
    },
  });

  if (follows.length === 0) return { notified: 0, emailed: 0 };

  const organiserLabel = input.organiserName?.trim() || "An organiser you follow";
  const title = `${organiserLabel} posted a new event`;
  const body = input.eventTitle;

  await prisma.userNotification.createMany({
    data: follows.map((f) => ({
      userId: f.userId,
      type: "ORGANISER_EVENT_LIVE" as const,
      title,
      body,
      eventId: input.eventId,
    })),
  });

  let emailed = 0;
  await Promise.all(
    follows.map(async (f) => {
      if (!f.user.email) return;
      try {
        await sendFollowedOrganiserEventEmail(f.user.email, {
          followerName: f.user.name,
          organiserName: organiserLabel,
          eventTitle: input.eventTitle,
          eventId: input.eventId,
          eventDate: input.eventDate,
          city: input.city,
        });
        emailed += 1;
      } catch (err) {
        console.error("Failed to send follower event email:", err);
      }
    }),
  );

  return { notified: follows.length, emailed };
}

/** Pure helpers for unit tests — build in-app notification rows for followers. */
export function buildOrganiserEventLiveNotifications(
  followerUserIds: string[],
  input: Pick<NotifyOrganiserFollowersInput, "eventId" | "eventTitle" | "organiserName">,
) {
  const organiserLabel = input.organiserName?.trim() || "An organiser you follow";
  return followerUserIds.map((userId) => ({
    userId,
    type: "ORGANISER_EVENT_LIVE" as const,
    title: `${organiserLabel} posted a new event`,
    body: input.eventTitle,
    eventId: input.eventId,
  }));
}
