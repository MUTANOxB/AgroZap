import {
  AreaType,
  FarmRecordType,
  ProductCategory,
  PropertyRole,
  StockMovementType,
} from "@/generated/prisma/enums";
import { hasCapability } from "@/services/autorizacao/property-role-policy";

export const AREA_TYPE_OPTIONS = [
  { label: "Lavoura", value: AreaType.FIELD },
  { label: "Pasto", value: AreaType.PASTURE },
  { label: "Horta", value: AreaType.VEGETABLE_GARDEN },
  { label: "Pomar", value: AreaType.ORCHARD },
  { label: "Estufa", value: AreaType.GREENHOUSE },
  { label: "Outro", value: AreaType.OTHER },
] as const;

export const PRODUCT_CATEGORY_OPTIONS = [
  { label: "Semente", value: ProductCategory.SEED },
  { label: "Adubo", value: ProductCategory.FERTILIZER },
  { label: "Defensivo", value: ProductCategory.PESTICIDE },
  { label: "Combustível", value: ProductCategory.FUEL },
  { label: "Ração", value: ProductCategory.FEED },
  { label: "Peça", value: ProductCategory.PART },
  { label: "Ferramenta", value: ProductCategory.TOOL },
  { label: "Outro", value: ProductCategory.OTHER },
] as const;

export const FARM_RECORD_TYPE_OPTIONS = [
  { label: "Pulverização", value: FarmRecordType.SPRAYING },
  { label: "Plantio", value: FarmRecordType.PLANTING },
  { label: "Colheita", value: FarmRecordType.HARVEST },
  { label: "Compra", value: FarmRecordType.PURCHASE },
  { label: "Entrada no estoque", value: FarmRecordType.STOCK_ENTRY },
  { label: "Manutenção", value: FarmRecordType.MAINTENANCE },
  { label: "Vistoria", value: FarmRecordType.INSPECTION },
  { label: "Pagamento", value: FarmRecordType.PAYMENT },
  { label: "Observação", value: FarmRecordType.NOTE },
] as const;

export type AreaTypeLabel = (typeof AREA_TYPE_OPTIONS)[number]["label"];
export type ProductCategoryLabel =
  (typeof PRODUCT_CATEGORY_OPTIONS)[number]["label"];
export type FarmRecordTypeLabel =
  (typeof FARM_RECORD_TYPE_OPTIONS)[number]["label"];

const AREA_LABEL_BY_TYPE = {
  [AreaType.FIELD]: "Lavoura",
  [AreaType.PASTURE]: "Pasto",
  [AreaType.VEGETABLE_GARDEN]: "Horta",
  [AreaType.ORCHARD]: "Pomar",
  [AreaType.GREENHOUSE]: "Estufa",
  [AreaType.OTHER]: "Outro",
} as const satisfies Record<AreaType, AreaTypeLabel>;

const AREA_TYPE_BY_LABEL = {
  Lavoura: AreaType.FIELD,
  Pasto: AreaType.PASTURE,
  Horta: AreaType.VEGETABLE_GARDEN,
  Pomar: AreaType.ORCHARD,
  Estufa: AreaType.GREENHOUSE,
  Outro: AreaType.OTHER,
} as const satisfies Record<AreaTypeLabel, AreaType>;

const PRODUCT_LABEL_BY_CATEGORY = {
  [ProductCategory.SEED]: "Semente",
  [ProductCategory.FERTILIZER]: "Adubo",
  [ProductCategory.PESTICIDE]: "Defensivo",
  [ProductCategory.FUEL]: "Combustível",
  [ProductCategory.FEED]: "Ração",
  [ProductCategory.PART]: "Peça",
  [ProductCategory.TOOL]: "Ferramenta",
  [ProductCategory.OTHER]: "Outro",
} as const satisfies Record<ProductCategory, ProductCategoryLabel>;

const PRODUCT_CATEGORY_BY_LABEL = {
  Semente: ProductCategory.SEED,
  Adubo: ProductCategory.FERTILIZER,
  Defensivo: ProductCategory.PESTICIDE,
  Combustível: ProductCategory.FUEL,
  Ração: ProductCategory.FEED,
  Peça: ProductCategory.PART,
  Ferramenta: ProductCategory.TOOL,
  Outro: ProductCategory.OTHER,
} as const satisfies Record<ProductCategoryLabel, ProductCategory>;

const RECORD_LABEL_BY_TYPE = {
  [FarmRecordType.SPRAYING]: "Pulverização",
  [FarmRecordType.PLANTING]: "Plantio",
  [FarmRecordType.HARVEST]: "Colheita",
  [FarmRecordType.PURCHASE]: "Compra",
  [FarmRecordType.STOCK_ENTRY]: "Entrada no estoque",
  [FarmRecordType.MAINTENANCE]: "Manutenção",
  [FarmRecordType.INSPECTION]: "Vistoria",
  [FarmRecordType.PAYMENT]: "Pagamento",
  [FarmRecordType.NOTE]: "Observação",
} as const satisfies Record<FarmRecordType, FarmRecordTypeLabel>;

const RECORD_TYPE_BY_LABEL = {
  Pulverização: FarmRecordType.SPRAYING,
  Plantio: FarmRecordType.PLANTING,
  Colheita: FarmRecordType.HARVEST,
  Compra: FarmRecordType.PURCHASE,
  "Entrada no estoque": FarmRecordType.STOCK_ENTRY,
  Manutenção: FarmRecordType.MAINTENANCE,
  Vistoria: FarmRecordType.INSPECTION,
  Pagamento: FarmRecordType.PAYMENT,
  Observação: FarmRecordType.NOTE,
} as const satisfies Record<FarmRecordTypeLabel, FarmRecordType>;

export function getAreaTypeLabel(type: AreaType): AreaTypeLabel {
  return AREA_LABEL_BY_TYPE[type];
}

export function getProductCategoryLabel(
  category: ProductCategory,
): ProductCategoryLabel {
  return PRODUCT_LABEL_BY_CATEGORY[category];
}

export function getFarmRecordTypeLabel(
  type: FarmRecordType,
): FarmRecordTypeLabel {
  return RECORD_LABEL_BY_TYPE[type];
}

export function parseAreaTypeLabel(label: AreaTypeLabel): AreaType {
  return AREA_TYPE_BY_LABEL[label];
}

export function parseProductCategoryLabel(
  label: ProductCategoryLabel,
): ProductCategory {
  return PRODUCT_CATEGORY_BY_LABEL[label];
}

export function parseFarmRecordTypeLabel(
  label: FarmRecordTypeLabel,
): FarmRecordType {
  return RECORD_TYPE_BY_LABEL[label];
}

const CANONICAL_DECIMAL = /^-?\d+(?:\.\d+)?$/;

export function formatRuralDecimalPtBr(value: string): string {
  if (!CANONICAL_DECIMAL.test(value)) return value;

  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer, fraction] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped}${fraction ? `,${fraction}` : ""}`;
}

function compareCanonicalDecimals(left: string, right: string): number {
  if (!CANONICAL_DECIMAL.test(left) || !CANONICAL_DECIMAL.test(right)) {
    return left.localeCompare(right);
  }

  function parts(value: string) {
    const negative = value.startsWith("-");
    const unsigned = negative ? value.slice(1) : value;
    const [rawInteger, rawFraction = ""] = unsigned.split(".");
    const integer = rawInteger.replace(/^0+(?=\d)/, "");
    const fraction = rawFraction.replace(/0+$/, "");
    const zero = integer === "0" && fraction === "";
    return { negative: negative && !zero, integer, fraction };
  }

  const a = parts(left);
  const b = parts(right);
  if (a.negative !== b.negative) return a.negative ? -1 : 1;

  let magnitude = a.integer.length - b.integer.length;
  if (magnitude === 0) magnitude = a.integer.localeCompare(b.integer);
  if (magnitude === 0) {
    const width = Math.max(a.fraction.length, b.fraction.length);
    magnitude = a.fraction
      .padEnd(width, "0")
      .localeCompare(b.fraction.padEnd(width, "0"));
  }
  return a.negative ? -magnitude : magnitude;
}

export function isLowStock(product: {
  quantity: string;
  minimumStock: string | null;
}): boolean {
  return (
    product.minimumStock !== null &&
    compareCanonicalDecimals(product.quantity, product.minimumStock) <= 0
  );
}

export function getRuralUiPermissions(role: PropertyRole) {
  return {
    canRead: hasCapability(role, "READ_PROPERTY"),
    canCreateArea: hasCapability(role, "CREATE_AREA"),
    canCreateProduct: hasCapability(role, "CREATE_PRODUCT"),
    canCreateRecord: hasCapability(role, "CREATE_RECORD"),
    canMoveStock: hasCapability(role, "MOVE_STOCK"),
  } as const;
}

function optionalText(value: string) {
  return value.trim() || null;
}

export type AreaFormValues = {
  name: string;
  typeLabel: AreaTypeLabel;
  size: string;
  sizeUnit: string;
  note: string;
  currentCrop: string;
  harvest: string;
  soilType: string;
  irrigation: string;
  estimatedProductivity: string;
  productivityUnit: string;
};

export function buildCreateAreaInput(
  values: AreaFormValues,
  isComplete: boolean,
) {
  const estimatedProductivity = isComplete
    ? optionalText(values.estimatedProductivity)
    : null;

  return {
    name: values.name.trim(),
    type: parseAreaTypeLabel(values.typeLabel),
    size: values.size.trim(),
    sizeUnit: optionalText(values.sizeUnit),
    note: isComplete ? optionalText(values.note) : null,
    currentCrop: isComplete ? optionalText(values.currentCrop) : null,
    harvest: isComplete ? optionalText(values.harvest) : null,
    soilType: isComplete ? optionalText(values.soilType) : null,
    irrigation: isComplete ? optionalText(values.irrigation) : null,
    estimatedProductivity,
    productivityUnit: estimatedProductivity
      ? optionalText(values.productivityUnit)
      : null,
  };
}

export type StockProductFormValues = {
  name: string;
  categoryLabel: ProductCategoryLabel;
  initialQuantity: string;
  unit: string;
  minimumStock: string;
  storageLocation: string;
  note: string;
  supplier: string;
  unitValue: string;
  expirationDate: string;
  batchNumber: string;
  purchaseDate: string;
  technicalNote: string;
};

export function buildCreateStockProductInput(
  values: StockProductFormValues,
  isComplete: boolean,
) {
  return {
    name: values.name.trim(),
    category: isComplete
      ? parseProductCategoryLabel(values.categoryLabel)
      : ProductCategory.OTHER,
    initialQuantity: values.initialQuantity.trim(),
    unit: values.unit.trim(),
    minimumStock: isComplete ? optionalText(values.minimumStock) : null,
    storageLocation: isComplete ? optionalText(values.storageLocation) : null,
    note: isComplete ? optionalText(values.note) : null,
    supplier: isComplete ? optionalText(values.supplier) : null,
    unitValue: isComplete ? optionalText(values.unitValue) : null,
    expirationDate: isComplete ? optionalText(values.expirationDate) : null,
    batchNumber: isComplete ? optionalText(values.batchNumber) : null,
    purchaseDate: isComplete ? optionalText(values.purchaseDate) : null,
    technicalNote: isComplete ? optionalText(values.technicalNote) : null,
  };
}

export type FarmRecordFormValues = {
  typeLabel: FarmRecordTypeLabel;
  areaId: string;
  locationDescription: string;
  productId: string;
  occurredAt: string;
  description: string;
  quantity: string;
  quantityUnit: string;
  stockMovementAmount: string;
  value: string;
  responsibleName: string;
  appliedDose: string;
  doseUnit: string;
  harvest: string;
  supplier: string;
  productBatch: string;
  technicalNote: string;
};

export type FarmRecordSubmissionOptions = {
  mode: "simples" | "completo";
  canMoveStock: boolean;
  stockMovementEnabled: boolean;
};

function stockMovementTypeForRecord(type: FarmRecordType) {
  if (
    type === FarmRecordType.PURCHASE ||
    type === FarmRecordType.STOCK_ENTRY
  ) {
    return StockMovementType.IN;
  }
  if (
    type === FarmRecordType.SPRAYING ||
    type === FarmRecordType.PLANTING ||
    type === FarmRecordType.MAINTENANCE
  ) {
    return StockMovementType.OUT;
  }
  return null;
}

function buildFarmRecordInput(
  values: FarmRecordFormValues,
  mode: FarmRecordSubmissionOptions["mode"],
) {
  const isComplete = mode === "completo";
  const areaId = optionalText(values.areaId);

  return {
    areaId,
    productId: isComplete ? optionalText(values.productId) : null,
    type: isComplete
      ? parseFarmRecordTypeLabel(values.typeLabel)
      : FarmRecordType.NOTE,
    description: values.description.trim(),
    locationDescription: areaId
      ? null
      : optionalText(values.locationDescription),
    occurredAt: values.occurredAt,
    quantity: isComplete ? optionalText(values.quantity) : null,
    quantityUnit: isComplete ? optionalText(values.quantityUnit) : null,
    value: isComplete ? optionalText(values.value) : null,
    responsibleName: isComplete ? optionalText(values.responsibleName) : null,
    appliedDose: isComplete ? optionalText(values.appliedDose) : null,
    doseUnit: isComplete ? optionalText(values.doseUnit) : null,
    harvest: isComplete ? optionalText(values.harvest) : null,
    supplier: isComplete ? optionalText(values.supplier) : null,
    productBatch: isComplete ? optionalText(values.productBatch) : null,
    technicalNote: isComplete ? optionalText(values.technicalNote) : null,
  };
}

export type FarmRecordSubmission =
  | {
      kind: "record";
      input: ReturnType<typeof buildFarmRecordInput>;
    }
  | {
      kind: "record-with-stock";
      input: {
        farmRecord: ReturnType<typeof buildFarmRecordInput>;
        stockMovement: {
          type: typeof StockMovementType.IN | typeof StockMovementType.OUT;
          amount: string;
          reason: string;
        };
      };
    };

export function buildFarmRecordSubmission(
  values: FarmRecordFormValues,
  options: FarmRecordSubmissionOptions,
): FarmRecordSubmission {
  const farmRecord = buildFarmRecordInput(values, options.mode);
  const movementType = stockMovementTypeForRecord(farmRecord.type);

  if (
    options.mode === "completo" &&
    options.canMoveStock &&
    options.stockMovementEnabled &&
    movementType !== null
  ) {
    return {
      kind: "record-with-stock",
      input: {
        farmRecord,
        stockMovement: {
          type: movementType,
          amount: values.stockMovementAmount.trim(),
          reason: farmRecord.description,
        },
      },
    };
  }

  return { kind: "record", input: farmRecord };
}

export type FarmRecordSuccessNavigation = "refresh" | "replace-with-latest";

export function getFarmRecordSuccessNavigation(
  isPaginated: boolean,
): FarmRecordSuccessNavigation {
  return isPaginated ? "replace-with-latest" : "refresh";
}
