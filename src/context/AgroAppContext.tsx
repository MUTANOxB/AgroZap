"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { StockDomainError } from "@/services/estoque/errors";
import { calculateLocalStockBalance } from "@/services/estoque/local-stock";
import type { StockProduct } from "@/types/estoque";
import type { Annotation } from "@/types/registro";
import type { Area } from "@/types/talhao";

// Reexportações temporárias preservam os imports existentes enquanto os tipos
// passam a ter uma única definição dentro de src/types.
export type { ProductCategory, ProductUnit, StockProduct } from "@/types/estoque";
export type { Annotation, AnnotationType } from "@/types/registro";
export type { Area, ProductionType } from "@/types/talhao";

export type UsageMode = "simples" | "completo";

type AgroAppContextValue = {
  areas: Area[];
  anotacoes: Annotation[];
  produtos: StockProduct[];
  isLoaded: boolean;
  modoUso: UsageMode;
  setModoUso: (mode: UsageMode) => void;
  isModoCompleto: boolean;
  adicionarArea: (area: Omit<Area, "id">) => void;
  adicionarAnotacao: (anotacao: Omit<Annotation, "id">) => void;
  adicionarAnotacaoComMovimentacao: (
    anotacao: Omit<Annotation, "id">,
    movement: { productId: number; change: number },
  ) => void;
  adicionarProduto: (produto: Omit<StockProduct, "id">) => void;
  atualizarQuantidadeProduto: (productId: number, change: number) => void;
};

const STORAGE_KEY = "agrozap-mvp-data";
const SETTINGS_STORAGE_KEY = "agrozap-settings";

const initialAreas: Area[] = [
  { id: 1, name: "Lavoura do milho", type: "Lavoura", size: "8 hectares", note: "Roça do fundo, próxima ao galpão." },
  { id: 2, name: "Pasto 2", type: "Pasto", size: "3 alqueires", note: "Área com bebedouro e sombra." },
  { id: 3, name: "Horta principal", type: "Horta", size: "450 m²", note: "Local com irrigação." },
];

const initialAnnotations: Annotation[] = [
  {
    id: 1,
    type: "Pulverização",
    location: "Lavoura do milho",
    date: "2026-06-18",
    description: "Aplicação de produto para controle de pragas.",
    quantity: "20 litros",
    value: "",
    responsible: "João",
    productId: null,
    productName: "",
    stockQuantity: null,
  },
  {
    id: 2,
    type: "Entrada no estoque",
    location: "Estoque principal",
    date: "2026-06-17",
    description: "Entrada de adubo entregue pelo fornecedor.",
    quantity: "1.200 kg",
    value: "R$ 3.850,00",
    responsible: "Pedro",
    productId: null,
    productName: "Adubo NPK",
    stockQuantity: null,
  },
  {
    id: 3,
    type: "Manutenção",
    location: "Galpão de máquinas",
    date: "2026-06-15",
    description: "Revisão do trator antes do próximo serviço.",
    quantity: "",
    value: "R$ 450,00",
    responsible: "Equipe da fazenda",
    productId: null,
    productName: "",
    stockQuantity: null,
  },
];

const initialProducts: StockProduct[] = [
  { id: 1, name: "Semente de soja", category: "Semente", quantity: 3450, unit: "kg", minimumStock: 500, storageLocation: "Barracão principal", note: "Safra 2025/26" },
  { id: 2, name: "Adubo NPK", category: "Adubo", quantity: 1280, unit: "kg", minimumStock: 300, storageLocation: "Depósito de insumos", note: "Uso geral na propriedade" },
  { id: 3, name: "Produto para controle de mato", category: "Defensivo", quantity: 86, unit: "litros", minimumStock: 100, storageLocation: "Depósito de defensivos", note: "Estoque abaixo do mínimo" },
  { id: 4, name: "Óleo diesel", category: "Combustível", quantity: 620, unit: "litros", minimumStock: 700, storageLocation: "Tanque da propriedade", note: "Usado em máquinas e tratores" },
];

const AgroAppContext = createContext<AgroAppContextValue | null>(null);

/*
 * O AgroAppContext mantém as informações principais em um único lugar.
 * Assim, uma área ou produto cadastrado em uma tela fica disponível nas outras
 * sem que o produtor precise digitar novamente.
 */
export function AgroAppProvider({ children }: { children: ReactNode }) {
  const [areas, setAreas] = useState<Area[]>(initialAreas);
  const [anotacoes, setAnotacoes] = useState<Annotation[]>(initialAnnotations);
  const [produtos, setProdutos] = useState<StockProduct[]>(initialProducts);
  const [isLoaded, setIsLoaded] = useState(false);
  const [modoUso, setModoUso] = useState<UsageMode>("simples");

  /*
   * O localStorage só existe no navegador. Por isso, os dados são carregados
   * dentro do useEffect, depois da primeira renderização, evitando erros de
   * hidratação no Next.js.
  */
  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      try {
        const savedData = localStorage.getItem(STORAGE_KEY);

        if (savedData) {
          const parsedData = JSON.parse(savedData) as {
            areas?: Area[];
            anotacoes?: Annotation[];
            produtos?: StockProduct[];
          };

          if (Array.isArray(parsedData.areas)) setAreas(parsedData.areas);
          if (Array.isArray(parsedData.anotacoes)) setAnotacoes(parsedData.anotacoes);
          if (Array.isArray(parsedData.produtos)) setProdutos(parsedData.produtos);
        }

        const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);

        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings) as {
            modoUso?: UsageMode;
          };

          if (
            parsedSettings.modoUso === "simples" ||
            parsedSettings.modoUso === "completo"
          ) {
            setModoUso(parsedSettings.modoUso);
          }
        }
      } catch {
        // Se os dados salvos estiverem inválidos, o aplicativo usa os exemplos iniciais.
      } finally {
        setIsLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, []);

  /*
   * Depois do carregamento inicial, toda alteração é salva no navegador.
   * Isso mantém os dados mesmo ao atualizar a página, ainda sem usar banco.
   */
  useEffect(() => {
    if (!isLoaded) return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ areas, anotacoes, produtos }),
    );
  }, [areas, anotacoes, produtos, isLoaded]);

  /*
   * O modo de uso também fica salvo no localStorage. Ele começa como simples
   * no servidor e só lê a preferência depois que o navegador monta a página,
   * evitando diferenças de HTML e erros de hydration no Next.js.
   */
  useEffect(() => {
    if (!isLoaded) return;

    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ modoUso }),
    );
  }, [isLoaded, modoUso]);

  function adicionarArea(area: Omit<Area, "id">) {
    setAreas((currentAreas) => [...currentAreas, { ...area, id: Date.now() }]);
  }

  function adicionarAnotacao(anotacao: Omit<Annotation, "id">) {
    setAnotacoes((currentAnnotations) => [
      { ...anotacao, id: Date.now() },
      ...currentAnnotations,
    ]);
  }

  /*
   * Valida e prepara as duas listas antes de publicar qualquer alteração.
   * O React agrupa os setters do mesmo evento e o localStorage recebe o estado
   * combinado depois da renderização, como uma única ação para o usuário.
   */
  function adicionarAnotacaoComMovimentacao(
    anotacao: Omit<Annotation, "id">,
    movement: { productId: number; change: number },
  ) {
    const product = produtos.find(
      (currentProduct) => currentProduct.id === movement.productId,
    );

    if (!product) {
      throw new StockDomainError(
        "PRODUCT_NOT_FOUND",
        "Selecione um produto válido para movimentar o estoque.",
      );
    }

    const nextBalance = calculateLocalStockBalance(
      product.quantity,
      movement.change,
    );
    const annotationWithId = { ...anotacao, id: Date.now() };
    const nextProducts = produtos.map((currentProduct) =>
      currentProduct.id === product.id
        ? { ...currentProduct, quantity: nextBalance }
        : currentProduct,
    );

    setProdutos(nextProducts);
    setAnotacoes((currentAnnotations) => [
      annotationWithId,
      ...currentAnnotations,
    ]);
  }

  function adicionarProduto(produto: Omit<StockProduct, "id">) {
    setProdutos((currentProducts) => [
      { ...produto, id: Date.now() },
      ...currentProducts,
    ]);
  }

  /*
   * Esta é a ponte temporária do localStorage. A regra definitiva vive no
   * serviço Prisma, mas o MVP também precisa rejeitar uma saída sem saldo.
   */
  function atualizarQuantidadeProduto(productId: number, change: number) {
    const product = produtos.find((currentProduct) => currentProduct.id === productId);

    if (!product) {
      throw new StockDomainError("PRODUCT_NOT_FOUND", "Produto não encontrado.");
    }

    const nextBalance = calculateLocalStockBalance(product.quantity, change);

    setProdutos((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? { ...product, quantity: nextBalance }
          : product,
      ),
    );
  }

  return (
    <AgroAppContext.Provider
      value={{
        areas,
        anotacoes,
        produtos,
        isLoaded,
        modoUso,
        setModoUso,
        isModoCompleto: modoUso === "completo",
        adicionarArea,
        adicionarAnotacao,
        adicionarAnotacaoComMovimentacao,
        adicionarProduto,
        atualizarQuantidadeProduto,
      }}
    >
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
