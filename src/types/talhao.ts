
export type ProductionType =
  | "Lavoura"
  | "Pasto"
  | "Horta"
  | "Pomar"
  | "Estufa"
  | "Outro";

/** Formato temporário usado pela tela enquanto ela ainda lê o localStorage. */
export type Area = {
  id: number;
  name: string;
  type: ProductionType;
  size: string;
  note: string;
  currentCrop?: string;
  harvest?: string;
  soilType?: string;
  irrigation?: string;
  estimatedProductivity?: string;
};
