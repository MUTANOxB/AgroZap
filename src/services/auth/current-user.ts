import "server-only";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { cache } from "react";

export type CurrentUser = {
  id: string;
  name: string;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) return null;

  return db.user.findFirst({
    where: {
      id: userId,
      deactivatedAt: null,
    },
    select: {
      id: true,
      name: true,
    },
  });
});

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  return user;
}
