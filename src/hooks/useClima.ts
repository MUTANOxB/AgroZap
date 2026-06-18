"use client";

import { useEffect, useState } from "react";
import type { ClimaResponse } from "@/types/clima";

/*
 * O hook concentra a busca do clima real. Os cards só precisam decidir como
 * apresentar carregamento, erro ou os dados recebidos da rota interna.
 */
export function useClima() {
  const [clima, setClima] = useState<ClimaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function carregarClima() {
      try {
        const response = await fetch("/api/clima", {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok || !data.sucesso) {
          throw new Error(data.erro ?? "Não foi possível consultar o clima.");
        }

        setClima(data as ClimaResponse);
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === "AbortError") {
          return;
        }

        setError("Não foi possível carregar o clima agora.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    carregarClima();

    return () => controller.abort();
  }, []);

  return { clima, isLoading, error };
}
