-- CreateEnum
CREATE TYPE "OpsTimeBlock" AS ENUM ('MORNING', 'DAY', 'EVENING', 'NEXT_DAY', 'WEEK');
CREATE TYPE "OpsTaskStatus" AS ENUM ('PENDING', 'DONE', 'NOT_DONE', 'PARTIAL', 'OVERDUE', 'NEEDS_ATTENTION');
CREATE TYPE "OpsViolationType" AS ENUM ('LATE', 'LEFT_WORKPLACE', 'NO_WARNING', 'MISSED_REPORT', 'IGNORED_TASK', 'REPEAT', 'OTHER');
CREATE TYPE "OpsReportStatus" AS ENUM ('PENDING', 'SUBMITTED', 'MISSED', 'ERROR');
CREATE TYPE "OpsContentRole" AS ENUM ('STORY', 'REEL');

-- CreateTable
CREATE TABLE "OpsBlockConfig" (
    "id" TEXT NOT NULL,
    "block" "OpsTimeBlock" NOT NULL,
    "title" TEXT NOT NULL,
    "timeStart" TEXT NOT NULL DEFAULT '09:00',
    "timeEnd" TEXT NOT NULL DEFAULT '18:00',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsBlockConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpsTask" (
    "id" TEXT NOT NULL,
    "block" "OpsTimeBlock" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "forDate" DATE NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" "OpsTaskStatus" NOT NULL DEFAULT 'PENDING',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "templateKey" TEXT,
    "assigneeId" TEXT,
    "markedAt" TIMESTAMP(3),
    "markedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpsTaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT,
    "authorName" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsTaskComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpsTaskNote" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsTaskNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpsStaffProfile" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "schedule" TEXT NOT NULL DEFAULT '',
    "disciplineLevel" INTEGER NOT NULL DEFAULT 100,
    "warningsCount" INTEGER NOT NULL DEFAULT 0,
    "preferences" TEXT NOT NULL DEFAULT '',
    "workStyle" TEXT NOT NULL DEFAULT '',
    "traits" TEXT NOT NULL DEFAULT '',
    "managerNotes" TEXT NOT NULL DEFAULT '',
    "clientAttitude" TEXT NOT NULL DEFAULT '',
    "qualityNotes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsStaffProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpsViolation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "OpsViolationType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsViolation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpsContentReview" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "roleType" "OpsContentRole" NOT NULL DEFAULT 'STORY',
    "title" TEXT NOT NULL DEFAULT '',
    "publishedAt" TIMESTAMP(3),
    "reviewDate" DATE NOT NULL,
    "reach" INTEGER,
    "engagement" DOUBLE PRECISION,
    "views" INTEGER,
    "visualScore" INTEGER,
    "brandMatch" BOOLEAN,
    "qualityNote" TEXT NOT NULL DEFAULT '',
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsContentReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpsReportLog" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "formKey" TEXT NOT NULL,
    "reportDate" DATE NOT NULL,
    "status" "OpsReportStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "errorNote" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsReportLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpsActivityLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL DEFAULT '',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpsSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "googleFormMappings" JSONB,
    "formsWebhookNote" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpsBlockConfig_block_key" ON "OpsBlockConfig"("block");
CREATE INDEX "OpsTask_block_forDate_idx" ON "OpsTask"("block", "forDate");
CREATE INDEX "OpsTask_forDate_idx" ON "OpsTask"("forDate");
CREATE INDEX "OpsTask_assigneeId_idx" ON "OpsTask"("assigneeId");
CREATE INDEX "OpsTask_status_idx" ON "OpsTask"("status");
CREATE INDEX "OpsTaskComment_taskId_idx" ON "OpsTaskComment"("taskId");
CREATE INDEX "OpsTaskNote_taskId_idx" ON "OpsTaskNote"("taskId");
CREATE UNIQUE INDEX "OpsStaffProfile_employeeId_key" ON "OpsStaffProfile"("employeeId");
CREATE INDEX "OpsViolation_employeeId_idx" ON "OpsViolation"("employeeId");
CREATE INDEX "OpsViolation_occurredAt_idx" ON "OpsViolation"("occurredAt");
CREATE INDEX "OpsContentReview_employeeId_idx" ON "OpsContentReview"("employeeId");
CREATE INDEX "OpsContentReview_reviewDate_idx" ON "OpsContentReview"("reviewDate");
CREATE INDEX "OpsReportLog_reportDate_idx" ON "OpsReportLog"("reportDate");
CREATE INDEX "OpsReportLog_employeeId_idx" ON "OpsReportLog"("employeeId");
CREATE INDEX "OpsActivityLog_entityType_entityId_idx" ON "OpsActivityLog"("entityType", "entityId");
CREATE INDEX "OpsActivityLog_createdAt_idx" ON "OpsActivityLog"("createdAt");

-- AddForeignKey
ALTER TABLE "OpsTask" ADD CONSTRAINT "OpsTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OpsTaskComment" ADD CONSTRAINT "OpsTaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "OpsTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpsTaskNote" ADD CONSTRAINT "OpsTaskNote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "OpsTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpsStaffProfile" ADD CONSTRAINT "OpsStaffProfile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpsViolation" ADD CONSTRAINT "OpsViolation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpsContentReview" ADD CONSTRAINT "OpsContentReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpsReportLog" ADD CONSTRAINT "OpsReportLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
