CREATE TABLE "OpsProblem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsProblem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OpsProblem_resolved_createdAt_idx" ON "OpsProblem"("resolved", "createdAt");
