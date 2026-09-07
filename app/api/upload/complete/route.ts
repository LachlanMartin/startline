import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getOrganiserSession, getAdminSession, getUserSession } from "@/lib/amplify-server";
import { matchesMagicBytes } from "@/lib/upload-magic-bytes";
import { TYPE_MIMES, isUploadType } from "@/lib/upload-limits";
import { s3, S3_BUCKET, S3_PUBLIC_BASE_URL, UPLOADS_USE_S3 } from "@/lib/s3";

// Direct-to-S3 means the server never sees the bytes on their way past, so the
// magic-byte check that /api/upload does inline has to happen after the fact.
// A ranged GET of the first few bytes is enough to tell a real JPEG from a
// payload wearing its Content-Type, and anything that fails is deleted before
// its URL is ever handed back. Without this step a signed POST would be a way
// to park arbitrary content in the bucket under an image content type.
const MAGIC_BYTE_RANGE = "bytes=0-15";

export async function POST(req: NextRequest) {
  const session =
    (await getOrganiserSession()) ??
    (await getAdminSession()) ??
    (await getUserSession());
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  if (!UPLOADS_USE_S3) {
    return NextResponse.json({ error: "Direct uploads are not configured." }, { status: 400 });
  }

  const body: { key?: unknown; type?: unknown; contentType?: unknown } = await req
    .json()
    .catch(() => ({}));
  const { key, type, contentType } = body;

  if (typeof key !== "string" || !isUploadType(type) || typeof contentType !== "string") {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!TYPE_MIMES[type].includes(contentType)) {
    return NextResponse.json({ error: "File type not allowed for this upload." }, { status: 400 });
  }
  // The presign route keys every object under the caller's own sub. Re-deriving
  // that prefix here stops one signed-in user naming another user's object and
  // having the failure path delete it.
  if (key !== `uploads/${session.sub}/${type}/${key.split("/").pop()}`) {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  let head: Uint8Array;
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: key, Range: MAGIC_BYTE_RANGE })
    );
    head = (await res.Body?.transformToByteArray()) ?? new Uint8Array();
  } catch (err) {
    // The object should exist: the browser only calls this after S3 accepted
    // the POST. A miss means the upload was abandoned or the key is wrong.
    console.error("Upload verify: could not read object", { key }, err);
    return NextResponse.json({ error: "Upload could not be verified. Please try again." }, { status: 400 });
  }

  if (!matchesMagicBytes(Buffer.from(head), contentType)) {
    await s3
      .send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
      .catch(err => console.error("Upload verify: could not delete rejected object", { key }, err));
    return NextResponse.json({ error: "File content does not match its type." }, { status: 400 });
  }

  return NextResponse.json({ fileUrl: `${S3_PUBLIC_BASE_URL}/${key}` });
}
