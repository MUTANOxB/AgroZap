import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { InvalidPhoneError, normalizePhone } from "./phone";
import {
  hashPassword,
  PASSWORD_HASH_ROUNDS,
  PasswordValidationError,
  verifyPassword,
} from "./password";

test("normaliza formatos humanos e canônicos de telefone brasileiro", () => {
  const expected = "+5511999999999";

  for (const input of [
    "(11) 99999-9999",
    "11999999999",
    "5511999999999",
    "+5511999999999",
    "+55 (11) 99999-9999",
  ]) {
    assert.equal(normalizePhone(input), expected);
  }

  assert.equal(normalizePhone("+5500000000001"), "+5500000000001");
});

test("recusa telefone vazio, ambíguo ou com caracteres inválidos", () => {
  for (const input of [
    "",
    "   ",
    "99999-999",
    "+11999999999",
    "5511999999999 ramal 2",
    "11+999999999",
  ]) {
    assert.throws(
      () => normalizePhone(input),
      (error: unknown) =>
        error instanceof InvalidPhoneError && error.code === "INVALID_PHONE",
    );
  }
});

test("hash usa bcrypt custo 12, não preserva plaintext e verifica corretamente", async () => {
  const password = "Caderno seguro 2026";
  const passwordHash = await hashPassword(password);

  assert.notEqual(passwordHash, password);
  assert.equal(passwordHash.includes(password), false);
  assert.equal(bcrypt.getRounds(passwordHash), PASSWORD_HASH_ROUNDS);
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword("Senha incorreta 2026", passwordHash), false);
});

test("recusa senhas fora do comprimento e entradas que o bcrypt truncaria", async () => {
  await assert.rejects(
    hashPassword("curta1234"),
    (error: unknown) =>
      error instanceof PasswordValidationError &&
      error.code === "PASSWORD_TOO_SHORT",
  );

  await assert.rejects(
    hashPassword("a".repeat(129)),
    (error: unknown) =>
      error instanceof PasswordValidationError &&
      error.code === "PASSWORD_TOO_LONG",
  );

  await assert.rejects(
    hashPassword("a".repeat(73)),
    (error: unknown) =>
      error instanceof PasswordValidationError &&
      error.code === "PASSWORD_BCRYPT_TRUNCATED",
  );
});

test("verify recusa senha truncada e hash inválido sem lançar", async () => {
  const validHash = await hashPassword("Uma senha válida");

  assert.equal(await verifyPassword("a".repeat(73), validHash), false);
  assert.equal(await verifyPassword("Uma senha válida", "não-é-um-hash"), false);
});

test("configuração compartilhada projeta a identidade usada pelo Proxy", async () => {
  const previousAuthSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "auth-config-regression-secret-000000";

  try {
    const { authConfig } = await import("../../auth.config");
    const userId = "user-authenticated-by-jwt";
    const projectedSession = await authConfig.callbacks.session({
      session: {
        user: {
          name: "Usuário de teste",
          email: null,
          image: null,
        },
        expires: new Date(Date.now() + 60_000).toISOString(),
      },
      token: { sub: userId },
    } as Parameters<typeof authConfig.callbacks.session>[0]);

    assert.equal(projectedSession.user?.id, userId);

    const proxyDecision = await authConfig.callbacks.authorized({
      auth: projectedSession,
      request: new NextRequest("http://localhost/propriedades"),
    });

    assert.equal(proxyDecision, true);
  } finally {
    if (previousAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = previousAuthSecret;
    }
  }
});
