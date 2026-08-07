import "server-only";

import {
  Prisma,
  PropertyRole,
  RecordSource,
  type PropertyMember,
} from "@/generated/prisma/client";
import { db } from "@/lib/prisma";
import {
  authorizeMemberAddition,
  authorizeMemberRemoval,
  authorizeMemberRoleChange,
  type TeamPolicyDecision,
} from "@/services/autorizacao/property-role-policy";
import { writeAuditLog } from "@/services/auditoria/audit-log.service";
import {
  InvalidPhoneError,
  normalizePhone,
} from "@/services/auth/phone";
import { TeamDomainError } from "./errors";

const MAX_TRANSACTION_ATTEMPTS = 4;

type TeamMutationContext = {
  propertyId: string;
  actorUserId: string;
  source?: RecordSource;
};

export type AddExistingMemberCommand = TeamMutationContext & {
  phone: string;
  role: unknown;
};

export type ChangeMemberRoleCommand = TeamMutationContext & {
  targetUserId: string;
  newRole: unknown;
};

export type RemoveMemberCommand = TeamMutationContext & {
  targetUserId: string;
};

type TeamMemberBase = {
  membershipId: string;
  userId: string;
  name: string;
  role: PropertyRole;
  isActive: boolean;
};

export type PropertyTeamMember =
  | (TeamMemberBase & { phone: string })
  | TeamMemberBase;

export type RemovedPropertyMember = Pick<
  PropertyMember,
  "id" | "propertyId" | "userId" | "role"
>;

class RetryTeamTransactionError extends Error {}

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
  return error instanceof RetryTeamTransactionError || containsTransactionConflict(error);
}

async function runTeamTransaction<T>(
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
        throw new TeamDomainError(
          "CONCURRENCY_CONFLICT",
          "A equipe mudou ao mesmo tempo. Tente novamente.",
        );
      }
      throw error;
    }
  }

  throw new TeamDomainError(
    "CONCURRENCY_CONFLICT",
    "A equipe mudou ao mesmo tempo. Tente novamente.",
  );
}

async function requireActorMembership(
  transaction: Prisma.TransactionClient,
  propertyId: string,
  actorUserId: string,
) {
  const actorMembership = await transaction.propertyMember.findFirst({
    where: {
      propertyId,
      userId: actorUserId,
      user: { deactivatedAt: null },
      property: { archivedAt: null },
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!actorMembership) {
    throw new TeamDomainError(
      "PROPERTY_ACCESS_DENIED",
      "Você não tem acesso à equipe desta propriedade.",
    );
  }
  return actorMembership;
}

async function findTargetMembership(
  transaction: Prisma.TransactionClient,
  propertyId: string,
  targetUserId: string,
) {
  const membership = await transaction.propertyMember.findUnique({
    where: {
      propertyId_userId: { propertyId, userId: targetUserId },
    },
    select: {
      id: true,
      propertyId: true,
      userId: true,
      role: true,
    },
  });
  if (!membership) {
    throw new TeamDomainError(
      "MEMBER_NOT_FOUND",
      "Membro não encontrado nesta propriedade.",
    );
  }
  return membership;
}

function requirePolicyPermission(decision: TeamPolicyDecision) {
  if (decision.allowed) return;

  if (decision.reason === "SELF_MANAGEMENT") {
    throw new TeamDomainError(
      "SELF_MANAGEMENT",
      "Você não pode alterar sua própria participação por esta tela.",
    );
  }
  if (decision.reason === "INVALID_ROLE") {
    throw new TeamDomainError("INVALID_ROLE", "O papel informado é inválido.");
  }
  if (decision.reason === "ROLE_UNCHANGED") {
    throw new TeamDomainError(
      "ROLE_UNCHANGED",
      "Escolha um papel diferente do atual.",
    );
  }
  throw new TeamDomainError(
    "FORBIDDEN",
    "Você não tem permissão para administrar esta participação.",
  );
}

function requirePolicyPermissionBeforeOwnerCheck(decision: TeamPolicyDecision) {
  if (
    decision.allowed ||
    decision.reason === "FORBIDDEN"
  ) {
    return;
  }
  requirePolicyPermission(decision);
}

async function assertOwnerWillRemain(
  transaction: Prisma.TransactionClient,
  propertyId: string,
  targetRole: PropertyRole,
  newRole?: PropertyRole,
) {
  if (
    targetRole !== PropertyRole.OWNER ||
    newRole === PropertyRole.OWNER
  ) {
    return;
  }

  const ownerCount = await transaction.propertyMember.count({
    where: { propertyId, role: PropertyRole.OWNER },
  });
  if (ownerCount <= 1) {
    throw new TeamDomainError(
      "LAST_OWNER",
      "A propriedade precisa manter pelo menos um proprietário.",
    );
  }
}

export async function listPropertyTeam(input: {
  propertyId: string;
  actorUserId: string;
}): Promise<PropertyTeamMember[]> {
  return db.$transaction(async (transaction) => {
    const actor = await requireActorMembership(
      transaction,
      input.propertyId,
      input.actorUserId,
    );
    const maySeePhone =
      actor.role === PropertyRole.OWNER || actor.role === PropertyRole.MANAGER;

    const memberships = await transaction.propertyMember.findMany({
      where: { propertyId: input.propertyId },
      select: {
        id: true,
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            phone: maySeePhone,
            deactivatedAt: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { user: { name: "asc" } }, { id: "asc" }],
    });

    return memberships.map((membership) => {
      const base: TeamMemberBase = {
        membershipId: membership.id,
        userId: membership.user.id,
        name: membership.user.name,
        role: membership.role,
        isActive: membership.user.deactivatedAt === null,
      };
      return maySeePhone
        ? { ...base, phone: membership.user.phone }
        : base;
    });
  });
}

export async function addExistingMember(
  command: AddExistingMemberCommand,
): Promise<PropertyMember> {
  let canonicalPhone: string;
  try {
    canonicalPhone = normalizePhone(command.phone);
  } catch (error) {
    if (error instanceof InvalidPhoneError) {
      throw new TeamDomainError("INVALID_PHONE", error.message);
    }
    throw error;
  }

  try {
    return await runTeamTransaction(async (transaction) => {
      const actor = await requireActorMembership(
        transaction,
        command.propertyId,
        command.actorUserId,
      );
      requirePolicyPermission(authorizeMemberAddition(actor.role, command.role));

      const targetUser = await transaction.user.findUnique({
        where: { phone: canonicalPhone },
        select: { id: true, deactivatedAt: true },
      });
      if (!targetUser) {
        throw new TeamDomainError(
          "USER_NOT_FOUND",
          "Usuário ainda não está cadastrado no AgroZap.",
        );
      }
      if (targetUser.deactivatedAt !== null) {
        throw new TeamDomainError(
          "USER_DEACTIVATED",
          "Este usuário está desativado no AgroZap.",
        );
      }

      const existingMembership = await transaction.propertyMember.findUnique({
        where: {
          propertyId_userId: {
            propertyId: command.propertyId,
            userId: targetUser.id,
          },
        },
        select: { id: true },
      });
      if (existingMembership) {
        throw new TeamDomainError(
          "ALREADY_MEMBER",
          "Este usuário já faz parte da propriedade.",
        );
      }

      if (typeof command.role !== "string") {
        throw new TeamDomainError("INVALID_ROLE", "O papel informado é inválido.");
      }
      const role = command.role as PropertyRole;
      const membership = await transaction.propertyMember.create({
        data: {
          propertyId: command.propertyId,
          userId: targetUser.id,
          role,
        },
      });

      await writeAuditLog(transaction, {
        propertyId: command.propertyId,
        actorUserId: command.actorUserId,
        action: "PROPERTY_MEMBER_ADDED",
        entityType: "PropertyMember",
        entityId: membership.id,
        source: command.source ?? RecordSource.WEB,
        afterData: { role },
        metadata: { targetUserId: targetUser.id },
      });
      return membership;
    });
  } catch (error) {
    if (errorCode(error) === "P2002") {
      throw new TeamDomainError(
        "ALREADY_MEMBER",
        "Este usuário já faz parte da propriedade.",
      );
    }
    throw error;
  }
}

export function changeMemberRole(
  command: ChangeMemberRoleCommand,
): Promise<PropertyMember> {
  return runTeamTransaction(async (transaction) => {
    const actor = await requireActorMembership(
      transaction,
      command.propertyId,
      command.actorUserId,
    );
    const target = await findTargetMembership(
      transaction,
      command.propertyId,
      command.targetUserId,
    );
    const decision = authorizeMemberRoleChange({
      actorUserId: command.actorUserId,
      actorRole: actor.role,
      targetUserId: target.userId,
      targetRole: target.role,
      newRole: command.newRole,
    });
    requirePolicyPermissionBeforeOwnerCheck(decision);

    if (typeof command.newRole !== "string") {
      throw new TeamDomainError("INVALID_ROLE", "O papel informado é inválido.");
    }
    const newRole = command.newRole as PropertyRole;
    await assertOwnerWillRemain(
      transaction,
      command.propertyId,
      target.role,
      newRole,
    );
    requirePolicyPermission(decision);

    const result = await transaction.propertyMember.updateMany({
      where: {
        id: target.id,
        propertyId: command.propertyId,
        role: target.role,
      },
      data: { role: newRole },
    });
    if (result.count !== 1) throw new RetryTeamTransactionError();

    await writeAuditLog(transaction, {
      propertyId: command.propertyId,
      actorUserId: command.actorUserId,
      action: "PROPERTY_MEMBER_ROLE_CHANGED",
      entityType: "PropertyMember",
      entityId: target.id,
      source: command.source ?? RecordSource.WEB,
      beforeData: { role: target.role },
      afterData: { role: newRole },
      metadata: { targetUserId: target.userId },
    });

    return transaction.propertyMember.findUniqueOrThrow({
      where: { id: target.id },
    });
  });
}

export function removeMember(
  command: RemoveMemberCommand,
): Promise<RemovedPropertyMember> {
  return runTeamTransaction(async (transaction) => {
    const actor = await requireActorMembership(
      transaction,
      command.propertyId,
      command.actorUserId,
    );
    const target = await findTargetMembership(
      transaction,
      command.propertyId,
      command.targetUserId,
    );
    const decision = authorizeMemberRemoval({
      actorUserId: command.actorUserId,
      actorRole: actor.role,
      targetUserId: target.userId,
      targetRole: target.role,
    });
    requirePolicyPermissionBeforeOwnerCheck(decision);
    await assertOwnerWillRemain(
      transaction,
      command.propertyId,
      target.role,
    );
    requirePolicyPermission(decision);

    const result = await transaction.propertyMember.deleteMany({
      where: {
        id: target.id,
        propertyId: command.propertyId,
        role: target.role,
      },
    });
    if (result.count !== 1) throw new RetryTeamTransactionError();

    await writeAuditLog(transaction, {
      propertyId: command.propertyId,
      actorUserId: command.actorUserId,
      action: "PROPERTY_MEMBER_REMOVED",
      entityType: "PropertyMember",
      entityId: target.id,
      source: command.source ?? RecordSource.WEB,
      beforeData: { role: target.role },
      metadata: { targetUserId: target.userId },
    });

    return target;
  });
}
