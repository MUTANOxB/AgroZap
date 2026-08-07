"use server";

import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/services/auth/current-user";
import { setActivePropertyCookie } from "@/services/propriedades/active-property-cookie";
import { resolveActivePropertyContext } from "@/services/propriedades/active-property.service";

export type SelectPropertyActionState = {
  error: string | null;
};

export async function selectPropertyAction(
  _previousState: SelectPropertyActionState,
  formData: FormData,
): Promise<SelectPropertyActionState> {
  const propertyId = formData.get("propertyId");

  if (
    typeof propertyId !== "string" ||
    !propertyId.trim() ||
    propertyId.length > 128
  ) {
    return { error: "Não foi possível acessar esta propriedade." };
  }

  const currentUser = await requireCurrentUser();
  const context = await resolveActivePropertyContext(
    currentUser.id,
    propertyId,
  );

  if (!context) {
    return { error: "Não foi possível acessar esta propriedade." };
  }

  await setActivePropertyCookie(context.property.id);
  redirect("/dashboard");
}
