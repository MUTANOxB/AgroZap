"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ProductionType =
  | "Lavoura"
  | "Pasto"
  | "Horta"
  | "Pomar"
  | "Estufa"
  | "Outro";

export type Area = {
  id: number;
  name: string;
  type: ProductionType;
  size: string;
  note: string;
};

export type AnnotationType =
  | "Pulverização"
  | "Plantio"
  | "Colheita"
  | "Compra"
  | "Entrada no estoque"
  | "Manutenção"
  | "Vistoria"
  | "Pagamento"
  | "Observação";

export type Annotation = {
  id: number;
  type: AnnotationType;
  location: string;
  date: string;
  description: string;
  quantity: string;
  value: string;
  responsible: string;
  productId: number | null;
  productName: string;
  stockQuantity: number | null;
};

export type ProductCategory =
  | "Semente"
  | "Adubo"
  | "Defensivo"
  | "Combustível"
  | "Ração"
  | "Peça"
  | "Ferramenta"
  | "Outro";

export type ProductUnit =
  | "kg"
  | "litros"
  | "sacos"
  | "unidades"
  | "caixas"
  | "toneladas"
  | "metros"
  | "outro";

export type StockProduct = {
  id: number;
  name: string;
  category: ProductCategory;
  quantity: number;
  unit: ProductUnit;
  minimumStock: number | null;
  storageLocation: string;
  note: string;
};

type AgroAppContextValue = {
  areas: Area[];
  anotacoes: Annotation[];
  produtos: StockProduct[];
  isLoaded: boolean;
  adicionarArea: (area: Omit<Area, "id">) => void;
  adicionarAnotacao: (anotacao: Omit<Annotation, "id">) => void;
  adicionarProduto: (produto: Omit<StockProduct, "id">) => void;
  atualizarQuantidadeProduto: (productId: number, change: number) => void;
};

const STORAGE_KEY = "agrozap-mvp-data";

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

  function adicionarArea(area: Omit<Area, "id">) {
    setAreas((currentAreas) => [...currentAreas, { ...area, id: Date.now() }]);
  }

  function adicionarAnotacao(anotacao: Omit<Annotation, "id">) {
    setAnotacoes((currentAnnotations) => [
      { ...anotacao, id: Date.now() },
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
   * Qualquer tela pode atualizar o estoque por esta função. Valores positivos
   * representam entrada e negativos representam uso; o saldo nunca fica abaixo de zero.
   */
  function atualizarQuantidadeProduto(productId: number, change: number) {
    setProdutos((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? { ...product, quantity: Math.max(0, product.quantity + change) }
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
        adicionarArea,
        adicionarAnotacao,
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
