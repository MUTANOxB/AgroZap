import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

async function source(relativePath: string) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

function exportedFunction(sourceCode: string, name: string, nextName: string) {
  const start = sourceCode.indexOf(`export async function ${name}`);
  const end = sourceCode.indexOf(`export async function ${nextName}`, start + 1);
  assert.notEqual(start, -1, name);
  assert.notEqual(end, -1, nextName);
  return sourceCode.slice(start, end);
}

test("Actions de edição derivam autoridade no servidor e exigem capabilities próprias", async () => {
  const actions = await source(
    "src/app/(authenticated)/(property)/rural-actions.ts",
  );
  const updateArea = exportedFunction(actions, "updateAreaAction", "createStockProductAction");
  const updateProduct = exportedFunction(
    actions,
    "updateStockProductAction",
    "adjustStockAction",
  );
  const adjustStock = exportedFunction(
    actions,
    "adjustStockAction",
    "createFarmRecordAction",
  );

  for (const action of [updateArea, updateProduct, adjustStock]) {
    assert.match(action, /requireActivePropertyContext\(\)/);
    assert.match(action, /propertyId:\s*context\.property\.id/);
    assert.match(action, /actorUserId:\s*context\.user\.id/);
    assert.match(action, /source:\s*RecordSource\.WEB/);
    assert.match(action, /RURAL_WEB_AUTHORIZATION/);
    assert.match(action, /ruralActionSuccess/);
    assert.match(action, /ruralActionFailure/);
  }

  assert.match(updateArea, /\["EDIT_AREA"\]/);
  assert.match(updateArea, /prepareUpdateAreaWebInput\(rawInput\)/);
  assert.match(updateArea, /updateArea\(/);
  assert.match(updateProduct, /\["EDIT_PRODUCT"\]/);
  assert.match(updateProduct, /prepareUpdateStockProductWebInput\(rawInput\)/);
  assert.match(updateProduct, /updateStockProduct\(/);
  assert.equal(/\bquantity\b/.test(updateProduct), false);
  assert.match(adjustStock, /\["ADJUST_STOCK"\]/);
  assert.match(adjustStock, /prepareAdjustStockWebInput\(rawInput\)/);
  assert.match(adjustStock, /adjustStock\(/);
});

test("Talhões expõe edição autorizada sem levar domínio ou autoridade ao Client", async () => {
  const client = await source(
    "src/app/(authenticated)/(property)/talhoes/talhoes-client.tsx",
  );

  assert.match(client, /updateAreaAction/);
  assert.match(client, /buildUpdateAreaInput/);
  assert.match(client, /can\("EDIT_AREA"\)/);
  assert.match(client, /isEditing \? "Fechar edição" : "Editar"/);
  assert.match(client, /router\.refresh\(\)/);
  assert.match(client, /disabled=\{[^}]*Pending/);

  for (const forbidden of [
    "@/lib/prisma",
    "@/services/talhoes/area.service",
    "propertyId:",
    "actorUserId",
    "createdByUserId",
    "RecordSource.WEB",
    "Number(",
    "localStorage",
  ]) {
    assert.equal(client.includes(forbidden), false, forbidden);
  }
});

test("Estoque separa edição de metadados do ajuste auditável", async () => {
  const client = await source(
    "src/app/(authenticated)/(property)/estoque/estoque-client.tsx",
  );

  for (const expected of [
    "updateStockProductAction",
    "adjustStockAction",
    "buildUpdateStockProductInput",
    "buildAdjustStockInput",
    "getStockAdjustmentDifference",
    'can("EDIT_PRODUCT")',
    'can("ADJUST_STOCK")',
    "Editar produto",
    "Ajustar estoque",
    "Saldo atual",
    "Novo saldo",
    "Diferença",
    "Motivo",
    "router.refresh()",
  ]) {
    assert.equal(client.includes(expected), true, expected);
  }

  for (const forbidden of [
    "@/lib/prisma",
    "@/services/estoque/product.service",
    "@/services/estoque/stock-movement.service",
    "propertyId:",
    "actorUserId",
    "createdByUserId",
    "RecordSource.WEB",
    "Number(",
    "localStorage",
  ]) {
    assert.equal(client.includes(forbidden), false, forbidden);
  }
});

test("3B.1 não cria edição de FarmRecord nem devolve cálculo autoritativo ao Client", async () => {
  const [records, stock, ui] = await Promise.all([
    source("src/app/(authenticated)/(property)/registros/registros-client.tsx"),
    source("src/app/(authenticated)/(property)/estoque/estoque-client.tsx"),
    source("src/services/rural/rural-ui.ts"),
  ]);

  assert.equal(records.includes("updateFarmRecord"), false);
  assert.equal(records.includes("editFarmRecord"), false);
  assert.equal(stock.includes("quantityChange"), false);
  assert.equal(stock.includes("balanceAfter"), false);
  assert.equal(stock.includes("new Prisma.Decimal"), false);
  assert.equal(ui.includes("Number("), false);
  assert.equal(ui.includes("parseFloat("), false);
  assert.equal(ui.includes("parseInt("), false);
});
