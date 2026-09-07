import { redirect } from "next/navigation";
import EventFormWizard from "@/components/event/EventFormWizard";
import { getOrganiserSession } from "@/lib/amplify-server";
import prisma from "@/lib/prisma";
import { hasAbn } from "@/lib/abn";

export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  const session = await getOrganiserSession();
  // Without an organiser the wizard still rendered, and the rejection only
  // arrived after five steps and an image upload (issue #302). Send them to the
  // landing page, which offers sign-in and organiser sign-up, before they start.
  if (!session) redirect("/organiser-landing");

  // Read here rather than from a client fetch: the wizard only needs to know
  // whether to show an advisory notice, and this page already has the session.
  const organiser = await prisma.organiser.findUnique({
    where:  { id: session.sub },
    select: { abn: true },
  });

  return (
    <EventFormWizard
      apiBase="/api/organiser"
      submitRedirect="/organiser/dashboard"
      cancelRedirect="/organiser/dashboard"
      organiserId={session.sub}
      organiserHasAbn={hasAbn(organiser?.abn)}
    />
  );
}
