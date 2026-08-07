import {
  Prisma,
  ProductCategory,
  RecordSource,
  StockMovementType,
  type StockProduct,
} from "@/generated/prisma/client";
import { normalizeLookupName } from "@/lib/normalize-name";
import { db } from "@/lib/prisma";
import { writeAuditLog } from "@/services/auditoria/audit-log.service";
import { findUserIdsWithoutActivePropertyMembership } from "@/services/usuarios/property-membership";

export type CreateStockProductCommand = {
  propertyId: string;
  name: string;
  category: ProductCategory;
  initialQuantity: string;
  unit: string;
  minimumStock?: string | null;
  storageLocation?: string | null;
  note?: string | null;
  supplier?: string | null;
  unitValue?: string | null;
  expirationDate?: Date | null;
  batchNumber?: string | null;
  purchaseDate?: Date | null;
  technicalNote?: string | null;
  aliases?: string[];
  createdByUserId: string | null;
  source?: RecordSource;
};

export class StockProductDomainError extends Error {
  constructor(
    public readonly code:
      | "INVALID_PRODUCT"
      | "PROPERTY_NOT_FOUND"
      | "USER_NOT_ACTIVE_PROPERTY_MEMBER"
      | "PRODUCT_NAME_ALREADY_USED",
    message: string,
  ) {
    super(message);
    this.name = "StockProductDomainError";
  }
}

function decimalValue(value: string, label: string, optional?: false): Prisma.Decimal;
function decimalValue(
  value: string | null | undefined,
  label: string,
  optional: true,
): Prisma.Decimal | null;
function decimalValue(
  value: string | null | undefined,
  label: string,
  optional = false,
): Prisma.Decimal | null {
  if (optional && (value === null || value === undefined || value.trim() === "")) {
    return null;
  }

  try {
    const decimal = new Prisma.Decimal(value ?? "");
    if (!decimal.isFinite() || decimal.isNegative()) throw new Error("invalid");
    return decimal;
  } catch {
    throw new StockProductDomainError(
      "INVALID_PRODUCT",
      `${label} deve ser um número igual ou maior que zero.`,
    );
  }
}

function prepareAliases(aliases: string[] | undefined, officialName: string) {
  const normalizedOfficialName = normalizeLookupName(officialName);
  const uniqueAliases = new Map<string, string>();

  for (const alias of aliases ?? []) {
    const name = alias.trim();
    const normalizedName = normalizeLookupName(name);
    if (!name || normalizedName === normalizedOfficialName) continue;
    uniqueAliases.set(normalizedName, name);
  }

  return [...uniqueAliases].map(([normalizedName, name]) => ({
    name,
    normalizedName,
  }));
}

export function createStockProduct(
  command: CreateStockProductCommand,
): Promise<StockProduct> {
  const name = command.name.trim();
  const unit = command.unit.trim();
  if (!name || !unit) {
    throw new StockProductDomainError(
      "INVALID_PRODUCT",
      "Informe o nome e a unidade do produto.",
    );
  }

  const normalizedName = normalizeLookupName(name);
  const initialQuantity = decimalValue(
    command.initialQuantity,
    "A quantidade inicial",
  );
  const minimumStock = decimalValue(
    command.minimumStock,
    "O estoque mínimo",
    true,
  );
  const unitValue = decimalValue(command.unitValue, "O valor unitário", true);
  const aliases = prepareAliases(command.aliases, name);
  const source = command.source ?? RecordSource.WEB;

  return db.$transaction(
    async (transaction) => {
      const property = await transaction.property.findFirst({
        where: { id: command.propertyId, archivedAt: null },
        select: { id: true },
      });
      if (!property) {
        throw new StockProductDomainError(
          "PROPERTY_NOT_FOUND",
          "Propriedade não encontrada.",
        );
      }

      const inactiveOrMissingMembers =
        await findUserIdsWithoutActivePropertyMembership(
        transaction,
        command.propertyId,
        [command.createdByUserId],
      );
      if (inactiveOrMissingMembers.length > 0) {
        throw new StockProductDomainError(
          "USER_NOT_ACTIVE_PROPERTY_MEMBER",
          "O usuário informado não está ativo nesta propriedade.",
        );
      }

      const candidateNames = [normalizedName, ...aliases.map((alias) => alias.normalizedName)];
      const [officialCollision, aliasCollision] = await Promise.all([
        transaction.stockProduct.findFirst({
          where: {
            propertyId: command.propertyId,
            normalizedName: { in: candidateNames },
          },
          select: { id: true },
        }),
        transaction.productAlias.findFirst({
          where: {
            propertyId: command.propertyId,
            normalizedName: { in: candidateNames },
          },
          select: { id: true },
        }),
      ]);
      if (officialCollision || aliasCollision) {
        throw new StockProductDomainError(
          "PRODUCT_NAME_ALREADY_USED",
          "O nome ou um apelido do produto já está em uso nesta propriedade.",
        );
      }

      let product = await transaction.stockProduct.create({
        data: {
          propertyId: command.propertyId,
          name,
          normalizedName,
          category: command.category,
          quantity: new Prisma.Decimal(0),
          unit,
          minimumStock,
          storageLocation: command.storageLocation?.trim() || null,
          note: command.note?.trim() || null,
          supplier: command.supplier?.trim() || null,
          unitValue,
          expirationDate: command.expirationDate,
          batchNumber: command.batchNumber?.trim() || null,
          purchaseDate: command.purchaseDate,
          technicalNote: command.technicalNote?.trim() || null,
          aliases: {
            create: aliases.map((alias) => ({
              propertyId: command.propertyId,
              ...alias,
            })),
          },
        },
      });

      if (initialQuantity.isPositive()) {
        product = await transaction.stockProduct.update({
          where: { id: product.id },
          data: { quantity: initialQuantity },
        });
        const openingMovement = await transaction.stockMovement.create({
          data: {
            propertyId: command.propertyId,
            productId: product.id,
            type: StockMovementType.ADJUSTMENT,
            quantityChange: initialQuantity,
            productNameSnapshot: product.name,
            unitSnapshot: product.unit,
            balanceBefore: new Prisma.Decimal(0),
            balanceAfter: initialQuantity,
            createdByUserId: command.createdByUserId,
            source,
            reason: "Saldo inicial do produto",
          },
        });

        await writeAuditLog(transaction, {
          propertyId: command.propertyId,
          actorUserId: command.createdByUserId,
          action: "STOCK_OPENING_BALANCE_CREATED",
          entityType: "StockMovement",
          entityId: openingMovement.id,
          source,
          beforeData: { quantity: "0" },
          afterData: { quantity: initialQuantity.toString() },
          metadata: { productId: product.id },
        });
      }

      await writeAuditLog(transaction, {
        propertyId: command.propertyId,
        actorUserId: command.createdByUserId,
        action: "STOCK_PRODUCT_CREATED",
        entityType: "StockProduct",
        entityId: product.id,
        source,
        afterData: {
          name: product.name,
          category: product.category,
          quantity: product.quantity.toString(),
          unit: product.unit,
        },
        metadata: { aliases: aliases.map((alias) => alias.name) },
      });

      return product;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
