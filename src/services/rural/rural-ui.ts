import {
  AreaType,
  FarmRecordType,
  ProductCategory,
  PropertyRole,
  StockMovementType,
} from "@/generated/prisma/enums";
import { hasCapability } from "@/services/autorizacao/property-role-policy";
import {
  fitsRuralDecimalStorage,
  tryNormalizeCanonicalRuralDecimal,
  tryNormalizeRuralDecimal,
} from "@/services/rural/rural-decimal";
import type {
  AreaDto,
  StockProductDto,
} from "@/services/rural/rural-dtos";

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
    canEditArea: hasCapability(role, "EDIT_AREA"),
    canCreateProduct: hasCapability(role, "CREATE_PRODUCT"),
    canEditProduct: hasCapability(role, "EDIT_PRODUCT"),
    canCreateRecord: hasCapability(role, "CREATE_RECORD"),
    canMoveStock: hasCapability(role, "MOVE_STOCK"),
    canAdjustStock: hasCapability(role, "ADJUST_STOCK"),
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

export type AreaEditFormValues = AreaFormValues;

export function getAreaEditFormValues(area: AreaDto): AreaEditFormValues {
  return {
    name: area.name,
    typeLabel: getAreaTypeLabel(area.type),
    size: area.size === null ? "" : formatRuralDecimalPtBr(area.size),
    sizeUnit: area.sizeUnit ?? "",
    note: area.note ?? "",
    currentCrop: area.currentCrop ?? "",
    harvest: area.harvest ?? "",
    soilType: area.soilType ?? "",
    irrigation: area.irrigation ?? "",
    estimatedProductivity:
      area.estimatedProductivity === null
        ? ""
        : formatRuralDecimalPtBr(area.estimatedProductivity),
    productivityUnit: area.productivityUnit ?? "",
  };
}

export function buildUpdateAreaInput(
  areaId: string,
  values: AreaEditFormValues,
) {
  const estimatedProductivity = optionalText(values.estimatedProductivity);

  return {
    areaId,
    name: values.name.trim(),
    type: parseAreaTypeLabel(values.typeLabel),
    size: optionalText(values.size),
    sizeUnit: optionalText(values.sizeUnit),
    note: optionalText(values.note),
    currentCrop: optionalText(values.currentCrop),
    harvest: optionalText(values.harvest),
    soilType: optionalText(values.soilType),
    irrigation: optionalText(values.irrigation),
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

export type StockProductEditFormValues = {
  name: string;
  categoryLabel: ProductCategoryLabel;
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

export function getStockProductEditFormValues(
  product: StockProductDto,
): StockProductEditFormValues {
  return {
    name: product.name,
    categoryLabel: getProductCategoryLabel(product.category),
    unit: product.unit,
    minimumStock:
      product.minimumStock === null
        ? ""
        : formatRuralDecimalPtBr(product.minimumStock),
    storageLocation: product.storageLocation ?? "",
    note: product.note ?? "",
    supplier: product.supplier ?? "",
    unitValue:
      product.unitValue === null
        ? ""
        : formatRuralDecimalPtBr(product.unitValue),
    expirationDate: product.expirationDate ?? "",
    batchNumber: product.batchNumber ?? "",
    purchaseDate: product.purchaseDate ?? "",
    technicalNote: product.technicalNote ?? "",
  };
}

export function buildUpdateStockProductInput(
  productId: string,
  values: StockProductEditFormValues,
) {
  return {
    productId,
    name: values.name.trim(),
    category: parseProductCategoryLabel(values.categoryLabel),
    unit: values.unit.trim(),
    minimumStock: optionalText(values.minimumStock),
    storageLocation: optionalText(values.storageLocation),
    note: optionalText(values.note),
    supplier: optionalText(values.supplier),
    unitValue: optionalText(values.unitValue),
    expirationDate: optionalText(values.expirationDate),
    batchNumber: optionalText(values.batchNumber),
    purchaseDate: optionalText(values.purchaseDate),
    technicalNote: optionalText(values.technicalNote),
  };
}

export type StockAdjustmentFormValues = {
  targetQuantity: string;
  reason: string;
};

export function buildAdjustStockInput(
  productId: string,
  values: StockAdjustmentFormValues,
) {
  return {
    productId,
    targetQuantity: values.targetQuantity.trim(),
    reason: values.reason.trim(),
  };
}

/**
 * O preview reutiliza o parser da fronteira WEB; o backend continua sendo a
 * autoridade da validação e recalcula a diferença dentro da transação.
 */
function normalizePreviewDecimal(value: string): string | null {
  const result = tryNormalizeRuralDecimal(value);
  return result.ok ? result.value : null;
}

function normalizeCanonicalPreviewDecimal(value: string): string | null {
  const result = tryNormalizeCanonicalRuralDecimal(value);
  return result.ok ? result.value : null;
}

function compareDigitStrings(left: string, right: string) {
  const a = left.replace(/^0+(?=\d)/, "");
  const b = right.replace(/^0+(?=\d)/, "");
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function addDigitStrings(left: string, right: string) {
  let leftIndex = left.length - 1;
  let rightIndex = right.length - 1;
  let carry = 0;
  let result = "";

  while (leftIndex >= 0 || rightIndex >= 0 || carry > 0) {
    const leftDigit =
      leftIndex >= 0 ? left.charCodeAt(leftIndex) - "0".charCodeAt(0) : 0;
    const rightDigit =
      rightIndex >= 0 ? right.charCodeAt(rightIndex) - "0".charCodeAt(0) : 0;
    const sum = leftDigit + rightDigit + carry;
    result = String.fromCharCode("0".charCodeAt(0) + (sum % 10)) + result;
    carry = Math.floor(sum / 10);
    leftIndex -= 1;
    rightIndex -= 1;
  }

  return result.replace(/^0+(?=\d)/, "");
}

/** `left` precisa ser maior ou igual a `right`. */
function subtractDigitStrings(left: string, right: string) {
  let leftIndex = left.length - 1;
  let rightIndex = right.length - 1;
  let borrow = 0;
  let result = "";

  while (leftIndex >= 0) {
    let digit = left.charCodeAt(leftIndex) - "0".charCodeAt(0) - borrow;
    const subtrahend =
      rightIndex >= 0 ? right.charCodeAt(rightIndex) - "0".charCodeAt(0) : 0;
    if (digit < subtrahend) {
      digit += 10;
      borrow = 1;
    } else {
      borrow = 0;
    }
    result =
      String.fromCharCode("0".charCodeAt(0) + digit - subtrahend) + result;
    leftIndex -= 1;
    rightIndex -= 1;
  }

  return result.replace(/^0+(?=\d)/, "");
}

function decimalMagnitude(value: string, scale: number) {
  const unsigned = value.startsWith("-") ? value.slice(1) : value;
  const [integer, fraction = ""] = unsigned.split(".");
  return `${integer}${fraction.padEnd(scale, "0")}`.replace(
    /^0+(?=\d)/,
    "",
  );
}

function fixedDigitsToCanonical(
  magnitude: string,
  scale: number,
  negative: boolean,
) {
  const digits = magnitude.replace(/^0+(?=\d)/, "");
  if (/^0+$/.test(digits)) return "0";

  const sign = negative ? "-" : "";
  if (scale === 0) return `${sign}${digits}`;

  const padded = digits.padStart(scale + 1, "0");
  const integer = padded.slice(0, -scale).replace(/^0+(?=\d)/, "") || "0";
  const fraction = padded.slice(-scale).replace(/0+$/, "");
  return `${sign}${integer}${fraction ? `.${fraction}` : ""}`;
}

/**
 * Calcula `targetQuantity - currentQuantity` sem Number, float ou Prisma.
 * O retorno canônico serve somente para preview; nunca deve ser enviado como
 * autoridade da diferença ao servidor.
 */
export function getStockAdjustmentDifference(
  currentQuantity: string,
  targetQuantity: string,
): string | null {
  const current = normalizeCanonicalPreviewDecimal(currentQuantity);
  const target = normalizePreviewDecimal(targetQuantity);
  if (current === null || target === null) return null;
  if (
    !fitsRuralDecimalStorage(current, 18, 4) ||
    !fitsRuralDecimalStorage(target, 18, 4)
  ) {
    return null;
  }

  const currentFraction = current.replace(/^-/, "").split(".")[1] ?? "";
  const targetFraction = target.replace(/^-/, "").split(".")[1] ?? "";
  const scale = Math.max(currentFraction.length, targetFraction.length);
  const currentMagnitude = decimalMagnitude(current, scale);
  const targetMagnitude = decimalMagnitude(target, scale);
  const currentNegative = current.startsWith("-");
  const targetNegative = target.startsWith("-");

  let magnitude: string;
  let negative: boolean;
  if (currentNegative !== targetNegative) {
    magnitude = addDigitStrings(currentMagnitude, targetMagnitude);
    negative = targetNegative;
  } else if (!targetNegative) {
    const comparison = compareDigitStrings(targetMagnitude, currentMagnitude);
    magnitude =
      comparison >= 0
        ? subtractDigitStrings(targetMagnitude, currentMagnitude)
        : subtractDigitStrings(currentMagnitude, targetMagnitude);
    negative = comparison < 0;
  } else {
    const comparison = compareDigitStrings(currentMagnitude, targetMagnitude);
    magnitude =
      comparison >= 0
        ? subtractDigitStrings(currentMagnitude, targetMagnitude)
        : subtractDigitStrings(targetMagnitude, currentMagnitude);
    negative = comparison < 0;
  }

  return fixedDigitsToCanonical(magnitude, scale, negative);
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
