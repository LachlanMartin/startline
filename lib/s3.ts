import { S3Client } from "@aws-sdk/client-s3";

export const S3_REGION =
  process.env.AWS_S3_REGION || process.env.AWS_REGION || "ap-southeast-2";

// AWS_S3_BUCKET reaches the app from Secrets Manager, which the build writes
// into .env.production. That file never ships with the deployed artefact, so on
// Amplify the name that actually exists at runtime is UPLOADS_BUCKET, set on the
// branch by Terraform.
export const S3_BUCKET =
  process.env.AWS_S3_BUCKET || process.env.UPLOADS_BUCKET || "";

// The bucket blocks public access, so objects are read back through CloudFront.
// NEXT_PUBLIC_ variables are inlined at build time; CDN_URL is the runtime one.
export const S3_PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_CDN_URL ||
  process.env.CDN_URL ||
  (S3_BUCKET ? `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com` : "");

// No explicit credentials: Amplify's compute role exposes temporary ones through
// the standard AWS_* variables, and naming only the key and secret drops the
// session token they come with, which fails every signature. The default
// provider chain picks up the whole set, and falls back to the shared AWS config
// on a laptop.
export const s3 = new S3Client({ region: S3_REGION });
