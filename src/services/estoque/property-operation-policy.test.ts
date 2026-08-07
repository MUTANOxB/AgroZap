import assert from "node:assert/strict";
import test from "node:test";
import { StockDomainError } from "./errors";
import {
  requireActivePropertyForNewStockMovement,
  requireExistingPropertyForStockReversal,
} from "./property-operation-policy";

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

test("property ativa permite uma nova movimentação", () => {
  const property = { id: "property-active", archivedAt: null };

  assert.equal(requireActivePropertyForNewStockMovement(property), property);
});

test("property arquivada recusa uma nova movimentação", () => {
  const property = {
    id: "property-archived",
    archivedAt: new Date("2026-08-07T12:00:00.000Z"),
  };

  assertStockError(
    () => requireActivePropertyForNewStockMovement(property),
    "PROPERTY_NOT_ACTIVE",
    "Propriedade não encontrada ou arquivada.",
  );
});

test("property arquivada continua válida para reversão histórica", () => {
  const property = {
    id: "property-archived",
    archivedAt: new Date("2026-08-07T12:00:00.000Z"),
  };

  assert.equal(requireExistingPropertyForStockReversal(property), property);
});

test("reversão recusa uma property inexistente", () => {
  assertStockError(
    () => requireExistingPropertyForStockReversal(null),
    "PROPERTY_NOT_FOUND",
    "Propriedade não encontrada.",
  );
});
