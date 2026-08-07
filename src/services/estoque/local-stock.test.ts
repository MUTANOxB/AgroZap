import assert from "node:assert/strict";
import test from "node:test";
import { StockDomainError } from "./errors";
import {
  calculateLocalStockBalance,
  parseRequiredLocalStockQuantity,
  requireValidLocalStockProduct,
} from "./local-stock";

function assertStockError(
  operation: () => unknown,
  code: StockDomainError["code"],
  message: string,
) {
  assert.throws(operation, (error: unknown) => {
    assert.ok(error instanceof StockDomainError);
    assert.equal(error.code, code);
    assert.equal(error.message, message);
    return true;
  });
}

test("uma saída maior que o saldo não altera o valor original", () => {
  const currentBalance = 10;

  assertStockError(
    () => calculateLocalStockBalance(currentBalance, -15),
    "INSUFFICIENT_STOCK",
    "Estoque insuficiente.",
  );
  assert.equal(currentBalance, 10);
});

test("um produto inexistente é recusado pela validação local", () => {
  assertStockError(
    () => requireValidLocalStockProduct(undefined),
    "PRODUCT_NOT_FOUND",
    "Selecione um produto válido para movimentar o estoque.",
  );
});

test("quantidades obrigatórias vazias, zero ou inválidas são recusadas", () => {
  for (const value of ["", " ", "0", "-1", "NaN", "produto"]) {
    assertStockError(
      () => parseRequiredLocalStockQuantity(value),
      "INVALID_QUANTITY",
      "Informe uma quantidade válida para movimentar o estoque.",
    );
  }
});

test("uma quantidade positiva continua válida", () => {
  assert.equal(parseRequiredLocalStockQuantity("5"), 5);
  assert.equal(calculateLocalStockBalance(10, -5), 5);
});
