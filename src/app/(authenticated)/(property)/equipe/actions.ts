"use server";

import { revalidatePath } from "next/cache";
import {
  addExistingMember,
  changeMemberRole,
  removeMember,
} from "@/services/equipe/team.service";
import { TeamDomainError } from "@/services/equipe/errors";
import { requireActivePropertyContext } from "@/services/propriedades/active-property-context";

export type TeamActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

function valueFromForm(
  formData: FormData,
  field: string,
  maximumLength: number,
) {
  const value = formData.get(field);
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > maximumLength
  ) {
    return null;
  }
  return value.trim();
}

function teamErrorState(error: unknown): TeamActionState {
  if (error instanceof TeamDomainError) {
    return { status: "error", message: error.message };
  }
  throw error;
}

export async function addMemberAction(
  _previousState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const phone = valueFromForm(formData, "phone", 64);
  const role = valueFromForm(formData, "role", 32);
  if (!phone || !role) {
    return { status: "error", message: "Informe telefone e papel." };
  }

  const context = await requireActivePropertyContext();

  try {
    await addExistingMember({
      propertyId: context.property.id,
      actorUserId: context.user.id,
      phone,
      role,
    });
    revalidatePath("/equipe");
    return { status: "success", message: "Membro adicionado à equipe." };
  } catch (error) {
    return teamErrorState(error);
  }
}

export async function changeMemberRoleAction(
  _previousState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const targetUserId = valueFromForm(formData, "targetUserId", 128);
  const newRole = valueFromForm(formData, "newRole", 32);
  if (!targetUserId || !newRole) {
    return { status: "error", message: "Informe o membro e o novo papel." };
  }

  const context = await requireActivePropertyContext();

  try {
    await changeMemberRole({
      propertyId: context.property.id,
      actorUserId: context.user.id,
      targetUserId,
      newRole,
    });
    revalidatePath("/equipe");
    return { status: "success", message: "Papel atualizado." };
  } catch (error) {
    return teamErrorState(error);
  }
}

export async function removeMemberAction(
  _previousState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const targetUserId = valueFromForm(formData, "targetUserId", 128);
  if (!targetUserId) {
    return { status: "error", message: "Informe o membro da equipe." };
  }

  const context = await requireActivePropertyContext();

  try {
    await removeMember({
      propertyId: context.property.id,
      actorUserId: context.user.id,
      targetUserId,
    });
    revalidatePath("/equipe");
    return { status: "success", message: "Membro removido da equipe." };
  } catch (error) {
    return teamErrorState(error);
  }
}
