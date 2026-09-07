import { NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";

// DELETE /api/organiser
// Deletes the active organiser. Owner only. Memberships cascade.
export async function DELETE() {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;
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
