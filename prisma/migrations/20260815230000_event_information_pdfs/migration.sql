-- Replace the single Event.informationPdfUrl with an ordered list of info PDFs.
-- Shape: [{ url, label, name }] — label and name optional, order preserved by array order.
ALTER TABLE "events" ADD COLUMN "informationPdfs" JSONB NOT NULL DEFAULT '[]';

-- Promote the existing single PDF to the first entry of the new array.
UPDATE "events"
SET "informationPdfs" = jsonb_build_array(jsonb_build_object(
  'url', "informationPdfUrl",
  'label', NULL,
  'name', NULL
))
WHERE "informationPdfUrl" IS NOT NULL;

ALTER TABLE "events" DROP COLUMN "informationPdfUrl";
