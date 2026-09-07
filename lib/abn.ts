// Australian Business Register (ABR) ABN lookup.
// Register for a free GUID at: https://abr.business.gov.au/Documentation/UserGuideAbnLookupServices
// Set ABR_GUID in your environment variables.

export interface AbnResult {
  abn:        string;
  entityName: string;
  entityType: string;
  status:     "Active" | "Cancelled" | string;
  state:      string;
  postcode:   string;
}

export async function lookupAbn(abn: string): Promise<AbnResult | null> {
  const guid = process.env.ABR_GUID;
  if (!guid) return null;

  const clean = abn.replace(/\s/g, "");
  const url   = `https://abr.business.gov.au/abn/json?abn=${clean}&guid=${guid}`;

  const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h
  if (!res.ok) return null;

  const data = await res.json();
  if (data.Message) return null; // ABR returns error in Message field

  return {
    abn:        data.Abn,
    entityName: data.EntityName || data.BusinessName?.[0]?.OrganisationName || "",
    entityType: data.EntityTypeName || "",
    status:     data.AbnStatus || "",
    state:      data.AddressState || "",
    postcode:   data.AddressPostcode || "",
  };
}

// Whether an organiser's stored ABN is complete enough to host events that
// take money through Startline.
//
// The threshold is 9 digits rather than the 11 a real ABN carries. That is the
// rule the event routes have always applied, and raising it here would lock
// out organisers whose stored value predates any validation. Tightening it is
// a data-migration decision, not a validation one.
export const MIN_ABN_DIGITS = 9;

export function hasAbn(abn: string | null | undefined): boolean {
  return (abn?.replace(/\D/g, "").length ?? 0) >= MIN_ABN_DIGITS;
}

// Shown wherever an organiser is told their account is not ready to take
// money. Kept in one place so the wizard, the dashboard and the admin portal
// all describe the same gap the same way.
export const ABN_REQUIRED_MESSAGE =
  "An ABN is required to host paid events on Startline. Add your ABN in Payments or onboarding, or use external registration.";
