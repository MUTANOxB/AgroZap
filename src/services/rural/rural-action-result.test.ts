import assert from "node:assert/strict";
import test from "node:test";
import { PropertyCapabilityError } from "@/services/autorizacao/property-capability-guard";
import { RuralInputError } from "@/services/rural/rural-input-normalization";
import {
  ruralActionFailure,
  ruralActionSuccess,
} from "./rural-action-result";
import { RuralWebInputError } from "./rural-web-inputs";

test("sucesso mantém somente o DTO serializável informado", () => {
  assert.deepEqual(ruralActionSuccess({ id: "area_1", size: "12.5" }), {
    ok: true,
    data: { id: "area_1", size: "12.5" },
  });
});

test("erros de input e capability mantêm código e mensagem seguros", () => {
  assert.deepEqual(
    ruralActionFailure(
      new RuralWebInputError(
        "AUTHORITY_FIELD_NOT_ALLOWED",
        "Campo de autoridade recusado.",
      ),
    ),
    {
      ok: false,
      error: {
        code: "AUTHORITY_FIELD_NOT_ALLOWED",
        message: "Campo de autoridade recusado.",
      },
    },
  );

  assert.deepEqual(
    ruralActionFailure(
      new RuralInputError("INVALID_DECIMAL", "Informe um número válido."),
    ),
    {
      ok: false,
      error: { code: "INVALID_INPUT", message: "Informe um número válido." },
    },
  );

  const forbidden = ruralActionFailure(
    new PropertyCapabilityError(["CREATE_AREA"]),
  );
  assert.equal(forbidden.ok, false);
  if (!forbidden.ok) {
    assert.equal(forbidden.error.code, "FORBIDDEN");
    assert.equal(forbidden.error.message.includes("OWNER"), false);
    assert.equal(forbidden.error.message.includes("CREATE_AREA"), false);
  }
});

test("erros de domínio conhecidos preservam apenas código e mensagem", () => {
  const error = Object.assign(new Error("Estoque insuficiente."), {
    name: "StockDomainError",
    code: "INSUFFICIENT_STOCK",
    databaseDetail: "não deve sair",
  });

  assert.deepEqual(ruralActionFailure(error), {
    ok: false,
    error: {
      code: "INSUFFICIENT_STOCK",
      message: "Estoque insuficiente.",
    },
  });
});

test("Prisma e erros desconhecidos viram INTERNAL_ERROR sem detalhes", () => {
  const prismaError = Object.assign(
    new Error("Unique constraint em SQL com DATABASE_URL secreta"),
    {
      name: "PrismaClientKnownRequestError",
      code: "P2002",
      meta: { target: "segredo" },
    },
  );
  const unknownError = new Error("stack e segredo interno");

  for (const result of [
    ruralActionFailure(prismaError),
    ruralActionFailure(unknownError),
    ruralActionFailure("erro bruto"),
  ]) {
    assert.deepEqual(result, {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Não foi possível concluir a operação.",
      },
    });
    assert.equal(JSON.stringify(result).includes("segredo"), false);
    assert.equal(JSON.stringify(result).includes("stack"), false);
    assert.equal(JSON.stringify(result).includes("P2002"), false);
  }
});
