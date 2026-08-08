import "server-only";

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
import {
  requireTransactionalRuralWebCapability,
  type RuralWebAuthorization,
} from "@/services/autorizacao/rural-web-authorization";
import { fitsRuralDecimalStorage } from "@/services/rural/rural-decimal";
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

/**
 * Lista branca de metadados editáveis. `quantity` é deliberadamente ausente:
 * saldo pertence exclusivamente a StockMovement.
 */
export type UpdateStockProductCommand = {
  propertyId: string;
  productId: string;
  name: string;
  category: ProductCategory;
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
  actorUserId: string | null;
  source?: RecordSource;
};

export class StockProductDomainError extends Error {
  constructor(
    public readonly code:
      | "INVALID_PRODUCT"
      | "PROPERTY_NOT_FOUND"
      | "PRODUCT_NOT_FOUND"
      | "PRODUCT_ARCHIVED"
      | "WEB_ACTOR_REQUIRED"
      | "USER_NOT_ACTIVE_PROPERTY_MEMBER"
      | "PRODUCT_NAME_ALREADY_USED",
    message: string,
  ) {
    super(message);
    this.name = "StockProductDomainError";
  }
}

function optionalText(value: string | null | undefined) {
  return value?.trim() || null;
}

function requireWebActor(source: RecordSource, actorUserId: string | null) {
  if (
    source === RecordSource.WEB &&
    (typeof actorUserId !== "string" || !actorUserId.trim())
  ) {
    throw new StockProductDomainError(
      "WEB_ACTOR_REQUIRED",
      "Operações WEB exigem um usuário autenticado.",
    );
  }
}

function errorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  return typeof error.code === "string" ? error.code : undefined;
}

function databaseDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function editableProductSnapshot(
  product: Pick<
    StockProduct,
    | "name"
    | "category"
    | "unit"
    | "minimumStock"
    | "storageLocation"
    | "note"
    | "supplier"
    | "unitValue"
    | "expirationDate"
    | "batchNumber"
    | "purchaseDate"
    | "technicalNote"
  >,
) {
  return {
    name: product.name,
    category: product.category,
    unit: product.unit,
    minimumStock: product.minimumStock?.toString() ?? null,
    storageLocation: product.storageLocation,
    note: product.note,
    supplier: product.supplier,
    unitValue: product.unitValue?.toString() ?? null,
    expirationDate: databaseDate(product.expirationDate),
    batchNumber: product.batchNumber,
    purchaseDate: databaseDate(product.purchaseDate),
    technicalNote: product.technicalNote,
  };
}

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return Object.keys(after).filter((field) => before[field] !== after[field]);
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
    const normalized = (value ?? "").trim();
    if (!fitsRuralDecimalStorage(normalized, 18, 4)) {
      throw new Error("invalid");
    }
    const decimal = new Prisma.Decimal(normalized);
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
  authorization?: RuralWebAuthorization,
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
  requireWebActor(source, command.createdByUserId);

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
      if (source === RecordSource.WEB) {
        await requireTransactionalRuralWebCapability(
          transaction,
          authorization,
          {
            propertyId: command.propertyId,
            actorUserId: command.createdByUserId as string,
            capability: "CREATE_PRODUCT",
          },
        );
        if (initialQuantity.greaterThan(0)) {
          await requireTransactionalRuralWebCapability(
            transaction,
            authorization,
            {
              propertyId: command.propertyId,
              actorUserId: command.createdByUserId as string,
              capability: "ADJUST_STOCK",
            },
          );
        }
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
              ...alias,
            })),
          },
        },
      });

      if (initialQuantity.greaterThan(0)) {
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

export async function updateStockProduct(
  command: UpdateStockProductCommand,
  authorization?: RuralWebAuthorization,
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
  const minimumStock = decimalValue(
    command.minimumStock,
    "O estoque mínimo",
    true,
  );
  const unitValue = decimalValue(command.unitValue, "O valor unitário", true);
  const source = command.source ?? RecordSource.WEB;
  requireWebActor(source, command.actorUserId);

  try {
    return await db.$transaction(
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
            [command.actorUserId],
          );
        if (inactiveOrMissingMembers.length > 0) {
          throw new StockProductDomainError(
            "USER_NOT_ACTIVE_PROPERTY_MEMBER",
            "O usuário informado não está ativo nesta propriedade.",
          );
        }
        if (source === RecordSource.WEB) {
          await requireTransactionalRuralWebCapability(
            transaction,
            authorization,
            {
              propertyId: command.propertyId,
              actorUserId: command.actorUserId as string,
              capability: "EDIT_PRODUCT",
            },
          );
        }

        const current = await transaction.stockProduct.findFirst({
          where: { id: command.productId, propertyId: command.propertyId },
        });
        if (!current) {
          throw new StockProductDomainError(
            "PRODUCT_NOT_FOUND",
            "Produto não encontrado.",
          );
        }
        if (current.archivedAt !== null) {
          throw new StockProductDomainError(
            "PRODUCT_ARCHIVED",
            "Um produto arquivado não pode ser editado.",
          );
        }

        if (normalizedName !== current.normalizedName) {
          const [officialCollision, aliasCollision] = await Promise.all([
            transaction.stockProduct.findFirst({
              where: {
                propertyId: command.propertyId,
                normalizedName,
                id: { not: current.id },
              },
              select: { id: true },
            }),
            transaction.productAlias.findFirst({
              where: { propertyId: command.propertyId, normalizedName },
              select: { id: true },
            }),
          ]);
          if (officialCollision || aliasCollision) {
            throw new StockProductDomainError(
              "PRODUCT_NAME_ALREADY_USED",
              "O nome do produto já está em uso nesta propriedade.",
            );
          }
        }

        const beforeData = editableProductSnapshot(current);
        // O objeto abaixo é a única mutação cadastral permitida e nunca inclui
        // `quantity`, ainda que um chamador JavaScript acrescente esse campo.
        const nextData = {
          name,
          normalizedName,
          category: command.category,
          unit,
          minimumStock,
          storageLocation: optionalText(command.storageLocation),
          note: optionalText(command.note),
          supplier: optionalText(command.supplier),
          unitValue,
          expirationDate: command.expirationDate ?? null,
          batchNumber: optionalText(command.batchNumber),
          purchaseDate: command.purchaseDate ?? null,
          technicalNote: optionalText(command.technicalNote),
        };
        const comparableAfter = {
          name: nextData.name,
          category: nextData.category,
          unit: nextData.unit,
          minimumStock: nextData.minimumStock?.toString() ?? null,
          storageLocation: nextData.storageLocation,
          note: nextData.note,
          supplier: nextData.supplier,
          unitValue: nextData.unitValue?.toString() ?? null,
          expirationDate: databaseDate(nextData.expirationDate),
          batchNumber: nextData.batchNumber,
          purchaseDate: databaseDate(nextData.purchaseDate),
          technicalNote: nextData.technicalNote,
        };
        const fields = changedFields(beforeData, comparableAfter);
        if (fields.length === 0) return current;

        const product = await transaction.stockProduct.update({
          where: {
            propertyId_id: {
              propertyId: command.propertyId,
              id: current.id,
            },
          },
          data: nextData,
        });
        const afterData = editableProductSnapshot(product);

        await writeAuditLog(transaction, {
          propertyId: command.propertyId,
          actorUserId: command.actorUserId,
          action: "STOCK_PRODUCT_UPDATED",
          entityType: "StockProduct",
          entityId: product.id,
          source,
          beforeData,
          afterData,
          metadata: { changedFields: fields },
        });

        return product;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (errorCode(error) === "P2002") {
      throw new StockProductDomainError(
        "PRODUCT_NAME_ALREADY_USED",
        "O nome do produto já está em uso nesta propriedade.",
      );
    }
    throw error;
  }
}
