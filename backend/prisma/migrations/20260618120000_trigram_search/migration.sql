-- Fast ILIKE search on client name and phone (pg_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "CrmClient_fullName_trgm_idx"
  ON "CrmClient" USING gin ("fullName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "CrmClient_phone_trgm_idx"
  ON "CrmClient" USING gin ("phone" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "CrmClient_phoneNormalized_trgm_idx"
  ON "CrmClient" USING gin ("phoneNormalized" gin_trgm_ops);

-- Reminder cron: filter by kind + recent createdAt
CREATE INDEX IF NOT EXISTS "AppNotification_kind_createdAt_idx"
  ON "AppNotification"("kind", "createdAt" DESC);
