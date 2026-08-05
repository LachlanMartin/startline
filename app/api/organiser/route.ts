import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";

// DELETE /api/organiser
// Deletes the active organiser. Owner only. Memberships cascade.
export async function DELETE() {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    await prisma.organiser.delete({ where: { id: session.sub } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete organiser." }, { status: 500 });
  }
}
