"use client";

import { DashboardIcon } from "@/components/dashboard/DashboardIcon";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { StockOverview } from "@/components/dashboard/StockOverview";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { UpcomingTasks } from "@/components/dashboard/UpcomingTasks";
import { WeatherCard } from "@/components/dashboard/WeatherCard";
import {
  recentActivities,
  stockItems,
  upcomingTasks,
  weatherMock,
  type SummaryMetric,
} from "@/data/dashboardMock";
import { useAgroApp } from "@/context/AgroAppContext";

// A página apenas organiza as seções. Cada bloco visual e seus dados ficam
// separados para facilitar manutenção, testes e estudo do projeto.
export default function DashboardPage() {
  const { areas, anotacoes, produtos } = useAgroApp();
  const lowStockCount = produtos.filter(
    (product) =>
      product.minimumStock !== null &&
      product.quantity <= product.minimumStock,
  ).length;

  /*
   * Os números do Início agora vêm do mesmo contexto usado nas outras telas.
   * Qualquer novo cadastro ou movimentação de estoque atualiza estes cards.
   */
  const summaryMetrics: Array<SummaryMetric & { href: string }> = [
    { label: "Áreas cadastradas", value: String(areas.length), detail: "Locais acompanhados na propriedade", icon: "area", tone: "bg-emerald-100 text-emerald-700", href: "/talhoes" },
    { label: "Anotações", value: String(anotacoes.length), detail: "Registros salvos no histórico", icon: "activity", tone: "bg-sky-100 text-sky-700", href: "/registros" },
    { label: "Produtos no estoque", value: String(produtos.length), detail: "Produtos e materiais cadastrados", icon: "package", tone: "bg-amber-100 text-amber-700", href: "/estoque" },
    { label: "Estoque baixo", value: String(lowStockCount), detail: "Produtos que pedem atenção", icon: "alert", tone: "bg-rose-100 text-rose-700", href: "/estoque" },
  ];

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Fazenda Santa Helena
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Resumo da propriedade
          </h1>
          <p className="mt-1 text-slate-500">
            Veja os principais números, serviços e pendências da propriedade.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm sm:self-auto">
          <DashboardIcon name="calendar" className="h-4 w-4 text-emerald-700" />
          Safra 2025/26
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Os cards do Início funcionam como atalhos para as páginas correspondentes. */}
        {summaryMetrics.map((metric) => (
          <SummaryCard key={metric.label} metric={metric} href={metric.href} />
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
        <RecentActivities activities={recentActivities} />
        <WeatherCard weather={weatherMock} />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <StockOverview items={stockItems} />
        <UpcomingTasks tasks={upcomingTasks} />
      </section>
    </div>
  );
}
