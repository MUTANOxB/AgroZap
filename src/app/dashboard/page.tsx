"use client";

import Link from "next/link";
import { DashboardIcon } from "@/components/dashboard/DashboardIcon";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { StockOverview } from "@/components/dashboard/StockOverview";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { SimpleDashboardDetails } from "@/components/dashboard/SimpleDashboardDetails";
import { UpcomingTasks } from "@/components/dashboard/UpcomingTasks";
import { WeatherCard } from "@/components/dashboard/WeatherCard";
import {
  recentActivities,
  stockItems,
  upcomingTasks,
  type SummaryMetric,
} from "@/data/dashboardMock";
import { useAgroApp } from "@/context/AgroAppContext";

// A página apenas organiza as seções. Cada bloco visual e seus dados ficam
// separados para facilitar manutenção, testes e estudo do projeto.
export default function DashboardPage() {
  const { areas, anotacoes, produtos, isModoCompleto } = useAgroApp();
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

  const quickActions = [
    { label: "Anotar serviço feito", detail: "Registre o que aconteceu", href: "/registros", icon: "activity" as const },
    { label: "Cadastrar área", detail: "Adicione um local da propriedade", href: "/talhoes", icon: "area" as const },
    { label: "Cadastrar produto", detail: "Inclua um item no estoque", href: "/estoque", icon: "package" as const },
    { label: "Ver estoque baixo", detail: `${lowStockCount} ${lowStockCount === 1 ? "produto precisa" : "produtos precisam"} de atenção`, href: "/estoque", icon: "alert" as const },
  ];

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-800">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Fazenda Santa Helena
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            {isModoCompleto
              ? "Resumo da propriedade"
              : "Controle sua propriedade de um jeito simples."}
          </h1>
          <p className="mt-1 text-slate-500">
            {isModoCompleto
              ? "Veja os principais números, serviços e pendências da propriedade."
              : "Anote, controle e acompanhe tudo no campo, sem complicação."}
          </p>
        </div>
        <div className="ag-card flex items-center gap-2 self-start px-4 py-2.5 text-sm font-medium text-slate-600 sm:self-auto">
          <DashboardIcon name="calendar" className="h-4 w-4 text-emerald-700" />
          Safra 2025/26
        </div>
      </header>

      {!isModoCompleto && (
        <>
          {/* No modo simples, ações grandes aparecem primeiro para reduzir a
              quantidade de decisões e levar o usuário direto ao registro. */}
          <section className="relative overflow-hidden rounded-[1.25rem] border border-emerald-800/50 bg-[linear-gradient(120deg,#06442b_0%,#075b35_70%,#327642_100%)] p-4 text-white shadow-[0_16px_38px_rgba(20,72,52,0.16)] sm:p-6">
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full border-[28px] border-[#68cc12]/10" />
            <h2 className="text-xl font-bold">O que você quer fazer agora?</h2>
            <p className="mt-1 text-sm text-emerald-200">
              Escolha uma ação para começar rapidamente.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex min-h-28 items-start gap-3 rounded-xl border border-white/70 bg-[#fbfcf9] p-4 text-slate-900 shadow-[0_7px_18px_rgba(8,35,25,0.1)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_11px_26px_rgba(8,35,25,0.14)] focus:outline-none focus:ring-4 focus:ring-emerald-300/30"
                >
                  <span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
                    <DashboardIcon name={action.icon} />
                  </span>
                  <span>
                    <strong className="block text-sm">{action.label}</strong>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {action.detail}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <h2 className="mb-3 mt-6 text-lg font-bold text-slate-900">
            Resumo rápido
          </h2>
        </>
      )}

      {/* Uma coluna no celular, duas no tablet e quatro em telas xl. Os
          breakpoints do Tailwind adaptam o mesmo conteúdo, sem outro layout. */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Os cards do Início funcionam como atalhos para as páginas correspondentes. */}
        {summaryMetrics.map((metric) => (
          <SummaryCard key={metric.label} metric={metric} href={metric.href} />
        ))}
      </section>

      {isModoCompleto ? (
        <>
          <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
            <RecentActivities activities={recentActivities} />
            <WeatherCard />
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-2">
            <StockOverview items={stockItems} />
            <UpcomingTasks tasks={upcomingTasks} />
          </section>
        </>
      ) : (
        <>
          {lowStockCount > 0 && (
            <Link
              href="/estoque"
              className="mt-5 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900 transition hover:bg-rose-100"
            >
              <span className="rounded-xl bg-rose-100 p-2.5 text-rose-700">
                <DashboardIcon name="alert" />
              </span>
              <span>
                <strong className="block text-sm">Atenção ao estoque</strong>
                <span className="text-sm text-rose-700">
                  {lowStockCount} {lowStockCount === 1 ? "produto está" : "produtos estão"} com estoque baixo.
                </span>
              </span>
            </Link>
          )}

          {/* O Modo Simples usa versões compactas para informar sem repetir o
              volume de detalhes e as listas longas do Modo Completo. */}
          <SimpleDashboardDetails
            annotations={anotacoes}
            tasks={upcomingTasks}
          />
        </>
      )}
    </div>
  );
}
