import Link from "next/link";
import type { UpcomingTask } from "@/data/dashboardMock";
import { useClima } from "@/hooks/useClima";
import { DashboardIcon } from "./DashboardIcon";
import type { RecentActivityItem } from "./RecentActivities";

type SimpleDashboardDetailsProps = {
  activities: RecentActivityItem[];
  tasks: UpcomingTask[];
};

/*
 * Estes cards mantêm informações úteis no Modo Simples sem trazer as listas
 * longas do dashboard completo. Anotações e vencimentos são limitados aqui.
 */
export function SimpleDashboardDetails({
  activities,
  tasks,
}: SimpleDashboardDetailsProps) {
  const { clima, isLoading, error } = useClima();
  const recentActivities = activities.slice(0, 3);
  const nextTasks = tasks.slice(0, 3);

  return (
    <section className="mt-5 grid gap-4 lg:grid-cols-3">
      <article className="ag-card ag-card-interactive p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">Clima na fazenda</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {clima?.local ?? "Rio Verde, GO"}
            </p>
          </div>
          <span className="rounded-xl border border-amber-200/60 bg-amber-50 p-2.5 text-amber-600 shadow-sm">
            <DashboardIcon name="sun" />
          </span>
        </header>

        {isLoading ? (
          <p className="mt-8 animate-pulse text-sm font-semibold text-slate-500">
            Carregando clima...
          </p>
        ) : error || !clima ? (
          <div className="mt-6 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            Não foi possível carregar o clima agora.
          </div>
        ) : (
          <>
            <div className="mt-5 flex items-end gap-3">
              <strong className="text-4xl font-bold tracking-tight text-slate-950">
                {clima.temperatura === null ? "—" : `${Math.round(clima.temperatura)}°`}
              </strong>
              <span className="pb-1 text-sm font-semibold text-slate-600">
                {clima.condicao}
              </span>
            </div>

            <p className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <DashboardIcon name="rain" className="h-4 w-4 text-sky-600" />
              Chuva:{" "}
              <strong className="text-slate-800">
                {clima.chanceChuva === null
                  ? "Não informada"
                  : `${Math.round(clima.chanceChuva)}%`}
              </strong>
            </p>
            {clima.aviso && (
              <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
                {clima.aviso}
              </p>
            )}
          </>
        )}
      </article>

      <article className="ag-card ag-card-interactive flex flex-col p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">Últimas anotações</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Os registros mais recentes
            </p>
          </div>
          <span className="rounded-xl border border-sky-200/60 bg-sky-50 p-2.5 text-sky-700 shadow-sm">
            <DashboardIcon name="activity" />
          </span>
        </header>

        <div className="mt-4 flex-1 divide-y divide-slate-100">
          {recentActivities.length > 0 ? (
            recentActivities.map((activity) => (
              <div key={activity.id} className="py-3 first:pt-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {activity.title}
                </p>
                <p className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-400">
                  <span className="truncate">{activity.meta}</span>
                  <time className="shrink-0">{activity.time}</time>
                </p>
              </div>
            ))
          ) : (
            <p className="py-4 text-sm text-slate-500">
              Nenhuma anotação registrada.
            </p>
          )}
        </div>

        <Link
          href="/registros"
          className="ag-button-secondary mt-3 inline-flex min-h-10 items-center justify-center px-4 text-sm font-semibold"
        >
          Ver anotações
        </Link>
      </article>

      <article className="ag-card ag-card-interactive flex flex-col p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">Tarefas de demonstração</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Exemplos — este bloco ainda não é persistido
            </p>
          </div>
          <span className="rounded-xl border border-emerald-200/60 bg-emerald-50 p-2.5 text-emerald-700 shadow-sm">
            <DashboardIcon name="calendar" />
          </span>
        </header>

        <div className="mt-4 flex-1 divide-y divide-slate-100">
          {nextTasks.map((task) => (
            <div key={`${task.day}-${task.title}`} className="flex gap-3 py-3 first:pt-0">
              <div
                className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg ${
                  task.urgent
                    ? "bg-rose-50 text-rose-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                <strong className="text-sm leading-none">{task.day}</strong>
                <span className="mt-0.5 text-[9px] font-bold">{task.month}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {task.title}
                </p>
                <p
                  className={`mt-1 text-xs ${
                    task.urgent ? "font-semibold text-rose-600" : "text-slate-400"
                  }`}
                >
                  {task.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-400">
          Tarefas reais serão conectadas em uma etapa futura.
        </p>
      </article>
    </section>
  );
}
