const ALLOWED_PHONE_CHARACTERS = /^\+?[0-9 ().-]+$/;
const BRAZIL_COUNTRY_CODE = "55";
const BRAZIL_NATIONAL_LENGTHS = new Set([10, 11]);
const BRAZIL_INTERNATIONAL_LENGTHS = new Set([12, 13]);

export class InvalidPhoneError extends Error {
  readonly code = "INVALID_PHONE" as const;

  constructor(message = "Informe um telefone brasileiro válido.") {
    super(message);
    this.name = "InvalidPhoneError";
  }
}

function invalidPhone(): never {
  throw new InvalidPhoneError();
}

/**
 * Normaliza os formatos brasileiros aceitos pelo AgroZap para +55 seguido do
 * DDD e do número. A validação é intencionalmente estrutural: os telefones de
 * demonstração do projeto não representam linhas públicas reais.
 */
export function normalizePhone(input: string): string {
  const value = input.trim();

  if (!value || value.length > 64 || !ALLOWED_PHONE_CHARACTERS.test(value)) {
    return invalidPhone();
  }

  const hasExplicitCountryCode = value.startsWith("+");
  const digits = value.replace(/[^0-9]/g, "");

  if (hasExplicitCountryCode) {
    if (
      !digits.startsWith(BRAZIL_COUNTRY_CODE) ||
      !BRAZIL_INTERNATIONAL_LENGTHS.has(digits.length)
    ) {
      return invalidPhone();
    }

    return `+${digits}`;
  }

  if (BRAZIL_NATIONAL_LENGTHS.has(digits.length)) {
    return `+${BRAZIL_COUNTRY_CODE}${digits}`;
  }

  if (
    digits.startsWith(BRAZIL_COUNTRY_CODE) &&
    BRAZIL_INTERNATIONAL_LENGTHS.has(digits.length)
  ) {
    return `+${digits}`;
  }

  return invalidPhone();
}
