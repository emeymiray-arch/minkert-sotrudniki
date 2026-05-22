-- CreateTable
CREATE TABLE "OpsCategory" (
    "id" TEXT NOT NULL,
    "block" "OpsTimeBlock" NOT NULL,
    "forDate" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsCategory_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "OpsTask" ADD COLUMN "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "OpsCategory_block_forDate_idx" ON "OpsCategory"("block", "forDate");
CREATE INDEX "OpsTask_categoryId_idx" ON "OpsTask"("categoryId");

-- AddForeignKey
ALTER TABLE "OpsTask" ADD CONSTRAINT "OpsTask_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "OpsCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
