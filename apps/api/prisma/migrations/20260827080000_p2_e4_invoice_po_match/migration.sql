-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "purchaseOrderId" UUID;

-- CreateIndex
CREATE INDEX "Invoice_tenantId_purchaseOrderId_idx" ON "Invoice"("tenantId", "purchaseOrderId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
