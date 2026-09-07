import { redirect } from "next/navigation";
import EventFormWizard from "@/components/event/EventFormWizard";
import { getOrganiserSession } from "@/lib/amplify-server";

export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  const session = await getOrganiserSession();
  // Without an organiser the wizard still rendered, and the rejection only
  // arrived after five steps and an image upload (issue #302). Send them to the
  // landing page, which offers sign-in and organiser sign-up, before they start.
  if (!session) redirect("/organiser-landing");

  return (
    <EventFormWizard
      apiBase="/api/organiser"
      submitRedirect="/organiser/dashboard"
      cancelRedirect="/organiser/dashboard"
      organiserId={session.sub}
    />
  );
}
