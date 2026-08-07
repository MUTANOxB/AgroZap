import {
  FarmRecordType,
  Prisma,
  RecordSource,
  type FarmRecord,
} from "@/generated/prisma/client";
import { db } from "@/lib/prisma";
import { writeAuditLog } from "@/services/auditoria/audit-log.service";
import { findMissingPropertyMemberIds } from "@/services/usuarios/property-membership";

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
  productNameSnapshot?: string | null;
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
      | "USER_NOT_PROPERTY_MEMBER",
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

export function createFarmRecord(
  command: CreateFarmRecordCommand,
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

  return db.$transaction(async (transaction) => {
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

    const missingMembers = await findMissingPropertyMemberIds(
      transaction,
      command.propertyId,
      [command.createdByUserId, command.performedByUserId],
    );
    if (missingMembers.length > 0) {
      throw new FarmRecordDomainError(
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
        throw new FarmRecordDomainError(
          "RELATED_ENTITY_NOT_FOUND",
          "A área informada não pertence a esta propriedade.",
        );
      }
    }

    if (command.productId) {
      const product = await transaction.stockProduct.findFirst({
        where: {
          id: command.productId,
          propertyId: command.propertyId,
          archivedAt: null,
        },
        select: { id: true },
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
        productNameSnapshot: command.productNameSnapshot?.trim() || null,
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
  });
}
