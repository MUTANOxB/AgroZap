import "server-only";

import bcrypt from "bcryptjs";

export const PASSWORD_HASH_ROUNDS = 12;
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

export type PasswordValidationErrorCode =
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_TOO_LONG"
  | "PASSWORD_BCRYPT_TRUNCATED";

export class PasswordValidationError extends Error {
  constructor(
    public readonly code: PasswordValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PasswordValidationError";
  }
}

/** Valida comprimento em caracteres e também o limite de 72 bytes do bcrypt. */
export function assertValidPassword(password: string): void {
  const characterLength = Array.from(password).length;

  if (characterLength < MIN_PASSWORD_LENGTH) {
    throw new PasswordValidationError(
      "PASSWORD_TOO_SHORT",
      `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    );
  }

  if (characterLength > MAX_PASSWORD_LENGTH) {
    throw new PasswordValidationError(
      "PASSWORD_TOO_LONG",
      `A senha deve ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`,
    );
  }

  if (bcrypt.truncates(password)) {
    throw new PasswordValidationError(
      "PASSWORD_BCRYPT_TRUNCATED",
      "A senha excede o limite seguro de bytes do bcrypt.",
    );
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertValidPassword(password);
  return bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    assertValidPassword(password);
    if (!passwordHash) return false;
    return await bcrypt.compare(password, passwordHash);
  } catch {
    return false;
  }
}
