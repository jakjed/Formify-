-- Drop legacy single-tenant ApprovalPolicy index (superseded by tenantId+moduleKey).
-- command_center_admin used DROP CONSTRAINT but the original was a UNIQUE INDEX.
DROP INDEX IF EXISTS "ApprovalPolicy_tenantId_key";
