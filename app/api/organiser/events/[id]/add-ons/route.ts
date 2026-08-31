import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";
import { idParams } from "@/lib/schemas";
import { sanitizeAddOnInput, generateVariantCode, addOnStockLabel } from "@/lib/add-ons";
import {
  catalogueForEvent,
  heldByVariant,
  purchaseCountByVariant,
} from "@/lib/add-on-catalogue";
import { z } from "zod";

const addOnPutSchema = z.object({ addOns: z.unknown().optional() });

async function assertOwnedEvent(eventId: string, organiserId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organiserId: true, feeStructure: true },
  });
  if (!event) return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  if (event.organiserId !== organiserId) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  return { event };
}

// GET — the event's add-on catalogue with live stock counts.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;
  const owned = await assertOwnedEvent(id, session.sub);
  if (owned.error) return owned.error;

  return NextResponse.json({
    addOns: await catalogueForEvent(id),
    feeStructure: owned.event!.feeStructure,
  });
}

/**
 * PUT — replace the event's add-on catalogue. Body: { addOns: AddOnInput[] }.
 *
 * This route exists separately from PATCH /api/organiser/events/[id] precisely
 * so it can skip that route's `status !== "DRAFT"` guard. Organisers must be able
 * to add a product, restock a size or retire a line after the event is published;
 * that is the whole point of the feature, and merch has no bearing on the event
 * approval an admin signed off.
 *
 * Reconciles by id inside one transaction. Anything with live purchase history is
 * retired rather than deleted, so a careless save can never orphan a paid order.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;
  const owned = await assertOwnedEvent(id, session.sub);
  if (owned.error) return owned.error;

  const parsedBody = addOnPutSchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const sanitized = sanitizeAddOnInput(parsedBody.data.addOns ?? []);
  if (!Array.isArray(sanitized)) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 });
  }

  // Stock can never be set below what has already sold, or the derived remaining
  // count goes negative and the picking list lies to the organiser.
  const [held, purchased] = await Promise.all([
    heldByVariant(id),
    purchaseCountByVariant(id),
  ]);
  for (const addOn of sanitized) {
    for (const variant of addOn.variants) {
      const sold = variant.id ? held[variant.id] ?? 0 : 0;
      if (variant.stock < sold) {
        return NextResponse.json(
          {
            error:
              `"${addOnStockLabel(addOn.name, variant.label)}" has already sold ${sold}. ` +
              `Set its stock to ${sold} or more.`,
          },
          { status: 409 },
        );
      }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existingAddOns = await tx.eventAddOn.findMany({
        where: { eventId: id },
        select: { id: true, variants: { select: { id: true, code: true } } },
      });

      // Every code ever issued for this event, so a new variant can never reuse
      // one an in-flight payment still refers to.
      const takenCodes = new Set(existingAddOns.flatMap((a) => a.variants.map((v) => v.code)));
      const existingAddOnIds = new Set(existingAddOns.map((a) => a.id));
      const incomingAddOnIds = new Set(sanitized.map((a) => a.id).filter(Boolean) as string[]);

      const variantOwner = new Map<string, string>();
      for (const addOn of existingAddOns) {
        for (const variant of addOn.variants) variantOwner.set(variant.id, addOn.id);
      }

      // Products the organiser removed. Delete only when nothing has ever been
      // bought; otherwise retire, which keeps receipts and the picking list intact.
      for (const addOn of existingAddOns) {
        if (incomingAddOnIds.has(addOn.id)) continue;
        const everSold = addOn.variants.some((v) => (purchased[v.id] ?? 0) > 0);
        if (everSold) {
          await tx.eventAddOn.update({ where: { id: addOn.id }, data: { active: false } });
          await tx.eventAddOnVariant.updateMany({
            where: { addOnId: addOn.id },
            data: { active: false },
          });
        } else {
          await tx.eventAddOn.delete({ where: { id: addOn.id } });
        }
      }

      for (let i = 0; i < sanitized.length; i++) {
        const input = sanitized[i];
        const data = {
          name: input.name,
          description: input.description,
          priceCents: input.priceCents,
          imageUrl: input.imageUrl,
          optionLabel: input.optionLabel,
          sortOrder: i,
          active: true,
        };

        // An id the client sent that does not belong to this event is treated as
        // a create, never as a cross-event write.
        const addOnId =
          input.id && existingAddOnIds.has(input.id)
            ? (await tx.eventAddOn.update({ where: { id: input.id }, data })).id
            : (await tx.eventAddOn.create({ data: { eventId: id, ...data } })).id;

        const priorVariants = await tx.eventAddOnVariant.findMany({
          where: { addOnId },
          select: { id: true },
        });
        const priorIds = new Set(priorVariants.map((v) => v.id));
        const keptIds = new Set(
          input.variants
            .map((v) => v.id)
            .filter((vid): vid is string => !!vid && priorIds.has(vid)),
        );

        for (const prior of priorVariants) {
          if (keptIds.has(prior.id)) continue;
          if ((purchased[prior.id] ?? 0) > 0) {
            await tx.eventAddOnVariant.update({
              where: { id: prior.id },
              data: { active: false },
            });
          } else {
            await tx.eventAddOnVariant.delete({ where: { id: prior.id } });
          }
        }

        for (let j = 0; j < input.variants.length; j++) {
          const variant = input.variants[j];
          const variantData = {
            label: variant.label,
            stock: variant.stock,
            sortOrder: j,
            active: true,
          };
          // Reuse the row only when the id really is a variant of THIS product.
          const reusable =
            variant.id && priorIds.has(variant.id) && variantOwner.get(variant.id) === addOnId;
          if (reusable) {
            await tx.eventAddOnVariant.update({ where: { id: variant.id }, data: variantData });
          } else {
            const code = generateVariantCode(takenCodes);
            takenCodes.add(code);
            await tx.eventAddOnVariant.create({
              data: { addOnId, eventId: id, code, ...variantData },
            });
          }
        }
      }
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // Two options sharing a name inside one product.
      if (err.code === "P2002") {
        return NextResponse.json({ error: "Two options can't share a name." }, { status: 409 });
      }
      // onDelete: Restrict refusing to orphan purchase history. The guards above
      // should have caught this; if a sale landed mid-save, the save is the thing
      // that gives way, not the purchase record.
      if (err.code === "P2003" || err.code === "P2014") {
        return NextResponse.json(
          { error: "Someone bought one of these while you were editing. Reload and try again." },
          { status: 409 },
        );
      }
    }
    throw err;
  }

  return NextResponse.json({ addOns: await catalogueForEvent(id) });
}
