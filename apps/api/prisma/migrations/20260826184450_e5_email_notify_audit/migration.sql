-- CreateTable
CREATE TABLE "CaptureMailbox" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),

    CONSTRAINT "CaptureMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailIngest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "messageId" TEXT NOT NULL,
    "fromAddress" TEXT,
    "subject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "errorMessage" TEXT,
    "invoiceId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailIngest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaptureMailbox_address_key" ON "CaptureMailbox"("address");

-- CreateIndex
CREATE UNIQUE INDEX "CaptureMailbox_token_key" ON "CaptureMailbox"("token");

-- CreateIndex
CREATE INDEX "CaptureMailbox_tenantId_idx" ON "CaptureMailbox"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CaptureMailbox_tenantId_key" ON "CaptureMailbox"("tenantId");

-- CreateIndex
CREATE INDEX "EmailIngest_tenantId_idx" ON "EmailIngest"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailIngest_tenantId_messageId_key" ON "EmailIngest"("tenantId", "messageId");

-- CreateIndex
CREATE INDEX "Notification_tenantId_userId_readAt_idx" ON "Notification"("tenantId", "userId", "readAt");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_entityType_entityId_idx" ON "AuditEvent"("tenantId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "CaptureMailbox" ADD CONSTRAINT "CaptureMailbox_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailIngest" ADD CONSTRAINT "EmailIngest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
