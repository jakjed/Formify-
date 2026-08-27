CREATE TABLE IF NOT EXISTS "ApprovalRule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "entityId" UUID,
  "minMinor" INTEGER,
  "maxMinor" INTEGER,
  "autoApprove" BOOLEAN NOT NULL DEFAULT false,
  "assigneeRole" "UserRole",
  "priority" INTEGER NOT NULL DEFAULT 100,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ApprovalRule_tenantId_enabled_priority_idx"
  ON "ApprovalRule"("tenantId", "enabled", "priority");

ALTER TABLE "ApprovalRule"
  ADD CONSTRAINT "ApprovalRule_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
