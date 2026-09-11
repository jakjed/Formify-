-- Historical FX rates: one row per (table, quote, date); track earliest date

DROP INDEX IF EXISTS "FxRate_tableId_quoteCurrency_key";
DROP INDEX IF EXISTS "FxRate_tenantId_tableId_idx";
DROP INDEX IF EXISTS "FxRate_tenantId_baseCurrency_quoteCurrency_idx";

ALTER TABLE "FxRateTable" ADD COLUMN IF NOT EXISTS "earliestDate" DATE;

-- Keep only the latest row per (tableId, quoteCurrency) before tightening uniqueness
DELETE FROM "FxRate" a
USING "FxRate" b
WHERE a."tableId" = b."tableId"
  AND a."quoteCurrency" = b."quoteCurrency"
  AND a."asOfDate" < b."asOfDate";

CREATE UNIQUE INDEX "FxRate_tableId_quoteCurrency_asOfDate_key"
  ON "FxRate"("tableId", "quoteCurrency", "asOfDate");
CREATE INDEX "FxRate_tenantId_tableId_asOfDate_idx"
  ON "FxRate"("tenantId", "tableId", "asOfDate");
CREATE INDEX "FxRate_tenantId_tableId_quoteCurrency_idx"
  ON "FxRate"("tenantId", "tableId", "quoteCurrency");
CREATE INDEX "FxRate_tenantId_baseCurrency_quoteCurrency_asOfDate_idx"
  ON "FxRate"("tenantId", "baseCurrency", "quoteCurrency", "asOfDate");

UPDATE "FxRateTable" t
SET "earliestDate" = s.mn,
    "asOfDate" = s.mx,
    "rateCount" = s.cnt
FROM (
  SELECT "tableId",
         MIN("asOfDate") AS mn,
         MAX("asOfDate") AS mx,
         COUNT(*)::int AS cnt
  FROM "FxRate"
  GROUP BY "tableId"
) s
WHERE t."id" = s."tableId";
