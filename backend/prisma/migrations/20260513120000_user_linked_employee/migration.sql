-- AlterTable
ALTER TABLE "User" ADD COLUMN "linkedEmployeeId" TEXT;

-- CreateIndex
CREATE INDEX "User_linkedEmployeeId_idx" ON "User"("linkedEmployeeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_linkedEmployeeId_fkey" FOREIGN KEY ("linkedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
