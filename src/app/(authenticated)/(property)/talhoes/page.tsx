import { TalhoesClient } from "@/app/(authenticated)/(property)/talhoes/talhoes-client";
import { listCurrentPropertyAreas } from "@/services/rural/rural-query.service";

export default async function TalhoesPage() {
  const areas = await listCurrentPropertyAreas();

  return <TalhoesClient areas={areas} />;
}
