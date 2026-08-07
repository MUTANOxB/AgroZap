import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { assertSafeIntegrationRuntime } from "./test-database";

assertSafeIntegrationRuntime(process.env);

const [prismaModule, prismaLib, fixtures] = await Promise.all([
  import("@/generated/prisma/client"),
  import("@/lib/prisma"),
  import("./fixtures"),
]);

const {
  FarmRecordType,
  Prisma,
  RecordSource,
  StockMovementType,
} = prismaModule;
const { db } = prismaLib;
const { createStockScenario } = fixtures;

after(async () => {
  await db.$disconnect();
});

type ScopedScenario = {
  property: { id: string };
  product: { id: string; name: string; unit: string };
  area: { id: string; name: string };
  users: Array<{ id: string }>;
};

function token(label: string) {
  return `stage21-${label}-${randomUUID()}`;
}

async function createScenario(label: string): Promise<ScopedScenario> {
  const scenario = await createStockScenario({
    productName: `Produto ${label}`,
    areaName: `Área ${label}`,
    quantity: "10",
  });
  assert.ok(scenario.area);

  return {
    property: scenario.property,
    product: scenario.product,
    area: scenario.area,
    users: scenario.users,
  };
}

async function createScenarioPair() {
  const [propertyA, propertyB] = await Promise.all([
    createScenario("A"),
    createScenario("B"),
  ]);
  return { propertyA, propertyB };
}

async function createScopedFarmRecord(
  scenario: ScopedScenario,
  label: string,
) {
  return db.farmRecord.create({
    data: {
      id: token(`farm-record-${label}`),
      propertyId: scenario.property.id,
      areaId: scenario.area.id,
      productId: scenario.product.id,
      createdByUserId: scenario.users[0].id,
      type: FarmRecordType.NOTE,
      description: `Registro ${label}`,
      productNameSnapshot: scenario.product.name,
      areaNameSnapshot: scenario.area.name,
      source: RecordSource.WEB,
    },
  });
}

function outgoingMovementData(
  scenario: ScopedScenario,
  id: string,
  options: {
    areaId?: string | null;
    farmRecordId?: string | null;
  } = {},
) {
  return {
    id,
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    areaId: options.areaId === undefined ? scenario.area.id : options.areaId,
    farmRecordId: options.farmRecordId ?? null,
    type: StockMovementType.OUT,
    quantityChange: new Prisma.Decimal("-1"),
    productNameSnapshot: scenario.product.name,
    areaNameSnapshot: scenario.area.name,
    unitSnapshot: scenario.product.unit,
    balanceBefore: new Prisma.Decimal("10"),
    balanceAfter: new Prisma.Decimal("9"),
    createdByUserId: scenario.users[0].id,
    source: RecordSource.WEB,
    reason: "Movimento direto para validar isolamento tenant",
  };
}

function reversalMovementData(
  scenario: ScopedScenario,
  id: string,
  reversesMovementId: string,
  farmRecordId: string | null = null,
) {
  return {
    id,
    propertyId: scenario.property.id,
    productId: scenario.product.id,
    areaId: scenario.area.id,
    farmRecordId,
    type: StockMovementType.REVERSAL,
    quantityChange: new Prisma.Decimal("1"),
    productNameSnapshot: scenario.product.name,
    areaNameSnapshot: scenario.area.name,
    unitSnapshot: scenario.product.unit,
    balanceBefore: new Prisma.Decimal("9"),
    balanceAfter: new Prisma.Decimal("10"),
    createdByUserId: scenario.users[0].id,
    source: RecordSource.WEB,
    reason: "Reversão direta para validar isolamento tenant",
    reversesMovementId,
  };
}

function foreignKeyConstraintName(
  error: InstanceType<typeof Prisma.PrismaClientKnownRequestError>,
) {
  const adapterError = error.meta?.driverAdapterError as
    | {
        cause?: {
          constraint?: { index?: string };
        };
      }
    | undefined;

  return adapterError?.cause?.constraint?.index;
}

async function expectCompositeForeignKeyViolation(
  operation: Promise<unknown>,
  expectedConstraint: string,
) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof Prisma.PrismaClientKnownRequestError);
    assert.equal(error.code, "P2003");
    assert.equal(foreignKeyConstraintName(error), expectedConstraint);
    assert.ok(
      error.message.includes(`constraint: \`${expectedConstraint}\``),
      `A mensagem não identificou a constraint ${expectedConstraint}.`,
    );
    return true;
  });
}

test("AreaAlias da Property A não aponta para Area da Property B", async () => {
  const { propertyA, propertyB } = await createScenarioPair();
  const aliasId = token("cross-area-alias");
  const aliasName = token("alias-area");

  await expectCompositeForeignKeyViolation(
    db.areaAlias.create({
      data: {
        id: aliasId,
        propertyId: propertyA.property.id,
        areaId: propertyB.area.id,
        name: aliasName,
        normalizedName: aliasName.toLocaleLowerCase("pt-BR"),
      },
    }),
    "AreaAlias_propertyId_areaId_fkey",
  );

  assert.equal(await db.areaAlias.findUnique({ where: { id: aliasId } }), null);
  assert.ok(await db.area.findUnique({ where: { id: propertyB.area.id } }));
});

test("ProductAlias da Property A não aponta para StockProduct da Property B", async () => {
  const { propertyA, propertyB } = await createScenarioPair();
  const aliasId = token("cross-product-alias");
  const aliasName = token("alias-product");

  await expectCompositeForeignKeyViolation(
    db.productAlias.create({
      data: {
        id: aliasId,
        propertyId: propertyA.property.id,
        productId: propertyB.product.id,
        name: aliasName,
        normalizedName: aliasName.toLocaleLowerCase("pt-BR"),
      },
    }),
    "ProductAlias_propertyId_productId_fkey",
  );

  assert.equal(await db.productAlias.findUnique({ where: { id: aliasId } }), null);
  assert.ok(
    await db.stockProduct.findUnique({ where: { id: propertyB.product.id } }),
  );
});

test("FarmRecord da Property A não aponta para Area da Property B", async () => {
  const { propertyA, propertyB } = await createScenarioPair();
  const recordId = token("cross-record-area");

  await expectCompositeForeignKeyViolation(
    db.farmRecord.create({
      data: {
        id: recordId,
        propertyId: propertyA.property.id,
        areaId: propertyB.area.id,
        productId: propertyA.product.id,
        createdByUserId: propertyA.users[0].id,
        type: FarmRecordType.NOTE,
        description: "Tentativa direta de relacionar área de outra propriedade",
        productNameSnapshot: propertyA.product.name,
        areaNameSnapshot: propertyB.area.name,
        source: RecordSource.WEB,
      },
    }),
    "FarmRecord_propertyId_areaId_fkey",
  );

  assert.equal(await db.farmRecord.findUnique({ where: { id: recordId } }), null);
  assert.ok(await db.area.findUnique({ where: { id: propertyB.area.id } }));
});

test("FarmRecord da Property A não aponta para StockProduct da Property B", async () => {
  const { propertyA, propertyB } = await createScenarioPair();
  const recordId = token("cross-record-product");

  await expectCompositeForeignKeyViolation(
    db.farmRecord.create({
      data: {
        id: recordId,
        propertyId: propertyA.property.id,
        areaId: propertyA.area.id,
        productId: propertyB.product.id,
        createdByUserId: propertyA.users[0].id,
        type: FarmRecordType.NOTE,
        description: "Tentativa direta de relacionar produto de outra propriedade",
        productNameSnapshot: propertyB.product.name,
        areaNameSnapshot: propertyA.area.name,
        source: RecordSource.WEB,
      },
    }),
    "FarmRecord_propertyId_productId_fkey",
  );

  assert.equal(await db.farmRecord.findUnique({ where: { id: recordId } }), null);
  assert.ok(
    await db.stockProduct.findUnique({ where: { id: propertyB.product.id } }),
  );
});

test("StockMovement da Property A não aponta para StockProduct da Property B", async () => {
  const { propertyA, propertyB } = await createScenarioPair();
  const movementId = token("cross-movement-product");

  await expectCompositeForeignKeyViolation(
    db.stockMovement.create({
      data: {
        ...outgoingMovementData(propertyA, movementId),
        productId: propertyB.product.id,
        productNameSnapshot: propertyB.product.name,
        unitSnapshot: propertyB.product.unit,
      },
    }),
    "StockMovement_propertyId_productId_fkey",
  );

  assert.equal(
    await db.stockMovement.findUnique({ where: { id: movementId } }),
    null,
  );
  assert.equal(
    (
      await db.stockProduct.findUniqueOrThrow({
        where: { id: propertyB.product.id },
      })
    ).quantity.toString(),
    "10",
  );
});

test("StockMovement da Property A não aponta para Area da Property B", async () => {
  const { propertyA, propertyB } = await createScenarioPair();
  const movementId = token("cross-movement-area");

  await expectCompositeForeignKeyViolation(
    db.stockMovement.create({
      data: outgoingMovementData(propertyA, movementId, {
        areaId: propertyB.area.id,
      }),
    }),
    "StockMovement_propertyId_areaId_fkey",
  );

  assert.equal(
    await db.stockMovement.findUnique({ where: { id: movementId } }),
    null,
  );
  assert.ok(await db.area.findUnique({ where: { id: propertyB.area.id } }));
});

test("StockMovement da Property A não aponta para FarmRecord da Property B", async () => {
  const { propertyA, propertyB } = await createScenarioPair();
  const recordB = await createScopedFarmRecord(propertyB, "B");
  const movementId = token("cross-movement-record");

  await expectCompositeForeignKeyViolation(
    db.stockMovement.create({
      data: outgoingMovementData(propertyA, movementId, {
        farmRecordId: recordB.id,
      }),
    }),
    "StockMovement_propertyId_farmRecordId_fkey",
  );

  assert.equal(
    await db.stockMovement.findUnique({ where: { id: movementId } }),
    null,
  );
  assert.ok(await db.farmRecord.findUnique({ where: { id: recordB.id } }));
});

test("reversão da Property A não aponta para StockMovement da Property B", async () => {
  const { propertyA, propertyB } = await createScenarioPair();
  const originalB = await db.stockMovement.create({
    data: outgoingMovementData(propertyB, token("original-b")),
  });
  const reversalId = token("cross-reversal");

  await expectCompositeForeignKeyViolation(
    db.stockMovement.create({
      data: reversalMovementData(propertyA, reversalId, originalB.id),
    }),
    "StockMovement_propertyId_reversesMovementId_fkey",
  );

  assert.equal(
    await db.stockMovement.findUnique({ where: { id: reversalId } }),
    null,
  );
  assert.ok(await db.stockMovement.findUnique({ where: { id: originalB.id } }));
  assert.equal(
    await db.stockMovement.count({
      where: { reversesMovementId: originalB.id },
    }),
    0,
  );
});

test("ON UPDATE RESTRICT impede reparenting de Area com alias", async () => {
  const { propertyA, propertyB } = await createScenarioPair();
  const aliasName = token("restrict-area-alias");
  const alias = await db.areaAlias.create({
    data: {
      id: token("restrict-area-alias-id"),
      propertyId: propertyA.property.id,
      areaId: propertyA.area.id,
      name: aliasName,
      normalizedName: aliasName.toLocaleLowerCase("pt-BR"),
    },
  });

  await expectCompositeForeignKeyViolation(
    db.area.update({
      where: { id: propertyA.area.id },
      data: { propertyId: propertyB.property.id },
    }),
    "AreaAlias_propertyId_areaId_fkey",
  );

  const [persistedArea, persistedAlias] = await Promise.all([
    db.area.findUniqueOrThrow({ where: { id: propertyA.area.id } }),
    db.areaAlias.findUniqueOrThrow({ where: { id: alias.id } }),
  ]);

  assert.equal(persistedArea.propertyId, propertyA.property.id);
  assert.equal(persistedAlias.propertyId, propertyA.property.id);
  assert.equal(persistedAlias.areaId, propertyA.area.id);
});

test("ON UPDATE RESTRICT impede reparenting de StockProduct com alias", async () => {
  const { propertyA, propertyB } = await createScenarioPair();
  const aliasName = token("restrict-product-alias");
  const alias = await db.productAlias.create({
    data: {
      id: token("restrict-product-alias-id"),
      propertyId: propertyA.property.id,
      productId: propertyA.product.id,
      name: aliasName,
      normalizedName: aliasName.toLocaleLowerCase("pt-BR"),
    },
  });

  await expectCompositeForeignKeyViolation(
    db.stockProduct.update({
      where: { id: propertyA.product.id },
      data: { propertyId: propertyB.property.id },
    }),
    "ProductAlias_propertyId_productId_fkey",
  );

  const [persistedProduct, persistedAlias] = await Promise.all([
    db.stockProduct.findUniqueOrThrow({ where: { id: propertyA.product.id } }),
    db.productAlias.findUniqueOrThrow({ where: { id: alias.id } }),
  ]);

  assert.equal(persistedProduct.propertyId, propertyA.property.id);
  assert.equal(persistedAlias.propertyId, propertyA.property.id);
  assert.equal(persistedAlias.productId, propertyA.product.id);
});

test("ON UPDATE RESTRICT impede reparenting de FarmRecord com StockMovement", async () => {
  const { propertyA, propertyB } = await createScenarioPair();
  const record = await db.farmRecord.create({
    data: {
      id: token("restrict-farm-record"),
      propertyId: propertyA.property.id,
      createdByUserId: propertyA.users[0].id,
      type: FarmRecordType.NOTE,
      description: "Registro sem área ou produto para isolar a FK do movimento",
      source: RecordSource.WEB,
    },
  });
  const movement = await db.stockMovement.create({
    data: outgoingMovementData(propertyA, token("restrict-record-movement"), {
      areaId: null,
      farmRecordId: record.id,
    }),
  });

  await expectCompositeForeignKeyViolation(
    db.farmRecord.update({
      where: { id: record.id },
      data: { propertyId: propertyB.property.id },
    }),
    "StockMovement_propertyId_farmRecordId_fkey",
  );

  const [persistedRecord, persistedMovement] = await Promise.all([
    db.farmRecord.findUniqueOrThrow({ where: { id: record.id } }),
    db.stockMovement.findUniqueOrThrow({ where: { id: movement.id } }),
  ]);

  assert.equal(persistedRecord.propertyId, propertyA.property.id);
  assert.equal(persistedMovement.propertyId, propertyA.property.id);
  assert.equal(persistedMovement.farmRecordId, record.id);
});

test("StockMovement ligado a produto não aceita update isolado de propertyId", async () => {
  const { propertyA, propertyB } = await createScenarioPair();
  const movement = await db.stockMovement.create({
    data: outgoingMovementData(propertyA, token("restrict-movement-product"), {
      areaId: null,
    }),
  });

  await expectCompositeForeignKeyViolation(
    db.stockMovement.update({
      where: { id: movement.id },
      data: { propertyId: propertyB.property.id },
    }),
    "StockMovement_propertyId_productId_fkey",
  );

  const [persistedMovement, persistedProduct] = await Promise.all([
    db.stockMovement.findUniqueOrThrow({ where: { id: movement.id } }),
    db.stockProduct.findUniqueOrThrow({ where: { id: propertyA.product.id } }),
  ]);

  assert.equal(persistedMovement.propertyId, propertyA.property.id);
  assert.equal(persistedMovement.productId, propertyA.product.id);
  assert.equal(persistedProduct.propertyId, propertyA.property.id);
});

test("grafo completo dentro da mesma Property continua válido", async () => {
  const scenario = await createScenario("grafo-válido");
  const areaAliasName = token("valid-area-alias");
  const productAliasName = token("valid-product-alias");

  const areaAlias = await db.areaAlias.create({
    data: {
      id: token("valid-area-alias-id"),
      propertyId: scenario.property.id,
      areaId: scenario.area.id,
      name: areaAliasName,
      normalizedName: areaAliasName.toLocaleLowerCase("pt-BR"),
    },
  });
  const productAlias = await db.productAlias.create({
    data: {
      id: token("valid-product-alias-id"),
      propertyId: scenario.property.id,
      productId: scenario.product.id,
      name: productAliasName,
      normalizedName: productAliasName.toLocaleLowerCase("pt-BR"),
    },
  });
  const record = await createScopedFarmRecord(scenario, "grafo-válido");
  const original = await db.stockMovement.create({
    data: outgoingMovementData(scenario, token("valid-original"), {
      farmRecordId: record.id,
    }),
  });
  const reversal = await db.stockMovement.create({
    data: reversalMovementData(
      scenario,
      token("valid-reversal"),
      original.id,
      record.id,
    ),
  });

  const [
    persistedAreaAlias,
    persistedProductAlias,
    persistedRecord,
    persistedOriginal,
    persistedReversal,
  ] = await Promise.all([
    db.areaAlias.findUniqueOrThrow({ where: { id: areaAlias.id } }),
    db.productAlias.findUniqueOrThrow({ where: { id: productAlias.id } }),
    db.farmRecord.findUniqueOrThrow({ where: { id: record.id } }),
    db.stockMovement.findUniqueOrThrow({ where: { id: original.id } }),
    db.stockMovement.findUniqueOrThrow({ where: { id: reversal.id } }),
  ]);

  assert.equal(persistedAreaAlias.propertyId, scenario.property.id);
  assert.equal(persistedAreaAlias.areaId, scenario.area.id);
  assert.equal(persistedProductAlias.propertyId, scenario.property.id);
  assert.equal(persistedProductAlias.productId, scenario.product.id);
  assert.equal(persistedRecord.propertyId, scenario.property.id);
  assert.equal(persistedRecord.areaId, scenario.area.id);
  assert.equal(persistedRecord.productId, scenario.product.id);
  assert.equal(persistedOriginal.propertyId, scenario.property.id);
  assert.equal(persistedOriginal.farmRecordId, record.id);
  assert.equal(persistedReversal.propertyId, scenario.property.id);
  assert.equal(persistedReversal.reversesMovementId, original.id);
  assert.equal(persistedReversal.farmRecordId, record.id);
});
