"use client";

import EventFormWizard from "@/components/event/EventFormWizard";

export default function NewListingPage() {
  return (
    <EventFormWizard
      apiBase="/api/organiser"
      submitRedirect="/organiser/dashboard"
      cancelRedirect="/organiser/dashboard"
    />
  );
}
