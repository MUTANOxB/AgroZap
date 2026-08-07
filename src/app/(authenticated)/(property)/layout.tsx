import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { AgroAppProvider } from "@/context/AgroAppContext";
import { PropertyAccessProvider } from "@/context/PropertyAccessContext";
import { requireActivePropertyContext } from "@/services/propriedades/active-property-context";

export default async function ActivePropertyLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const context = await requireActivePropertyContext();
  const access = {
    userId: context.user.id,
    userName: context.user.name,
    propertyId: context.property.id,
    propertyName: context.property.name,
    role: context.role,
    capabilities: context.capabilities,
  };

  return (
    <PropertyAccessProvider access={access}>
      <AgroAppProvider
        key={context.property.id}
        activePropertyId={context.property.id}
      >
        <AppShell>{children}</AppShell>
      </AgroAppProvider>
    </PropertyAccessProvider>
  );
}
