import type { ReactNode } from "react";
import { requireCurrentUser } from "@/services/auth/current-user";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireCurrentUser();
  return children;
}
