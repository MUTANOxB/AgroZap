import "server-only";

import {
  AreaType,
  Prisma,
  RecordSource,
  type Area,
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

export type CreateAreaCommand = {
  propertyId: string;
  name: string;
  type: AreaType;
  size?: string | null;
  sizeUnit?: string | null;
  note?: string | null;
  currentCrop?: string | null;
  harvest?: string | null;
  soilType?: string | null;
  irrigation?: string | null;
  estimatedProductivity?: string | null;
  productivityUnit?: string | null;
  aliases?: string[];
  createdByUserId: string | null;
  source?: RecordSource;
};

export type UpdateAreaCommand = {
  propertyId: string;
  areaId: string;
  name: string;
  type: AreaType;
  size?: string | null;
  sizeUnit?: string | null;
  note?: string | null;
  currentCrop?: string | null;
  harvest?: string | null;
  soilType?: string | null;
  irrigation?: string | null;
  estimatedProductivity?: string | null;
  productivityUnit?: string | null;
  actorUserId: string | null;
  source?: RecordSource;
};

export class AreaDomainError extends Error {
  constructor(
    public readonly code:
      | "INVALID_AREA"
      | "PROPERTY_NOT_FOUND"
      | "AREA_NOT_FOUND"
      | "AREA_ARCHIVED"
      | "WEB_ACTOR_REQUIRED"
      | "USER_NOT_ACTIVE_PROPERTY_MEMBER"
      | "AREA_NAME_ALREADY_USED",
    message: string,
  ) {
    super(message);
    this.name = "AreaDomainError";
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
    throw new AreaDomainError(
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

function editableAreaSnapshot(
  area: Pick<
    Area,
    | "name"
    | "type"
    | "size"
    | "sizeUnit"
    | "note"
    | "currentCrop"
    | "harvest"
    | "soilType"
    | "irrigation"
    | "estimatedProductivity"
    | "productivityUnit"
  >,
) {
  return {
    name: area.name,
    type: area.type,
    size: area.size?.toString() ?? null,
    sizeUnit: area.sizeUnit,
    note: area.note,
    currentCrop: area.currentCrop,
    harvest: area.harvest,
    soilType: area.soilType,
    irrigation: area.irrigation,
    estimatedProductivity: area.estimatedProductivity?.toString() ?? null,
    productivityUnit: area.productivityUnit,
  };
}

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return Object.keys(after).filter((field) => before[field] !== after[field]);
}

function optionalDecimal(value: string | null | undefined, label: string) {
  if (value === null || value === undefined || value.trim() === "") return null;

  try {
    const normalized = value.trim();
    if (!fitsRuralDecimalStorage(normalized, 14, 4)) {
      throw new Error("invalid");
    }
    const decimal = new Prisma.Decimal(normalized);
    if (!decimal.isFinite() || decimal.isNegative()) throw new Error("invalid");
    return decimal;
  } catch {
    throw new AreaDomainError(
      "INVALID_AREA",
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

export function createArea(
  command: CreateAreaCommand,
  authorization?: RuralWebAuthorization,
): Promise<Area> {
  const name = command.name.trim();
  if (!name) {
    throw new AreaDomainError("INVALID_AREA", "Informe o nome da área.");
  }

  const normalizedName = normalizeLookupName(name);
  const aliases = prepareAliases(command.aliases, name);
  const size = optionalDecimal(command.size, "O tamanho");
  const estimatedProductivity = optionalDecimal(
    command.estimatedProductivity,
    "A produtividade estimada",
  );
  const source = command.source ?? RecordSource.WEB;
  requireWebActor(source, command.createdByUserId);

  return db.$transaction(
    async (transaction) => {
      const property = await transaction.property.findFirst({
        where: { id: command.propertyId, archivedAt: null },
        select: { id: true },
      });
      if (!property) {
        throw new AreaDomainError(
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
        throw new AreaDomainError(
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
            capability: "CREATE_AREA",
          },
        );
      }
      const candidateNames = [normalizedName, ...aliases.map((alias) => alias.normalizedName)];
      const [officialCollision, aliasCollision] = await Promise.all([
        transaction.area.findFirst({
          where: {
            propertyId: command.propertyId,
            normalizedName: { in: candidateNames },
          },
          select: { id: true },
        }),
        transaction.areaAlias.findFirst({
          where: {
            propertyId: command.propertyId,
            normalizedName: { in: candidateNames },
          },
          select: { id: true },
        }),
      ]);
      if (officialCollision || aliasCollision) {
        throw new AreaDomainError(
          "AREA_NAME_ALREADY_USED",
          "O nome ou um apelido da área já está em uso nesta propriedade.",
        );
      }

      const area = await transaction.area.create({
        data: {
          propertyId: command.propertyId,
          name,
          normalizedName,
          type: command.type,
          size,
          sizeUnit: command.sizeUnit?.trim() || null,
          note: command.note?.trim() || null,
          currentCrop: command.currentCrop?.trim() || null,
          harvest: command.harvest?.trim() || null,
          soilType: command.soilType?.trim() || null,
          irrigation: command.irrigation?.trim() || null,
          estimatedProductivity,
          productivityUnit: command.productivityUnit?.trim() || null,
          aliases: {
            create: aliases.map((alias) => ({
              ...alias,
            })),
          },
        },
      });

      await writeAuditLog(transaction, {
        propertyId: command.propertyId,
        actorUserId: command.createdByUserId,
        action: "AREA_CREATED",
        entityType: "Area",
        entityId: area.id,
        source,
        afterData: {
          name: area.name,
          type: area.type,
          size: area.size?.toString() ?? null,
          sizeUnit: area.sizeUnit,
        },
        metadata: { aliases: aliases.map((alias) => alias.name) },
      });

      return area;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function updateArea(
  command: UpdateAreaCommand,
  authorization?: RuralWebAuthorization,
): Promise<Area> {
  const name = command.name.trim();
  if (!name) {
    throw new AreaDomainError("INVALID_AREA", "Informe o nome da área.");
  }

  const normalizedName = normalizeLookupName(name);
  const size = optionalDecimal(command.size, "O tamanho");
  const estimatedProductivity = optionalDecimal(
    command.estimatedProductivity,
    "A produtividade estimada",
  );
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
          throw new AreaDomainError(
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
          throw new AreaDomainError(
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
              capability: "EDIT_AREA",
            },
          );
        }

        const current = await transaction.area.findFirst({
          where: { id: command.areaId, propertyId: command.propertyId },
        });
        if (!current) {
          throw new AreaDomainError("AREA_NOT_FOUND", "Área não encontrada.");
        }
        if (current.archivedAt !== null) {
          throw new AreaDomainError(
            "AREA_ARCHIVED",
            "Uma área arquivada não pode ser editada.",
          );
        }

        if (normalizedName !== current.normalizedName) {
          const [officialCollision, aliasCollision] = await Promise.all([
            transaction.area.findFirst({
              where: {
                propertyId: command.propertyId,
                normalizedName,
                id: { not: current.id },
              },
              select: { id: true },
            }),
            transaction.areaAlias.findFirst({
              where: { propertyId: command.propertyId, normalizedName },
              select: { id: true },
            }),
          ]);
          if (officialCollision || aliasCollision) {
            throw new AreaDomainError(
              "AREA_NAME_ALREADY_USED",
              "O nome da área já está em uso nesta propriedade.",
            );
          }
        }

        const beforeData = editableAreaSnapshot(current);
        const nextData = {
          name,
          normalizedName,
          type: command.type,
          size,
          sizeUnit: optionalText(command.sizeUnit),
          note: optionalText(command.note),
          currentCrop: optionalText(command.currentCrop),
          harvest: optionalText(command.harvest),
          soilType: optionalText(command.soilType),
          irrigation: optionalText(command.irrigation),
          estimatedProductivity,
          productivityUnit: optionalText(command.productivityUnit),
        };
        const comparableAfter = {
          name: nextData.name,
          type: nextData.type,
          size: nextData.size?.toString() ?? null,
          sizeUnit: nextData.sizeUnit,
          note: nextData.note,
          currentCrop: nextData.currentCrop,
          harvest: nextData.harvest,
          soilType: nextData.soilType,
          irrigation: nextData.irrigation,
          estimatedProductivity:
            nextData.estimatedProductivity?.toString() ?? null,
          productivityUnit: nextData.productivityUnit,
        };
        const fields = changedFields(beforeData, comparableAfter);
        if (fields.length === 0) return current;

        const area = await transaction.area.update({
          where: {
            propertyId_id: {
              propertyId: command.propertyId,
              id: current.id,
            },
          },
          data: nextData,
        });
        const afterData = editableAreaSnapshot(area);

        await writeAuditLog(transaction, {
          propertyId: command.propertyId,
          actorUserId: command.actorUserId,
          action: "AREA_UPDATED",
          entityType: "Area",
          entityId: area.id,
          source,
          beforeData,
          afterData,
          metadata: { changedFields: fields },
        });

        return area;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (errorCode(error) === "P2002") {
      throw new AreaDomainError(
        "AREA_NAME_ALREADY_USED",
        "O nome da área já está em uso nesta propriedade.",
      );
    }
    throw error;
  }
}
