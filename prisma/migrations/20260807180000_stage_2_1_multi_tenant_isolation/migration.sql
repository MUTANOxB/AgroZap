BEGIN;

-- Impede alterações concorrentes entre a auditoria dos dados existentes e a
-- instalação das novas chaves compostas.
LOCK TABLE
  "Area",
  "AreaAlias",
  "StockProduct",
  "ProductAlias",
  "FarmRecord",
  "StockMovement"
IN SHARE ROW EXCLUSIVE MODE;

-- A migration não tenta adivinhar a Property correta para relações antigas.
-- Se houver corrupção cross-property, todo o bloco falha sem mover, apagar ou
-- corrigir dados silenciosamente.
DO $$
DECLARE
  area_alias_count BIGINT;
  product_alias_count BIGINT;
  farm_record_area_count BIGINT;
  farm_record_product_count BIGINT;
  stock_movement_product_count BIGINT;
  stock_movement_area_count BIGINT;
  stock_movement_farm_record_count BIGINT;
  stock_movement_reversal_count BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO area_alias_count
  FROM "AreaAlias" AS alias
  JOIN "Area" AS area ON area."id" = alias."areaId"
  WHERE alias."propertyId" <> area."propertyId";

  SELECT COUNT(*)
  INTO product_alias_count
  FROM "ProductAlias" AS alias
  JOIN "StockProduct" AS product ON product."id" = alias."productId"
  WHERE alias."propertyId" <> product."propertyId";

  SELECT COUNT(*)
  INTO farm_record_area_count
  FROM "FarmRecord" AS record
  JOIN "Area" AS area ON area."id" = record."areaId"
  WHERE record."propertyId" <> area."propertyId";

  SELECT COUNT(*)
  INTO farm_record_product_count
  FROM "FarmRecord" AS record
  JOIN "StockProduct" AS product ON product."id" = record."productId"
  WHERE record."propertyId" <> product."propertyId";

  SELECT COUNT(*)
  INTO stock_movement_product_count
  FROM "StockMovement" AS movement
  JOIN "StockProduct" AS product ON product."id" = movement."productId"
  WHERE movement."propertyId" <> product."propertyId";

  SELECT COUNT(*)
  INTO stock_movement_area_count
  FROM "StockMovement" AS movement
  JOIN "Area" AS area ON area."id" = movement."areaId"
  WHERE movement."propertyId" <> area."propertyId";

  SELECT COUNT(*)
  INTO stock_movement_farm_record_count
  FROM "StockMovement" AS movement
  JOIN "FarmRecord" AS record ON record."id" = movement."farmRecordId"
  WHERE movement."propertyId" <> record."propertyId";

  SELECT COUNT(*)
  INTO stock_movement_reversal_count
  FROM "StockMovement" AS movement
  JOIN "StockMovement" AS reversed
    ON reversed."id" = movement."reversesMovementId"
  WHERE movement."propertyId" <> reversed."propertyId";

  IF area_alias_count
       + product_alias_count
       + farm_record_area_count
       + farm_record_product_count
       + stock_movement_product_count
       + stock_movement_area_count
       + stock_movement_farm_record_count
       + stock_movement_reversal_count > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Etapa 2.1 abortada: foram encontradas relações entre Properties diferentes.',
      DETAIL = format(
        'AreaAlias->Area=%s; ProductAlias->StockProduct=%s; FarmRecord->Area=%s; FarmRecord->StockProduct=%s; StockMovement->StockProduct=%s; StockMovement->Area=%s; StockMovement->FarmRecord=%s; StockMovement->reversesMovement=%s',
        area_alias_count,
        product_alias_count,
        farm_record_area_count,
        farm_record_product_count,
        stock_movement_product_count,
        stock_movement_area_count,
        stock_movement_farm_record_count,
        stock_movement_reversal_count
      ),
      HINT = 'Revise e corrija manualmente cada relação inconsistente antes de reaplicar a migration; nenhum dado foi alterado por este preflight.';
  END IF;
END
$$;

-- Chaves candidatas necessárias para as referências (propertyId, id).
CREATE UNIQUE INDEX "Area_propertyId_id_key"
  ON "Area"("propertyId", "id");

CREATE UNIQUE INDEX "StockProduct_propertyId_id_key"
  ON "StockProduct"("propertyId", "id");

CREATE UNIQUE INDEX "FarmRecord_propertyId_id_key"
  ON "FarmRecord"("propertyId", "id");

CREATE UNIQUE INDEX "StockMovement_propertyId_id_key"
  ON "StockMovement"("propertyId", "id");

-- Uma movimentação só pode ser revertida uma vez dentro de sua Property.
CREATE UNIQUE INDEX "StockMovement_propertyId_reversesMovementId_key"
  ON "StockMovement"("propertyId", "reversesMovementId");

DROP INDEX "StockMovement_reversesMovementId_key";

-- Substitui as FKs independentes por FKs que também carregam a fronteira da
-- Property. ON DELETE preserva a semântica anterior; ON UPDATE RESTRICT evita
-- reparenting automático de dependentes por alteração da chave composta.
ALTER TABLE "AreaAlias"
  DROP CONSTRAINT "AreaAlias_areaId_fkey";

ALTER TABLE "AreaAlias"
  ADD CONSTRAINT "AreaAlias_propertyId_areaId_fkey"
  FOREIGN KEY ("propertyId", "areaId")
  REFERENCES "Area"("propertyId", "id")
  ON DELETE CASCADE
  ON UPDATE RESTRICT;

ALTER TABLE "ProductAlias"
  DROP CONSTRAINT "ProductAlias_productId_fkey";

ALTER TABLE "ProductAlias"
  ADD CONSTRAINT "ProductAlias_propertyId_productId_fkey"
  FOREIGN KEY ("propertyId", "productId")
  REFERENCES "StockProduct"("propertyId", "id")
  ON DELETE CASCADE
  ON UPDATE RESTRICT;

ALTER TABLE "FarmRecord"
  DROP CONSTRAINT "FarmRecord_areaId_fkey";

ALTER TABLE "FarmRecord"
  ADD CONSTRAINT "FarmRecord_propertyId_areaId_fkey"
  FOREIGN KEY ("propertyId", "areaId")
  REFERENCES "Area"("propertyId", "id")
  ON DELETE RESTRICT
  ON UPDATE RESTRICT;

ALTER TABLE "FarmRecord"
  DROP CONSTRAINT "FarmRecord_productId_fkey";

ALTER TABLE "FarmRecord"
  ADD CONSTRAINT "FarmRecord_propertyId_productId_fkey"
  FOREIGN KEY ("propertyId", "productId")
  REFERENCES "StockProduct"("propertyId", "id")
  ON DELETE RESTRICT
  ON UPDATE RESTRICT;

ALTER TABLE "StockMovement"
  DROP CONSTRAINT "StockMovement_productId_fkey";

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_propertyId_productId_fkey"
  FOREIGN KEY ("propertyId", "productId")
  REFERENCES "StockProduct"("propertyId", "id")
  ON DELETE RESTRICT
  ON UPDATE RESTRICT;

ALTER TABLE "StockMovement"
  DROP CONSTRAINT "StockMovement_areaId_fkey";

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_propertyId_areaId_fkey"
  FOREIGN KEY ("propertyId", "areaId")
  REFERENCES "Area"("propertyId", "id")
  ON DELETE RESTRICT
  ON UPDATE RESTRICT;

ALTER TABLE "StockMovement"
  DROP CONSTRAINT "StockMovement_farmRecordId_fkey";

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_propertyId_farmRecordId_fkey"
  FOREIGN KEY ("propertyId", "farmRecordId")
  REFERENCES "FarmRecord"("propertyId", "id")
  ON DELETE RESTRICT
  ON UPDATE RESTRICT;

ALTER TABLE "StockMovement"
  DROP CONSTRAINT "StockMovement_reversesMovementId_fkey";

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_propertyId_reversesMovementId_fkey"
  FOREIGN KEY ("propertyId", "reversesMovementId")
  REFERENCES "StockMovement"("propertyId", "id")
  ON DELETE RESTRICT
  ON UPDATE RESTRICT;

COMMIT;
