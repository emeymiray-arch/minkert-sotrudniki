-- Performance indexes for CRM list/sort and analytics
CREATE INDEX "CrmClient_updatedAt_idx" ON "CrmClient"("updatedAt");
CREATE INDEX "CrmClient_createdAt_idx" ON "CrmClient"("createdAt");
CREATE INDEX "CrmProcedure_procedureDate_idx" ON "CrmProcedure"("procedureDate");
