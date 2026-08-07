BEGIN;

-- Os campos nascem opcionais para permitir o preenchimento dos registros
-- existentes antes de exigir o snapshot de produto nas movimentações.
ALTER TABLE "StockMovement"
  ADD COLUMN "productNameSnapshot" TEXT,
  ADD COLUMN "areaNameSnapshot" TEXT;

ALTER TABLE "FarmRecord"
  ADD COLUMN "areaNameSnapshot" TEXT;

UPDATE "StockMovement" AS movement
SET "productNameSnapshot" = product."name"
FROM "StockProduct" AS product
WHERE product."id" = movement."productId"
  AND product."propertyId" = movement."propertyId";

UPDATE "StockMovement" AS movement
SET "areaNameSnapshot" = area."name"
FROM "Area" AS area
WHERE area."id" = movement."areaId"
  AND area."propertyId" = movement."propertyId";

-- Um snapshot já preenchido pode conter o nome histórico correto e não deve
-- ser substituído pelo nome atual durante a migration.
UPDATE "FarmRecord" AS record
SET "productNameSnapshot" = product."name"
FROM "StockProduct" AS product
WHERE product."id" = record."productId"
  AND product."propertyId" = record."propertyId"
  AND record."productNameSnapshot" IS NULL;

UPDATE "FarmRecord" AS record
SET "areaNameSnapshot" = area."name"
FROM "Area" AS area
WHERE area."id" = record."areaId"
  AND area."propertyId" = record."propertyId";

ALTER TABLE "StockMovement"
  ALTER COLUMN "productNameSnapshot" SET NOT NULL;

COMMIT;
