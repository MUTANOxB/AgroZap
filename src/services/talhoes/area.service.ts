import {
  AreaType,
  Prisma,
  RecordSource,
  type Area,
} from "@/generated/prisma/client";
import { normalizeLookupName } from "@/lib/normalize-name";
import { db } from "@/lib/prisma";
import { writeAuditLog } from "@/services/auditoria/audit-log.service";
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

export class AreaDomainError extends Error {
  constructor(
    public readonly code:
      | "INVALID_AREA"
      | "PROPERTY_NOT_FOUND"
      | "USER_NOT_ACTIVE_PROPERTY_MEMBER"
      | "AREA_NAME_ALREADY_USED",
    message: string,
  ) {
    super(message);
    this.name = "AreaDomainError";
  }
}

function optionalDecimal(value: string | null | undefined, label: string) {
  if (value === null || value === undefined || value.trim() === "") return null;

  try {
    const decimal = new Prisma.Decimal(value);
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

export function createArea(command: CreateAreaCommand): Promise<Area> {
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
              propertyId: command.propertyId,
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
