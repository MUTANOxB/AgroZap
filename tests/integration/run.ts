import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import { Client } from "pg";
import {
  buildSafeIntegrationEnvironment,
  INTEGRATION_REFUSAL_MESSAGE,
  recreateTestDatabase,
  resolveSafeTestDatabase,
  TestDatabaseSafetyError,
} from "./test-database";

dotenv.config({ override: false, quiet: true });

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const prismaCli = path.join(repositoryRoot, "node_modules/prisma/build/index.js");
const tsxCli = path.join(repositoryRoot, "node_modules/tsx/dist/cli.mjs");
const SEEDED_TABLES = [
  "Property",
  "User",
  "PropertyMember",
  "Area",
  "AreaAlias",
  "StockProduct",
  "ProductAlias",
  "StockMovement",
  "FarmRecord",
  "AuditLog",
] as const;

function redactSecrets(output: string | null, environment: NodeJS.ProcessEnv) {
  let redacted = output ?? "";
  for (const secret of [environment.DATABASE_URL, environment.TEST_DATABASE_URL]) {
    if (secret) redacted = redacted.replaceAll(secret, "[URL PostgreSQL omitida]");
  }
  return redacted.replace(
    /postgres(?:ql)?:\/\/[^\s]+/giu,
    "[URL PostgreSQL omitida]",
  );
}

function runStep(label: string, cli: string, args: string[], environment: NodeJS.ProcessEnv) {
  console.log(`\n[integração] ${label}`);
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: repositoryRoot,
    env: environment,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  const stdout = redactSecrets(result.stdout, environment);
  const stderr = redactSecrets(result.stderr, environment);
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  if (result.error || result.status !== 0) {
    throw new Error(`A etapa '${label}' falhou.`);
  }
}

async function readSeedIdentity(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const identity: Record<string, string[]> = {};
    for (const table of SEEDED_TABLES) {
      const result = await client.query<{ id: string }>(
        `SELECT "id" FROM "${table}" ORDER BY "id"`,
      );
      identity[table] = result.rows.map((row) => row.id);
    }
    return JSON.stringify(identity);
  } finally {
    await client.end();
  }
}

async function main() {
  const testDatabase = resolveSafeTestDatabase(process.env);
  const testEnvironment = buildSafeIntegrationEnvironment(
    process.env,
    testDatabase.connectionString,
  );
  const domainTestEnvironment = {
    ...testEnvironment,
    NODE_OPTIONS: [
      testEnvironment.NODE_OPTIONS,
      "--conditions=react-server",
    ]
      .filter(Boolean)
      .join(" "),
  };
  const origin =
    testDatabase.source === "derived"
      ? "derivada em memória"
      : "fornecida por TEST_DATABASE_URL";

  console.log(
    `[integração] Banco autorizado: host=${testDatabase.host} database=${testDatabase.database} (${origin}).`,
  );
  runStep(
    "Validar as guardas antes de qualquer operação destrutiva",
    tsxCli,
    ["--test", "tests/integration/test-database-safety.test.ts"],
    testEnvironment,
  );
  console.log("[integração] Recriando exclusivamente o banco descartável autorizado.");

  await recreateTestDatabase(testDatabase);

  runStep(
    "Aplicar migrations desde o banco vazio",
    prismaCli,
    ["migrate", "deploy"],
    testEnvironment,
  );
  runStep("Executar seed (primeira vez)", prismaCli, ["db", "seed"], testEnvironment);
  const firstSeedIdentity = await readSeedIdentity(testDatabase.connectionString);
  runStep(
    "Executar seed novamente para provar idempotência",
    prismaCli,
    ["db", "seed"],
    testEnvironment,
  );
  const secondSeedIdentity = await readSeedIdentity(testDatabase.connectionString);
  if (firstSeedIdentity !== secondSeedIdentity) {
    throw new Error("A segunda execução do seed alterou ou duplicou identidades.");
  }
  console.log("[integração] Seed idempotente: identidades preservadas na segunda execução.");
  runStep(
    "Executar testes PostgreSQL reais",
    tsxCli,
    [
      "--test",
      "--test-concurrency=1",
      "tests/integration/foundation.integration.test.ts",
      "tests/integration/stage2.integration.test.ts",
      "tests/integration/stage2-1-multitenancy.integration.test.ts",
      "tests/integration/stage3a-domain.integration.test.ts",
      "tests/integration/stage3a-queries.integration.test.ts",
    ],
    domainTestEnvironment,
  );
}

main().catch((error: unknown) => {
  if (error instanceof TestDatabaseSafetyError) {
    console.error(INTEGRATION_REFUSAL_MESSAGE);
    console.error(`Motivo seguro: ${error.reason}`);
  } else {
    console.error(
      "A validação PostgreSQL de integração falhou na etapa indicada acima.",
    );
  }
  process.exitCode = 1;
});
