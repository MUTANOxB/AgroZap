import type { RecentActivity } from "@/data/dashboardMock";
import { DashboardPanel } from "./DashboardPanel";

type RecentActivitiesProps = {
  activities: RecentActivity[];
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
      <div className="divide-y divide-slate-100">
        {activities.map((activity) => (
          <div key={activity.title} className="flex items-center gap-4 px-5 py-4">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-slate-50 ${activity.color}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{activity.title}</p>
              <p className="truncate text-xs text-slate-400">{activity.meta}</p>
            </div>
            <time className="shrink-0 text-right text-xs font-medium text-slate-400">
              {activity.time}
            </time>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}
