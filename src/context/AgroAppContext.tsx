"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  readUsageMode,
  writeUsageMode,
  type UsageMode,
} from "@/context/agro-settings";

export type { UsageMode } from "@/context/agro-settings";

type AgroAppContextValue = {
  isLoaded: boolean;
  modoUso: UsageMode;
  setModoUso: (mode: UsageMode) => void;
  isModoCompleto: boolean;
};

type AgroAppProviderProps = {
  children: ReactNode;
};

const AgroAppContext = createContext<AgroAppContextValue | null>(null);

/*
 * Os dados rurais pertencem ao PostgreSQL e chegam às telas por Server
 * Components. Este contexto mantém somente uma preferência local de interface.
 * As chaves rurais legadas permanecem intactas para o fluxo explícito da 3C.
 */
export function AgroAppProvider({ children }: AgroAppProviderProps) {
  const [modoUso, setModoUso] = useState<UsageMode>("simples");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      setModoUso(readUsageMode(window.localStorage));
      setIsLoaded(true);
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    writeUsageMode(window.localStorage, modoUso);
  }, [isLoaded, modoUso]);

  const value = useMemo<AgroAppContextValue>(
    () => ({
      isLoaded,
      modoUso,
      setModoUso,
      isModoCompleto: modoUso === "completo",
    }),
    [isLoaded, modoUso],
  );

  return (
    <AgroAppContext.Provider value={value}>
      {children}
    </AgroAppContext.Provider>
  );
}

export function useAgroApp() {
  const context = useContext(AgroAppContext);

  if (!context) {
    throw new Error("useAgroApp deve ser usado dentro de AgroAppProvider.");
  }

  return context;
}
