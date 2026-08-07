import { TeamPanel } from "./team-panel";
import { listPropertyTeam } from "@/services/equipe/team.service";
import { requireActivePropertyContext } from "@/services/propriedades/active-property-context";

export default async function TeamPage() {
  const context = await requireActivePropertyContext();
  const members = await listPropertyTeam({
    propertyId: context.property.id,
    actorUserId: context.user.id,
  });

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <header className="mb-7">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Acesso à propriedade
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Equipe
        </h1>
        <p className="mt-1 max-w-3xl text-slate-500">
          Veja quem participa de {context.property.name} e quais papéis cada
          pessoa possui.
        </p>
      </header>

      <TeamPanel
        actorUserId={context.user.id}
        actorRole={context.role}
        members={members}
      />
    </div>
  );
}
