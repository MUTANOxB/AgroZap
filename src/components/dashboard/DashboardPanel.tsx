import Link from "next/link";
import type { ReactNode } from "react";
import { DashboardIcon, type DashboardIconName } from "./DashboardIcon";

type DashboardPanelProps = {
  title: string;
  subtitle?: string;
  icon: DashboardIconName;
  children: ReactNode;
  href?: string;
};

// Estrutura visual compartilhada pelos painéis de atividades, estoque e tarefas.
// Centralizar este cabeçalho evita diferenças acidentais de espaçamento e estilo.
export function DashboardPanel({ title, subtitle, icon, children, href }: DashboardPanelProps) {
  return (
    <section className="ag-card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-950/7 bg-white/45 px-4 py-4 sm:px-5">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-slate-900">
            <span className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700">
              <DashboardIcon name={icon} className="h-4 w-4" />
            </span>
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        {href ? (
          <Link
            href={href}
            className="text-sm font-semibold text-emerald-700 transition hover:text-emerald-900"
          >
            Ver detalhes
          </Link>
        ) : (
          <button className="text-sm font-semibold text-emerald-700 transition hover:text-emerald-900">
            Ver detalhes
          </button>
        )}
      </header>
      {children}
    </section>
  );
}
