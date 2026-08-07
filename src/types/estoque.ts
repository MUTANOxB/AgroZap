
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

/** Formato temporário usado pelas telas enquanto elas ainda leem o localStorage. */
export type StockProduct = {
  id: number;
  name: string;
  category: ProductCategory;
  quantity: number;
  unit: ProductUnit;
  minimumStock: number | null;
  storageLocation: string;
  note: string;
  supplier?: string;
  unitValue?: string;
  expirationDate?: string;
  batchNumber?: string;
  purchaseDate?: string;
  technicalNote?: string;
};
