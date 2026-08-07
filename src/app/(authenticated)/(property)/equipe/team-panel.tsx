"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PropertyRole } from "@/generated/prisma/enums";
import {
  authorizeMemberAddition,
  authorizeMemberRemoval,
  authorizeMemberRoleChange,
  getPropertyRoleLabel,
  hasCapability,
} from "@/services/autorizacao/property-role-policy";
import type { PropertyTeamMember } from "@/services/equipe/team.service";
import {
  addMemberAction,
  changeMemberRoleAction,
  removeMemberAction,
  type TeamActionState,
} from "./actions";

const initialState: TeamActionState = { status: "idle", message: null };
const roles = Object.values(PropertyRole);

function PendingButton({
  idleLabel,
  pendingLabel,
  className,
}: Readonly<{
  idleLabel: string;
  pendingLabel: string;
  className: string;
}>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

function ActionMessage({ state }: Readonly<{ state: TeamActionState }>) {
  if (!state.message) return null;
  return (
    <p
      className={`rounded-xl border px-3 py-2 text-sm font-medium ${
        state.status === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {state.message}
    </p>
  );
}

export function TeamPanel({
  actorUserId,
  actorRole,
  members,
}: Readonly<{
  actorUserId: string;
  actorRole: PropertyRole;
  members: PropertyTeamMember[];
}>) {
  const [addState, addAction] = useActionState(addMemberAction, initialState);
  const [changeState, changeAction] = useActionState(
    changeMemberRoleAction,
    initialState,
  );
  const [removeState, removeAction] = useActionState(
    removeMemberAction,
    initialState,
  );
  const canManageTeam = hasCapability(actorRole, "MANAGE_TEAM");
  const assignableRoles = roles.filter(
    (role) => authorizeMemberAddition(actorRole, role).allowed,
  );

  return (
    <div>
      {canManageTeam && assignableRoles.length > 0 && (
        <section className="ag-form-section mb-7">
          <div className="border-b border-emerald-950/7 bg-white/45 px-4 py-5 sm:px-6">
            <h2 className="text-lg font-bold text-slate-900">
              Adicionar usuário existente
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Nesta etapa, a pessoa já precisa possuir um usuário no AgroZap.
            </p>
          </div>
          <form action={addAction} className="grid gap-4 p-4 sm:p-6 md:grid-cols-[1fr_220px_auto] md:items-end">
            <label>
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
                className="w-full px-4 py-3 text-sm outline-none"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Papel
              </span>
              <select name="role" className="w-full px-4 py-3 text-sm outline-none">
                {assignableRoles.map((role) => (
                  <option key={role} value={role}>
                    {getPropertyRoleLabel(role)}
                  </option>
                ))}
              </select>
            </label>
            <PendingButton
              idleLabel="Adicionar"
              pendingLabel="Adicionando..."
              className="ag-button-primary min-h-12 px-5 text-sm font-bold disabled:cursor-wait disabled:opacity-70"
            />
          </form>
          <div aria-live="polite" className="px-4 pb-4 sm:px-6 sm:pb-6">
            <ActionMessage state={addState} />
          </div>
        </section>
      )}

      <div aria-live="polite" className="mb-4 grid gap-2">
        <ActionMessage state={changeState} />
        <ActionMessage state={removeState} />
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Pessoas vinculadas</h2>
            <p className="mt-1 text-sm text-slate-500">
              Remover alguém daqui não apaga o usuário nem o histórico.
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">
            {members.length} {members.length === 1 ? "membro" : "membros"}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {members.map((member) => {
            const isSelf = member.userId === actorUserId;
            const allowedRoleOptions = roles.filter((newRole) =>
              authorizeMemberRoleChange({
                actorUserId,
                actorRole,
                targetUserId: member.userId,
                targetRole: member.role,
                newRole,
              }).allowed,
            );
            const mayRemove = authorizeMemberRemoval({
              actorUserId,
              actorRole,
              targetUserId: member.userId,
              targetRole: member.role,
            }).allowed;

            return (
              <article key={member.membershipId} className="ag-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {member.name}
                    </h3>
                    {"phone" in member && (
                      <p className="mt-1 text-sm text-slate-500">{member.phone}</p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      member.isActive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {member.isActive ? "Ativo" : "Desativado"}
                  </span>
                </div>

                <p className="mt-4 text-sm">
                  <span className="text-slate-400">Papel:</span>{" "}
                  <strong className="font-semibold text-slate-700">
                    {getPropertyRoleLabel(member.role)}
                  </strong>
                </p>

                {isSelf ? (
                  <p className="mt-5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                    Sua participação não pode ser alterada por esta tela.
                  </p>
                ) : (
                  (allowedRoleOptions.length > 0 || mayRemove) && (
                    <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_auto]">
                      {allowedRoleOptions.length > 0 && (
                        <form action={changeAction} className="flex min-w-0 gap-2">
                          <input type="hidden" name="targetUserId" value={member.userId} />
                          <select name="newRole" aria-label={`Novo papel de ${member.name}`} className="min-w-0 flex-1 px-3 py-2 text-sm">
                            {allowedRoleOptions.map((role) => (
                              <option key={role} value={role}>
                                {getPropertyRoleLabel(role)}
                              </option>
                            ))}
                          </select>
                          <PendingButton
                            idleLabel="Alterar"
                            pendingLabel="Salvando..."
                            className="ag-button-secondary min-h-12 px-3 text-sm font-bold disabled:cursor-wait disabled:opacity-70"
                          />
                        </form>
                      )}
                      {mayRemove && (
                        <form action={removeAction}>
                          <input type="hidden" name="targetUserId" value={member.userId} />
                          <PendingButton
                            idleLabel="Remover"
                            pendingLabel="Removendo..."
                            className="min-h-12 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-70"
                          />
                        </form>
                      )}
                    </div>
                  )
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
