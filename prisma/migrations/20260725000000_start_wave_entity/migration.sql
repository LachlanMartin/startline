-- Promote organiser start waves from Event.startWaves JSON to a real table so
-- capacity, renames, and bulk moves work against a stable id. Registrations link
-- via startWaveId; startWaveLabel is kept as a denormalised mirror for now.

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "startWaveId" TEXT;

-- CreateTable
CREATE TABLE "start_waves" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startTime" TEXT,
    "capacity" INTEGER,
    "finishMin" INTEGER,
    "finishMax" INTEGER,
    "genders" TEXT[],
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "start_waves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "start_waves_eventId_idx" ON "start_waves"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "start_waves_eventId_label_key" ON "start_waves"("eventId", "label");

-- CreateIndex
CREATE INDEX "registrations_startWaveId_idx" ON "registrations"("startWaveId");

-- AddForeignKey
ALTER TABLE "start_waves" ADD CONSTRAINT "start_waves_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_startWaveId_fkey" FOREIGN KEY ("startWaveId") REFERENCES "start_waves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: create one start_waves row per element of each event's startWaves
-- JSON array, preserving array order. DISTINCT ON guards the (eventId, label)
-- unique index against any case-insensitive duplicate labels in legacy data.
INSERT INTO "start_waves" (
    "id", "eventId", "label", "startTime", "capacity",
    "finishMin", "finishMax", "genders", "ageMin", "ageMax",
    "sortOrder", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid(),
    src."eventId",
    src.label,
    NULLIF(src.w->>'startTime', ''),
    (src.w->>'capacity')::int,
    (src.w->>'finishMin')::int,
    (src.w->>'finishMax')::int,
    CASE WHEN jsonb_typeof(src.w->'genders') = 'array'
         THEN ARRAY(SELECT jsonb_array_elements_text(src.w->'genders'))
         ELSE '{}'::text[] END,
    (src.w->>'ageMin')::int,
    (src.w->>'ageMax')::int,
    src.ord - 1,
    now(),
    now()
FROM (
    SELECT DISTINCT ON (e.id, lower(w->>'label'))
        e.id                AS "eventId",
        w->>'label'         AS label,
        w,
        ord
    FROM "events" e,
         jsonb_array_elements(e."startWaves") WITH ORDINALITY AS t(w, ord)
    WHERE e."startWaves" IS NOT NULL
      AND jsonb_typeof(e."startWaves") = 'array'
      AND COALESCE(w->>'label', '') <> ''
    ORDER BY e.id, lower(w->>'label'), ord
) src;

-- Backfill: point each registration at its start wave by matching the label it
-- already carries (case-insensitive, as labels are unique per event that way).
UPDATE "registrations" r
SET "startWaveId" = sw."id"
FROM "start_waves" sw
WHERE sw."eventId" = r."eventId"
  AND lower(sw."label") = lower(r."startWaveLabel")
  AND COALESCE(r."startWaveLabel", '') <> '';
