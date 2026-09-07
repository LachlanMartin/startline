// The three portals share one Next app but not always one hostname.
//
// Production splits them across startlineau.com, organiser.startlineau.com and
// admin.startlineau.com. Every other deployment — the Amplify branch domain, PR
// previews, local dev — serves all three from a single host. A cross-portal
// link that is absolute everywhere points at a hostname that doesn't resolve on
// those single-host deployments, which is how "Get started" led to a browser
// error page (issue #302). A link that is relative everywhere lands on the
// wrong portal in production. So the shape of the link has to follow the host.

export const USER_DOMAIN = "startlineau.com";
export const ORGANISER_DOMAIN = `organiser.${USER_DOMAIN}`;
export const ADMIN_DOMAIN = `admin.${USER_DOMAIN}`;

/** Lower-cased and without the port, which `Host` carries in local dev. */
export function normaliseHost(host: string | null | undefined): string {
  return (host ?? "").toLowerCase().replace(/:\d+$/, "");
}

/** True only on the deployment that gives each portal its own hostname. */
export function portalsAreSplit(host: string | null | undefined): boolean {
  const h = normaliseHost(host);
  return (
    h === USER_DOMAIN ||
    h === `www.${USER_DOMAIN}` ||
    h === ORGANISER_DOMAIN ||
    h === ADMIN_DOMAIN
  );
}

/** A link to `path` on the athlete site, from a page served on `host`. */
export function customerHref(path: string, host: string | null | undefined): string {
  return portalsAreSplit(host) ? `https://${USER_DOMAIN}${path}` : path;
}

/** A link to `path` on the organiser portal, from a page served on `host`. */
export function organiserHref(path: string, host: string | null | undefined): string {
  return portalsAreSplit(host) ? `https://${ORGANISER_DOMAIN}${path}` : path;
}

// Cognito cookies are written by Amplify in the browser, and a host-only cookie
// set on startlineau.com is never sent to organiser.startlineau.com — which left
// the organiser portal permanently signed out in production. Scoping them to the
// registrable domain lets one sign-in cover all three portals. Returns undefined
// where a shared cookie makes no sense (single-host deployments, localhost),
// because naming a domain the browser isn't on drops the cookie entirely.
export function authCookieDomain(host: string | null | undefined): string | undefined {
  const h = normaliseHost(host);
  return h === USER_DOMAIN || h.endsWith(`.${USER_DOMAIN}`) ? `.${USER_DOMAIN}` : undefined;
}
