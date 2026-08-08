import "server-only";

import { tryNormalizeRuralDecimal } from "./rural-decimal";

export type RuralInputErrorCode =
  | "EMPTY_VALUE"
  | "INVALID_DECIMAL"
  | "AMBIGUOUS_DECIMAL"
  | "INVALID_DATE"
  | "INVALID_OCCURRED_AT";

export class RuralInputError extends Error {
  constructor(
    public readonly code: RuralInputErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RuralInputError";
  }
}

const DATABASE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ZONED_DATE_TIME =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/;

function requiredString(value: unknown, kind: "decimal" | "date") {
  if (typeof value !== "string") {
    throw new RuralInputError(
      kind === "decimal" ? "INVALID_DECIMAL" : "INVALID_DATE",
      kind === "decimal"
        ? "Informe um número válido."
        : "Informe uma data válida.",
    );
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new RuralInputError("EMPTY_VALUE", "O valor não pode ficar vazio.");
  }
  return normalized;
}

/**
 * Aceita decimal canônico e formatos brasileiros inequívocos. Um único ponto
 * com exatamente três casas (por exemplo, 1.234) é recusado porque pode
 * significar tanto 1,234 quanto 1234.
 */
export function normalizeRuralDecimal(value: unknown): string {
  const result = tryNormalizeRuralDecimal(value);
  if (result.ok) return result.value;

  if (result.reason === "EMPTY_VALUE") {
    throw new RuralInputError("EMPTY_VALUE", "O valor não pode ficar vazio.");
  }
  if (result.reason === "AMBIGUOUS_DECIMAL") {
    throw new RuralInputError(
      "AMBIGUOUS_DECIMAL",
      "O número é ambíguo. Use vírgula para decimais ou informe os milhares sem separador.",
    );
  }
  throw new RuralInputError(
    "INVALID_DECIMAL",
    "Informe um número válido em formato brasileiro ou decimal canônico.",
  );
}

export function normalizeOptionalRuralDecimal(value: unknown): string | null {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  return normalizeRuralDecimal(value);
}

export function parseDatabaseDate(value: unknown): Date {
  const input = requiredString(value, "date");
  const match = DATABASE_DATE.exec(input);
  if (!match || Number(match[1]) === 0) {
    throw new RuralInputError(
      "INVALID_DATE",
      "Informe a data no formato YYYY-MM-DD.",
    );
  }

  const parsed = new Date(`${input}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== input
  ) {
    throw new RuralInputError("INVALID_DATE", "A data informada não existe.");
  }
  return parsed;
}

export function parseOptionalDatabaseDate(value: unknown): Date | null {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  return parseDatabaseDate(value);
}

/**
 * Datas sem horário usam 12:00Z como âncora estável. Quando há horário, o
 * offset (ou Z) é obrigatório para que o timezone do navegador não decida o
 * instante silenciosamente.
 */
export function parseOccurredAt(value: unknown): Date {
  const input = requiredString(value, "date");

  if (DATABASE_DATE.test(input)) {
    parseDatabaseDate(input);
    return new Date(`${input}T12:00:00.000Z`);
  }

  const match = ZONED_DATE_TIME.exec(input);
  if (!match) {
    throw new RuralInputError(
      "INVALID_OCCURRED_AT",
      "Informe data e horário com Z ou offset explícito.",
    );
  }

  parseDatabaseDate(match[1]);
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  const seconds = match[4] === undefined ? 0 : Number(match[4]);
  const zone = match[6];
  const zoneParts = zone === "Z" ? null : zone.slice(1).split(":").map(Number);

  if (
    hours > 23 ||
    minutes > 59 ||
    seconds > 59 ||
    (zoneParts && (zoneParts[0] > 23 || zoneParts[1] > 59))
  ) {
    throw new RuralInputError(
      "INVALID_OCCURRED_AT",
      "A data ou o horário informado é inválido.",
    );
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new RuralInputError(
      "INVALID_OCCURRED_AT",
      "A data ou o horário informado é inválido.",
    );
  }
  return parsed;
}

export function parseOptionalOccurredAt(value: unknown): Date | null {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  return parseOccurredAt(value);
}
