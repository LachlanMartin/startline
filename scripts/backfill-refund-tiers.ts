/**
 * One-off backfill: turn legacy free-text refund policies into structured tiers.
 *
 * Before lib/refund-policy.ts, an event's policy was the four preset labels
 * concatenated with ". ", optionally followed by the organiser's own notes.
 * This reads each event's refundPolicy, maps the preset phrases onto tiers, and
 * leaves anything it does not recognise alone as notes.
 *
 *   npx tsx scripts/backfill-refund-tiers.ts          # report only, writes nothing
 *   npx tsx scripts/backfill-refund-tiers.ts --apply  # write the changes
 */
import "dotenv/config";
import prisma from "../lib/prisma";
import { parseLegacyPolicy } from "../lib/refund-policy";

const apply = process.argv.includes("--apply");

async function main() {
  const events = await prisma.event.findMany({
    select: { id: true, title: true, refundPolicy: true, refundTiers: true },
  });

  let converted = 0;
  let keptAsNotes = 0;
  let skipped = 0;

  for (const event of events) {
    // Never clobber a policy that already has structure.
    if (event.refundTiers !== null) {
      skipped++;
      continue;
    }
    if (!event.refundPolicy?.trim()) {
      skipped++;
      continue;
    }

    const parsed = parseLegacyPolicy(event.refundPolicy);
    if (!parsed) {
      // Custom text that matches no preset. It stays in refundPolicy as notes,
      // but the event still needs an explicit tier list so the athlete is quoted
      // something rather than nothing.
      keptAsNotes++;
      console.log(`  notes only  ${event.title}: "${event.refundPolicy.slice(0, 60)}"`);
      continue;
    }

    console.log(
      `  converted   ${event.title}: ${JSON.stringify(parsed.tiers)}` +
        `${parsed.notes ? ` notes="${parsed.notes.slice(0, 40)}"` : ""}`,
    );
    converted++;

    if (apply) {
      await prisma.event.update({
        where: { id: event.id },
        data: {
          refundTiers: parsed.tiers,
          refundPolicy: parsed.notes || null,
        },
      });
    }
  }

  console.log(
    `\n${apply ? "Applied" : "Dry run"}: ${converted} converted, ` +
      `${keptAsNotes} left as notes, ${skipped} skipped (already structured or empty).`,
  );
  if (!apply && converted > 0) console.log("Re-run with --apply to write these changes.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
