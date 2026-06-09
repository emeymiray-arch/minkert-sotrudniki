CREATE TABLE IF NOT EXISTS "CrmMaster" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL DEFAULT '',
  "specialty" TEXT NOT NULL DEFAULT '',
  "salonId" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmMaster_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CrmMaster_active_sortOrder_idx" ON "CrmMaster"("active", "sortOrder");
CREATE INDEX IF NOT EXISTS "CrmMaster_name_idx" ON "CrmMaster"("name");

INSERT INTO "CrmMaster" ("id", "name", "phone", "specialty", "salonId", "active", "sortOrder", "createdAt", "updatedAt")
SELECT DISTINCT e."id", e."name", '', COALESCE(e."position", ''), '', true, 0, NOW(), NOW()
FROM "Employee" e
WHERE e."id" IN (
  SELECT "masterId" FROM "CrmAppointment" WHERE "masterId" IS NOT NULL
  UNION
  SELECT "masterId" FROM "CrmProcedure" WHERE "masterId" IS NOT NULL
)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "CrmAppointment" DROP CONSTRAINT IF EXISTS "CrmAppointment_masterId_fkey";
ALTER TABLE "CrmProcedure" DROP CONSTRAINT IF EXISTS "CrmProcedure_masterId_fkey";

UPDATE "CrmAppointment" SET "masterId" = NULL
WHERE "masterId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CrmMaster" m WHERE m."id" = "CrmAppointment"."masterId");

UPDATE "CrmProcedure" SET "masterId" = NULL
WHERE "masterId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CrmMaster" m WHERE m."id" = "CrmProcedure"."masterId");

ALTER TABLE "CrmAppointment"
  ADD CONSTRAINT "CrmAppointment_masterId_fkey"
  FOREIGN KEY ("masterId") REFERENCES "CrmMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrmProcedure"
  ADD CONSTRAINT "CrmProcedure_masterId_fkey"
  FOREIGN KEY ("masterId") REFERENCES "CrmMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "linkedCrmMasterId" TEXT;
CREATE INDEX IF NOT EXISTS "User_linkedCrmMasterId_idx" ON "User"("linkedCrmMasterId");

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_linkedCrmMasterId_fkey"
    FOREIGN KEY ("linkedCrmMasterId") REFERENCES "CrmMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
