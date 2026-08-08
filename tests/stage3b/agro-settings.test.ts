import assert from "node:assert/strict";
import test from "node:test";
import {
  readUsageMode,
  SETTINGS_STORAGE_KEY,
  writeUsageMode,
} from "@/context/agro-settings";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    value(key: string) {
      return values.get(key);
    },
  };
}

test("modoUso continua persistido somente em agrozap-settings", () => {
  const storage = memoryStorage();

  assert.equal(readUsageMode(storage), "simples");
  writeUsageMode(storage, "completo");

  assert.equal(storage.value(SETTINGS_STORAGE_KEY), '{"modoUso":"completo"}');
  assert.equal(readUsageMode(storage), "completo");
});

test("preferência local inválida volta ao modo simples sem bloquear a UI", () => {
  const malformed = memoryStorage({ [SETTINGS_STORAGE_KEY]: "{" });
  const unsupported = memoryStorage({
    [SETTINGS_STORAGE_KEY]: JSON.stringify({ modoUso: "avancado" }),
  });

  assert.equal(readUsageMode(malformed), "simples");
  assert.equal(readUsageMode(unsupported), "simples");
});
