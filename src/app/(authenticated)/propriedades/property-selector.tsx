"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { PropertyRole } from "@/generated/prisma/enums";
import { getPropertyRoleLabel } from "@/services/autorizacao/property-role-policy";
import {
  selectPropertyAction,
  type SelectPropertyActionState,
} from "./actions";

type PropertyOption = {
  membershipId: string;
  property: {
    id: string;
    name: string;
  };
  role: PropertyRole;
};

const initialState: SelectPropertyActionState = { error: null };

function AccessButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="ag-button-primary w-full px-4 py-3 text-sm font-bold disabled:cursor-wait disabled:opacity-70 sm:w-auto"
    >
      {pending ? "Acessando..." : "Acessar"}
    </button>
  );
}

export function PropertySelector({
  properties,
}: Readonly<{ properties: PropertyOption[] }>) {
  const [state, formAction] = useActionState(
    selectPropertyAction,
    initialState,
  );

  return (
    <div>
      <div aria-live="polite" className="mb-4 min-h-6">
        {state.error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {state.error}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {properties.map((option) => (
          <article key={option.membershipId} className="ag-card p-5 sm:p-6">
            <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              {getPropertyRoleLabel(option.role)}
            </span>
            <h2 className="mt-4 text-xl font-bold text-slate-900">
              {option.property.name}
            </h2>
            <form action={formAction} className="mt-6 flex justify-end">
              <input
                type="hidden"
                name="propertyId"
                value={option.property.id}
              />
              <AccessButton />
            </form>
          </article>
        ))}
      </div>
    </div>
  );
}
