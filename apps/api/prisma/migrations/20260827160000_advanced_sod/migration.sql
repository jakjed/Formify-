-- AlterTable Invoice
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "submittedById" UUID;
CREATE INDEX IF NOT EXISTS "Invoice_tenantId_submittedById_idx" ON "Invoice"("tenantId", "submittedById");

-- CreateEnum
CREATE TYPE "SodRuleKey" AS ENUM ('cannot_approve_own_invoice', 'role_pair_conflict');

-- CreateTable
CREATE TABLE "SodPolicy" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "ruleKey" "SodRuleKey" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "submitterRole" "UserRole",
  "approverRole" "UserRole",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SodPolicy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SodPolicy_tenantId_enabled_idx" ON "SodPolicy"("tenantId", "enabled");
CREATE INDEX "SodPolicy_tenantId_ruleKey_idx" ON "SodPolicy"("tenantId", "ruleKey");

ALTER TABLE "SodPolicy"
  ADD CONSTRAINT "SodPolicy_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
