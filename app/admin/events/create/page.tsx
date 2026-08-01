"use client";

import { useState, useEffect, startTransition } from "react";
import EventFormWizard from "@/components/event/EventFormWizard";

interface OrganiserOption {
  id: string;
  orgName: string | null;
  contactName: string | null;
  email: string;
  status: string;
  verified: boolean;
}

export default function AdminCreateEventPage() {
  const [organisers, setOrganisers] = useState<OrganiserOption[] | null>(null);
  const [organiserId, setOrganiserId] = useState("");

  useEffect(() => {
    fetch("/api/admin/organisers")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) startTransition(() => setOrganisers(data));
        else setOrganisers([]);
      })
      .catch(() => setOrganisers([]));
  }, []);

  const label = (o: OrganiserOption) =>
    o.orgName || o.contactName || o.email;

  return (
    <div className="min-h-screen bg-dark-darker pt-14">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 pt-8 pb-2">
        <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-2">
          Admin portal
        </div>
        <h1 className="font-headline text-[28px] sm:text-[38px] font-black italic tracking-tighter leading-tight text-light">
          Create event
        </h1>
        <p className="font-headline text-muted mt-3 max-w-lg text-[14px]">
          Choose the organiser the event belongs to, then fill in the details as if they were posting it themselves.
        </p>

        {/* Organiser selector */}
        <div className="mt-6 max-w-lg">
          <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-light/70 block mb-2">
            Organiser <span className="text-primary font-black text-[15px] leading-none ml-1">*</span>
          </label>
          <select
            value={organiserId}
            onChange={(e) => setOrganiserId(e.target.value)}
            disabled={organisers === null}
            className={`w-full bg-dark-light border border-dark-lighter rounded-md px-4 py-3 font-headline text-[15px] focus:border-primary focus:outline-none transition-colors
              ${organiserId ? "text-light" : "text-muted-dark"} disabled:opacity-60`}
          >
            <option value="" disabled className="bg-dark text-muted-dark">
              {organisers === null ? "Loading organisers…" : "Select an organiser…"}
            </option>
            {(organisers ?? []).map((o) => (
              <option key={o.id} value={o.id} disabled={o.status === "SUSPENDED"} className="bg-dark text-light">
                {label(o)}
                {o.status === "SUSPENDED" ? " (suspended)" : o.verified ? " · verified" : ""}
              </option>
            ))}
          </select>
          {organisers && organisers.length === 0 && (
            <p className="font-headline text-[11px] uppercase tracking-widest text-muted-dark mt-2">
              No organiser accounts exist yet.
            </p>
          )}
        </div>
      </div>

      <EventFormWizard
        apiBase="/api/admin"
        submitRedirect="/admin/events"
        cancelRedirect="/admin/events"
        organiserId={organiserId}
        requireOrganiser
        headingLabel="Create event"
      />
    </div>
  );
}
