import "server-only";

import {
  Prisma,
  RecordSource,
  StockMovementType,
  type FarmRecord,
  type StockMovement,
} from "@/generated/prisma/client";
import { db } from "@/lib/prisma";
import { writeAuditLog } from "@/services/auditoria/audit-log.service";
import {
  requireTransactionalRuralWebCapability,
  type RuralWebAuthorization,
} from "@/services/autorizacao/rural-web-authorization";
import {
  createFarmRecordInTransaction,
  type CreateFarmRecordCommand,
} from "@/services/registros/farm-record.service";
import { fitsRuralDecimalStorage } from "@/services/rural/rural-decimal";
import { findUserIdsWithoutActivePropertyMembership } from "@/services/usuarios/property-membership";
import { StockDomainError } from "./errors";
import {
  requireActivePropertyForNewStockMovement,
  requireExistingPropertyForStockReversal,
} from "./property-operation-policy";

const MAX_TRANSACTION_ATTEMPTS = 4;

type MovementContext = {
  propertyId: string;
  productId: string;
  areaId?: string | null;
  farmRecordId?: string | null;
  createdByUserId: string | null;
  performedByUserId?: string | null;
  source?: RecordSource;
  reason?: string;
  occurredAt?: Date;
};

export type RegisterStockMovementCommand = MovementContext &
  (
    | {
        type: typeof StockMovementType.IN | typeof StockMovementType.OUT;
        amount: string;
      }
    | {
        type: typeof StockMovementType.ADJUSTMENT;
        newBalance: string;
        reason: string;
      }
  );

export type AdjustStockCommand = {
  propertyId: string;
  productId: string;
  targetQuantity: string;
  reason: string;
  actorUserId: string | null;
  source?: RecordSource;
};

export type ReverseStockMovementCommand = {
  propertyId: string;
  movementId: string;
  createdByUserId: string | null;
  performedByUserId?: string | null;
  source?: RecordSource;
  reason: string;
  occurredAt?: Date;
};

export type CreateFarmRecordWithStockMovementCommand = {
  farmRecord: CreateFarmRecordCommand;
  stockMovement:
    | {
        type: typeof StockMovementType.IN | typeof StockMovementType.OUT;
        amount: string;
        reason?: string;
        occurredAt?: Date;
      }
    | {
        type: typeof StockMovementType.ADJUSTMENT;
        newBalance: string;
        reason: string;
        occurredAt?: Date;
      };
};

export type FarmRecordWithStockMovement = {
  farmRecord: FarmRecord;
  stockMovement: StockMovement;
};

class RetryStockTransactionError extends Error {}

function errorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  return typeof error.code === "string" ? error.code : undefined;
}

function containsTransactionConflict(error: unknown) {
  const candidates: unknown[] = [error];
  const visited = new Set<object>();

  while (candidates.length > 0) {
    const candidate = candidates.shift();
    if (typeof candidate !== "object" || candidate === null) continue;
    if (visited.has(candidate)) continue;
    visited.add(candidate);

    const record = candidate as Record<string, unknown>;
    if (
      record.code === "P2034" ||
      record.code === "40001" ||
      record.originalCode === "40001" ||
      record.kind === "TransactionWriteConflict"
    ) {
      return true;
    }

    for (const key of ["cause", "meta", "driverAdapterError"]) {
      if (record[key] !== undefined) candidates.push(record[key]);
    }
  }

  return false;
}

function shouldRetry(error: unknown) {
  return (
    error instanceof RetryStockTransactionError ||
    containsTransactionConflict(error)
  );
}

async function runStockTransaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (shouldRetry(error) && attempt < MAX_TRANSACTION_ATTEMPTS) continue;
      if (shouldRetry(error)) {
        throw new StockDomainError(
          "CONCURRENCY_CONFLICT",
          "O estoque mudou ao mesmo tempo. Tente novamente.",
        );
      }
      throw error;
    }
  }

  throw new StockDomainError(
    "CONCURRENCY_CONFLICT",
    "O estoque mudou ao mesmo tempo. Tente novamente.",
  );
}

function parseDecimal(value: string, fieldLabel: string) {
  try {
    const normalized = value.trim();
    if (!fitsRuralDecimalStorage(normalized, 18, 4)) {
      throw new Error("not storable");
    }
    const decimal = new Prisma.Decimal(normalized);
    if (!decimal.isFinite()) throw new Error("not finite");
    return decimal;
  } catch {
    throw new StockDomainError(
      "INVALID_QUANTITY",
      `${fieldLabel} deve ser um número válido.`,
    );
  }
}

function requireWebActor(
  source: RecordSource,
  createdByUserId: string | null,
) {
  if (
    source === RecordSource.WEB &&
    (typeof createdByUserId !== "string" || !createdByUserId.trim())
  ) {
    throw new StockDomainError(
      "WEB_ACTOR_REQUIRED",
      "Operações WEB exigem um usuário autenticado.",
    );
  }
}

function requireStorableStockDecimal(
  value: Prisma.Decimal,
  fieldLabel: string,
) {
  if (!fitsRuralDecimalStorage(value.toString(), 18, 4)) {
    throw new StockDomainError(
      "INVALID_QUANTITY",
      `${fieldLabel} excede o limite de 14 dígitos inteiros e 4 casas decimais.`,
    );
  }
}

function assertFarmRecordMatchesMovement(
  farmRecord: Pick<FarmRecord, "productId" | "areaId">,
  productId: string,
  areaId: string | null,
) {
  if (farmRecord.productId === null) {
    throw new StockDomainError(
      "FARM_RECORD_MOVEMENT_MISMATCH",
      "A anotação vinculada precisa possuir um produto.",
    );
  }
  if (farmRecord.productId !== productId) {
    throw new StockDomainError(
      "FARM_RECORD_MOVEMENT_MISMATCH",
      "O produto da movimentação deve ser o mesmo da anotação vinculada.",
    );
  }
  if (farmRecord.areaId !== areaId) {
    throw new StockDomainError(
      "FARM_RECORD_MOVEMENT_MISMATCH",
      "A área da movimentação deve ser a mesma da anotação vinculada.",
    );
  }
}

async function assertActivePropertyUsers(
  transaction: Prisma.TransactionClient,
  propertyId: string,
  userIds: Array<string | null | undefined>,
) {
  const inactiveOrMissingUserIds =
    await findUserIdsWithoutActivePropertyMembership(
      transaction,
      propertyId,
      userIds,
    );

  if (inactiveOrMissingUserIds.length > 0) {
    throw new StockDomainError(
      "USER_NOT_ACTIVE_PROPERTY_MEMBER",
      "O usuário informado não está ativo nesta propriedade.",
    );
  }
}

async function assertNewMovementScope(
  transaction: Prisma.TransactionClient,
  command: MovementContext,
) {
  const property = await transaction.property.findUnique({
    where: { id: command.propertyId },
    select: { id: true, archivedAt: true },
  });
  requireActivePropertyForNewStockMovement(property);

  const product = await transaction.stockProduct.findFirst({
    where: {
      id: command.productId,
      propertyId: command.propertyId,
    },
  });

  if (!product) {
    throw new StockDomainError("PRODUCT_NOT_FOUND", "Produto não encontrado.");
  }
  if (product.archivedAt !== null) {
    throw new StockDomainError(
      "PRODUCT_ARCHIVED",
      "Um produto arquivado não pode receber novos movimentos de estoque.",
    );
  }

  await assertActivePropertyUsers(
    transaction,
    command.propertyId,
    [command.createdByUserId, command.performedByUserId],
  );

  const areaId = command.areaId ?? null;
  let areaNameSnapshot: string | null = null;
  if (areaId !== null) {
    const area = await transaction.area.findFirst({
      where: {
        id: areaId,
        propertyId: command.propertyId,
        archivedAt: null,
      },
      select: { id: true, name: true },
    });
    if (!area) {
      throw new StockDomainError(
        "RELATED_ENTITY_NOT_FOUND",
        "A área informada não pertence a esta propriedade.",
      );
    }
    areaNameSnapshot = area.name;
  }

  const farmRecordId = command.farmRecordId ?? null;
  if (farmRecordId !== null) {
    const farmRecord = await transaction.farmRecord.findFirst({
      where: {
        id: farmRecordId,
        propertyId: command.propertyId,
      },
      select: { id: true, productId: true, areaId: true },
    });
    if (!farmRecord) {
      throw new StockDomainError(
        "RELATED_ENTITY_NOT_FOUND",
        "A anotação informada não pertence a esta propriedade.",
      );
    }
    assertFarmRecordMatchesMovement(
      farmRecord,
      product.id,
      areaId,
    );
  }

  return { product, areaNameSnapshot };
}

async function assertHistoricalReversalScope(
  transaction: Prisma.TransactionClient,
  command: ReverseStockMovementCommand,
  original: Pick<StockMovement, "productId" | "areaId" | "farmRecordId">,
) {
  await assertActivePropertyUsers(
    transaction,
    command.propertyId,
    [command.createdByUserId, command.performedByUserId],
  );

  const product = await transaction.stockProduct.findFirst({
    where: {
      id: original.productId,
      propertyId: command.propertyId,
    },
  });
  if (!product) {
    throw new StockDomainError(
      "PRODUCT_NOT_FOUND",
      "O produto da movimentação original não foi encontrado nesta propriedade.",
    );
  }

  if (original.areaId !== null) {
    const area = await transaction.area.findFirst({
      where: {
        id: original.areaId,
        propertyId: command.propertyId,
      },
      select: { id: true },
    });
    if (!area) {
      throw new StockDomainError(
        "RELATED_ENTITY_NOT_FOUND",
        "A área da movimentação original não foi encontrada nesta propriedade.",
      );
    }
  }

  if (original.farmRecordId !== null) {
    const farmRecord = await transaction.farmRecord.findFirst({
      where: {
        id: original.farmRecordId,
        propertyId: command.propertyId,
      },
      select: { id: true },
    });
    if (!farmRecord) {
      throw new StockDomainError(
        "RELATED_ENTITY_NOT_FOUND",
        "A anotação da movimentação original não foi encontrada nesta propriedade.",
      );
    }
  }

  return product;
}

function calculateMovement(
  command: RegisterStockMovementCommand,
  balanceBefore: Prisma.Decimal,
) {
  if (command.type === StockMovementType.ADJUSTMENT) {
    const balanceAfter = parseDecimal(command.newBalance, "O novo saldo");
    if (balanceAfter.isNegative()) {
      throw new StockDomainError(
        "INVALID_QUANTITY",
        "O novo saldo não pode ser negativo.",
      );
    }

    const quantityChange = balanceAfter.minus(balanceBefore);
    if (quantityChange.isZero()) {
      throw new StockDomainError(
        "INVALID_QUANTITY",
        "O ajuste precisa alterar o saldo atual.",
      );
    }

    return { quantityChange, balanceAfter };
  }

  const amount = parseDecimal(command.amount, "A quantidade");
  if (!amount.greaterThan(0)) {
    throw new StockDomainError(
      "INVALID_QUANTITY",
      "A quantidade movimentada deve ser maior que zero.",
    );
  }

  const quantityChange =
    command.type === StockMovementType.IN ? amount : amount.negated();
  const balanceAfter = balanceBefore.plus(quantityChange);

  if (balanceAfter.isNegative()) {
    throw new StockDomainError("INSUFFICIENT_STOCK", "Estoque insuficiente.");
  }
  requireStorableStockDecimal(balanceAfter, "O saldo resultante");

  return { quantityChange, balanceAfter };
}

async function updateBalanceOptimistically(
  transaction: Prisma.TransactionClient,
  productId: string,
  propertyId: string,
  balanceBefore: Prisma.Decimal,
  balanceAfter: Prisma.Decimal,
) {
  const result = await transaction.stockProduct.updateMany({
    where: {
      id: productId,
      propertyId,
      quantity: balanceBefore,
    },
    data: { quantity: balanceAfter },
  });

  if (result.count !== 1) throw new RetryStockTransactionError();
}

async function registerStockMovementInTransaction(
  transaction: Prisma.TransactionClient,
  command: RegisterStockMovementCommand,
  authorization?: RuralWebAuthorization,
): Promise<StockMovement> {
  const source = command.source ?? RecordSource.WEB;
  requireWebActor(source, command.createdByUserId);
  if (
    command.type === StockMovementType.ADJUSTMENT &&
    (typeof command.reason !== "string" || !command.reason.trim())
  ) {
    throw new StockDomainError(
      "INVALID_ADJUSTMENT",
      "Informe o motivo do ajuste de estoque.",
    );
  }

  const { product, areaNameSnapshot } = await assertNewMovementScope(
    transaction,
    command,
  );
  if (source === RecordSource.WEB) {
    await requireTransactionalRuralWebCapability(
      transaction,
      authorization,
      {
        propertyId: command.propertyId,
        actorUserId: command.createdByUserId as string,
        capability:
          command.type === StockMovementType.ADJUSTMENT
            ? "ADJUST_STOCK"
            : "MOVE_STOCK",
      },
    );
  }
  const balanceBefore = product.quantity;
  const { quantityChange, balanceAfter } = calculateMovement(
    command,
    balanceBefore,
  );

  await updateBalanceOptimistically(
    transaction,
    product.id,
    command.propertyId,
    balanceBefore,
    balanceAfter,
  );

  const movement = await transaction.stockMovement.create({
    data: {
      propertyId: command.propertyId,
      productId: product.id,
      areaId: command.areaId ?? null,
      farmRecordId: command.farmRecordId ?? null,
      type: command.type,
      quantityChange,
      productNameSnapshot: product.name,
      areaNameSnapshot,
      unitSnapshot: product.unit,
      balanceBefore,
      balanceAfter,
      createdByUserId: command.createdByUserId,
      performedByUserId: command.performedByUserId ?? null,
      source,
      reason: command.reason?.trim() || null,
      occurredAt: command.occurredAt,
    },
  });

  await writeAuditLog(transaction, {
    propertyId: command.propertyId,
    actorUserId: command.createdByUserId,
    action: "STOCK_MOVEMENT_CREATED",
    entityType: "StockMovement",
    entityId: movement.id,
    source,
    beforeData: { quantity: balanceBefore.toString() },
    afterData: { quantity: balanceAfter.toString() },
    metadata: {
      productId: product.id,
      areaId: movement.areaId,
      farmRecordId: movement.farmRecordId,
      movementType: movement.type,
      quantityChange: quantityChange.toString(),
      performedByUserId: command.performedByUserId ?? null,
    },
  });

  return movement;
}

export function registerStockMovement(
  command: RegisterStockMovementCommand,
  authorization?: RuralWebAuthorization,
) {
  return runStockTransaction((transaction) =>
    registerStockMovementInTransaction(transaction, command, authorization),
  );
}

/**
 * Operação explícita de saldo-alvo. Reutiliza a única semântica ADJUSTMENT do
 * domínio: o delta é calculado no servidor a partir do saldo transacional.
 */
export function adjustStock(
  command: AdjustStockCommand,
  authorization?: RuralWebAuthorization,
) {
  return registerStockMovement(
    {
      propertyId: command.propertyId,
      productId: command.productId,
      type: StockMovementType.ADJUSTMENT,
      newBalance: command.targetQuantity,
      reason: command.reason,
      createdByUserId: command.actorUserId,
      source: command.source,
    },
    authorization,
  );
}

export function createFarmRecordWithStockMovement(
  command: CreateFarmRecordWithStockMovementCommand,
  authorization?: RuralWebAuthorization,
): Promise<FarmRecordWithStockMovement> {
  return runStockTransaction(async (transaction) => {
    const farmRecord = await createFarmRecordInTransaction(
      transaction,
      command.farmRecord,
      authorization,
    );
    if (farmRecord.productId === null) {
      throw new StockDomainError(
        "FARM_RECORD_MOVEMENT_MISMATCH",
        "Uma anotação com movimentação de estoque precisa possuir um produto.",
      );
    }

    const movementContext = {
      propertyId: farmRecord.propertyId,
      productId: farmRecord.productId,
      areaId: farmRecord.areaId,
      farmRecordId: farmRecord.id,
      createdByUserId: farmRecord.createdByUserId,
      performedByUserId: farmRecord.performedByUserId,
      source: farmRecord.source,
      occurredAt:
        command.stockMovement.occurredAt ?? farmRecord.occurredAt,
    };
    const movementCommand: RegisterStockMovementCommand =
      command.stockMovement.type === StockMovementType.ADJUSTMENT
        ? {
            ...movementContext,
            type: command.stockMovement.type,
            newBalance: command.stockMovement.newBalance,
            reason: command.stockMovement.reason,
          }
        : {
            ...movementContext,
            type: command.stockMovement.type,
            amount: command.stockMovement.amount,
            reason: command.stockMovement.reason,
          };
    const stockMovement = await registerStockMovementInTransaction(
      transaction,
      movementCommand,
      authorization,
    );

    return { farmRecord, stockMovement };
  });
}

async function reverseStockMovementInTransaction(
  transaction: Prisma.TransactionClient,
  command: ReverseStockMovementCommand,
  authorization?: RuralWebAuthorization,
): Promise<StockMovement> {
  const reason = command.reason.trim();
  if (!reason) {
    throw new StockDomainError(
      "INVALID_REVERSAL",
      "Informe o motivo da reversão.",
    );
  }
  const source = command.source ?? RecordSource.WEB;
  requireWebActor(source, command.createdByUserId);

  const property = await transaction.property.findUnique({
    where: { id: command.propertyId },
    select: { id: true, archivedAt: true },
  });
  requireExistingPropertyForStockReversal(property);

  const original = await transaction.stockMovement.findFirst({
    where: {
      id: command.movementId,
      propertyId: command.propertyId,
    },
  });

  if (!original) {
    throw new StockDomainError(
      "MOVEMENT_NOT_FOUND",
      "Movimentação não encontrada.",
    );
  }
  if (original.type === StockMovementType.REVERSAL) {
    throw new StockDomainError(
      "INVALID_REVERSAL",
      "Uma reversão não pode ser revertida diretamente.",
    );
  }

  const existingReversal = await transaction.stockMovement.findUnique({
    where: {
      propertyId_reversesMovementId: {
        propertyId: command.propertyId,
        reversesMovementId: original.id,
      },
    },
    select: { id: true },
  });
  if (existingReversal) {
    throw new StockDomainError(
      "MOVEMENT_ALREADY_REVERSED",
      "Esta movimentação já foi revertida.",
    );
  }

  const product = await assertHistoricalReversalScope(
    transaction,
    command,
    original,
  );
  if (source === RecordSource.WEB) {
    await requireTransactionalRuralWebCapability(
      transaction,
      authorization,
      {
        propertyId: command.propertyId,
        actorUserId: command.createdByUserId as string,
        capability: "REVERSE_STOCK",
      },
    );
  }
  const balanceBefore = product.quantity;
  const quantityChange = original.quantityChange.negated();
  const balanceAfter = balanceBefore.plus(quantityChange);

  if (balanceAfter.isNegative()) {
    throw new StockDomainError("INSUFFICIENT_STOCK", "Estoque insuficiente.");
  }
  requireStorableStockDecimal(balanceAfter, "O saldo resultante");

  await updateBalanceOptimistically(
    transaction,
    product.id,
    command.propertyId,
    balanceBefore,
    balanceAfter,
  );

  const reversal = await transaction.stockMovement.create({
    data: {
      propertyId: command.propertyId,
      productId: original.productId,
      areaId: original.areaId,
      farmRecordId: original.farmRecordId,
      type: StockMovementType.REVERSAL,
      quantityChange,
      productNameSnapshot: original.productNameSnapshot,
      areaNameSnapshot: original.areaNameSnapshot,
      unitSnapshot: original.unitSnapshot,
      balanceBefore,
      balanceAfter,
      createdByUserId: command.createdByUserId,
      performedByUserId: command.performedByUserId ?? null,
      source,
      reason,
      occurredAt: command.occurredAt,
      reversesMovementId: original.id,
    },
  });

  await writeAuditLog(transaction, {
    propertyId: command.propertyId,
    actorUserId: command.createdByUserId,
    action: "STOCK_MOVEMENT_REVERSED",
    entityType: "StockMovement",
    entityId: reversal.id,
    source,
    beforeData: { quantity: balanceBefore.toString() },
    afterData: { quantity: balanceAfter.toString() },
    metadata: {
      productId: product.id,
      areaId: reversal.areaId,
      farmRecordId: reversal.farmRecordId,
      quantityChange: quantityChange.toString(),
      reversedMovementId: original.id,
      performedByUserId: command.performedByUserId ?? null,
    },
  });

  return reversal;
}

export async function reverseStockMovement(
  command: ReverseStockMovementCommand,
  authorization?: RuralWebAuthorization,
): Promise<StockMovement> {
  try {
    return await runStockTransaction((transaction) =>
      reverseStockMovementInTransaction(transaction, command, authorization),
    );
  } catch (error) {
    if (errorCode(error) === "P2002") {
      throw new StockDomainError(
        "MOVEMENT_ALREADY_REVERSED",
        "Esta movimentação já foi revertida.",
      );
    }
    throw error;
  }
}
