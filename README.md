# AgroZap

O AgroZap é um sistema web de gestão rural criado com Next.js, TypeScript e
Tailwind CSS. A interface atual permite acompanhar áreas, anotações e estoque
em Modo Simples ou Modo Completo.

O projeto usa PostgreSQL e Prisma para autenticação, propriedades, equipe e
dados rurais. Na implementação da Etapa 3B, Talhões, Estoque, Anotações e os
dados rurais do Dashboard leem e gravam no banco pelo boundary seguro da 3A.
A validação técnica final aprovou 142/142 testes; a entrega aguarda revisão
humana sem commit.

O fluxo rural é `Server Page → query tenant-scoped → DTO → Client Component →
Server Action → PostgreSQL → nova leitura server-side`. Na primeira página isso
usa `router.refresh()`; uma criação numa página histórica de Anotações volta a
`/registros`. O `AgroAppContext` guarda apenas o Modo Simples/Completo em
`agrozap-settings`; ele não é mais fonte de áreas, produtos, saldos ou registros.

## Executar a aplicação

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

## Legado local

As chaves rurais antigas permanecem intactas para tratamento explícito na
Etapa 3C. A aplicação normal da 3B não lê, não mistura, não importa e não apaga
`agrozap-mvp-data`, `agrozap-mvp-data:<propertyId>` nem o marcador de migração.
Somente `agrozap-settings` continua ativo para a preferência `modoUso`.

No Dashboard, atividades, contagens e estoque rurais vêm do PostgreSQL. Tarefas
podem continuar demonstrativas porque ainda não existe um domínio persistente
para elas; o clima continua sendo uma integração independente.

## Comandos de verificação

```bash
npm run test:stage3b
npm run test:all
npm run typecheck
npm run lint
npm run build
```

Para entender a arquitetura e o estágio de cada recurso, comece por
`PROJETO.md` e `docs/MAPA_DO_CODIGO.md`.

A matriz final aprovou Stage 1.1 8/8, Stage 2 17/17, Stage 3A 19/19, Stage 3B
16/16 e integração 82/82, totalizando 142/142 em `test:all`.
