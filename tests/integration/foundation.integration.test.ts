import assert from "node:assert/strict";
import { after, test } from "node:test";
import { assertSafeIntegrationRuntime } from "./test-database";

assertSafeIntegrationRuntime(process.env);

const [prismaModule, prismaLib, stockService, stockErrors, recordService, productService, areaService, fixtures] =
  await Promise.all([
    import("@/generated/prisma/client"),
    import("@/lib/prisma"),
    import("@/services/estoque/stock-movement.service"),
    import("@/services/estoque/errors"),
    import("@/services/registros/farm-record.service"),
    import("@/services/estoque/product.service"),
    import("@/services/talhoes/area.service"),
    import("./fixtures"),
  ]);

const {
  AreaType,
  FarmRecordType,
  Prisma,
  ProductCategory,
  StockMovementType,
} = prismaModule;
const { db } = prismaLib;
const { registerStockMovement, reverseStockMovement } = stockService;
const { StockDomainError } = stockErrors;
const { createFarmRecord } = recordService;
const { createStockProduct } = productService;
const { createArea } = areaService;
const { createStockScenario, createTenant } = fixtures;

after(async () => {
  await db.$disconnect();
});

async function expectStockError(
  operation: Promise<unknown>,
  acceptedCodes: string | string[],
) {
  const codes = Array.isArray(acceptedCodes) ? acceptedCodes : [acceptedCodes];
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof StockDomainError);
    assert.ok(
      codes.includes(error.code),
      `Código recebido: ${error.code}; esperados: ${codes.join(", ")}`,
    );
    return true;
  });
}

test("migrations do zero e duas execuções do seed deixam a fundação íntegra", async () => {
  const migrations = await db.$queryRaw<
    Array<{
      migration_name: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }>
  >`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name`;

  assert.deepEqual(
    migrations.map((migration) => migration.migration_name),
    [
      "20260807090000_initial_domain_foundation",
      "20260807120000_stage_1_1_hardening",
    ],
  );
  assert.ok(migrations.every((migration) => migration.finished_at !== null));
  assert.ok(migrations.every((migration) => migration.rolled_back_at === null));

  const property = await db.property.findUniqueOrThrow({
    where: { slug: "fazenda-demonstracao" },
    include: {
      _count: {
        select: {
          areas: true,
          areaAliases: true,
          products: true,
          productAliases: true,
          stockMovements: true,
          farmRecords: true,
          auditLogs: true,
          members: true,
        },
      },
    },
  });

  assert.deepEqual(property._count, {
    areas: 3,
    areaAliases: 4,
    products: 4,
    productAliases: 6,
    stockMovements: 4,
    farmRecords: 3,
    auditLogs: 7,
    members: 3,
  });
  assert.equal(
    await db.user.count({
      where: {
        phone: { in: ["+5500000000001", "+5500000000002", "+5500000000003"] },
      },
    }),
    3,
  );

  const openingMovements = await db.stockMovement.findMany({
    where: {
      propertyId: property.id,
      type: StockMovementType.ADJUSTMENT,
      reason: "Saldo inicial criado pelo seed",
    },
    include: { product: true },
  });
  assert.equal(openingMovements.length, 4);
  for (const movement of openingMovements) {
    assert.equal(movement.balanceBefore.toString(), "0");
    assert.ok(movement.balanceAfter.equals(movement.product.quantity));
    assert.ok(movement.quantityChange.equals(movement.product.quantity));
    assert.equal(movement.productNameSnapshot, movement.product.name);
    assert.equal(
      await db.auditLog.count({
        where: {
          propertyId: property.id,
          entityType: "StockMovement",
          entityId: movement.id,
          action: "STOCK_OPENING_BALANCE_CREATED",
        },
      }),
      1,
    );
  }

  const records = await db.farmRecord.findMany({
    where: { propertyId: property.id },
    include: { area: true, product: true },
  });
  assert.equal(records.length, 3);
  for (const record of records) {
    assert.equal(record.areaNameSnapshot, record.area?.name ?? null);
    assert.equal(record.productNameSnapshot, record.product?.name ?? null);
    assert.equal(
      await db.auditLog.count({
        where: {
          propertyId: property.id,
          entityType: "FarmRecord",
          entityId: record.id,
          action: "FARM_RECORD_CREATED",
        },
      }),
      1,
    );
  }
});

test("movimentação normal confirma saldo, histórico, auditoria e atores juntos", async () => {
  const scenario = await createStockScenario({ userCount: 2, quantity: "10" });
  const [createdBy, performedBy] = scenario.users;

  const movement = await registerStockMovement({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    type: StockMovementType.OUT,
    amount: "3",
    createdByUserId: createdBy.id,
    performedByUserId: performedBy.id,
    reason: "Aplicação na lavoura",
  });

  const [product, movements, audits] = await Promise.all([
    db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }),
    db.stockMovement.findMany({ where: { productId: scenario.product.id } }),
    db.auditLog.findMany({ where: { propertyId: scenario.property.id } }),
  ]);

  assert.equal(product.quantity.toString(), "7");
  assert.equal(movements.length, 1);
  assert.equal(movements[0].id, movement.id);
  assert.equal(movements[0].propertyId, scenario.property.id);
  assert.equal(movement.balanceBefore.toString(), "10");
  assert.equal(movement.balanceAfter.toString(), "7");
  assert.equal(movement.quantityChange.toString(), "-3");
  assert.equal(movement.createdByUserId, createdBy.id);
  assert.equal(movement.performedByUserId, performedBy.id);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].entityId, movement.id);
  assert.equal(audits[0].action, "STOCK_MOVEMENT_CREATED");
  assert.equal(audits[0].entityType, "StockMovement");
  assert.equal(audits[0].propertyId, scenario.property.id);
  assert.equal(audits[0].actorUserId, createdBy.id);
});

test("estoque insuficiente faz rollback de saldo, movimento e auditoria", async () => {
  const scenario = await createStockScenario({ quantity: "10" });

  await expectStockError(
    registerStockMovement({
      propertyId: scenario.property.id,
      productId: scenario.product.id,
      type: StockMovementType.OUT,
      amount: "15",
      createdByUserId: scenario.users[0].id,
    }),
    "INSUFFICIENT_STOCK",
  );

  const [product, movements, audits] = await Promise.all([
    db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }),
    db.stockMovement.count({ where: { productId: scenario.product.id } }),
    db.auditLog.count({ where: { propertyId: scenario.property.id } }),
  ]);
  assert.equal(product.quantity.toString(), "10");
  assert.equal(movements, 0);
  assert.equal(audits, 0);
});

test("quantidade zero é recusada pelo service antes de alcançar o banco", async () => {
  const scenario = await createStockScenario({ quantity: "10" });

  await expectStockError(
    registerStockMovement({
      propertyId: scenario.property.id,
      productId: scenario.product.id,
      type: StockMovementType.OUT,
      amount: "0",
      createdByUserId: scenario.users[0].id,
    }),
    "INVALID_QUANTITY",
  );

  assert.equal(
    (await db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }))
      .quantity.toString(),
    "10",
  );
  assert.equal(await db.stockMovement.count({ where: { productId: scenario.product.id } }), 0);
  assert.equal(await db.auditLog.count({ where: { propertyId: scenario.property.id } }), 0);
});

test("duas retiradas concorrentes nunca produzem saldo negativo", async () => {
  const scenario = await createStockScenario({ quantity: "10" });
  const command = {
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    type: StockMovementType.OUT,
    amount: "8",
    createdByUserId: scenario.users[0].id,
  } as const;

  const results = await Promise.allSettled([
    registerStockMovement(command),
    registerStockMovement(command),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.ok(rejected.reason instanceof StockDomainError);
  assert.ok(
    ["INSUFFICIENT_STOCK", "CONCURRENCY_CONFLICT"].includes(rejected.reason.code),
  );

  const [product, movements, audits] = await Promise.all([
    db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }),
    db.stockMovement.findMany({ where: { productId: scenario.product.id } }),
    db.auditLog.findMany({ where: { propertyId: scenario.property.id } }),
  ]);
  assert.equal(product.quantity.toString(), "2");
  assert.equal(movements.length, 1);
  assert.equal(movements[0].quantityChange.toString(), "-8");
  assert.equal(movements[0].balanceBefore.toString(), "10");
  assert.equal(movements[0].balanceAfter.toString(), "2");
  assert.equal(audits.length, 1);
  assert.equal(audits[0].entityId, movements[0].id);
});

test("snapshots de produto e área sobrevivem a renomes dos cadastros", async () => {
  const scenario = await createStockScenario({
    productName: "Produto A",
    areaName: "Lavoura A",
    quantity: "10",
  });
  assert.ok(scenario.area);

  const movement = await registerStockMovement({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    areaId: scenario.area.id,
    type: StockMovementType.OUT,
    amount: "1",
    createdByUserId: scenario.users[0].id,
  });
  assert.equal(movement.productNameSnapshot, "Produto A");
  assert.equal(movement.areaNameSnapshot, "Lavoura A");

  await Promise.all([
    db.stockProduct.update({
      where: { id: scenario.product.id },
      data: { name: "Produto B", normalizedName: "produto b" },
    }),
    db.area.update({
      where: { id: scenario.area.id },
      data: { name: "Lavoura B", normalizedName: "lavoura b" },
    }),
  ]);

  const persisted = await db.stockMovement.findUniqueOrThrow({
    where: { id: movement.id },
    include: { product: true, area: true },
  });
  assert.equal(persisted.product.name, "Produto B");
  assert.equal(persisted.area?.name, "Lavoura B");
  assert.equal(persisted.productNameSnapshot, "Produto A");
  assert.equal(persisted.areaNameSnapshot, "Lavoura A");
});

test("FarmRecord obtém snapshots e separa createdBy de performedBy", async () => {
  const scenario = await createStockScenario({
    productName: "Herbicida Original",
    areaName: "Talhão Original",
    userCount: 2,
  });
  assert.ok(scenario.area);
  const [createdBy, performedBy] = scenario.users;

  const record = await createFarmRecord({
    propertyId: scenario.property.id,
    areaId: scenario.area.id,
    productId: scenario.product.id,
    createdByUserId: createdBy.id,
    performedByUserId: performedBy.id,
    type: FarmRecordType.SPRAYING,
    description: "Aplicação registrada no teste real",
  });
  assert.equal(record.productNameSnapshot, "Herbicida Original");
  assert.equal(record.areaNameSnapshot, "Talhão Original");
  assert.equal(record.createdByUserId, createdBy.id);
  assert.equal(record.performedByUserId, performedBy.id);

  await Promise.all([
    db.stockProduct.update({
      where: { id: scenario.product.id },
      data: { name: "Herbicida Renomeado", normalizedName: "herbicida renomeado" },
    }),
    db.area.update({
      where: { id: scenario.area.id },
      data: { name: "Talhão Renomeado", normalizedName: "talhão renomeado" },
    }),
  ]);

  const [persisted, audit] = await Promise.all([
    db.farmRecord.findUniqueOrThrow({ where: { id: record.id } }),
    db.auditLog.findFirstOrThrow({
      where: { entityType: "FarmRecord", entityId: record.id },
    }),
  ]);
  assert.equal(persisted.productNameSnapshot, "Herbicida Original");
  assert.equal(persisted.areaNameSnapshot, "Talhão Original");
  assert.equal(audit.actorUserId, createdBy.id);
});

test("usuário desativado é bloqueado como criador ou executor sem apagar histórico", async () => {
  const scenario = await createStockScenario({ userCount: 2, quantity: "10" });
  const [inactiveUser, activeUser] = scenario.users;
  const historical = await registerStockMovement({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    type: StockMovementType.OUT,
    amount: "1",
    createdByUserId: inactiveUser.id,
  });
  await db.user.update({
    where: { id: inactiveUser.id },
    data: { deactivatedAt: new Date() },
  });

  await expectStockError(
    registerStockMovement({
      propertyId: scenario.property.id,
      productId: scenario.product.id,
      type: StockMovementType.IN,
      amount: "2",
      createdByUserId: inactiveUser.id,
    }),
    "USER_NOT_ACTIVE_PROPERTY_MEMBER",
  );
  await expectStockError(
    registerStockMovement({
      propertyId: scenario.property.id,
      productId: scenario.product.id,
      type: StockMovementType.IN,
      amount: "2",
      createdByUserId: activeUser.id,
      performedByUserId: inactiveUser.id,
    }),
    "USER_NOT_ACTIVE_PROPERTY_MEMBER",
  );

  const [product, movements, audits, persistedHistorical] = await Promise.all([
    db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }),
    db.stockMovement.count({ where: { productId: scenario.product.id } }),
    db.auditLog.count({ where: { propertyId: scenario.property.id } }),
    db.stockMovement.findUniqueOrThrow({ where: { id: historical.id } }),
  ]);
  assert.equal(product.quantity.toString(), "9");
  assert.equal(movements, 1);
  assert.equal(audits, 1);
  assert.equal(persistedHistorical.createdByUserId, inactiveUser.id);
});

test("produto arquivado bloqueia nova ação, mas permite reversão histórica", async () => {
  const scenario = await createStockScenario({ productName: "Produto arquivável" });
  const original = await registerStockMovement({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    type: StockMovementType.OUT,
    amount: "3",
    createdByUserId: scenario.users[0].id,
  });
  const archivedAt = new Date();
  await db.stockProduct.update({
    where: { id: scenario.product.id },
    data: { archivedAt },
  });

  await expectStockError(
    registerStockMovement({
      propertyId: scenario.property.id,
      productId: scenario.product.id,
      type: StockMovementType.IN,
      amount: "1",
      createdByUserId: scenario.users[0].id,
    }),
    "PRODUCT_NOT_FOUND",
  );
  const reversal = await reverseStockMovement({
    propertyId: scenario.property.id,
    movementId: original.id,
    createdByUserId: scenario.users[0].id,
    reason: "Correção histórica",
  });

  const product = await db.stockProduct.findUniqueOrThrow({
    where: { id: scenario.product.id },
  });
  assert.equal(product.quantity.toString(), "10");
  assert.equal(product.archivedAt?.getTime(), archivedAt.getTime());
  assert.equal(reversal.type, StockMovementType.REVERSAL);
  assert.equal(reversal.reversesMovementId, original.id);
  assert.equal(reversal.productNameSnapshot, original.productNameSnapshot);
  assert.equal(reversal.areaNameSnapshot, original.areaNameSnapshot);
  assert.equal(reversal.unitSnapshot, original.unitSnapshot);
  assert.equal(
    await db.stockMovement.count({ where: { productId: scenario.product.id } }),
    2,
  );
  assert.equal(await db.auditLog.count({ where: { propertyId: scenario.property.id } }), 2);
  assert.equal(
    await db.stockMovement.count({
      where: { reversesMovementId: original.id },
    }),
    1,
  );
});

test("área arquivada bloqueia uso novo e continua arquivada após reversão", async () => {
  const scenario = await createStockScenario({ areaName: "Área arquivável" });
  assert.ok(scenario.area);
  const original = await registerStockMovement({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    areaId: scenario.area.id,
    type: StockMovementType.OUT,
    amount: "3",
    createdByUserId: scenario.users[0].id,
  });
  const archivedAt = new Date();
  await db.area.update({ where: { id: scenario.area.id }, data: { archivedAt } });

  await expectStockError(
    registerStockMovement({
      propertyId: scenario.property.id,
      productId: scenario.product.id,
      areaId: scenario.area.id,
      type: StockMovementType.IN,
      amount: "1",
      createdByUserId: scenario.users[0].id,
    }),
    "RELATED_ENTITY_NOT_FOUND",
  );
  const reversal = await reverseStockMovement({
    propertyId: scenario.property.id,
    movementId: original.id,
    createdByUserId: scenario.users[0].id,
    reason: "Correção da movimentação histórica",
  });

  const [area, product] = await Promise.all([
    db.area.findUniqueOrThrow({ where: { id: scenario.area.id } }),
    db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }),
  ]);
  assert.equal(area.archivedAt?.getTime(), archivedAt.getTime());
  assert.equal(product.quantity.toString(), "10");
  assert.equal(reversal.areaId, original.areaId);
  assert.equal(reversal.areaNameSnapshot, original.areaNameSnapshot);
  assert.equal(reversal.productNameSnapshot, original.productNameSnapshot);
  assert.equal(reversal.unitSnapshot, original.unitSnapshot);
  assert.equal(
    await db.stockMovement.count({ where: { productId: scenario.product.id } }),
    2,
  );
  assert.equal(await db.auditLog.count({ where: { propertyId: scenario.property.id } }), 2);
});

test("Property arquivada bloqueia nova ação, mas não a reversão histórica", async () => {
  const scenario = await createStockScenario({ areaName: "Área histórica" });
  assert.ok(scenario.area);
  const original = await registerStockMovement({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    areaId: scenario.area.id,
    type: StockMovementType.OUT,
    amount: "3",
    createdByUserId: scenario.users[0].id,
  });
  const archivedAt = new Date();
  await Promise.all([
    db.property.update({ where: { id: scenario.property.id }, data: { archivedAt } }),
    db.stockProduct.update({ where: { id: scenario.product.id }, data: { archivedAt } }),
    db.area.update({ where: { id: scenario.area.id }, data: { archivedAt } }),
  ]);

  await expectStockError(
    registerStockMovement({
      propertyId: scenario.property.id,
      productId: scenario.product.id,
      type: StockMovementType.IN,
      amount: "1",
      createdByUserId: scenario.users[0].id,
    }),
    "PROPERTY_NOT_ACTIVE",
  );
  const reversal = await reverseStockMovement({
    propertyId: scenario.property.id,
    movementId: original.id,
    createdByUserId: scenario.users[0].id,
    reason: "Reversão em propriedade arquivada",
  });

  const [property, product, area] = await Promise.all([
    db.property.findUniqueOrThrow({ where: { id: scenario.property.id } }),
    db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }),
    db.area.findUniqueOrThrow({ where: { id: scenario.area.id } }),
  ]);
  assert.equal(property.archivedAt?.getTime(), archivedAt.getTime());
  assert.equal(product.archivedAt?.getTime(), archivedAt.getTime());
  assert.equal(area.archivedAt?.getTime(), archivedAt.getTime());
  assert.equal(product.quantity.toString(), "10");
  assert.equal(reversal.reversesMovementId, original.id);
  assert.equal(
    await db.stockMovement.count({ where: { productId: scenario.product.id } }),
    2,
  );
  assert.equal(await db.auditLog.count({ where: { propertyId: property.id } }), 2);
});

test("usuário histórico desativado não impede reversão por outro usuário ativo", async () => {
  const scenario = await createStockScenario({ userCount: 3 });
  const [createdBy, performedBy, reversingUser] = scenario.users;
  const original = await registerStockMovement({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    type: StockMovementType.OUT,
    amount: "3",
    createdByUserId: createdBy.id,
    performedByUserId: performedBy.id,
  });
  await db.user.update({
    where: { id: performedBy.id },
    data: { deactivatedAt: new Date() },
  });

  await expectStockError(
    reverseStockMovement({
      propertyId: scenario.property.id,
      movementId: original.id,
      createdByUserId: performedBy.id,
      reason: "Tentativa por usuário desativado",
    }),
    "USER_NOT_ACTIVE_PROPERTY_MEMBER",
  );
  assert.equal(
    (await db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }))
      .quantity.toString(),
    "7",
  );
  assert.equal(
    await db.stockMovement.count({ where: { reversesMovementId: original.id } }),
    0,
  );

  const reversal = await reverseStockMovement({
    propertyId: scenario.property.id,
    movementId: original.id,
    createdByUserId: reversingUser.id,
    reason: "Reversão por usuário ativo",
  });
  const audit = await db.auditLog.findFirstOrThrow({
    where: { entityId: reversal.id, action: "STOCK_MOVEMENT_REVERSED" },
  });

  assert.equal(reversal.createdByUserId, reversingUser.id);
  assert.equal(reversal.performedByUserId, null);
  assert.equal(audit.actorUserId, reversingUser.id);
  assert.equal(
    (await db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }))
      .quantity.toString(),
    "10",
  );
});

test("reversão duplicada e reversão de reversão são bloqueadas sem novo saldo", async () => {
  const scenario = await createStockScenario();
  const original = await registerStockMovement({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    type: StockMovementType.OUT,
    amount: "3",
    createdByUserId: scenario.users[0].id,
  });
  const reversal = await reverseStockMovement({
    propertyId: scenario.property.id,
    movementId: original.id,
    createdByUserId: scenario.users[0].id,
    reason: "Primeira reversão",
  });

  await expectStockError(
    reverseStockMovement({
      propertyId: scenario.property.id,
      movementId: original.id,
      createdByUserId: scenario.users[0].id,
      reason: "Tentativa duplicada",
    }),
    "MOVEMENT_ALREADY_REVERSED",
  );
  const afterDuplicate = await Promise.all([
    db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }),
    db.stockMovement.count({ where: { productId: scenario.product.id } }),
    db.auditLog.count({ where: { propertyId: scenario.property.id } }),
  ]);
  assert.equal(afterDuplicate[0].quantity.toString(), "10");
  assert.equal(afterDuplicate[1], 2);
  assert.equal(afterDuplicate[2], 2);

  await expectStockError(
    reverseStockMovement({
      propertyId: scenario.property.id,
      movementId: reversal.id,
      createdByUserId: scenario.users[0].id,
      reason: "Tentativa de reverter reversão",
    }),
    "INVALID_REVERSAL",
  );

  const afterReversalOfReversal = await Promise.all([
    db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }),
    db.stockMovement.count({ where: { productId: scenario.product.id } }),
    db.auditLog.count({ where: { propertyId: scenario.property.id } }),
  ]);
  assert.equal(afterReversalOfReversal[0].quantity.toString(), "10");
  assert.equal(afterReversalOfReversal[1], 2);
  assert.equal(afterReversalOfReversal[2], 2);
  assert.equal(
    await db.stockMovement.count({ where: { reversesMovementId: original.id } }),
    1,
  );
});

test("duas reversões concorrentes efetivam somente uma correção", async () => {
  const scenario = await createStockScenario();
  const original = await registerStockMovement({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    type: StockMovementType.OUT,
    amount: "3",
    createdByUserId: scenario.users[0].id,
  });
  const reverse = (reason: string) =>
    reverseStockMovement({
      propertyId: scenario.property.id,
      movementId: original.id,
      createdByUserId: scenario.users[0].id,
      reason,
    });

  const results = await Promise.allSettled([
    reverse("Reversão concorrente A"),
    reverse("Reversão concorrente B"),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.ok(rejected.reason instanceof StockDomainError);
  assert.ok(
    ["MOVEMENT_ALREADY_REVERSED", "CONCURRENCY_CONFLICT"].includes(
      rejected.reason.code,
    ),
  );

  assert.equal(
    (await db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }))
      .quantity.toString(),
    "10",
  );
  assert.equal(
    await db.stockMovement.count({ where: { reversesMovementId: original.id } }),
    1,
  );
  assert.equal(
    await db.auditLog.count({
      where: {
        propertyId: scenario.property.id,
        action: "STOCK_MOVEMENT_REVERSED",
      },
    }),
    1,
  );
});

test("services impedem usar produto ou movimento de outra propriedade", async () => {
  const [scenarioA, scenarioB] = await Promise.all([
    createStockScenario({ productName: "Produto A" }),
    createStockScenario({ productName: "Produto B" }),
  ]);

  await expectStockError(
    registerStockMovement({
      propertyId: scenarioA.property.id,
      productId: scenarioB.product.id,
      type: StockMovementType.OUT,
      amount: "1",
      createdByUserId: scenarioA.users[0].id,
    }),
    "PRODUCT_NOT_FOUND",
  );
  const movementB = await registerStockMovement({
    propertyId: scenarioB.property.id,
    productId: scenarioB.product.id,
    type: StockMovementType.OUT,
    amount: "2",
    createdByUserId: scenarioB.users[0].id,
  });
  await expectStockError(
    reverseStockMovement({
      propertyId: scenarioA.property.id,
      movementId: movementB.id,
      createdByUserId: scenarioA.users[0].id,
      reason: "Tentativa fora do escopo",
    }),
    "MOVEMENT_NOT_FOUND",
  );

  assert.equal(await db.stockMovement.count({ where: { propertyId: scenarioA.property.id } }), 0);
  assert.equal(await db.auditLog.count({ where: { propertyId: scenarioA.property.id } }), 0);
  assert.equal(
    (await db.stockProduct.findUniqueOrThrow({ where: { id: scenarioB.product.id } }))
      .quantity.toString(),
    "8",
  );
});

test("aliases criados pelos services permanecem no escopo da própria Property", async () => {
  const [tenantA, tenantB] = await Promise.all([createTenant(), createTenant()]);
  const createScopedProduct = (propertyId: string, userId: string) =>
    createStockProduct({
      propertyId,
      createdByUserId: userId,
      name: "Produto com apelido",
      category: ProductCategory.OTHER,
      initialQuantity: "0",
      unit: "un",
      aliases: ["apelido compartilhado"],
    });
  const createScopedArea = (propertyId: string, userId: string) =>
    createArea({
      propertyId,
      createdByUserId: userId,
      name: "Área com apelido",
      type: AreaType.FIELD,
      aliases: ["roça compartilhada"],
    });

  const products = [
    await createScopedProduct(tenantA.property.id, tenantA.users[0].id),
    await createScopedProduct(tenantB.property.id, tenantB.users[0].id),
  ];
  await createScopedArea(tenantA.property.id, tenantA.users[0].id);
  await createScopedArea(tenantB.property.id, tenantB.users[0].id);

  const [productAliases, areaAliases] = await Promise.all([
    db.productAlias.findMany({
      where: { normalizedName: "apelido compartilhado" },
      include: { product: { select: { propertyId: true } } },
    }),
    db.areaAlias.findMany({
      where: { normalizedName: "roca compartilhada" },
      include: { area: { select: { propertyId: true } } },
    }),
  ]);
  assert.equal(productAliases.length, 2);
  assert.equal(areaAliases.length, 2);
  assert.deepEqual(
    new Set(productAliases.map((alias) => alias.propertyId)),
    new Set([tenantA.property.id, tenantB.property.id]),
  );
  assert.deepEqual(
    new Set(areaAliases.map((alias) => alias.propertyId)),
    new Set([tenantA.property.id, tenantB.property.id]),
  );
  assert.ok(productAliases.every((alias) => alias.propertyId === alias.product.propertyId));
  assert.ok(areaAliases.every((alias) => alias.propertyId === alias.area.propertyId));
  assert.equal(
    await db.stockMovement.count({
      where: { productId: { in: products.map((product) => product.id) } },
    }),
    0,
  );
});

test("CHECK constraints do PostgreSQL barram saldo, equação e sinal inválidos", async () => {
  const scenario = await createStockScenario({ quantity: "10" });

  await assert.rejects(
    db.stockProduct.update({
      where: { id: scenario.product.id },
      data: { quantity: new Prisma.Decimal("-1") },
    }),
  );
  assert.equal(
    (await db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }))
      .quantity.toString(),
    "10",
  );

  await assert.rejects(
    db.stockMovement.create({
      data: {
        propertyId: scenario.property.id,
        productId: scenario.product.id,
        type: StockMovementType.IN,
        quantityChange: new Prisma.Decimal("1"),
        productNameSnapshot: scenario.product.name,
        unitSnapshot: scenario.product.unit,
        balanceBefore: new Prisma.Decimal("10"),
        balanceAfter: new Prisma.Decimal("12"),
      },
    }),
  );
  await assert.rejects(
    db.stockMovement.create({
      data: {
        propertyId: scenario.property.id,
        productId: scenario.product.id,
        type: StockMovementType.OUT,
        quantityChange: new Prisma.Decimal("1"),
        productNameSnapshot: scenario.product.name,
        unitSnapshot: scenario.product.unit,
        balanceBefore: new Prisma.Decimal("10"),
        balanceAfter: new Prisma.Decimal("11"),
      },
    }),
  );
  await assert.rejects(
    db.stockMovement.create({
      data: {
        propertyId: scenario.property.id,
        productId: scenario.product.id,
        type: StockMovementType.OUT,
        quantityChange: new Prisma.Decimal("-11"),
        productNameSnapshot: scenario.product.name,
        unitSnapshot: scenario.product.unit,
        balanceBefore: new Prisma.Decimal("10"),
        balanceAfter: new Prisma.Decimal("-1"),
      },
    }),
  );
  assert.equal(await db.stockMovement.count({ where: { productId: scenario.product.id } }), 0);
});
