-- AlterTable
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ApprovalTask" ADD COLUMN "emailToken" TEXT;
ALTER TABLE "ApprovalTask" ADD COLUMN "lastRemindedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ApprovalTask_emailToken_key" ON "ApprovalTask"("emailToken");

-- CreateTable
CREATE TABLE "InvoiceSavedView" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSavedView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoiceSavedView_tenantId_userId_idx" ON "InvoiceSavedView"("tenantId", "userId");

ALTER TABLE "InvoiceSavedView" ADD CONSTRAINT "InvoiceSavedView_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceSavedView" ADD CONSTRAINT "InvoiceSavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "WaitlistSignup" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistSignup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WaitlistSignup_email_key" ON "WaitlistSignup"("email");
