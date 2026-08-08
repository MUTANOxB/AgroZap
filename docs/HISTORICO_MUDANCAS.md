# Histórico de mudanças do AgroZap

Este arquivo registra mudanças importantes em linguagem simples. Ele não
substitui o histórico do Git; seu objetivo é explicar o motivo e o impacto de
cada etapa para quem está estudando o projeto.

## 08/08/2026 — Interface rural DB-backed (Etapa 3B, validada tecnicamente)

### Estado da entrega

A implementação da Etapa 3B ligou Talhões, Estoque, Anotações e os dados
rurais do Dashboard ao PostgreSQL. A mudança reutiliza integralmente o boundary
seguro da 3A e não cria um segundo caminho de mutação. Nenhuma migration nem
alteração de schema faz parte desta etapa.

A entrega passou pela bateria técnica e permanece **em revisão humana**, sem
commit ou push. Foram aprovados Stage 1.1 8/8, Stage 2 17/17, Stage 3A 19/19,
Stage 3B 16/16 e integração 82/82, totalizando 142/142 em `test:all`.
`db:validate`, `db:generate`, typecheck, lint, build e `git diff --check`
também passaram. O build precisou de rede apenas para obter a fonte Manrope.
O smoke manual de navegador não foi executado neste ambiente.

### Server Page, DTO, Client e refresh

As quatro páginas rurais adotam o mesmo desenho:

```text
Server Page
        ↓
query server-only + requireActivePropertyContext() + READ_PROPERTY
        ↓
DTO serializável da Property ativa
        ↓
Client Component mantém somente formulário/pending/erro/seleção
        ↓
Server Action da 3A deriva Property, createdBy e WEB
        ↓
service + PostgreSQL
        ↓
router.refresh() ou retorno à lista mais recente relê o estado confirmado
```

Nenhum Client Component importa Prisma, escolhe `propertyId`, fornece
`createdByUserId` ou calcula saldo como autoridade. `PropertyAccessContext`
continua adaptando a apresentação por capability, enquanto Action e service
revalidam a segurança no servidor.

### Fluxos rurais ligados ao banco

- Talhões lista `AreaDto` e cria `Area` por `createAreaAction`.
- Estoque lista `StockProductDto`, cria produtos por
  `createStockProductAction` e exibe o saldo real do banco.
- Anotações lista `FarmRecordDto`, relaciona área/produto por CUID e cria
  registros comuns por `createFarmRecordAction`.
- Compra, entrada, pulverização, plantio ou manutenção com movimentação válida
  usam exclusivamente `createFarmRecordWithStockMovementAction`; registro,
  movimento, saldo e auditorias confirmam juntos ou sofrem rollback juntos.
- `FarmRecord.quantity`/`quantityUnit` descrevem a grandeza do registro;
  `StockMovement.amount` vem de um campo próprio e pode ter valor diferente. A
  unidade exibida para o movimento vem do produto selecionado.
- Após criar numa URL histórica com cursor, Anotações substitui a navegação por
  `/registros`; na primeira página, apenas atualiza os dados server-side.
- Decimais continuam texto até o boundary da 3A; labels PT-BR são mapeados para
  enums persistentes por `src/services/rural/rural-ui.ts`, e os IDs DB-backed
  permanecem strings.

Banco vazio produz listas vazias e contagens zero. Os dados demo rurais do
antigo Context não são restaurados como fallback.

### Context e legado local

`AgroAppContext` agora guarda somente `modoUso`, `setModoUso`, `isModoCompleto`
e o estado necessário para carregar a preferência. Apenas
`agrozap-settings` continua sendo lido e escrito.

As chaves `agrozap-mvp-data`, `agrozap-mvp-data:<propertyId>` e
`agrozap-mvp-data:property-scope-migration:v1` permanecem intactas. A 3B não as
lê como fonte, não grava novos arrays nelas, não as apaga, não as mescla e não
as importa para o PostgreSQL. Detectar, visualizar, importar, exportar ou
descartar esse legado pertence exclusivamente à Etapa 3C.

### Dashboard e limites intencionais

Contagens, atividades recentes e visão de estoque do Dashboard passam a ser
tenant-scoped e DB-backed. O total de registros usa contagem própria no banco,
sem confundir o tamanho de uma página com o histórico inteiro. Próximos
vencimentos podem continuar demonstrativos porque ainda não existe domínio
persistente de tarefas; o clima continua como integração independente. Esses
blocos não são apresentados como fonte dos dados rurais persistidos.

A Etapa 3A continua concluída, a 3B está validada tecnicamente/em revisão
humana e a 3C permanece pendente. Portanto, a Etapa 3 inteira ainda não está
concluída.

## 07/08/2026 — Boundary rural server-side (Etapa 3A)

### Estado da entrega

A Etapa 3 foi iniciada e a 3A foi concluída com a validação global aprovada.
Isso conclui o boundary server-side, não a integração da interface: as páginas
rurais continuam no caminho local até a 3B.

Nenhuma migration foi criada. As quatro migrations anteriores e as oito FKs
compostas da Etapa 2.1 permanecem intactas.

### Boundary WEB e autoridade

O novo arquivo
`src/app/(authenticated)/(property)/rural-actions.ts` oferece Server Actions
para criar área, produto, `FarmRecord`, movimentar ou ajustar estoque, reverter
movimento e executar a operação combinada registro + estoque.

Todas seguem o mesmo caminho:

```text
sessão autenticada
        ↓
requireActivePropertyContext()
        ↓
guard de capability
        ↓
propertyId + createdByUserId derivados no servidor; source = WEB
        ↓
normalização e validação de IDs candidatos
        ↓
service rural
        ↓
DTO serializável ou erro seguro
```

`rural-web-inputs.ts` recebe `unknown`, limita campos e tamanhos e recusa
recursivamente `propertyId`, `createdByUserId`, `actorUserId`, `role`,
`capability` e `source`. `performedByUserId` continua funcional somente como
candidato: o service confirma User ativo e membership ativa na Property atual.

`property-capability-guard.ts` aplica a matriz já existente. OWNER e MANAGER
mantêm todas as capabilities; EMPLOYEE lê, cria registro e movimenta estoque;
VIEWER somente lê. Ajuste, reversão e auditoria continuam negados a EMPLOYEE e
VIEWER.

Toda mutação WEB precisa passar o singleton interno
`RURAL_WEB_AUTHORIZATION`, que é `server-only` e não pertence ao payload do
navegador. `undefined` e qualquer objeto forjado são recusados; a ausência do
marcador não concede confiança implícita. Dentro da própria transação de
escrita, `rural-web-authorization.ts` relê e bloqueia a `PropertyMember` e o
`User` atuais antes da alteração. Assim, nem o esquecimento de autorização por
um novo caller nem remoção, desativação ou troca de papel concorrente confirma
uma mutação WEB indevida. Fontes explicitamente não-WEB continuam independentes
desse marcador.

### Queries, DTOs e paginação

`rural-query.service.ts` contém wrappers sem `propertyId` público para listar:

- áreas e produtos ativos, com `READ_PROPERTY`;
- `FarmRecord` e `StockMovement`, com `READ_PROPERTY` e paginação;
- `AuditLog`, com `VIEW_AUDIT` e paginação.

Toda consulta possui `where.propertyId` explícito. O cursor é Base64 URL-safe,
versionado e contém tipo do histórico, Property, instante e ID. Um cursor de
outra Property ou de outro histórico é recusado. `FarmRecord` e movimento usam
`occurredAt DESC, id DESC`; auditoria usa `createdAt DESC, id DESC`. O banco
busca `limit + 1`, com padrão 25 e máximo 100, sem carregar o histórico inteiro
para depois cortar no navegador.

`rural-dtos.ts` impede que modelos Prisma crus atravessem o boundary. IDs e
enums permanecem estáveis, `Decimal` vira string canônica, datas viram ISO e
`null` permanece `null`. Snapshots de produto e área continuam sendo usados no
histórico.

### Números e datas determinísticos

`rural-input-normalization.ts` aceita formatos inequívocos como `12,5`,
`1.234,56`, `1000` e `1000.25`. Um único ponto com três casas, como `1.234`, é
recusado por ambiguidade em vez de ser adivinhado.

Datas de banco usam `YYYY-MM-DD` ancorado em `00:00Z`. Para `occurredAt`, uma
data simples usa `12:00Z`; quando existe horário, `Z` ou offset explícito é
obrigatório. Assim, o timezone do navegador não muda silenciosamente o dia
rural.

### Coerência e atomicidade

Ao criar um novo `StockMovement` apontando para `FarmRecord`, o service exige:

1. a mesma Property;
2. o mesmo produto;
3. a mesma área, inclusive `null`;
4. produto presente no registro.

Incompatibilidades novas produzem `FARM_RECORD_MOVEMENT_MISMATCH`, sem vazar
Prisma. A consistência semântica `FarmRecord` ↔ `StockMovement` é obrigatória
para novas movimentações, mas não bloqueia a correção de fatos anteriores à
regra: uma reversão pode espelhar vínculos históricos legados incompatíveis,
preservando Property, referências, snapshots e o original intacto. A operação
`createFarmRecordWithStockMovement` cria registro, movimento, saldo e
auditorias dentro da mesma transação `Serializable` e do mesmo mecanismo de
retry. Falha de qualquer parte desfaz todas as outras.

### Erros e testes adicionados

`rural-action-result.ts` devolve sucesso com DTO ou erro com código e mensagem
seguros. Erros de input, capability e domínio conhecidos são traduzidos;
Prisma e erros desconhecidos viram `INTERNAL_ERROR`, sem stack, SQL, URL ou
detalhe interno.

A suíte ganhou testes do guard, parser, DTOs, inputs WEB, envelope seguro,
coerência semântica, ator WEB obrigatório, `performedBy` cross-property,
atomicidade, concorrência, queries A×B e paginação. A validação final aprovou:

- `test:stage1.1`: 8/8;
- `test:stage2`: 17/17;
- `test:stage3a`: 19/19;
- integração: 78/78, sendo 8 guardas do runner e 70 casos PostgreSQL;
- `test:all`: 122/122;
- `db:validate`, `db:generate`, typecheck, lint e build.

O runner recriou somente `127.0.0.1/agrozap_test`; o banco `agrozap` não foi
resetado nem recriado.

### O que permanece para 3B e 3C

A UI de áreas, anotações, produtos, estoque e dashboard não foi substituída.
`AgroAppContext`, `agrozap-mvp-data`,
`agrozap-mvp-data:<propertyId>`, o marcador de migração e `agrozap-settings`
continuam intactos. A 3B conectará as telas ao PostgreSQL. A 3C tratará legado,
cross-session e histórico final sem importação silenciosa.

## 07/08/2026 — Blindagem multi-tenant entre propriedades (Etapa 2.1)

### Por que esta etapa existe

Nesta fase, **Property é a fronteira de isolamento tenant do AgroZap**. A
Etapa 2 já revalidava sessão, usuário, propriedade ativa e `PropertyMember` no
servidor. A Etapa 2.1 acrescenta uma barreira no PostgreSQL para que uma futura
falha simples de programação não facilite relacionar um registro da Property A
a uma entidade da Property B.

A regra adotada daqui em diante é permanente: toda funcionalidade
tenant-scoped precisa provar em testes que um usuário operando na Property A
não consegue ler, relacionar nem alterar dados da Property B. Descobrir um ID
de outra propriedade não concede acesso.

### Migration e oito relações protegidas

A migration incremental desta etapa é
`20260807180000_stage_2_1_multi_tenant_isolation`. Ela não altera migrations
anteriores e não corrige silenciosamente eventual dado inconsistente. Uma
relação cruzada antiga deve interromper a aplicação da constraint de forma
clara, sem mover ou apagar registros e sem escolher uma Property arbitrária.

O schema passa a representar oito relações tenant-scoped com FKs compostas:

1. `AreaAlias(propertyId, areaId)` → `Area(propertyId, id)`;
2. `ProductAlias(propertyId, productId)` → `StockProduct(propertyId, id)`;
3. `FarmRecord(propertyId, areaId)` → `Area(propertyId, id)`;
4. `FarmRecord(propertyId, productId)` → `StockProduct(propertyId, id)`;
5. `StockMovement(propertyId, productId)` →
   `StockProduct(propertyId, id)`;
6. `StockMovement(propertyId, areaId)` → `Area(propertyId, id)`;
7. `StockMovement(propertyId, farmRecordId)` →
   `FarmRecord(propertyId, id)`;
8. `StockMovement(propertyId, reversesMovementId)` →
   `StockMovement(propertyId, id)`.

Os modelos de destino possuem a identidade composta necessária em
`(propertyId, id)`. Assim, a existência separada da Property A e de uma
entidade da Property B já não basta para formar uma relação válida.

### propertyId imutável e ON UPDATE RESTRICT

A `propertyId` de `Area`, `StockProduct`, `FarmRecord` e `StockMovement` passa
a ser tratada como parte da identidade estrutural da entidade e é imutável
após a criação. Uma correção futura de tenant não deverá ser feita por update
comum ou cascata: se algum dia for necessária, precisará ser uma operação
administrativa explícita, auditada e projetada para esse fim.

As oito FKs compostas usam `ON UPDATE RESTRICT`, declarado também como
`onUpdate: Restrict` no Prisma, sem alterar as ações de exclusão existentes.
Isso recusa a mudança da chave referenciada quando há dependentes, em vez de
propagar automaticamente a nova `propertyId` para eles.

Essa defesa não torna o campo absolutamente imutável no PostgreSQL. Entidades
sem dependentes ainda podem teoricamente receber `UPDATE` direto, e SQL
coordenado pode tentar trocar simultaneamente a `propertyId` e as referências.
A regra continua dependendo também dos services e das permissões. Triggers,
RLS e uma operação administrativa de correção não foram implementados nesta
etapa.

### O que deliberadamente continua global

`User` continua sendo uma identidade global. A mesma pessoa pode participar de
várias propriedades por vínculos `PropertyMember` independentes.
`createdByUserId`, `performedByUserId` e `AuditLog.actorUserId` também continuam
referenciando o `User` global, e o histórico sobrevive à remoção posterior de
uma membership.

`AuditLog.entityId` permanece polimórfico: o par `entityType`/`entityId` pode
descrever tipos de entidades diferentes e, por isso, não aponta por FK para
uma única tabela tenant-scoped. A coerência desse identificador continua sendo
validada pelos services e testes.

### Autoridade no servidor e riscos residuais

O padrão das Server Actions existentes foi preservado:

```text
navegador envia apenas os dados necessários
        ↓
servidor autentica o User
        ↓
servidor revalida a Property ativa e o PropertyMember
        ↓
servidor deriva actorUserId, propertyId e papel/capabilities
        ↓
service
        ↓
PostgreSQL
```

O `propertyId` enviado na seleção é somente candidato e continua sendo
revalidado. Nenhuma mutação de equipe aceita `actorUserId`, `actorRole` ou
`propertyId` do navegador como autoridade.

Os services rurais de área, produto, registro e estoque ainda não estão
expostos por Server Actions ou API. Antes de ligá-los às telas na Etapa 3, as
escritas deverão exigir a capability adequada e um ator confiável derivado no
servidor; um ator nulo não poderá ser usado como bypass em fluxos web.

O `localStorage` agora usa chave por Property e impede mistura na navegação
normal, mas permanece compartilhado por todos os usuários do mesmo perfil de
navegador. Em um dispositivo compartilhado, alguém com acesso ao DevTools ou a
JavaScript na mesma origem pode enumerar dados locais de propriedades abertas
anteriormente. Esse é um risco residual conhecido até a substituição segura do
armazenamento local; a Etapa 2.1 não iniciou essa migração.

### Decisões que não foram antecipadas

- `Organization` foi deliberadamente adiada. No futuro ela poderá agrupar
  várias Properties para empresa, família, cobrança e administração central;
- PostgreSQL RLS **não foi implementado**. Uma adoção futura deverá projetar
  conexão, contexto de sessão, transações e pooling com Prisma;
- `User.phone` permanece globalmente único;
- `Property.slug` permanece um identificador globalmente único, sem impedir
  que o campo legível `Property.name` se repita. Slugs de nomes iguais deverão
  ser desambiguados;
- WhatsApp, IA, billing, API rural e a Etapa 3 não foram iniciados.

### Testes e validação

O baseline já validado antes desta etapa é:

- `test:stage1.1`: 8/8;
- `test:stage2`: 17/17;
- testes unitários: 25/25;
- integração: 45/45;
- `test:all`: 70/70.

A Etapa 2.1 acrescentou treze cenários PostgreSQL: nove de isolamento A×B e
quatro regressões de reparenting. A validação final aprovou 58/58 testes de
integração e 83/83 em `test:all`, mantendo os 25/25 unitários. A suíte aplicou
as quatro migrations desde um `agrozap_test` vazio, executou o seed duas vezes
com as mesmas identidades, confirmou as oito recusas cross-property e provou
que área, produto, registro e movimento não são reparentados automaticamente.
`db:validate`, `db:generate`, typecheck, lint e build também passaram.

## 07/08/2026 — Autenticação, propriedade ativa, equipe e permissões (Etapa 2)

### O que foi entregue

A Etapa 2 está concluída no código. O AgroZap agora possui login web com
telefone e senha, sessão autenticada, seleção de propriedade ativa, troca de
propriedade, gestão de equipe e autorização por papel. As rotas protegidas não
dependem de um `propertyId` aceito diretamente do navegador: identidade,
participação e estado atual são revalidados no PostgreSQL antes de formar o
contexto usado pelo servidor.

A autenticação usa Auth.js v5 beta (`next-auth` `5.0.0-beta.32`) com provider
`Credentials` e sessão `JWT`. Não foi criado adapter nem conjunto paralelo de
tabelas de autenticação; a migration
`20260807150000_stage_2_authentication` acrescenta somente
`User.passwordHash String?`. O token e a sessão expõem apenas o identificador
necessário do usuário. Cada entrada em fluxo protegido consulta novamente o
`User` e exige `deactivatedAt = null`, de modo que uma pessoa desativada não
continua autorizada apenas por ainda possuir um JWT válido.

Senhas são processadas com `bcryptjs` `3.0.3`, custo 12. O fluxo exige de 10 a
128 caracteres e também rejeita entradas com mais de 72 bytes, limite a partir
do qual o bcrypt truncaria silenciosamente. Nenhuma senha em texto puro é
gravada. O telefone brasileiro é normalizado antes da busca para a forma
canônica internacional iniciada por `+55`; a validação é estrutural e não
substitui uma futura confirmação de posse do número.

Quando o telefone não existe ou o usuário ainda não possui `passwordHash`, o
provider `Credentials` compara a senha com um hash bcrypt aleatório de descarte
do mesmo custo antes de devolver a falha genérica. Isso reduz diferenças óbvias
de tempo entre contas existentes e inexistentes; não transforma o login em
proteção completa contra abuso distribuído.

### Propriedade ativa e rotas protegidas

O cookie `agrozap_active_property` guarda somente o ID candidato da propriedade
ativa e usa `HttpOnly`, `SameSite=Lax`, `Secure` em produção e `Path=/`. O valor
do cookie nunca é a autoridade final. O servidor combina o usuário da sessão
com `PropertyMember` e aceita o contexto somente quando usuário e propriedade
continuam ativos e o vínculo ainda existe. Cookie ausente ou inválido leva à
seleção em `/propriedades`.

As rotas ficaram separadas por grupos do App Router:

- `src/app/login/`: página, formulário e action de login;
- `src/app/(authenticated)/`: exige usuário atual autenticado;
- `src/app/(authenticated)/propriedades/`: lista e seleciona uma propriedade;
- `src/app/(authenticated)/(property)/`: exige propriedade ativa e envolve
  dashboard, áreas, anotações, estoque e equipe com os providers e o
  `AppShell`;
- `src/app/api/auth/[...nextauth]/route.ts`: Route Handler do Auth.js;
- `src/proxy.ts`: checagem otimista do JWT nas rotas protegidas.

O Proxy melhora o redirecionamento, mas não substitui autorização. A decisão
definitiva fica nos layouts, Server Actions e services próximos ao banco.

### Papéis, capacidades e equipe

A política central em
`src/services/autorizacao/property-role-policy.ts` traduz os papéis `OWNER`,
`MANAGER`, `EMPLOYEE` e `VIEWER` nas capacidades:
`READ_PROPERTY`, `CREATE_AREA`, `CREATE_PRODUCT`, `CREATE_RECORD`, `MOVE_STOCK`,
`MANAGE_TEAM`, `ADJUST_STOCK`, `REVERSE_STOCK` e `VIEW_AUDIT`. `OWNER` e
`MANAGER` possuem o conjunto completo nesta etapa; `EMPLOYEE` pode ler,
registrar e movimentar estoque; `VIEWER` possui somente leitura.

A tela `/equipe` permite listar membros, adicionar um usuário já cadastrado por
telefone, trocar o papel e remover a participação. `OWNER` administra todos os
papéis. `MANAGER` administra apenas `EMPLOYEE` e `VIEWER`; não pode criar,
alterar nem remover `OWNER` ou `MANAGER`. Ninguém pode alterar a própria
participação por essa tela, e a propriedade nunca pode ficar sem ao menos um
`OWNER`.

As mutações da equipe repetem autorização e verificação de último proprietário
dentro de transações `Serializable`, com retry limitado para conflitos de
concorrência. A mudança e seu `AuditLog` são confirmados ou desfeitos juntos.
As ações auditadas são `PROPERTY_MEMBER_ADDED`,
`PROPERTY_MEMBER_ROLE_CHANGED` e `PROPERTY_MEMBER_REMOVED`.

### Ponte temporária dos dados rurais

Áreas, anotações e produtos da interface ainda não foram migrados para o
PostgreSQL. Eles continuam no `AgroAppContext`, mas agora são isolados por
propriedade na chave `agrozap-mvp-data:<propertyId>`. A antiga chave global
`agrozap-mvp-data` é copiada, no máximo uma vez, para a primeira propriedade
aberta depois da mudança; um marcador registra essa decisão e a chave antiga é
preservada. Esse mecanismo evita compartilhar automaticamente o mesmo conjunto
local entre todas as propriedades, mas não transforma o navegador em banco
multiusuário.

`PropertyAccessContext` recebe do servidor a projeção de usuário, propriedade,
papel e capacidades para adaptar a interface. Ele é conveniência de UX, não uma
fronteira de segurança. Escritas rurais continuam locais nesta etapa; a Etapa 3
deverá ligá-las aos services PostgreSQL com autorização repetida no servidor.

### Arquivos principais

- `src/auth.config.ts` e `src/auth.ts`;
- `src/proxy.ts`;
- `src/services/auth/`;
- `src/services/propriedades/`;
- `src/services/autorizacao/property-role-policy.ts`;
- `src/services/equipe/`;
- `src/app/login/`;
- `src/app/(authenticated)/`;
- `src/context/PropertyAccessContext.tsx`;
- `src/context/AgroAppContext.tsx`;
- `scripts/auth-dev-password.ts`;
- `prisma/migrations/20260807150000_stage_2_authentication/migration.sql`;
- `tests/integration/stage2.integration.test.ts`.

### Testes e validação

A suíte validada ao final da Etapa 2 está organizada em 8 testes unitários de
`test:stage1.1`, 17 de `test:stage2` e 45 testes de integração: 37 cenários de
domínio/banco e 8 guardas de segurança do banco descartável. A validação final
aprovou 25/25 unitários, 45/45 de integração e 70/70 pelo agregador
`test:all`.

```bash
npm run test:stage1.1
npm run test:stage2
npm run test:integration
npm run test:all
```

### Como testar localmente sem registrar segredo ou senha

1. Copie as variáveis esperadas de `.env.example` para um `.env` local ignorado
   pelo Git e configure uma `DATABASE_URL` para PostgreSQL local cujo banco se
   chame exatamente `agrozap`, além de um `AUTH_SECRET` aleatório com pelo menos
   32 caracteres. Não cole os valores em commits, logs ou documentação.
2. Aplique as migrations e carregue o seed com `npm run db:migrate` e
   `npm run db:seed`.
3. Defina uma senha temporária para um telefone do ambiente local com
   `npm run auth:dev-password -- <telefone>`. O script recusa produção, host
   remoto, banco com outro nome e parâmetros de URL que tentem sobrescrever
   `host`, `hostaddr`, `database` ou `dbname`. A senha gerada aparece uma única
   vez; não a copie para este arquivo.
4. Execute `npm run dev`, abra `/login`, entre com o telefone e a senha
   temporária, escolha uma propriedade em `/propriedades` e confira a troca de
   propriedade e a tela `/equipe`.

### Riscos residuais conhecidos

A Etapa 2 não implementa rate limiting distribuído para tentativas de login nem
revogação versionada de JWT após troca de senha. Esses endurecimentos dependem
da arquitetura de implantação e ficaram fora do escopo. A revalidação do
`User` ativo no PostgreSQL continua bloqueando, dentro do requisito desta etapa,
uma conta desativada mesmo quando o JWT ainda não expirou.

### Resultado e próxima etapa

A Etapa 2 encerra a base de identidade e autorização web sem iniciar WhatsApp,
IA nem a persistência PostgreSQL dos formulários rurais. A Etapa 2.1 foi
adicionada depois como endurecimento relacional antes da Etapa 3 — API real e
substituição do `localStorage`. A futura API deverá reutilizar o usuário e a
propriedade ativa já revalidados e aplicar as mesmas capacidades nos services;
ela não foi iniciada por nenhuma dessas duas entregas.

## 07/08/2026 — Validação real da fundação (Etapa 1.2)

### Por que esta validação foi criada?

As Etapas 1, 1.1 e 1.1.1 construíram as regras de banco e domínio. A Etapa 1.2
não adiciona uma funcionalidade ao usuário: ela tenta quebrar essas regras em
um PostgreSQL real para provar que migrations, transações, concorrência,
rollback, histórico e isolamento funcionam fora de simulações.

Um teste unitário verifica uma regra pequena sem precisar preparar toda a
infraestrutura. Um teste de integração chama os services reais e consulta o
PostgreSQL depois da operação. Por isso, somente a integração consegue provar,
por exemplo, que saldo, `StockMovement` e `AuditLog` foram confirmados juntos
ou desfeitos juntos pelo banco.

### Banco exclusivo de teste

A suíte usou somente o banco descartável `agrozap_test`. Na execução validada,
esse nome foi derivado em memória da configuração PostgreSQL local; o arquivo
`.env` não foi sobrescrito e nenhuma URL completa foi mostrada no console ou
gravada na documentação.

Antes de permitir qualquer recriação, o runner exige:

- PostgreSQL em `localhost` ou `127.0.0.1`;
- nome simples, formado apenas por letras, números e `_`;
- nome contendo `test` como segmento explícito, como em `agrozap_test`;
- banco diferente do banco de desenvolvimento;
- banco fora da lista protegida: `agrozap`, `postgres`, `template0` e
  `template1`;
- marcador interno que prova que os testes de domínio foram iniciados pelo
  runner protegido;
- `DATABASE_URL` do processo de teste apontando exatamente para o mesmo host,
  porta e banco já validados como teste.

Parâmetros de URL que tentem trocar host, porta ou nome do banco também são
recusados, e a porta padrão é fixada explicitamente. Variáveis de controle do
`dotenv` são removidas dos subprocessos para que o `.env` nunca sobrescreva a
conexão de teste já validada. Os logs informam apenas host e nome do banco
autorizado. Qualquer URL PostgreSQL encontrada na saída de um subprocesso é
omitida antes de ser exibida.

As oito guardas automatizadas rodam como preflight antes de qualquer operação
destrutiva. Depois disso, o runner recria somente `agrozap_test`, aplica as migrations com
`prisma migrate deploy`, executa o seed duas vezes e, então, inicia os testes.
O banco normal `agrozap` não foi apagado, resetado nem usado pela suíte.

### Migrations e seed reais

As duas migrations existentes foram aplicadas, em ordem, desde um banco vazio:

1. `20260807090000_initial_domain_foundation`;
2. `20260807120000_stage_1_1_hardening`.

As duas terminaram sem rollback. Em seguida, o seed foi executado duas vezes.
A segunda execução preservou as identidades e não duplicou os dados esperados. A propriedade de
demonstração permaneceu com 3 membros, 3 áreas, 4 apelidos de área, 4 produtos,
6 apelidos de produto, 4 movimentos de abertura, 3 anotações persistentes e 7
logs de auditoria. Os saldos, snapshots e vínculos entre os registros também
foram conferidos.

Os testes de domínio não dependem desses dados de demonstração. Cada cenário
cria sua própria propriedade, usuários, produto e área com identificadores
isolados.

### O que foi provado

Foram aprovados 8 de 8 testes unitários da Etapa 1.1 e 25 de 25 testes de
integração da Etapa 1.2. Os 25 testes de integração se dividem em 17 cenários
de domínio/PostgreSQL e 8 testes das proteções do banco descartável.

Os cenários confirmaram:

- uma saída de 3 sobre saldo 10 termina em saldo 7 e cria exatamente um
  movimento e sua auditoria, com saldos anterior e posterior coerentes;
- estoque insuficiente não altera saldo e não deixa movimento ou auditoria
  parcial;
- quantidade zero é recusada pelo domínio antes de chegar ao `CHECK` do banco;
- duas saídas concorrentes de 8 sobre saldo 10 produzem somente uma retirada
  efetiva e saldo final 2, nunca saldo negativo;
- `productNameSnapshot` e `areaNameSnapshot` sobrevivem ao rename do cadastro,
  tanto em movimentos quanto em `FarmRecord`;
- `createdBy` e `performedBy` permanecem separados, e o ator da auditoria é
  quem registrou a ação;
- usuário desativado não inicia uma nova operação como criador ou executor,
  mas continua preservado no histórico;
- produto, área e propriedade arquivados bloqueiam uso novo, sem bloquear a
  reversão de um movimento histórico válido;
- a reversão não reativa as entidades arquivadas e preserva seus snapshots;
- usuário histórico desativado não impede que outro membro ativo faça a
  reversão, mas o usuário desativado é recusado se tentar registrar essa nova
  reversão;
- reversão duplicada e reversão de uma `REVERSAL` são recusadas;
- duas reversões concorrentes do mesmo movimento produzem somente uma correção
  efetiva;
- services recusam produto ou movimento pertencente a outra propriedade;
- apelidos de produtos e áreas permanecem associados à propriedade correta;
- `CHECK constraints` do PostgreSQL recusam quantidade de estoque negativa,
  equação de saldo incorreta, sinal incompatível com o tipo do movimento e
  saldo final negativo.

Os rollbacks foram consultados no banco após falhas por estoque insuficiente,
usuário desativado e propriedade arquivada. Em todos esses casos, saldo,
movimentos e auditorias permaneceram como estavam antes da tentativa. As
corridas de retirada e reversão também mostraram que somente alterações
confirmadas persistem.

### Bug encontrado e corrigido

Os testes reais encontraram um caso de quantidade zero. Em `Decimal`, o método
`isPositive()` aceita o zero positivo. Isso fazia um produto com saldo inicial
zero tentar criar um movimento de abertura com variação zero e fazia uma
movimentação de quantidade zero chegar até o `CHECK` do PostgreSQL, em vez de
ser recusada pelo domínio.

A correção mínima trocou essa verificação por `greaterThan(0)` nos services de
produto e movimentação. Agora:

- saldo inicial zero cria o produto sem movimento de abertura;
- quantidade movimentada zero retorna `INVALID_QUANTITY` antes de abrir uma
  alteração no banco;
- os testes de regressão confirmam os dois caminhos.

Nenhuma regra do banco foi enfraquecida para esconder o problema.

### Arquivos criados

- `tests/integration/fixtures.ts`;
- `tests/integration/foundation.integration.test.ts`;
- `tests/integration/run.ts`;
- `tests/integration/test-database.ts`;
- `tests/integration/test-database-safety.test.ts`.

### Arquivos principais alterados

- `.env.example`;
- `package.json`;
- `src/services/estoque/product.service.ts`;
- `src/services/estoque/stock-movement.service.ts`;
- `docs/DECISOES.md`;
- `docs/HISTORICO_MUDANCAS.md`;
- `docs/MAPA_DO_CODIGO.md`;
- `docs/ROADMAP.md`.

### Como repetir a validação

```bash
npm run test:stage1.1
npm run test:integration
npm run test:all
```

`test:integration` é destrutivo apenas para o banco local descartável aprovado
pelas guardas. Se a configuração não for segura, o comando termina com erro em
vez de usar o banco normal como alternativa.

### Resultado e próximos limites

A Etapa 1.2 está concluída: migrations do zero, seed idempotente, transações,
concorrência, rollbacks, snapshots, arquivamento, reversões, isolamento e
constraints foram exercitados com PostgreSQL real. Nenhum segredo foi
adicionado ao Git ou à documentação.

`db:validate`, `db:generate`, testes, typecheck e lint terminaram com sucesso.
O `next build` executou o prebuild e gerou o Prisma Client, mas o ambiente
restrito não permitiu baixar a fonte Manrope do Google Fonts. Não houve erro de
TypeScript ou da Etapa 1.2; a confirmação do bundle de produção precisa ser
repetida em um ambiente com acesso a essa fonte. A fonte não foi trocada nem
simulada apenas para deixar o comando verde.

Ainda não estão prontos autenticação, login, propriedade ativa derivada da
sessão, permissões por papel, API, páginas usando PostgreSQL, WhatsApp, IA nem a
orquestração conjunta entre `FarmRecord` e `StockMovement`. A próxima etapa é a
Etapa 2 — autenticação, propriedade ativa, equipe e permissões. Ela não foi
iniciada nesta validação.

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

### Ajuste 1.1.1 — propriedade arquivada

A revisão final encontrou um caso em que `registerStockMovement` validava o
produto, a área e os usuários, mas não verificava explicitamente se a própria
`Property` estava ativa. Assim, uma propriedade arquivada ainda poderia, em
teoria, receber uma nova movimentação se o produto continuasse ativo.

Agora a nova movimentação busca a propriedade dentro da mesma transação e
recusa propriedades inexistentes ou com `archivedAt` preenchido antes de
alterar qualquer saldo. Arquivamento impede novas operações.

A reversão histórica mantém uma regra diferente: a propriedade precisa existir
e o movimento original precisa pertencer a ela, mas ela pode estar arquivada.
Essa correção não reativa propriedade, produto ou área e não modifica nenhum
`archivedAt`.

Arquivos alterados neste ajuste:

- `package.json`;
- `src/services/estoque/errors.ts`;
- `src/services/estoque/property-operation-policy.ts`;
- `src/services/estoque/property-operation-policy.test.ts`;
- `src/services/estoque/stock-movement.service.ts`;
- `docs/DECISOES.md`;
- `docs/HISTORICO_MUDANCAS.md`;
- `docs/MAPA_DO_CODIGO.md`.

O script `npm run test:stage1.1` ganhou quatro testes unitários: propriedade
ativa permite nova movimentação, propriedade arquivada a recusa, propriedade
arquivada continua aceita pela política de reversão e propriedade inexistente
é recusada na reversão. Os testes unitários não simulam uma transação Prisma
completa. Ao encerrar a Etapa 1.1, a confirmação integrada de saldo, movimento,
auditoria e rollback em PostgreSQL real ainda estava pendente. A Etapa 1.2,
registrada acima, concluiu essa validação.

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

Naquele momento não havia `DATABASE_URL` nem PostgreSQL real configurado no
ambiente da revisão. Por isso, o SQL foi revisado junto com o schema, mas ainda
não tinha sido aplicado a um banco real. A Etapa 1.2 aplicou depois essa
migration desde um banco vazio. Para registros antigos, o preenchimento usa o
nome atual na data da migration, pois um nome anterior que nunca foi salvo não
pode ser reconstruído.

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

Ao encerrar a Etapa 1.1, ainda era necessário validar snapshots, usuários
desativados, reversão após arquivamento e duas retiradas concorrentes contra um
PostgreSQL real. Esses cenários foram concluídos na Etapa 1.2.

### O que ainda NÃO estava pronto ao encerrar a Etapa 1.1?

- aplicação e teste desta migration em um PostgreSQL real, concluídos depois na
  Etapa 1.2;
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
