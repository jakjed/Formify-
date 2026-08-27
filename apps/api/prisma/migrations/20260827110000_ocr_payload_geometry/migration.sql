-- Persist structured OCR hits + normalized bounding boxes for HITL drag-from-scan.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "ocrPayload" JSONB;
