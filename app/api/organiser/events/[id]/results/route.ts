import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";
import { isValidRaceTime, normaliseRaceTime } from "@/lib/race-results";
import type { Prisma } from "@prisma/client";
import { idParams } from "@/lib/schemas";
import { z } from "zod";

const resultRowSchema = z.object({
  registrationId: z.string().max(255).optional(),
  athleteEmail: z.string().max(255).optional(),
  resultDistance: z.string().max(100).nullable().optional(),
  resultTime: z.string().max(50).nullable().optional(),
  resultPlacement: z.string().max(100).nullable().optional(),
  isPersonalBest: z.boolean().optional(),
  isTopResult: z.boolean().optional(),
});

const resultsPatchSchema = z.object({
  results: z.array(resultRowSchema).min(1),
});

/** PATCH — bulk-set race results. Match by registrationId, else athleteEmail (case-insensitive). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, organiserId: true },
  });
  if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (event.organiserId !== session.sub) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsedBody = resultsPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "results array is required." }, { status: 400 });
  }
  const results = parsedBody.data.results;

  const registrations = await prisma.registration.findMany({
    where: { eventId: id },
    select: { id: true, athleteEmail: true },
  });
  const byId = new Map(registrations.map((r) => [r.id, r]));
  const byEmail = new Map(
    registrations.map((r) => [r.athleteEmail.toLowerCase(), r])
  );

  const updates: { id: string; data: Prisma.RegistrationUpdateInput }[] = [];
  const unmatched: typeof results = [];
  // Rows that found an athlete but carry a finish time nobody could read. They
  // are skipped rather than failing the whole batch, so one typo in a 500-row
  // CSV doesn't cost the organiser every other result.
  const invalidTimes: { athlete: string; value: string }[] = [];

  for (const row of results) {
    const match =
      (row.registrationId && byId.get(row.registrationId)) ||
      (row.athleteEmail && byEmail.get(row.athleteEmail.toLowerCase())) ||
      null;

    if (!match) {
      unmatched.push(row);
      continue;
    }

    const rawTime = row.resultTime?.trim();
    if (rawTime && !isValidRaceTime(rawTime)) {
      invalidTimes.push({ athlete: match.athleteEmail, value: rawTime });
      continue;
    }

    const data: Prisma.RegistrationUpdateInput = {};
    if ("resultDistance" in row)  data.resultDistance  = row.resultDistance?.trim() || null;
    if ("resultTime" in row)      data.resultTime      = rawTime ? normaliseRaceTime(rawTime) : null;
    if ("resultPlacement" in row) data.resultPlacement = row.resultPlacement?.trim() || null;
    if ("isPersonalBest" in row)  data.isPersonalBest  = !!row.isPersonalBest;
    if ("isTopResult" in row)     data.isTopResult     = !!row.isTopResult;

    if (Object.keys(data).length === 0) continue;
    updates.push({ id: match.id, data });
  }

  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map((u) => prisma.registration.update({ where: { id: u.id }, data: u.data }))
    );
  }

  return NextResponse.json({
    updated: updates.length,
    unmatched: unmatched.map((r) => r.athleteEmail ?? r.registrationId ?? "unknown"),
    invalidTimes,
  });
}
