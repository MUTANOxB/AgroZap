import type { ReactNode } from "react";

type IconName =
  | "area" | "field" | "activity" | "alert" | "rain"
  | "droplet" | "wind" | "sun" | "package" | "calendar";

const metrics: Array<{
  label: string; value: string; detail: string; icon: IconName; tone: string;
}> = [
  { label: "Área em produção", value: "286 ha", detail: "72% da área da propriedade", icon: "area", tone: "bg-emerald-100 text-emerald-700" },
  { label: "Locais cadastrados", value: "12", detail: "8 lavouras · 4 pastos", icon: "field", tone: "bg-amber-100 text-amber-700" },
  { label: "Anotações no mês", value: "38", detail: "+12% comparado a maio", icon: "activity", tone: "bg-sky-100 text-sky-700" },
  { label: "Pendências", value: "3", detail: "2 no estoque · 1 vencimento", icon: "alert", tone: "bg-rose-100 text-rose-700" },
];

const activities = [
  { title: "Pulverização feita", meta: "Lavoura Norte · Soja", time: "Hoje, 07:30", color: "bg-emerald-500" },
  { title: "Entrada de ureia no estoque", meta: "Estoque principal · 1.200 kg", time: "Ontem, 16:45", color: "bg-sky-500" },
  { title: "Vistoria de pragas", meta: "Roça do fundo · Milho", time: "16 jun, 10:20", color: "bg-amber-500" },
  { title: "Revisão do trator", meta: "John Deere 6110J", time: "15 jun, 14:00", color: "bg-violet-500" },
];

const stock = [
  { name: "Semente de soja", amount: "3.450 kg", level: 78, color: "bg-emerald-500" },
  { name: "Adubo NPK", amount: "1.280 kg", level: 42, color: "bg-sky-500" },
  { name: "Produto para controle de mato", amount: "86 L", level: 24, color: "bg-amber-500" },
  { name: "Óleo diesel", amount: "620 L", level: 18, color: "bg-rose-500" },
];

const dueDates = [
  { day: "21", month: "JUN", title: "Revisão do pulverizador", detail: "Vence em 3 dias", urgent: true },
  { day: "25", month: "JUN", title: "Pagamento fornecedor", detail: "Cooperativa Vale Verde", urgent: false },
  { day: "02", month: "JUL", title: "Coleta de terra para análise", detail: "Lavoura do milho, Horta principal e Pomar", urgent: false },
];

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    area: <><path d="M3 20h18"/><path d="m5 20 4-8 3 5 3-10 4 13"/></>,
    field: <><path d="M4 20c3-4 5-9 5-16"/><path d="M20 20c-3-4-5-9-5-16"/><path d="M4 13c3 0 5 1 7 4"/><path d="M20 13c-3 0-5 1-7 4"/></>,
    activity: <path d="M3 12h4l2-7 4 14 2-7h6"/>,
    alert: <><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.5 2.6 18a2 2 0 0 0 1.8 3h15.2a2 2 0 0 0 1.8-3L13.7 3.5a2 2 0 0 0-3.4 0Z"/></>,
    rain: <><path d="M16 13a4 4 0 0 0-7.8-1A3 3 0 1 0 6 17h10a2 2 0 0 0 0-4Z"/><path d="m8 20-1 2M12 20l-1 2M16 20l-1 2"/></>,
    droplet: <path d="M12 22a7 7 0 0 0 7-7c0-5-7-13-7-13S5 10 5 15a7 7 0 0 0 7 7Z"/>,
    wind: <><path d="M3 8h10a2 2 0 1 0-2-2"/><path d="M3 12h15a2 2 0 1 1-2 2"/><path d="M3 16h8"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></>,
    package: <><path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z"/><path d="M3 7.5V17l9 4.5 9-4.5V7.5M12 12v9.5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Panel({ title, subtitle, icon, children }: {
  title: string; subtitle?: string; icon: IconName; children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-slate-900">
            <Icon name={icon} className="h-5 w-5 text-emerald-700" />{title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        <button className="text-sm font-semibold text-emerald-700 transition hover:text-emerald-900">Ver detalhes</button>
      </header>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />Fazenda Santa Helena
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Resumo da propriedade</h1>
          <p className="mt-1 text-slate-500">Veja os principais números, serviços e pendências da propriedade.</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm sm:self-auto">
          <Icon name="calendar" className="h-4 w-4 text-emerald-700" />Safra 2025/26
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500">{metric.label}</p>
              <span className={`rounded-xl p-2.5 ${metric.tone}`}><Icon name={metric.icon} /></span>
            </div>
            <strong className="mt-4 block text-3xl font-bold tracking-tight text-slate-950">{metric.value}</strong>
            <p className="mt-1 text-xs font-medium text-slate-400">{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
        <Panel title="O que foi feito" subtitle="Anotações mais recentes da propriedade" icon="activity">
          <div className="divide-y divide-slate-100">
            {activities.map((activity) => (
              <div key={activity.title} className="flex items-center gap-4 px-5 py-4">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-slate-50 ${activity.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{activity.title}</p>
                  <p className="truncate text-xs text-slate-400">{activity.meta}</p>
                </div>
                <time className="shrink-0 text-right text-xs font-medium text-slate-400">{activity.time}</time>
              </div>
            ))}
          </div>
        </Panel>

        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-700 p-6 text-white shadow-[0_14px_40px_rgba(6,78,59,0.22)]">
          <div className="absolute -right-14 -top-16 h-52 w-52 rounded-full bg-white/10" />
          <div className="absolute -bottom-20 right-24 h-44 w-44 rounded-full bg-emerald-300/10" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div><p className="text-sm font-medium text-emerald-100">Clima na fazenda</p><p className="mt-1 text-xs text-emerald-200">Rio Verde, GO</p></div>
              <Icon name="sun" className="h-10 w-10 text-amber-300" />
            </div>
            <div className="mt-5 flex items-end gap-3">
              <strong className="text-6xl font-light tracking-tighter">27°</strong>
              <div className="pb-1"><p className="font-semibold">Parcialmente nublado</p><p className="text-xs text-emerald-200">Sensação de 29°C</p></div>
            </div>
            <div className="mt-6 grid grid-cols-3 divide-x divide-white/15 rounded-xl bg-white/10 py-3 backdrop-blur-sm">
              {[
                { icon: "droplet" as IconName, label: "Umidade", value: "68%" },
                { icon: "wind" as IconName, label: "Vento", value: "14 km/h" },
                { icon: "rain" as IconName, label: "Chuva", value: "35%" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-1 text-xs">
                  <Icon name={item.icon} className="h-4 w-4 text-sky-200" />
                  <span className="text-emerald-100">{item.label}</span><strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-lg bg-amber-300/15 px-3 py-2 text-xs font-medium text-amber-100">Previsão de chuva leve amanhã à tarde.</p>
          </div>
        </section>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Como está o estoque" subtitle="Quantidade dos principais produtos e materiais" icon="package">
          <div className="space-y-5 p-5">
            {stock.map((item) => (
              <div key={item.name}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{item.name}</span><span className="font-semibold text-slate-900">{item.amount}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.level}%` }} />
                </div>
                {item.level < 25 && <p className="mt-1.5 text-xs font-semibold text-rose-600">Estoque abaixo do mínimo</p>}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Próximos vencimentos" subtitle="Compromissos que pedem atenção" icon="calendar">
          <div className="divide-y divide-slate-100">
            {dueDates.map((item) => (
              <div key={`${item.day}-${item.title}`} className="flex items-center gap-4 px-5 py-4">
                <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${item.urgent ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                  <strong className="text-xl leading-none">{item.day}</strong><span className="mt-1 text-[10px] font-bold tracking-wider">{item.month}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className={`mt-1 text-xs ${item.urgent ? "font-semibold text-rose-600" : "text-slate-400"}`}>{item.detail}</p>
                </div>
                <span className="text-lg text-slate-300">›</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
