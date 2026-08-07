# Histórico de mudanças do AgroZap

Este arquivo registra mudanças importantes em linguagem simples. Ele não
substitui o histórico do Git; seu objetivo é explicar o motivo e o impacto de
cada etapa para quem está estudando o projeto.

## 07/08/2026 — Endurecimento da fundação (Etapa 1.1)

### Qual problema foi corrigido?

A fundação da Etapa 1 já funcionava, mas a revisão técnica encontrou pontos
que poderiam gerar histórico incompleto ou operações inconsistentes. A Etapa
1.1 corrigiu somente esses pontos, sem refazer a arquitetura e sem ligar as
telas ao PostgreSQL.

As principais correções foram:

- o Prisma Client agora é gerado automaticamente antes de `npm run build`;
- a geração e a validação do Prisma não exigem `DATABASE_URL` quando nenhuma
  conexão com o banco é necessária;
- movimentações e anotações persistentes guardam snapshots dos nomes de
  produtos e áreas;
- novas operações recusam usuários inexistentes, fora da propriedade ou
  desativados;
- uma reversão histórica aceita o produto ou a área original arquivados;
- `StockMovement` e `AuditLog` foram formalizados como históricos
  append-only;
- a anotação local que precisa alterar estoque passou a validar e preparar as
  duas mudanças antes de publicar qualquer uma delas.

### O que são snapshots?

Snapshot é uma cópia do nome no momento em que o evento aconteceu. O ID
continua apontando para a entidade atual, enquanto o snapshot preserva como
ela era identificada naquele dia.

Exemplo: se uma movimentação foi criada para o produto “Produto A” e ele foi
renomeado depois para “Produto B”, a movimentação antiga continua com
`productNameSnapshot = "Produto A"`.

`StockMovement` passou a guardar `productNameSnapshot` e, quando houver área,
`areaNameSnapshot`. `FarmRecord` também recebe os nomes diretamente do produto
e da área encontrados pelo service. O caller não escolhe mais o snapshot de
produto.

### Por que a reversão funciona após o arquivamento?

Uma nova movimentação ainda exige produto e área ativos. A reversão, porém, é
uma correção do passado: ela verifica se as entidades originais ainda existem
e pertencem à mesma propriedade, mas não exige que continuem ativas.

A reversão não reativa produto ou área e não altera `archivedAt`. O novo
movimento `REVERSAL` copia os snapshots e a unidade da movimentação original,
preservando o contexto que está sendo corrigido.

### Como ficou a regra de usuários desativados?

Quando `createdByUserId` ou `performedByUserId` é informado em uma nova ação,
o usuário precisa existir, participar da propriedade e ter
`deactivatedAt = null`. Um usuário desativado permanece nos registros antigos;
nenhum histórico é apagado.

Na reversão, quem executa a correção agora deve estar ativo. A pessoa ligada à
movimentação original pode ter sido desativada depois, porque sua participação
é apenas histórica.

### Como funciona a geração automática do Prisma Client?

O `package.json` ganhou o script `prebuild`, que executa
`npm run db:generate` antes de cada `npm run build`. Assim, uma instalação limpa
não depende de alguém lembrar de gerar manualmente `src/generated/prisma`.

O `prisma.config.ts` só inclui a fonte de dados quando `DATABASE_URL` existe no
ambiente. `prisma generate`, `prisma validate` e o build não precisam abrir
uma conexão. Migrações, seed e uso real do PostgreSQL continuam exigindo uma
URL válida.

### O que mudou no MVP local?

No Modo Completo, uma anotação que movimenta estoque agora exige:

- um produto válido;
- uma quantidade preenchida, numérica e maior que zero;
- saldo suficiente quando a operação é uma saída.

Se algo estiver inválido, a anotação não é salva e o estoque não muda. O
Context calcula primeiro o próximo saldo e prepara a anotação e a lista de
produtos; somente depois publica os dois estados no mesmo evento do React. É
uma operação composta para o usuário, ainda dentro da ponte temporária do
`localStorage`, e não uma transação PostgreSQL.

### Migration criada

Foi criada a migration incremental:

`prisma/migrations/20260807120000_stage_1_1_hardening/migration.sql`

Ela não reescreve a migration inicial. Primeiro adiciona as novas colunas como
opcionais, preenche registros existentes com os nomes atuais disponíveis e só
depois torna `StockMovement.productNameSnapshot` obrigatório. Um snapshot de
produto já existente em `FarmRecord` não é sobrescrito.

Como não havia `DATABASE_URL` nem PostgreSQL real configurado neste ambiente,
o SQL foi revisado junto com o schema, mas a migration não foi aplicada a um
banco real. Para registros antigos, o preenchimento usa o nome atual na data
da migration, pois um nome anterior que nunca foi salvo não pode ser
reconstruído.

### Arquivos principais alterados

- `package.json`
- `prisma.config.ts`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/app/registros/page.tsx`
- `src/context/AgroAppContext.tsx`
- `src/services/estoque/errors.ts`
- `src/services/estoque/local-stock.ts`
- `src/services/estoque/product.service.ts`
- `src/services/estoque/stock-movement.service.ts`
- `src/services/registros/farm-record.service.ts`
- `src/services/talhoes/area.service.ts`
- `src/services/usuarios/property-membership.ts`
- `docs/DECISOES.md`
- `docs/GLOSSARIO.md`
- `docs/HISTORICO_MUDANCAS.md`
- `docs/MAPA_DO_CODIGO.md`
- `docs/ROADMAP.md`

### Arquivos criados

- `prisma/migrations/20260807120000_stage_1_1_hardening/migration.sql`
- `src/services/estoque/local-stock.test.ts`

### Como testar

Em uma instalação limpa, sem `DATABASE_URL`, execute:

```bash
npm install
npm run test:stage1.1
npm run db:validate
npm run db:generate
npm run typecheck
npm run lint
npm run build
```

O teste leve da Etapa 1.1 verifica:

1. saída de 15 com saldo 10 retorna “Estoque insuficiente.” e mantém o valor
   original;
2. a validação usada pelo formulário recusa produto inexistente;
3. o parser usado pelo formulário recusa quantidade vazia, zero, negativa ou
   inválida;
4. uma quantidade positiva continua produzindo o saldo esperado.

Para conferir a integração visual, abra `/registros` no Modo Completo e tente
salvar um tipo que movimenta estoque com produto inexistente, quantidade
vazia/zero e saída acima do saldo. Em cada erro, confirme que a contagem de
anotações e o saldo continuam iguais.

Para validar snapshots, usuários desativados, reversão após arquivamento e duas
retiradas concorrentes contra o PostgreSQL, ainda é necessário configurar um
banco real, aplicar as migrations e exercitar os services.

### O que ainda NÃO está pronto?

- aplicação e teste desta migration em um PostgreSQL real;
- páginas lendo e gravando no PostgreSQL;
- API/Server do domínio;
- autenticação, login, propriedade ativa e permissões por papel;
- importação dos dados do `localStorage`;
- integração com WhatsApp, webhook ou provedor externo;
- inteligência artificial, chatbot, áudio ou transcrição.

Esta etapa não implementou autenticação, WhatsApp nem IA. A próxima etapa
recomendada continua sendo autenticação, propriedade ativa, equipe e
permissões.

## 07/08/2026 — Fundação de banco, domínio e auditoria

### O que mudou?

Foi criada a base técnica para o AgroZap deixar de depender, no futuro, apenas
do navegador. A etapa adicionou:

- Prisma 7.9 conectado ao PostgreSQL por adapter;
- schema de banco preparado para múltiplas propriedades e usuários;
- migration inicial;
- seed com dados fictícios de desenvolvimento;
- conexão central do Prisma compatível com hot reload;
- services para áreas, produtos, estoque, anotações, auditoria e validação de
  membros;
- movimentações de estoque com saldo anterior e posterior;
- reversão rastreável de movimentações;
- validação de estoque insuficiente;
- tipos TypeScript do MVP organizados em `src/types`;
- documentação da nova arquitetura.

### Por que mudou?

O `localStorage` é útil para um protótipo, mas não atende uma aplicação com
várias pessoas e propriedades. Ele não oferece transações de banco, relações,
auditoria permanente nem compartilhamento seguro dos dados.

A nova base permite construir essas capacidades de forma incremental, sem
apagar o Context e sem redesenhar as telas atuais.

### Como funcionava antes?

Antes desta etapa:

- áreas, anotações e produtos eram arrays do `AgroAppContext`;
- os tipos principais também ficavam dentro do Context;
- o navegador salvava tudo em `localStorage`;
- IDs locais eram criados com `Date.now()`;
- a página Anotações decidia sozinha como alterar o estoque;
- uma retirada maior que o saldo era silenciosamente limitada a zero;
- não existiam `Property`, usuários associados, movimentos ou auditoria;
- o schema Prisma e as pastas de services estavam vazios.

### Como funciona agora?

Existem dois caminhos durante a transição.

#### Caminho que as telas usam hoje

```text
Tela
  ↓
AgroAppContext
  ↓
localStorage
```

As telas continuam nesse caminho para preservar o MVP. A regra local de
estoque agora rejeita uma retirada que deixaria o saldo negativo e mostra
“Estoque insuficiente.”. Ainda assim, esse caminho não cria `StockMovement`
nem `AuditLog` no PostgreSQL.

#### Fundação disponível no servidor

```text
API/Server futura
  ↓
Service
  ↓
Prisma
  ↓
PostgreSQL
```

Os services já conseguem validar e gravar operações no banco, mas ainda não
foram chamados pelas páginas.

Em uma movimentação feita pelo service de estoque, a mesma transação:

1. localiza produto, propriedade e vínculos informados;
2. lê e valida o saldo;
3. atualiza o saldo;
4. cria a movimentação;
5. cria a auditoria.

O nível `Serializable`, uma comparação otimista do saldo e até quatro
tentativas tratam alterações concorrentes. Se o conflito continuar, a operação
é recusada para ser tentada novamente, em vez de esconder uma inconsistência.

Cada service protege a operação sob sua responsabilidade. A orquestração de
uma anotação junto com uma movimentação vinculada ainda deverá ser definida na
camada API/Server; a interface atual não faz essa operação conjunta no banco.

### Como o banco ficou organizado?

- `Property`: propriedade rural.
- `User`: pessoa identificada por telefone.
- `PropertyMember`: participação e papel da pessoa na propriedade.
- `Area` e `AreaAlias`: área oficial e seus apelidos.
- `StockProduct` e `ProductAlias`: produto oficial e seus apelidos.
- `StockMovement`: entrada, saída, ajuste ou reversão.
- `FarmRecord`: anotação ou acontecimento da propriedade.
- `AuditLog`: trilha técnica das ações importantes.

Quantidades e valores usam `Decimal`. Datas com horário usam
`Timestamptz(3)`. IDs persistentes usam CUID. Esses tipos pertencem ao banco;
os objetos temporários do frontend ainda preservam seus formatos antigos para
não quebrar as telas.

### Arquivos principais criados

- `.env.example`
- `prisma.config.ts`
- `prisma/migrations/20260807090000_initial_domain_foundation/migration.sql`
- `prisma/migrations/migration_lock.toml`
- `prisma/seed.ts`
- `src/lib/normalize-name.ts`
- `src/services/auditoria/audit-log.service.ts`
- `src/services/estoque/errors.ts`
- `src/services/estoque/local-stock.ts`
- `src/services/estoque/product.service.ts`
- `src/services/estoque/stock-movement.service.ts`
- `src/services/registros/farm-record.service.ts`
- `src/services/talhoes/area.service.ts`
- `src/services/usuarios/property-membership.ts`
- `docs/HISTORICO_MUDANCAS.md`
- `docs/DECISOES.md`

O Prisma Client é gerado em `src/generated/prisma`. Essa pasta é resultado do
comando de geração e não deve ser editada manualmente.

### Arquivos principais alterados

- `package.json` e `package-lock.json`
- `.gitignore`
- `eslint.config.mjs`
- `prisma/schema.prisma`
- `src/lib/prisma.ts`
- `src/context/AgroAppContext.tsx`
- `src/app/registros/page.tsx`
- `src/types/estoque.ts`
- `src/types/registro.ts`
- `src/types/talhao.ts`
- `PROJETO.md`
- `docs/MAPA_DO_CODIGO.md`
- `docs/GLOSSARIO.md`
- `docs/ROADMAP.md`

### Como configurar e testar

É necessário ter um PostgreSQL acessível. Depois:

1. copie `.env.example` para `.env`;
2. preencha `DATABASE_URL` somente no `.env`;
3. instale as dependências;
4. valide e gere o Prisma Client;
5. aplique a migration e, se desejar, carregue o seed;
6. execute as verificações do projeto.

```bash
npm install
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:seed
npm run typecheck
npm run lint
npm run build
npm run dev
```

O `db:seed` usa telefones claramente fictícios, como `+5500000000001`.

Para verificar o comportamento preservado da interface:

1. abra `http://localhost:3000`;
2. cadastre uma área e um produto;
3. atualize a página e confirme que os dados locais continuam lá;
4. no Modo Completo, tente registrar uma saída maior que o saldo;
5. confirme que a mensagem de estoque insuficiente aparece e a anotação não é
   salva.

Esse teste visual comprova o caminho do `localStorage`, não o uso do banco. Os
services Prisma serão exercitados pela aplicação quando a camada API/Server for
criada.

### O que ainda NÃO está pronto?

- páginas lendo e gravando no PostgreSQL;
- importação automática dos dados do `localStorage`;
- login e autenticação;
- seleção real de propriedade e gestão de equipe;
- política completa de permissões por papel;
- API de dados do AgroZap;
- consulta visual de movimentos e auditoria;
- transação conjunta entre anotação e movimento iniciada pela interface;
- WhatsApp, webhook e identificação por telefone;
- ação pendente e confirmação;
- IA, chatbot, áudio e transcrição;
- alertas e notificações.

Ter `WHATSAPP` no enum de origem e usuários com telefone no schema apenas
prepara o formato dos dados. Nenhum desses recursos externos foi implementado.
