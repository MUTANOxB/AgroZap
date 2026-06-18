"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  useAgroApp,
  type ProductCategory,
  type ProductUnit,
  type StockProduct,
} from "@/context/AgroAppContext";

type StockForm = {
  name: string;
  category: ProductCategory;
  quantity: string;
  unit: ProductUnit;
  minimumStock: string;
  storageLocation: string;
  note: string;
};

const categories: ProductCategory[] = [
  "Semente",
  "Adubo",
  "Defensivo",
  "Combustível",
  "Ração",
  "Peça",
  "Ferramenta",
  "Outro",
];

const units: ProductUnit[] = [
  "kg",
  "litros",
  "sacos",
  "unidades",
  "caixas",
  "toneladas",
  "metros",
  "outro",
];

const emptyForm: StockForm = {
  name: "",
  category: "Semente",
  quantity: "",
  unit: "kg",
  minimumStock: "",
  storageLocation: "",
  note: "",
};

const categoryColors: Record<ProductCategory, string> = {
  Semente: "bg-emerald-100 text-emerald-700",
  Adubo: "bg-lime-100 text-lime-700",
  Defensivo: "bg-sky-100 text-sky-700",
  Combustível: "bg-amber-100 text-amber-700",
  Ração: "bg-orange-100 text-orange-700",
  Peça: "bg-slate-200 text-slate-700",
  Ferramenta: "bg-violet-100 text-violet-700",
  Outro: "bg-teal-100 text-teal-700",
};

function formatQuantity(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

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
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`rounded-xl p-2.5 ${tone}`}>{icon}</span>
      </div>
      <strong className="mt-4 block text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </strong>
    </article>
  );
}

export default function EstoquePage() {
  /*
   * Os produtos vêm do AgroAppContext. Isso permite que uma anotação de compra
   * ou uso atualize a mesma lista mostrada nesta tela.
   */
  const { produtos, adicionarProduto } = useAgroApp();

  /*
   * O estado do formulário guarda temporariamente os valores digitados antes
   * de o produto ser cadastrado na lista.
   */
  const [formData, setFormData] = useState<StockForm>(emptyForm);

  /*
   * Esta função atualiza somente o campo alterado e preserva todos os outros
   * valores que a pessoa já preencheu.
   */
  function updateField<K extends keyof StockForm>(
    field: K,
    value: StockForm[K],
  ) {
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const newProduct: Omit<StockProduct, "id"> = {
      name: formData.name.trim(),
      category: formData.category,
      quantity: Number(formData.quantity),
      unit: formData.unit,
      minimumStock:
        formData.minimumStock === "" ? null : Number(formData.minimumStock),
      storageLocation: formData.storageLocation.trim(),
      note: formData.note.trim(),
    };

    adicionarProduto(newProduct);
    setFormData(emptyForm);
  }

  /*
   * Um produto está com estoque baixo quando possui um mínimo cadastrado e sua
   * quantidade atual é menor ou igual a esse valor.
   */
  function hasLowStock(product: StockProduct) {
    return (
      product.minimumStock !== null &&
      product.quantity <= product.minimumStock
    );
  }

  /*
   * Os cards de resumo são calculados diretamente a partir da lista atual:
   * total de itens, quantidade em alerta e número de categorias diferentes.
   */
  const lowStockCount = produtos.filter(hasLowStock).length;
  const categoryCount = new Set(produtos.map((product) => product.category)).size;

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <header className="mb-7">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Controle da propriedade
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">
          Estoque
        </h1>
        <p className="mt-1 max-w-3xl text-slate-500">
          Controle os produtos, insumos e materiais disponíveis na propriedade.
        </p>
      </header>

      <section className="mb-7 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Produtos cadastrados"
          value={produtos.length}
          tone="bg-emerald-100 text-emerald-700"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
              <path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z" />
              <path d="M3 7.5V17l9 4.5 9-4.5V7.5M12 12v9.5" />
            </svg>
          }
        />
        <SummaryCard
          label="Produtos com estoque baixo"
          value={lowStockCount}
          tone="bg-rose-100 text-rose-700"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 3.5 2.6 18a2 2 0 0 0 1.8 3h15.2a2 2 0 0 0 1.8-3L13.7 3.5a2 2 0 0 0-3.4 0Z" />
            </svg>
          }
        />
        <SummaryCard
          label="Categorias usadas"
          value={categoryCount}
          tone="bg-sky-100 text-sky-700"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
          }
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-bold text-slate-900">
            Cadastrar novo produto
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Informe o que está guardado e a quantidade disponível.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5 p-6 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Nome do produto
            </span>
            <input
              required
              value={formData.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Ex: Adubo NPK, Semente de soja, Óleo diesel, Fungicida"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Categoria
            </span>
            <select
              value={formData.category}
              onChange={(event) =>
                updateField("category", event.target.value as ProductCategory)
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Quantidade atual
            </span>
            <input
              required
              min="0"
              step="any"
              type="number"
              value={formData.quantity}
              onChange={(event) => updateField("quantity", event.target.value)}
              placeholder="Ex: 300"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Unidade
            </span>
            <select
              value={formData.unit}
              onChange={(event) =>
                updateField("unit", event.target.value as ProductUnit)
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            >
              {units.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Estoque mínimo{" "}
              <span className="font-normal text-slate-400">(opcional)</span>
            </span>
            <input
              min="0"
              step="any"
              type="number"
              value={formData.minimumStock}
              onChange={(event) =>
                updateField("minimumStock", event.target.value)
              }
              placeholder="Ex: 50"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Local de armazenamento{" "}
              <span className="font-normal text-slate-400">(opcional)</span>
            </span>
            <input
              value={formData.storageLocation}
              onChange={(event) =>
                updateField("storageLocation", event.target.value)
              }
              placeholder="Ex: Barracão principal, galpão de máquinas, depósito"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Observação{" "}
              <span className="font-normal text-slate-400">(opcional)</span>
            </span>
            <textarea
              rows={3}
              value={formData.note}
              onChange={(event) => updateField("note", event.target.value)}
              placeholder="Ex: Produto comprado para a safra 2025/26"
              className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </label>

          <div className="flex justify-end md:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
            >
              Cadastrar produto
            </button>
          </div>
        </form>
      </section>

      <section className="mt-7">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Produtos cadastrados
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Veja as quantidades disponíveis e os produtos que precisam de atenção.
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
            {produtos.length} {produtos.length === 1 ? "produto" : "produtos"}
          </span>
        </div>

        {/*
         * A lista percorre o estado products e transforma cada produto em um
         * card. Informações opcionais só aparecem quando foram preenchidas.
         */}
        <div className="grid gap-4 md:grid-cols-2">
          {produtos.map((product) => {
            const lowStock = hasLowStock(product);

            return (
              <article
                key={product.id}
                className={`rounded-2xl border bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] ${
                  lowStock ? "border-rose-200" : "border-slate-200/80"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${categoryColors[product.category]}`}>
                    {product.category}
                  </span>
                  {lowStock && (
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
                      Estoque baixo
                    </span>
                  )}
                </div>

                <h3 className="mt-4 text-lg font-bold text-slate-900">
                  {product.name}
                </h3>
                <p className={`mt-1 text-2xl font-bold ${lowStock ? "text-rose-700" : "text-emerald-700"}`}>
                  {formatQuantity(product.quantity)}{" "}
                  <span className="text-base font-semibold">{product.unit}</span>
                </p>

                <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
                  {product.minimumStock !== null && (
                    <p>
                      <span className="text-slate-400">Estoque mínimo:</span>{" "}
                      <strong className="font-semibold text-slate-700">
                        {formatQuantity(product.minimumStock)} {product.unit}
                      </strong>
                    </p>
                  )}
                  {product.storageLocation && (
                    <p>
                      <span className="text-slate-400">Onde está guardado:</span>{" "}
                      <strong className="font-semibold text-slate-700">
                        {product.storageLocation}
                      </strong>
                    </p>
                  )}
                  {product.note && (
                    <p className="leading-5 text-slate-500">{product.note}</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
