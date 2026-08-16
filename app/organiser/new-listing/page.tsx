import EventFormWizard from "@/components/event/EventFormWizard";
import { getOrganiserSession } from "@/lib/amplify-server";

export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  const session = await getOrganiserSession();
  return (
    <EventFormWizard
      apiBase="/api/organiser"
      submitRedirect="/organiser/dashboard"
      cancelRedirect="/organiser/dashboard"
      organiserId={session?.sub ?? undefined}
    />
  );
}
