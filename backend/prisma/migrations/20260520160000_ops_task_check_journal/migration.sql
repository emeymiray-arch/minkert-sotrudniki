-- CreateEnum
CREATE TYPE "OpsTaskCheckType" AS ENUM ('NONE', 'ATTENDANCE', 'CHECKLIST', 'REPORT', 'GENERIC');
CREATE TYPE "OpsAttendanceMark" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'WARNED');

-- AlterTable
ALTER TABLE "OpsTask" ADD COLUMN "checkType" "OpsTaskCheckType" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "OpsTaskCheckEntry" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "recordDate" DATE NOT NULL,
    "attendanceMark" "OpsAttendanceMark",
    "checklistOpened" BOOLEAN,
    "checklistDone" BOOLEAN,
    "checklistIgnored" BOOLEAN,
    "reportSubmitted" BOOLEAN,
    "reportError" BOOLEAN,
    "reportNeedsFix" BOOLEAN,
    "comment" TEXT NOT NULL DEFAULT '',
    "extraNote" TEXT NOT NULL DEFAULT '',
    "flagViolation" BOOLEAN NOT NULL DEFAULT false,
    "recordedByName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsTaskCheckEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpsTask_checkType_idx" ON "OpsTask"("checkType");
CREATE INDEX "OpsTaskCheckEntry_employeeId_recordDate_idx" ON "OpsTaskCheckEntry"("employeeId", "recordDate");
CREATE INDEX "OpsTaskCheckEntry_taskId_recordDate_idx" ON "OpsTaskCheckEntry"("taskId", "recordDate");
CREATE UNIQUE INDEX "OpsTaskCheckEntry_taskId_employeeId_recordDate_key" ON "OpsTaskCheckEntry"("taskId", "employeeId", "recordDate");

-- AddForeignKey
ALTER TABLE "OpsTaskCheckEntry" ADD CONSTRAINT "OpsTaskCheckEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "OpsTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpsTaskCheckEntry" ADD CONSTRAINT "OpsTaskCheckEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
