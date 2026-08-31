import type Stripe from "stripe";
import type { CompactParticipant } from "@/lib/registration-form";

/**
 * Parse participant data written into PaymentIntent metadata by the checkout
 * route. Supports the modern multi-participant format (participantCount +
 * participant0..N) and the legacy single-ticket fields.
 */
export function parseParticipantsFromMetadata(meta: Stripe.Metadata): CompactParticipant[] {
  const participantCount = parseInt(meta.participantCount ?? "0", 10);
  if (participantCount > 0) {
    const participants: CompactParticipant[] = [];
    for (let i = 0; i < participantCount; i++) {
      const raw = meta[`participant${i}`];
      if (!raw) continue;
      participants.push(JSON.parse(raw) as CompactParticipant);
    }
    if (participants.length > 0) return participants;
  }

  if (meta.firstName || meta.userName) {
    return [{
      fn: meta.firstName ?? meta.userName?.split(" ")[0] ?? "",
      ln: meta.lastName ?? meta.userName?.split(" ").slice(1).join(" ") ?? "",
      dob: meta.dateOfBirth ?? "",
      em: (meta.userEmail ?? "").toLowerCase(),
      mob: meta.mobile ?? "",
      ecn: meta.emergencyContactName ?? "",
      ecp: meta.emergencyContactPhone ?? "",
    }];
  }

  return [];
}


// ─── Paid add-ons in PaymentIntent metadata ──────────────────────────────────
//
// Stripe allows 50 metadata keys of 500 characters each. The checkout route
// already spends about 23 on a ten-person group booking, and the participantN
// values are close enough to full that lib/registration-form.ts truncates
// medical notes to fit. So add-ons get their own keys rather than being folded
// into participantN.
//
// Each line encodes as "<participantIndex>:<code>:<qty>", entries joined by
// commas and packed into addOns0, addOns1, ... Whole entries only: a chunk
// boundary never splits one, so the parser can simply concatenate and split.
//
// Variant CODES, not ids or positions. A uuid would blow the budget, and a
// positional index breaks the moment an organiser reorders the catalogue while
// a payment is in flight, which this feature explicitly allows.

/** Stripe's own limits. Asserted before the PaymentIntent call, not discovered from a 400. */
export const STRIPE_METADATA_MAX_KEYS = 50;
export const STRIPE_METADATA_MAX_VALUE_CHARS = 500;
/** Leaves headroom under the 500-character ceiling. */
export const ADDON_METADATA_CHUNK_CHARS = 490;

export interface AddOnMetadataLine {
  participantIndex: number;
  code: string;
  quantity: number;
}

/** Encode priced add-on lines into Stripe metadata keys. */
export function encodeAddOnsMetadata(lines: readonly AddOnMetadataLine[]): Record<string, string> {
  if (lines.length === 0) return {};

  const entries = lines.map((l) => `${l.participantIndex}:${l.code}:${l.quantity}`);
  const chunks: string[] = [];
  let current = "";
  for (const entry of entries) {
    const candidate = current ? `${current},${entry}` : entry;
    if (candidate.length > ADDON_METADATA_CHUNK_CHARS && current) {
      chunks.push(current);
      current = entry;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  const meta: Record<string, string> = { addOnCount: String(lines.length) };
  chunks.forEach((chunk, i) => {
    meta[`addOns${i}`] = chunk;
  });
  return meta;
}

/**
 * Rebuild add-on lines from PaymentIntent metadata. Malformed entries are
 * skipped rather than thrown on: the webhook must never crash on a bad key and
 * leave a paid order unconfirmed. A line that goes missing here still cannot be
 * silently swallowed, because the total check compares against the money.
 */
export function parseAddOnsFromMetadata(meta: Stripe.Metadata): AddOnMetadataLine[] {
  const parts: string[] = [];
  for (let i = 0; ; i++) {
    const chunk = meta[`addOns${i}`];
    if (typeof chunk !== "string") break;
    parts.push(chunk);
  }
  if (parts.length === 0) return [];

  const lines: AddOnMetadataLine[] = [];
  for (const entry of parts.join(",").split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const bits = trimmed.split(":");
    if (bits.length !== 3) continue;
    const participantIndex = Number(bits[0]);
    const quantity = Number(bits[2]);
    const code = bits[1];
    if (!code) continue;
    if (!Number.isInteger(participantIndex) || participantIndex < 0) continue;
    if (!Number.isInteger(quantity) || quantity <= 0) continue;
    lines.push({ participantIndex, code, quantity });
  }
  return lines;
}

/**
 * Refuse to call Stripe with metadata it will reject. Throwing here fails the
 * checkout request cleanly; discovering it from Stripe would mean an athlete
 * watching a card form die for no stated reason.
 */
export function assertMetadataBudget(meta: Record<string, string>): void {
  const keys = Object.keys(meta);
  if (keys.length > STRIPE_METADATA_MAX_KEYS) {
    throw new Error(
      `PaymentIntent metadata needs ${keys.length} keys, over Stripe's limit of ${STRIPE_METADATA_MAX_KEYS}.`,
    );
  }
  for (const key of keys) {
    if (meta[key].length > STRIPE_METADATA_MAX_VALUE_CHARS) {
      throw new Error(
        `PaymentIntent metadata key "${key}" is ${meta[key].length} characters, ` +
          `over Stripe's limit of ${STRIPE_METADATA_MAX_VALUE_CHARS}.`,
      );
    }
  }
}
