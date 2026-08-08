import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { assertSafeIntegrationRuntime } from "./test-database";

assertSafeIntegrationRuntime(process.env);

const [prismaModule, prismaLib, queryService, fixtures] = await Promise.all([
  import("@/generated/prisma/client"),
  import("@/lib/prisma"),
  import("@/services/rural/rural-query.service"),
  import("./fixtures"),
]);

const {
  AreaType,
  FarmRecordType,
  Prisma,
  ProductCategory,
  RecordSource,
  StockMovementType,
} = prismaModule;
const { db } = prismaLib;
const {
  RuralQueryError,
  getRuralQueryIntegrationHarness,
} = queryService;
const {
  listActiveAreasByPropertyId,
  listActiveProductsByPropertyId,
  listAuditLogsByPropertyId,
  listFarmRecordsByPropertyId,
  listStockMovementsByPropertyId,
} = getRuralQueryIntegrationHarness();
const { createTenant } = fixtures;

after(async () => {
  await db.$disconnect();
});

function token(label: string) {
  return `stage3a-${label}-${randomUUID()}`;
}

async function createQueryScenario(label: string, historyCount = 5) {
  const tenant = await createTenant();
  const activeArea = await db.area.create({
    data: {
      id: token(`${label}-active-area`),
      propertyId: tenant.property.id,
      name: `Área ativa ${label}`,
      normalizedName: token(`${label}-active-area-name`).toLowerCase(),
      type: AreaType.FIELD,
      size: new Prisma.Decimal("1234.5678"),
      sizeUnit: "ha",
    },
  });
  const archivedArea = await db.area.create({
    data: {
      id: token(`${label}-archived-area`),
      propertyId: tenant.property.id,
      name: `Área arquivada ${label}`,
      normalizedName: token(`${label}-archived-area-name`).toLowerCase(),
      type: AreaType.PASTURE,
      archivedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
  });
  const activeProduct = await db.stockProduct.create({
    data: {
      id: token(`${label}-active-product`),
      propertyId: tenant.property.id,
      name: `Produto ativo ${label}`,
      normalizedName: token(`${label}-active-product-name`).toLowerCase(),
      category: ProductCategory.FERTILIZER,
      quantity: new Prisma.Decimal("123456789.125"),
      unit: "kg",
      minimumStock: new Prisma.Decimal("10.5"),
      expirationDate: new Date("2027-03-04T00:00:00.000Z"),
    },
  });
  const archivedProduct = await db.stockProduct.create({
    data: {
      id: token(`${label}-archived-product`),
      propertyId: tenant.property.id,
      name: `Produto arquivado ${label}`,
      normalizedName: token(`${label}-archived-product-name`).toLowerCase(),
      category: ProductCategory.OTHER,
      quantity: new Prisma.Decimal("0"),
      unit: "un",
      archivedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
  });

  const records = [];
  const movements = [];
  const auditLogs = [];
  const baseTime = Date.parse("2026-08-07T15:00:00.000Z");

  for (let index = 0; index < historyCount; index += 1) {
    // Pares compartilham o mesmo instante para provar o desempate por ID.
    const occurredAt = new Date(baseTime - Math.floor(index / 2) * 60_000);
    const record = await db.farmRecord.create({
      data: {
        id: token(`${label}-record-${index}`),
        propertyId: tenant.property.id,
        areaId: activeArea.id,
        productId: activeProduct.id,
        createdByUserId: tenant.users[0].id,
        type: FarmRecordType.NOTE,
        description: `Registro ${label} ${index}`,
        occurredAt,
        quantity: new Prisma.Decimal(`${index + 1}.25`),
        productNameSnapshot: `Produto snapshot ${label}`,
        areaNameSnapshot: `Área snapshot ${label}`,
        source: RecordSource.WEB,
      },
    });
    const movement = await db.stockMovement.create({
      data: {
        id: token(`${label}-movement-${index}`),
        propertyId: tenant.property.id,
        productId: activeProduct.id,
        areaId: activeArea.id,
        farmRecordId: record.id,
        type: StockMovementType.OUT,
        quantityChange: new Prisma.Decimal("-1"),
        productNameSnapshot: `Produto snapshot ${label}`,
        areaNameSnapshot: `Área snapshot ${label}`,
        unitSnapshot: "kg",
        balanceBefore: new Prisma.Decimal("10"),
        balanceAfter: new Prisma.Decimal("9"),
        createdByUserId: tenant.users[0].id,
        source: RecordSource.WEB,
        occurredAt,
      },
    });
    const audit = await db.auditLog.create({
      data: {
        id: token(`${label}-audit-${index}`),
        propertyId: tenant.property.id,
        actorUserId: tenant.users[0].id,
        action: "STAGE3A_QUERY_TEST",
        entityType: "FarmRecord",
        entityId: record.id,
        source: RecordSource.WEB,
        afterData: { quantity: `${index + 1}.25` },
        createdAt: occurredAt,
      },
    });
    records.push(record);
    movements.push(movement);
    auditLogs.push(audit);
  }

  return {
    ...tenant,
    activeArea,
    archivedArea,
    activeProduct,
    archivedProduct,
    records,
    movements,
    auditLogs,
  };
}

function expectedDescending<T extends { id: string }>(
  values: T[],
  date: (value: T) => Date,
) {
  return [...values]
    .sort(
      (left, right) =>
        date(right).getTime() - date(left).getTime() ||
        right.id.localeCompare(left.id),
    )
    .map((value) => value.id);
}

async function collectPages<T extends { id: string }>(
  read: (cursor: string | null) => Promise<{
    items: T[];
    nextCursor: string | null;
  }>,
) {
  const items: T[] = [];
  let cursor: string | null = null;

  do {
    const page = await read(cursor);
    assert.ok(page.items.length <= 2);
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== null);

  return items;
}

test("queries da Property A não retornam cadastros nem histórico da B", async () => {
  const [scenarioA, scenarioB] = await Promise.all([
    createQueryScenario("A", 2),
    createQueryScenario("B", 2),
  ]);

  const [areas, products, records, movements, auditLogs] = await Promise.all([
    listActiveAreasByPropertyId(scenarioA.property.id),
    listActiveProductsByPropertyId(scenarioA.property.id),
    listFarmRecordsByPropertyId(scenarioA.property.id),
    listStockMovementsByPropertyId(scenarioA.property.id),
    listAuditLogsByPropertyId(scenarioA.property.id),
  ]);

  assert.deepEqual(areas.map((area) => area.id), [scenarioA.activeArea.id]);
  assert.equal(areas.some((area) => area.id === scenarioA.archivedArea.id), false);
  assert.equal(areas.some((area) => area.id === scenarioB.activeArea.id), false);

  assert.deepEqual(products.map((product) => product.id), [
    scenarioA.activeProduct.id,
  ]);
  assert.equal(products[0].quantity, "123456789.125");
  assert.equal(products[0].expirationDate, "2027-03-04");
  assert.equal(
    products.some((product) => product.id === scenarioA.archivedProduct.id),
    false,
  );
  assert.equal(
    products.some((product) => product.id === scenarioB.activeProduct.id),
    false,
  );

  assert.deepEqual(
    new Set(records.items.map((record) => record.id)),
    new Set(scenarioA.records.map((record) => record.id)),
  );
  assert.ok(
    records.items.every(
      (record) =>
        record.productNameSnapshot === "Produto snapshot A" &&
        record.areaNameSnapshot === "Área snapshot A" &&
        typeof record.quantity === "string" &&
        typeof record.occurredAt === "string",
    ),
  );
  assert.ok(
    movements.items.every(
      (movement) =>
        movement.productNameSnapshot === "Produto snapshot A" &&
        movement.areaNameSnapshot === "Área snapshot A" &&
        movement.quantityChange === "-1" &&
        typeof movement.createdAt === "string",
    ),
  );
  assert.deepEqual(
    new Set(auditLogs.items.map((audit) => audit.id)),
    new Set(scenarioA.auditLogs.map((audit) => audit.id)),
  );
  assert.ok(
    records.items.every(
      (record) => !scenarioB.records.some((other) => other.id === record.id),
    ),
  );
  assert.ok(
    movements.items.every(
      (movement) =>
        !scenarioB.movements.some((other) => other.id === movement.id),
    ),
  );
  assert.ok(
    auditLogs.items.every(
      (audit) => !scenarioB.auditLogs.some((other) => other.id === audit.id),
    ),
  );
  assert.doesNotThrow(() =>
    JSON.stringify({ areas, products, records, movements, auditLogs }),
  );
});

test("paginação PostgreSQL não duplica itens e mantém ordem determinística", async () => {
  const [scenarioA, scenarioB] = await Promise.all([
    createQueryScenario("PAGE-A", 5),
    createQueryScenario("PAGE-B", 5),
  ]);

  const records = await collectPages((cursor) =>
    listFarmRecordsByPropertyId(scenarioA.property.id, { cursor, limit: 2 }),
  );
  const movements = await collectPages((cursor) =>
    listStockMovementsByPropertyId(scenarioA.property.id, { cursor, limit: 2 }),
  );
  const audits = await collectPages((cursor) =>
    listAuditLogsByPropertyId(scenarioA.property.id, { cursor, limit: 2 }),
  );

  assert.deepEqual(
    records.map((record) => record.id),
    expectedDescending(scenarioA.records, (record) => record.occurredAt),
  );
  assert.deepEqual(
    movements.map((movement) => movement.id),
    expectedDescending(scenarioA.movements, (movement) => movement.occurredAt),
  );
  assert.deepEqual(
    audits.map((audit) => audit.id),
    expectedDescending(scenarioA.auditLogs, (audit) => audit.createdAt),
  );
  assert.equal(new Set(records.map((record) => record.id)).size, 5);
  assert.equal(new Set(movements.map((movement) => movement.id)).size, 5);
  assert.equal(new Set(audits.map((audit) => audit.id)).size, 5);
  assert.ok(
    records.every(
      (record) =>
        !scenarioB.records.some((otherRecord) => otherRecord.id === record.id),
    ),
  );
});

test("cursor de outra Property ou de outro histórico é recusado", async () => {
  const [scenarioA, scenarioB] = await Promise.all([
    createQueryScenario("CURSOR-A", 3),
    createQueryScenario("CURSOR-B", 3),
  ]);
  const recordPageB = await listFarmRecordsByPropertyId(
    scenarioB.property.id,
    { limit: 1 },
  );
  assert.ok(recordPageB.nextCursor);

  await assert.rejects(
    listFarmRecordsByPropertyId(scenarioA.property.id, {
      cursor: recordPageB.nextCursor,
      limit: 1,
    }),
    (error: unknown) => {
      assert.ok(error instanceof RuralQueryError);
      assert.equal(error.code, "INVALID_CURSOR");
      return true;
    },
  );
  await assert.rejects(
    listStockMovementsByPropertyId(scenarioB.property.id, {
      cursor: recordPageB.nextCursor,
      limit: 1,
    }),
    (error: unknown) => {
      assert.ok(error instanceof RuralQueryError);
      assert.equal(error.code, "INVALID_CURSOR");
      return true;
    },
  );
});
