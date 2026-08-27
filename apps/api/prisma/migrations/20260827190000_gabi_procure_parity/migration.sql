-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE 'pending_signature';

-- CreateEnum
CREATE TYPE "ApAccrualStatus" AS ENUM ('draft', 'in_approval', 'approved', 'posted', 'cancelled');

-- AlterTable Contract
ALTER TABLE "Contract" ADD COLUMN "agreementType" TEXT;
ALTER TABLE "Contract" ADD COLUMN "purpose" TEXT;
ALTER TABLE "Contract" ADD COLUMN "serviceDescription" TEXT;
ALTER TABLE "Contract" ADD COLUMN "costCenter" TEXT;
ALTER TABLE "Contract" ADD COLUMN "termType" TEXT;
ALTER TABLE "Contract" ADD COLUMN "noticePeriod" TEXT;
ALTER TABLE "Contract" ADD COLUMN "clmTool" TEXT;
ALTER TABLE "Contract" ADD COLUMN "ownerName" TEXT;
ALTER TABLE "Contract" ADD COLUMN "approvalStage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Contract" ADD COLUMN "contractDate" DATE;
ALTER TABLE "Contract" ADD COLUMN "aiExtracted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contract" ADD COLUMN "redFlagsJson" JSONB;
ALTER TABLE "Contract" ADD COLUMN "signatureJson" JSONB;

CREATE TABLE "ContractDocument" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractDocument_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PurchaseRequest" ADD COLUMN "vendorId" UUID;
ALTER TABLE "PurchaseRequest" ADD COLUMN "sourceContractId" UUID;
ALTER TABLE "PurchaseRequest" ADD COLUMN "department" TEXT;
ALTER TABLE "PurchaseRequest" ADD COLUMN "category" TEXT;
ALTER TABLE "PurchaseRequest" ADD COLUMN "approvalStage" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ApAccrual" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "contractId" UUID,
    "vendorName" TEXT,
    "entityId" UUID,
    "department" TEXT,
    "category" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "ApAccrualStatus" NOT NULL DEFAULT 'draft',
    "approvalStage" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApAccrual_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContractDocument_tenantId_contractId_idx" ON "ContractDocument"("tenantId", "contractId");
CREATE INDEX "PurchaseRequest_tenantId_sourceContractId_idx" ON "PurchaseRequest"("tenantId", "sourceContractId");
CREATE INDEX "ApAccrual_tenantId_status_idx" ON "ApAccrual"("tenantId", "status");
CREATE INDEX "ApAccrual_tenantId_purchaseOrderId_idx" ON "ApAccrual"("tenantId", "purchaseOrderId");

ALTER TABLE "ContractDocument" ADD CONSTRAINT "ContractDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractDocument" ADD CONSTRAINT "ContractDocument_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_sourceContractId_fkey" FOREIGN KEY ("sourceContractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApAccrual" ADD CONSTRAINT "ApAccrual_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApAccrual" ADD CONSTRAINT "ApAccrual_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApAccrual" ADD CONSTRAINT "ApAccrual_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
