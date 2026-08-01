import { redirect } from "next/navigation";

/** Legacy URL — race management now lives on the event dashboard. */
export default async function RegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/organiser/events/${id}/dashboard?panel=manage`);
}
