import type { ReactNode } from "react";
import { DashboardIcon, type DashboardIconName } from "./DashboardIcon";

type DashboardPanelProps = {
  title: string;
  subtitle?: string;
  icon: DashboardIconName;
  children: ReactNode;
};

// Estrutura visual compartilhada pelos painéis de atividades, estoque e tarefas.
// Centralizar este cabeçalho evita diferenças acidentais de espaçamento e estilo.
export function DashboardPanel({ title, subtitle, icon, children }: DashboardPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-slate-900">
            <DashboardIcon name={icon} className="h-5 w-5 text-emerald-700" />
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        <button className="text-sm font-semibold text-emerald-700 transition hover:text-emerald-900">
          Ver detalhes
        </button>
      </header>
      {children}
    </section>
  );
}
