import "server-only";

import { db } from "@/lib/prisma";
import type { Capability } from "@/services/autorizacao/property-role-policy";
import { requirePropertyCapabilities } from "@/services/autorizacao/property-capability-guard";
import {
  toAreaDto,
  toAuditLogDto,
  toFarmRecordDto,
  toStockMovementDto,
  toStockProductDto,
  type AreaDto,
  type AuditLogDto,
  type CursorPage,
  type FarmRecordDto,
  type StockMovementDto,
  type StockProductDto,
} from "./rural-dtos";

export const DEFAULT_RURAL_PAGE_LIMIT = 25;
export const MAX_RURAL_PAGE_LIMIT = 100;
export const DASHBOARD_RECENT_FARM_RECORD_LIMIT = 5;
export const DASHBOARD_STOCK_OVERVIEW_LIMIT = 4;

export type RuralPageRequest = {
  cursor?: string | null;
  limit?: number;
};

export type RuralDashboardCountsDto = {
  activeAreas: number;
  farmRecords: number;
  activeProducts: number;
  lowStockProducts: number;
};

export type RuralDashboardSummaryDto = {
  counts: RuralDashboardCountsDto;
  recentFarmRecords: FarmRecordDto[];
  stockOverviewProducts: StockProductDto[];
};

export type RuralQueryErrorCode =
  | "INVALID_PROPERTY_SCOPE"
  | "INVALID_PAGE"
  | "INVALID_CURSOR"
  | "TEST_HARNESS_UNAVAILABLE";

export class RuralQueryError extends Error {
  constructor(
    public readonly code: RuralQueryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RuralQueryError";
  }
}

type CursorKind = "FARM_RECORD" | "STOCK_MOVEMENT" | "AUDIT_LOG";

type CursorPayload = {
  version: 1;
  kind: CursorKind;
  propertyId: string;
  at: string;
  id: string;
};

type DecodedCursor = {
  at: Date;
  id: string;
};

function requirePropertyId(propertyId: string) {
  if (
    typeof propertyId !== "string" ||
    !propertyId ||
    propertyId.trim() !== propertyId ||
    propertyId.length > 128
  ) {
    throw new RuralQueryError(
      "INVALID_PROPERTY_SCOPE",
      "O escopo da propriedade é inválido.",
    );
  }
}

function pageLimit(limit: number | undefined) {
  const resolved = limit ?? DEFAULT_RURAL_PAGE_LIMIT;
  if (
    !Number.isInteger(resolved) ||
    resolved < 1 ||
    resolved > MAX_RURAL_PAGE_LIMIT
  ) {
    throw new RuralQueryError(
      "INVALID_PAGE",
      `A página deve conter entre 1 e ${MAX_RURAL_PAGE_LIMIT} itens.`,
    );
  }
  return resolved;
}

function invalidCursor(): never {
  throw new RuralQueryError(
    "INVALID_CURSOR",
    "Não foi possível continuar esta paginação.",
  );
}

function encodeCursor(
  kind: CursorKind,
  propertyId: string,
  at: Date,
  id: string,
) {
  const payload: CursorPayload = {
    version: 1,
    kind,
    propertyId,
    at: at.toISOString(),
    id,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(
  cursor: string | null | undefined,
  expectedKind: CursorKind,
  propertyId: string,
): DecodedCursor | null {
  if (cursor === null || cursor === undefined) return null;
  if (
    typeof cursor !== "string" ||
    !cursor ||
    cursor.length > 1024 ||
    !/^[A-Za-z0-9_-]+$/.test(cursor)
  ) {
    return invalidCursor();
  }

  try {
    const payload = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as Partial<CursorPayload>;
    if (
      payload.version !== 1 ||
      payload.kind !== expectedKind ||
      payload.propertyId !== propertyId ||
      typeof payload.at !== "string" ||
      typeof payload.id !== "string" ||
      !payload.id ||
      payload.id.length > 128
    ) {
      return invalidCursor();
    }

    const at = new Date(payload.at);
    if (Number.isNaN(at.getTime()) || at.toISOString() !== payload.at) {
      return invalidCursor();
    }
    return { at, id: payload.id };
  } catch {
    return invalidCursor();
  }
}

async function requireCurrentProperty(
  capabilities: readonly Capability[],
) {
  // O import fica restrito ao wrapper autenticado. As funções tenant-scoped
  // abaixo continuam testáveis em Node sem inicializar o runtime de navegação
  // do Next.js, mas permanecem protegidas por `server-only`.
  const { requireActivePropertyContext } = await import(
    "@/services/propriedades/active-property-context"
  );
  const context = await requireActivePropertyContext();
  requirePropertyCapabilities(context.role, capabilities);
  return context.property.id;
}

/** @internal Entrada testável; fronteiras WEB devem usar o wrapper sem ID. */
async function listActiveAreasByPropertyId(
  propertyId: string,
): Promise<AreaDto[]> {
  requirePropertyId(propertyId);
  const areas = await db.area.findMany({
    where: { propertyId, archivedAt: null },
    select: {
      id: true,
      name: true,
      type: true,
      size: true,
      sizeUnit: true,
      note: true,
      currentCrop: true,
      harvest: true,
      soilType: true,
      irrigation: true,
      estimatedProductivity: true,
      productivityUnit: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return areas.map(toAreaDto);
}

/** @internal Entrada testável; fronteiras WEB devem usar o wrapper sem ID. */
async function listActiveProductsByPropertyId(
  propertyId: string,
): Promise<StockProductDto[]> {
  requirePropertyId(propertyId);
  const products = await db.stockProduct.findMany({
    where: { propertyId, archivedAt: null },
    select: {
      id: true,
      name: true,
      category: true,
      quantity: true,
      unit: true,
      minimumStock: true,
      storageLocation: true,
      note: true,
      supplier: true,
      unitValue: true,
      expirationDate: true,
      batchNumber: true,
      purchaseDate: true,
      technicalNote: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return products.map(toStockProductDto);
}

/** @internal Entrada testável; fronteiras WEB devem usar o wrapper sem ID. */
async function listFarmRecordsByPropertyId(
  propertyId: string,
  page: RuralPageRequest = {},
): Promise<CursorPage<FarmRecordDto>> {
  requirePropertyId(propertyId);
  const limit = pageLimit(page.limit);
  const cursor = decodeCursor(page.cursor, "FARM_RECORD", propertyId);

  if (cursor) {
    const anchor = await db.farmRecord.findFirst({
      where: { propertyId, id: cursor.id, occurredAt: cursor.at },
      select: { id: true },
    });
    if (!anchor) invalidCursor();
  }

  const records = await db.farmRecord.findMany({
    where: {
      propertyId,
      ...(cursor
        ? {
            OR: [
              { occurredAt: { lt: cursor.at } },
              { occurredAt: cursor.at, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      areaId: true,
      productId: true,
      createdByUserId: true,
      performedByUserId: true,
      type: true,
      description: true,
      locationDescription: true,
      occurredAt: true,
      quantity: true,
      quantityUnit: true,
      value: true,
      responsibleName: true,
      productNameSnapshot: true,
      areaNameSnapshot: true,
      appliedDose: true,
      doseUnit: true,
      harvest: true,
      supplier: true,
      productBatch: true,
      technicalNote: true,
      source: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasNextPage = records.length > limit;
  const pageRecords = hasNextPage ? records.slice(0, limit) : records;
  const last = pageRecords.at(-1);
  return {
    items: pageRecords.map(toFarmRecordDto),
    nextCursor:
      hasNextPage && last
        ? encodeCursor("FARM_RECORD", propertyId, last.occurredAt, last.id)
        : null,
  };
}

/** @internal Entrada testável; fronteiras WEB devem usar o wrapper sem ID. */
async function listStockMovementsByPropertyId(
  propertyId: string,
  page: RuralPageRequest = {},
): Promise<CursorPage<StockMovementDto>> {
  requirePropertyId(propertyId);
  const limit = pageLimit(page.limit);
  const cursor = decodeCursor(page.cursor, "STOCK_MOVEMENT", propertyId);

  if (cursor) {
    const anchor = await db.stockMovement.findFirst({
      where: { propertyId, id: cursor.id, occurredAt: cursor.at },
      select: { id: true },
    });
    if (!anchor) invalidCursor();
  }

  const movements = await db.stockMovement.findMany({
    where: {
      propertyId,
      ...(cursor
        ? {
            OR: [
              { occurredAt: { lt: cursor.at } },
              { occurredAt: cursor.at, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      productId: true,
      areaId: true,
      farmRecordId: true,
      type: true,
      quantityChange: true,
      productNameSnapshot: true,
      areaNameSnapshot: true,
      unitSnapshot: true,
      balanceBefore: true,
      balanceAfter: true,
      createdByUserId: true,
      performedByUserId: true,
      source: true,
      reason: true,
      occurredAt: true,
      createdAt: true,
      reversesMovementId: true,
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasNextPage = movements.length > limit;
  const pageMovements = hasNextPage ? movements.slice(0, limit) : movements;
  const last = pageMovements.at(-1);
  return {
    items: pageMovements.map(toStockMovementDto),
    nextCursor:
      hasNextPage && last
        ? encodeCursor("STOCK_MOVEMENT", propertyId, last.occurredAt, last.id)
        : null,
  };
}

/** @internal Entrada testável; fronteiras WEB devem usar o wrapper sem ID. */
async function listAuditLogsByPropertyId(
  propertyId: string,
  page: RuralPageRequest = {},
): Promise<CursorPage<AuditLogDto>> {
  requirePropertyId(propertyId);
  const limit = pageLimit(page.limit);
  const cursor = decodeCursor(page.cursor, "AUDIT_LOG", propertyId);

  if (cursor) {
    const anchor = await db.auditLog.findFirst({
      where: { propertyId, id: cursor.id, createdAt: cursor.at },
      select: { id: true },
    });
    if (!anchor) invalidCursor();
  }

  const auditLogs = await db.auditLog.findMany({
    where: {
      propertyId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.at } },
              { createdAt: cursor.at, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      actorUserId: true,
      action: true,
      entityType: true,
      entityId: true,
      source: true,
      beforeData: true,
      afterData: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasNextPage = auditLogs.length > limit;
  const pageAuditLogs = hasNextPage ? auditLogs.slice(0, limit) : auditLogs;
  const last = pageAuditLogs.at(-1);
  return {
    items: pageAuditLogs.map(toAuditLogDto),
    nextCursor:
      hasNextPage && last
        ? encodeCursor("AUDIT_LOG", propertyId, last.createdAt, last.id)
        : null,
  };
}

/** @internal Entrada testável; fronteiras WEB devem usar o wrapper sem ID. */
async function getDashboardSummaryByPropertyId(
  propertyId: string,
): Promise<RuralDashboardSummaryDto> {
  requirePropertyId(propertyId);

  const [
    activeAreas,
    farmRecords,
    activeProducts,
    lowStockRows,
    recentFarmRecords,
    stockOverviewProductIds,
  ] = await Promise.all([
    db.area.count({
      where: { propertyId, archivedAt: null },
    }),
    db.farmRecord.count({
      where: { propertyId },
    }),
    db.stockProduct.count({
      where: { propertyId, archivedAt: null },
    }),
    db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS "count"
        FROM "StockProduct"
       WHERE "propertyId" = ${propertyId}
         AND "archivedAt" IS NULL
         AND "minimumStock" IS NOT NULL
         AND "quantity" <= "minimumStock"
    `,
    db.farmRecord.findMany({
      where: { propertyId },
      select: {
        id: true,
        areaId: true,
        productId: true,
        createdByUserId: true,
        performedByUserId: true,
        type: true,
        description: true,
        locationDescription: true,
        occurredAt: true,
        quantity: true,
        quantityUnit: true,
        value: true,
        responsibleName: true,
        productNameSnapshot: true,
        areaNameSnapshot: true,
        appliedDose: true,
        doseUnit: true,
        harvest: true,
        supplier: true,
        productBatch: true,
        technicalNote: true,
        source: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: DASHBOARD_RECENT_FARM_RECORD_LIMIT,
    }),
    db.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
        FROM "StockProduct"
       WHERE "propertyId" = ${propertyId}
         AND "archivedAt" IS NULL
       ORDER BY CASE
                  WHEN "minimumStock" IS NOT NULL
                   AND "quantity" <= "minimumStock" THEN 0
                  ELSE 1
                END,
                "name" ASC,
                "id" ASC
       LIMIT ${DASHBOARD_STOCK_OVERVIEW_LIMIT}
    `,
  ]);

  const selectedStockProducts =
    stockOverviewProductIds.length === 0
      ? []
      : await db.stockProduct.findMany({
          where: {
            propertyId,
            archivedAt: null,
            id: { in: stockOverviewProductIds.map((product) => product.id) },
          },
          select: {
            id: true,
            name: true,
            category: true,
            quantity: true,
            unit: true,
            minimumStock: true,
            storageLocation: true,
            note: true,
            supplier: true,
            unitValue: true,
            expirationDate: true,
            batchNumber: true,
            purchaseDate: true,
            technicalNote: true,
            createdAt: true,
            updatedAt: true,
          },
        });
  const stockProductById = new Map(
    selectedStockProducts.map((product) => [product.id, product]),
  );
  const orderedStockProducts = stockOverviewProductIds
    .map((product) => stockProductById.get(product.id))
    .filter(
      (product): product is (typeof selectedStockProducts)[number] =>
        product !== undefined,
    );

  return {
    counts: {
      activeAreas,
      farmRecords,
      activeProducts,
      lowStockProducts: Number(lowStockRows[0]?.count ?? 0),
    },
    recentFarmRecords: recentFarmRecords.map(toFarmRecordDto),
    stockOverviewProducts: orderedStockProducts.map(toStockProductDto),
  };
}

/**
 * Única abertura para os testes PostgreSQL adversariais. Em qualquer runtime
 * normal, as queries tenant-scoped só podem ser alcançadas pelos wrappers que
 * derivam a Property da sessão e exigem capability.
 */
export function getRuralQueryIntegrationHarness() {
  if (
    process.env.NODE_ENV !== "test" ||
    process.env.AGROZAP_INTEGRATION_TEST !== "1"
  ) {
    throw new RuralQueryError(
      "TEST_HARNESS_UNAVAILABLE",
      "O acesso interno às queries rurais não está disponível.",
    );
  }

  return Object.freeze({
    listActiveAreasByPropertyId,
    listActiveProductsByPropertyId,
    listFarmRecordsByPropertyId,
    listStockMovementsByPropertyId,
    listAuditLogsByPropertyId,
    getDashboardSummaryByPropertyId,
  });
}

export async function listCurrentPropertyAreas(): Promise<AreaDto[]> {
  const propertyId = await requireCurrentProperty(["READ_PROPERTY"]);
  return listActiveAreasByPropertyId(propertyId);
}

export async function listCurrentPropertyProducts(): Promise<
  StockProductDto[]
> {
  const propertyId = await requireCurrentProperty(["READ_PROPERTY"]);
  return listActiveProductsByPropertyId(propertyId);
}

export async function listCurrentPropertyFarmRecords(
  page: RuralPageRequest = {},
): Promise<CursorPage<FarmRecordDto>> {
  const propertyId = await requireCurrentProperty(["READ_PROPERTY"]);
  return listFarmRecordsByPropertyId(propertyId, page);
}

export async function listCurrentPropertyStockMovements(
  page: RuralPageRequest = {},
): Promise<CursorPage<StockMovementDto>> {
  const propertyId = await requireCurrentProperty(["READ_PROPERTY"]);
  return listStockMovementsByPropertyId(propertyId, page);
}

export async function listCurrentPropertyAuditLogs(
  page: RuralPageRequest = {},
): Promise<CursorPage<AuditLogDto>> {
  const propertyId = await requireCurrentProperty(["VIEW_AUDIT"]);
  return listAuditLogsByPropertyId(propertyId, page);
}

export async function getCurrentPropertyDashboardSummary(): Promise<RuralDashboardSummaryDto> {
  const propertyId = await requireCurrentProperty(["READ_PROPERTY"]);
  return getDashboardSummaryByPropertyId(propertyId);
}
