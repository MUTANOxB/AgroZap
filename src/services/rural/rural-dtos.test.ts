import assert from "node:assert/strict";
import test from "node:test";
import {
  AreaType,
  FarmRecordType,
  ProductCategory,
  RecordSource,
  StockMovementType,
} from "@/generated/prisma/enums";
import {
  toAreaDto,
  toAuditLogDto,
  toFarmRecordDto,
  toStockMovementDto,
  toStockProductDto,
} from "./rural-dtos";

const decimal = (value: string) => ({ toString: () => value });
const createdAt = new Date("2026-08-07T10:20:30.000Z");
const updatedAt = new Date("2026-08-08T11:21:31.000Z");

test("DTOs rurais convertem Decimal e Date sem perder snapshots", () => {
  const area = toAreaDto({
    id: "area-a",
    name: "Talhão histórico",
    type: AreaType.FIELD,
    size: decimal("1234.5678"),
    sizeUnit: "ha",
    note: null,
    currentCrop: "Soja",
    harvest: "2026/27",
    soilType: null,
    irrigation: null,
    estimatedProductivity: decimal("60.25"),
    productivityUnit: "sc/ha",
    createdAt,
    updatedAt,
  });
  const product = toStockProductDto({
    id: "product-a",
    name: "Produto atual",
    category: ProductCategory.FERTILIZER,
    quantity: decimal("999999999999.1234"),
    unit: "kg",
    minimumStock: decimal("10.5"),
    storageLocation: null,
    note: null,
    supplier: null,
    unitValue: decimal("123.45"),
    expirationDate: new Date("2027-03-04T00:00:00.000Z"),
    batchNumber: null,
    purchaseDate: new Date("2026-08-01T00:00:00.000Z"),
    technicalNote: null,
    createdAt,
    updatedAt,
  });
  const record = toFarmRecordDto({
    id: "record-a",
    areaId: "area-a",
    productId: "product-a",
    createdByUserId: "user-a",
    performedByUserId: null,
    type: FarmRecordType.SPRAYING,
    description: "Aplicação",
    locationDescription: null,
    occurredAt: createdAt,
    quantity: decimal("1.25"),
    quantityUnit: "L",
    value: null,
    responsibleName: null,
    productNameSnapshot: "Produto histórico",
    areaNameSnapshot: "Área histórica",
    appliedDose: decimal("0.125"),
    doseUnit: "L/ha",
    harvest: null,
    supplier: null,
    productBatch: null,
    technicalNote: null,
    source: RecordSource.WEB,
    createdAt,
    updatedAt,
  });
  const movement = toStockMovementDto({
    id: "movement-a",
    productId: "product-a",
    areaId: "area-a",
    farmRecordId: "record-a",
    type: StockMovementType.OUT,
    quantityChange: decimal("-1.25"),
    productNameSnapshot: "Produto histórico",
    areaNameSnapshot: "Área histórica",
    unitSnapshot: "L",
    balanceBefore: decimal("10"),
    balanceAfter: decimal("8.75"),
    createdByUserId: "user-a",
    performedByUserId: null,
    source: RecordSource.WEB,
    reason: null,
    occurredAt: createdAt,
    createdAt,
    reversesMovementId: null,
  });

  assert.equal(area.size, "1234.5678");
  assert.equal(product.quantity, "999999999999.1234");
  assert.equal(product.expirationDate, "2027-03-04");
  assert.equal(record.productNameSnapshot, "Produto histórico");
  assert.equal(record.areaNameSnapshot, "Área histórica");
  assert.equal(movement.quantityChange, "-1.25");
  assert.equal(movement.productNameSnapshot, "Produto histórico");
  assert.equal(movement.occurredAt, createdAt.toISOString());

  const serialized = JSON.stringify({ area, product, record, movement });
  assert.equal(serialized.includes("999999999999.1234"), true);
  assert.equal(serialized.includes("2026-08-07T10:20:30.000Z"), true);
});

test("AuditLog DTO produz somente JSON serializável e ISO string", () => {
  const dto = toAuditLogDto({
    id: "audit-a",
    actorUserId: null,
    action: "TEST",
    entityType: "FarmRecord",
    entityId: "record-a",
    source: RecordSource.SYSTEM,
    beforeData: null,
    afterData: { quantity: "12.5", nested: [true, null] },
    metadata: { at: createdAt },
    createdAt,
  });

  assert.deepEqual(dto.afterData, {
    quantity: "12.5",
    nested: [true, null],
  });
  assert.deepEqual(dto.metadata, { at: createdAt.toISOString() });
  assert.equal(dto.createdAt, createdAt.toISOString());
  assert.doesNotThrow(() => JSON.stringify(dto));
});
