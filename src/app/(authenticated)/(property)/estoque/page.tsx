import { EstoqueClient } from "@/app/(authenticated)/(property)/estoque/estoque-client";
import { listCurrentPropertyProducts } from "@/services/rural/rural-query.service";

export default async function EstoquePage() {
  const products = await listCurrentPropertyProducts();

  return <EstoqueClient products={products} />;
}
