"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginActionState } from "./actions";

const initialState: LoginActionState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="ag-button-primary mt-1 w-full px-5 py-3 text-sm font-bold disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-7 grid gap-5">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Telefone
        </span>
        <input
          required
          autoComplete="tel"
          inputMode="tel"
          name="phone"
          type="tel"
          placeholder="(11) 99999-9999"
          className="w-full px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Senha
        </span>
        <input
          required
          autoComplete="current-password"
          name="password"
          type="password"
          className="w-full px-4 py-3 text-base text-slate-900 outline-none"
        />
      </label>

      <div aria-live="polite" className="min-h-6">
        {state.error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {state.error}
          </p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
