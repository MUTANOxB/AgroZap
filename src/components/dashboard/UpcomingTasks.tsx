import type { UpcomingTask } from "@/data/dashboardMock";
import { DashboardPanel } from "./DashboardPanel";

type UpcomingTasksProps = {
  tasks: UpcomingTask[];
};

// Organiza os próximos compromissos e aplica destaque visual aos itens urgentes.
export function UpcomingTasks({ tasks }: UpcomingTasksProps) {
  return (
    <DashboardPanel
      title="Próximos vencimentos"
      subtitle="Compromissos que pedem atenção"
      icon="calendar"
    >
      <div className="divide-y divide-slate-100">
        {tasks.map((item) => (
          <div key={`${item.day}-${item.title}`} className="flex items-center gap-4 px-5 py-4">
            <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${item.urgent ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
              <strong className="text-xl leading-none">{item.day}</strong>
              <span className="mt-1 text-[10px] font-bold tracking-wider">{item.month}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
              <p className={`mt-1 text-xs ${item.urgent ? "font-semibold text-rose-600" : "text-slate-400"}`}>
                {item.detail}
              </p>
            </div>
            <span className="text-lg text-slate-300">›</span>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}
