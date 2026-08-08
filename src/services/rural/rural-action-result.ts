import { PropertyCapabilityError } from "@/services/autorizacao/property-capability-guard";
import { RuralInputError } from "@/services/rural/rural-input-normalization";
import { RuralWebInputError } from "@/services/rural/rural-web-inputs";

export type RuralActionError = {
  code: string;
  message: string;
};

export type RuralActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: RuralActionError };

const INTERNAL_ERROR: RuralActionError = Object.freeze({
  code: "INTERNAL_ERROR",
  message: "Não foi possível concluir a operação.",
});

const DOMAIN_ERROR_NAMES = new Set([
  "AreaDomainError",
  "StockProductDomainError",
  "FarmRecordDomainError",
  "StockDomainError",
]);

const DOMAIN_ERROR_CODES = new Set([
  "INVALID_AREA",
  "INVALID_PRODUCT",
  "INVALID_RECORD",
  "INVALID_QUANTITY",
  "INVALID_REVERSAL",
  "PROPERTY_NOT_ACTIVE",
  "PROPERTY_NOT_FOUND",
  "PRODUCT_NOT_FOUND",
  "RELATED_ENTITY_NOT_FOUND",
  "USER_NOT_ACTIVE_PROPERTY_MEMBER",
  "WEB_ACTOR_REQUIRED",
  "AREA_NAME_ALREADY_USED",
  "PRODUCT_NAME_ALREADY_USED",
  "INSUFFICIENT_STOCK",
  "MOVEMENT_NOT_FOUND",
  "MOVEMENT_ALREADY_REVERSED",
  "FARM_RECORD_MOVEMENT_MISMATCH",
  "CONCURRENCY_CONFLICT",
]);

function knownDomainError(error: unknown): RuralActionError | null {
  if (!(error instanceof Error) || !DOMAIN_ERROR_NAMES.has(error.name)) {
    return null;
  }

  const code = (error as Error & { code?: unknown }).code;
  if (typeof code !== "string" || !DOMAIN_ERROR_CODES.has(code)) return null;

  return { code, message: error.message };
}

export function ruralActionSuccess<T>(data: T): RuralActionResult<T> {
  return { ok: true, data };
}

export function ruralActionFailure(error: unknown): RuralActionResult<never> {
  if (error instanceof RuralWebInputError) {
    return {
      ok: false,
      error: { code: error.code, message: error.message },
    };
  }

  if (error instanceof RuralInputError) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: error.message },
    };
  }

  if (error instanceof PropertyCapabilityError) {
    return {
      ok: false,
      error: { code: error.code, message: error.message },
    };
  }

  const domainError = knownDomainError(error);
  if (domainError) return { ok: false, error: domainError };

  return { ok: false, error: { ...INTERNAL_ERROR } };
}
