import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  refundsCreate: vi.fn(),
  registration: { count: vi.fn(), create: vi.fn(), createMany: vi.fn(), groupBy: vi.fn() },
  registrationAddOn: { groupBy: vi.fn(), createMany: vi.fn() },
  eventAddOnVariant: { findMany: vi.fn() },
  user: { upsert: vi.fn() },
  event: { findUnique: vi.fn() },
  notification: { create: vi.fn() },
  userNotification: { create: vi.fn() },
  organiser: { updateMany: vi.fn() },
  sendEmail: vi.fn(),
  ensureCognitoUser: vi.fn(),
}));

const tx = {
  registration: mocks.registration,
  registrationAddOn: mocks.registrationAddOn,
  eventAddOnVariant: mocks.eventAddOnVariant,
};

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: mocks.constructEvent },
    refunds: { create: mocks.refundsCreate },
  }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    registration: mocks.registration,
    registrationAddOn: mocks.registrationAddOn,
    eventAddOnVariant: mocks.eventAddOnVariant,
    user: mocks.user,
    event: mocks.event,
    notification: mocks.notification,
    userNotification: mocks.userNotification,
    organiser: mocks.organiser,
    $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
  },
}));

vi.mock("@/lib/email", () => ({
  sendRegistrationConfirmationEmail: mocks.sendEmail,
}));

vi.mock("@/lib/athlete-accounts", () => ({
  ensureAthleteCognitoUser: mocks.ensureCognitoUser,
}));

import { POST } from "@/app/api/stripe/webhook/route";
import {
  parseParticipantsFromMetadata,
  parseAddOnsFromMetadata,
  encodeAddOnsMetadata,
  assertMetadataBudget,
  ADDON_METADATA_CHUNK_CHARS,
  STRIPE_METADATA_MAX_KEYS,
} from "@/lib/stripe-webhook";
import { MAX_ADDON_LINES } from "@/lib/add-ons";

const metadata = (overrides: Record<string, string>): Stripe.Metadata => ({
  eventId: "seed-event-001",
  organiserId: "org-1",
  waveLabel: "General",
  userName: "Jordan Clarke",
  userEmail: "jordan@example.com",
  feeStructure: "athlete",
  ...overrides,
});

function signedEvent(object: Record<string, unknown>, type = "payment_intent.succeeded") {
  mocks.constructEvent.mockReturnValue({ type, data: { object } });
}

async function post(payload: Record<string, unknown>): Promise<Response> {
  const req = new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "stripe-signature": "t=1,v1=sig" },
  });
  return POST(req);
}

// DB truth used by the webhook's server-side pricing/ownership checks. Price
// $100.00 (10000 cents) + athlete fee (395 + 145 = 540) → charged 10540.
const approvedEvent = {
  id: "seed-event-001",
  title: "Apex Throwdown",
  status: "APPROVED",
  registrationType: "startline",
  feeStructure: "athlete",
  waves: [{ label: "General", price: "100.00" }],
  cap: null,
  eventDate: "2026-08-15",
  startTime: "07:30",
  venue: "MSAC",
  city: "Melbourne",
  state: "vic",
  organiserId: "org-1",
};

const TICKET_CENTS = 10540;
// $25.00 tee, percentage-only fee: round(2500 * 0.0395) = 99 → charged 2599.
const TEE_CENTS = 2599;

/** One catalogue row, in the shape both catalogueVariantsForEvent and stockByVariant read. */
function teeVariant(stock: number) {
  return {
    id: "v-tee-m",
    addOnId: "a-tee",
    code: "aaa111",
    label: "M",
    stock,
    addOn: { name: "Event tee", optionLabel: "Size", priceCents: 2500, imageUrl: null },
  };
}

function participant(overrides: Record<string, string> = {}) {
  return JSON.stringify({
    fn: "Jordan", ln: "Clarke", em: "jordan@example.com", dob: "1990-01-01",
    ecn: "Sam", ecp: "0400 000 000", wav: "General", ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_00000000000000000000000000000000";
  mocks.user.upsert.mockResolvedValue({ id: "user-1" });
  mocks.sendEmail.mockResolvedValue(undefined);
  mocks.registration.count.mockResolvedValue(0);
  mocks.registration.groupBy.mockResolvedValue([]);
  mocks.registration.createMany.mockResolvedValue({ count: 1 });
  mocks.registration.create.mockResolvedValue({ id: "reg-1" });
  mocks.registrationAddOn.groupBy.mockResolvedValue([]);
  mocks.registrationAddOn.createMany.mockResolvedValue({ count: 1 });
  mocks.eventAddOnVariant.findMany.mockResolvedValue([]);
  mocks.notification.create.mockResolvedValue({});
  mocks.userNotification.create.mockResolvedValue({});
  mocks.refundsCreate.mockResolvedValue({ id: "re_1" });
  mocks.event.findUnique.mockResolvedValue(approvedEvent);
});

describe("parseParticipantsFromMetadata", () => {
  it("parses the modern multi-participant format", () => {
    const meta = {
      participantCount: "2",
      participant0: JSON.stringify({ fn: "Jordan", ln: "Clarke", em: "jordan@example.com" }),
      participant1: JSON.stringify({ fn: "Sam", ln: "Reid", em: "sam@example.com" }),
    };
    const parsed = parseParticipantsFromMetadata(meta);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].fn).toBe("Jordan");
    expect(parsed[1].ln).toBe("Reid");
  });

  it("falls back to legacy single-participant fields", () => {
    const parsed = parseParticipantsFromMetadata({ firstName: "Jordan", lastName: "Clarke", userEmail: "j@example.com" });
    expect(parsed).toHaveLength(1);
    expect(parsed[0].fn).toBe("Jordan");
    expect(parsed[0].em).toBe("j@example.com");
  });

  it("returns an empty array for empty metadata", () => {
    expect(parseParticipantsFromMetadata({})).toEqual([]);
  });
});

describe("add-on metadata codec", () => {
  it("writes nothing at all for an order with no add-ons", () => {
    expect(encodeAddOnsMetadata([])).toEqual({});
  });

  it("round trips a basket", () => {
    const lines = [
      { participantIndex: 0, code: "aaa111", quantity: 2 },
      { participantIndex: 1, code: "bbb222", quantity: 1 },
    ];
    expect(parseAddOnsFromMetadata(encodeAddOnsMetadata(lines) as Stripe.Metadata)).toEqual(lines);
  });

  it("reassembles a basket split across several keys", () => {
    const lines = Array.from({ length: MAX_ADDON_LINES }, (_, i) => ({
      participantIndex: i % 10,
      code: `code${String(i).padStart(2, "0")}`,
      quantity: (i % 9) + 1,
    }));
    const meta = encodeAddOnsMetadata(lines);
    expect(Object.keys(meta).length).toBeGreaterThan(1);
    expect(parseAddOnsFromMetadata(meta as Stripe.Metadata)).toEqual(lines);
  });

  it("keeps every value under Stripe's per-key ceiling at the line cap", () => {
    const lines = Array.from({ length: MAX_ADDON_LINES }, (_, i) => ({
      participantIndex: 9,
      code: `zz${String(i).padStart(4, "0")}`,
      quantity: 10,
    }));
    const meta = encodeAddOnsMetadata(lines);
    for (const value of Object.values(meta)) {
      expect(value.length).toBeLessThanOrEqual(ADDON_METADATA_CHUNK_CHARS);
    }
    // 40 lines must never need more than 2 chunk keys plus the count.
    expect(Object.keys(meta).length).toBeLessThanOrEqual(3);
  });

  it("skips malformed entries rather than throwing", () => {
    const meta = { addOns0: "0:aaa111:2,rubbish,1::3,2:bbb222:0,x:ccc333:1,1:ddd444:4" };
    expect(parseAddOnsFromMetadata(meta as Stripe.Metadata)).toEqual([
      { participantIndex: 0, code: "aaa111", quantity: 2 },
      { participantIndex: 1, code: "ddd444", quantity: 4 },
    ]);
  });

  it("returns nothing when the order carried no add-on keys", () => {
    expect(parseAddOnsFromMetadata({ eventId: "e1" } as Stripe.Metadata)).toEqual([]);
  });
});

describe("assertMetadataBudget", () => {
  it("passes a worst-case group booking with a full add-on basket", () => {
    const meta: Record<string, string> = { eventId: "e", organiserId: "o" };
    for (let i = 0; i < 10; i++) meta[`participant${i}`] = JSON.stringify({ fn: "A", ln: "B" });
    Object.assign(
      meta,
      encodeAddOnsMetadata(
        Array.from({ length: MAX_ADDON_LINES }, (_, i) => ({
          participantIndex: i % 10,
          code: `zz${String(i).padStart(4, "0")}`,
          quantity: 10,
        })),
      ),
    );
    expect(Object.keys(meta).length).toBeLessThan(STRIPE_METADATA_MAX_KEYS);
    expect(() => assertMetadataBudget(meta)).not.toThrow();
  });

  it("throws before Stripe would, on too many keys", () => {
    const meta = Object.fromEntries(
      Array.from({ length: STRIPE_METADATA_MAX_KEYS + 1 }, (_, i) => [`k${i}`, "v"]),
    );
    expect(() => assertMetadataBudget(meta)).toThrow(/over Stripe's limit/);
  });

  it("throws on an over-long value", () => {
    expect(() => assertMetadataBudget({ big: "x".repeat(501) })).toThrow(/characters/);
  });
});

describe("POST /api/stripe/webhook", () => {
  it("returns 400 when the signature is invalid", async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const res = await post({ type: "payment_intent.succeeded" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when STRIPE_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    });
    const res = await post({});
    expect(res.status).toBe(400);
  });

  it("processes payment_intent.succeeded and creates registrations + notification", async () => {
    signedEvent({
      id: "pi_123",
      amount_received: TICKET_CENTS,
      metadata: metadata({ participantCount: "1", participant0: participant() }),
    });

    const res = await post({ id: "pi_123", type: "payment_intent.succeeded" });
    expect(res.status).toBe(200);

    expect(mocks.registration.create).toHaveBeenCalledTimes(1);
    expect(mocks.registration.create.mock.calls[0][0].data).toMatchObject({
      eventId: "seed-event-001",
      organiserId: "org-1",
      athleteName: "Jordan Clarke",
      status: "CONFIRMED",
      amountCents: 10000,
      platformFeeCents: 540,
      stripePaymentIntentId: "pi_123",
    });
    expect(mocks.notification.create).toHaveBeenCalled();
  });

  // The createMany → create change touches the hottest insert path in the
  // product. A group booking is the case that would break first.
  it("creates one registration per participant in a group booking", async () => {
    signedEvent({
      id: "pi_group",
      amount_received: TICKET_CENTS * 3,
      metadata: metadata({
        participantCount: "3",
        participant0: participant({ fn: "Jordan", em: "jordan@example.com" }),
        participant1: participant({ fn: "Sam", em: "sam@example.com" }),
        participant2: participant({ fn: "Alex", em: "alex@example.com" }),
      }),
    });

    await post({ id: "pi_group" });

    expect(mocks.registration.create).toHaveBeenCalledTimes(3);
    const names = mocks.registration.create.mock.calls.map((c) => c[0].data.athleteName);
    expect(names).toEqual(["Jordan Clarke", "Sam Clarke", "Alex Clarke"]);
    for (const call of mocks.registration.create.mock.calls) {
      expect(call[0].data.status).toBe("CONFIRMED");
      expect(call[0].data.amountCents).toBe(10000);
    }
  });

  it("rejects a PaymentIntent whose amount does not match DB pricing", async () => {
    signedEvent({
      id: "pi_123",
      amount_received: 100, // attacker underpaid
      metadata: metadata({ participantCount: "1", participant0: participant() }),
    });

    await post({ id: "pi_123" });
    expect(mocks.registration.createMany).toHaveBeenCalledTimes(1);
    const created = mocks.registration.createMany.mock.calls[0][0].data[0];
    expect(created.status).toBe("CANCELLED");
    expect(mocks.notification.create).not.toHaveBeenCalled();
  });

  it("rejects a PaymentIntent referencing an unknown or mismatched event", async () => {
    mocks.event.findUnique.mockResolvedValue(null);
    signedEvent({
      id: "pi_123",
      amount_received: TICKET_CENTS,
      metadata: metadata({ participantCount: "1", participant0: participant() }),
    });

    await post({ id: "pi_123" });
    expect(mocks.registration.create).not.toHaveBeenCalled();
    expect(mocks.registration.createMany).not.toHaveBeenCalled();
    expect(mocks.notification.create).not.toHaveBeenCalled();
  });

  it("refuses to confirm past the event capacity", async () => {
    mocks.event.findUnique.mockResolvedValue({
      ...approvedEvent,
      cap: 1,
      waves: [{ label: "General", price: "100.00", qty: 1 }],
    });
    mocks.registration.count.mockResolvedValueOnce(0).mockResolvedValue(1);
    mocks.registration.groupBy.mockResolvedValue([{ waveLabel: "General", _count: { _all: 1 } }]);
    signedEvent({
      id: "pi_123",
      amount_received: TICKET_CENTS,
      metadata: metadata({ participantCount: "1", participant0: participant() }),
    });

    await post({ id: "pi_123" });
    expect(mocks.registration.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.registration.createMany.mock.calls[0][0].data[0].status).toBe("CANCELLED");
    expect(mocks.notification.create).not.toHaveBeenCalled();
  });

  it("is idempotent — skips a PaymentIntent that was already processed", async () => {
    signedEvent({ id: "pi_123", metadata: metadata({}) });
    mocks.registration.count.mockResolvedValue(1);

    await post({ id: "pi_123" });
    expect(mocks.registration.create).not.toHaveBeenCalled();
    expect(mocks.registration.createMany).not.toHaveBeenCalled();
    expect(mocks.notification.create).not.toHaveBeenCalled();
  });

  it("creates a CANCELLED registration when participant metadata is missing", async () => {
    signedEvent({ id: "pi_123", amount_received: TICKET_CENTS, metadata: { eventId: "seed-event-001", organiserId: "org-1" } });

    await post({ id: "pi_123" });
    expect(mocks.registration.create).toHaveBeenCalledTimes(1);
    expect(mocks.registration.create.mock.calls[0][0].data.status).toBe("CANCELLED");
  });

  it("marks stripeOnboardingComplete when account.updated enables charges and payouts", async () => {
    signedEvent({ id: "acct_123", charges_enabled: true, payouts_enabled: true }, "account.updated");
    mocks.organiser.updateMany.mockResolvedValue({ count: 1 });

    const res = await post({ id: "acct_123" });
    expect(res.status).toBe(200);
    expect(mocks.organiser.updateMany).toHaveBeenCalledWith({
      where: { stripeAccountId: "acct_123", stripeOnboardingComplete: false },
      data: { stripeOnboardingComplete: true },
    });
  });

  it("does not update the organiser when payouts are disabled", async () => {
    signedEvent({ id: "acct_123", charges_enabled: true, payouts_enabled: false }, "account.updated");

    await post({ id: "acct_123" });
    expect(mocks.organiser.updateMany).not.toHaveBeenCalled();
  });

  it("acknowledges unhandled event types", async () => {
    signedEvent({ id: "evt_1" }, "charge.refunded");
    const res = await post({ id: "evt_1" });
    expect(res.status).toBe(200);
    expect(mocks.registration.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/stripe/webhook — paid add-ons", () => {
  function orderWithTee(amountReceived: number, stock = 5) {
    mocks.eventAddOnVariant.findMany.mockResolvedValue([teeVariant(stock)]);
    signedEvent({
      id: "pi_addon",
      amount_received: amountReceived,
      latest_charge: "ch_1",
      metadata: metadata({
        participantCount: "1",
        participant0: participant(),
        addOnCount: "1",
        addOns0: "0:aaa111:1",
      }),
    });
  }

  it("confirms the entry and writes the purchased add-on row", async () => {
    orderWithTee(TICKET_CENTS + TEE_CENTS);

    await post({ id: "pi_addon" });

    expect(mocks.registration.create).toHaveBeenCalledTimes(1);
    expect(mocks.registration.create.mock.calls[0][0].data.status).toBe("CONFIRMED");

    expect(mocks.registrationAddOn.createMany).toHaveBeenCalledTimes(1);
    const row = mocks.registrationAddOn.createMany.mock.calls[0][0].data[0];
    expect(row).toMatchObject({
      registrationId: "reg-1",
      eventId: "seed-event-001",
      addOnId: "a-tee",
      variantId: "v-tee-m",
      nameSnapshot: "Event tee",
      variantLabelSnapshot: "M",
      unitPriceCents: 2500,
      quantity: 1,
      amountCents: 2500,
      platformFeeCents: 99,
      status: "PURCHASED",
    });
  });

  // The entry's own columns must stay free of merchandise money, or refunding an
  // entry would start refunding shirts.
  it("keeps add-on money out of the registration's amountCents", async () => {
    orderWithTee(TICKET_CENTS + TEE_CENTS);

    await post({ id: "pi_addon" });

    const entry = mocks.registration.create.mock.calls[0][0].data;
    expect(entry.amountCents).toBe(10000);
    expect(entry.platformFeeCents).toBe(540);
  });

  // If the total check did not include add-on cents, this order would be
  // CANCELLED and the athlete's money kept. This is the catastrophe guard.
  it("cancels when the charge omits the add-on cents", async () => {
    orderWithTee(TICKET_CENTS);

    await post({ id: "pi_addon" });

    expect(mocks.registration.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.registration.createMany.mock.calls[0][0].data[0].status).toBe("CANCELLED");
    expect(mocks.registrationAddOn.createMany).not.toHaveBeenCalled();
  });

  it("cancels when an add-on code cannot be resolved to a variant", async () => {
    mocks.eventAddOnVariant.findMany.mockResolvedValue([]); // catalogue row gone
    signedEvent({
      id: "pi_addon",
      amount_received: TICKET_CENTS + TEE_CENTS,
      metadata: metadata({
        participantCount: "1",
        participant0: participant(),
        addOns0: "0:aaa111:1",
      }),
    });

    await post({ id: "pi_addon" });

    expect(mocks.registration.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.registration.createMany.mock.calls[0][0].data[0].status).toBe("CANCELLED");
  });

  // The last-size-M race. Losing must never cost the athlete their entry.
  it("drops an oversold line, refunds it, and still confirms the entry", async () => {
    orderWithTee(TICKET_CENTS + TEE_CENTS, 1);
    // The last unit was taken by someone else between payment and confirmation.
    mocks.registrationAddOn.groupBy.mockResolvedValue([
      { variantId: "v-tee-m", _sum: { quantity: 1 } },
    ]);

    await post({ id: "pi_addon" });

    // Entry confirmed, not cancelled.
    expect(mocks.registration.create).toHaveBeenCalledTimes(1);
    expect(mocks.registration.create.mock.calls[0][0].data.status).toBe("CONFIRMED");
    expect(mocks.registration.createMany).not.toHaveBeenCalled();

    // Nothing inserted for the dropped line.
    expect(mocks.registrationAddOn.createMany).not.toHaveBeenCalled();

    // Money returned, from the organiser's balance, keyed so a redelivery is safe.
    expect(mocks.refundsCreate).toHaveBeenCalledTimes(1);
    const [params, options] = mocks.refundsCreate.mock.calls[0];
    expect(params).toMatchObject({
      charge: "ch_1",
      amount: TEE_CENTS,
      reverse_transfer: true,
    });
    expect(options).toEqual({ idempotencyKey: "addon-oversold-pi_addon" });

    // Both parties told.
    expect(mocks.userNotification.create).toHaveBeenCalled();
    expect(
      mocks.notification.create.mock.calls.some(
        (c) => c[0].data.title === "Add-on sold out during checkout",
      ),
    ).toBe(true);
  });

  it("still confirms the entry when the oversold refund itself fails", async () => {
    orderWithTee(TICKET_CENTS + TEE_CENTS, 0);
    mocks.refundsCreate.mockRejectedValue(new Error("Stripe is down"));

    const res = await post({ id: "pi_addon" });

    expect(res.status).toBe(200);
    expect(mocks.registration.create.mock.calls[0][0].data.status).toBe("CONFIRMED");
  });

  // PaymentIntent metadata is client-influenced, so a line pointing at a
  // participant the order does not have must not reach the insert and crash it.
  it("cancels when an add-on line names a participant the order does not have", async () => {
    mocks.eventAddOnVariant.findMany.mockResolvedValue([teeVariant(5)]);
    signedEvent({
      id: "pi_addon",
      amount_received: TICKET_CENTS + TEE_CENTS,
      metadata: metadata({
        participantCount: "1",
        participant0: participant(),
        addOns0: "7:aaa111:1",
      }),
    });

    await post({ id: "pi_addon" });

    expect(mocks.registration.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.registration.createMany.mock.calls[0][0].data[0].status).toBe("CANCELLED");
    expect(mocks.registrationAddOn.createMany).not.toHaveBeenCalled();
  });

  it("does not touch the add-on tables for an order without add-ons", async () => {
    signedEvent({
      id: "pi_plain",
      amount_received: TICKET_CENTS,
      metadata: metadata({ participantCount: "1", participant0: participant() }),
    });

    await post({ id: "pi_plain" });

    expect(mocks.eventAddOnVariant.findMany).not.toHaveBeenCalled();
    expect(mocks.registrationAddOn.createMany).not.toHaveBeenCalled();
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
  });
});
