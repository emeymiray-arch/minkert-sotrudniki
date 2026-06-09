-- Роль мастера (CRM только чтение)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MASTER';

-- Цены и скидки в процедурах
ALTER TABLE "CrmProcedure" ADD COLUMN IF NOT EXISTS "basePrice" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CrmProcedure" ADD COLUMN IF NOT EXISTS "discountPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CrmProcedure" ADD COLUMN IF NOT EXISTS "discountAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CrmProcedure" ADD COLUMN IF NOT EXISTS "extraService" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CrmProcedure" ADD COLUMN IF NOT EXISTS "extraCost" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CrmProcedure" ADD COLUMN IF NOT EXISTS "finalPrice" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CrmProcedure" ADD COLUMN IF NOT EXISTS "masterSalary" INTEGER NOT NULL DEFAULT 0;

UPDATE "CrmProcedure"
SET
  "basePrice" = COALESCE("cost", 0),
  "finalPrice" = COALESCE("cost", 0),
  "masterSalary" = ROUND(COALESCE("cost", 0) * 0.18)
WHERE "basePrice" = 0 AND "cost" > 0;

ALTER TABLE "CrmClient" ADD COLUMN IF NOT EXISTS "discountPercent" INTEGER NOT NULL DEFAULT 0;

-- Строки расходов по дням
CREATE TABLE IF NOT EXISTS "OpsFinanceExpenseItem" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "title" TEXT NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpsFinanceExpenseItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OpsFinanceExpenseItem_date_idx" ON "OpsFinanceExpenseItem"("date");

-- Уведомления
CREATE TABLE IF NOT EXISTS "AppNotification" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "roleTarget" "UserRole",
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL DEFAULT '',
  "payload" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AppNotification_userId_readAt_idx" ON "AppNotification"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "AppNotification_roleTarget_readAt_idx" ON "AppNotification"("roleTarget", "readAt");
