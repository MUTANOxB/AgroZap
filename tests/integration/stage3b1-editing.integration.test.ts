import assert from "node:assert/strict";
import { after, test } from "node:test";
import type {
  Area,
  StockProduct,
} from "@/generated/prisma/client";
import type { UpdateStockProductCommand } from "@/services/estoque/product.service";
import type { AdjustStockCommand } from "@/services/estoque/stock-movement.service";
import type { UpdateAreaCommand } from "@/services/talhoes/area.service";
import { assertSafeIntegrationRuntime } from "./test-database";

assertSafeIntegrationRuntime(process.env);

const [
  prismaModule,
  prismaLib,
  areaService,
  productService,
  stockService,
  capabilityGuard,
  ruralWebAuthorization,
  fixtures,
] = await Promise.all([
  import("@/generated/prisma/client"),
  import("@/lib/prisma"),
  import("@/services/talhoes/area.service"),
  import("@/services/estoque/product.service"),
  import("@/services/estoque/stock-movement.service"),
  import("@/services/autorizacao/property-capability-guard"),
  import("@/services/autorizacao/rural-web-authorization"),
  import("./fixtures"),
]);

const {
  AreaType,
  Prisma,
  ProductCategory,
  PropertyRole,
  RecordSource,
  StockMovementType,
} = prismaModule;
const { db } = prismaLib;
const { updateArea: updateAreaService } = areaService;
const { updateStockProduct: updateStockProductService } = productService;
const {
  adjustStock: adjustStockService,
  reverseStockMovement: reverseStockMovementService,
} = stockService;
const { PropertyCapabilityError } = capabilityGuard;
const { RURAL_WEB_AUTHORIZATION } = ruralWebAuthorization;
const { createTenant } = fixtures;

after(async () => {
  await db.$disconnect();
});

function updateArea(command: UpdateAreaCommand) {
  return updateAreaService(command, RURAL_WEB_AUTHORIZATION);
}

function updateStockProduct(command: UpdateStockProductCommand) {
  return updateStockProductService(command, RURAL_WEB_AUTHORIZATION);
}

function adjustStock(command: AdjustStockCommand) {
  return adjustStockService(command, RURAL_WEB_AUTHORIZATION);
}

function reverseStockMovement(
  command: Parameters<typeof reverseStockMovementService>[0],
) {
  return reverseStockMovementService(command, RURAL_WEB_AUTHORIZATION);
}

async function expectDomainCode(
  operation: () => unknown | Promise<unknown>,
  errorName: string,
  code: string,
) {
  await assert.rejects(
    async () => operation(),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, errorName);
      assert.equal((error as Error & { code?: unknown }).code, code);
      return true;
    },
  );
}

async function expectCapabilityDenied(
  operation: () => unknown | Promise<unknown>,
) {
  await assert.rejects(
    async () => operation(),
    (error: unknown) => {
      assert.ok(error instanceof PropertyCapabilityError);
      assert.equal(error.code, "FORBIDDEN");
      return true;
    },
  );
}

async function createEditingScenario(quantity = "128") {
  const tenant = await createTenant(4);
  const [owner, manager, employee, viewer] = tenant.users;

  await Promise.all([
    db.propertyMember.update({
      where: {
        propertyId_userId: {
          propertyId: tenant.property.id,
          userId: manager.id,
        },
      },
      data: { role: PropertyRole.MANAGER },
    }),
    db.propertyMember.update({
      where: {
        propertyId_userId: {
          propertyId: tenant.property.id,
          userId: viewer.id,
        },
      },
      data: { role: PropertyRole.VIEWER },
    }),
  ]);

  const [area, product] = await Promise.all([
    db.area.create({
      data: {
        propertyId: tenant.property.id,
        name: "Talhão Norte",
        normalizedName: "talhao norte",
        type: AreaType.FIELD,
        size: new Prisma.Decimal("12.5"),
        sizeUnit: "ha",
        note: "Cadastro original",
        currentCrop: "Soja",
        harvest: "2026/27",
        soilType: "Argiloso",
        irrigation: "Sequeiro",
        estimatedProductivity: new Prisma.Decimal("68.5"),
        productivityUnit: "sc/ha",
      },
    }),
    db.stockProduct.create({
      data: {
        propertyId: tenant.property.id,
        name: "Adubo NPK",
        normalizedName: "adubo npk",
        category: ProductCategory.FERTILIZER,
        quantity: new Prisma.Decimal(quantity),
        unit: "kg",
        minimumStock: new Prisma.Decimal("25"),
        storageLocation: "Depósito A",
        note: "Cadastro original",
        supplier: "Fornecedor A",
        unitValue: new Prisma.Decimal("85.5"),
        expirationDate: new Date("2027-08-08T00:00:00.000Z"),
        batchNumber: "LOTE-1",
        purchaseDate: new Date("2026-08-08T00:00:00.000Z"),
        technicalNote: "Manter em local seco",
      },
    }),
  ]);

  return {
    ...tenant,
    owner,
    manager,
    employee,
    viewer,
    area,
    product,
  };
}

function areaCommand(
  propertyId: string,
  actorUserId: string,
  area: Area,
  overrides: Partial<UpdateAreaCommand> = {},
): UpdateAreaCommand {
  return {
    propertyId,
    areaId: area.id,
    name: area.name,
    type: area.type,
    size: area.size?.toString() ?? null,
    sizeUnit: area.sizeUnit,
    note: area.note,
    currentCrop: area.currentCrop,
    harvest: area.harvest,
    soilType: area.soilType,
    irrigation: area.irrigation,
    estimatedProductivity: area.estimatedProductivity?.toString() ?? null,
    productivityUnit: area.productivityUnit,
    actorUserId,
    source: RecordSource.WEB,
    ...overrides,
  };
}

function productCommand(
  propertyId: string,
  actorUserId: string,
  product: StockProduct,
  overrides: Partial<UpdateStockProductCommand> = {},
): UpdateStockProductCommand {
  return {
    propertyId,
    productId: product.id,
    name: product.name,
    category: product.category,
    unit: product.unit,
    minimumStock: product.minimumStock?.toString() ?? null,
    storageLocation: product.storageLocation,
    note: product.note,
    supplier: product.supplier,
    unitValue: product.unitValue?.toString() ?? null,
    expirationDate: product.expirationDate,
    batchNumber: product.batchNumber,
    purchaseDate: product.purchaseDate,
    technicalNote: product.technicalNote,
    actorUserId,
    source: RecordSource.WEB,
    ...overrides,
  };
}

test("OWNER e MANAGER editam Area; EMPLOYEE e VIEWER não alteram nem auditam", async () => {
  const scenario = await createEditingScenario();

  const ownerUpdate = await updateArea(
    areaCommand(scenario.property.id, scenario.owner.id, scenario.area, {
      name: "Talhão Norte Revisado",
      note: "Revisado pelo proprietário",
    }),
  );
  const managerUpdate = await updateArea(
    areaCommand(scenario.property.id, scenario.manager.id, ownerUpdate, {
      harvest: "2027/28",
    }),
  );

  await expectCapabilityDenied(() =>
    updateArea(
      areaCommand(scenario.property.id, scenario.employee.id, managerUpdate, {
        note: "Tentativa do funcionário",
      }),
    ),
  );
  await expectCapabilityDenied(() =>
    updateArea(
      areaCommand(scenario.property.id, scenario.viewer.id, managerUpdate, {
        note: "Tentativa do visualizador",
      }),
    ),
  );

  const [persisted, audits] = await Promise.all([
    db.area.findUniqueOrThrow({ where: { id: scenario.area.id } }),
    db.auditLog.findMany({
      where: {
        propertyId: scenario.property.id,
        entityType: "Area",
        entityId: scenario.area.id,
        action: "AREA_UPDATED",
      },
    }),
  ]);

  assert.equal(persisted.name, "Talhão Norte Revisado");
  assert.equal(persisted.note, "Revisado pelo proprietário");
  assert.equal(persisted.harvest, "2027/28");
  assert.equal(audits.length, 2);
  assert.deepEqual(
    new Set(audits.map((audit) => audit.actorUserId)),
    new Set([scenario.owner.id, scenario.manager.id]),
  );
  const ownerAudit = audits.find(
    (audit) => audit.actorUserId === scenario.owner.id,
  );
  assert.ok(ownerAudit);
  assert.equal(
    (ownerAudit.beforeData as { name?: string }).name,
    "Talhão Norte",
  );
  assert.equal(
    (ownerAudit.afterData as { name?: string }).name,
    "Talhão Norte Revisado",
  );
  assert.deepEqual(
    new Set(
      (ownerAudit.metadata as { changedFields?: string[] }).changedFields,
    ),
    new Set(["name", "note"]),
  );
});

test("OWNER e MANAGER editam metadados do produto; EMPLOYEE e VIEWER não editam", async () => {
  const scenario = await createEditingScenario();

  const ownerUpdate = await updateStockProduct(
    productCommand(
      scenario.property.id,
      scenario.owner.id,
      scenario.product,
      {
        minimumStock: "30",
        supplier: "Fornecedor revisado",
      },
    ),
  );
  const managerUpdate = await updateStockProduct(
    productCommand(
      scenario.property.id,
      scenario.manager.id,
      ownerUpdate,
      { technicalNote: "Conferido pelo gerente" },
    ),
  );

  await expectCapabilityDenied(() =>
    updateStockProduct(
      productCommand(
        scenario.property.id,
        scenario.employee.id,
        managerUpdate,
        { supplier: "Tentativa do funcionário" },
      ),
    ),
  );
  await expectCapabilityDenied(() =>
    updateStockProduct(
      productCommand(
        scenario.property.id,
        scenario.viewer.id,
        managerUpdate,
        { supplier: "Tentativa do visualizador" },
      ),
    ),
  );

  const [persisted, audits] = await Promise.all([
    db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }),
    db.auditLog.findMany({
      where: {
        propertyId: scenario.property.id,
        entityType: "StockProduct",
        entityId: scenario.product.id,
        action: "STOCK_PRODUCT_UPDATED",
      },
    }),
  ]);

  assert.equal(persisted.minimumStock?.toString(), "30");
  assert.equal(persisted.supplier, "Fornecedor revisado");
  assert.equal(persisted.technicalNote, "Conferido pelo gerente");
  assert.equal(persisted.quantity.toString(), "128");
  assert.equal(audits.length, 2);
  assert.deepEqual(
    new Set(audits.map((audit) => audit.actorUserId)),
    new Set([scenario.owner.id, scenario.manager.id]),
  );
});

test("updateStockProduct ignora quantity extra e não a inclui na auditoria cadastral", async () => {
  const scenario = await createEditingScenario();
  const forgedCommand = {
    ...productCommand(
      scenario.property.id,
      scenario.owner.id,
      scenario.product,
      { supplier: "Fornecedor legítimo" },
    ),
    quantity: "1",
  } as UpdateStockProductCommand & { quantity: string };

  const result = await updateStockProduct(forgedCommand);
  const [persisted, audit] = await Promise.all([
    db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }),
    db.auditLog.findFirstOrThrow({
      where: {
        propertyId: scenario.property.id,
        entityType: "StockProduct",
        entityId: scenario.product.id,
        action: "STOCK_PRODUCT_UPDATED",
      },
    }),
  ]);

  assert.equal(result.quantity.toString(), "128");
  assert.equal(persisted.quantity.toString(), "128");
  assert.equal(persisted.supplier, "Fornecedor legítimo");
  assert.equal(JSON.stringify(audit.beforeData).includes("quantity"), false);
  assert.equal(JSON.stringify(audit.afterData).includes("quantity"), false);
  assert.deepEqual(
    (audit.metadata as { changedFields?: string[] }).changedFields,
    ["supplier"],
  );
});

test("updates sem mudança real retornam no-op e não criam auditoria falsa", async () => {
  const scenario = await createEditingScenario();

  const [area, product] = await Promise.all([
    updateArea(
      areaCommand(scenario.property.id, scenario.owner.id, scenario.area),
    ),
    updateStockProduct(
      productCommand(
        scenario.property.id,
        scenario.owner.id,
        scenario.product,
      ),
    ),
  ]);

  assert.equal(area.updatedAt.toISOString(), scenario.area.updatedAt.toISOString());
  assert.equal(
    product.updatedAt.toISOString(),
    scenario.product.updatedAt.toISOString(),
  );
  await expectDomainCode(
    () =>
      updateArea(
        areaCommand(scenario.property.id, scenario.owner.id, scenario.area, {
          size: "12.50001",
        }),
      ),
    "AreaDomainError",
    "INVALID_AREA",
  );
  await expectDomainCode(
    () =>
      updateStockProduct(
        productCommand(
          scenario.property.id,
          scenario.owner.id,
          scenario.product,
          { minimumStock: "100000000000000" },
        ),
      ),
    "StockProductDomainError",
    "INVALID_PRODUCT",
  );
  assert.equal(
    await db.auditLog.count({ where: { propertyId: scenario.property.id } }),
    0,
  );
});

test("CUID de outra Property não edita Area, produto nem ajusta saldo", async () => {
  const [scenarioA, scenarioB] = await Promise.all([
    createEditingScenario(),
    createEditingScenario(),
  ]);

  await expectDomainCode(
    () =>
      updateArea(
        areaCommand(
          scenarioA.property.id,
          scenarioA.owner.id,
          scenarioB.area,
          { note: "Tentativa cross-property" },
        ),
      ),
    "AreaDomainError",
    "AREA_NOT_FOUND",
  );
  await expectDomainCode(
    () =>
      updateStockProduct(
        productCommand(
          scenarioA.property.id,
          scenarioA.owner.id,
          scenarioB.product,
          { supplier: "Tentativa cross-property" },
        ),
      ),
    "StockProductDomainError",
    "PRODUCT_NOT_FOUND",
  );
  await expectDomainCode(
    () =>
      adjustStock({
        propertyId: scenarioA.property.id,
        productId: scenarioB.product.id,
        targetQuantity: "120",
        reason: "Tentativa cross-property",
        actorUserId: scenarioA.owner.id,
        source: RecordSource.WEB,
      }),
    "StockDomainError",
    "PRODUCT_NOT_FOUND",
  );

  const [areaB, productB, audits, movements] = await Promise.all([
    db.area.findUniqueOrThrow({ where: { id: scenarioB.area.id } }),
    db.stockProduct.findUniqueOrThrow({ where: { id: scenarioB.product.id } }),
    db.auditLog.count({
      where: {
        propertyId: { in: [scenarioA.property.id, scenarioB.property.id] },
      },
    }),
    db.stockMovement.count({
      where: {
        propertyId: { in: [scenarioA.property.id, scenarioB.property.id] },
      },
    }),
  ]);

  assert.equal(areaB.note, "Cadastro original");
  assert.equal(productB.supplier, "Fornecedor A");
  assert.equal(productB.quantity.toString(), "128");
  assert.equal(audits, 0);
  assert.equal(movements, 0);
});

test("Area e produto arquivados bloqueiam edição e novo ajuste sem histórico falso", async () => {
  const scenario = await createEditingScenario();
  const archivedAt = new Date();
  await db.$transaction([
    db.area.update({
      where: { id: scenario.area.id },
      data: { archivedAt },
    }),
    db.stockProduct.update({
      where: { id: scenario.product.id },
      data: { archivedAt },
    }),
  ]);

  await expectDomainCode(
    () =>
      updateArea(
        areaCommand(scenario.property.id, scenario.owner.id, scenario.area, {
          note: "Tentativa em área arquivada",
        }),
      ),
    "AreaDomainError",
    "AREA_ARCHIVED",
  );
  await expectDomainCode(
    () =>
      updateStockProduct(
        productCommand(
          scenario.property.id,
          scenario.owner.id,
          scenario.product,
          { supplier: "Tentativa em produto arquivado" },
        ),
      ),
    "StockProductDomainError",
    "PRODUCT_ARCHIVED",
  );
  await expectDomainCode(
    () =>
      adjustStock({
        propertyId: scenario.property.id,
        productId: scenario.product.id,
        targetQuantity: "120",
        reason: "Tentativa em produto arquivado",
        actorUserId: scenario.owner.id,
        source: RecordSource.WEB,
      }),
    "StockDomainError",
    "PRODUCT_ARCHIVED",
  );

  const persisted = await db.stockProduct.findUniqueOrThrow({
    where: { id: scenario.product.id },
  });
  assert.equal(persisted.quantity.toString(), "128");
  assert.equal(
    await db.stockMovement.count({ where: { productId: scenario.product.id } }),
    0,
  );
  assert.equal(
    await db.auditLog.count({ where: { propertyId: scenario.property.id } }),
    0,
  );
});

test("ajustes 128→120 e 120→150 persistem deltas, snapshots e auditoria atômica", async () => {
  const scenario = await createEditingScenario("128");

  const downward = await adjustStock({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    targetQuantity: "120",
    reason: "Contagem física do depósito",
    actorUserId: scenario.owner.id,
    source: RecordSource.WEB,
  });
  const upward = await adjustStock({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    targetQuantity: "150",
    reason: "Entrada encontrada na conferência",
    actorUserId: scenario.owner.id,
    source: RecordSource.WEB,
  });

  assert.equal(downward.type, StockMovementType.ADJUSTMENT);
  assert.equal(downward.balanceBefore.toString(), "128");
  assert.equal(downward.balanceAfter.toString(), "120");
  assert.equal(downward.quantityChange.toString(), "-8");
  assert.equal(downward.productNameSnapshot, "Adubo NPK");
  assert.equal(downward.unitSnapshot, "kg");
  assert.equal(downward.reason, "Contagem física do depósito");
  assert.equal(downward.createdByUserId, scenario.owner.id);
  assert.equal(downward.source, RecordSource.WEB);

  assert.equal(upward.type, StockMovementType.ADJUSTMENT);
  assert.equal(upward.balanceBefore.toString(), "120");
  assert.equal(upward.balanceAfter.toString(), "150");
  assert.equal(upward.quantityChange.toString(), "30");
  assert.equal(upward.reason, "Entrada encontrada na conferência");

  const [persisted, movements, audits] = await Promise.all([
    db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }),
    db.stockMovement.findMany({
      where: { productId: scenario.product.id },
    }),
    db.auditLog.findMany({
      where: {
        propertyId: scenario.property.id,
        entityType: "StockMovement",
        action: "STOCK_MOVEMENT_CREATED",
      },
    }),
  ]);

  assert.equal(persisted.quantity.toString(), "150");
  assert.equal(movements.length, 2);
  assert.equal(audits.length, 2);
  for (const movement of [downward, upward]) {
    const audit = audits.find((candidate) => candidate.entityId === movement.id);
    assert.ok(audit);
    assert.equal(audit.actorUserId, scenario.owner.id);
    assert.equal(audit.source, RecordSource.WEB);
    assert.equal(
      (audit.beforeData as { quantity?: string }).quantity,
      movement.balanceBefore.toString(),
    );
    assert.equal(
      (audit.afterData as { quantity?: string }).quantity,
      movement.balanceAfter.toString(),
    );
    assert.equal(
      (audit.metadata as { quantityChange?: string }).quantityChange,
      movement.quantityChange.toString(),
    );
  }
});

test("ajuste rejeita saldo negativo e motivo vazio sem mudar saldo ou histórico", async () => {
  const scenario = await createEditingScenario("128");

  await expectDomainCode(
    () =>
      adjustStock({
        propertyId: scenario.property.id,
        productId: scenario.product.id,
        targetQuantity: "-1",
        reason: "Saldo inválido",
        actorUserId: scenario.owner.id,
        source: RecordSource.WEB,
      }),
    "StockDomainError",
    "INVALID_QUANTITY",
  );
  await expectDomainCode(
    () =>
      adjustStock({
        propertyId: scenario.property.id,
        productId: scenario.product.id,
        targetQuantity: "120",
        reason: "   ",
        actorUserId: scenario.owner.id,
        source: RecordSource.WEB,
      }),
    "StockDomainError",
    "INVALID_ADJUSTMENT",
  );
  await expectDomainCode(
    () =>
      adjustStock({
        propertyId: scenario.property.id,
        productId: scenario.product.id,
        targetQuantity: "128.00001",
        reason: "Precisão além do contrato de persistência",
        actorUserId: scenario.owner.id,
        source: RecordSource.WEB,
      }),
    "StockDomainError",
    "INVALID_QUANTITY",
  );

  assert.equal(
    (
      await db.stockProduct.findUniqueOrThrow({
        where: { id: scenario.product.id },
      })
    ).quantity.toString(),
    "128",
  );
  assert.equal(
    await db.stockMovement.count({ where: { productId: scenario.product.id } }),
    0,
  );
  assert.equal(
    await db.auditLog.count({ where: { propertyId: scenario.property.id } }),
    0,
  );
});

test("ajustes concorrentes formam uma cadeia serial sem lost update", async () => {
  const scenario = await createEditingScenario("100");

  const results = await Promise.allSettled([
    adjustStock({
      propertyId: scenario.property.id,
      productId: scenario.product.id,
      targetQuantity: "80",
      reason: "Contagem concorrente A",
      actorUserId: scenario.owner.id,
      source: RecordSource.WEB,
    }),
    adjustStock({
      propertyId: scenario.property.id,
      productId: scenario.product.id,
      targetQuantity: "90",
      reason: "Contagem concorrente B",
      actorUserId: scenario.manager.id,
      source: RecordSource.WEB,
    }),
  ]);

  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    2,
  );
  const [persisted, movements, auditCount] = await Promise.all([
    db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }),
    db.stockMovement.findMany({
      where: {
        productId: scenario.product.id,
        type: StockMovementType.ADJUSTMENT,
      },
    }),
    db.auditLog.count({
      where: {
        propertyId: scenario.property.id,
        entityType: "StockMovement",
        action: "STOCK_MOVEMENT_CREATED",
      },
    }),
  ]);

  assert.equal(movements.length, 2);
  assert.deepEqual(
    new Set(movements.map((movement) => movement.balanceAfter.toString())),
    new Set(["80", "90"]),
  );
  const first = movements.find(
    (movement) => movement.balanceBefore.toString() === "100",
  );
  assert.ok(first);
  const second = movements.find((movement) => movement.id !== first.id);
  assert.ok(second);
  assert.equal(second.balanceBefore.toString(), first.balanceAfter.toString());
  assert.equal(persisted.quantity.toString(), second.balanceAfter.toString());
  for (const movement of movements) {
    assert.equal(
      movement.balanceBefore.plus(movement.quantityChange).toString(),
      movement.balanceAfter.toString(),
    );
  }
  assert.equal(auditCount, 2);
});

test("reversão histórica continua válida após arquivar produto e Property", async () => {
  const scenario = await createEditingScenario("100");
  const adjustment = await adjustStock({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    targetQuantity: "85",
    reason: "Contagem antes do arquivamento",
    actorUserId: scenario.owner.id,
    source: RecordSource.WEB,
  });

  const archivedAt = new Date();
  await db.$transaction([
    db.stockProduct.update({
      where: { id: scenario.product.id },
      data: { archivedAt },
    }),
    db.property.update({
      where: { id: scenario.property.id },
      data: { archivedAt },
    }),
  ]);

  const reversal = await reverseStockMovement({
    propertyId: scenario.property.id,
    movementId: adjustment.id,
    createdByUserId: scenario.owner.id,
    source: RecordSource.WEB,
    reason: "Reversão histórica conferida",
  });

  const [persisted, original, audit] = await Promise.all([
    db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }),
    db.stockMovement.findUniqueOrThrow({ where: { id: adjustment.id } }),
    db.auditLog.findFirstOrThrow({
      where: {
        propertyId: scenario.property.id,
        entityType: "StockMovement",
        entityId: reversal.id,
        action: "STOCK_MOVEMENT_REVERSED",
      },
    }),
  ]);

  assert.equal(persisted.quantity.toString(), "100");
  assert.equal(original.type, StockMovementType.ADJUSTMENT);
  assert.equal(original.balanceBefore.toString(), "100");
  assert.equal(original.balanceAfter.toString(), "85");
  assert.equal(original.quantityChange.toString(), "-15");
  assert.equal(original.reversesMovementId, null);
  assert.equal(reversal.type, StockMovementType.REVERSAL);
  assert.equal(reversal.reversesMovementId, adjustment.id);
  assert.equal(reversal.quantityChange.toString(), "15");
  assert.equal(reversal.balanceBefore.toString(), "85");
  assert.equal(reversal.balanceAfter.toString(), "100");
  assert.equal(audit.actorUserId, scenario.owner.id);
  assert.equal(
    await db.stockMovement.count({ where: { productId: scenario.product.id } }),
    2,
  );
});
