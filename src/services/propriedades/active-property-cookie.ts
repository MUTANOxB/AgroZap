import "server-only";

import { cookies } from "next/headers";

export const ACTIVE_PROPERTY_COOKIE_NAME = "agrozap_active_property";

const activePropertyCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function readActivePropertyCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_PROPERTY_COOKIE_NAME)?.value ?? null;
}

export async function setActivePropertyCookie(propertyId: string) {
  const cookieStore = await cookies();
  cookieStore.set(
    ACTIVE_PROPERTY_COOKIE_NAME,
    propertyId,
    activePropertyCookieOptions,
  );
}

export async function clearActivePropertyCookie() {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROPERTY_COOKIE_NAME, "", {
    ...activePropertyCookieOptions,
    maxAge: 0,
  });
}
