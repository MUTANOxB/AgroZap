import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeIntegrationRuntime,
  buildSafeIntegrationEnvironment,
  INTEGRATION_REFUSAL_MESSAGE,
  resolveSafeTestDatabase,
  TestDatabaseSafetyError,
} from "./test-database";

function assertRefused(environment: Parameters<typeof resolveSafeTestDatabase>[0]) {
  assert.throws(
    () => resolveSafeTestDatabase(environment),
    (error: unknown) => {
      assert.ok(error instanceof TestDatabaseSafetyError);
      assert.equal(error.message, INTEGRATION_REFUSAL_MESSAGE);
      return true;
    },
  );
}

test("a proteção recusa quando nenhuma URL segura está disponível", () => {
  assertRefused({ DATABASE_URL: undefined, TEST_DATABASE_URL: undefined });
  assertRefused({
    DATABASE_URL: undefined,
    TEST_DATABASE_URL: "postgresql://localhost:5432/agrozap_test",
  });
});

test("a proteção recusa o mesmo database usado em desenvolvimento", () => {
  const development = "postgresql://localhost:5432/agrozap_test";
  assertRefused({ DATABASE_URL: development, TEST_DATABASE_URL: development });
});

test("a proteção recusa database cujo nome não contém test", () => {
  for (const database of ["agrozap_integracao", "contest", "latest"]) {
    assertRefused({
      DATABASE_URL: "postgresql://localhost:5432/agrozap",
      TEST_DATABASE_URL: `postgresql://localhost:5432/${database}`,
    });
  }
});

test("a proteção recusa host remoto", () => {
  assertRefused({
    DATABASE_URL: "postgresql://localhost:5432/agrozap",
    TEST_DATABASE_URL: "postgresql://db.example.com:5432/agrozap_test",
  });
});

test("a proteção recusa identificador de database inseguro", () => {
  assertRefused({
    DATABASE_URL: "postgresql://localhost:5432/agrozap",
    TEST_DATABASE_URL: "postgresql://localhost:5432/agrozap_test%22",
  });
  assertRefused({
    DATABASE_URL: "postgresql://localhost:5432/agrozap",
    TEST_DATABASE_URL: "postgresql://localhost/agrozap_test?port=5433",
  });
});

test("uma DATABASE_URL local pode derivar agrozap_test somente em memória", () => {
  const config = resolveSafeTestDatabase({
    DATABASE_URL: "postgresql://localhost:5432/agrozap",
    TEST_DATABASE_URL: undefined,
  });

  assert.equal(config.host, "localhost");
  assert.equal(config.database, "agrozap_test");
  assert.equal(config.source, "derived");
});

test("o arquivo de domínio recusa execução direta fora do runner protegido", () => {
  assert.throws(
    () =>
      assertSafeIntegrationRuntime({
        AGROZAP_INTEGRATION_TEST: undefined,
        DATABASE_URL: "postgresql://localhost:5432/agrozap",
        TEST_DATABASE_URL: undefined,
      }),
    TestDatabaseSafetyError,
  );
});

test("o runtime aceita somente DATABASE_URL apontando ao mesmo banco de teste", () => {
  const isolated = "postgresql://localhost:5432/agrozap_test";
  assert.throws(
    () =>
      assertSafeIntegrationRuntime({
        AGROZAP_INTEGRATION_TEST: "1",
        DATABASE_URL: "postgresql://localhost:5432/agrozap",
        TEST_DATABASE_URL: isolated,
      }),
    TestDatabaseSafetyError,
  );
  assert.doesNotThrow(() =>
    assertSafeIntegrationRuntime({
      AGROZAP_INTEGRATION_TEST: "1",
      DATABASE_URL: isolated,
      TEST_DATABASE_URL: isolated,
    }),
  );

  const childEnvironment = buildSafeIntegrationEnvironment(
    {
      DATABASE_URL: "postgresql://localhost:5432/agrozap",
      DOTENV_CONFIG_OVERRIDE: "true",
      DOTENV_CONFIG_PATH: ".env",
      DOTENV_KEY: "valor-que-não-deve-ser-herdado",
    },
    isolated,
  );
  assert.equal(childEnvironment.DATABASE_URL, isolated);
  assert.equal(childEnvironment.TEST_DATABASE_URL, isolated);
  assert.equal(childEnvironment.AGROZAP_INTEGRATION_TEST, "1");
  assert.equal(Object.hasOwn(childEnvironment, "DOTENV_CONFIG_OVERRIDE"), false);
  assert.equal(Object.hasOwn(childEnvironment, "DOTENV_CONFIG_PATH"), false);
  assert.equal(Object.hasOwn(childEnvironment, "DOTENV_KEY"), false);
});
