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

export function digitsOnlyAbn(abn: string) {
  return abn.replace(/\D/g, "");
}

/** Client/server helper: whether an ABN is acceptable for Stripe / paid hosting. */
export function isAbnAcceptableForPaid(
  lookup:
    | { status: "idle" }
    | { status: "loading" }
    | { status: "unavailable"; message: string }
    | { status: "not_found" }
    | { status: "found"; entityName: string; entityStatus: string; active: boolean },
  abn: string,
): boolean {
  const clean = digitsOnlyAbn(abn);
  if (clean.length < 9) return false;
  if (lookup.status === "found") return lookup.active;
  // Allow proceed when ABR is unavailable (local/CI) if digits look complete
  if (lookup.status === "unavailable") return clean.length === 11;
  return false;
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
