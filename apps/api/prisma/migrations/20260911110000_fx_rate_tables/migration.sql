-- FX rate tables (NBP / ECB / FRED / BOE) + tenant active selection

ALTER TABLE "Tenant" ADD COLUMN "activeFxTableId" UUID;

CREATE TABLE "FxRateTable" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "providerKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "baseCurrency" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "asOfDate" DATE,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "rateCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FxRateTable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FxRate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "asOfDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FxRateTable_tenantId_providerKey_key" ON "FxRateTable"("tenantId", "providerKey");
CREATE INDEX "FxRateTable_tenantId_idx" ON "FxRateTable"("tenantId");

CREATE UNIQUE INDEX "FxRate_tableId_quoteCurrency_key" ON "FxRate"("tableId", "quoteCurrency");
CREATE INDEX "FxRate_tenantId_tableId_idx" ON "FxRate"("tenantId", "tableId");
CREATE INDEX "FxRate_tenantId_baseCurrency_quoteCurrency_idx" ON "FxRate"("tenantId", "baseCurrency", "quoteCurrency");

ALTER TABLE "FxRateTable" ADD CONSTRAINT "FxRateTable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FxRate" ADD CONSTRAINT "FxRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FxRate" ADD CONSTRAINT "FxRate_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "FxRateTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_activeFxTableId_fkey" FOREIGN KEY ("activeFxTableId") REFERENCES "FxRateTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
