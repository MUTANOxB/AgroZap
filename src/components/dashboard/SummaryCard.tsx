import Link from "next/link";
import type { SummaryMetric } from "@/data/dashboardMock";
import { DashboardIcon } from "./DashboardIcon";

type SummaryCardProps = {
  metric: SummaryMetric;
  href?: string;
};

// Exibe um único indicador geral da propriedade.
// Receber o conteúdo por props permite reutilizar o mesmo visual para todas as métricas.
export function SummaryCard({ metric, href }: SummaryCardProps) {
  const card = (
    <article className="ag-card ag-card-interactive h-full p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{metric.label}</p>
        <span className={`rounded-xl border border-white/70 p-2.5 shadow-sm ${metric.tone}`}>
          <DashboardIcon name={metric.icon} />
        </span>
      </div>
      <strong className="mt-4 block text-3xl font-bold tracking-tight text-slate-950">
        {metric.value}
      </strong>
      <p className="mt-1 text-xs font-medium text-slate-400">{metric.detail}</p>
    </article>
  );

  if (!href) return card;

  return (
    <Link
      href={href}
      className="block h-full cursor-pointer rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
    >
      {card}
    </Link>
  );
}
