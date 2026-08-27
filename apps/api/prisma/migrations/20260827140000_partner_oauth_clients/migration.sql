CREATE TABLE IF NOT EXISTS "OAuthClient" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "clientSecretHash" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "createdById" UUID,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OAuthClient_clientId_key" ON "OAuthClient"("clientId");
CREATE INDEX IF NOT EXISTS "OAuthClient_tenantId_idx" ON "OAuthClient"("tenantId");

ALTER TABLE "OAuthClient"
  ADD CONSTRAINT "OAuthClient_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "OAuthAccessToken" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthAccessToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OAuthAccessToken_tokenHash_key" ON "OAuthAccessToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "OAuthAccessToken_tenantId_idx" ON "OAuthAccessToken"("tenantId");
CREATE INDEX IF NOT EXISTS "OAuthAccessToken_clientId_idx" ON "OAuthAccessToken"("clientId");
CREATE INDEX IF NOT EXISTS "OAuthAccessToken_expiresAt_idx" ON "OAuthAccessToken"("expiresAt");

ALTER TABLE "OAuthAccessToken"
  ADD CONSTRAINT "OAuthAccessToken_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthAccessToken"
  ADD CONSTRAINT "OAuthAccessToken_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
