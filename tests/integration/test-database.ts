import { Client } from "pg";

export const INTEGRATION_REFUSAL_MESSAGE =
  "Testes de integração recusados: use um banco PostgreSQL local exclusivo de teste.";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const FORBIDDEN_DATABASES = new Set([
  "agrozap",
  "postgres",
  "template0",
  "template1",
]);
const SAFE_DATABASE_NAME = /^[A-Za-z0-9_]+$/;
const TEST_DATABASE_TOKEN = /(^|_)test($|_)/i;
const TARGET_OVERRIDE_PARAMETERS = new Set([
  "host",
  "port",
  "database",
  "dbname",
  "db",
]);
const DOTENV_CONTROL_VARIABLES = [
  "DOTENV_CONFIG_ENCODING",
  "DOTENV_CONFIG_PATH",
  "DOTENV_CONFIG_QUIET",
  "DOTENV_CONFIG_DEBUG",
  "DOTENV_CONFIG_OVERRIDE",
  "DOTENV_CONFIG_DOTENV_KEY",
  "DOTENV_KEY",
] as const;

type DatabaseEnvironment = {
  [key: string]: string | undefined;
  DATABASE_URL?: string;
  TEST_DATABASE_URL?: string;
};

type IntegrationRuntimeEnvironment = DatabaseEnvironment & {
  AGROZAP_INTEGRATION_TEST?: string;
};

export type SafeTestDatabase = {
  connectionString: string;
  database: string;
  host: string;
  port: string;
  source: "TEST_DATABASE_URL" | "derived";
};

export class TestDatabaseSafetyError extends Error {
  constructor(public readonly reason: string) {
    super(INTEGRATION_REFUSAL_MESSAGE);
    this.name = "TestDatabaseSafetyError";
  }
}

function refuse(reason: string): never {
  throw new TestDatabaseSafetyError(reason);
}

function parsePostgresUrl(value: string, variableName: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    refuse(`${variableName} não contém uma URL válida.`);
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    refuse(`${variableName} precisa usar PostgreSQL.`);
  }

  for (const parameter of url.searchParams.keys()) {
    if (TARGET_OVERRIDE_PARAMETERS.has(parameter.toLocaleLowerCase("en-US"))) {
      refuse(`${variableName} não pode sobrescrever host ou database por parâmetro.`);
    }
  }

  if (!url.port) url.port = "5432";

  let database: string;
  try {
    database = decodeURIComponent(url.pathname.slice(1));
  } catch {
    refuse(`${variableName} contém um nome de database inválido.`);
  }

  if (!database) {
    refuse(`${variableName} precisa informar o database.`);
  }

  return { url, database };
}

function validateTestDatabaseName(database: string) {
  const normalized = database.toLocaleLowerCase("en-US");

  if (!SAFE_DATABASE_NAME.test(database)) {
    refuse("O nome do database de teste precisa conter apenas letras, números e underscore.");
  }
  if (!TEST_DATABASE_TOKEN.test(normalized)) {
    refuse("O nome do database precisa conter 'test' como segmento explícito.");
  }
  if (FORBIDDEN_DATABASES.has(normalized)) {
    refuse("O database informado é protegido e nunca pode ser recriado.");
  }
}

function effectivePort(url: URL) {
  return url.port || "5432";
}

export function resolveSafeTestDatabase(
  environment: DatabaseEnvironment,
): SafeTestDatabase {
  const developmentValue = environment.DATABASE_URL?.trim();
  const explicitTestValue = environment.TEST_DATABASE_URL?.trim();

  if (!developmentValue) {
    refuse("DATABASE_URL está ausente; não é possível comparar o banco normal com o de teste.");
  }

  let candidateValue = explicitTestValue;
  let source: SafeTestDatabase["source"] = "TEST_DATABASE_URL";

  if (!candidateValue) {
    const development = parsePostgresUrl(developmentValue, "DATABASE_URL");
    const derived = new URL(development.url.href);
    derived.pathname = "/agrozap_test";
    candidateValue = derived.href;
    source = "derived";
  }

  const candidate = parsePostgresUrl(candidateValue, "TEST_DATABASE_URL");
  const host = candidate.url.hostname.toLocaleLowerCase("en-US");

  if (!LOCAL_HOSTS.has(host)) {
    refuse("O PostgreSQL de integração precisa estar em localhost ou 127.0.0.1.");
  }
  validateTestDatabaseName(candidate.database);

  const development = parsePostgresUrl(developmentValue, "DATABASE_URL");
  const sameEndpoint =
    development.url.hostname.toLocaleLowerCase("en-US") === host &&
    effectivePort(development.url) === effectivePort(candidate.url) &&
    development.database === candidate.database;

  if (
    development.url.href === candidate.url.href ||
    development.database === candidate.database ||
    sameEndpoint
  ) {
    refuse("O database de teste não pode ser o mesmo database de desenvolvimento.");
  }

  return {
    connectionString: candidate.url.href,
    database: candidate.database,
    host,
    port: effectivePort(candidate.url),
    source,
  };
}

export function assertSafeIntegrationRuntime(
  environment: IntegrationRuntimeEnvironment,
) {
  if (environment.AGROZAP_INTEGRATION_TEST !== "1") {
    refuse("O marcador interno do runner de integração está ausente.");
  }

  const activeValue = environment.DATABASE_URL?.trim();
  const testValue = environment.TEST_DATABASE_URL?.trim();
  if (!activeValue || !testValue) {
    refuse("O processo de teste não recebeu as duas referências ao banco isolado.");
  }

  const active = parsePostgresUrl(activeValue, "DATABASE_URL");
  const test = parsePostgresUrl(testValue, "TEST_DATABASE_URL");
  const activeHost = active.url.hostname.toLocaleLowerCase("en-US");
  const testHost = test.url.hostname.toLocaleLowerCase("en-US");

  validateTestDatabaseName(active.database);
  validateTestDatabaseName(test.database);
  if (!LOCAL_HOSTS.has(activeHost) || !LOCAL_HOSTS.has(testHost)) {
    refuse("O processo de teste tentou usar um host não local.");
  }
  if (
    activeHost !== testHost ||
    effectivePort(active.url) !== effectivePort(test.url) ||
    active.database !== test.database
  ) {
    refuse("DATABASE_URL não aponta para o banco exclusivo validado pelo runner.");
  }
}

export function buildSafeIntegrationEnvironment(
  parentEnvironment: DatabaseEnvironment,
  connectionString: string,
) {
  const childEnvironment: DatabaseEnvironment = { ...parentEnvironment };
  for (const variable of DOTENV_CONTROL_VARIABLES) {
    delete childEnvironment[variable];
  }

  childEnvironment.DATABASE_URL = connectionString;
  childEnvironment.TEST_DATABASE_URL = connectionString;
  childEnvironment.NODE_ENV = "test";
  childEnvironment.AGROZAP_INTEGRATION_TEST = "1";
  return childEnvironment as NodeJS.ProcessEnv;
}

function quoteValidatedIdentifier(database: string) {
  validateTestDatabaseName(database);
  return `"${database}"`;
}

export async function recreateTestDatabase(config: SafeTestDatabase) {
  const databaseIdentifier = quoteValidatedIdentifier(config.database);
  const checkedConfig = resolveSafeTestDatabase({
    DATABASE_URL: process.env.DATABASE_URL,
    TEST_DATABASE_URL: config.connectionString,
  });

  if (
    checkedConfig.database !== config.database ||
    checkedConfig.host !== config.host ||
    checkedConfig.port !== config.port
  ) {
    refuse("A configuração do database mudou depois da validação inicial.");
  }

  const adminUrl = new URL(config.connectionString);
  adminUrl.pathname = "/postgres";

  const admin = new Client({ connectionString: adminUrl.href });
  await admin.connect();

  try {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [config.database],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${databaseIdentifier} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${databaseIdentifier}`);
  } finally {
    await admin.end();
  }
}
