ALTER TABLE "OpsSettings" ADD COLUMN IF NOT EXISTS "crmSalons" JSONB;
ALTER TABLE "OpsSettings" ADD COLUMN IF NOT EXISTS "crmMasterIds" JSONB;

ALTER TABLE "CrmAppointment" ADD COLUMN IF NOT EXISTS "salonId" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "CrmAppointment_masterId_startsAt_idx" ON "CrmAppointment"("masterId", "startsAt");
