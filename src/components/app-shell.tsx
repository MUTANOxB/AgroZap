"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAgroApp, type UsageMode } from "@/context/AgroAppContext";
import type { NavigationItem } from "@/types/navigation";

const navigation: NavigationItem[] = [
  { href: "/dashboard", label: "Início" },
  { href: "/talhoes", label: "Área cultivada" },
  { href: "/registros", label: "Anotações" },
  { href: "/estoque", label: "Estoque" },
];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const { modoUso, setModoUso, isLoaded } = useAgroApp();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function selectMode(mode: UsageMode) {
    setModoUso(mode);
  }

  return (
    <div className="min-h-screen overflow-x-hidden md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="border-b border-emerald-900/10 bg-[linear-gradient(180deg,#0d4433_0%,#103d30_55%,#12372d_100%)] text-white md:min-h-screen md:border-b-0 md:border-r md:border-white/5">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 md:block md:p-6">
          <div>
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/7 p-1 shadow-[0_8px_22px_rgba(0,0,0,0.13)]">
                <Image
                  src="/brand/agrozap-symbol-192.png"
                  alt=""
                  width={44}
                  height={44}
                  priority
                  className="object-contain"
                  style={{ width: 44, height: 44 }}
                />
              </span>
              <span className="text-2xl font-extrabold tracking-[-0.045em]">
                Agro<span className="text-[#70cf13]">Zap</span>
              </span>
            </Link>
            <p className="mt-1 text-xs text-emerald-200/90 md:text-sm">
              O caderno inteligente do produtor
            </p>
          </div>
          <button
            type="button"
            aria-expanded={isMenuOpen}
            aria-controls="main-navigation"
            onClick={() => setIsMenuOpen((current) => !current)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sm font-semibold transition hover:border-white/25 hover:bg-white/10 md:hidden"
          >
            {isMenuOpen ? "Fechar" : "Menu"}
          </button>
        </div>

        <div
          id="main-navigation"
          className={`${isMenuOpen ? "block" : "hidden"} border-t border-white/10 px-4 pb-5 sm:px-6 md:block md:border-0 md:px-6 md:pb-6`}
        >
          <nav className="grid gap-1.5 pt-4 md:pt-0">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMenuOpen(false)}
              className={`relative rounded-xl px-3.5 py-3 text-sm font-medium text-emerald-50 transition hover:bg-white/8 ${
                pathname === item.href
                  ? "bg-white/12 text-white shadow-[inset_3px_0_0_#70cf13,0_6px_18px_rgba(0,0,0,0.08)]"
                  : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
          </nav>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-3.5">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-200">
              Modo de uso
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-black/20 p-1">
              {(["simples", "completo"] as UsageMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={!isLoaded}
                  onClick={() => selectMode(mode)}
                  className={`min-h-10 rounded-lg px-2 text-sm font-semibold capitalize transition ${
                    modoUso === mode
                      ? "bg-[#f7fbf5] text-emerald-950 shadow-[0_4px_12px_rgba(0,0,0,0.14)]"
                      : "text-emerald-100 hover:bg-white/10"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-emerald-200">
              {modoUso === "completo"
                ? "Para controlar com mais detalhes."
                : "Para registrar rápido, sem complicação."}
            </p>
          </div>
        </div>
      </aside>

      {/* O conteúdo usa espaçamentos progressivos: compacto no celular e mais
          amplo em telas md, lg e xl, sem criar versões separadas da interface. */}
      <main className="ag-app-background min-w-0 p-4 sm:p-5 md:p-7 lg:p-8 xl:p-10">
        {children}
      </main>
    </div>
  );
}
