-- User ↔ Entity membership
CREATE TABLE "UserEntityMembership" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserEntityMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserEntityMembership_userId_entityId_key" ON "UserEntityMembership"("userId", "entityId");
CREATE INDEX "UserEntityMembership_tenantId_userId_idx" ON "UserEntityMembership"("tenantId", "userId");
CREATE INDEX "UserEntityMembership_tenantId_entityId_idx" ON "UserEntityMembership"("tenantId", "entityId");

ALTER TABLE "UserEntityMembership" ADD CONSTRAINT "UserEntityMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserEntityMembership" ADD CONSTRAINT "UserEntityMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserEntityMembership" ADD CONSTRAINT "UserEntityMembership_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cross-module approval policies
ALTER TABLE "ApprovalPolicy" ADD COLUMN "moduleKey" TEXT NOT NULL DEFAULT 'invoices';
ALTER TABLE "ApprovalPolicy" ADD COLUMN "chainJson" JSONB;

ALTER TABLE "ApprovalPolicy" DROP CONSTRAINT IF EXISTS "ApprovalPolicy_tenantId_key";
CREATE UNIQUE INDEX "ApprovalPolicy_tenantId_moduleKey_key" ON "ApprovalPolicy"("tenantId", "moduleKey");

ALTER TABLE "ApprovalRule" ADD COLUMN "moduleKey" TEXT NOT NULL DEFAULT 'invoices';
DROP INDEX IF EXISTS "ApprovalRule_tenantId_enabled_priority_idx";
CREATE INDEX "ApprovalRule_tenantId_moduleKey_enabled_priority_idx" ON "ApprovalRule"("tenantId", "moduleKey", "enabled", "priority");
