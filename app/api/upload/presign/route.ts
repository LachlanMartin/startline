import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getOrganiserSession, getAdminSession, getUserSession } from "@/lib/amplify-server";
import { UPLOAD_LIMITS, TYPE_MIMES, MIME_EXT, isUploadType, uploadSizeError } from "@/lib/upload-limits";
import { s3, S3_BUCKET, S3_PUBLIC_BASE_URL, UPLOADS_USE_S3 } from "@/lib/s3";

// Hands the browser a short-lived signature so the file goes straight to S3.
//
// Uploads used to stream through /api/upload, which runs on Amplify's
// WEB_COMPUTE platform. That is Lambda-backed, and the request body is
// base64-encoded into the invocation payload, so the 6 MB payload ceiling lands
// just under 4.5 MB of actual file. Our own cap is 10 MB, so every image
// between those two numbers passed the client-side check and was then rejected
// by the platform before the route ever ran, with a 413 carrying no body at
// all. That empty body is why the wizard could only say "please try again"
// instead of naming a reason (issue #300 capped sizes at 10 MB, which is still
// more than twice what the runtime accepts; this removes the ceiling instead).
//
// Measured on staging: 4.30 MB reaches the handler and 401s, 4.50 MB returns
// 413 with a zero-length body. See the Uploads section in AGENTS.md.
//
// Direct-to-S3 has no such ceiling. The bucket already allows POST from the
// portal origins and exposes ETag, so no infrastructure change is needed.

const PRESIGN_EXPIRY_SECONDS = 300;

export async function POST(req: NextRequest) {
  const session =
    (await getOrganiserSession()) ??
    (await getAdminSession()) ??
    (await getUserSession());
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  // Without a bucket there is nothing to sign. Local dev and the Docker image
  // write to public/uploads, so tell the client to post to /api/upload instead
  // rather than failing: on a laptop the payload ceiling does not exist.
  if (!UPLOADS_USE_S3) return NextResponse.json({ mode: "proxy" });

  const body: { type?: unknown; contentType?: unknown; size?: unknown } = await req
    .json()
    .catch(() => ({}));
  const { type, contentType, size } = body;

  if (!isUploadType(type)) {
    return NextResponse.json({ error: "Invalid upload type." }, { status: 400 });
  }
  if (typeof contentType !== "string" || !TYPE_MIMES[type].includes(contentType)) {
    return NextResponse.json({ error: "File type not allowed for this upload." }, { status: 400 });
  }
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "Invalid file size." }, { status: 400 });
  }
  const sizeError = uploadSizeError(type, size);
  if (sizeError) return NextResponse.json({ error: sizeError }, { status: 400 });

  const key = `uploads/${session.sub}/${type}/${randomUUID()}.${MIME_EXT[contentType] ?? "bin"}`;

  try {
    const { url, fields } = await createPresignedPost(s3, {
      Bucket: S3_BUCKET,
      Key: key,
      Expires: PRESIGN_EXPIRY_SECONDS,
      Fields: { "Content-Type": contentType },
      // S3 enforces both, so a client that lies in the request above still
      // cannot store an oversized object or one under a different type. The
      // size check here only exists to fail fast with a readable message.
      Conditions: [
        ["content-length-range", 1, UPLOAD_LIMITS[type].bytes],
        ["eq", "$Content-Type", contentType],
      ],
    });
    return NextResponse.json({ mode: "s3", url, fields, key, fileUrl: `${S3_PUBLIC_BASE_URL}/${key}` });
  } catch (err) {
    console.error("Presign failed:", { type, size, bucket: S3_BUCKET }, err);
    return NextResponse.json({ error: "Could not start the upload. Please try again." }, { status: 500 });
  }
}
