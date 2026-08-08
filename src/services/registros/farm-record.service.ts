import "server-only";

import {
  FarmRecordType,
  Prisma,
  RecordSource,
  type FarmRecord,
} from "@/generated/prisma/client";
import { db } from "@/lib/prisma";
import { writeAuditLog } from "@/services/auditoria/audit-log.service";
import {
  requireTransactionalRuralWebCapability,
  type RuralWebAuthorization,
} from "@/services/autorizacao/rural-web-authorization";
import { findUserIdsWithoutActivePropertyMembership } from "@/services/usuarios/property-membership";

export type CreateFarmRecordCommand = {
  propertyId: string;
  areaId?: string | null;
  productId?: string | null;
  createdByUserId: string | null;
  performedByUserId?: string | null;
  type: FarmRecordType;
  description: string;
  locationDescription?: string | null;
  occurredAt?: Date;
  quantity?: string | null;
  quantityUnit?: string | null;
  value?: string | null;
  responsibleName?: string | null;
  appliedDose?: string | null;
  doseUnit?: string | null;
  harvest?: string | null;
  supplier?: string | null;
  productBatch?: string | null;
  technicalNote?: string | null;
  source?: RecordSource;
};

export class FarmRecordDomainError extends Error {
  constructor(
    public readonly code:
      | "INVALID_RECORD"
      | "PROPERTY_NOT_FOUND"
      | "RELATED_ENTITY_NOT_FOUND"
      | "WEB_ACTOR_REQUIRED"
      | "USER_NOT_ACTIVE_PROPERTY_MEMBER",
    message: string,
  ) {
    super(message);
    this.name = "FarmRecordDomainError";
  }
}

function optionalNonNegativeDecimal(
  value: string | null | undefined,
  label: string,
) {
  if (value === null || value === undefined || value.trim() === "") return null;

  try {
    const decimal = new Prisma.Decimal(value);
    if (!decimal.isFinite() || decimal.isNegative()) throw new Error("invalid");
    return decimal;
  } catch {
    throw new FarmRecordDomainError(
      "INVALID_RECORD",
      `${label} deve ser um número igual ou maior que zero.`,
    );
  }
}

export async function createFarmRecordInTransaction(
  transaction: Prisma.TransactionClient,
  command: CreateFarmRecordCommand,
  authorization?: RuralWebAuthorization,
): Promise<FarmRecord> {
  const description = command.description.trim();
  if (!description) {
    throw new FarmRecordDomainError(
      "INVALID_RECORD",
      "Informe a descrição da anotação.",
    );
  }

  const quantity = optionalNonNegativeDecimal(command.quantity, "A quantidade");
  const value = optionalNonNegativeDecimal(command.value, "O valor");
  const appliedDose = optionalNonNegativeDecimal(command.appliedDose, "A dose");
  const source = command.source ?? RecordSource.WEB;
  if (
    source === RecordSource.WEB &&
    (typeof command.createdByUserId !== "string" ||
      !command.createdByUserId.trim())
  ) {
    throw new FarmRecordDomainError(
      "WEB_ACTOR_REQUIRED",
      "Operações WEB exigem um usuário autenticado.",
    );
  }

  const property = await transaction.property.findFirst({
    where: { id: command.propertyId, archivedAt: null },
    select: { id: true },
  });
  if (!property) {
    throw new FarmRecordDomainError(
      "PROPERTY_NOT_FOUND",
      "Propriedade não encontrada.",
    );
  }

  const inactiveOrMissingMembers =
    await findUserIdsWithoutActivePropertyMembership(
      transaction,
      command.propertyId,
      [command.createdByUserId, command.performedByUserId],
    );
  if (inactiveOrMissingMembers.length > 0) {
    throw new FarmRecordDomainError(
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
        capability: "CREATE_RECORD",
      },
    );
  }
  let area: { id: string; name: string } | null = null;
  if (command.areaId) {
    area = await transaction.area.findFirst({
      where: {
        id: command.areaId,
        propertyId: command.propertyId,
        archivedAt: null,
      },
      select: { id: true, name: true },
    });
    if (!area) {
      throw new FarmRecordDomainError(
        "RELATED_ENTITY_NOT_FOUND",
        "A área informada não pertence a esta propriedade.",
      );
    }
  }

  let product: { id: string; name: string } | null = null;
  if (command.productId) {
    product = await transaction.stockProduct.findFirst({
      where: {
        id: command.productId,
        propertyId: command.propertyId,
        archivedAt: null,
      },
      select: { id: true, name: true },
    });
    if (!product) {
      throw new FarmRecordDomainError(
        "RELATED_ENTITY_NOT_FOUND",
        "O produto informado não pertence a esta propriedade.",
      );
    }
  }

  const record = await transaction.farmRecord.create({
    data: {
      propertyId: command.propertyId,
      areaId: command.areaId ?? null,
      productId: command.productId ?? null,
      createdByUserId: command.createdByUserId,
      performedByUserId: command.performedByUserId ?? null,
      type: command.type,
      description,
      locationDescription: command.locationDescription?.trim() || null,
      occurredAt: command.occurredAt,
      quantity,
      quantityUnit: command.quantityUnit?.trim() || null,
      value,
      responsibleName: command.responsibleName?.trim() || null,
      productNameSnapshot: product?.name ?? null,
      areaNameSnapshot: area?.name ?? null,
      appliedDose,
      doseUnit: command.doseUnit?.trim() || null,
      harvest: command.harvest?.trim() || null,
      supplier: command.supplier?.trim() || null,
      productBatch: command.productBatch?.trim() || null,
      technicalNote: command.technicalNote?.trim() || null,
      source,
    },
  });

  await writeAuditLog(transaction, {
    propertyId: command.propertyId,
    actorUserId: command.createdByUserId,
    action: "FARM_RECORD_CREATED",
    entityType: "FarmRecord",
    entityId: record.id,
    source,
    afterData: {
      type: record.type,
      description: record.description,
      occurredAt: record.occurredAt.toISOString(),
      areaId: record.areaId,
      productId: record.productId,
    },
    metadata: {
      performedByUserId: command.performedByUserId ?? null,
    },
  });

  return record;
}

export function createFarmRecord(
  command: CreateFarmRecordCommand,
  authorization?: RuralWebAuthorization,
): Promise<FarmRecord> {
  return db.$transaction((transaction) =>
    createFarmRecordInTransaction(transaction, command, authorization),
  );
}
