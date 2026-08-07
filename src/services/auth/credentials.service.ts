import "server-only";

import { randomBytes } from "node:crypto";
import { db } from "@/lib/prisma";
import { InvalidPhoneError, normalizePhone } from "./phone";
import { hashPassword, verifyPassword } from "./password";

export type CredentialsInput = {
  phone: unknown;
  password: unknown;
};

export type AuthenticatedIdentity = {
  id: string;
  name: string;
};

let unavailableAccountHashPromise: Promise<string> | null = null;

function getUnavailableAccountHash() {
  unavailableAccountHashPromise ??= hashPassword(
    randomBytes(24).toString("base64url"),
  );
  return unavailableAccountHashPromise;
}

/**
 * Valida as credenciais contra o User real. Todos os casos de credencial
 * recusada retornam null para que a camada de UI use uma mensagem única.
 */
export async function authenticateCredentials(
  input: CredentialsInput,
): Promise<AuthenticatedIdentity | null> {
  if (typeof input.phone !== "string" || typeof input.password !== "string") {
    return null;
  }

  let phone: string;
  try {
    phone = normalizePhone(input.phone);
  } catch (error) {
    if (error instanceof InvalidPhoneError) return null;
    throw error;
  }

  const user = await db.user.findUnique({
    where: { phone },
    select: {
      id: true,
      name: true,
      passwordHash: true,
      deactivatedAt: true,
    },
  });

  // Uma conta inexistente ou ainda sem senha percorre uma comparação bcrypt
  // equivalente. A mensagem já é genérica; isto também reduz a diferença
  // temporal que poderia ajudar na enumeração de telefones.
  const passwordHash = user?.passwordHash ?? (await getUnavailableAccountHash());
  const passwordMatches = await verifyPassword(input.password, passwordHash);

  if (
    !user ||
    user.deactivatedAt !== null ||
    !user.passwordHash ||
    !passwordMatches
  ) {
    return null;
  }

  return { id: user.id, name: user.name };
}
