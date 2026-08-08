const INTEGER = /^[+-]?\d+$/;
const COMMA_DECIMAL = /^[+-]?\d+,\d+$/;
const CANONICAL_DECIMAL = /^[+-]?\d+\.\d+$/;
const BRAZILIAN_DECIMAL = /^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/;
const BRAZILIAN_INTEGER = /^[+-]?\d{1,3}(?:\.\d{3})+$/;

export type RuralDecimalNormalizationResult =
  | { ok: true; value: string }
  | { ok: false; reason: "EMPTY_VALUE" | "INVALID_DECIMAL" | "AMBIGUOUS_DECIMAL" };

function canonicalizeDecimal(value: string) {
  const negative = value.startsWith("-");
  const unsigned = value.replace(/^[+-]/, "");
  const [integerPart, fractionPart] = unsigned.split(".");
  const integer = integerPart.replace(/^0+(?=\d)/, "") || "0";
  const fraction = fractionPart?.replace(/0+$/, "") ?? "";
  const canonical = fraction ? `${integer}.${fraction}` : integer;
  return negative && canonical !== "0" ? `-${canonical}` : canonical;
}

/**
 * Normaliza somente a representação canônica usada nos DTOs e no domínio.
 * Diferentemente do parser de entrada humana, `1.234` significa sempre milésimos.
 */
export function tryNormalizeCanonicalRuralDecimal(
  value: unknown,
): RuralDecimalNormalizationResult {
  if (typeof value !== "string") {
    return { ok: false, reason: "INVALID_DECIMAL" };
  }

  const input = value.trim();
  if (!input) return { ok: false, reason: "EMPTY_VALUE" };
  if (!INTEGER.test(input) && !CANONICAL_DECIMAL.test(input)) {
    return { ok: false, reason: "INVALID_DECIMAL" };
  }

  return { ok: true, value: canonicalizeDecimal(input) };
}

/**
 * Confere se um decimal canônico pode ser persistido sem arredondamento nem
 * overflow em uma coluna `Decimal(precision, scale)`.
 */
export function fitsRuralDecimalStorage(
  value: unknown,
  precision: number,
  scale: number,
) {
  if (
    !Number.isInteger(precision) ||
    !Number.isInteger(scale) ||
    precision <= 0 ||
    scale < 0 ||
    scale > precision
  ) {
    return false;
  }

  const normalized = tryNormalizeCanonicalRuralDecimal(value);
  if (!normalized.ok) return false;

  const unsigned = normalized.value.replace(/^-/, "");
  const [integer, fraction = ""] = unsigned.split(".");
  const integerDigits = integer === "0" ? 0 : integer.length;
  return integerDigits <= precision - scale && fraction.length <= scale;
}

/**
 * Parser decimal compartilhado entre o preview client-side e o boundary WEB.
 * A fronteira server-side converte as falhas nos erros seguros do domínio.
 */
export function tryNormalizeRuralDecimal(
  value: unknown,
): RuralDecimalNormalizationResult {
  if (typeof value !== "string") {
    return { ok: false, reason: "INVALID_DECIMAL" };
  }

  const input = value.trim();
  if (!input) return { ok: false, reason: "EMPTY_VALUE" };
  const dotCount = (input.match(/\./g) ?? []).length;
  let canonicalCandidate: string | null = null;

  if (INTEGER.test(input)) {
    canonicalCandidate = input;
  } else if (BRAZILIAN_DECIMAL.test(input)) {
    canonicalCandidate = input.replaceAll(".", "").replace(",", ".");
  } else if (COMMA_DECIMAL.test(input)) {
    canonicalCandidate = input.replace(",", ".");
  } else if (BRAZILIAN_INTEGER.test(input)) {
    if (dotCount === 1) {
      return { ok: false, reason: "AMBIGUOUS_DECIMAL" };
    }
    canonicalCandidate = input.replaceAll(".", "");
  } else if (CANONICAL_DECIMAL.test(input)) {
    canonicalCandidate = input;
  }

  return canonicalCandidate === null
    ? { ok: false, reason: "INVALID_DECIMAL" }
    : { ok: true, value: canonicalizeDecimal(canonicalCandidate) };
}
