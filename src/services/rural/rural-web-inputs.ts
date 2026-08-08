import {
  AreaType,
  FarmRecordType,
  ProductCategory,
  StockMovementType,
} from "@/generated/prisma/enums";
import {
  normalizeOptionalRuralDecimal,
  normalizeRuralDecimal,
  parseOptionalDatabaseDate,
  parseOptionalOccurredAt,
} from "@/services/rural/rural-input-normalization";

const AUTHORITY_FIELDS = new Set([
  "propertyId",
  "createdByUserId",
  "actorUserId",
  "role",
  "capability",
  "source",
]);

const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_ID_LENGTH = 128;
const MAX_NAME_LENGTH = 200;
const MAX_SHORT_TEXT_LENGTH = 255;
const MAX_TEXT_LENGTH = 10_000;
const MAX_REASON_LENGTH = 2_000;
const MAX_ALIASES = 50;

type UnknownRecord = Record<string, unknown>;

export type RuralWebInputErrorCode =
  | "INVALID_INPUT"
  | "AUTHORITY_FIELD_NOT_ALLOWED";

export class RuralWebInputError extends Error {
  constructor(
    public readonly code: RuralWebInputErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RuralWebInputError";
  }
}

export type CreateAreaWebInput = {
  name: string;
  type: AreaType;
  size?: unknown;
  sizeUnit?: string | null;
  note?: string | null;
  currentCrop?: string | null;
  harvest?: string | null;
  soilType?: string | null;
  irrigation?: string | null;
  estimatedProductivity?: unknown;
  productivityUnit?: string | null;
  aliases?: string[];
};

export type PreparedCreateAreaWebInput = {
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
  aliases: string[];
};

export type UpdateAreaWebInput = {
  areaId: string;
  name: string;
  type: AreaType;
  size?: unknown;
  sizeUnit?: string | null;
  note?: string | null;
  currentCrop?: string | null;
  harvest?: string | null;
  soilType?: string | null;
  irrigation?: string | null;
  estimatedProductivity?: unknown;
  productivityUnit?: string | null;
};

export type PreparedUpdateAreaWebInput = {
  areaId: string;
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
};

export type CreateStockProductWebInput = {
  name: string;
  category: ProductCategory;
  initialQuantity: unknown;
  unit: string;
  minimumStock?: unknown;
  storageLocation?: string | null;
  note?: string | null;
  supplier?: string | null;
  unitValue?: unknown;
  expirationDate?: unknown;
  batchNumber?: string | null;
  purchaseDate?: unknown;
  technicalNote?: string | null;
  aliases?: string[];
};

export type PreparedCreateStockProductWebInput = {
  name: string;
  category: ProductCategory;
  initialQuantity: string;
  unit: string;
  minimumStock: string | null;
  storageLocation: string | null;
  note: string | null;
  supplier: string | null;
  unitValue: string | null;
  expirationDate: Date | null;
  batchNumber: string | null;
  purchaseDate: Date | null;
  technicalNote: string | null;
  aliases: string[];
};

/** `quantity` não integra o contrato cadastral de edição. */
export type UpdateStockProductWebInput = {
  productId: string;
  name: string;
  category: ProductCategory;
  unit: string;
  minimumStock?: unknown;
  storageLocation?: string | null;
  note?: string | null;
  supplier?: string | null;
  unitValue?: unknown;
  expirationDate?: unknown;
  batchNumber?: string | null;
  purchaseDate?: unknown;
  technicalNote?: string | null;
};

export type PreparedUpdateStockProductWebInput = {
  productId: string;
  name: string;
  category: ProductCategory;
  unit: string;
  minimumStock: string | null;
  storageLocation: string | null;
  note: string | null;
  supplier: string | null;
  unitValue: string | null;
  expirationDate: Date | null;
  batchNumber: string | null;
  purchaseDate: Date | null;
  technicalNote: string | null;
};

export type AdjustStockWebInput = {
  productId: string;
  targetQuantity: unknown;
  reason: string;
};

export type PreparedAdjustStockWebInput = {
  productId: string;
  targetQuantity: string;
  reason: string;
};

export type CreateFarmRecordWebInput = {
  areaId?: string | null;
  productId?: string | null;
  performedByUserId?: string | null;
  type: FarmRecordType;
  description: string;
  locationDescription?: string | null;
  occurredAt?: unknown;
  quantity?: unknown;
  quantityUnit?: string | null;
  value?: unknown;
  responsibleName?: string | null;
  appliedDose?: unknown;
  doseUnit?: string | null;
  harvest?: string | null;
  supplier?: string | null;
  productBatch?: string | null;
  technicalNote?: string | null;
};

export type PreparedCreateFarmRecordWebInput = {
  areaId: string | null;
  productId: string | null;
  performedByUserId: string | null;
  type: FarmRecordType;
  description: string;
  locationDescription: string | null;
  occurredAt: Date | undefined;
  quantity: string | null;
  quantityUnit: string | null;
  value: string | null;
  responsibleName: string | null;
  appliedDose: string | null;
  doseUnit: string | null;
  harvest: string | null;
  supplier: string | null;
  productBatch: string | null;
  technicalNote: string | null;
};

type StockMovementWebContext = {
  productId: string;
  areaId?: string | null;
  farmRecordId?: string | null;
  performedByUserId?: string | null;
  reason?: string | null;
  occurredAt?: unknown;
};

export type RegisterStockMovementWebInput = StockMovementWebContext &
  (
    | {
        type: typeof StockMovementType.IN | typeof StockMovementType.OUT;
        amount: unknown;
      }
    | {
        type: typeof StockMovementType.ADJUSTMENT;
        newBalance: unknown;
        reason: string;
      }
  );

type PreparedStockMovementWebContext = {
  productId: string;
  areaId: string | null;
  farmRecordId: string | null;
  performedByUserId: string | null;
  reason: string | undefined;
  occurredAt: Date | undefined;
};

export type PreparedRegisterStockMovementWebInput =
  PreparedStockMovementWebContext &
    (
      | {
          type: typeof StockMovementType.IN | typeof StockMovementType.OUT;
          amount: string;
        }
      | {
          type: typeof StockMovementType.ADJUSTMENT;
          newBalance: string;
          reason: string;
        }
    );

export type ReverseStockMovementWebInput = {
  movementId: string;
  performedByUserId?: string | null;
  reason: string;
  occurredAt?: unknown;
};

export type PreparedReverseStockMovementWebInput = {
  movementId: string;
  performedByUserId: string | null;
  reason: string;
  occurredAt: Date | undefined;
};

export type CombinedStockMovementWebInput =
  | {
      type: typeof StockMovementType.IN | typeof StockMovementType.OUT;
      amount: unknown;
      reason?: string | null;
      occurredAt?: unknown;
    }
  | {
      type: typeof StockMovementType.ADJUSTMENT;
      newBalance: unknown;
      reason: string;
      occurredAt?: unknown;
    };

export type PreparedCombinedStockMovementWebInput =
  | {
      type: typeof StockMovementType.IN | typeof StockMovementType.OUT;
      amount: string;
      reason: string | undefined;
      occurredAt: Date | undefined;
    }
  | {
      type: typeof StockMovementType.ADJUSTMENT;
      newBalance: string;
      reason: string;
      occurredAt: Date | undefined;
    };

export type CreateFarmRecordWithStockMovementWebInput = {
  farmRecord: CreateFarmRecordWebInput;
  stockMovement: CombinedStockMovementWebInput;
};

export type PreparedCreateFarmRecordWithStockMovementWebInput = {
  farmRecord: PreparedCreateFarmRecordWebInput;
  stockMovement: PreparedCombinedStockMovementWebInput;
};

function invalid(message: string): never {
  throw new RuralWebInputError("INVALID_INPUT", message);
}

function assertNoAuthorityFields(
  value: unknown,
  path = "input",
  visited = new WeakSet<object>(),
  depth = 0,
) {
  if (typeof value !== "object" || value === null) return;
  if (depth > 32) invalid("A entrada excede a profundidade permitida.");
  if (visited.has(value)) invalid("A entrada contém uma referência circular.");
  visited.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoAuthorityFields(item, `${path}[${index}]`, visited, depth + 1),
    );
    return;
  }

  for (const [field, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(value),
  )) {
    if (AUTHORITY_FIELDS.has(field)) {
      throw new RuralWebInputError(
        "AUTHORITY_FIELD_NOT_ALLOWED",
        `O campo de autoridade '${field}' não é aceito nesta operação.`,
      );
    }
    if (!("value" in descriptor)) {
      invalid(`O campo '${path}.${field}' não possui um valor serializável.`);
    }
    assertNoAuthorityFields(
      descriptor.value,
      `${path}.${field}`,
      visited,
      depth + 1,
    );
  }
}

function recordInput(input: unknown, label: string): UnknownRecord {
  assertNoAuthorityFields(input);
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    invalid(`${label} precisa ser um objeto.`);
  }

  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    invalid(`${label} precisa ser um objeto simples.`);
  }
  return input as UnknownRecord;
}

function assertAllowedFields(
  input: UnknownRecord,
  allowedFields: readonly string[],
) {
  const allowed = new Set(allowedFields);
  const unexpected = Object.keys(input).find((field) => !allowed.has(field));
  if (unexpected) invalid(`O campo '${unexpected}' não é aceito nesta operação.`);
}

function requiredString(
  input: UnknownRecord,
  field: string,
  label: string,
  maximumLength: number,
) {
  const value = input[field];
  if (typeof value !== "string" || !value.trim()) {
    invalid(`Informe ${label}.`);
  }
  const normalized = value.trim();
  if (normalized.length > maximumLength) {
    invalid(`${label} excede o tamanho permitido.`);
  }
  return normalized;
}

function optionalString(
  input: UnknownRecord,
  field: string,
  label: string,
  maximumLength: number,
) {
  const value = input[field];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") invalid(`${label} precisa ser um texto.`);
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maximumLength) {
    invalid(`${label} excede o tamanho permitido.`);
  }
  return normalized;
}

function candidateId(
  input: UnknownRecord,
  field: string,
  label: string,
  required: true,
): string;
function candidateId(
  input: UnknownRecord,
  field: string,
  label: string,
  required?: false,
): string | null;
function candidateId(
  input: UnknownRecord,
  field: string,
  label: string,
  required = false,
) {
  const value = input[field];
  if (value === undefined || value === null || value === "") {
    if (required) invalid(`Informe ${label}.`);
    return null;
  }
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > MAX_ID_LENGTH ||
    !ID_PATTERN.test(value)
  ) {
    invalid(`${label} é inválido.`);
  }
  return value;
}

function enumValue<T extends string>(
  input: UnknownRecord,
  field: string,
  label: string,
  values: readonly T[],
): T {
  const value = input[field];
  if (typeof value !== "string" || !values.includes(value as T)) {
    invalid(`${label} é inválido.`);
  }
  return value as T;
}

function aliases(input: UnknownRecord) {
  const value = input.aliases;
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_ALIASES) {
    invalid("Os apelidos informados são inválidos.");
  }

  return value.map((alias, index) => {
    if (
      typeof alias !== "string" ||
      !alias.trim() ||
      alias.trim().length > MAX_NAME_LENGTH
    ) {
      invalid(`O apelido ${index + 1} é inválido.`);
    }
    return alias.trim();
  });
}

function optionalOccurredAt(input: UnknownRecord) {
  return parseOptionalOccurredAt(input.occurredAt) ?? undefined;
}

export function prepareCreateAreaWebInput(
  rawInput: unknown,
): PreparedCreateAreaWebInput {
  const input = recordInput(rawInput, "A entrada da área");
  assertAllowedFields(input, [
    "name",
    "type",
    "size",
    "sizeUnit",
    "note",
    "currentCrop",
    "harvest",
    "soilType",
    "irrigation",
    "estimatedProductivity",
    "productivityUnit",
    "aliases",
  ]);

  return {
    name: requiredString(input, "name", "o nome da área", MAX_NAME_LENGTH),
    type: enumValue(input, "type", "O tipo da área", Object.values(AreaType)),
    size: normalizeOptionalRuralDecimal(input.size),
    sizeUnit: optionalString(
      input,
      "sizeUnit",
      "A unidade de tamanho",
      MAX_SHORT_TEXT_LENGTH,
    ),
    note: optionalString(input, "note", "A observação", MAX_TEXT_LENGTH),
    currentCrop: optionalString(
      input,
      "currentCrop",
      "A cultura atual",
      MAX_SHORT_TEXT_LENGTH,
    ),
    harvest: optionalString(
      input,
      "harvest",
      "A safra",
      MAX_SHORT_TEXT_LENGTH,
    ),
    soilType: optionalString(
      input,
      "soilType",
      "O tipo de solo",
      MAX_SHORT_TEXT_LENGTH,
    ),
    irrigation: optionalString(
      input,
      "irrigation",
      "A irrigação",
      MAX_SHORT_TEXT_LENGTH,
    ),
    estimatedProductivity: normalizeOptionalRuralDecimal(
      input.estimatedProductivity,
    ),
    productivityUnit: optionalString(
      input,
      "productivityUnit",
      "A unidade de produtividade",
      MAX_SHORT_TEXT_LENGTH,
    ),
    aliases: aliases(input),
  };
}

export function prepareUpdateAreaWebInput(
  rawInput: unknown,
): PreparedUpdateAreaWebInput {
  const input = recordInput(rawInput, "A entrada da edição da área");
  assertAllowedFields(input, [
    "areaId",
    "name",
    "type",
    "size",
    "sizeUnit",
    "note",
    "currentCrop",
    "harvest",
    "soilType",
    "irrigation",
    "estimatedProductivity",
    "productivityUnit",
  ]);

  return {
    areaId: candidateId(input, "areaId", "a área", true),
    name: requiredString(input, "name", "o nome da área", MAX_NAME_LENGTH),
    type: enumValue(input, "type", "O tipo da área", Object.values(AreaType)),
    size: normalizeOptionalRuralDecimal(input.size),
    sizeUnit: optionalString(
      input,
      "sizeUnit",
      "A unidade de tamanho",
      MAX_SHORT_TEXT_LENGTH,
    ),
    note: optionalString(input, "note", "A observação", MAX_TEXT_LENGTH),
    currentCrop: optionalString(
      input,
      "currentCrop",
      "A cultura atual",
      MAX_SHORT_TEXT_LENGTH,
    ),
    harvest: optionalString(
      input,
      "harvest",
      "A safra",
      MAX_SHORT_TEXT_LENGTH,
    ),
    soilType: optionalString(
      input,
      "soilType",
      "O tipo de solo",
      MAX_SHORT_TEXT_LENGTH,
    ),
    irrigation: optionalString(
      input,
      "irrigation",
      "A irrigação",
      MAX_SHORT_TEXT_LENGTH,
    ),
    estimatedProductivity: normalizeOptionalRuralDecimal(
      input.estimatedProductivity,
    ),
    productivityUnit: optionalString(
      input,
      "productivityUnit",
      "A unidade de produtividade",
      MAX_SHORT_TEXT_LENGTH,
    ),
  };
}

export function prepareCreateStockProductWebInput(
  rawInput: unknown,
): PreparedCreateStockProductWebInput {
  const input = recordInput(rawInput, "A entrada do produto");
  assertAllowedFields(input, [
    "name",
    "category",
    "initialQuantity",
    "unit",
    "minimumStock",
    "storageLocation",
    "note",
    "supplier",
    "unitValue",
    "expirationDate",
    "batchNumber",
    "purchaseDate",
    "technicalNote",
    "aliases",
  ]);

  return {
    name: requiredString(input, "name", "o nome do produto", MAX_NAME_LENGTH),
    category: enumValue(
      input,
      "category",
      "A categoria do produto",
      Object.values(ProductCategory),
    ),
    initialQuantity: normalizeRuralDecimal(input.initialQuantity),
    unit: requiredString(input, "unit", "a unidade do produto", 64),
    minimumStock: normalizeOptionalRuralDecimal(input.minimumStock),
    storageLocation: optionalString(
      input,
      "storageLocation",
      "O local de armazenamento",
      MAX_SHORT_TEXT_LENGTH,
    ),
    note: optionalString(input, "note", "A observação", MAX_TEXT_LENGTH),
    supplier: optionalString(
      input,
      "supplier",
      "O fornecedor",
      MAX_SHORT_TEXT_LENGTH,
    ),
    unitValue: normalizeOptionalRuralDecimal(input.unitValue),
    expirationDate: parseOptionalDatabaseDate(input.expirationDate),
    batchNumber: optionalString(
      input,
      "batchNumber",
      "O número do lote",
      MAX_SHORT_TEXT_LENGTH,
    ),
    purchaseDate: parseOptionalDatabaseDate(input.purchaseDate),
    technicalNote: optionalString(
      input,
      "technicalNote",
      "A observação técnica",
      MAX_TEXT_LENGTH,
    ),
    aliases: aliases(input),
  };
}

export function prepareUpdateStockProductWebInput(
  rawInput: unknown,
): PreparedUpdateStockProductWebInput {
  const input = recordInput(rawInput, "A entrada da edição do produto");
  assertAllowedFields(input, [
    "productId",
    "name",
    "category",
    "unit",
    "minimumStock",
    "storageLocation",
    "note",
    "supplier",
    "unitValue",
    "expirationDate",
    "batchNumber",
    "purchaseDate",
    "technicalNote",
  ]);

  return {
    productId: candidateId(input, "productId", "o produto", true),
    name: requiredString(input, "name", "o nome do produto", MAX_NAME_LENGTH),
    category: enumValue(
      input,
      "category",
      "A categoria do produto",
      Object.values(ProductCategory),
    ),
    unit: requiredString(input, "unit", "a unidade do produto", 64),
    minimumStock: normalizeOptionalRuralDecimal(input.minimumStock),
    storageLocation: optionalString(
      input,
      "storageLocation",
      "O local de armazenamento",
      MAX_SHORT_TEXT_LENGTH,
    ),
    note: optionalString(input, "note", "A observação", MAX_TEXT_LENGTH),
    supplier: optionalString(
      input,
      "supplier",
      "O fornecedor",
      MAX_SHORT_TEXT_LENGTH,
    ),
    unitValue: normalizeOptionalRuralDecimal(input.unitValue),
    expirationDate: parseOptionalDatabaseDate(input.expirationDate),
    batchNumber: optionalString(
      input,
      "batchNumber",
      "O número do lote",
      MAX_SHORT_TEXT_LENGTH,
    ),
    purchaseDate: parseOptionalDatabaseDate(input.purchaseDate),
    technicalNote: optionalString(
      input,
      "technicalNote",
      "A observação técnica",
      MAX_TEXT_LENGTH,
    ),
  };
}

export function prepareCreateFarmRecordWebInput(
  rawInput: unknown,
): PreparedCreateFarmRecordWebInput {
  const input = recordInput(rawInput, "A entrada da anotação");
  assertAllowedFields(input, [
    "areaId",
    "productId",
    "performedByUserId",
    "type",
    "description",
    "locationDescription",
    "occurredAt",
    "quantity",
    "quantityUnit",
    "value",
    "responsibleName",
    "appliedDose",
    "doseUnit",
    "harvest",
    "supplier",
    "productBatch",
    "technicalNote",
  ]);

  return {
    areaId: candidateId(input, "areaId", "A área"),
    productId: candidateId(input, "productId", "O produto"),
    performedByUserId: candidateId(
      input,
      "performedByUserId",
      "O executor",
    ),
    type: enumValue(
      input,
      "type",
      "O tipo da anotação",
      Object.values(FarmRecordType),
    ),
    description: requiredString(
      input,
      "description",
      "a descrição da anotação",
      MAX_TEXT_LENGTH,
    ),
    locationDescription: optionalString(
      input,
      "locationDescription",
      "A descrição do local",
      MAX_SHORT_TEXT_LENGTH,
    ),
    occurredAt: optionalOccurredAt(input),
    quantity: normalizeOptionalRuralDecimal(input.quantity),
    quantityUnit: optionalString(
      input,
      "quantityUnit",
      "A unidade da quantidade",
      64,
    ),
    value: normalizeOptionalRuralDecimal(input.value),
    responsibleName: optionalString(
      input,
      "responsibleName",
      "O nome do responsável",
      MAX_SHORT_TEXT_LENGTH,
    ),
    appliedDose: normalizeOptionalRuralDecimal(input.appliedDose),
    doseUnit: optionalString(input, "doseUnit", "A unidade da dose", 64),
    harvest: optionalString(
      input,
      "harvest",
      "A safra",
      MAX_SHORT_TEXT_LENGTH,
    ),
    supplier: optionalString(
      input,
      "supplier",
      "O fornecedor",
      MAX_SHORT_TEXT_LENGTH,
    ),
    productBatch: optionalString(
      input,
      "productBatch",
      "O lote do produto",
      MAX_SHORT_TEXT_LENGTH,
    ),
    technicalNote: optionalString(
      input,
      "technicalNote",
      "A observação técnica",
      MAX_TEXT_LENGTH,
    ),
  };
}

export function prepareAdjustStockWebInput(
  rawInput: unknown,
): PreparedAdjustStockWebInput {
  const input = recordInput(rawInput, "A entrada do ajuste de estoque");
  assertAllowedFields(input, ["productId", "targetQuantity", "reason"]);

  return {
    productId: candidateId(input, "productId", "o produto", true),
    targetQuantity: normalizeRuralDecimal(input.targetQuantity),
    reason: requiredString(
      input,
      "reason",
      "o motivo do ajuste",
      MAX_REASON_LENGTH,
    ),
  };
}

export function prepareRegisterStockMovementWebInput(
  rawInput: unknown,
): PreparedRegisterStockMovementWebInput {
  const input = recordInput(rawInput, "A entrada da movimentação");
  assertAllowedFields(input, [
    "productId",
    "areaId",
    "farmRecordId",
    "performedByUserId",
    "type",
    "amount",
    "newBalance",
    "reason",
    "occurredAt",
  ]);

  const type = enumValue(
    input,
    "type",
    "O tipo da movimentação",
    [StockMovementType.IN, StockMovementType.OUT, StockMovementType.ADJUSTMENT],
  );
  const context: PreparedStockMovementWebContext = {
    productId: candidateId(input, "productId", "o produto", true),
    areaId: candidateId(input, "areaId", "A área"),
    farmRecordId: candidateId(input, "farmRecordId", "A anotação"),
    performedByUserId: candidateId(
      input,
      "performedByUserId",
      "O executor",
    ),
    reason:
      optionalString(input, "reason", "O motivo", MAX_REASON_LENGTH) ??
      undefined,
    occurredAt: optionalOccurredAt(input),
  };

  if (type === StockMovementType.ADJUSTMENT) {
    if (Object.hasOwn(input, "amount")) {
      invalid("Ajustes aceitam novo saldo, não uma quantidade de movimento.");
    }
    return {
      ...context,
      type,
      newBalance: normalizeRuralDecimal(input.newBalance),
      reason: requiredString(
        input,
        "reason",
        "o motivo do ajuste",
        MAX_REASON_LENGTH,
      ),
    };
  }

  if (Object.hasOwn(input, "newBalance")) {
    invalid("Entradas e saídas aceitam quantidade, não um novo saldo.");
  }
  return {
    ...context,
    type,
    amount: normalizeRuralDecimal(input.amount),
  };
}

export function prepareReverseStockMovementWebInput(
  rawInput: unknown,
): PreparedReverseStockMovementWebInput {
  const input = recordInput(rawInput, "A entrada da reversão");
  assertAllowedFields(input, [
    "movementId",
    "performedByUserId",
    "reason",
    "occurredAt",
  ]);

  return {
    movementId: candidateId(input, "movementId", "a movimentação", true),
    performedByUserId: candidateId(
      input,
      "performedByUserId",
      "O executor",
    ),
    reason: requiredString(
      input,
      "reason",
      "o motivo da reversão",
      MAX_REASON_LENGTH,
    ),
    occurredAt: optionalOccurredAt(input),
  };
}

function prepareCombinedStockMovementWebInput(
  rawInput: unknown,
): PreparedCombinedStockMovementWebInput {
  const input = recordInput(rawInput, "A movimentação combinada");
  assertAllowedFields(input, [
    "type",
    "amount",
    "newBalance",
    "reason",
    "occurredAt",
  ]);
  const type = enumValue(
    input,
    "type",
    "O tipo da movimentação",
    [StockMovementType.IN, StockMovementType.OUT, StockMovementType.ADJUSTMENT],
  );
  const occurredAt = optionalOccurredAt(input);

  if (type === StockMovementType.ADJUSTMENT) {
    if (Object.hasOwn(input, "amount")) {
      invalid("Ajustes aceitam novo saldo, não uma quantidade de movimento.");
    }
    return {
      type,
      newBalance: normalizeRuralDecimal(input.newBalance),
      reason: requiredString(
        input,
        "reason",
        "o motivo do ajuste",
        MAX_REASON_LENGTH,
      ),
      occurredAt,
    };
  }

  if (Object.hasOwn(input, "newBalance")) {
    invalid("Entradas e saídas aceitam quantidade, não um novo saldo.");
  }
  return {
    type,
    amount: normalizeRuralDecimal(input.amount),
    reason:
      optionalString(input, "reason", "O motivo", MAX_REASON_LENGTH) ??
      undefined,
    occurredAt,
  };
}

export function prepareCreateFarmRecordWithStockMovementWebInput(
  rawInput: unknown,
): PreparedCreateFarmRecordWithStockMovementWebInput {
  const input = recordInput(rawInput, "A entrada da operação combinada");
  assertAllowedFields(input, ["farmRecord", "stockMovement"]);

  if (!Object.hasOwn(input, "farmRecord")) {
    invalid("Informe a anotação da operação combinada.");
  }
  if (!Object.hasOwn(input, "stockMovement")) {
    invalid("Informe a movimentação da operação combinada.");
  }

  return {
    farmRecord: prepareCreateFarmRecordWebInput(input.farmRecord),
    stockMovement: prepareCombinedStockMovementWebInput(input.stockMovement),
  };
}
