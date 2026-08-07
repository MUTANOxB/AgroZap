import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { requireCurrentUser } from "@/services/auth/current-user";
import { readActivePropertyCookie } from "./active-property-cookie";
import {
  resolveActivePropertyContext,
  type ActivePropertyContext,
} from "./active-property.service";

export const requireActivePropertyContext = cache(async (): Promise<ActivePropertyContext> => {
  const currentUser = await requireCurrentUser();
  const propertyId = await readActivePropertyCookie();

  if (!propertyId) redirect("/propriedades");

  const context = await resolveActivePropertyContext(
    currentUser.id,
    propertyId,
  );

  if (!context) redirect("/propriedades");

  return context;
});
