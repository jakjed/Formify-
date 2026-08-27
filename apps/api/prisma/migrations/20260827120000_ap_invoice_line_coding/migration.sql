-- Expense categories (entity + GL), richer invoice lines, header attachments
CREATE TABLE IF NOT EXISTS "ExpenseCategory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "entityId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keywords" TEXT NOT NULL DEFAULT '',
  "glAccountId" UUID NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategory_tenantId_entityId_code_key"
  ON "ExpenseCategory"("tenantId", "entityId", "code");
CREATE INDEX IF NOT EXISTS "ExpenseCategory_tenantId_entityId_idx"
  ON "ExpenseCategory"("tenantId", "entityId");

ALTER TABLE "ExpenseCategory"
  ADD CONSTRAINT "ExpenseCategory_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseCategory"
  ADD CONSTRAINT "ExpenseCategory_entityId_fkey"
  FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseCategory"
  ADD CONSTRAINT "ExpenseCategory_glAccountId_fkey"
  FOREIGN KEY ("glAccountId") REFERENCES "GlAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvoiceLine" ADD COLUMN IF NOT EXISTS "taxMinor" INTEGER;
ALTER TABLE "InvoiceLine" ADD COLUMN IF NOT EXISTS "taxCodeId" UUID;
ALTER TABLE "InvoiceLine" ADD COLUMN IF NOT EXISTS "categoryId" UUID;
ALTER TABLE "InvoiceLine" ADD COLUMN IF NOT EXISTS "purchaseOrderLineId" UUID;

CREATE TABLE IF NOT EXISTS "InvoiceAttachment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "fileAssetId" UUID NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InvoiceAttachment_tenantId_invoiceId_idx"
  ON "InvoiceAttachment"("tenantId", "invoiceId");

ALTER TABLE "InvoiceAttachment"
  ADD CONSTRAINT "InvoiceAttachment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceAttachment"
  ADD CONSTRAINT "InvoiceAttachment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceAttachment"
  ADD CONSTRAINT "InvoiceAttachment_fileAssetId_fkey"
  FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
