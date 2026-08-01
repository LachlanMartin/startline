import EventFormWizard from "@/components/event/EventFormWizard";

export default async function AdminEditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-dark-darker pt-14">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 pt-8 pb-2">
        <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-2">
          Admin portal
        </div>
        <h1 className="font-headline text-[28px] sm:text-[38px] font-black italic tracking-tighter leading-tight text-light">
          Edit event
        </h1>
        <p className="font-headline text-muted mt-3 max-w-lg text-[14px]">
          Edits to a live event take effect immediately. Drafts and pending events return to the review queue.
        </p>
      </div>

      <EventFormWizard
        apiBase="/api/admin"
        submitRedirect="/admin/events"
        cancelRedirect="/admin/events"
        eventId={id}
        headingLabel="Edit event"
      />
    </div>
  );
}
