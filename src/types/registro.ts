
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

/**
 * Formato legado da tela Anotações. No banco, o conceito equivalente se chama
 * FarmRecord e usa Decimal/DateTime em vez de textos para valores estruturados.
 */
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
  appliedDose?: string;
  doseUnit?: string;
  harvest?: string;
  supplier?: string;
  productBatch?: string;
  technicalNote?: string;
};
