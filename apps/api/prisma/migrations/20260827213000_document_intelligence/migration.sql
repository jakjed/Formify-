-- Document intelligence: FileAsset extraction cache + tenant AI settings
ALTER TABLE "Tenant" ADD COLUMN "aiAssistEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN "llmProvider" TEXT NOT NULL DEFAULT 'none';

ALTER TABLE "FileAsset" ADD COLUMN "contentHash" TEXT;
ALTER TABLE "FileAsset" ADD COLUMN "extractionPayload" JSONB;
ALTER TABLE "FileAsset" ADD COLUMN "fullText" TEXT;
ALTER TABLE "FileAsset" ADD COLUMN "extractionProvider" TEXT;
ALTER TABLE "FileAsset" ADD COLUMN "extractedAt" TIMESTAMP(3);

CREATE INDEX "FileAsset_tenantId_contentHash_idx" ON "FileAsset"("tenantId", "contentHash");

ALTER TABLE "ContractDocument" ADD COLUMN "fileAssetId" UUID;
CREATE INDEX "ContractDocument_fileAssetId_idx" ON "ContractDocument"("fileAssetId");
ALTER TABLE "ContractDocument" ADD CONSTRAINT "ContractDocument_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
