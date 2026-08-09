import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { getOrganiserSession, getAdminSession, getUserSession } from "@/lib/amplify-server";

// Prefer local disk in development — staging/prod S3 buckets often aren't
// reachable from a laptop, and .env may still contain AWS keys.
const useS3 =
  process.env.NODE_ENV === "production"
    ? !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
    : process.env.UPLOAD_TO_S3 === "true" &&
      !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

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

  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/avi",
    "video/ogg",
    "application/pdf",
  ];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "File type not allowed." }, { status: 400 });
  }
  if (type === "document" && file.type !== "application/pdf") {
    return NextResponse.json({ error: "Documents must be PDF." }, { status: 400 });
  }
  if (type === "document" && file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "PDF must be 15 MB or smaller." }, { status: 400 });
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

  try {
    if (useS3) {
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      const { s3, S3_BUCKET } = await import("@/lib/s3");
      const key = `uploads/${session.sub}/${type}/${filename}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: file.type,
        })
      );
      const baseUrl =
        process.env.NEXT_PUBLIC_CDN_URL ||
        `https://${S3_BUCKET}.s3.ap-southeast-2.amazonaws.com`;
      return NextResponse.json({ fileUrl: `${baseUrl}/${key}` });
    }

    // Local dev: save to public/uploads/
    const dir = join(process.cwd(), "public", "uploads", type);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), buffer);
    return NextResponse.json({ fileUrl: `/uploads/${type}/${filename}` });
  } catch (err) {
    console.error("Upload failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
