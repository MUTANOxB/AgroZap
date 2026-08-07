import { createHash, randomUUID } from "node:crypto";
import {
  AreaType,
  Prisma,
  ProductCategory,
  PropertyRole,
} from "@/generated/prisma/client";
import { db } from "@/lib/prisma";

function fixtureToken() {
  return randomUUID().replaceAll("-", "");
}

function phoneFor(token: string, index: number) {
  const hash = createHash("sha256").update(`${token}:${index}`).digest("hex");
  const digits = [...hash]
    .map((character) => Number.parseInt(character, 16) % 10)
    .join("")
    .slice(0, 11);
  return `+55${digits}`;
}

export async function createTenant(userCount = 1) {
  const token = fixtureToken();
  const property = await db.property.create({
    data: {
      name: `Propriedade ${token}`,
      slug: `integration-${token}`,
    },
  });
  const users = await Promise.all(
    Array.from({ length: userCount }, (_, index) =>
      db.user.create({
        data: {
          name: `Usuário ${index + 1} ${token}`,
          phone: phoneFor(token, index),
        },
      }),
    ),
  );

  await db.propertyMember.createMany({
    data: users.map((user, index) => ({
      propertyId: property.id,
      userId: user.id,
      role: index === 0 ? PropertyRole.OWNER : PropertyRole.EMPLOYEE,
    })),
  });

  return { property, token, users };
}

type ScenarioOptions = {
  areaName?: string;
  productName?: string;
  quantity?: string;
  userCount?: number;
};

export async function createStockScenario(options: ScenarioOptions = {}) {
  const tenant = await createTenant(options.userCount ?? 1);
  const productName = options.productName ?? "Produto de integração";
  const product = await db.stockProduct.create({
    data: {
      propertyId: tenant.property.id,
      name: productName,
      normalizedName: productName.toLocaleLowerCase("pt-BR"),
      category: ProductCategory.PESTICIDE,
      quantity: new Prisma.Decimal(options.quantity ?? "10"),
      unit: "L",
    },
  });
  const area = options.areaName
    ? await db.area.create({
        data: {
          propertyId: tenant.property.id,
          name: options.areaName,
          normalizedName: options.areaName.toLocaleLowerCase("pt-BR"),
          type: AreaType.FIELD,
        },
      })
    : null;

  return { ...tenant, area, product };
}
