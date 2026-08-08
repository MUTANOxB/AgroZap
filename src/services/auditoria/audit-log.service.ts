import "server-only";

import { Prisma, type RecordSource } from "@/generated/prisma/client";

export type AuditLogInput = {
  propertyId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  source: RecordSource;
  beforeData?: Prisma.InputJsonValue;
  afterData?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Recebe a transação já aberta para que a auditoria seja confirmada ou
 * desfeita junto com a operação de negócio que ela descreve.
 */
export function writeAuditLog(
  transaction: Prisma.TransactionClient,
  input: AuditLogInput,
) {
  return transaction.auditLog.create({
    data: {
      propertyId: input.propertyId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      source: input.source,
      beforeData: input.beforeData,
      afterData: input.afterData,
      metadata: input.metadata,
    },
  });
}
