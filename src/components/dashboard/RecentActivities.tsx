import { DashboardPanel } from "./DashboardPanel";

export type RecentActivityItem = {
  id: string;
  title: string;
  meta: string;
  time: string;
  color: string;
};

type RecentActivitiesProps = {
  activities: RecentActivityItem[];
};

// Lista as últimas ações realizadas na propriedade dentro do painel padrão.
export function RecentActivities({ activities }: RecentActivitiesProps) {
  return (
    <DashboardPanel
      title="O que foi feito"
      subtitle="Anotações mais recentes da propriedade"
      icon="activity"
      href="/registros"
    >
      {activities.length > 0 ? (
        <div className="divide-y divide-slate-100">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-slate-50 ${activity.color}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{activity.title}</p>
                <p className="truncate text-xs text-slate-400">{activity.meta}</p>
              </div>
              <time className="max-w-24 shrink-0 text-right text-xs font-medium text-slate-400">
                {activity.time}
              </time>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          Nenhuma anotação registrada.
        </p>
      )}
    </DashboardPanel>
  );
}
