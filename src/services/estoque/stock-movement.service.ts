import {
  Prisma,
  RecordSource,
  StockMovementType,
  type StockMovement,
} from "@/generated/prisma/client";
import { db } from "@/lib/prisma";
import { writeAuditLog } from "@/services/auditoria/audit-log.service";
import { findMissingPropertyMemberIds } from "@/services/usuarios/property-membership";
import { StockDomainError } from "./errors";

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

export type ReverseStockMovementCommand = {
  propertyId: string;
  movementId: string;
  createdByUserId: string | null;
  performedByUserId?: string | null;
  source?: RecordSource;
  reason: string;
  occurredAt?: Date;
};

class RetryStockTransactionError extends Error {}

function errorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  return typeof error.code === "string" ? error.code : undefined;
}

function shouldRetry(error: unknown) {
  return error instanceof RetryStockTransactionError || errorCode(error) === "P2034";
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
    const decimal = new Prisma.Decimal(value);
    if (!decimal.isFinite()) throw new Error("not finite");
    return decimal;
  } catch {
    throw new StockDomainError(
      "INVALID_QUANTITY",
      `${fieldLabel} deve ser um número válido.`,
    );
  }
}

async function assertMovementScope(
  transaction: Prisma.TransactionClient,
  command: MovementContext,
) {
  const product = await transaction.stockProduct.findFirst({
    where: {
      id: command.productId,
      propertyId: command.propertyId,
      archivedAt: null,
    },
  });

  if (!product) {
    throw new StockDomainError("PRODUCT_NOT_FOUND", "Produto não encontrado.");
  }

  const missingMemberIds = await findMissingPropertyMemberIds(
    transaction,
    command.propertyId,
    [command.createdByUserId, command.performedByUserId],
  );

  if (missingMemberIds.length > 0) {
    throw new StockDomainError(
      "USER_NOT_PROPERTY_MEMBER",
      "O usuário informado não pertence a esta propriedade.",
    );
  }

  if (command.areaId) {
    const area = await transaction.area.findFirst({
      where: {
        id: command.areaId,
        propertyId: command.propertyId,
        archivedAt: null,
      },
      select: { id: true },
    });
    if (!area) {
      throw new StockDomainError(
        "RELATED_ENTITY_NOT_FOUND",
        "A área informada não pertence a esta propriedade.",
      );
    }
  }

  if (command.farmRecordId) {
    const farmRecord = await transaction.farmRecord.findFirst({
      where: {
        id: command.farmRecordId,
        propertyId: command.propertyId,
      },
      select: { id: true },
    });
    if (!farmRecord) {
      throw new StockDomainError(
        "RELATED_ENTITY_NOT_FOUND",
        "A anotação informada não pertence a esta propriedade.",
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
  if (!amount.isPositive()) {
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

export function registerStockMovement(command: RegisterStockMovementCommand) {
  return runStockTransaction(async (transaction) => {
    const product = await assertMovementScope(transaction, command);
    const balanceBefore = product.quantity;
    const { quantityChange, balanceAfter } = calculateMovement(
      command,
      balanceBefore,
    );
    const source = command.source ?? RecordSource.WEB;

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
        movementType: movement.type,
        quantityChange: quantityChange.toString(),
        performedByUserId: command.performedByUserId ?? null,
      },
    });

    return movement;
  });
}

export async function reverseStockMovement(
  command: ReverseStockMovementCommand,
): Promise<StockMovement> {
  const reason = command.reason.trim();
  if (!reason) {
    throw new StockDomainError(
      "INVALID_REVERSAL",
      "Informe o motivo da reversão.",
    );
  }

  try {
    return await runStockTransaction(async (transaction) => {
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
        where: { reversesMovementId: original.id },
        select: { id: true },
      });
      if (existingReversal) {
        throw new StockDomainError(
          "MOVEMENT_ALREADY_REVERSED",
          "Esta movimentação já foi revertida.",
        );
      }

      const scope: MovementContext = {
        propertyId: command.propertyId,
        productId: original.productId,
        areaId: original.areaId,
        farmRecordId: original.farmRecordId,
        createdByUserId: command.createdByUserId,
        performedByUserId: command.performedByUserId,
      };
      const product = await assertMovementScope(transaction, scope);
      const balanceBefore = product.quantity;
      const quantityChange = original.quantityChange.negated();
      const balanceAfter = balanceBefore.plus(quantityChange);

      if (balanceAfter.isNegative()) {
        throw new StockDomainError("INSUFFICIENT_STOCK", "Estoque insuficiente.");
      }

      await updateBalanceOptimistically(
        transaction,
        product.id,
        command.propertyId,
        balanceBefore,
        balanceAfter,
      );

      const source = command.source ?? RecordSource.WEB;
      const reversal = await transaction.stockMovement.create({
        data: {
          propertyId: command.propertyId,
          productId: original.productId,
          areaId: original.areaId,
          farmRecordId: original.farmRecordId,
          type: StockMovementType.REVERSAL,
          quantityChange,
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
          quantityChange: quantityChange.toString(),
          reversedMovementId: original.id,
          performedByUserId: command.performedByUserId ?? null,
        },
      });

      return reversal;
    });
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
