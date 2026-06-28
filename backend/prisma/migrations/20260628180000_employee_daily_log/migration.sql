-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "EmployeeDailyLog" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "planText" TEXT NOT NULL DEFAULT '',
    "reportOnTime" BOOLEAN NOT NULL DEFAULT false,
    "planDone" BOOLEAN NOT NULL DEFAULT false,
    "noViolations" BOOLEAN NOT NULL DEFAULT false,
    "qualityOk" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeDailyLog_employeeId_date_idx" ON "EmployeeDailyLog"("employeeId", "date");

-- CreateIndex
CREATE INDEX "EmployeeDailyLog_date_idx" ON "EmployeeDailyLog"("date");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeDailyLog_employeeId_date_key" ON "EmployeeDailyLog"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "EmployeeDailyLog" ADD CONSTRAINT "EmployeeDailyLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
