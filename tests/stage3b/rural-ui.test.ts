import assert from "node:assert/strict";
import test from "node:test";
import {
  AreaType,
  FarmRecordType,
  ProductCategory,
  PropertyRole,
  StockMovementType,
} from "@/generated/prisma/enums";
import {
  prepareCreateAreaWebInput,
  prepareCreateFarmRecordWithStockMovementWebInput,
  prepareCreateStockProductWebInput,
} from "@/services/rural/rural-web-inputs";
import {
  AREA_TYPE_OPTIONS,
  FARM_RECORD_TYPE_OPTIONS,
  PRODUCT_CATEGORY_OPTIONS,
  buildCreateAreaInput,
  buildCreateStockProductInput,
  buildFarmRecordSubmission,
  formatRuralDecimalPtBr,
  getFarmRecordSuccessNavigation,
  getAreaTypeLabel,
  getFarmRecordTypeLabel,
  getProductCategoryLabel,
  getRuralUiPermissions,
  isLowStock,
  parseAreaTypeLabel,
  parseFarmRecordTypeLabel,
  parseProductCategoryLabel,
  type FarmRecordFormValues,
} from "@/services/rural/rural-ui";

const baseRecord: FarmRecordFormValues = {
  typeLabel: "Observação",
  areaId: "area_cuid_123",
  locationDescription: "",
  productId: "product_cuid_456",
  occurredAt: "2026-08-08",
  description: "Registro de teste",
  quantity: "500",
  quantityUnit: "litros",
  stockMovementAmount: "2,5",
  value: "2.345,67",
  responsibleName: "Maria",
  appliedDose: "2,5",
  doseUnit: "kg/ha",
  harvest: "2026/27",
  supplier: "Cooperativa",
  productBatch: "LOTE-1",
  technicalNote: "Conferido",
};

const AUTHORITY_FIELDS = [
  "propertyId",
  "createdByUserId",
  "actorUserId",
  "role",
  "capability",
  "source",
  "performedByUserId",
];

function assertNoAuthorityFields(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const field of AUTHORITY_FIELDS) {
    assert.equal(serialized.includes(`\"${field}\"`), false, field);
  }
}

test("todos os AreaType possuem tradução PT-BR bidirecional", () => {
  assert.deepEqual(
    new Set(AREA_TYPE_OPTIONS.map((option) => option.value)),
    new Set(Object.values(AreaType)),
  );
  for (const option of AREA_TYPE_OPTIONS) {
    assert.equal(getAreaTypeLabel(option.value), option.label);
    assert.equal(parseAreaTypeLabel(option.label), option.value);
  }
});

test("todas as categorias e tipos de registro possuem tradução bidirecional", () => {
  assert.deepEqual(
    new Set(PRODUCT_CATEGORY_OPTIONS.map((option) => option.value)),
    new Set(Object.values(ProductCategory)),
  );
  assert.deepEqual(
    new Set(FARM_RECORD_TYPE_OPTIONS.map((option) => option.value)),
    new Set(Object.values(FarmRecordType)),
  );

  for (const option of PRODUCT_CATEGORY_OPTIONS) {
    assert.equal(getProductCategoryLabel(option.value), option.label);
    assert.equal(parseProductCategoryLabel(option.label), option.value);
  }
  for (const option of FARM_RECORD_TYPE_OPTIONS) {
    assert.equal(getFarmRecordTypeLabel(option.value), option.label);
    assert.equal(parseFarmRecordTypeLabel(option.label), option.value);
  }
});

test("adapters de área e produto preservam decimais brasileiros até a 3A", () => {
  const areaValues = {
    name: " Talhão Norte ",
    typeLabel: "Lavoura" as const,
    size: "1.234,56",
    sizeUnit: " hectares ",
    note: " Observação ",
    currentCrop: "Milho",
    harvest: "2026/27",
    soilType: "Argiloso",
    irrigation: "Pivô",
    estimatedProductivity: "60,5",
    productivityUnit: "sacas/ha",
  };
  const areaInput = buildCreateAreaInput(areaValues, true);
  const productInput = buildCreateStockProductInput(
    {
      name: " Adubo ",
      categoryLabel: "Adubo",
      initialQuantity: "1.234,56",
      unit: " kg ",
      minimumStock: "100,5",
      storageLocation: "Depósito",
      note: "Safra",
      supplier: "Cooperativa",
      unitValue: "85,50",
      expirationDate: "2027-08-08",
      batchNumber: "L1",
      purchaseDate: "2026-08-08",
      technicalNote: "Seco",
    },
    true,
  );

  assert.equal(areaInput.size, "1.234,56");
  assert.equal(productInput.initialQuantity, "1.234,56");
  assert.equal(productInput.unitValue, "85,50");
  assert.equal(
    buildCreateAreaInput(
      { ...areaValues, estimatedProductivity: "" },
      true,
    ).productivityUnit,
    null,
  );
  assert.equal(prepareCreateAreaWebInput(areaInput).size, "1234.56");
  assert.equal(
    prepareCreateStockProductWebInput(productInput).initialQuantity,
    "1234.56",
  );
  assertNoAuthorityFields({ areaInput, productInput });
});

test("IDs candidatos permanecem string e o modo simples cria somente NOTE", () => {
  const submission = buildFarmRecordSubmission(baseRecord, {
    mode: "simples",
    canMoveStock: true,
    stockMovementEnabled: true,
  });

  assert.equal(submission.kind, "record");
  assert.equal(submission.input.type, FarmRecordType.NOTE);
  assert.equal(submission.input.areaId, "area_cuid_123");
  assert.equal(typeof submission.input.areaId, "string");
  assert.equal(submission.input.productId, null);
  assertNoAuthorityFields(submission);
});

test("Compra e Entrada no estoque usam exclusivamente payload atômico IN", () => {
  for (const typeLabel of ["Compra", "Entrada no estoque"] as const) {
    const submission = buildFarmRecordSubmission(
      { ...baseRecord, typeLabel },
      {
        mode: "completo",
        canMoveStock: true,
        stockMovementEnabled: true,
      },
    );

    assert.equal(submission.kind, "record-with-stock");
    if (submission.kind !== "record-with-stock") continue;
    assert.equal(submission.input.stockMovement.type, StockMovementType.IN);
    assert.equal(submission.input.farmRecord.quantity, "500");
    assert.equal(submission.input.farmRecord.quantityUnit, "litros");
    assert.equal(submission.input.stockMovement.amount, "2,5");
    assert.equal(submission.input.farmRecord.productId, "product_cuid_456");
    assert.deepEqual(Object.keys(submission.input.stockMovement).sort(), [
      "amount",
      "reason",
      "type",
    ]);
    const prepared = prepareCreateFarmRecordWithStockMovementWebInput(
      submission.input,
    );
    assert.equal(prepared.farmRecord.quantity, "500");
    assert.equal(prepared.stockMovement.type, StockMovementType.IN);
    assert.equal(prepared.stockMovement.amount, "2.5");
    assertNoAuthorityFields(submission);
  }
});

test("Pulverização, Plantio e Manutenção usam exclusivamente payload atômico OUT", () => {
  for (const typeLabel of [
    "Pulverização",
    "Plantio",
    "Manutenção",
  ] as const) {
    const submission = buildFarmRecordSubmission(
      { ...baseRecord, typeLabel },
      {
        mode: "completo",
        canMoveStock: true,
        stockMovementEnabled: true,
      },
    );

    assert.equal(submission.kind, "record-with-stock");
    if (submission.kind !== "record-with-stock") continue;
    assert.equal(submission.input.stockMovement.type, StockMovementType.OUT);
    assert.equal(submission.input.stockMovement.amount, "2,5");
    assert.equal(submission.input.farmRecord.areaId, "area_cuid_123");
    assert.equal(
      Object.hasOwn(submission.input.stockMovement, "productId"),
      false,
    );
    assert.equal(Object.hasOwn(submission.input.stockMovement, "areaId"), false);
    assertNoAuthorityFields(submission);
  }
});

test("movimentação desabilitada ou sem capability mantém um único registro normal", () => {
  const disabled = buildFarmRecordSubmission(
    { ...baseRecord, typeLabel: "Pulverização" },
    {
      mode: "completo",
      canMoveStock: true,
      stockMovementEnabled: false,
    },
  );
  const forbidden = buildFarmRecordSubmission(
    { ...baseRecord, typeLabel: "Compra" },
    {
      mode: "completo",
      canMoveStock: false,
      stockMovementEnabled: true,
    },
  );

  assert.equal(disabled.kind, "record");
  assert.equal(forbidden.kind, "record");
  assert.equal(Object.hasOwn(disabled.input, "stockMovement"), false);
  assert.equal(Object.hasOwn(forbidden.input, "stockMovement"), false);
  assertNoAuthorityFields({ disabled, forbidden });
});

test("sucesso retorna à lista mais recente somente quando a página usa cursor", () => {
  assert.equal(getFarmRecordSuccessNavigation(false), "refresh");
  assert.equal(
    getFarmRecordSuccessNavigation(true),
    "replace-with-latest",
  );
});

test("formatação e alerta usam Decimal string sem mudar o valor canônico", () => {
  const canonical = "1234567.89";
  assert.equal(formatRuralDecimalPtBr(canonical), "1.234.567,89");
  assert.equal(canonical, "1234567.89");
  assert.equal(isLowStock({ quantity: "9.75", minimumStock: "10" }), true);
  assert.equal(isLowStock({ quantity: "10", minimumStock: "10.0000" }), true);
  assert.equal(isLowStock({ quantity: "10.01", minimumStock: "10" }), false);
  assert.equal(isLowStock({ quantity: "0", minimumStock: null }), false);
});

test("apresentação por role reflete as capabilities rurais existentes", () => {
  const owner = getRuralUiPermissions(PropertyRole.OWNER);
  const manager = getRuralUiPermissions(PropertyRole.MANAGER);
  const employee = getRuralUiPermissions(PropertyRole.EMPLOYEE);
  const viewer = getRuralUiPermissions(PropertyRole.VIEWER);

  assert.deepEqual(owner, manager);
  assert.equal(employee.canCreateArea, false);
  assert.equal(employee.canCreateProduct, false);
  assert.equal(employee.canCreateRecord, true);
  assert.equal(employee.canMoveStock, true);
  assert.equal(viewer.canRead, true);
  assert.equal(viewer.canCreateArea, false);
  assert.equal(viewer.canCreateProduct, false);
  assert.equal(viewer.canCreateRecord, false);
  assert.equal(viewer.canMoveStock, false);
});
