"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { clearActivePropertyCookie } from "@/services/propriedades/active-property-cookie";

export type LoginActionState = {
  error: string | null;
};

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const phone = formData.get("phone");
  const password = formData.get("password");

  if (typeof phone !== "string" || typeof password !== "string") {
    return { error: "Telefone ou senha inválidos." };
  }

  await clearActivePropertyCookie();

  try {
    await signIn("credentials", {
      phone,
      password,
      redirectTo: "/propriedades",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Telefone ou senha inválidos." };
    }

    throw error;
  }

  return { error: null };
}
