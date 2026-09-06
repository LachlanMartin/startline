import { NextResponse } from "next/server";
import { getServerSession, resolveOrganiserSession, type OrganiserSession } from "./amplify-server";

// Every organiser route used to answer a bare 401 whenever `getOrganiserSession`
// came back null. That conflates three different situations:
//
//   * no valid Cognito session      — the caller really has been signed out
//   * a valid session, no organiser — the account is signed in fine, it just
//                                     doesn't manage an organiser
//   * the database is unreachable   — nothing is known about either
//
// The second case told people their session had expired when it hadn't, which
// is how a missing organiser row surfaced as "Your session has expired and
// nothing was saved" halfway through publishing an event (issue #302). The
// third is worse: a transient outage would tell a working organiser their
// account isn't an organiser, which reads as the account having been wiped.
// Keeping them apart gives the caller an accurate message and the correct
// status.

export type OrganiserGuard =
  | { error: null; session: OrganiserSession }
  | { error: NextResponse; session: null };

const SIGNED_OUT =
  "Your session has expired. Please sign in again.";
const NOT_AN_ORGANISER =
  "This account isn't linked to an organiser profile. Set one up before managing events.";
const UNAVAILABLE =
  "We couldn't reach the database. Nothing was changed. Please try again in a moment.";

export async function requireOrganiser(): Promise<OrganiserGuard> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) {
    return {
      error: NextResponse.json({ error: SIGNED_OUT, code: "UNAUTHENTICATED" }, { status: 401 }),
      session: null,
    };
  }

  let session: OrganiserSession | null;
  try {
    session = await resolveOrganiserSession(cognitoSession);
  } catch (err) {
    console.error("Organiser session lookup failed:", err);
    return {
      error: NextResponse.json({ error: UNAVAILABLE, code: "UNAVAILABLE" }, { status: 503 }),
      session: null,
    };
  }

  if (!session) {
    return {
      error: NextResponse.json({ error: NOT_AN_ORGANISER, code: "NO_ORGANISER" }, { status: 403 }),
      session: null,
    };
  }

  return { error: null, session };
}
