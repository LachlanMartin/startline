import { NextResponse } from "next/server";
import { getServerSession, getOrganiserSession, type OrganiserSession } from "./amplify-server";

// Every organiser route used to answer a bare 401 whenever `getOrganiserSession`
// came back null. That conflates two different situations:
//
//   * no valid Cognito session      — the caller really has been signed out
//   * a valid session, no organiser — the account is signed in fine, it just
//                                     doesn't manage an organiser
//
// The second case told people their session had expired when it hadn't, which
// is how a missing organiser row surfaced as "Your session has expired and
// nothing was saved" halfway through publishing an event (issue #302). Keeping
// them apart gives the caller an accurate message and the correct status.

export type OrganiserGuard =
  | { error: null; session: OrganiserSession }
  | { error: NextResponse; session: null };

const SIGNED_OUT =
  "Your session has expired. Please sign in again.";
const NOT_AN_ORGANISER =
  "This account isn't linked to an organiser profile. Set one up before managing events.";

export async function requireOrganiser(): Promise<OrganiserGuard> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) {
    return {
      error: NextResponse.json({ error: SIGNED_OUT, code: "UNAUTHENTICATED" }, { status: 401 }),
      session: null,
    };
  }

  const session = await getOrganiserSession(cognitoSession);
  if (!session) {
    return {
      error: NextResponse.json({ error: NOT_AN_ORGANISER, code: "NO_ORGANISER" }, { status: 403 }),
      session: null,
    };
  }

  return { error: null, session };
}
