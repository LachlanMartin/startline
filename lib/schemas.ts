import { z } from "zod";

// Path params — untrusted input, whitelisted before it reaches Prisma.
export const idParams = z.object({ id: z.string().min(1).max(255) });
export const organiserIdParams = z.object({ organiserId: z.string().min(1).max(255) });
export const usernameParams = z.object({ username: z.string().min(1).max(100) });
export const idAnnouncementIdParams = z.object({
  id: z.string().min(1).max(255),
  announcementId: z.string().min(1).max(255),
});

// Event create/update payload — shared by the organiser and admin event routes.
// All fields optional (PATCH semantics); the routes apply their own defaults and
// submit-time required-field checks so existing error messages stay unchanged.
// JSON columns (categories, waves) are kept opaque — Prisma serialises them.
export const eventPayloadSchema = z.object({
  submit: z.boolean().optional(),
  title: z.string().max(200).optional(),
  discipline: z.string().max(80).optional(),
  description: z.string().max(10000).nullable().optional(),
  eventDate: z.string().max(20).optional(),
  endDate: z.string().max(20).nullable().optional(),
  startTime: z.string().max(10).optional(),
  endTime: z.string().max(10).optional(),
  venue: z.string().max(200).optional(),
  address: z.string().max(300).nullable().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  format: z.string().max(100).optional(),
  level: z.string().max(100).optional(),
  categories: z.unknown().optional(),
  cap: z.number().int().min(1).max(1000000).nullable().optional(),
  minAge: z.number().int().min(0).max(150).nullable().optional(),
  waves: z.unknown().optional(),
  inclusions: z.string().max(10000).nullable().optional(),
  extras: z.string().max(10000).nullable().optional(),
  activations: z.string().max(10000).nullable().optional(),
  refundPolicy: z.string().max(10000).nullable().optional(),
  registrationType: z.enum(["startline", "external"]).optional(),
  feeStructure: z.enum(["athlete", "organiser"]).optional(),
  registrationUrl: z.string().max(2000).nullable().optional(),
  accessibilityInfo: z.string().max(10000).nullable().optional(),
  coverImageUrl: z.string().max(2000).nullable().optional(),
  informationPdfUrl: z.string().max(2000).nullable().optional(),
  photos: z.array(z.string().max(3000)).optional(),
});

export const adminEventPayloadSchema = eventPayloadSchema.extend({
  organiserId: z.string().min(1).max(255),
});
