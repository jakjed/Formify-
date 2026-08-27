-- CreateEnum
CREATE TYPE "GlAccountType" AS ENUM ('liability', 'expense');

-- User capabilities
ALTER TABLE "User" ADD COLUMN "canAccessDirectory" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "canApprove" BOOLEAN NOT NULL DEFAULT false;
UPDATE "User" SET "canAccessDirectory" = true WHERE "role" = 'admin';

-- Vendor extensions
ALTER TABLE "Vendor" ADD COLUMN "entityId" UUID;
ALTER TABLE "Vendor" ADD COLUMN "addressLine1" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "addressLine2" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "city" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "region" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "country" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "bankAccount" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "bankIban" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "bankSwift" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "taxCodeId" UUID;
ALTER TABLE "Vendor" ADD COLUMN "glAccountId" UUID;

-- GL accounts
ALTER TABLE "GlAccount" ADD COLUMN "entityId" UUID;
ALTER TABLE "GlAccount" ADD COLUMN "accountType" "GlAccountType" NOT NULL DEFAULT 'expense';

-- Cost centers / tax / payment terms entity
ALTER TABLE "CostCenter" ADD COLUMN "entityId" UUID;
ALTER TABLE "TaxCode" ADD COLUMN "entityId" UUID;
ALTER TABLE "PaymentTerm" ADD COLUMN "entityId" UUID;

-- FKs
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "GlAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GlAccount" ADD CONSTRAINT "GlAccount_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaxCode" ADD CONSTRAINT "TaxCode_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentTerm" ADD CONSTRAINT "PaymentTerm_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Vendor_tenantId_entityId_idx" ON "Vendor"("tenantId", "entityId");
CREATE INDEX "GlAccount_tenantId_entityId_idx" ON "GlAccount"("tenantId", "entityId");
CREATE INDEX "GlAccount_tenantId_accountType_idx" ON "GlAccount"("tenantId", "accountType");
CREATE INDEX "CostCenter_tenantId_entityId_idx" ON "CostCenter"("tenantId", "entityId");
CREATE INDEX "TaxCode_tenantId_entityId_idx" ON "TaxCode"("tenantId", "entityId");
CREATE INDEX "PaymentTerm_tenantId_entityId_idx" ON "PaymentTerm"("tenantId", "entityId");

-- Delegation
CREATE TABLE "ApprovalDelegation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "fromUserId" UUID NOT NULL,
    "toUserId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalDelegation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ApprovalDelegation_tenantId_fromUserId_idx" ON "ApprovalDelegation"("tenantId", "fromUserId");
CREATE INDEX "ApprovalDelegation_tenantId_toUserId_idx" ON "ApprovalDelegation"("tenantId", "toUserId");
CREATE INDEX "ApprovalDelegation_tenantId_active_startsAt_endsAt_idx" ON "ApprovalDelegation"("tenantId", "active", "startsAt", "endsAt");
