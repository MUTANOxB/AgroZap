"use server";

import { signOut } from "@/auth";
import { clearActivePropertyCookie } from "@/services/propriedades/active-property-cookie";

export async function logoutAction() {
  await clearActivePropertyCookie();
  await signOut({ redirectTo: "/login" });
}
