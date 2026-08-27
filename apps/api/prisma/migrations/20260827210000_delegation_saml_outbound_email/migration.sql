-- Outbound notification email + SAML auth state
CREATE TABLE "TenantOutboundEmail" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "replyTo" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantOutboundEmail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SamlAuthState" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "relayState" TEXT NOT NULL,
    "redirectTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SamlAuthState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantOutboundEmail_tenantId_key" ON "TenantOutboundEmail"("tenantId");
CREATE INDEX "TenantOutboundEmail_tenantId_idx" ON "TenantOutboundEmail"("tenantId");

CREATE UNIQUE INDEX "SamlAuthState_relayState_key" ON "SamlAuthState"("relayState");
CREATE INDEX "SamlAuthState_expiresAt_idx" ON "SamlAuthState"("expiresAt");

ALTER TABLE "TenantOutboundEmail" ADD CONSTRAINT "TenantOutboundEmail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
