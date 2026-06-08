CREATE TYPE "CrmClientStatus" AS ENUM ('RED', 'YELLOW', 'GREEN', 'BLUE', 'BLACK');
CREATE TYPE "CrmVisitStatus" AS ENUM ('SCHEDULED', 'ARRIVED', 'NO_SHOW', 'RESCHEDULED', 'CANCELED');

CREATE TABLE "CrmClient" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "phone" TEXT NOT NULL DEFAULT '',
  "phoneNormalized" TEXT NOT NULL DEFAULT '',
  "birthDate" DATE,
  "note" TEXT NOT NULL DEFAULT '',
  "totalSpent" INTEGER NOT NULL DEFAULT 0,
  "visitsCount" INTEGER NOT NULL DEFAULT 0,
  "lastProcedureAt" DATE,
  "recommendedNextAt" DATE,
  "requiresRepeatContact" BOOLEAN NOT NULL DEFAULT false,
  "warned" BOOLEAN NOT NULL DEFAULT false,
  "status" "CrmClientStatus" NOT NULL DEFAULT 'RED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmProcedure" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "masterId" TEXT,
  "procedureDate" DATE NOT NULL,
  "service" TEXT NOT NULL,
  "cost" INTEGER NOT NULL DEFAULT 0,
  "intervalDays" INTEGER NOT NULL DEFAULT 30,
  "sequenceNumber" INTEGER NOT NULL DEFAULT 1,
  "masterComment" TEXT NOT NULL DEFAULT '',
  "photosBeforeAfter" JSONB,
  "nextVisitDate" DATE,
  "nextVisitComment" TEXT NOT NULL DEFAULT '',
  "nextVisitAdvice" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmProcedure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAppointment" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "masterId" TEXT,
  "service" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "comment" TEXT NOT NULL DEFAULT '',
  "visitStatus" "CrmVisitStatus" NOT NULL DEFAULT 'SCHEDULED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmAppointment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrmClient_fullName_idx" ON "CrmClient"("fullName");
CREATE INDEX "CrmClient_phone_idx" ON "CrmClient"("phone");
CREATE INDEX "CrmClient_phoneNormalized_idx" ON "CrmClient"("phoneNormalized");
CREATE INDEX "CrmClient_status_recommendedNextAt_idx" ON "CrmClient"("status", "recommendedNextAt");
CREATE INDEX "CrmClient_lastProcedureAt_idx" ON "CrmClient"("lastProcedureAt");

CREATE INDEX "CrmProcedure_clientId_procedureDate_idx" ON "CrmProcedure"("clientId", "procedureDate");
CREATE INDEX "CrmProcedure_masterId_procedureDate_idx" ON "CrmProcedure"("masterId", "procedureDate");

CREATE INDEX "CrmAppointment_masterId_startsAt_idx" ON "CrmAppointment"("masterId", "startsAt");
CREATE INDEX "CrmAppointment_clientId_startsAt_idx" ON "CrmAppointment"("clientId", "startsAt");
CREATE INDEX "CrmAppointment_visitStatus_startsAt_idx" ON "CrmAppointment"("visitStatus", "startsAt");

ALTER TABLE "CrmProcedure"
ADD CONSTRAINT "CrmProcedure_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "CrmClient"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmProcedure"
ADD CONSTRAINT "CrmProcedure_masterId_fkey"
FOREIGN KEY ("masterId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrmAppointment"
ADD CONSTRAINT "CrmAppointment_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "CrmClient"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmAppointment"
ADD CONSTRAINT "CrmAppointment_masterId_fkey"
FOREIGN KEY ("masterId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
