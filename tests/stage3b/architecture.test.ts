import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

async function source(relativePath: string) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

const clientFiles = [
  "src/app/(authenticated)/(property)/talhoes/talhoes-client.tsx",
  "src/app/(authenticated)/(property)/estoque/estoque-client.tsx",
  "src/app/(authenticated)/(property)/registros/registros-client.tsx",
  "src/app/(authenticated)/(property)/dashboard/dashboard-client.tsx",
];

test("AgroAppContext não lê nem grava arrays rurais e mantém apenas modoUso", async () => {
  const [context, settings] = await Promise.all([
    source("src/context/AgroAppContext.tsx"),
    source("src/context/agro-settings.ts"),
  ]);

  for (const forbidden of [
    "agrozap-mvp-data",
    "adicionarArea",
    "adicionarAnotacao",
    "adicionarProduto",
    "atualizarQuantidadeProduto",
    "calculateLocalStockBalance",
    "Date.now",
  ]) {
    assert.equal(context.includes(forbidden), false, forbidden);
  }
  assert.equal(settings.includes('"agrozap-settings"'), true);
  assert.equal(settings.includes("agrozap-mvp-data"), false);
  assert.equal(context.includes("readUsageMode(window.localStorage)"), true);
  assert.equal(context.includes("writeUsageMode(window.localStorage"), true);
});

test("páginas Server consultam wrappers tenant-scoped e passam DTOs aos Clients", async () => {
  const pages = await Promise.all([
    source("src/app/(authenticated)/(property)/talhoes/page.tsx"),
    source("src/app/(authenticated)/(property)/estoque/page.tsx"),
    source("src/app/(authenticated)/(property)/registros/page.tsx"),
    source("src/app/(authenticated)/(property)/dashboard/page.tsx"),
  ]);

  for (const page of pages) assert.equal(page.includes('"use client"'), false);
  assert.match(pages[0], /listCurrentPropertyAreas/);
  assert.match(pages[1], /listCurrentPropertyProducts/);
  assert.match(pages[2], /listCurrentPropertyFarmRecords/);
  assert.match(pages[3], /getCurrentPropertyDashboardSummary/);
});

test("Clients rurais não importam Prisma, services de domínio ou tipos legados", async () => {
  const sources = await Promise.all(clientFiles.map(source));
  const combined = sources.join("\n");

  for (const forbidden of [
    "@/lib/prisma",
    "@/services/talhoes/area.service",
    "@/services/estoque/product.service",
    "@/services/estoque/stock-movement.service",
    "@/services/registros/farm-record.service",
    "@/types/talhao",
    "@/types/estoque",
    "@/types/registro",
    "Date.now",
    "agrozap-mvp-data",
  ]) {
    assert.equal(combined.includes(forbidden), false, forbidden);
  }

  for (const file of sources.slice(0, 3)) {
    assert.equal(file.includes("Number("), false);
  }
});

test("Registros roteia estoque somente pela Action combinada e dashboard não usa mocks rurais", async () => {
  const [records, dashboard] = await Promise.all([
    source("src/app/(authenticated)/(property)/registros/registros-client.tsx"),
    source("src/app/(authenticated)/(property)/dashboard/dashboard-client.tsx"),
  ]);

  assert.match(records, /createFarmRecordWithStockMovementAction/);
  assert.match(records, /createFarmRecordAction/);
  assert.match(records, /getFarmRecordSuccessNavigation\(isPaginated\)/);
  assert.match(records, /router\.replace\("\/registros"\)/);
  assert.match(records, /router\.refresh\(\)/);
  assert.match(records, /formData\.stockMovementAmount/);
  assert.match(records, /Quantidade movimentada no estoque/);
  assert.equal(records.includes("registerStockMovementAction"), false);
  assert.equal(
    /import\s*\{[^}]*\b(?:recentActivities|stockItems)\b[^}]*\}\s*from\s*["']@\/data\/dashboardMock["']/.test(
      dashboard,
    ),
    false,
  );
});
