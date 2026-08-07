"use client";

import { useState, type FormEvent } from "react";
import {
  useAgroApp,
  type Annotation,
  type AnnotationType,
} from "@/context/AgroAppContext";
import { usePropertyAccess } from "@/context/PropertyAccessContext";
import { getStockErrorMessage } from "@/services/estoque/errors";
import {
  parseRequiredLocalStockQuantity,
  requireValidLocalStockProduct,
} from "@/services/estoque/local-stock";

type AnnotationForm = Omit<
  Annotation,
  "id" | "productId" | "stockQuantity"
> & {
  stockQuantity: string;
};

const annotationTypes: AnnotationType[] = [
  "Pulverização",
  "Plantio",
  "Colheita",
  "Compra",
  "Entrada no estoque",
  "Manutenção",
  "Vistoria",
  "Pagamento",
  "Observação",
];

const emptyForm: AnnotationForm = {
  type: "Pulverização",
  location: "",
  date: "2026-06-18",
  description: "",
  quantity: "",
  value: "",
  responsible: "",
  productName: "",
  stockQuantity: "",
  appliedDose: "",
  doseUnit: "",
  harvest: "",
  supplier: "",
  productBatch: "",
  technicalNote: "",
};

const stockEntryTypes: AnnotationType[] = ["Entrada no estoque", "Compra"];
const stockExitTypes: AnnotationType[] = ["Pulverização", "Plantio", "Manutenção"];

const typeColors: Record<AnnotationType, string> = {
  Pulverização: "bg-sky-100 text-sky-700",
  Plantio: "bg-emerald-100 text-emerald-700",
  Colheita: "bg-amber-100 text-amber-700",
  Compra: "bg-violet-100 text-violet-700",
  "Entrada no estoque": "bg-teal-100 text-teal-700",
  Manutenção: "bg-slate-200 text-slate-700",
  Vistoria: "bg-lime-100 text-lime-700",
  Pagamento: "bg-rose-100 text-rose-700",
  Observação: "bg-orange-100 text-orange-700",
};

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function formatStockOption(quantity: number, unit: string) {
  return `${new Intl.NumberFormat("pt-BR").format(quantity)} ${unit} disponíveis`;
}

export default function RegistrosPage() {
  /*
   * As anotações, áreas e produtos vêm do AgroAppContext. Por isso, esta tela
   * consegue usar cadastros feitos em outras páginas e também alterar o estoque.
   */
  const {
    areas,
    anotacoes: annotations,
    produtos,
    adicionarAnotacao,
    adicionarAnotacaoComMovimentacao,
    isModoCompleto,
  } = useAgroApp();
  const { can } = usePropertyAccess();
  const canCreateRecord = can("CREATE_RECORD");
  const canMoveStock = can("MOVE_STOCK");

  /*
   * O estado do formulário reúne em um único objeto tudo o que está preenchido
   * nos campos antes de a anotação ser salva.
   */
  const [formData, setFormData] = useState<AnnotationForm>(emptyForm);
  const changesStock =
    canMoveStock &&
    (stockEntryTypes.includes(formData.type) ||
      stockExitTypes.includes(formData.type));

  /*
   * Esta função atualiza somente o campo alterado e mantém os demais valores
   * que já estavam preenchidos no formulário.
   */
  function updateField<K extends keyof AnnotationForm>(
    field: K,
    value: AnnotationForm[K],
  ) {
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
    }));
  }

  /*
   * Ao salvar, procuramos o produto informado na lista compartilhada. Se houver
   * produto e quantidade válidos, compras e entradas somam ao estoque, enquanto
   * pulverização, plantio e manutenção diminuem o saldo.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateRecord) return;

    const selectedProduct = isModoCompleto
      ? produtos.find(
          (product) =>
            product.name.toLocaleLowerCase("pt-BR") ===
            formData.productName.trim().toLocaleLowerCase("pt-BR"),
        )
      : undefined;
    let stockQuantity: number | null = null;
    let stockMovement: { productId: number; change: number } | null = null;

    if (isModoCompleto && changesStock) {
      try {
        const validProduct = requireValidLocalStockProduct(selectedProduct);
        stockQuantity = parseRequiredLocalStockQuantity(
          formData.stockQuantity,
        );
        stockMovement = {
          productId: validProduct.id,
          change: stockEntryTypes.includes(formData.type)
            ? stockQuantity
            : -stockQuantity,
        };
      } catch (error) {
        window.alert(getStockErrorMessage(error));
        return;
      }
    }

    const newAnnotation: Omit<Annotation, "id"> = {
      type: isModoCompleto ? formData.type : "Observação",
      location: formData.location.trim(),
      date: formData.date,
      description: formData.description.trim(),
      quantity: isModoCompleto ? formData.quantity.trim() : "",
      value: isModoCompleto ? formData.value.trim() : "",
      responsible: isModoCompleto ? formData.responsible.trim() : "",
      productId: selectedProduct?.id ?? null,
      productName: isModoCompleto
        ? selectedProduct?.name ?? formData.productName.trim()
        : "",
      stockQuantity,
      appliedDose: isModoCompleto ? formData.appliedDose?.trim() : "",
      doseUnit: isModoCompleto ? formData.doseUnit?.trim() : "",
      harvest: isModoCompleto ? formData.harvest?.trim() : "",
      supplier: isModoCompleto ? formData.supplier?.trim() : "",
      productBatch: isModoCompleto ? formData.productBatch?.trim() : "",
      technicalNote: isModoCompleto ? formData.technicalNote?.trim() : "",
    };

    try {
      if (stockMovement) {
        adicionarAnotacaoComMovimentacao(newAnnotation, stockMovement);
      } else {
        adicionarAnotacao(newAnnotation);
      }
    } catch (error) {
      window.alert(getStockErrorMessage(error));
      return;
    }
    setFormData(emptyForm);
  }

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <header className="mb-7">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Rotina da propriedade
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Anotações
        </h1>
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
              {/* O modo simples pede somente uma descrição, a data e um local
                  opcional. Isso reduz o tempo e a complexidade do registro. */}
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  O que aconteceu?
                </span>
                <textarea
                  required
                  autoFocus
                  rows={5}
                  value={formData.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  placeholder="Ex: Apliquei 20 litros de herbicida na lavoura do milho"
                  className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Data</span>
                <input
                  required
                  type="date"
                  value={formData.date}
                  onChange={(event) => updateField("date", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Onde foi feito? <span className="font-normal text-slate-400">(opcional)</span>
                </span>
                <input
                  list="registered-areas-simple"
                  value={formData.location}
                  onChange={(event) => updateField("location", event.target.value)}
                  placeholder="Ex: Lavoura do milho"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                />
                <datalist id="registered-areas-simple">
                  {areas.map((area) => (
                    <option key={area.id} value={area.name} />
                  ))}
                </datalist>
              </label>
            </>
          ) : (
            <>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              O que foi feito?
            </span>
            <select
              value={formData.type}
              onChange={(event) =>
                updateField("type", event.target.value as AnnotationType)
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            >
              {annotationTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Onde foi feito?
            </span>
            <input
              required
              list="registered-areas"
              value={formData.location}
              onChange={(event) => updateField("location", event.target.value)}
              placeholder="Ex: Lavoura do milho, Roça do fundo, Horta principal, Pasto 2"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
            <datalist id="registered-areas">
              {areas.map((area) => (
                <option key={area.id} value={area.name} />
              ))}
            </datalist>
            {areas.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Cadastre uma área antes ou informe manualmente.
              </p>
            )}
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Data
            </span>
            <input
              required
              type="date"
              value={formData.date}
              onChange={(event) => updateField("date", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Quantidade <span className="font-normal text-slate-400">(opcional)</span>
            </span>
            <input
              value={formData.quantity}
              onChange={(event) => updateField("quantity", event.target.value)}
              placeholder="Ex: 20 litros, 300 sacos, 1.200 kg"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Descrição
            </span>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Ex: Apliquei produto para controle de pragas na lavoura do milho."
              className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Responsável <span className="font-normal text-slate-400">(opcional)</span>
            </span>
            <input
              value={formData.responsible}
              onChange={(event) => updateField("responsible", event.target.value)}
              placeholder="Ex: João, Pedro, equipe da fazenda"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Valor <span className="font-normal text-slate-400">(opcional)</span>
            </span>
            <input
              value={formData.value}
              onChange={(event) => updateField("value", event.target.value)}
              placeholder="Ex: R$ 1.200,00"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </label>

          {/* No modo simples aparecem apenas os campos principais. Esta seção
              só entra no HTML quando o usuário escolhe o modo completo. */}
          {isModoCompleto && (
            <fieldset className="ag-detail-group grid gap-5 p-4 md:col-span-2 md:grid-cols-2">
              <legend className="px-2 text-sm font-bold text-emerald-900">
                Detalhes adicionais
              </legend>
              <p className="text-sm text-emerald-800 md:col-span-2">
                Informações opcionais para um registro técnico mais detalhado.
              </p>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Produto utilizado{" "}
                  <span className="font-normal text-slate-400">(opcional)</span>
                </span>
                <input
                  list="registered-products"
                  value={formData.productName}
                  onChange={(event) =>
                    updateField("productName", event.target.value)
                  }
                  placeholder="Selecione ou informe o produto"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />
                <datalist id="registered-products">
                  {produtos.map((product) => (
                    <option key={product.id} value={product.name}>
                      {formatStockOption(product.quantity, product.unit)}
                    </option>
                  ))}
                </datalist>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Dose aplicada
                </span>
                <input
                  value={formData.appliedDose}
                  onChange={(event) => updateField("appliedDose", event.target.value)}
                  placeholder="Ex: 2,5"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Unidade da dose</span>
                <input
                  value={formData.doseUnit}
                  onChange={(event) => updateField("doseUnit", event.target.value)}
                  placeholder="Ex: L/ha, kg/ha, ml"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Safra</span>
                <input
                  value={formData.harvest}
                  onChange={(event) => updateField("harvest", event.target.value)}
                  placeholder="Ex: 2025/26"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Fornecedor</span>
                <input
                  value={formData.supplier}
                  onChange={(event) => updateField("supplier", event.target.value)}
                  placeholder="Ex: Cooperativa local"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Lote do produto</span>
                <input
                  value={formData.productBatch}
                  onChange={(event) => updateField("productBatch", event.target.value)}
                  placeholder="Ex: LT-2026-041"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />
              </label>

              {changesStock && (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Quantidade movimentada
                  </span>
                  <input
                    min="0"
                    step="any"
                    type="number"
                    value={formData.stockQuantity}
                    onChange={(event) => updateField("stockQuantity", event.target.value)}
                    placeholder="Ex: 20"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  />
                </label>
              )}

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Observação técnica</span>
                <textarea
                  rows={3}
                  value={formData.technicalNote}
                  onChange={(event) => updateField("technicalNote", event.target.value)}
                  placeholder="Detalhes técnicos importantes para consultas futuras"
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />
              </label>

              {changesStock && (
                <p className="text-xs leading-5 text-emerald-800 md:col-span-2">
                  {stockEntryTypes.includes(formData.type)
                    ? "Se o produto já estiver cadastrado, a quantidade movimentada será acrescentada ao estoque."
                    : "Se o produto já estiver cadastrado, a quantidade movimentada será descontada do estoque."}
                </p>
              )}
            </fieldset>
          )}
            </>
          )}

          <div className="flex justify-end md:col-span-2">
            <button
              type="submit"
              className="ag-button-primary w-full px-5 py-3 text-sm font-bold sm:w-auto"
            >
              {isModoCompleto ? "Salvar anotação" : "Salvar anotação rápida"}
            </button>
          </div>
        </form>
        </section>
      ) : (
        <section
          role="note"
          className="mb-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 sm:p-5"
        >
          <p className="text-sm font-bold">Modo consulta</p>
          <p className="mt-1 text-sm leading-6 text-emerald-800">
            Você pode consultar o histórico desta propriedade, mas seu papel não
            permite criar novas anotações.
          </p>
        </section>
      )}

      <section className="mt-7">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Histórico da propriedade
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Veja os últimos registros feitos na propriedade.
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
            {annotations.length} {annotations.length === 1 ? "anotação" : "anotações"}
          </span>
        </div>

        {/*
         * A lista é renderizada percorrendo o estado annotations. Cada item
         * vira um card e os campos opcionais só aparecem quando foram preenchidos,
         * incluindo quantidade, responsável e valor.
         */}
        <div className="grid gap-4 lg:grid-cols-2">
          {annotations.map((annotation) => (
            <article
              key={annotation.id}
              className="ag-card ag-card-interactive p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${typeColors[annotation.type]}`}>
                  {annotation.type}
                </span>
                <time className="text-sm font-semibold text-slate-500">
                  {formatDate(annotation.date)}
                </time>
              </div>

              <h3 className="mt-4 text-lg font-bold text-slate-900">
                {annotation.type} — {annotation.location}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {annotation.description}
              </p>

              {(annotation.quantity || annotation.responsible || annotation.value || annotation.productName) && (
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-sm">
                  {annotation.quantity && (
                    <p>
                      <span className="text-slate-400">Quantidade:</span>{" "}
                      <strong className="font-semibold text-slate-700">
                        {annotation.quantity}
                      </strong>
                    </p>
                  )}
                  {annotation.responsible && (
                    <p>
                      <span className="text-slate-400">Responsável:</span>{" "}
                      <strong className="font-semibold text-slate-700">
                        {annotation.responsible}
                      </strong>
                    </p>
                  )}
                  {annotation.value && (
                    <p>
                      <span className="text-slate-400">Valor:</span>{" "}
                      <strong className="font-semibold text-slate-700">
                        {annotation.value}
                      </strong>
                    </p>
                  )}
                  {annotation.productName && (
                    <p>
                      <span className="text-slate-400">Produto:</span>{" "}
                      <strong className="font-semibold text-slate-700">
                        {annotation.productName}
                        {annotation.stockQuantity !== null
                          ? ` · ${annotation.stockQuantity}`
                          : ""}
                      </strong>
                    </p>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
