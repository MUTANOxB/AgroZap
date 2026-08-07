import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import { normalizePhone } from "@/services/auth/phone";
import { hashPassword } from "@/services/auth/password";

dotenv.config({ override: false, quiet: true });

const LOCAL_DATABASE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);
const DEVELOPMENT_DATABASE_NAME = "agrozap";
const FORBIDDEN_CONNECTION_OVERRIDE_KEYS = new Set([
  "database",
  "dbname",
  "host",
  "hostaddr",
]);

class DevPasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DevPasswordError";
  }
}

function requireSafeLocalDatabaseUrl(): void {
  const rawDatabaseUrl = process.env.DATABASE_URL?.trim();
  if (!rawDatabaseUrl) {
    throw new DevPasswordError("DATABASE_URL não foi configurada.");
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(rawDatabaseUrl);
  } catch {
    throw new DevPasswordError("DATABASE_URL não contém uma URL válida.");
  }

  if (databaseUrl.protocol !== "postgresql:" && databaseUrl.protocol !== "postgres:") {
    throw new DevPasswordError("O script aceita somente PostgreSQL local.");
  }

  const hasConnectionOverride = [...databaseUrl.searchParams.keys()].some(
    (key) =>
      FORBIDDEN_CONNECTION_OVERRIDE_KEYS.has(key.toLocaleLowerCase("en-US")),
  );
  if (
    hasConnectionOverride ||
    !LOCAL_DATABASE_HOSTS.has(databaseUrl.hostname.toLowerCase())
  ) {
    throw new DevPasswordError(
      "Operação recusada: o PostgreSQL precisa estar em localhost, 127.0.0.1 ou [::1].",
    );
  }

  const databaseName = decodeURIComponent(databaseUrl.pathname).replace(/^\/+/, "");
  if (databaseName !== DEVELOPMENT_DATABASE_NAME) {
    throw new DevPasswordError(
      `Operação recusada: use somente o banco local ${DEVELOPMENT_DATABASE_NAME}.`,
    );
  }
}

function readTargetPhone(): string {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    throw new DevPasswordError(
      "Uso: npm run auth:dev-password -- <telefone-do-usuário>",
    );
  }

  try {
    return normalizePhone(args[0]);
  } catch {
    throw new DevPasswordError("Informe um telefone brasileiro válido.");
  }
}

async function main() {
  if (process.env.NODE_ENV?.trim().toLowerCase() === "production") {
    throw new DevPasswordError("Este script não pode ser executado em produção.");
  }

  requireSafeLocalDatabaseUrl();
  const phone = readTargetPhone();
  const temporaryPassword = randomBytes(24).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);

  // O Prisma só é carregado depois de todas as guardas de ambiente e host.
  const { db } = await import("@/lib/prisma");

  try {
    const user = await db.user.findUnique({
      where: { phone },
      select: { id: true, deactivatedAt: true },
    });

    if (!user) {
      throw new DevPasswordError("Usuário não encontrado.");
    }
    if (user.deactivatedAt !== null) {
      throw new DevPasswordError("O usuário está desativado.");
    }

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
      select: { id: true },
    });

    console.log(
      `Senha temporária gerada (ela será exibida somente agora):\n${temporaryPassword}`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof DevPasswordError) {
    console.error(error.message);
  } else {
    console.error("Não foi possível configurar a senha temporária no banco local.");
  }
  process.exitCode = 1;
});
