-- Private athlete details used to prefill event registrations (not public).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mobile" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dateOfBirth" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emergencyContactName" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emergencyContactPhone" TEXT;
