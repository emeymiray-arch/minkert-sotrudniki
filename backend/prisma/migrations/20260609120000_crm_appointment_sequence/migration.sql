ALTER TABLE "CrmAppointment" ADD COLUMN IF NOT EXISTS "sequenceNumber" INTEGER;

UPDATE "CrmAppointment" a
SET "sequenceNumber" = COALESCE(
  (
    SELECT c."visitsCount" + 1
    FROM "CrmClient" c
    WHERE c."id" = a."clientId"
  ),
  1
)
WHERE "sequenceNumber" IS NULL;

ALTER TABLE "CrmAppointment" ALTER COLUMN "sequenceNumber" SET DEFAULT 1;
ALTER TABLE "CrmAppointment" ALTER COLUMN "sequenceNumber" SET NOT NULL;
