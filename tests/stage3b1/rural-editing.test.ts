import assert from "node:assert/strict";
import test from "node:test";
import {
  AreaType,
  ProductCategory,
  PropertyRole,
} from "@/generated/prisma/enums";
import {
  getCapabilities,
  hasCapability,
} from "@/services/autorizacao/property-role-policy";
import type {
  AreaDto,
  StockProductDto,
} from "@/services/rural/rural-dtos";
import {
  buildAdjustStockInput,
  buildUpdateAreaInput,
  buildUpdateStockProductInput,
  getAreaEditFormValues,
  getRuralUiPermissions,
  getStockAdjustmentDifference,
  getStockProductEditFormValues,
} from "@/services/rural/rural-ui";
import { fitsRuralDecimalStorage } from "@/services/rural/rural-decimal";
import {
  prepareAdjustStockWebInput,
  prepareUpdateAreaWebInput,
  prepareUpdateStockProductWebInput,
  RuralWebInputError,
} from "@/services/rural/rural-web-inputs";

const AUTHORITY_FIELDS = [
  "propertyId",
  "actorUserId",
  "createdByUserId",
  "role",
  "capability",
  "source",
] as const;

const area: AreaDto = {
  id: "area_candidate_1",
  name: "Talhão Norte",
  type: AreaType.FIELD,
  size: "1234.56",
  sizeUnit: "ha",
  note: "Área principal",
  currentCrop: "Milho",
  harvest: "2026/27",
  soilType: "Argiloso",
  irrigation: "Pivô",
  estimatedProductivity: "60.5",
  productivityUnit: "sacas/ha",
  createdAt: "2026-08-07T10:00:00.000Z",
  updatedAt: "2026-08-08T10:00:00.000Z",
};

const product: StockProductDto = {
  id: "product_candidate_1",
  name: "Adubo NPK",
  category: ProductCategory.FERTILIZER,
  quantity: "128",
  unit: "kg",
  minimumStock: "10.5",
  storageLocation: "Depósito 1",
  note: "Safra atual",
  supplier: "Cooperativa",
  unitValue: "1234.56",
  expirationDate: "2027-08-08",
  batchNumber: "LOTE-1",
  purchaseDate: "2026-08-08",
  technicalNote: "Manter seco",
  createdAt: "2026-08-07T10:00:00.000Z",
  updatedAt: "2026-08-08T10:00:00.000Z",
};

function expectWebInputError(
  operation: () => unknown,
  code: RuralWebInputError["code"],
) {
  assert.throws(operation, (error: unknown) => {
    assert.ok(error instanceof RuralWebInputError);
    assert.equal(error.code, code);
    return true;
  });
}

function assertNoAuthorityFields(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const field of AUTHORITY_FIELDS) {
    assert.equal(serialized.includes(`\"${field}\"`), false, field);
  }
}

test("capabilities de edição e ajuste são explícitas por papel", () => {
  for (const role of [PropertyRole.OWNER, PropertyRole.MANAGER]) {
    assert.equal(hasCapability(role, "EDIT_AREA"), true);
    assert.equal(hasCapability(role, "EDIT_PRODUCT"), true);
    assert.equal(hasCapability(role, "ADJUST_STOCK"), true);
  }

  for (const role of [PropertyRole.EMPLOYEE, PropertyRole.VIEWER]) {
    assert.equal(hasCapability(role, "EDIT_AREA"), false);
    assert.equal(hasCapability(role, "EDIT_PRODUCT"), false);
    assert.equal(hasCapability(role, "ADJUST_STOCK"), false);
  }

  assert.ok(getCapabilities(PropertyRole.OWNER).includes("EDIT_AREA"));
  assert.ok(getCapabilities(PropertyRole.MANAGER).includes("EDIT_PRODUCT"));
});

test("permissões de apresentação refletem a mesma matriz de edição", () => {
  for (const role of [PropertyRole.OWNER, PropertyRole.MANAGER]) {
    const permissions = getRuralUiPermissions(role);
    assert.equal(permissions.canEditArea, true);
    assert.equal(permissions.canEditProduct, true);
    assert.equal(permissions.canAdjustStock, true);
  }

  for (const role of [PropertyRole.EMPLOYEE, PropertyRole.VIEWER]) {
    const permissions = getRuralUiPermissions(role);
    assert.equal(permissions.canEditArea, false);
    assert.equal(permissions.canEditProduct, false);
    assert.equal(permissions.canAdjustStock, false);
  }
});

test("adapter de edição de área pré-preenche PT-BR e envia allowlist exata", () => {
  const values = getAreaEditFormValues(area);
  assert.equal(values.typeLabel, "Lavoura");
  assert.equal(values.size, "1.234,56");
  assert.equal(values.estimatedProductivity, "60,5");

  const input = buildUpdateAreaInput(area.id, {
    ...values,
    name: " Talhão Norte Editado ",
    note: " Conferido ",
  });

  assert.deepEqual(Object.keys(input).sort(), [
    "areaId",
    "currentCrop",
    "estimatedProductivity",
    "harvest",
    "irrigation",
    "name",
    "note",
    "productivityUnit",
    "size",
    "sizeUnit",
    "soilType",
    "type",
  ]);
  assert.equal(input.areaId, area.id);
  assert.equal(input.name, "Talhão Norte Editado");
  assert.equal(input.size, "1.234,56");
  assert.equal(input.note, "Conferido");
  assertNoAuthorityFields(input);

  const prepared = prepareUpdateAreaWebInput(input);
  assert.equal(prepared.size, "1234.56");
  assert.equal(prepared.estimatedProductivity, "60.5");
});

test("allowlist de área recusa autoridade e campos estruturais", () => {
  const valid = buildUpdateAreaInput(area.id, getAreaEditFormValues(area));

  for (const field of AUTHORITY_FIELDS) {
    expectWebInputError(
      () => prepareUpdateAreaWebInput({ ...valid, [field]: "forjado" }),
      "AUTHORITY_FIELD_NOT_ALLOWED",
    );
  }
  for (const field of ["archivedAt", "createdAt", "updatedAt", "aliases"]) {
    expectWebInputError(
      () => prepareUpdateAreaWebInput({ ...valid, [field]: "forjado" }),
      "INVALID_INPUT",
    );
  }
});

test("adapter de produto pré-preenche metadados sem expor quantity", () => {
  const values = getStockProductEditFormValues(product);
  assert.equal(values.categoryLabel, "Adubo");
  assert.equal(values.minimumStock, "10,5");
  assert.equal(values.unitValue, "1.234,56");
  assert.equal(values.expirationDate, "2027-08-08");
  assert.equal(values.purchaseDate, "2026-08-08");
  assert.equal(Object.hasOwn(values, "quantity"), false);
  assert.equal(Object.hasOwn(values, "initialQuantity"), false);

  const input = buildUpdateStockProductInput(product.id, {
    ...values,
    name: " Adubo NPK 10-10-10 ",
    supplier: " Nova cooperativa ",
  });

  assert.deepEqual(Object.keys(input).sort(), [
    "batchNumber",
    "category",
    "expirationDate",
    "minimumStock",
    "name",
    "note",
    "productId",
    "purchaseDate",
    "storageLocation",
    "supplier",
    "technicalNote",
    "unit",
    "unitValue",
  ]);
  assert.equal(input.productId, product.id);
  assert.equal(input.name, "Adubo NPK 10-10-10");
  assert.equal(input.supplier, "Nova cooperativa");
  assert.equal(Object.hasOwn(input, "quantity"), false);
  assert.equal(Object.hasOwn(input, "initialQuantity"), false);
  assertNoAuthorityFields(input);

  const prepared = prepareUpdateStockProductWebInput(input);
  assert.equal(prepared.minimumStock, "10.5");
  assert.equal(prepared.unitValue, "1234.56");
  assert.equal(prepared.expirationDate?.toISOString(), "2027-08-08T00:00:00.000Z");
});

test("edição de produto rejeita quantity, aliases e campos de autoridade", () => {
  const valid = buildUpdateStockProductInput(
    product.id,
    getStockProductEditFormValues(product),
  );

  for (const field of ["quantity", "initialQuantity", "aliases", "archivedAt"]) {
    expectWebInputError(
      () => prepareUpdateStockProductWebInput({ ...valid, [field]: "999" }),
      "INVALID_INPUT",
    );
  }
  for (const field of AUTHORITY_FIELDS) {
    expectWebInputError(
      () =>
        prepareUpdateStockProductWebInput({ ...valid, [field]: "forjado" }),
      "AUTHORITY_FIELD_NOT_ALLOWED",
    );
  }
});

test("ajuste envia somente alvo e motivo e calcula preview decimal exato", () => {
  const input = buildAdjustStockInput(product.id, {
    targetQuantity: " 120,25 ",
    reason: " Contagem física do depósito ",
  });

  assert.deepEqual(input, {
    productId: product.id,
    targetQuantity: "120,25",
    reason: "Contagem física do depósito",
  });
  assert.equal(Object.hasOwn(input, "difference"), false);
  assert.equal(Object.hasOwn(input, "currentQuantity"), false);
  assertNoAuthorityFields(input);

  assert.equal(getStockAdjustmentDifference("128", "120"), "-8");
  assert.equal(getStockAdjustmentDifference("120", "150"), "30");
  assert.equal(getStockAdjustmentDifference("0.3", "0,1"), "-0.2");
  assert.equal(getStockAdjustmentDifference("1.234", "2"), "0.766");
  assert.equal(getStockAdjustmentDifference("0.001", "0,002"), "0.001");
  assert.equal(
    getStockAdjustmentDifference(
      "9999999999999.9",
      "10000000000000",
    ),
    "0.1",
  );
  assert.equal(getStockAdjustmentDifference("120", ""), null);
  assert.equal(getStockAdjustmentDifference("120", "1.234"), null);
  assert.equal(getStockAdjustmentDifference("128", "128.00001"), null);
  assert.equal(
    fitsRuralDecimalStorage("99999999999999.9999", 18, 4),
    true,
  );
  assert.equal(fitsRuralDecimalStorage("128.00001", 18, 4), false);
  assert.equal(fitsRuralDecimalStorage("100000000000000", 18, 4), false);
});

test("allowlist de ajuste normaliza PT-BR e recusa preview, autoridade e motivo vazio", () => {
  const prepared = prepareAdjustStockWebInput({
    productId: product.id,
    targetQuantity: "1.234,56",
    reason: " Conferência física ",
  });
  assert.deepEqual(prepared, {
    productId: product.id,
    targetQuantity: "1234.56",
    reason: "Conferência física",
  });

  for (const field of ["difference", "currentQuantity", "newBalance", "amount"]) {
    expectWebInputError(
      () =>
        prepareAdjustStockWebInput({
          productId: product.id,
          targetQuantity: "120",
          reason: "Contagem",
          [field]: "forjado",
        }),
      "INVALID_INPUT",
    );
  }
  for (const field of AUTHORITY_FIELDS) {
    expectWebInputError(
      () =>
        prepareAdjustStockWebInput({
          productId: product.id,
          targetQuantity: "120",
          reason: "Contagem",
          [field]: "forjado",
        }),
      "AUTHORITY_FIELD_NOT_ALLOWED",
    );
  }
  expectWebInputError(
    () =>
      prepareAdjustStockWebInput({
        productId: product.id,
        targetQuantity: "120",
        reason: "   ",
      }),
    "INVALID_INPUT",
  );
});
