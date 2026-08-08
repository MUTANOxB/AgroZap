import type {
  AreaType,
  FarmRecordType,
  ProductCategory,
  RecordSource,
  StockMovementType,
} from "@/generated/prisma/enums";

type DecimalLike = { toString(): string };

export type JsonDto =
  | string
  | number
  | boolean
  | null
  | JsonDto[]
  | { [key: string]: JsonDto };

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type AreaDto = {
  id: string;
  name: string;
  type: AreaType;
  size: string | null;
  sizeUnit: string | null;
  note: string | null;
  currentCrop: string | null;
  harvest: string | null;
  soilType: string | null;
  irrigation: string | null;
  estimatedProductivity: string | null;
  productivityUnit: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AreaDtoSource = {
  id: string;
  name: string;
  type: AreaType;
  size: DecimalLike | null;
  sizeUnit: string | null;
  note: string | null;
  currentCrop: string | null;
  harvest: string | null;
  soilType: string | null;
  irrigation: string | null;
  estimatedProductivity: DecimalLike | null;
  productivityUnit: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StockProductDto = {
  id: string;
  name: string;
  category: ProductCategory;
  quantity: string;
  unit: string;
  minimumStock: string | null;
  storageLocation: string | null;
  note: string | null;
  supplier: string | null;
  unitValue: string | null;
  expirationDate: string | null;
  batchNumber: string | null;
  purchaseDate: string | null;
  technicalNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductDto = StockProductDto;

export type StockProductDtoSource = {
  id: string;
  name: string;
  category: ProductCategory;
  quantity: DecimalLike;
  unit: string;
  minimumStock: DecimalLike | null;
  storageLocation: string | null;
  note: string | null;
  supplier: string | null;
  unitValue: DecimalLike | null;
  expirationDate: Date | null;
  batchNumber: string | null;
  purchaseDate: Date | null;
  technicalNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FarmRecordDto = {
  id: string;
  areaId: string | null;
  productId: string | null;
  createdByUserId: string | null;
  performedByUserId: string | null;
  type: FarmRecordType;
  description: string;
  locationDescription: string | null;
  occurredAt: string;
  quantity: string | null;
  quantityUnit: string | null;
  value: string | null;
  responsibleName: string | null;
  productNameSnapshot: string | null;
  areaNameSnapshot: string | null;
  appliedDose: string | null;
  doseUnit: string | null;
  harvest: string | null;
  supplier: string | null;
  productBatch: string | null;
  technicalNote: string | null;
  source: RecordSource;
  createdAt: string;
  updatedAt: string;
};

export type FarmRecordDtoSource = {
  id: string;
  areaId: string | null;
  productId: string | null;
  createdByUserId: string | null;
  performedByUserId: string | null;
  type: FarmRecordType;
  description: string;
  locationDescription: string | null;
  occurredAt: Date;
  quantity: DecimalLike | null;
  quantityUnit: string | null;
  value: DecimalLike | null;
  responsibleName: string | null;
  productNameSnapshot: string | null;
  areaNameSnapshot: string | null;
  appliedDose: DecimalLike | null;
  doseUnit: string | null;
  harvest: string | null;
  supplier: string | null;
  productBatch: string | null;
  technicalNote: string | null;
  source: RecordSource;
  createdAt: Date;
  updatedAt: Date;
};

export type StockMovementDto = {
  id: string;
  productId: string;
  areaId: string | null;
  farmRecordId: string | null;
  type: StockMovementType;
  quantityChange: string;
  productNameSnapshot: string;
  areaNameSnapshot: string | null;
  unitSnapshot: string;
  balanceBefore: string;
  balanceAfter: string;
  createdByUserId: string | null;
  performedByUserId: string | null;
  source: RecordSource;
  reason: string | null;
  occurredAt: string;
  createdAt: string;
  reversesMovementId: string | null;
};

export type StockMovementDtoSource = {
  id: string;
  productId: string;
  areaId: string | null;
  farmRecordId: string | null;
  type: StockMovementType;
  quantityChange: DecimalLike;
  productNameSnapshot: string;
  areaNameSnapshot: string | null;
  unitSnapshot: string;
  balanceBefore: DecimalLike;
  balanceAfter: DecimalLike;
  createdByUserId: string | null;
  performedByUserId: string | null;
  source: RecordSource;
  reason: string | null;
  occurredAt: Date;
  createdAt: Date;
  reversesMovementId: string | null;
};

export type AuditLogDto = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  source: RecordSource;
  beforeData: JsonDto | null;
  afterData: JsonDto | null;
  metadata: JsonDto | null;
  createdAt: string;
};

export type AuditLogDtoSource = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  source: RecordSource;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
  createdAt: Date;
};

function decimalToString(value: DecimalLike | null) {
  return value === null ? null : value.toString();
}

function dateTimeToIso(value: Date) {
  return value.toISOString();
}

function databaseDateToString(value: Date | null) {
  return value === null ? null : value.toISOString().slice(0, 10);
}

function jsonToDto(value: unknown): JsonDto | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonToDto);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        jsonToDto(nestedValue),
      ]),
    );
  }
  return null;
}

export function toAreaDto(area: AreaDtoSource): AreaDto {
  return {
    id: area.id,
    name: area.name,
    type: area.type,
    size: decimalToString(area.size),
    sizeUnit: area.sizeUnit,
    note: area.note,
    currentCrop: area.currentCrop,
    harvest: area.harvest,
    soilType: area.soilType,
    irrigation: area.irrigation,
    estimatedProductivity: decimalToString(area.estimatedProductivity),
    productivityUnit: area.productivityUnit,
    createdAt: dateTimeToIso(area.createdAt),
    updatedAt: dateTimeToIso(area.updatedAt),
  };
}

export function toStockProductDto(
  product: StockProductDtoSource,
): StockProductDto {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    quantity: product.quantity.toString(),
    unit: product.unit,
    minimumStock: decimalToString(product.minimumStock),
    storageLocation: product.storageLocation,
    note: product.note,
    supplier: product.supplier,
    unitValue: decimalToString(product.unitValue),
    expirationDate: databaseDateToString(product.expirationDate),
    batchNumber: product.batchNumber,
    purchaseDate: databaseDateToString(product.purchaseDate),
    technicalNote: product.technicalNote,
    createdAt: dateTimeToIso(product.createdAt),
    updatedAt: dateTimeToIso(product.updatedAt),
  };
}

export const toProductDto = toStockProductDto;

export function toFarmRecordDto(record: FarmRecordDtoSource): FarmRecordDto {
  return {
    id: record.id,
    areaId: record.areaId,
    productId: record.productId,
    createdByUserId: record.createdByUserId,
    performedByUserId: record.performedByUserId,
    type: record.type,
    description: record.description,
    locationDescription: record.locationDescription,
    occurredAt: dateTimeToIso(record.occurredAt),
    quantity: decimalToString(record.quantity),
    quantityUnit: record.quantityUnit,
    value: decimalToString(record.value),
    responsibleName: record.responsibleName,
    productNameSnapshot: record.productNameSnapshot,
    areaNameSnapshot: record.areaNameSnapshot,
    appliedDose: decimalToString(record.appliedDose),
    doseUnit: record.doseUnit,
    harvest: record.harvest,
    supplier: record.supplier,
    productBatch: record.productBatch,
    technicalNote: record.technicalNote,
    source: record.source,
    createdAt: dateTimeToIso(record.createdAt),
    updatedAt: dateTimeToIso(record.updatedAt),
  };
}

export function toStockMovementDto(
  movement: StockMovementDtoSource,
): StockMovementDto {
  return {
    id: movement.id,
    productId: movement.productId,
    areaId: movement.areaId,
    farmRecordId: movement.farmRecordId,
    type: movement.type,
    quantityChange: movement.quantityChange.toString(),
    productNameSnapshot: movement.productNameSnapshot,
    areaNameSnapshot: movement.areaNameSnapshot,
    unitSnapshot: movement.unitSnapshot,
    balanceBefore: movement.balanceBefore.toString(),
    balanceAfter: movement.balanceAfter.toString(),
    createdByUserId: movement.createdByUserId,
    performedByUserId: movement.performedByUserId,
    source: movement.source,
    reason: movement.reason,
    occurredAt: dateTimeToIso(movement.occurredAt),
    createdAt: dateTimeToIso(movement.createdAt),
    reversesMovementId: movement.reversesMovementId,
  };
}

export function toAuditLogDto(audit: AuditLogDtoSource): AuditLogDto {
  return {
    id: audit.id,
    actorUserId: audit.actorUserId,
    action: audit.action,
    entityType: audit.entityType,
    entityId: audit.entityId,
    source: audit.source,
    beforeData: jsonToDto(audit.beforeData),
    afterData: jsonToDto(audit.afterData),
    metadata: jsonToDto(audit.metadata),
    createdAt: dateTimeToIso(audit.createdAt),
  };
}
