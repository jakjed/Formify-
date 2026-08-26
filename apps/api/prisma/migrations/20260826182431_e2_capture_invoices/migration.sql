-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('captured', 'extracting', 'needs_review', 'exception', 'in_approval', 'approved', 'exported', 'void', 'paid');

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "entityId" UUID,
    "vendorId" UUID,
    "fileAssetId" UUID,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'captured',
    "invoiceNumber" TEXT,
    "invoiceDate" DATE,
    "dueDate" DATE,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "subtotalMinor" INTEGER,
    "taxMinor" INTEGER,
    "totalMinor" INTEGER,
    "vendorNameRaw" TEXT,
    "notes" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION,
    "unitPriceMinor" INTEGER,
    "amountMinor" INTEGER,
    "glAccountId" UUID,
    "costCenterId" UUID,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceException" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrPageMeter" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "pages" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcrPageMeter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileAsset_tenantId_idx" ON "FileAsset"("tenantId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_status_idx" ON "Invoice"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_createdAt_idx" ON "Invoice"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_invoiceNumber_idx" ON "Invoice"("tenantId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_invoiceId_lineNo_key" ON "InvoiceLine"("invoiceId", "lineNo");

-- CreateIndex
CREATE INDEX "InvoiceException_invoiceId_idx" ON "InvoiceException"("invoiceId");

-- CreateIndex
CREATE INDEX "UsageEvent_tenantId_type_idx" ON "UsageEvent"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "UsageEvent_tenantId_type_refId_key" ON "UsageEvent"("tenantId", "type", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "OcrPageMeter_tenantId_yearMonth_key" ON "OcrPageMeter"("tenantId", "yearMonth");

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceException" ADD CONSTRAINT "InvoiceException_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrPageMeter" ADD CONSTRAINT "OcrPageMeter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
