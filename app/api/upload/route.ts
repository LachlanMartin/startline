import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getOrganiserSession, getAdminSession, getUserSession } from "@/lib/amplify-server";
import { matchesMagicBytes } from "@/lib/upload-magic-bytes";
import { uploadSizeError } from "@/lib/upload-limits";
import { s3, S3_BUCKET, S3_PUBLIC_BASE_URL } from "@/lib/s3";

// The bucket is the switch, not the presence of AWS keys: Amplify's compute role
// exports keys into the runtime whether or not uploads are configured, and the
// old gate read that as "S3 is ready". Local disk still serves a laptop and the
// Docker image, which keep public/uploads writable.
const useS3 =
  !!S3_BUCKET &&
  (process.env.NODE_ENV === "production" || process.env.UPLOAD_TO_S3 === "true");

if (!useS3 && process.env.NODE_ENV === "production") {
  console.warn(
    "Uploads: no bucket configured (UPLOADS_BUCKET or AWS_S3_BUCKET), falling back to public/uploads. A host with a read-only filesystem will reject every upload."
  );
}

// The bucket is private and readable only through CloudFront, so without a CDN
// base the upload succeeds and the image 403s wherever it is displayed. That
// combination is silent, which is what made the original failure hard to place.
if (
  useS3 &&
  process.env.NODE_ENV === "production" &&
  !process.env.NEXT_PUBLIC_CDN_URL &&
  !process.env.CDN_URL
) {
  console.warn(
    "Uploads: no CDN base URL (CDN_URL or NEXT_PUBLIC_CDN_URL). Files will be linked directly to the private bucket and will not load."
  );
}

export async function POST(req: NextRequest) {
  const session =
    (await getOrganiserSession()) ??
    (await getAdminSession()) ??
    (await getUserSession());
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string;

  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!["logo", "cover", "photo", "video", "avatar", "document"].includes(type)) {
    return NextResponse.json({ error: "Invalid upload type." }, { status: 400 });
  }

  const TYPE_MIMES: Record<string, string[]> = {
    logo: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    cover: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    photo: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    avatar: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    video: ["video/mp4", "video/webm", "video/quicktime", "video/avi", "video/ogg"],
    document: ["application/pdf"],
  };
  if (!TYPE_MIMES[type]?.includes(file.type)) {
    return NextResponse.json({ error: "File type not allowed for this upload." }, { status: 400 });
  }

  // Every type gets a cap, not just PDFs: images used to be unbounded, so a
  // 60 MB phone photo sailed through here and died against the platform's own
  // request-size ceiling with an unhelpful status (see issue #300).
  const sizeError = uploadSizeError(type, file.size);
  if (sizeError) {
    return NextResponse.json({ error: sizeError }, { status: 400 });
  }

  const mimeExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/avi": "avi",
    "video/ogg": "ogv",
    "application/pdf": "pdf",
  };
  const ext = mimeExt[file.type] ?? "bin";
  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // Never trust the client-declared Content-Type alone: verify the file's
  // magic bytes match it so a text/html payload can't be stored under a
  // benign extension and served from our own origin.
  if (!matchesMagicBytes(buffer, file.type)) {
    return NextResponse.json({ error: "File content does not match its type." }, { status: 400 });
  }

  try {
    if (useS3) {
      const key = `uploads/${session.sub}/${type}/${filename}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: file.type,
        })
      );
      return NextResponse.json({ fileUrl: `${S3_PUBLIC_BASE_URL}/${key}` });
    }

    // Local dev: save to public/uploads/
    const dir = join(process.cwd(), "public", "uploads", type);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), buffer);
    return NextResponse.json({ fileUrl: `/uploads/${type}/${filename}` });
  } catch (err) {
    // Log enough to tell a misconfigured bucket from a rejected object: the
    // route used to swallow both into an unqualified 500.
    console.error("Upload failed:", { type, size: file.size, useS3 }, err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
