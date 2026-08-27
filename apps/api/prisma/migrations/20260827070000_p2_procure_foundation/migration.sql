-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('draft', 'in_approval', 'active', 'expired', 'cancelled');
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('draft', 'in_approval', 'approved', 'converted', 'cancelled');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('draft', 'issued', 'partially_received', 'received', 'closed', 'cancelled');

-- CreateTable
CREATE TABLE "Contract" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "entityId" UUID,
    "vendorId" UUID,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'draft',
    "startDate" DATE,
    "endDate" DATE,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "valueMinor" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "entityId" UUID,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'draft',
    "requesterId" UUID,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "totalMinor" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseRequestLine" (
    "id" UUID NOT NULL,
    "purchaseRequestId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION,
    "unitPriceMinor" INTEGER,
    "amountMinor" INTEGER,
    "glAccountId" UUID,

    CONSTRAINT "PurchaseRequestLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseOrder" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "entityId" UUID,
    "vendorId" UUID,
    "contractId" UUID,
    "purchaseRequestId" UUID,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "totalMinor" INTEGER,
    "notes" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseOrderLine" (
    "id" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION,
    "receivedQty" DOUBLE PRECISION DEFAULT 0,
    "unitPriceMinor" INTEGER,
    "amountMinor" INTEGER,
    "glAccountId" UUID,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "Contract_tenantId_number_key" ON "Contract"("tenantId", "number");
CREATE INDEX "Contract_tenantId_status_idx" ON "Contract"("tenantId", "status");
CREATE UNIQUE INDEX "PurchaseRequest_tenantId_number_key" ON "PurchaseRequest"("tenantId", "number");
CREATE INDEX "PurchaseRequest_tenantId_status_idx" ON "PurchaseRequest"("tenantId", "status");
CREATE UNIQUE INDEX "PurchaseRequestLine_purchaseRequestId_lineNo_key" ON "PurchaseRequestLine"("purchaseRequestId", "lineNo");
CREATE INDEX "PurchaseRequestLine_purchaseRequestId_idx" ON "PurchaseRequestLine"("purchaseRequestId");
CREATE UNIQUE INDEX "PurchaseOrder_tenantId_number_key" ON "PurchaseOrder"("tenantId", "number");
CREATE INDEX "PurchaseOrder_tenantId_status_idx" ON "PurchaseOrder"("tenantId", "status");
CREATE UNIQUE INDEX "PurchaseOrderLine_purchaseOrderId_lineNo_key" ON "PurchaseOrderLine"("purchaseOrderId", "lineNo");
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");

-- FKs
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
