import Link from "next/link";
import type { ReactNode } from "react";
import type { NavigationItem } from "@/types/navigation";

const navigation: NavigationItem[] = [
  { href: "/dashboard", label: "Início" },
  { href: "/talhoes", label: "Área cultivada" },
  { href: "/registros", label: "Anotações" },
  { href: "/estoque", label: "Estoque" },
];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-emerald-900/10 bg-emerald-950 p-6 text-white md:border-b-0 md:border-r">
        <Link href="/dashboard" className="text-2xl font-bold tracking-tight">
          AgroZap
        </Link>
        <p className="mt-1 text-sm text-emerald-200">Gestão rural</p>

        <nav className="mt-8 flex flex-wrap gap-2 md:flex-col">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-emerald-50 transition hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 bg-slate-50 p-5 md:p-8 xl:p-10">{children}</main>
    </div>
  );
}
