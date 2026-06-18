-- Безопасные индексы для ускорения CRM (данные НЕ удаляются, таблицы НЕ меняются).
-- Перед запуском: сделайте бэкап Neon (scripts/run-neon-backup.sh).
-- Выполните в Neon → SQL Editor целиком или по блокам.

-- Производительность списков
CREATE INDEX IF NOT EXISTS "CrmClient_updatedAt_idx" ON "CrmClient"("updatedAt");
CREATE INDEX IF NOT EXISTS "CrmClient_createdAt_idx" ON "CrmClient"("createdAt");
CREATE INDEX IF NOT EXISTS "CrmProcedure_procedureDate_idx" ON "CrmProcedure"("procedureDate");

-- Быстрый поиск по имени и телефону
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "CrmClient_fullName_trgm_idx"
  ON "CrmClient" USING gin ("fullName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "CrmClient_phone_trgm_idx"
  ON "CrmClient" USING gin ("phone" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "CrmClient_phoneNormalized_trgm_idx"
  ON "CrmClient" USING gin ("phoneNormalized" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "AppNotification_kind_createdAt_idx"
  ON "AppNotification"("kind", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
