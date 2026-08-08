import assert from "node:assert/strict";
import test from "node:test";
import {
  AreaType,
  FarmRecordType,
  ProductCategory,
  StockMovementType,
} from "@/generated/prisma/enums";
import {
  prepareCreateAreaWebInput,
  prepareCreateFarmRecordWebInput,
  prepareCreateFarmRecordWithStockMovementWebInput,
  prepareCreateStockProductWebInput,
  prepareRegisterStockMovementWebInput,
  prepareReverseStockMovementWebInput,
  RuralWebInputError,
} from "./rural-web-inputs";

function expectInputError(
  operation: () => unknown,
  code: RuralWebInputError["code"] | "NORMALIZATION_ERROR",
) {
  assert.throws(operation, (error: unknown) => {
    if (code === "NORMALIZATION_ERROR") {
      return error instanceof Error && error.name === "RuralInputError";
    }
    return error instanceof RuralWebInputError && error.code === code;
  });
}

test("campos de autoridade são recusados em qualquer profundidade", () => {
  expectInputError(
    () =>
      prepareCreateAreaWebInput({
        name: "Área A",
        type: AreaType.FIELD,
        propertyId: "property-forjada",
      }),
    "AUTHORITY_FIELD_NOT_ALLOWED",
  );

  expectInputError(
    () =>
      prepareCreateFarmRecordWithStockMovementWebInput({
        farmRecord: {
          type: FarmRecordType.NOTE,
          description: "Registro",
        },
        stockMovement: {
          type: StockMovementType.OUT,
          amount: "1",
          metadata: [{ source: "SYSTEM" }],
        },
      }),
    "AUTHORITY_FIELD_NOT_ALLOWED",
  );
});

test("área valida enum, aliases e normaliza decimais brasileiros", () => {
  const input = prepareCreateAreaWebInput({
    name: "  Talhão Norte  ",
    type: AreaType.FIELD,
    size: "1.234,56",
    sizeUnit: " ha ",
    note: " ",
    estimatedProductivity: "12,5",
    aliases: [" Norte ", "Talhão 1"],
  });

  assert.deepEqual(input, {
    name: "Talhão Norte",
    type: AreaType.FIELD,
    size: "1234.56",
    sizeUnit: "ha",
    note: null,
    currentCrop: null,
    harvest: null,
    soilType: null,
    irrigation: null,
    estimatedProductivity: "12.5",
    productivityUnit: null,
    aliases: ["Norte", "Talhão 1"],
  });
});

test("produto prepara datas simples sem converter o dia pelo timezone local", () => {
  const input = prepareCreateStockProductWebInput({
    name: "Adubo",
    category: ProductCategory.FERTILIZER,
    initialQuantity: "1000.25",
    unit: "kg",
    minimumStock: "12,5",
    unitValue: "1.234,56",
    expirationDate: "2027-02-28",
    purchaseDate: "2026-08-07",
  });

  assert.equal(input.initialQuantity, "1000.25");
  assert.equal(input.minimumStock, "12.5");
  assert.equal(input.unitValue, "1234.56");
  assert.equal(input.expirationDate?.toISOString(), "2027-02-28T00:00:00.000Z");
  assert.equal(input.purchaseDate?.toISOString(), "2026-08-07T00:00:00.000Z");
});

test("FarmRecord aceita somente IDs candidatos bem formados e data determinística", () => {
  const input = prepareCreateFarmRecordWebInput({
    areaId: "area_candidate-1",
    productId: "product_candidate-1",
    performedByUserId: "user_candidate-1",
    type: FarmRecordType.SPRAYING,
    description: " Aplicação concluída ",
    occurredAt: "2026-08-07",
    quantity: "2,50",
  });

  assert.equal(input.description, "Aplicação concluída");
  assert.equal(input.quantity, "2.5");
  assert.equal(input.occurredAt?.toISOString(), "2026-08-07T12:00:00.000Z");

  expectInputError(
    () =>
      prepareCreateFarmRecordWebInput({
        areaId: "../../outra-area",
        type: FarmRecordType.NOTE,
        description: "Registro",
      }),
    "INVALID_INPUT",
  );
});

test("movimentos discriminam IN/OUT de ADJUSTMENT e recusam formato ambíguo", () => {
  const outgoing = prepareRegisterStockMovementWebInput({
    productId: "product_1",
    type: StockMovementType.OUT,
    amount: "12,5",
    reason: " Uso no campo ",
  });
  assert.equal(outgoing.type, StockMovementType.OUT);
  assert.equal(outgoing.amount, "12.5");
  assert.equal(outgoing.reason, "Uso no campo");

  const adjustment = prepareRegisterStockMovementWebInput({
    productId: "product_1",
    type: StockMovementType.ADJUSTMENT,
    newBalance: "1.234,56",
    reason: "Inventário físico",
  });
  assert.equal(adjustment.type, StockMovementType.ADJUSTMENT);
  assert.equal(adjustment.newBalance, "1234.56");

  expectInputError(
    () =>
      prepareRegisterStockMovementWebInput({
        productId: "product_1",
        type: StockMovementType.OUT,
        amount: "1.234",
      }),
    "NORMALIZATION_ERROR",
  );
  expectInputError(
    () =>
      prepareRegisterStockMovementWebInput({
        productId: "product_1",
        type: StockMovementType.REVERSAL,
        amount: "1",
      }),
    "INVALID_INPUT",
  );
});

test("reversão exige somente candidato, motivo e occurredAt funcional", () => {
  const input = prepareReverseStockMovementWebInput({
    movementId: "movement_1",
    performedByUserId: "user_1",
    reason: " Correção conferida ",
    occurredAt: "2026-08-07T10:30:00-03:00",
  });

  assert.equal(input.movementId, "movement_1");
  assert.equal(input.reason, "Correção conferida");
  assert.equal(input.occurredAt?.toISOString(), "2026-08-07T13:30:00.000Z");
});

test("operação combinada não aceita produto ou área próprios no movimento", () => {
  const input = prepareCreateFarmRecordWithStockMovementWebInput({
    farmRecord: {
      areaId: "area_1",
      productId: "product_1",
      type: FarmRecordType.STOCK_ENTRY,
      description: "Compra recebida",
    },
    stockMovement: {
      type: StockMovementType.IN,
      amount: "10",
    },
  });

  assert.equal(input.farmRecord.productId, "product_1");
  assert.equal(input.stockMovement.type, StockMovementType.IN);

  expectInputError(
    () =>
      prepareCreateFarmRecordWithStockMovementWebInput({
        farmRecord: {
          productId: "product_1",
          type: FarmRecordType.STOCK_ENTRY,
          description: "Compra recebida",
        },
        stockMovement: {
          productId: "product_2",
          type: StockMovementType.IN,
          amount: "10",
        },
      }),
    "INVALID_INPUT",
  );
});
