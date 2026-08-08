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
} = prismaModule;
const { db } = prismaLib;
const {
  DASHBOARD_RECENT_FARM_RECORD_LIMIT,
  DASHBOARD_STOCK_OVERVIEW_LIMIT,
  getRuralQueryIntegrationHarness,
} = queryService;
const { getDashboardSummaryByPropertyId } =
  getRuralQueryIntegrationHarness();
const { createTenant } = fixtures;

after(async () => {
  await db.$disconnect();
});

function token(label: string) {
  return `stage3b-dashboard-${label}-${randomUUID()}`;
}

async function createArea(
  propertyId: string,
  label: string,
  archivedAt: Date | null = null,
) {
  return db.area.create({
    data: {
      propertyId,
      name: `Área ${label}`,
      normalizedName: token(`${label}-area`).toLowerCase(),
      type: AreaType.FIELD,
      archivedAt,
    },
  });
}

async function createProduct(input: {
  propertyId: string;
  label: string;
  quantity: string;
  minimumStock?: string | null;
  archivedAt?: Date | null;
}) {
  return db.stockProduct.create({
    data: {
      propertyId: input.propertyId,
      name: `Produto ${input.label}`,
      normalizedName: token(`${input.label}-product`).toLowerCase(),
      category: ProductCategory.OTHER,
      quantity: new Prisma.Decimal(input.quantity),
      unit: "un",
      minimumStock:
        input.minimumStock === undefined || input.minimumStock === null
          ? null
          : new Prisma.Decimal(input.minimumStock),
      archivedAt: input.archivedAt ?? null,
    },
  });
}

async function createRecord(input: {
  propertyId: string;
  userId: string;
  label: string;
  occurredAt: Date;
  areaId?: string | null;
  productId?: string | null;
}) {
  return db.farmRecord.create({
    data: {
      propertyId: input.propertyId,
      areaId: input.areaId ?? null,
      productId: input.productId ?? null,
      createdByUserId: input.userId,
      type: FarmRecordType.NOTE,
      description: `Registro ${input.label}`,
      occurredAt: input.occurredAt,
      source: RecordSource.WEB,
    },
  });
}

test("resumo do dashboard mantém cadastros e histórico isolados entre Properties A e B", async () => {
  const [tenantA, tenantB] = await Promise.all([
    createTenant(),
    createTenant(),
  ]);
  const [areaA, areaB, productA, productB] = await Promise.all([
    createArea(tenantA.property.id, "tenant-a"),
    createArea(tenantB.property.id, "tenant-b"),
    createProduct({
      propertyId: tenantA.property.id,
      label: "tenant-a",
      quantity: "2",
      minimumStock: "5",
    }),
    createProduct({
      propertyId: tenantB.property.id,
      label: "tenant-b",
      quantity: "1",
      minimumStock: "3",
    }),
  ]);
  const [recordA, recordB] = await Promise.all([
    createRecord({
      propertyId: tenantA.property.id,
      userId: tenantA.users[0].id,
      label: "tenant-a",
      occurredAt: new Date("2026-08-08T10:00:00.000Z"),
      areaId: areaA.id,
      productId: productA.id,
    }),
    createRecord({
      propertyId: tenantB.property.id,
      userId: tenantB.users[0].id,
      label: "tenant-b",
      occurredAt: new Date("2026-08-08T11:00:00.000Z"),
      areaId: areaB.id,
      productId: productB.id,
    }),
  ]);

  const [summaryA, summaryB] = await Promise.all([
    getDashboardSummaryByPropertyId(tenantA.property.id),
    getDashboardSummaryByPropertyId(tenantB.property.id),
  ]);

  assert.deepEqual(summaryA.counts, {
    activeAreas: 1,
    farmRecords: 1,
    activeProducts: 1,
    lowStockProducts: 1,
  });
  assert.deepEqual(summaryB.counts, summaryA.counts);
  assert.deepEqual(
    summaryA.recentFarmRecords.map((record) => record.id),
    [recordA.id],
  );
  assert.deepEqual(
    summaryB.recentFarmRecords.map((record) => record.id),
    [recordB.id],
  );
  assert.deepEqual(
    summaryA.stockOverviewProducts.map((product) => product.id),
    [productA.id],
  );
  assert.deepEqual(
    summaryB.stockOverviewProducts.map((product) => product.id),
    [productB.id],
  );
  assert.doesNotThrow(() => JSON.stringify({ summaryA, summaryB }));
});

test("Property vazia recebe contagens zero e listas vazias", async () => {
  const tenant = await createTenant();

  const summary = await getDashboardSummaryByPropertyId(tenant.property.id);

  assert.deepEqual(summary, {
    counts: {
      activeAreas: 0,
      farmRecords: 0,
      activeProducts: 0,
      lowStockProducts: 0,
    },
    recentFarmRecords: [],
    stockOverviewProducts: [],
  });
});

test("total de registros não é reduzido ao limite do histórico recente", async () => {
  const tenant = await createTenant();
  const recordCount = DASHBOARD_RECENT_FARM_RECORD_LIMIT + 3;
  const baseTime = Date.parse("2026-08-08T12:00:00.000Z");
  const records = await Promise.all(
    Array.from({ length: recordCount }, (_, index) =>
      createRecord({
        propertyId: tenant.property.id,
        userId: tenant.users[0].id,
        label: `limit-${index}`,
        occurredAt: new Date(baseTime + index * 60_000),
      }),
    ),
  );

  const summary = await getDashboardSummaryByPropertyId(tenant.property.id);

  assert.equal(summary.counts.farmRecords, recordCount);
  assert.equal(
    summary.recentFarmRecords.length,
    DASHBOARD_RECENT_FARM_RECORD_LIMIT,
  );
  assert.deepEqual(
    summary.recentFarmRecords.map((record) => record.id),
    [...records]
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
      .slice(0, DASHBOARD_RECENT_FARM_RECORD_LIMIT)
      .map((record) => record.id),
  );
});

test("estoque baixo usa quantity <= mínimo, ignora arquivados e prioriza alertas", async () => {
  const tenant = await createTenant();
  const archivedAt = new Date("2026-08-01T00:00:00.000Z");
  const activeProducts = await Promise.all([
    createProduct({
      propertyId: tenant.property.id,
      label: "01 acima",
      quantity: "6",
      minimumStock: "5",
    }),
    createProduct({
      propertyId: tenant.property.id,
      label: "02 acima",
      quantity: "7",
      minimumStock: "5",
    }),
    createProduct({
      propertyId: tenant.property.id,
      label: "03 acima",
      quantity: "8",
      minimumStock: "5",
    }),
    createProduct({
      propertyId: tenant.property.id,
      label: "04 sem mínimo",
      quantity: "0",
    }),
    createProduct({
      propertyId: tenant.property.id,
      label: "98 abaixo",
      quantity: "4.5",
      minimumStock: "5",
    }),
    createProduct({
      propertyId: tenant.property.id,
      label: "99 igual",
      quantity: "5",
      minimumStock: "5",
    }),
  ]);
  const lowStockProductIds = new Set(
    activeProducts.slice(-2).map((product) => product.id),
  );
  const archivedProduct = await createProduct({
    propertyId: tenant.property.id,
    label: "00 arquivado abaixo",
    quantity: "0",
    minimumStock: "10",
    archivedAt,
  });

  const summary = await getDashboardSummaryByPropertyId(tenant.property.id);

  assert.equal(summary.counts.activeProducts, activeProducts.length);
  assert.equal(summary.counts.lowStockProducts, 2);
  assert.equal(
    summary.stockOverviewProducts.length,
    DASHBOARD_STOCK_OVERVIEW_LIMIT,
  );
  assert.ok(
    [...lowStockProductIds].every((productId) =>
      summary.stockOverviewProducts.some((product) => product.id === productId),
    ),
  );
  assert.equal(
    summary.stockOverviewProducts.some(
      (product) => product.id === archivedProduct.id,
    ),
    false,
  );
  assert.ok(
    summary.stockOverviewProducts.every(
      (product) =>
        typeof product.id === "string" &&
        typeof product.quantity === "string",
    ),
  );
});
