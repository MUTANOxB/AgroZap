"use client";

import { useState, type FormEvent } from "react";
import {
  useAgroApp,
  type Area,
  type ProductionType,
} from "@/context/AgroAppContext";

type FormData = Omit<Area, "id">;

const productionTypes: ProductionType[] = [
  "Lavoura",
  "Horta",
  "Pomar",
  "Estufa",
  "Pasto",
  "Outro",
];

const emptyForm: FormData = {
  name: "",
  type: "Lavoura",
  size: "",
  note: "",
};

const typeColors: Record<ProductionType, string> = {
  Lavoura: "bg-emerald-100 text-emerald-700",
  Pasto: "bg-lime-100 text-lime-700",
  Horta: "bg-teal-100 text-teal-700",
  Pomar: "bg-amber-100 text-amber-700",
  Estufa: "bg-sky-100 text-sky-700",
  Outro: "bg-slate-100 text-slate-700",
};

export default function TalhoesPage() {
  /*
   * As áreas vêm do AgroAppContext. Quando esta tela adiciona uma área, outras
   * telas também recebem o novo dado sem precisar repetir o cadastro.
   */
  const { areas, adicionarArea } = useAgroApp();
  const [formData, setFormData] = useState<FormData>(emptyForm);

  /*
   * Cada campo é controlado pelo estado formData. Ao digitar ou selecionar uma
   * opção, criamos uma nova versão do objeto mantendo os demais valores.
   */
  function updateField<K extends keyof FormData>(field: K, value: FormData[K]) {
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
    }));
  }

  /*
   * O envio impede o recarregamento normal da página, transforma os dados do
   * formulário em um novo local e limpa os campos para o próximo cadastro.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const newLocation: FormData = {
      name: formData.name.trim(),
      type: formData.type,
      size: formData.size.trim(),
      note: formData.note.trim(),
    };

    /*
     * A lista global é atualizada pelo contexto. Além de aparecer aqui, a nova
     * área passa a ser uma opção no formulário de Anotações.
     */
    adicionarArea(newLocation);
    setFormData(emptyForm);
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Os principais textos visíveis da página ficam neste cabeçalho. */}
      <header className="mb-7">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Organização da propriedade
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Área cultivada</h1>
        <p className="mt-1 max-w-3xl text-slate-500">
          Cadastre e acompanhe as áreas usadas para plantio, manejo e colheita.
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-bold text-slate-900">Cadastrar nova área</h2>
          <p className="mt-1 text-sm text-slate-500">
            Use um nome simples que você e sua equipe reconheçam com facilidade.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5 p-6 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Nome da área</span>
            <input
              required
              value={formData.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Ex: Lavoura do milho, Roça do fundo, Horta principal"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Tipo</span>
            <select
              value={formData.type}
              onChange={(event) => updateField("type", event.target.value as ProductionType)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            >
              {productionTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Tamanho</span>
            <input
              required
              value={formData.size}
              onChange={(event) => updateField("size", event.target.value)}
              placeholder="Ex: 5 hectares, 2 alqueires, 300 m²"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Observação</span>
            <input
              value={formData.note}
              onChange={(event) => updateField("note", event.target.value)}
              placeholder="Ex: Área perto do rio, roça do fundo, local com irrigação"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </label>

          <div className="flex justify-end md:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
            >
              Cadastrar área
            </button>
          </div>
        </form>
      </section>

      <section className="mt-7">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Áreas cadastradas</h2>
            <p className="mt-1 text-sm text-slate-500">
              Veja as áreas cadastradas da propriedade.
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
            {areas.length} {areas.length === 1 ? "local" : "locais"}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {areas.map((location) => (
            <article
              key={location.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-950 text-white">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path d="M4 20c3-4 5-9 5-16" />
                    <path d="M20 20c-3-4-5-9-5-16" />
                    <path d="M4 13c3 0 5 1 7 4" />
                    <path d="M20 13c-3 0-5 1-7 4" />
                  </svg>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${typeColors[location.type]}`}>
                  {location.type}
                </span>
              </div>

              <h3 className="mt-4 text-lg font-bold text-slate-900">{location.name}</h3>
              <p className="mt-1 text-sm font-semibold text-emerald-700">{location.size}</p>
              <p className="mt-4 min-h-10 text-sm leading-5 text-slate-500">
                {location.note || "Nenhuma observação cadastrada."}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
