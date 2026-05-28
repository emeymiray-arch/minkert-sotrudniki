CREATE TABLE "LoyaltyClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyStamp" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "masterName" TEXT NOT NULL,
    "stampedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyStamp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoyaltyClient_phoneNormalized_key" ON "LoyaltyClient"("phoneNormalized");
CREATE INDEX "LoyaltyClient_name_idx" ON "LoyaltyClient"("name");
CREATE INDEX "LoyaltyClient_phone_idx" ON "LoyaltyClient"("phone");
CREATE UNIQUE INDEX "LoyaltyStamp_clientId_slot_key" ON "LoyaltyStamp"("clientId", "slot");
CREATE INDEX "LoyaltyStamp_clientId_stampedAt_idx" ON "LoyaltyStamp"("clientId", "stampedAt");

ALTER TABLE "LoyaltyStamp"
ADD CONSTRAINT "LoyaltyStamp_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "LoyaltyClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
