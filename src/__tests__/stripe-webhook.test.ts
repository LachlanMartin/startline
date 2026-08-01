import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  registration: { count: vi.fn(), create: vi.fn(), createMany: vi.fn() },
  user: { upsert: vi.fn() },
  event: { findUnique: vi.fn() },
  notification: { create: vi.fn() },
  organiser: { updateMany: vi.fn() },
  sendEmail: vi.fn(),
  ensureCognitoUser: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent: mocks.constructEvent } }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    registration: mocks.registration,
    user: mocks.user,
    event: mocks.event,
    notification: mocks.notification,
    organiser: mocks.organiser,
  },
}));

vi.mock("@/lib/email", () => ({
  sendRegistrationConfirmationEmail: mocks.sendEmail,
}));

vi.mock("@/lib/athlete-accounts", () => ({
  ensureAthleteCognitoUser: mocks.ensureCognitoUser,
}));

import { POST } from "@/app/api/stripe/webhook/route";
import { parseParticipantsFromMetadata, parseWavePricing } from "@/lib/stripe-webhook";

const metadata = (overrides: Record<string, string>): Stripe.Metadata => ({
  eventId: "seed-event-001",
  organiserId: "org-1",
  waveLabel: "General",
  wavePricing: JSON.stringify({ General: { p: 10000, f: 540 } }),
  userName: "Jordan Clarke",
  userEmail: "jordan@example.com",
  ticketPriceCents: "10000",
  platformFeeCents: "540",
  platformFeeCentsPerTicket: "540",
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

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_00000000000000000000000000000000";
  mocks.user.upsert.mockResolvedValue({ id: "user-1" });
  mocks.sendEmail.mockResolvedValue(undefined);
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

describe("parseWavePricing", () => {
  it("parses a valid pricing map", () => {
    expect(parseWavePricing({ wavePricing: JSON.stringify({ General: { p: 100, f: 5 } }) })).toEqual({
      General: { p: 100, f: 5 },
    });
  });

  it("returns an empty object for invalid JSON", () => {
    expect(parseWavePricing({ wavePricing: "not-json" })).toEqual({});
  });

  it("returns an empty object when absent", () => {
    expect(parseWavePricing({})).toEqual({});
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
      metadata: metadata({
        participantCount: "1",
        participant0: JSON.stringify({
          fn: "Jordan", ln: "Clarke", em: "jordan@example.com", dob: "1990-01-01",
          ecn: "Sam", ecp: "0400 000 000", wav: "General",
        }),
      }),
    });
    mocks.registration.count.mockResolvedValue(0);
    mocks.registration.createMany.mockResolvedValue({ count: 1 });
    mocks.event.findUnique.mockResolvedValue({
      title: "Apex Throwdown", eventDate: "2026-08-15", startTime: "07:30",
      venue: "MSAC", city: "Melbourne", state: "vic",
    });
    mocks.notification.create.mockResolvedValue({});

    const res = await post({ id: "pi_123", type: "payment_intent.succeeded" });
    expect(res.status).toBe(200);

    expect(mocks.registration.createMany).toHaveBeenCalledTimes(1);
    const created = mocks.registration.createMany.mock.calls[0][0].data[0];
    expect(created).toMatchObject({
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

  it("is idempotent — skips a PaymentIntent that was already processed", async () => {
    signedEvent({ id: "pi_123", metadata: metadata({}) });
    mocks.registration.count.mockResolvedValue(1);

    await post({ id: "pi_123" });
    expect(mocks.registration.createMany).not.toHaveBeenCalled();
    expect(mocks.notification.create).not.toHaveBeenCalled();
  });

  it("creates a CANCELLED registration when participant metadata is missing", async () => {
    // Metadata with no participant data and no legacy fields → parser returns [].
    signedEvent({ id: "pi_123", metadata: { eventId: "seed-event-001", organiserId: "org-1" } });
    mocks.registration.count.mockResolvedValue(0);
    mocks.registration.create.mockResolvedValue({});

    await post({ id: "pi_123" });
    expect(mocks.registration.create).toHaveBeenCalledTimes(1);
    const created = mocks.registration.create.mock.calls[0][0].data;
    expect(created.status).toBe("CANCELLED");
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
