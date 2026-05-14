-- CreateEnum
CREATE TYPE "DiaryLineState" AS ENUM ('EMPTY', 'CHECK', 'CROSS');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "diaryToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_diaryToken_key" ON "Employee"("diaryToken");

-- CreateTable
CREATE TABLE "DiaryDay" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiaryDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryLine" (
    "id" TEXT NOT NULL,
    "diaryDayId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL DEFAULT '',
    "state" "DiaryLineState" NOT NULL DEFAULT 'EMPTY',

    CONSTRAINT "DiaryLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiaryDay_employeeId_date_key" ON "DiaryDay"("employeeId", "date");

-- CreateIndex
CREATE INDEX "DiaryDay_employeeId_idx" ON "DiaryDay"("employeeId");

-- CreateIndex
CREATE INDEX "DiaryLine_diaryDayId_idx" ON "DiaryLine"("diaryDayId");

-- AddForeignKey
ALTER TABLE "DiaryDay" ADD CONSTRAINT "DiaryDay_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryLine" ADD CONSTRAINT "DiaryLine_diaryDayId_fkey" FOREIGN KEY ("diaryDayId") REFERENCES "DiaryDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
