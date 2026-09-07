import { UploadType, UPLOAD_LIMITS, uploadSizeError } from "@/lib/upload-limits";

// Browser-side upload. Asks the server for a signature, sends the bytes
// straight to S3, then has the server verify what landed.
//
// The file never passes through Amplify's WEB_COMPUTE runtime, which is where
// uploads used to die: its Lambda payload ceiling cuts in just under 4.5 MB of
// file, well under our own 10 MB cap, and rejects the request with an empty-bodied
// 413 before any of our code runs. See app/api/upload/presign/route.ts.

export class UploadError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "UploadError";
    this.status = status;
  }
}

const GENERIC = "Upload failed. Please try again.";

async function errorFrom(res: Response, fallback = GENERIC): Promise<UploadError> {
  const data: { error?: string } = await res.json().catch(() => ({}));
  return new UploadError(data.error || fallback, res.status);
}

// Posts to /api/upload, which reads the bytes itself and writes them to
// public/uploads. Only reached when no bucket is configured, i.e. a laptop or
// the Docker image, where there is no payload ceiling to work around.
async function uploadThroughServer(file: File, type: UploadType): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("type", type);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) throw await errorFrom(res);
  const { fileUrl } = await res.json();
  return fileUrl as string;
}

export async function uploadFile(file: File, type: UploadType): Promise<string> {
  // Fail before the round trip when the file is plainly too big. The pickers
  // check this too, but every caller gets the guarantee this way.
  const tooBig = uploadSizeError(type, file.size);
  if (tooBig) throw new UploadError(tooBig, 400);

  const presignRes = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, contentType: file.type, size: file.size }),
  });
  if (!presignRes.ok) throw await errorFrom(presignRes);

  const presign: {
    mode: "proxy" | "s3";
    url?: string;
    fields?: Record<string, string>;
    key?: string;
  } = await presignRes.json();

  if (presign.mode === "proxy") return uploadThroughServer(file, type);

  const { url, fields, key } = presign;
  if (!url || !fields || !key) throw new UploadError(GENERIC, 500);

  const fd = new FormData();
  // The signed fields have to precede the file: S3 ignores anything that comes
  // after it in the form.
  for (const [name, value] of Object.entries(fields)) fd.append(name, value);
  fd.append("file", file);

  let s3Res: Response;
  try {
    s3Res = await fetch(url, { method: "POST", body: fd });
  } catch {
    // A CORS rejection or a dropped connection both land here with no status.
    throw new UploadError("Could not reach the upload service. Check your connection and try again.", 0);
  }
  if (!s3Res.ok) {
    // S3 answers with XML, not JSON. The one case worth naming is a file that
    // beat the client-side check, which trips the signed content-length-range.
    const detail = await s3Res.text().catch(() => "");
    if (detail.includes("EntityTooLarge")) {
      throw new UploadError(UPLOAD_LIMITS[type].label, 400);
    }
    throw new UploadError(GENERIC, s3Res.status);
  }

  const completeRes = await fetch("/api/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, type, contentType: file.type }),
  });
  if (!completeRes.ok) throw await errorFrom(completeRes);
  const { fileUrl } = await completeRes.json();
  return fileUrl as string;
}
