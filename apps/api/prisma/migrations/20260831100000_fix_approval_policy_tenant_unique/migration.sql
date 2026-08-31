-- Drop legacy single-tenant ApprovalPolicy index (superseded by tenantId+moduleKey).
DROP INDEX IF EXISTS "ApprovalPolicy_tenantId_key";
