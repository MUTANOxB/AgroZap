import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AreaType,
  FarmRecordType,
  Prisma,
  PrismaClient,
  ProductCategory,
  PropertyRole,
  RecordSource,
  StockMovementType,
} from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não foi configurada para executar o seed.");
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
    .replace(/\s+/g, " ");
}

async function main() {
  const property = await db.property.upsert({
    where: { slug: "fazenda-demonstracao" },
    update: { name: "Fazenda de demonstração" },
    create: {
      name: "Fazenda de demonstração",
      slug: "fazenda-demonstracao",
    },
  });

  const users = await Promise.all([
    db.user.upsert({
      where: { phone: "+5500000000001" },
      update: { name: "João Demo" },
      create: { name: "João Demo", phone: "+5500000000001" },
    }),
    db.user.upsert({
      where: { phone: "+5500000000002" },
      update: { name: "Pedro Demo" },
      create: { name: "Pedro Demo", phone: "+5500000000002" },
    }),
    db.user.upsert({
      where: { phone: "+5500000000003" },
      update: { name: "Maria Demo" },
      create: { name: "Maria Demo", phone: "+5500000000003" },
    }),
  ]);
  const [owner, employee, manager] = users;

  await Promise.all([
    db.propertyMember.upsert({
      where: {
        propertyId_userId: { propertyId: property.id, userId: owner.id },
      },
      update: { role: PropertyRole.OWNER },
      create: {
        propertyId: property.id,
        userId: owner.id,
        role: PropertyRole.OWNER,
      },
    }),
    db.propertyMember.upsert({
      where: {
        propertyId_userId: { propertyId: property.id, userId: employee.id },
      },
      update: { role: PropertyRole.EMPLOYEE },
      create: {
        propertyId: property.id,
        userId: employee.id,
        role: PropertyRole.EMPLOYEE,
      },
    }),
    db.propertyMember.upsert({
      where: {
        propertyId_userId: { propertyId: property.id, userId: manager.id },
      },
      update: { role: PropertyRole.MANAGER },
      create: {
        propertyId: property.id,
        userId: manager.id,
        role: PropertyRole.MANAGER,
      },
    }),
  ]);

  const areaExamples = [
    {
      name: "Lavoura do milho",
      type: AreaType.FIELD,
      size: "8",
      sizeUnit: "hectares",
      note: "Roça do fundo, próxima ao galpão.",
      currentCrop: "Milho",
      aliases: ["roça do fundo", "milho de baixo"],
    },
    {
      name: "Pasto 2",
      type: AreaType.PASTURE,
      size: "3",
      sizeUnit: "alqueires",
      note: "Área com bebedouro e sombra.",
      currentCrop: null,
      aliases: ["pasto do bebedouro"],
    },
    {
      name: "Horta principal",
      type: AreaType.VEGETABLE_GARDEN,
      size: "450",
      sizeUnit: "m²",
      note: "Local com irrigação.",
      currentCrop: "Hortaliças",
      aliases: ["horta irrigada"],
    },
  ];
  const areas = [];

  for (const example of areaExamples) {
    const normalizedName = normalizeName(example.name);
    const area = await db.area.upsert({
      where: {
        propertyId_normalizedName: {
          propertyId: property.id,
          normalizedName,
        },
      },
      update: {
        name: example.name,
        type: example.type,
        size: new Prisma.Decimal(example.size),
        sizeUnit: example.sizeUnit,
        note: example.note,
        currentCrop: example.currentCrop,
      },
      create: {
        propertyId: property.id,
        name: example.name,
        normalizedName,
        type: example.type,
        size: new Prisma.Decimal(example.size),
        sizeUnit: example.sizeUnit,
        note: example.note,
        currentCrop: example.currentCrop,
      },
    });
    areas.push(area);

    for (const aliasName of example.aliases) {
      const normalizedAlias = normalizeName(aliasName);
      await db.areaAlias.upsert({
        where: {
          propertyId_normalizedName: {
            propertyId: property.id,
            normalizedName: normalizedAlias,
          },
        },
        update: { areaId: area.id, name: aliasName },
        create: {
          propertyId: property.id,
          areaId: area.id,
          name: aliasName,
          normalizedName: normalizedAlias,
        },
      });
    }
  }

  const productExamples = [
    {
      name: "Semente de soja",
      category: ProductCategory.SEED,
      quantity: "3450",
      unit: "kg",
      minimumStock: "500",
      storageLocation: "Barracão principal",
      note: "Safra 2025/26",
      aliases: ["semente soja"],
    },
    {
      name: "Adubo NPK",
      category: ProductCategory.FERTILIZER,
      quantity: "1280",
      unit: "kg",
      minimumStock: "300",
      storageLocation: "Depósito de insumos",
      note: "Uso geral na propriedade",
      aliases: ["npk", "adubo da lavoura"],
    },
    {
      name: "Produto para controle de mato",
      category: ProductCategory.PESTICIDE,
      quantity: "86",
      unit: "litros",
      minimumStock: "100",
      storageLocation: "Depósito de defensivos",
      note: "Estoque abaixo do mínimo",
      aliases: ["veneno do mato", "herbicida"],
    },
    {
      name: "Óleo diesel",
      category: ProductCategory.FUEL,
      quantity: "620",
      unit: "litros",
      minimumStock: "700",
      storageLocation: "Tanque da propriedade",
      note: "Usado em máquinas e tratores",
      aliases: ["diesel"],
    },
  ];
  const products = [];

  for (const example of productExamples) {
    const normalizedName = normalizeName(example.name);
    const existing = await db.stockProduct.findUnique({
      where: {
        propertyId_normalizedName: {
          propertyId: property.id,
          normalizedName,
        },
      },
    });

    const product = existing ?? (await db.$transaction(async (transaction) => {
      const createdProduct = await transaction.stockProduct.create({
        data: {
          propertyId: property.id,
          name: example.name,
          normalizedName,
          category: example.category,
          quantity: new Prisma.Decimal(0),
          unit: example.unit,
          minimumStock: new Prisma.Decimal(example.minimumStock),
          storageLocation: example.storageLocation,
          note: example.note,
        },
      });
      const openingQuantity = new Prisma.Decimal(example.quantity);
      const updatedProduct = await transaction.stockProduct.update({
        where: { id: createdProduct.id },
        data: { quantity: openingQuantity },
      });
      const movement = await transaction.stockMovement.create({
        data: {
          propertyId: property.id,
          productId: createdProduct.id,
          type: StockMovementType.ADJUSTMENT,
          quantityChange: openingQuantity,
          productNameSnapshot: createdProduct.name,
          unitSnapshot: example.unit,
          balanceBefore: new Prisma.Decimal(0),
          balanceAfter: openingQuantity,
          source: RecordSource.SYSTEM,
          reason: "Saldo inicial criado pelo seed",
        },
      });
      await transaction.auditLog.create({
        data: {
          propertyId: property.id,
          action: "STOCK_OPENING_BALANCE_CREATED",
          entityType: "StockMovement",
          entityId: movement.id,
          source: RecordSource.SYSTEM,
          beforeData: { quantity: "0" },
          afterData: { quantity: openingQuantity.toString() },
          metadata: { productId: createdProduct.id, seed: true },
        },
      });
      return updatedProduct;
    }));
    products.push(product);

    for (const aliasName of example.aliases) {
      const normalizedAlias = normalizeName(aliasName);
      await db.productAlias.upsert({
        where: {
          propertyId_normalizedName: {
            propertyId: property.id,
            normalizedName: normalizedAlias,
          },
        },
        update: { productId: product.id, name: aliasName },
        create: {
          propertyId: property.id,
          productId: product.id,
          name: aliasName,
          normalizedName: normalizedAlias,
        },
      });
    }
  }

  const recordExamples = [
    {
      type: FarmRecordType.SPRAYING,
      description: "Aplicação de produto para controle de pragas.",
      occurredAt: new Date("2026-06-18T12:00:00.000Z"),
      areaId: areas[0].id,
      productId: products[2].id,
      createdByUserId: owner.id,
      performedByUserId: employee.id,
    },
    {
      type: FarmRecordType.NOTE,
      description: "Porteira do pasto precisa de manutenção.",
      occurredAt: new Date("2026-06-17T12:00:00.000Z"),
      areaId: areas[1].id,
      productId: null,
      createdByUserId: manager.id,
      performedByUserId: null,
    },
    {
      type: FarmRecordType.INSPECTION,
      description: "Vistoria da irrigação da horta concluída.",
      occurredAt: new Date("2026-06-15T12:00:00.000Z"),
      areaId: areas[2].id,
      productId: null,
      createdByUserId: owner.id,
      performedByUserId: manager.id,
    },
  ];

  for (const example of recordExamples) {
    const area = areas.find((candidate) => candidate.id === example.areaId);
    const product = example.productId
      ? products.find((candidate) => candidate.id === example.productId)
      : null;

    if (!area || (example.productId && !product)) {
      throw new Error("Não foi possível resolver os snapshots do seed.");
    }

    const existingRecord = await db.farmRecord.findFirst({
      where: {
        propertyId: property.id,
        description: example.description,
        occurredAt: example.occurredAt,
      },
      select: { id: true },
    });
    if (existingRecord) continue;

    await db.$transaction(async (transaction) => {
      const record = await transaction.farmRecord.create({
        data: {
          propertyId: property.id,
          areaId: example.areaId,
          productId: example.productId,
          createdByUserId: example.createdByUserId,
          performedByUserId: example.performedByUserId,
          type: example.type,
          description: example.description,
          occurredAt: example.occurredAt,
          productNameSnapshot: product?.name ?? null,
          areaNameSnapshot: area.name,
          source: RecordSource.SYSTEM,
        },
      });
      await transaction.auditLog.create({
        data: {
          propertyId: property.id,
          actorUserId: example.createdByUserId,
          action: "FARM_RECORD_CREATED",
          entityType: "FarmRecord",
          entityId: record.id,
          source: RecordSource.SYSTEM,
          afterData: {
            type: record.type,
            description: record.description,
            occurredAt: record.occurredAt.toISOString(),
          },
          metadata: {
            performedByUserId: example.performedByUserId,
            seed: true,
          },
        },
      });
    });
  }

  console.log("Dados de demonstração do AgroZap preparados com sucesso.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
