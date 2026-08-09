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
