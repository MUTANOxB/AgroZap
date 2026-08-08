import assert from "node:assert/strict";
import { after, test } from "node:test";
import { assertSafeIntegrationRuntime } from "./test-database";

assertSafeIntegrationRuntime(process.env);

const [
  prismaModule,
  prismaLib,
  stockService,
  stockErrors,
  recordService,
  productService,
  areaService,
  capabilityGuard,
  ruralWebAuthorization,
  fixtures,
] = await Promise.all([
  import("@/generated/prisma/client"),
  import("@/lib/prisma"),
  import("@/services/estoque/stock-movement.service"),
  import("@/services/estoque/errors"),
  import("@/services/registros/farm-record.service"),
  import("@/services/estoque/product.service"),
  import("@/services/talhoes/area.service"),
  import("@/services/autorizacao/property-capability-guard"),
  import("@/services/autorizacao/rural-web-authorization"),
  import("./fixtures"),
]);

const {
  AreaType,
  FarmRecordType,
  Prisma,
  ProductCategory,
  PropertyRole,
  RecordSource,
  StockMovementType,
} = prismaModule;
const { db } = prismaLib;
const {
  createFarmRecordWithStockMovement: createFarmRecordWithStockMovementService,
  registerStockMovement: registerStockMovementService,
  reverseStockMovement: reverseStockMovementService,
} = stockService;
const { StockDomainError } = stockErrors;
const {
  createFarmRecord: createFarmRecordService,
  FarmRecordDomainError,
} = recordService;
const {
  createStockProduct: createStockProductService,
  StockProductDomainError,
} = productService;
const { createArea: createAreaService, AreaDomainError } = areaService;
const { PropertyCapabilityError } = capabilityGuard;
const { RURAL_WEB_AUTHORIZATION } = ruralWebAuthorization;
const { createStockScenario, createTenant } = fixtures;

// Chamadas rurais sem `source` explícito representam WEB. Estes helpers
// garantem que todo teste WEB deste arquivo encaminhe o singleton server-only.
function createFarmRecordWithStockMovement(
  command: Parameters<typeof createFarmRecordWithStockMovementService>[0],
  authorization = RURAL_WEB_AUTHORIZATION,
) {
  return createFarmRecordWithStockMovementService(command, authorization);
}

function registerStockMovement(
  command: Parameters<typeof registerStockMovementService>[0],
  authorization = RURAL_WEB_AUTHORIZATION,
) {
  return registerStockMovementService(command, authorization);
}

function reverseStockMovement(
  command: Parameters<typeof reverseStockMovementService>[0],
  authorization = RURAL_WEB_AUTHORIZATION,
) {
  return reverseStockMovementService(command, authorization);
}

function createFarmRecord(
  command: Parameters<typeof createFarmRecordService>[0],
  authorization = RURAL_WEB_AUTHORIZATION,
) {
  return createFarmRecordService(command, authorization);
}

function createStockProduct(
  command: Parameters<typeof createStockProductService>[0],
  authorization = RURAL_WEB_AUTHORIZATION,
) {
  return createStockProductService(command, authorization);
}

function createArea(
  command: Parameters<typeof createAreaService>[0],
  authorization = RURAL_WEB_AUTHORIZATION,
) {
  return createAreaService(command, authorization);
}

after(async () => {
  await db.$disconnect();
});

type DomainError = Error & { code: string };

async function expectDomainError<T extends DomainError>(
  operation: () => unknown | Promise<unknown>,
  errorType: abstract new (...args: never[]) => T,
  code: string,
) {
  await assert.rejects(
    async () => operation(),
    (error: unknown) => {
      assert.ok(error instanceof errorType);
      assert.equal(error.code, code);
      return true;
    },
  );
}

function expectStockError(
  operation: () => unknown | Promise<unknown>,
  code: string,
) {
  return expectDomainError(operation, StockDomainError, code);
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

async function createAdditionalProduct(
  propertyId: string,
  name: string,
  quantity = "10",
) {
  return db.stockProduct.create({
    data: {
      propertyId,
      name,
      normalizedName: name.toLocaleLowerCase("pt-BR"),
      category: ProductCategory.OTHER,
      quantity: new Prisma.Decimal(quantity),
      unit: "kg",
    },
  });
}

async function createAdditionalArea(propertyId: string, name: string) {
  return db.area.create({
    data: {
      propertyId,
      name,
      normalizedName: name.toLocaleLowerCase("pt-BR"),
      type: AreaType.FIELD,
    },
  });
}

test("FarmRecord com produto X não aceita StockMovement do produto Y", async () => {
  const scenario = await createStockScenario({ quantity: "10" });
  const productY = await createAdditionalProduct(
    scenario.property.id,
    "Produto semântico Y",
  );
  const record = await createFarmRecord({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    createdByUserId: scenario.users[0].id,
    type: FarmRecordType.NOTE,
    description: "Registro do produto X",
  });

  await expectStockError(
    () =>
      registerStockMovement({
        propertyId: scenario.property.id,
        productId: productY.id,
        farmRecordId: record.id,
        type: StockMovementType.OUT,
        amount: "1",
        createdByUserId: scenario.users[0].id,
      }),
    "FARM_RECORD_MOVEMENT_MISMATCH",
  );

  assert.equal(
    (await db.stockProduct.findUniqueOrThrow({ where: { id: productY.id } }))
      .quantity.toString(),
    "10",
  );
  assert.equal(
    await db.stockMovement.count({ where: { propertyId: scenario.property.id } }),
    0,
  );
});

test("FarmRecord na área 1 não aceita StockMovement na área 2", async () => {
  const scenario = await createStockScenario({
    quantity: "10",
    areaName: "Área semântica 1",
  });
  assert.ok(scenario.area);
  const area2 = await createAdditionalArea(
    scenario.property.id,
    "Área semântica 2",
  );
  const record = await createFarmRecord({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    areaId: scenario.area.id,
    createdByUserId: scenario.users[0].id,
    type: FarmRecordType.NOTE,
    description: "Registro da área 1",
  });

  await expectStockError(
    () =>
      registerStockMovement({
        propertyId: scenario.property.id,
        productId: scenario.product.id,
        areaId: area2.id,
        farmRecordId: record.id,
        type: StockMovementType.OUT,
        amount: "1",
        createdByUserId: scenario.users[0].id,
      }),
    "FARM_RECORD_MOVEMENT_MISMATCH",
  );

  assert.equal(
    (await db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }))
      .quantity.toString(),
    "10",
  );
});

test("FarmRecord sem produto não pode ser ligado a StockMovement", async () => {
  const scenario = await createStockScenario({ quantity: "10" });
  const record = await createFarmRecord({
    propertyId: scenario.property.id,
    createdByUserId: scenario.users[0].id,
    type: FarmRecordType.NOTE,
    description: "Registro sem produto",
  });

  await expectStockError(
    () =>
      registerStockMovement({
        propertyId: scenario.property.id,
        productId: scenario.product.id,
        farmRecordId: record.id,
        type: StockMovementType.IN,
        amount: "1",
        createdByUserId: scenario.users[0].id,
      }),
    "FARM_RECORD_MOVEMENT_MISMATCH",
  );
});

test("FarmRecord e StockMovement com o mesmo produto e área são aceitos", async () => {
  const scenario = await createStockScenario({
    quantity: "10",
    areaName: "Área semanticamente válida",
  });
  assert.ok(scenario.area);
  const record = await createFarmRecord({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    areaId: scenario.area.id,
    createdByUserId: scenario.users[0].id,
    type: FarmRecordType.NOTE,
    description: "Registro semanticamente válido",
  });

  const movement = await registerStockMovement({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    areaId: scenario.area.id,
    farmRecordId: record.id,
    type: StockMovementType.OUT,
    amount: "2",
    createdByUserId: scenario.users[0].id,
  });

  assert.equal(movement.farmRecordId, record.id);
  assert.equal(movement.productId, record.productId);
  assert.equal(movement.areaId, record.areaId);
  assert.equal(movement.balanceAfter.toString(), "8");
});

test("FarmRecord e StockMovement aceitam área null quando ambos usam null", async () => {
  const scenario = await createStockScenario({ quantity: "10" });
  const record = await createFarmRecord({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    areaId: null,
    createdByUserId: scenario.users[0].id,
    type: FarmRecordType.NOTE,
    description: "Registro sem área",
  });

  const movement = await registerStockMovement({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    areaId: null,
    farmRecordId: record.id,
    type: StockMovementType.IN,
    amount: "1",
    createdByUserId: scenario.users[0].id,
  });

  assert.equal(record.areaId, null);
  assert.equal(movement.areaId, null);
  assert.equal(movement.balanceAfter.toString(), "11");
});

test("reversão compensa movimento histórico semanticamente incompatível", async () => {
  const scenario = await createStockScenario({ quantity: "9" });
  const recordProduct = await createAdditionalProduct(
    scenario.property.id,
    "Produto do registro histórico",
    "0",
  );
  const recordArea = await createAdditionalArea(
    scenario.property.id,
    "Área do registro histórico",
  );
  const record = await createFarmRecord({
    propertyId: scenario.property.id,
    productId: recordProduct.id,
    areaId: recordArea.id,
    createdByUserId: scenario.users[0].id,
    type: FarmRecordType.NOTE,
    description: "Registro histórico incompatível",
  });
  const original = await db.stockMovement.create({
    data: {
      propertyId: scenario.property.id,
      productId: scenario.product.id,
      farmRecordId: record.id,
      type: StockMovementType.OUT,
      quantityChange: new Prisma.Decimal("-1"),
      productNameSnapshot: scenario.product.name,
      unitSnapshot: scenario.product.unit,
      balanceBefore: new Prisma.Decimal("10"),
      balanceAfter: new Prisma.Decimal("9"),
      createdByUserId: scenario.users[0].id,
      source: RecordSource.WEB,
    },
  });

  const reversal = await reverseStockMovement({
    propertyId: scenario.property.id,
    movementId: original.id,
    createdByUserId: scenario.users[0].id,
    reason: "Compensação de vínculo histórico legado",
  });
  const [product, originalAfter, recordAfter, audit] = await Promise.all([
    db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }),
    db.stockMovement.findUniqueOrThrow({ where: { id: original.id } }),
    db.farmRecord.findUniqueOrThrow({ where: { id: record.id } }),
    db.auditLog.findFirstOrThrow({
      where: {
        propertyId: scenario.property.id,
        entityType: "StockMovement",
        entityId: reversal.id,
        action: "STOCK_MOVEMENT_REVERSED",
      },
    }),
  ]);

  assert.equal(product.quantity.toString(), "10");
  assert.equal(originalAfter.type, StockMovementType.OUT);
  assert.equal(originalAfter.productId, scenario.product.id);
  assert.equal(originalAfter.areaId, null);
  assert.equal(originalAfter.farmRecordId, record.id);
  assert.equal(originalAfter.quantityChange.toString(), "-1");
  assert.equal(originalAfter.balanceBefore.toString(), "10");
  assert.equal(originalAfter.balanceAfter.toString(), "9");
  assert.equal(originalAfter.productNameSnapshot, original.productNameSnapshot);
  assert.equal(originalAfter.areaNameSnapshot, original.areaNameSnapshot);
  assert.equal(originalAfter.unitSnapshot, original.unitSnapshot);
  assert.equal(originalAfter.reversesMovementId, null);

  assert.equal(recordAfter.productId, recordProduct.id);
  assert.equal(recordAfter.areaId, recordArea.id);
  assert.equal(reversal.type, StockMovementType.REVERSAL);
  assert.equal(reversal.reversesMovementId, original.id);
  assert.equal(reversal.productId, original.productId);
  assert.equal(reversal.areaId, original.areaId);
  assert.equal(reversal.farmRecordId, original.farmRecordId);
  assert.equal(reversal.productNameSnapshot, original.productNameSnapshot);
  assert.equal(reversal.areaNameSnapshot, original.areaNameSnapshot);
  assert.equal(reversal.unitSnapshot, original.unitSnapshot);
  assert.equal(reversal.quantityChange.toString(), "1");
  assert.equal(reversal.balanceBefore.toString(), "9");
  assert.equal(reversal.balanceAfter.toString(), "10");

  assert.equal(audit.actorUserId, scenario.users[0].id);
  assert.equal(
    (audit.metadata as { reversedMovementId?: string }).reversedMovementId,
    original.id,
  );
  assert.equal(
    await db.stockMovement.count({ where: { reversesMovementId: original.id } }),
    1,
  );
});

test("marcador WEB é obrigatório, não forjável e relê a capability", async () => {
  const { property, users } = await createTenant(2);
  const [owner, viewer] = users;
  await db.propertyMember.update({
    where: {
      propertyId_userId: {
        propertyId: property.id,
        userId: viewer.id,
      },
    },
    data: { role: PropertyRole.VIEWER },
  });
  const product = await createAdditionalProduct(
    property.id,
    "Produto para testar marcador WEB",
    "9",
  );
  const original = await db.stockMovement.create({
    data: {
      propertyId: property.id,
      productId: product.id,
      type: StockMovementType.OUT,
      quantityChange: new Prisma.Decimal("-1"),
      productNameSnapshot: product.name,
      unitSnapshot: product.unit,
      balanceBefore: new Prisma.Decimal("10"),
      balanceAfter: new Prisma.Decimal("9"),
      createdByUserId: owner.id,
      source: RecordSource.WEB,
    },
  });

  const webOperationsWithoutAuthorization = [
    () =>
      createAreaService({
        propertyId: property.id,
        name: "Área WEB sem marcador",
        type: AreaType.FIELD,
        createdByUserId: owner.id,
        source: RecordSource.WEB,
      }),
    () =>
      createStockProductService({
        propertyId: property.id,
        name: "Cadastro de produto WEB sem marcador",
        category: ProductCategory.OTHER,
        initialQuantity: "0",
        unit: "kg",
        createdByUserId: owner.id,
        source: RecordSource.WEB,
      }),
    () =>
      createFarmRecordService({
        propertyId: property.id,
        productId: product.id,
        createdByUserId: owner.id,
        type: FarmRecordType.NOTE,
        description: "Registro WEB sem marcador",
        source: RecordSource.WEB,
      }),
    () =>
      registerStockMovementService({
        propertyId: property.id,
        productId: product.id,
        type: StockMovementType.IN,
        amount: "1",
        createdByUserId: owner.id,
        source: RecordSource.WEB,
      }),
    () =>
      reverseStockMovementService({
        propertyId: property.id,
        movementId: original.id,
        reason: "Reversão WEB sem marcador",
        createdByUserId: owner.id,
        source: RecordSource.WEB,
      }),
    () =>
      createFarmRecordWithStockMovementService({
        farmRecord: {
          propertyId: property.id,
          productId: product.id,
          createdByUserId: owner.id,
          type: FarmRecordType.NOTE,
          description: "Operação combinada WEB sem marcador",
          source: RecordSource.WEB,
        },
        stockMovement: {
          type: StockMovementType.IN,
          amount: "1",
        },
      }),
  ];
  for (const operation of webOperationsWithoutAuthorization) {
    await expectCapabilityDenied(operation);
  }

  const forgedAuthorization = Object.freeze({}) as unknown as
    typeof RURAL_WEB_AUTHORIZATION;
  await expectCapabilityDenied(() =>
    createAreaService(
      {
        propertyId: property.id,
        name: "Área WEB com marcador forjado",
        type: AreaType.FIELD,
        createdByUserId: owner.id,
        source: RecordSource.WEB,
      },
      forgedAuthorization,
    ),
  );

  const allowed = await createAreaService(
    {
      propertyId: property.id,
      name: "Área WEB com marcador real",
      type: AreaType.FIELD,
      createdByUserId: owner.id,
      source: RecordSource.WEB,
    },
    RURAL_WEB_AUTHORIZATION,
  );
  assert.equal(allowed.propertyId, property.id);

  await expectCapabilityDenied(() =>
    createAreaService(
      {
        propertyId: property.id,
        name: "Área WEB sem capability",
        type: AreaType.FIELD,
        createdByUserId: viewer.id,
        source: RecordSource.WEB,
      },
      RURAL_WEB_AUTHORIZATION,
    ),
  );

  assert.equal(
    await db.area.count({
      where: {
        propertyId: property.id,
        name: { startsWith: "Área WEB" },
      },
    }),
    1,
  );
  assert.equal(
    (await db.stockProduct.findUniqueOrThrow({ where: { id: product.id } }))
      .quantity.toString(),
    "9",
  );
  assert.equal(
    await db.stockMovement.count({ where: { reversesMovementId: original.id } }),
    0,
  );
  assert.equal(
    await db.farmRecord.count({ where: { propertyId: property.id } }),
    0,
  );
});

test("todos os comandos WEB rurais recusam createdByUserId nulo", async () => {
  const scenario = await createStockScenario({ quantity: "10" });

  await expectDomainError(
    () =>
      createArea({
        propertyId: scenario.property.id,
        name: "Área sem ator WEB",
        type: AreaType.FIELD,
        createdByUserId: null,
      }),
    AreaDomainError,
    "WEB_ACTOR_REQUIRED",
  );
  await expectDomainError(
    () =>
      createStockProduct({
        propertyId: scenario.property.id,
        name: "Produto sem ator WEB",
        category: ProductCategory.OTHER,
        initialQuantity: "0",
        unit: "un",
        createdByUserId: null,
      }),
    StockProductDomainError,
    "WEB_ACTOR_REQUIRED",
  );
  await expectDomainError(
    () =>
      createFarmRecord({
        propertyId: scenario.property.id,
        type: FarmRecordType.NOTE,
        description: "Registro sem ator WEB",
        createdByUserId: null,
      }),
    FarmRecordDomainError,
    "WEB_ACTOR_REQUIRED",
  );
  await expectStockError(
    () =>
      registerStockMovement({
        propertyId: scenario.property.id,
        productId: scenario.product.id,
        type: StockMovementType.IN,
        amount: "1",
        createdByUserId: null,
      }),
    "WEB_ACTOR_REQUIRED",
  );

  const original = await registerStockMovement({
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    type: StockMovementType.OUT,
    amount: "1",
    createdByUserId: scenario.users[0].id,
  });
  await expectStockError(
    () =>
      reverseStockMovement({
        propertyId: scenario.property.id,
        movementId: original.id,
        createdByUserId: null,
        reason: "Reversão WEB sem ator",
    }),
    "WEB_ACTOR_REQUIRED",
  );

  // JavaScript ainda pode omitir um campo obrigatório em runtime. A guarda
  // defensiva precisa recusar `undefined`, não apenas o `null` tipado.
  await expectDomainError(
    () =>
      createArea({
        propertyId: scenario.property.id,
        name: "Área com ator ausente",
        type: AreaType.FIELD,
        createdByUserId: undefined as never,
      }),
    AreaDomainError,
    "WEB_ACTOR_REQUIRED",
  );
  await expectDomainError(
    () =>
      createStockProduct({
        propertyId: scenario.property.id,
        name: "Produto com ator ausente",
        category: ProductCategory.OTHER,
        initialQuantity: "0",
        unit: "un",
        createdByUserId: undefined as never,
      }),
    StockProductDomainError,
    "WEB_ACTOR_REQUIRED",
  );
  await expectDomainError(
    () =>
      createFarmRecord({
        propertyId: scenario.property.id,
        type: FarmRecordType.NOTE,
        description: "Registro com ator ausente",
        createdByUserId: undefined as never,
      }),
    FarmRecordDomainError,
    "WEB_ACTOR_REQUIRED",
  );
  await expectStockError(
    () =>
      registerStockMovement({
        propertyId: scenario.property.id,
        productId: scenario.product.id,
        type: StockMovementType.IN,
        amount: "1",
        createdByUserId: undefined as never,
      }),
    "WEB_ACTOR_REQUIRED",
  );
  await expectStockError(
    () =>
      reverseStockMovement({
        propertyId: scenario.property.id,
        movementId: original.id,
        createdByUserId: undefined as never,
        reason: "Reversão WEB com ator ausente",
      }),
    "WEB_ACTOR_REQUIRED",
  );
});

test("fontes SYSTEM sem marcador preservam ator nulo nos services rurais", async () => {
  const tenant = await createTenant();
  const area = await createAreaService({
    propertyId: tenant.property.id,
    name: "Área criada pelo sistema",
    type: AreaType.FIELD,
    createdByUserId: null,
    source: RecordSource.SYSTEM,
  });
  const product = await createStockProductService({
    propertyId: tenant.property.id,
    name: "Produto criado pelo sistema",
    category: ProductCategory.OTHER,
    initialQuantity: "10",
    unit: "kg",
    createdByUserId: null,
    source: RecordSource.SYSTEM,
  });
  const record = await createFarmRecordService({
    propertyId: tenant.property.id,
    productId: product.id,
    areaId: area.id,
    type: FarmRecordType.NOTE,
    description: "Registro criado pelo sistema",
    createdByUserId: null,
    source: RecordSource.SYSTEM,
  });
  const movement = await registerStockMovementService({
    propertyId: tenant.property.id,
    productId: product.id,
    areaId: area.id,
    farmRecordId: record.id,
    type: StockMovementType.IN,
    amount: "1",
    createdByUserId: null,
    source: RecordSource.SYSTEM,
  });
  const reversal = await reverseStockMovementService({
    propertyId: tenant.property.id,
    movementId: movement.id,
    createdByUserId: null,
    source: RecordSource.SYSTEM,
    reason: "Correção automática",
  });
  const combined = await createFarmRecordWithStockMovementService({
    farmRecord: {
      propertyId: tenant.property.id,
      productId: product.id,
      areaId: area.id,
      type: FarmRecordType.NOTE,
      description: "Operação combinada criada pelo sistema",
      createdByUserId: null,
      source: RecordSource.SYSTEM,
    },
    stockMovement: {
      type: StockMovementType.IN,
      amount: "2",
    },
  });

  assert.equal(area.propertyId, tenant.property.id);
  assert.equal(product.createdAt instanceof Date, true);
  assert.equal(record.createdByUserId, null);
  assert.equal(movement.createdByUserId, null);
  assert.equal(reversal.createdByUserId, null);
  assert.equal(combined.farmRecord.createdByUserId, null);
  assert.equal(combined.stockMovement.createdByUserId, null);
  assert.equal(combined.stockMovement.farmRecordId, combined.farmRecord.id);
  assert.equal(combined.stockMovement.balanceAfter.toString(), "12");
  assert.equal(
    await db.auditLog.count({
      where: { propertyId: tenant.property.id, actorUserId: null },
    }),
    8,
  );
});

test("performedBy de outra Property falha sem alterar FarmRecord ou saldo", async () => {
  const [scenarioA, scenarioB] = await Promise.all([
    createStockScenario({ quantity: "10" }),
    createStockScenario({ quantity: "10" }),
  ]);

  await expectDomainError(
    () =>
      createFarmRecord({
        propertyId: scenarioA.property.id,
        productId: scenarioA.product.id,
        createdByUserId: scenarioA.users[0].id,
        performedByUserId: scenarioB.users[0].id,
        type: FarmRecordType.NOTE,
        description: "Executor de outra propriedade",
      }),
    FarmRecordDomainError,
    "USER_NOT_ACTIVE_PROPERTY_MEMBER",
  );
  await expectStockError(
    () =>
      registerStockMovement({
        propertyId: scenarioA.property.id,
        productId: scenarioA.product.id,
        createdByUserId: scenarioA.users[0].id,
        performedByUserId: scenarioB.users[0].id,
        type: StockMovementType.OUT,
        amount: "1",
      }),
    "USER_NOT_ACTIVE_PROPERTY_MEMBER",
  );

  assert.equal(
    (await db.stockProduct.findUniqueOrThrow({ where: { id: scenarioA.product.id } }))
      .quantity.toString(),
    "10",
  );
  assert.equal(
    await db.farmRecord.count({ where: { propertyId: scenarioA.property.id } }),
    0,
  );
  assert.equal(
    await db.auditLog.count({ where: { propertyId: scenarioA.property.id } }),
    0,
  );
});

test("operação combinada cria FarmRecord, movimento, saldo e auditorias juntos", async () => {
  const scenario = await createStockScenario({
    quantity: "10",
    areaName: "Área da operação combinada",
    userCount: 2,
  });
  assert.ok(scenario.area);
  const [createdBy, performedBy] = scenario.users;

  const result = await createFarmRecordWithStockMovement({
    farmRecord: {
      propertyId: scenario.property.id,
      productId: scenario.product.id,
      areaId: scenario.area.id,
      createdByUserId: createdBy.id,
      performedByUserId: performedBy.id,
      type: FarmRecordType.SPRAYING,
      description: "Aplicação com baixa atômica",
    },
    stockMovement: {
      type: StockMovementType.OUT,
      amount: "3",
      reason: "Produto aplicado",
    },
  });

  assert.equal(result.stockMovement.farmRecordId, result.farmRecord.id);
  assert.equal(result.stockMovement.productId, result.farmRecord.productId);
  assert.equal(result.stockMovement.areaId, result.farmRecord.areaId);
  assert.equal(result.stockMovement.balanceBefore.toString(), "10");
  assert.equal(result.stockMovement.balanceAfter.toString(), "7");
  assert.equal(result.stockMovement.createdByUserId, createdBy.id);
  assert.equal(result.stockMovement.performedByUserId, performedBy.id);
  assert.equal(result.farmRecord.source, RecordSource.WEB);
  assert.equal(result.stockMovement.source, RecordSource.WEB);
  assert.equal(
    (await db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }))
      .quantity.toString(),
    "7",
  );

  const audits = await db.auditLog.findMany({
    where: { propertyId: scenario.property.id },
  });
  assert.equal(audits.length, 2);
  assert.deepEqual(
    new Set(audits.map((audit) => audit.action)),
    new Set(["FARM_RECORD_CREATED", "STOCK_MOVEMENT_CREATED"]),
  );
  assert.ok(audits.every((audit) => audit.actorUserId === createdBy.id));
  assert.ok(
    audits.some(
      (audit) =>
        audit.entityType === "FarmRecord" &&
        audit.entityId === result.farmRecord.id,
    ),
  );
  assert.ok(
    audits.some(
      (audit) =>
        audit.entityType === "StockMovement" &&
        audit.entityId === result.stockMovement.id,
    ),
  );
});

test("saldo insuficiente desfaz integralmente a operação combinada", async () => {
  const scenario = await createStockScenario({ quantity: "2" });

  await expectStockError(
    () =>
      createFarmRecordWithStockMovement({
        farmRecord: {
          propertyId: scenario.property.id,
          productId: scenario.product.id,
          createdByUserId: scenario.users[0].id,
          type: FarmRecordType.NOTE,
          description: "Registro que precisa sofrer rollback",
        },
        stockMovement: {
          type: StockMovementType.OUT,
          amount: "3",
        },
      }),
    "INSUFFICIENT_STOCK",
  );

  assert.equal(
    (await db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }))
      .quantity.toString(),
    "2",
  );
  assert.equal(
    await db.farmRecord.count({ where: { propertyId: scenario.property.id } }),
    0,
  );
  assert.equal(
    await db.stockMovement.count({ where: { propertyId: scenario.property.id } }),
    0,
  );
  assert.equal(
    await db.auditLog.count({ where: { propertyId: scenario.property.id } }),
    0,
  );
});

test("FarmRecord combinado sem produto sofre rollback antes do commit", async () => {
  const scenario = await createStockScenario({ quantity: "10" });

  await expectStockError(
    () =>
      createFarmRecordWithStockMovement({
        farmRecord: {
          propertyId: scenario.property.id,
          createdByUserId: scenario.users[0].id,
          type: FarmRecordType.NOTE,
          description: "Registro incompatível sem produto",
        },
        stockMovement: {
          type: StockMovementType.OUT,
          amount: "1",
        },
      }),
    "FARM_RECORD_MOVEMENT_MISMATCH",
  );

  assert.equal(
    (await db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }))
      .quantity.toString(),
    "10",
  );
  assert.equal(
    await db.farmRecord.count({ where: { propertyId: scenario.property.id } }),
    0,
  );
  assert.equal(
    await db.stockMovement.count({ where: { propertyId: scenario.property.id } }),
    0,
  );
  assert.equal(
    await db.auditLog.count({ where: { propertyId: scenario.property.id } }),
    0,
  );
});

test("operação combinada também aplica ADJUSTMENT atomicamente", async () => {
  const scenario = await createStockScenario({ quantity: "10" });

  const result = await createFarmRecordWithStockMovement({
    farmRecord: {
      propertyId: scenario.property.id,
      productId: scenario.product.id,
      createdByUserId: scenario.users[0].id,
      type: FarmRecordType.INSPECTION,
      description: "Conferência física do estoque",
    },
    stockMovement: {
      type: StockMovementType.ADJUSTMENT,
      newBalance: "12.5",
      reason: "Contagem física",
    },
  });

  assert.equal(result.stockMovement.type, StockMovementType.ADJUSTMENT);
  assert.equal(result.stockMovement.balanceBefore.toString(), "10");
  assert.equal(result.stockMovement.balanceAfter.toString(), "12.5");
  assert.equal(result.stockMovement.quantityChange.toString(), "2.5");
  assert.equal(result.stockMovement.farmRecordId, result.farmRecord.id);
  assert.equal(
    (await db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }))
      .quantity.toString(),
    "12.5",
  );
  assert.equal(
    await db.auditLog.count({ where: { propertyId: scenario.property.id } }),
    2,
  );
});

test("erro no FarmRecord combinado não altera saldo nem cria histórico", async () => {
  const scenario = await createStockScenario({ quantity: "10" });

  await expectDomainError(
    () =>
      createFarmRecordWithStockMovement({
        farmRecord: {
          propertyId: scenario.property.id,
          productId: scenario.product.id,
          createdByUserId: scenario.users[0].id,
          type: FarmRecordType.NOTE,
          description: "   ",
        },
        stockMovement: {
          type: StockMovementType.OUT,
          amount: "1",
        },
      }),
    FarmRecordDomainError,
    "INVALID_RECORD",
  );

  assert.equal(
    (await db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }))
      .quantity.toString(),
    "10",
  );
  assert.equal(
    await db.farmRecord.count({ where: { propertyId: scenario.property.id } }),
    0,
  );
  assert.equal(
    await db.stockMovement.count({ where: { propertyId: scenario.property.id } }),
    0,
  );
  assert.equal(
    await db.auditLog.count({ where: { propertyId: scenario.property.id } }),
    0,
  );
});

test("duas operações combinadas concorrentes preservam saldo e atomicidade", async () => {
  const scenario = await createStockScenario({ quantity: "10" });
  const operation = (label: string) =>
    createFarmRecordWithStockMovement({
      farmRecord: {
        propertyId: scenario.property.id,
        productId: scenario.product.id,
        createdByUserId: scenario.users[0].id,
        type: FarmRecordType.NOTE,
        description: `Operação concorrente ${label}`,
      },
      stockMovement: {
        type: StockMovementType.OUT,
        amount: "8",
      },
    });

  const results = await Promise.allSettled([operation("A"), operation("B")]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.ok(rejected.reason instanceof StockDomainError);
  assert.ok(
    ["INSUFFICIENT_STOCK", "CONCURRENCY_CONFLICT"].includes(
      rejected.reason.code,
    ),
  );

  assert.equal(
    (await db.stockProduct.findUniqueOrThrow({ where: { id: scenario.product.id } }))
      .quantity.toString(),
    "2",
  );
  assert.equal(
    await db.farmRecord.count({ where: { propertyId: scenario.property.id } }),
    1,
  );
  assert.equal(
    await db.stockMovement.count({ where: { propertyId: scenario.property.id } }),
    1,
  );
  assert.equal(
    await db.auditLog.count({ where: { propertyId: scenario.property.id } }),
    2,
  );
});

test("serviços WEB relêem a matriz de capabilities dentro da transação", async () => {
  const { property, users } = await createTenant(4);
  const [owner, manager, employee, viewer] = users;

  await Promise.all([
    db.propertyMember.update({
      where: {
        propertyId_userId: {
          propertyId: property.id,
          userId: manager.id,
        },
      },
      data: { role: PropertyRole.MANAGER },
    }),
    db.propertyMember.update({
      where: {
        propertyId_userId: {
          propertyId: property.id,
          userId: viewer.id,
        },
      },
      data: { role: PropertyRole.VIEWER },
    }),
  ]);

  const area = await createArea(
    {
      propertyId: property.id,
      name: "Área autorizada do proprietário",
      type: AreaType.FIELD,
      createdByUserId: owner.id,
      source: RecordSource.WEB,
    },
    RURAL_WEB_AUTHORIZATION,
  );
  const product = await createStockProduct(
    {
      propertyId: property.id,
      name: "Produto autorizado do gerente",
      category: ProductCategory.OTHER,
      initialQuantity: "5",
      unit: "kg",
      createdByUserId: manager.id,
      source: RecordSource.WEB,
    },
    RURAL_WEB_AUTHORIZATION,
  );
  assert.equal(area.propertyId, property.id);
  assert.equal(product.quantity.toString(), "5");

  const record = await createFarmRecord(
    {
      propertyId: property.id,
      areaId: area.id,
      productId: product.id,
      createdByUserId: employee.id,
      type: FarmRecordType.NOTE,
      description: "Anotação operacional permitida",
      source: RecordSource.WEB,
    },
    RURAL_WEB_AUTHORIZATION,
  );
  const movement = await registerStockMovement(
    {
      propertyId: property.id,
      productId: product.id,
      areaId: area.id,
      farmRecordId: record.id,
      type: StockMovementType.IN,
      amount: "1",
      createdByUserId: employee.id,
      source: RecordSource.WEB,
    },
    RURAL_WEB_AUTHORIZATION,
  );
  assert.equal(movement.balanceAfter.toString(), "6");

  await expectCapabilityDenied(() =>
    createArea(
      {
        propertyId: property.id,
        name: "Área proibida ao funcionário",
        type: AreaType.FIELD,
        createdByUserId: employee.id,
        source: RecordSource.WEB,
      },
      RURAL_WEB_AUTHORIZATION,
    ),
  );
  await expectCapabilityDenied(() =>
    createStockProduct(
      {
        propertyId: property.id,
        name: "Produto proibido ao funcionário",
        category: ProductCategory.OTHER,
        initialQuantity: "0",
        unit: "kg",
        createdByUserId: employee.id,
        source: RecordSource.WEB,
      },
      RURAL_WEB_AUTHORIZATION,
    ),
  );
  await expectCapabilityDenied(() =>
    registerStockMovement(
      {
        propertyId: property.id,
        productId: product.id,
        type: StockMovementType.ADJUSTMENT,
        newBalance: "20",
        reason: "Ajuste proibido ao funcionário",
        createdByUserId: employee.id,
        source: RecordSource.WEB,
      },
      RURAL_WEB_AUTHORIZATION,
    ),
  );
  await expectCapabilityDenied(() =>
    createFarmRecordWithStockMovement(
      {
        farmRecord: {
          propertyId: property.id,
          productId: product.id,
          createdByUserId: employee.id,
          type: FarmRecordType.NOTE,
          description: "Ajuste combinado proibido ao funcionário",
          source: RecordSource.WEB,
        },
        stockMovement: {
          type: StockMovementType.ADJUSTMENT,
          newBalance: "20",
          reason: "Ajuste combinado sem capability",
        },
      },
      RURAL_WEB_AUTHORIZATION,
    ),
  );
  assert.equal(
    await db.farmRecord.count({
      where: {
        propertyId: property.id,
        description: "Ajuste combinado proibido ao funcionário",
      },
    }),
    0,
  );
  await expectCapabilityDenied(() =>
    reverseStockMovement(
      {
        propertyId: property.id,
        movementId: movement.id,
        reason: "Reversão proibida ao funcionário",
        createdByUserId: employee.id,
        source: RecordSource.WEB,
      },
      RURAL_WEB_AUTHORIZATION,
    ),
  );
  await expectCapabilityDenied(() =>
    createFarmRecord(
      {
        propertyId: property.id,
        productId: product.id,
        createdByUserId: viewer.id,
        type: FarmRecordType.NOTE,
        description: "Anotação proibida ao visualizador",
        source: RecordSource.WEB,
      },
      RURAL_WEB_AUTHORIZATION,
    ),
  );
  await expectCapabilityDenied(() =>
    registerStockMovement(
      {
        propertyId: property.id,
        productId: product.id,
        type: StockMovementType.IN,
        amount: "1",
        createdByUserId: viewer.id,
        source: RecordSource.WEB,
      },
      RURAL_WEB_AUTHORIZATION,
    ),
  );

  const reversal = await reverseStockMovement(
    {
      propertyId: property.id,
      movementId: movement.id,
      reason: "Reversão autorizada ao gerente",
      createdByUserId: manager.id,
      source: RecordSource.WEB,
    },
    RURAL_WEB_AUTHORIZATION,
  );
  assert.equal(reversal.balanceAfter.toString(), "5");

  const combined = await createFarmRecordWithStockMovement(
    {
      farmRecord: {
        propertyId: property.id,
        areaId: area.id,
        productId: product.id,
        createdByUserId: employee.id,
        type: FarmRecordType.NOTE,
        description: "Operação combinada autorizada ao funcionário",
        source: RecordSource.WEB,
      },
      stockMovement: {
        type: StockMovementType.IN,
        amount: "2",
      },
    },
    RURAL_WEB_AUTHORIZATION,
  );
  assert.equal(combined.stockMovement.farmRecordId, combined.farmRecord.id);
  assert.equal(combined.stockMovement.balanceAfter.toString(), "7");
});
