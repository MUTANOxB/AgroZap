import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getCurrentUser } from "@/services/auth/current-user";

export default async function LoginPage() {
  const currentUser = await getCurrentUser();

  if (currentUser) redirect("/propriedades");

  return (
    <main className="ag-app-background flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <section className="ag-card w-full max-w-md p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-[1.4rem] border border-emerald-900/10 bg-emerald-950 p-2 shadow-[0_12px_30px_rgba(7,91,53,0.2)]">
            <Image
              src="/brand/agrozap-symbol-192.png"
              alt="Símbolo do AgroZap"
              width={68}
              height={68}
              priority
              className="object-contain"
            />
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.05em] text-emerald-950">
            Agro<span className="text-[#58bd08]">Zap</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            O caderno inteligente do produtor
          </p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
