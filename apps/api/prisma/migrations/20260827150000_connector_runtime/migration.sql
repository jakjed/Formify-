-- AlterEnum
ALTER TYPE "IntegrationJobType" ADD VALUE 'sync_demo_erp';

-- CreateEnum
CREATE TYPE "ConnectorConnectionStatus" AS ENUM ('connected', 'disconnected');

-- CreateTable
CREATE TABLE "ConnectorConnection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "packKey" TEXT NOT NULL,
  "status" "ConnectorConnectionStatus" NOT NULL DEFAULT 'disconnected',
  "credentialsHash" TEXT,
  "settings" JSONB NOT NULL DEFAULT '{}',
  "connectedAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConnectorConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConnectorConnection_tenantId_packKey_key"
  ON "ConnectorConnection"("tenantId", "packKey");
CREATE INDEX "ConnectorConnection_tenantId_idx"
  ON "ConnectorConnection"("tenantId");

ALTER TABLE "ConnectorConnection"
  ADD CONSTRAINT "ConnectorConnection_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
