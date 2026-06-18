-- Performance indexes for CRM list/sort and analytics (safe: only adds indexes, no data changes)
CREATE INDEX IF NOT EXISTS "CrmClient_updatedAt_idx" ON "CrmClient"("updatedAt");
CREATE INDEX IF NOT EXISTS "CrmClient_createdAt_idx" ON "CrmClient"("createdAt");
CREATE INDEX IF NOT EXISTS "CrmProcedure_procedureDate_idx" ON "CrmProcedure"("procedureDate");
