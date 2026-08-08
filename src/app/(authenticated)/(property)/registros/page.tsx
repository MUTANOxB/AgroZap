import { RegistrosClient } from "@/app/(authenticated)/(property)/registros/registros-client";
import {
  listCurrentPropertyAreas,
  listCurrentPropertyFarmRecords,
  listCurrentPropertyProducts,
} from "@/services/rural/rural-query.service";

const RECORDS_PAGE_LIMIT = 50;

type RegistrosPageProps = {
  searchParams: Promise<{ cursor?: string | string[] }>;
};

export default async function RegistrosPage({ searchParams }: RegistrosPageProps) {
  const parameters = await searchParams;
  const cursor =
    typeof parameters.cursor === "string" ? parameters.cursor : null;
  const [areas, products, recordsPage] = await Promise.all([
    listCurrentPropertyAreas(),
    listCurrentPropertyProducts(),
    listCurrentPropertyFarmRecords({ cursor, limit: RECORDS_PAGE_LIMIT }),
  ]);

  return (
    <RegistrosClient
      areas={areas}
      products={products}
      records={recordsPage.items}
      nextCursor={recordsPage.nextCursor}
      isPaginated={cursor !== null}
    />
  );
}
