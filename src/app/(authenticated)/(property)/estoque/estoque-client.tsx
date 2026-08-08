"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { createStockProductAction } from "@/app/(authenticated)/(property)/rural-actions";
import { useAgroApp } from "@/context/AgroAppContext";
import { usePropertyAccess } from "@/context/PropertyAccessContext";
import type { StockProductDto } from "@/services/rural/rural-dtos";
import {
  PRODUCT_CATEGORY_OPTIONS,
  buildCreateStockProductInput,
  formatRuralDecimalPtBr,
  getProductCategoryLabel,
  isLowStock,
  type ProductCategoryLabel,
  type StockProductFormValues,
} from "@/services/rural/rural-ui";

const units = [
  "kg",
  "litros",
  "sacos",
  "unidades",
  "caixas",
  "toneladas",
  "metros",
  "outro",
] as const;

const emptyForm: StockProductFormValues = {
  name: "",
  categoryLabel: "Semente",
  initialQuantity: "",
  unit: "kg",
  minimumStock: "",
  storageLocation: "",
  note: "",
  supplier: "",
  unitValue: "",
  expirationDate: "",
  batchNumber: "",
  purchaseDate: "",
  technicalNote: "",
};

const categoryColors = {
  Semente: "bg-emerald-100 text-emerald-700",
  Adubo: "bg-lime-100 text-lime-700",
  Defensivo: "bg-sky-100 text-sky-700",
  Combustível: "bg-amber-100 text-amber-700",
  Ração: "bg-orange-100 text-orange-700",
  Peça: "bg-slate-200 text-slate-700",
  Ferramenta: "bg-violet-100 text-violet-700",
  Outro: "bg-teal-100 text-teal-700",
} as const satisfies Record<ProductCategoryLabel, string>;

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <article className="ag-card ag-card-interactive p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`rounded-xl p-2.5 ${tone}`}>{icon}</span>
      </div>
      <strong className="mt-4 block text-3xl font-bold tracking-tight text-slate-950">{value}</strong>
    </article>
  );
}

type EstoqueClientProps = {
  products: StockProductDto[];
};

export function EstoqueClient({ products }: EstoqueClientProps) {
  const router = useRouter();
  const { isModoCompleto } = useAgroApp();
  const { can } = usePropertyAccess();
  const canCreateProduct = can("CREATE_PRODUCT");
  const [formData, setFormData] = useState<StockProductFormValues>(emptyForm);
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateField<K extends keyof StockProductFormValues>(
    field: K,
    value: StockProductFormValues[K],
  ) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateProduct || isPending) return;
    setFeedback(null);

    startTransition(async () => {
      try {
        const result = await createStockProductAction(
          buildCreateStockProductInput(formData, isModoCompleto),
        );
        if (!result.ok) {
          setFeedback({ tone: "error", message: result.error.message });
          return;
        }

        setFormData(emptyForm);
        setFeedback({ tone: "success", message: "Produto cadastrado com sucesso." });
        router.refresh();
      } catch {
        setFeedback({
          tone: "error",
          message: "Não foi possível concluir a operação.",
        });
      }
    });
  }

  const lowStockCount = products.filter(isLowStock).length;
  const categoryCount = new Set(products.map((product) => product.category)).size;

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <header className="mb-7">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Controle da propriedade
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Estoque</h1>
        <p className="mt-1 max-w-3xl text-slate-500">
          Controle os produtos, insumos e materiais disponíveis na propriedade.
        </p>
      </header>

      <section className="mb-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Produtos cadastrados" value={products.length} tone="bg-emerald-100 text-emerald-700" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true"><path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z" /><path d="M3 7.5V17l9 4.5 9-4.5V7.5M12 12v9.5" /></svg>} />
        <SummaryCard label="Produtos com estoque baixo" value={lowStockCount} tone="bg-rose-100 text-rose-700" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.5 2.6 18a2 2 0 0 0 1.8 3h15.2a2 2 0 0 0 1.8-3L13.7 3.5a2 2 0 0 0-3.4 0Z" /></svg>} />
        <SummaryCard label="Categorias usadas" value={categoryCount} tone="bg-sky-100 text-sky-700" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg>} />
      </section>

      {canCreateProduct ? (
        <section className="ag-form-section">
          <div className="border-b border-emerald-950/7 bg-white/45 px-4 py-5 sm:px-6">
            <h2 className="text-lg font-bold text-slate-900">Cadastrar novo produto</h2>
            <p className="mt-1 text-sm text-slate-500">Informe o que está guardado e a quantidade disponível.</p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-5 p-4 sm:p-6 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Nome do produto</span>
              <input required value={formData.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Ex: Adubo NPK, Semente de soja" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Quantidade atual</span>
              <input required inputMode="decimal" value={formData.initialQuantity} onChange={(event) => updateField("initialQuantity", event.target.value)} placeholder="Ex: 1.234,56" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Unidade</span>
              <select value={formData.unit} onChange={(event) => updateField("unit", event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10">
                {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </label>

            {isModoCompleto && (
              <fieldset className="ag-detail-group grid gap-5 p-4 md:col-span-2 md:grid-cols-2">
                <legend className="px-2 text-sm font-bold text-emerald-900">Informações completas</legend>
                <p className="text-sm text-emerald-800 md:col-span-2">Campos opcionais para acompanhar compra, validade e reposição.</p>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Categoria</span>
                  <select value={formData.categoryLabel} onChange={(event) => updateField("categoryLabel", event.target.value as ProductCategoryLabel)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10">
                    {PRODUCT_CATEGORY_OPTIONS.map(({ label }) => <option key={label} value={label}>{label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Local de armazenamento</span>
                  <input value={formData.storageLocation} onChange={(event) => updateField("storageLocation", event.target.value)} placeholder="Ex: Barracão principal" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Observação</span>
                  <textarea rows={3} value={formData.note} onChange={(event) => updateField("note", event.target.value)} placeholder="Ex: Produto comprado para a safra" className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Estoque mínimo</span>
                  <input inputMode="decimal" value={formData.minimumStock} onChange={(event) => updateField("minimumStock", event.target.value)} placeholder="Ex: 50,5" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Fornecedor</span>
                  <input value={formData.supplier} onChange={(event) => updateField("supplier", event.target.value)} placeholder="Ex: Cooperativa local" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Valor unitário (R$)</span>
                  <input inputMode="decimal" value={formData.unitValue} onChange={(event) => updateField("unitValue", event.target.value)} placeholder="Ex: 85,50" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Validade</span>
                  <input type="date" value={formData.expirationDate} onChange={(event) => updateField("expirationDate", event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Número do lote</span>
                  <input value={formData.batchNumber} onChange={(event) => updateField("batchNumber", event.target.value)} placeholder="Ex: LT-2026-041" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Data de compra</span>
                  <input type="date" value={formData.purchaseDate} onChange={(event) => updateField("purchaseDate", event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Observação técnica</span>
                  <textarea rows={3} value={formData.technicalNote} onChange={(event) => updateField("technicalNote", event.target.value)} placeholder="Detalhes de uso, conservação ou reposição" className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                </label>
              </fieldset>
            )}

            {feedback && <p role={feedback.tone === "error" ? "alert" : "status"} className={`text-sm font-semibold md:col-span-2 ${feedback.tone === "error" ? "text-rose-700" : "text-emerald-700"}`}>{feedback.message}</p>}
            <div className="flex justify-end md:col-span-2">
              <button type="submit" disabled={isPending} className="ag-button-primary w-full px-5 py-3 text-sm font-bold disabled:cursor-wait disabled:opacity-60 sm:w-auto">{isPending ? "Cadastrando..." : "Cadastrar produto"}</button>
            </div>
          </form>
        </section>
      ) : (
        <section role="note" className="mb-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 sm:p-5">
          <p className="text-sm font-bold">Modo consulta</p>
          <p className="mt-1 text-sm leading-6 text-emerald-800">Você pode consultar os produtos e saldos desta propriedade, mas seu papel não permite cadastrar produtos por esta tela.</p>
        </section>
      )}

      <section className="mt-7">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-xl font-bold text-slate-900">Produtos cadastrados</h2><p className="mt-1 text-sm text-slate-500">Veja as quantidades disponíveis e os produtos que precisam de atenção.</p></div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">{products.length} {products.length === 1 ? "produto" : "produtos"}</span>
        </div>

        {products.length === 0 ? (
          <div className="ag-card p-8 text-center text-sm text-slate-500">Nenhum produto cadastrado.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => {
              const lowStock = isLowStock(product);
              const categoryLabel = getProductCategoryLabel(product.category);
              return (
                <article key={product.id} className={`ag-card ag-card-interactive p-5 ${lowStock ? "!border-rose-200" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${categoryColors[categoryLabel]}`}>{categoryLabel}</span>
                    {lowStock && <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">Estoque baixo</span>}
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">{product.name}</h3>
                  <p className={`mt-1 text-2xl font-bold ${lowStock ? "text-rose-700" : "text-emerald-700"}`}>{formatRuralDecimalPtBr(product.quantity)} <span className="text-base font-semibold">{product.unit}</span></p>
                  <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
                    {product.minimumStock !== null && <p><span className="text-slate-400">Estoque mínimo:</span> <strong className="font-semibold text-slate-700">{formatRuralDecimalPtBr(product.minimumStock)} {product.unit}</strong></p>}
                    {product.storageLocation && <p><span className="text-slate-400">Onde está guardado:</span> <strong className="font-semibold text-slate-700">{product.storageLocation}</strong></p>}
                    {product.note && <p className="leading-5 text-slate-500">{product.note}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
