"use client";

import Link from "next/link";
import { DashboardIcon } from "@/components/dashboard/DashboardIcon";
import type { DashboardIconName } from "@/components/dashboard/DashboardIcon";
import {
  RecentActivities,
  type RecentActivityItem,
} from "@/components/dashboard/RecentActivities";
import {
  StockOverview,
  type StockOverviewItem,
} from "@/components/dashboard/StockOverview";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { SimpleDashboardDetails } from "@/components/dashboard/SimpleDashboardDetails";
import { UpcomingTasks } from "@/components/dashboard/UpcomingTasks";
import { WeatherCard } from "@/components/dashboard/WeatherCard";
import { useAgroApp } from "@/context/AgroAppContext";
import { usePropertyAccess } from "@/context/PropertyAccessContext";
import { upcomingTasks } from "@/data/dashboardMock";
import type { Capability } from "@/services/autorizacao/property-role-policy";
import type { RuralDashboardSummaryDto } from "@/services/rural/rural-query.service";
import {
  formatRuralDecimalPtBr,
  getFarmRecordTypeLabel,
  isLowStock,
} from "@/services/rural/rural-ui";

type DashboardClientProps = {
  summary: RuralDashboardSummaryDto;
};

type QuickAction = {
  label: string;
  detail: string;
  href: string;
  icon: DashboardIconName;
  capability: Capability;
};

type SummaryMetric = {
  label: string;
  value: string;
  detail: string;
  icon: DashboardIconName;
  tone: string;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const ACTIVITY_COLORS = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-violet-500",
] as const;

function formatRecordDate(value: string) {
  return DATE_FORMATTER.format(new Date(value));
}

function recordMeta(
  record: RuralDashboardSummaryDto["recentFarmRecords"][number],
) {
  const context = [
    record.areaNameSnapshot ?? record.locationDescription,
    record.productNameSnapshot,
  ].filter((value): value is string => Boolean(value));

  return context.length > 0
    ? `${record.description} · ${context.join(" · ")}`
    : record.description;
}

function toRecentActivities(
  records: RuralDashboardSummaryDto["recentFarmRecords"],
): RecentActivityItem[] {
  return records.map((record, index) => ({
    id: record.id,
    title: getFarmRecordTypeLabel(record.type),
    meta: recordMeta(record),
    time: formatRecordDate(record.occurredAt),
    color: ACTIVITY_COLORS[index % ACTIVITY_COLORS.length],
  }));
}

function toStockOverviewItems(
  products: RuralDashboardSummaryDto["stockOverviewProducts"],
): StockOverviewItem[] {
  return products.map((product) => {
    const lowStock = isLowStock(product);

    return {
      id: product.id,
      name: product.name,
      amount: `${formatRuralDecimalPtBr(product.quantity)} ${product.unit}`,
      isLowStock: lowStock,
    };
  });
}

export function DashboardClient({ summary }: DashboardClientProps) {
  const { isModoCompleto } = useAgroApp();
  const { can, propertyName, userName } = usePropertyAccess();
  const recentActivities = toRecentActivities(summary.recentFarmRecords);
  const stockItems = toStockOverviewItems(summary.stockOverviewProducts);
  const lowStockCount = summary.counts.lowStockProducts;

  const summaryMetrics: Array<SummaryMetric & { href: string }> = [
    {
      label: "Áreas cadastradas",
      value: String(summary.counts.activeAreas),
      detail: "Locais acompanhados na propriedade",
      icon: "area",
      tone: "bg-emerald-100 text-emerald-700",
      href: "/talhoes",
    },
    {
      label: "Anotações",
      value: String(summary.counts.farmRecords),
      detail: "Registros salvos no histórico",
      icon: "activity",
      tone: "bg-sky-100 text-sky-700",
      href: "/registros",
    },
    {
      label: "Produtos no estoque",
      value: String(summary.counts.activeProducts),
      detail: "Produtos e materiais cadastrados",
      icon: "package",
      tone: "bg-amber-100 text-amber-700",
      href: "/estoque",
    },
    {
      label: "Estoque baixo",
      value: String(lowStockCount),
      detail: "Produtos que pedem atenção",
      icon: "alert",
      tone: "bg-rose-100 text-rose-700",
      href: "/estoque",
    },
  ];

  const quickActions = ([
    {
      label: "Anotar serviço feito",
      detail: "Registre o que aconteceu",
      href: "/registros",
      icon: "activity",
      capability: "CREATE_RECORD",
    },
    {
      label: "Cadastrar área",
      detail: "Adicione um local da propriedade",
      href: "/talhoes",
      icon: "area",
      capability: "CREATE_AREA",
    },
    {
      label: "Cadastrar produto",
      detail: "Inclua um item no estoque",
      href: "/estoque",
      icon: "package",
      capability: "CREATE_PRODUCT",
    },
    {
      label: "Ver estoque baixo",
      detail: `${lowStockCount} ${
        lowStockCount === 1 ? "produto precisa" : "produtos precisam"
      } de atenção`,
      href: "/estoque",
      icon: "alert",
      capability: "READ_PROPERTY",
    },
  ] satisfies QuickAction[]).filter((action) => can(action.capability));
  const firstName = userName.trim().split(/\s+/)[0] || userName;

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-7">
        <div
          className="mb-2 flex max-w-full items-center gap-2 text-sm font-bold text-emerald-800"
          title={propertyName}
        >
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span className="truncate">{propertyName}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Olá, {firstName}
        </h1>
        <p className="mt-1 text-slate-500">
          {isModoCompleto
            ? "Veja os principais números, serviços e pendências da propriedade."
            : "Controle sua propriedade de um jeito simples, sem complicação."}
        </p>
      </header>

      {!isModoCompleto && (
        <>
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                  {lowStockCount}{" "}
                  {lowStockCount === 1 ? "produto está" : "produtos estão"} com
                  estoque baixo.
                </span>
              </span>
            </Link>
          )}

          <SimpleDashboardDetails
            activities={recentActivities}
            tasks={upcomingTasks}
          />
        </>
      )}
    </div>
  );
}
