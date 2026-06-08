-- План/факт: ручные цели по месяцам (JSON в OpsSettings.businessPlans)
ALTER TABLE "OpsSettings" ADD COLUMN IF NOT EXISTS "businessPlans" JSONB;
