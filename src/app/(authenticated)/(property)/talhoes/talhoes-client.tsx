"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import {
  createAreaAction,
  updateAreaAction,
} from "@/app/(authenticated)/(property)/rural-actions";
import { useAgroApp } from "@/context/AgroAppContext";
import { usePropertyAccess } from "@/context/PropertyAccessContext";
import type { AreaDto } from "@/services/rural/rural-dtos";
import {
  AREA_TYPE_OPTIONS,
  buildCreateAreaInput,
  buildUpdateAreaInput,
  formatRuralDecimalPtBr,
  getAreaEditFormValues,
  getAreaTypeLabel,
  type AreaEditFormValues,
  type AreaFormValues,
  type AreaTypeLabel,
} from "@/services/rural/rural-ui";

const emptyForm: AreaFormValues = {
  name: "",
  typeLabel: "Lavoura",
  size: "",
  sizeUnit: "hectares",
  note: "",
  currentCrop: "",
  harvest: "",
  soilType: "",
  irrigation: "",
  estimatedProductivity: "",
  productivityUnit: "",
};

const typeColors = {
  Lavoura: "bg-emerald-100 text-emerald-700",
  Pasto: "bg-lime-100 text-lime-700",
  Horta: "bg-teal-100 text-teal-700",
  Pomar: "bg-amber-100 text-amber-700",
  Estufa: "bg-sky-100 text-sky-700",
  Outro: "bg-slate-100 text-slate-700",
} as const satisfies Record<AreaTypeLabel, string>;

type TalhoesClientProps = {
  areas: AreaDto[];
};

type FormFeedback = {
  tone: "error" | "success";
  message: string;
};

type AreaEditPanelProps = {
  values: AreaEditFormValues;
  feedback: FormFeedback | null;
  isPending: boolean;
  onChange: <K extends keyof AreaEditFormValues>(
    field: K,
    value: AreaEditFormValues[K],
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

function AreaEditPanel({
  values,
  feedback,
  isPending,
  onChange,
  onSubmit,
  onCancel,
}: AreaEditPanelProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="mt-5 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-2"
    >
      <div className="md:col-span-2">
        <h4 className="font-bold text-slate-900">Editar área</h4>
        <p className="mt-1 text-sm text-slate-500">
          Atualize os dados cadastrais sem alterar a propriedade vinculada.
        </p>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Nome da área
        </span>
        <input
          required
          value={values.name}
          onChange={(event) => onChange("name", event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Tipo
        </span>
        <select
          value={values.typeLabel}
          onChange={(event) =>
            onChange("typeLabel", event.target.value as AreaTypeLabel)
          }
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        >
          {AREA_TYPE_OPTIONS.map(({ label }) => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Tamanho
        </span>
        <input
          inputMode="decimal"
          value={values.size}
          onChange={(event) => onChange("size", event.target.value)}
          placeholder="Ex: 5,5"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Unidade
        </span>
        <input
          value={values.sizeUnit}
          onChange={(event) => onChange("sizeUnit", event.target.value)}
          placeholder="Ex: hectares"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        />
      </label>

      <label className="block md:col-span-2">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Observação
        </span>
        <textarea
          rows={3}
          value={values.note}
          onChange={(event) => onChange("note", event.target.value)}
          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Cultura atual
        </span>
        <input
          value={values.currentCrop}
          onChange={(event) => onChange("currentCrop", event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Safra
        </span>
        <input
          value={values.harvest}
          onChange={(event) => onChange("harvest", event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Tipo de solo
        </span>
        <input
          value={values.soilType}
          onChange={(event) => onChange("soilType", event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Irrigação
        </span>
        <input
          value={values.irrigation}
          onChange={(event) => onChange("irrigation", event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Produtividade estimada
        </span>
        <input
          inputMode="decimal"
          value={values.estimatedProductivity}
          onChange={(event) =>
            onChange("estimatedProductivity", event.target.value)
          }
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Unidade da produtividade
        </span>
        <input
          value={values.productivityUnit}
          onChange={(event) =>
            onChange("productivityUnit", event.target.value)
          }
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        />
      </label>

      {feedback && (
        <p
          role={feedback.tone === "error" ? "alert" : "status"}
          className={`text-sm font-semibold md:col-span-2 ${feedback.tone === "error" ? "text-rose-700" : "text-emerald-700"}`}
        >
          {feedback.message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 md:col-span-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="ag-button-secondary px-5 py-3 text-sm font-bold disabled:cursor-wait disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="ag-button-primary px-5 py-3 text-sm font-bold disabled:cursor-wait disabled:opacity-60"
        >
          {isPending ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}

export function TalhoesClient({ areas }: TalhoesClientProps) {
  const router = useRouter();
  const { isModoCompleto } = useAgroApp();
  const { can } = usePropertyAccess();
  const canCreateArea = can("CREATE_AREA");
  const canEditArea = can("EDIT_AREA");
  const [formData, setFormData] = useState<AreaFormValues>(emptyForm);
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editFormData, setEditFormData] =
    useState<AreaEditFormValues | null>(null);
  const [editFeedback, setEditFeedback] = useState<FormFeedback | null>(null);
  const [pendingOperation, setPendingOperation] = useState<
    "create" | "edit" | null
  >(null);
  const [isPending, startTransition] = useTransition();
  const operationLock = useRef(false);
  const operationPending = isPending || pendingOperation !== null;

  function updateField<K extends keyof AreaFormValues>(
    field: K,
    value: AreaFormValues[K],
  ) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateArea || operationLock.current) return;
    operationLock.current = true;
    setPendingOperation("create");
    setFeedback(null);

    startTransition(async () => {
      try {
        const result = await createAreaAction(
          buildCreateAreaInput(formData, isModoCompleto),
        );
        if (!result.ok) {
          setFeedback({ tone: "error", message: result.error.message });
          return;
        }

        setFormData(emptyForm);
        setFeedback({ tone: "success", message: "Área cadastrada com sucesso." });
        router.refresh();
      } catch {
        setFeedback({
          tone: "error",
          message: "Não foi possível concluir a operação.",
        });
      } finally {
        operationLock.current = false;
        setPendingOperation(null);
      }
    });
  }

  function toggleAreaEditor(area: AreaDto) {
    if (!canEditArea || operationLock.current) return;
    if (editingAreaId === area.id) {
      setEditingAreaId(null);
      setEditFormData(null);
      setEditFeedback(null);
      return;
    }

    setEditingAreaId(area.id);
    setEditFormData(getAreaEditFormValues(area));
    setEditFeedback(null);
  }

  function updateEditField<K extends keyof AreaEditFormValues>(
    field: K,
    value: AreaEditFormValues[K],
  ) {
    setEditFormData((current) =>
      current === null ? current : { ...current, [field]: value },
    );
  }

  function cancelAreaEdit() {
    if (operationLock.current) return;
    setEditingAreaId(null);
    setEditFormData(null);
    setEditFeedback(null);
  }

  function handleAreaEdit(
    event: FormEvent<HTMLFormElement>,
    areaId: string,
  ) {
    event.preventDefault();
    if (
      !canEditArea ||
      editFormData === null ||
      editingAreaId !== areaId ||
      operationLock.current
    ) {
      return;
    }

    operationLock.current = true;
    setPendingOperation("edit");
    setEditFeedback(null);

    startTransition(async () => {
      try {
        const result = await updateAreaAction(
          buildUpdateAreaInput(areaId, editFormData),
        );
        if (!result.ok) {
          setEditFeedback({ tone: "error", message: result.error.message });
          return;
        }

        setEditingAreaId(null);
        setEditFormData(null);
        setEditFeedback(null);
        router.refresh();
      } catch {
        setEditFeedback({
          tone: "error",
          message: "Não foi possível concluir a operação.",
        });
      } finally {
        operationLock.current = false;
        setPendingOperation(null);
      }
    });
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-7">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Organização da propriedade
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Área cultivada
        </h1>
        <p className="mt-1 max-w-3xl text-slate-500">
          Cadastre e acompanhe as áreas usadas para plantio, manejo e colheita.
        </p>
      </header>

      {canCreateArea ? (
        <section className="ag-form-section">
          <div className="border-b border-emerald-950/7 bg-white/45 px-4 py-5 sm:px-6">
            <h2 className="text-lg font-bold text-slate-900">Cadastrar nova área</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use um nome simples que você e sua equipe reconheçam com facilidade.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-5 p-4 sm:p-6 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Nome da área</span>
              <input
                required
                value={formData.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Ex: Lavoura do milho, Roça do fundo"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Tipo</span>
              <select
                value={formData.typeLabel}
                onChange={(event) =>
                  updateField("typeLabel", event.target.value as AreaTypeLabel)
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              >
                {AREA_TYPE_OPTIONS.map(({ label }) => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Tamanho</span>
              <input
                required
                inputMode="decimal"
                value={formData.size}
                onChange={(event) => updateField("size", event.target.value)}
                placeholder="Ex: 5,5"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Unidade</span>
              <input
                required
                value={formData.sizeUnit}
                onChange={(event) => updateField("sizeUnit", event.target.value)}
                placeholder="Ex: hectares, alqueires, m²"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </label>

            {isModoCompleto && (
              <fieldset className="ag-detail-group grid gap-5 p-4 md:col-span-2 md:grid-cols-2">
                <legend className="px-2 text-sm font-bold text-emerald-900">Informações completas</legend>
                <p className="text-sm text-emerald-800 md:col-span-2">
                  Campos opcionais para acompanhar os detalhes técnicos da área.
                </p>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Observação</span>
                  <input value={formData.note} onChange={(event) => updateField("note", event.target.value)} placeholder="Ex: Área perto do rio" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Cultura atual</span>
                  <input value={formData.currentCrop} onChange={(event) => updateField("currentCrop", event.target.value)} placeholder="Ex: Milho, soja, café" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Safra</span>
                  <input value={formData.harvest} onChange={(event) => updateField("harvest", event.target.value)} placeholder="Ex: 2025/26" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Tipo de solo</span>
                  <input value={formData.soilType} onChange={(event) => updateField("soilType", event.target.value)} placeholder="Ex: Argiloso, arenoso" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Irrigação</span>
                  <input value={formData.irrigation} onChange={(event) => updateField("irrigation", event.target.value)} placeholder="Ex: Gotejamento, pivô" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Produtividade estimada</span>
                  <input inputMode="decimal" value={formData.estimatedProductivity} onChange={(event) => updateField("estimatedProductivity", event.target.value)} placeholder="Ex: 60" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Unidade da produtividade</span>
                  <input value={formData.productivityUnit} onChange={(event) => updateField("productivityUnit", event.target.value)} placeholder="Ex: sacas/ha" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                </label>
              </fieldset>
            )}

            {feedback && (
              <p
                role={feedback.tone === "error" ? "alert" : "status"}
                className={`text-sm font-semibold md:col-span-2 ${feedback.tone === "error" ? "text-rose-700" : "text-emerald-700"}`}
              >
                {feedback.message}
              </p>
            )}

            <div className="flex justify-end md:col-span-2">
              <button type="submit" disabled={operationPending} className="ag-button-primary w-full px-5 py-3 text-sm font-bold disabled:cursor-wait disabled:opacity-60 sm:w-auto">
                {pendingOperation === "create" ? "Cadastrando..." : "Cadastrar área"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section role="note" className="mb-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 sm:p-5">
          <p className="text-sm font-bold">Modo consulta</p>
          <p className="mt-1 text-sm leading-6 text-emerald-800">
            Você pode acompanhar as áreas desta propriedade, mas seu papel não permite cadastrar novas áreas.
          </p>
        </section>
      )}

      <section className="mt-7">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Áreas cadastradas</h2>
            <p className="mt-1 text-sm text-slate-500">Veja as áreas cadastradas da propriedade.</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
            {areas.length} {areas.length === 1 ? "local" : "locais"}
          </span>
        </div>

        {areas.length === 0 ? (
          <div className="ag-card p-8 text-center text-sm text-slate-500">Nenhuma área cadastrada.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {areas.map((area) => {
              const typeLabel = getAreaTypeLabel(area.type);
              const isEditing = editingAreaId === area.id;
              return (
                <article
                  key={area.id}
                  className={`ag-card ag-card-interactive p-5 ${isEditing ? "md:col-span-2 xl:col-span-3" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-800 bg-emerald-950 text-white shadow-sm">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                        <path d="M4 20c3-4 5-9 5-16" /><path d="M20 20c-3-4-5-9-5-16" /><path d="M4 13c3 0 5 1 7 4" /><path d="M20 13c-3 0-5 1-7 4" />
                      </svg>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${typeColors[typeLabel]}`}>{typeLabel}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">{area.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-emerald-700">
                    {area.size ? `${formatRuralDecimalPtBr(area.size)}${area.sizeUnit ? ` ${area.sizeUnit}` : ""}` : "Tamanho não informado"}
                  </p>
                  <p className="mt-4 min-h-10 text-sm leading-5 text-slate-500">{area.note || "Nenhuma observação cadastrada."}</p>

                  {canEditArea && (
                    <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        aria-expanded={isEditing}
                        aria-controls={`area-edit-${area.id}`}
                        disabled={operationPending}
                        onClick={() => toggleAreaEditor(area)}
                        className="ag-button-secondary min-h-10 px-4 text-sm font-bold disabled:cursor-wait disabled:opacity-60"
                      >
                        {isEditing ? "Fechar edição" : "Editar"}
                      </button>
                    </div>
                  )}

                  {isEditing && editFormData && (
                    <div id={`area-edit-${area.id}`}>
                      <AreaEditPanel
                        values={editFormData}
                        feedback={editFeedback}
                        isPending={operationPending}
                        onChange={updateEditField}
                        onSubmit={(event) => handleAreaEdit(event, area.id)}
                        onCancel={cancelAreaEdit}
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
