import Image from "next/image";
import { LogoutButton } from "@/components/logout-button";
import { requireCurrentUser } from "@/services/auth/current-user";
import { listActivePropertiesForUser } from "@/services/propriedades/active-property.service";
import { logoutAction } from "../actions";
import { PropertySelector } from "./property-selector";

export default async function PropertiesPage() {
  const currentUser = await requireCurrentUser();
  const properties = await listActivePropertiesForUser(currentUser.id);

  return (
    <main className="ag-app-background min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-950 p-1.5 shadow-sm">
              <Image
                src="/brand/agrozap-symbol-192.png"
                alt=""
                width={42}
                height={42}
                priority
                className="object-contain"
              />
            </span>
            <div>
              <strong className="block text-xl text-emerald-950">
                Agro<span className="text-[#58bd08]">Zap</span>
              </strong>
              <span className="text-sm text-slate-500">
                {currentUser.name}
              </span>
            </div>
          </div>

          <form action={logoutAction}>
            <LogoutButton className="ag-button-secondary min-h-11 px-4 text-sm font-bold disabled:cursor-wait disabled:opacity-70" />
          </form>
        </header>

        <section className="mb-7">
          <span className="text-sm font-bold text-emerald-700">
            Propriedade ativa
          </span>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
            Onde você quer trabalhar agora?
          </h1>
          <p className="mt-2 text-slate-500">
            Escolha uma propriedade para abrir o caderno certo.
          </p>
        </section>

        {properties.length > 0 ? (
          <PropertySelector properties={properties} />
        ) : (
          <section className="ag-card p-6 text-center sm:p-8">
            <h2 className="text-xl font-bold text-slate-900">
              Você ainda não está vinculado a uma propriedade ativa.
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Peça a um responsável para adicionar seu usuário à equipe de uma
              propriedade. Nenhuma propriedade será criada automaticamente.
            </p>
            <form action={logoutAction} className="mt-6">
              <LogoutButton className="ag-button-primary px-5 py-3 text-sm font-bold disabled:cursor-wait disabled:opacity-70" />
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
