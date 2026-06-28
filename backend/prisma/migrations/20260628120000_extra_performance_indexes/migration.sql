-- Дополнительные индексы для cron, задач операций и очистки сессий
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

CREATE INDEX IF NOT EXISTS "OpsTask_status_forDate_idx" ON "OpsTask"("status", "forDate");

CREATE INDEX IF NOT EXISTS "OpsTask_block_forDate_status_idx" ON "OpsTask"("block", "forDate", "status");
