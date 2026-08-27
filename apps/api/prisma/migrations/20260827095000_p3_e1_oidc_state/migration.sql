-- CreateTable
CREATE TABLE "OidcAuthState" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "redirectTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OidcAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OidcAuthState_state_key" ON "OidcAuthState"("state");

-- CreateIndex
CREATE INDEX "OidcAuthState_expiresAt_idx" ON "OidcAuthState"("expiresAt");
