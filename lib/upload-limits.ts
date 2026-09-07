// Per-type upload size caps, shared by the /api/upload route (enforcement)
// and the pickers that select files client-side (early feedback). Uploads in
// the event wizard are deferred to submit, so without the client-side check an
// oversized file is accepted silently and only fails five steps later.

export type UploadType = "logo" | "cover" | "photo" | "video" | "avatar" | "document";

export const UPLOAD_LIMITS: Record<UploadType, { bytes: number; label: string }> = {
  logo:     { bytes: 10 * 1024 * 1024,  label: "Image must be 10 MB or smaller."  },
  cover:    { bytes: 10 * 1024 * 1024,  label: "Image must be 10 MB or smaller."  },
  photo:    { bytes: 10 * 1024 * 1024,  label: "Image must be 10 MB or smaller."  },
  avatar:   { bytes: 10 * 1024 * 1024,  label: "Image must be 10 MB or smaller."  },
  video:    { bytes: 200 * 1024 * 1024, label: "Video must be 200 MB or smaller." },
  document: { bytes: 15 * 1024 * 1024,  label: "PDF must be 15 MB or smaller."    },
};

// Returns the rejection message for an oversized file, or null when the size
// is within the cap (or the type is unknown; the route's own type allowlist
// rejects those before size is ever considered).
export function uploadSizeError(type: string, size: number): string | null {
  const limit = UPLOAD_LIMITS[type as UploadType];
  if (!limit) return null;
  return size > limit.bytes ? limit.label : null;
}

// The MIME allowlist per upload type, and the extension each MIME maps to.
// Shared by /api/upload (which reads the bytes itself) and /api/upload/presign
// (which signs a direct-to-S3 POST). Keeping one copy matters: the presign
// route pins Content-Type as a signature condition, so a divergence here would
// let S3 reject an upload the route had already approved.
export const TYPE_MIMES: Record<UploadType, string[]> = {
  logo:     ["image/jpeg", "image/png", "image/webp", "image/gif"],
  cover:    ["image/jpeg", "image/png", "image/webp", "image/gif"],
  photo:    ["image/jpeg", "image/png", "image/webp", "image/gif"],
  avatar:   ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video:    ["video/mp4", "video/webm", "video/quicktime", "video/avi", "video/ogg"],
  document: ["application/pdf"],
};

export const MIME_EXT: Record<string, string> = {
  "image/jpeg":      "jpg",
  "image/png":       "png",
  "image/webp":      "webp",
  "image/gif":       "gif",
  "video/mp4":       "mp4",
  "video/webm":      "webm",
  "video/quicktime": "mov",
  "video/avi":       "avi",
  "video/ogg":       "ogv",
  "application/pdf": "pdf",
};

export const UPLOAD_TYPES = Object.keys(TYPE_MIMES) as UploadType[];

export function isUploadType(value: unknown): value is UploadType {
  return typeof value === "string" && value in TYPE_MIMES;
}
