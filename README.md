# AgroZap

O AgroZap é um sistema web de gestão rural criado com Next.js, TypeScript e
Tailwind CSS. A interface atual permite acompanhar áreas, anotações e estoque
em Modo Simples ou Modo Completo.

O projeto também possui a fundação do backend com PostgreSQL e Prisma. Nesta
etapa, as telas ainda usam `AgroAppContext` e `localStorage`; elas não gravam no
banco automaticamente.

## Executar somente a interface atual

```bash
npm install
npm run dev
```

Depois, acesse `http://localhost:3000`.

## Preparar o banco PostgreSQL

1. Copie `.env.example` para `.env`.
2. Preencha `DATABASE_URL` com a conexão do seu PostgreSQL.
3. Execute:

```bash
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:seed
```

O seed usa somente usuários e telefones fictícios de demonstração. Ele não
importa os dados que já estiverem no `localStorage` do navegador.

## Comandos de verificação

```bash
npm run typecheck
npm run lint
npm run build
```

Para entender a arquitetura e o estágio de cada recurso, comece por
`PROJETO.md` e `docs/MAPA_DO_CODIGO.md`.
