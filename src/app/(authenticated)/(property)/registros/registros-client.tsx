"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  createFarmRecordAction,
  createFarmRecordWithStockMovementAction,
} from "@/app/(authenticated)/(property)/rural-actions";
import { useAgroApp } from "@/context/AgroAppContext";
import { usePropertyAccess } from "@/context/PropertyAccessContext";
import { StockMovementType } from "@/generated/prisma/enums";
import type {
  AreaDto,
  FarmRecordDto,
  StockProductDto,
} from "@/services/rural/rural-dtos";
import {
  FARM_RECORD_TYPE_OPTIONS,
  buildFarmRecordSubmission,
  formatRuralDecimalPtBr,
  getFarmRecordSuccessNavigation,
  getFarmRecordTypeLabel,
  type FarmRecordFormValues,
  type FarmRecordTypeLabel,
} from "@/services/rural/rural-ui";

const typeColors = {
  Pulverização: "bg-sky-100 text-sky-700",
  Plantio: "bg-emerald-100 text-emerald-700",
  Colheita: "bg-amber-100 text-amber-700",
  Compra: "bg-violet-100 text-violet-700",
  "Entrada no estoque": "bg-teal-100 text-teal-700",
  Manutenção: "bg-slate-200 text-slate-700",
  Vistoria: "bg-lime-100 text-lime-700",
  Pagamento: "bg-rose-100 text-rose-700",
  Observação: "bg-orange-100 text-orange-700",
} as const satisfies Record<FarmRecordTypeLabel, string>;

function currentDateInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function createEmptyForm(): FarmRecordFormValues {
  return {
    typeLabel: "Pulverização",
    areaId: "",
    locationDescription: "",
    productId: "",
    occurredAt: currentDateInSaoPaulo(),
    description: "",
    quantity: "",
    quantityUnit: "",
    stockMovementAmount: "",
    value: "",
    responsibleName: "",
    appliedDose: "",
    doseUnit: "",
    harvest: "",
    supplier: "",
    productBatch: "",
    technicalNote: "",
  };
}

function formatRecordDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function stockOption(product: StockProductDto) {
  return `${product.name} — ${formatRuralDecimalPtBr(product.quantity)} ${product.unit}`;
}

type RegistrosClientProps = {
  areas: AreaDto[];
  products: StockProductDto[];
  records: FarmRecordDto[];
  nextCursor: string | null;
  isPaginated: boolean;
};

export function RegistrosClient({
  areas,
  products,
  records,
  nextCursor,
  isPaginated,
}: RegistrosClientProps) {
  const router = useRouter();
  const { isModoCompleto } = useAgroApp();
  const { can } = usePropertyAccess();
  const canCreateRecord = can("CREATE_RECORD");
  const canMoveStock = can("MOVE_STOCK");
  const [formData, setFormData] = useState<FarmRecordFormValues>(() =>
    createEmptyForm(),
  );
  const [stockMovementEnabled, setStockMovementEnabled] = useState(true);
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateField<K extends keyof FarmRecordFormValues>(
    field: K,
    value: FarmRecordFormValues[K],
  ) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  const movementPreview = buildFarmRecordSubmission(formData, {
    mode: "completo",
    canMoveStock,
    stockMovementEnabled: true,
  });
  const supportsStockMovement = movementPreview.kind === "record-with-stock";
  const movesStock =
    isModoCompleto && supportsStockMovement && stockMovementEnabled;
  const movementDirection =
    movementPreview.kind === "record-with-stock" &&
    movementPreview.input.stockMovement.type === StockMovementType.IN
      ? "entrada"
      : "saída";
  const selectedProduct = products.find(
    (product) => product.id === formData.productId,
  );

  function selectProduct(productId: string) {
    updateField("productId", productId);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateRecord || isPending) return;
    setFeedback(null);

    const submission = buildFarmRecordSubmission(formData, {
      mode: isModoCompleto ? "completo" : "simples",
      canMoveStock,
      stockMovementEnabled,
    });

    startTransition(async () => {
      try {
        const result =
          submission.kind === "record-with-stock"
            ? await createFarmRecordWithStockMovementAction(submission.input)
            : await createFarmRecordAction(submission.input);

        if (!result.ok) {
          setFeedback({ tone: "error", message: result.error.message });
          return;
        }

        setFormData(createEmptyForm());
        setStockMovementEnabled(true);
        setFeedback({
          tone: "success",
          message:
            submission.kind === "record-with-stock"
              ? "Anotação e estoque atualizados com sucesso."
              : "Anotação registrada com sucesso.",
        });
        if (getFarmRecordSuccessNavigation(isPaginated) === "replace-with-latest") {
          router.replace("/registros");
        } else {
          router.refresh();
        }
      } catch {
        setFeedback({
          tone: "error",
          message: "Não foi possível concluir a operação.",
        });
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <header className="mb-7">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Rotina da propriedade
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Anotações</h1>
        <p className="mt-1 max-w-3xl text-slate-500">
          Registre os serviços, compras, manejos e observações feitos na propriedade.
        </p>
      </header>

      {canCreateRecord ? (
        <section className="ag-form-section">
          <div className="border-b border-emerald-950/7 bg-white/45 px-4 py-5 sm:px-6">
            <h2 className="text-lg font-bold text-slate-900">
              {isModoCompleto ? "Registrar nova anotação" : "Anotação rápida"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {isModoCompleto
                ? "Preencha as informações principais do que aconteceu na propriedade."
                : "Conte o que aconteceu e salve em poucos passos."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-5 p-4 sm:p-6 md:grid-cols-2">
            {!isModoCompleto ? (
              <>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">O que aconteceu?</span>
                  <textarea required autoFocus rows={5} value={formData.description} onChange={(event) => updateField("description", event.target.value)} placeholder="Ex: Fiz a vistoria na lavoura do milho" className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Data</span>
                  <input required type="date" value={formData.occurredAt} onChange={(event) => updateField("occurredAt", event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Área cadastrada <span className="font-normal text-slate-400">(opcional)</span></span>
                  <select value={formData.areaId} onChange={(event) => updateField("areaId", event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10">
                    <option value="">Outro local / não informar</option>
                    {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                  </select>
                </label>
                {!formData.areaId && (
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Local livre <span className="font-normal text-slate-400">(opcional)</span></span>
                    <input value={formData.locationDescription} onChange={(event) => updateField("locationDescription", event.target.value)} placeholder="Ex: Galpão de máquinas" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" />
                  </label>
                )}
              </>
            ) : (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">O que foi feito?</span>
                  <select value={formData.typeLabel} onChange={(event) => updateField("typeLabel", event.target.value as FarmRecordTypeLabel)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10">
                    {FARM_RECORD_TYPE_OPTIONS.map(({ label }) => <option key={label} value={label}>{label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Área cadastrada</span>
                  <select value={formData.areaId} onChange={(event) => updateField("areaId", event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10">
                    <option value="">Outro local</option>
                    {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                  </select>
                </label>
                {!formData.areaId && (
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Descrição do local</span>
                    <input required value={formData.locationDescription} onChange={(event) => updateField("locationDescription", event.target.value)} placeholder="Ex: Galpão de máquinas" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" />
                  </label>
                )}
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Data</span>
                  <input required type="date" value={formData.occurredAt} onChange={(event) => updateField("occurredAt", event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Produto <span className="font-normal text-slate-400">{movesStock ? "(obrigatório para o estoque)" : "(opcional)"}</span></span>
                  <select required={movesStock} value={formData.productId} onChange={(event) => selectProduct(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10">
                    <option value="">Nenhum produto selecionado</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{stockOption(product)}</option>)}
                  </select>
                  {movesStock && products.length === 0 && <p className="mt-2 text-xs font-semibold text-amber-700">Cadastre um produto antes de movimentar o estoque.</p>}
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Descrição</span>
                  <textarea required rows={4} value={formData.description} onChange={(event) => updateField("description", event.target.value)} placeholder="Ex: Aplicação concluída na área selecionada." className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Quantidade do registro <span className="font-normal text-slate-400">(opcional)</span></span>
                  <input inputMode="decimal" value={formData.quantity} onChange={(event) => updateField("quantity", event.target.value)} placeholder="Ex: 500" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Unidade da quantidade do registro</span>
                  <input value={formData.quantityUnit} onChange={(event) => updateField("quantityUnit", event.target.value)} placeholder="Ex: litros de calda, hectares" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" />
                </label>

                {supportsStockMovement && (
                  <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 md:col-span-2">
                    <input type="checkbox" checked={stockMovementEnabled} onChange={(event) => setStockMovementEnabled(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-700" />
                    <span>
                      <strong className="block text-sm text-emerald-950">Movimentar o estoque com esta anotação</strong>
                      <span className="mt-1 block text-xs leading-5 text-emerald-800">A movimentação será registrada como {movementDirection} em uma única operação atômica.</span>
                    </span>
                  </label>
                )}

                {movesStock && (
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Quantidade movimentada no estoque</span>
                    <div className="flex items-stretch">
                      <input required inputMode="decimal" value={formData.stockMovementAmount} onChange={(event) => updateField("stockMovementAmount", event.target.value)} placeholder="Ex: 2,5" className="min-w-0 flex-1 rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" />
                      <span className="inline-flex min-w-20 items-center justify-center rounded-r-xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-600">
                        {selectedProduct?.unit ?? "unidade"}
                      </span>
                    </div>
                    <span className="mt-2 block text-xs text-slate-500">
                      {selectedProduct
                        ? `Unidade do produto selecionado: ${selectedProduct.unit}.`
                        : "Selecione um produto para conferir a unidade."}
                    </span>
                  </label>
                )}

                <fieldset className="ag-detail-group grid gap-5 p-4 md:col-span-2 md:grid-cols-2">
                  <legend className="px-2 text-sm font-bold text-emerald-900">Detalhes adicionais</legend>
                  <p className="text-sm text-emerald-800 md:col-span-2">Informações opcionais para um registro técnico mais detalhado.</p>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Responsável histórico</span>
                    <input value={formData.responsibleName} onChange={(event) => updateField("responsibleName", event.target.value)} placeholder="Ex: João, equipe da fazenda" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Valor (R$)</span>
                    <input inputMode="decimal" value={formData.value} onChange={(event) => updateField("value", event.target.value)} placeholder="Ex: 1.200,00" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Dose aplicada</span>
                    <input inputMode="decimal" value={formData.appliedDose} onChange={(event) => updateField("appliedDose", event.target.value)} placeholder="Ex: 2,5" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Unidade da dose</span>
                    <input value={formData.doseUnit} onChange={(event) => updateField("doseUnit", event.target.value)} placeholder="Ex: L/ha, kg/ha" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Safra</span>
                    <input value={formData.harvest} onChange={(event) => updateField("harvest", event.target.value)} placeholder="Ex: 2025/26" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Fornecedor</span>
                    <input value={formData.supplier} onChange={(event) => updateField("supplier", event.target.value)} placeholder="Ex: Cooperativa local" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Lote do produto</span>
                    <input value={formData.productBatch} onChange={(event) => updateField("productBatch", event.target.value)} placeholder="Ex: LT-2026-041" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Observação técnica</span>
                    <textarea rows={3} value={formData.technicalNote} onChange={(event) => updateField("technicalNote", event.target.value)} placeholder="Detalhes técnicos importantes" className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                  </label>
                </fieldset>
              </>
            )}

            {feedback && <p role={feedback.tone === "error" ? "alert" : "status"} className={`text-sm font-semibold md:col-span-2 ${feedback.tone === "error" ? "text-rose-700" : "text-emerald-700"}`}>{feedback.message}</p>}
            <div className="flex justify-end md:col-span-2">
              <button type="submit" disabled={isPending} className="ag-button-primary w-full px-5 py-3 text-sm font-bold disabled:cursor-wait disabled:opacity-60 sm:w-auto">{isPending ? "Salvando..." : isModoCompleto ? "Salvar anotação" : "Salvar anotação rápida"}</button>
            </div>
          </form>
        </section>
      ) : (
        <section role="note" className="mb-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 sm:p-5">
          <p className="text-sm font-bold">Modo consulta</p>
          <p className="mt-1 text-sm leading-6 text-emerald-800">Você pode consultar o histórico desta propriedade, mas seu papel não permite criar novas anotações.</p>
        </section>
      )}

      <section className="mt-7">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-xl font-bold text-slate-900">Histórico da propriedade</h2><p className="mt-1 text-sm text-slate-500">Veja os registros mais recentes da propriedade.</p></div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">{records.length} {records.length === 1 ? "anotação nesta página" : "anotações nesta página"}</span>
        </div>

        {records.length === 0 ? (
          <div className="ag-card p-8 text-center text-sm text-slate-500">Nenhuma anotação registrada.</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {records.map((record) => {
              const typeLabel = getFarmRecordTypeLabel(record.type);
              const location = record.areaNameSnapshot ?? record.locationDescription;
              return (
                <article key={record.id} className="ag-card ag-card-interactive p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${typeColors[typeLabel]}`}>{typeLabel}</span>
                    <time className="text-sm font-semibold text-slate-500">{formatRecordDate(record.occurredAt)}</time>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">{typeLabel}{location ? ` — ${location}` : ""}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{record.description}</p>
                  {(record.quantity || record.responsibleName || record.value || record.productNameSnapshot) && (
                    <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-sm">
                      {record.quantity && <p><span className="text-slate-400">Quantidade:</span> <strong className="font-semibold text-slate-700">{formatRuralDecimalPtBr(record.quantity)}{record.quantityUnit ? ` ${record.quantityUnit}` : ""}</strong></p>}
                      {record.responsibleName && <p><span className="text-slate-400">Responsável:</span> <strong className="font-semibold text-slate-700">{record.responsibleName}</strong></p>}
                      {record.value && <p><span className="text-slate-400">Valor:</span> <strong className="font-semibold text-slate-700">R$ {formatRuralDecimalPtBr(record.value)}</strong></p>}
                      {record.productNameSnapshot && <p><span className="text-slate-400">Produto:</span> <strong className="font-semibold text-slate-700">{record.productNameSnapshot}</strong></p>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {(isPaginated || nextCursor) && (
          <nav aria-label="Paginação das anotações" className="mt-5 flex flex-wrap items-center justify-between gap-3">
            {isPaginated ? (
              <Link href="/registros" className="ag-button-secondary inline-flex min-h-10 items-center justify-center px-4 text-sm font-semibold">
                Voltar aos mais recentes
              </Link>
            ) : <span />}
            {nextCursor && (
              <Link href={`/registros?cursor=${encodeURIComponent(nextCursor)}`} className="ag-button-secondary inline-flex min-h-10 items-center justify-center px-4 text-sm font-semibold">
                Ver registros anteriores
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
