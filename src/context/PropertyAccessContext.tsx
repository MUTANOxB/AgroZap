"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { PropertyRole } from "@/generated/prisma/enums";
import type { Capability } from "@/services/autorizacao/property-role-policy";

export type PropertyAccessData = Readonly<{
  userId: string;
  userName: string;
  propertyId: string;
  propertyName: string;
  role: PropertyRole;
  capabilities: readonly Capability[];
}>;

type PropertyAccessContextValue = PropertyAccessData & {
  can: (capability: Capability) => boolean;
};

type PropertyAccessProviderProps = {
  access: PropertyAccessData;
  children: ReactNode;
};

const PropertyAccessContext =
  createContext<PropertyAccessContextValue | null>(null);

/*
 * Este contexto apenas leva para a interface o acesso que o servidor já
 * resolveu. Ele serve para adaptar botões e formulários, nunca para autorizar
 * uma operação: Server Actions e services precisam revalidar tudo no servidor.
 */
export function PropertyAccessProvider({
  access,
  children,
}: PropertyAccessProviderProps) {
  const capabilitySet = useMemo(
    () => new Set<Capability>(access.capabilities),
    [access.capabilities],
  );
  const can = useCallback(
    (capability: Capability) => capabilitySet.has(capability),
    [capabilitySet],
  );
  const contextValue = useMemo<PropertyAccessContextValue>(
    () => ({ ...access, can }),
    [access, can],
  );

  return (
    <PropertyAccessContext.Provider value={contextValue}>
      {children}
    </PropertyAccessContext.Provider>
  );
}

export function usePropertyAccess() {
  const context = useContext(PropertyAccessContext);

  if (!context) {
    throw new Error(
      "usePropertyAccess deve ser usado dentro de PropertyAccessProvider.",
    );
  }

  return context;
}
