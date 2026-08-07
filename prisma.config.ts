import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL?.trim();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Geração e validação do Client não precisam abrir conexão.
  // Comandos de banco recebem a URL somente quando ela existe no ambiente.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
