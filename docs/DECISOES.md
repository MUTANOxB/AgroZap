# Decisões técnicas do AgroZap

Este documento explica decisões que moldam o projeto. O formato de cada item é:

- **Decisão:** o caminho escolhido.
- **Por quê:** o problema que esse caminho resolve.
- **Consequência:** o que deve ser respeitado nas próximas etapas.

## 1. PostgreSQL como banco de dados

**Decisão:** usar PostgreSQL como banco persistente principal.

**Por quê:** o AgroZap foi planejado para múltiplos usuários e propriedades,
com relações, transações, índices, dados JSON de auditoria e alterações
concorrentes. PostgreSQL oferece uma base madura para esses requisitos.

**Consequência:** desenvolvimento e produção precisam de uma `DATABASE_URL`.
O `localStorage` continua apenas como compatibilidade temporária do MVP.

## 2. Prisma 7.9 como ORM

**Decisão:** usar Prisma para descrever o schema, gerar o client, criar
migrations e acessar o PostgreSQL.

**Por quê:** Prisma aproxima os modelos do banco do TypeScript e deixa relações
e comandos mais fáceis de descobrir. Isso ajuda tanto a manutenção quanto o
aprendizado.

**Consequência:** mudanças estruturais devem começar em
`prisma/schema.prisma`, gerar uma migration revisável e atualizar o Prisma
Client. Não se deve alterar `src/generated/prisma` manualmente.

## 3. Uma conexão Prisma central

**Decisão:** exportar uma instância central em `src/lib/prisma.ts` e
reaproveitá-la globalmente durante o desenvolvimento.

**Por quê:** o hot reload do Next.js pode recarregar módulos muitas vezes. Criar
um novo client e um novo pool a cada recarga pode abrir conexões em excesso.

**Consequência:** services devem importar `db` desse arquivo em vez de criar
seu próprio `PrismaClient`. O seed é uma exceção: ele é um processo isolado,
abre seu client e o desconecta ao terminar.

## 4. Toda informação importante pertence a uma Property

**Decisão:** áreas, produtos, movimentos, anotações e auditorias possuem
`propertyId`.

**Por quê:** “Fazenda Santa Helena” não pode ser a única propriedade fixa do
sistema. Separar os dados por propriedade evita mistura e prepara consultas e
autorizações futuras.

**Consequência:** todo service do domínio recebe a propriedade e verifica se as
entidades relacionadas pertencem ao mesmo escopo. O texto fixo do dashboard
ainda é parte do MVP e será substituído após a integração.

## 5. PropertyMember em vez de user.propertyId

**Decisão:** relacionar usuários e propriedades por `PropertyMember`.

**Por quê:** um usuário poderá participar de mais de uma propriedade e uma
propriedade terá várias pessoas. Um único `user.propertyId` impediria essa
relação de muitos para muitos.

**Consequência:** o papel fica no vínculo, com valores `OWNER`, `MANAGER`,
`EMPLOYEE` e `VIEWER`. Os fluxos autenticados atuais resolvem o
`PropertyMember` no PostgreSQL e aplicam uma política central de capacidades.
As páginas rurais ainda precisam repetir essa autorização nas escritas
persistentes que serão ligadas ao banco na Etapa 3.

## 6. Telefone em formato internacional

**Decisão:** reservar um telefone único com até 16 caracteres, preparado para
valores como `+5564999999999`.

**Por quê:** futuramente o número poderá ajudar a identificar o usuário no
WhatsApp.

**Consequência:** login e equipe normalizam formatos brasileiros para `+55`
seguido de DDD e número antes de consultar o banco. A validação atual é
estrutural; confirmar a posse do telefone continua sendo uma necessidade de um
cadastro futuro. O uso no login não significa que o WhatsApp esteja conectado.

## 7. createdBy e performedBy são identidades diferentes

**Decisão:** movimentos e anotações podem guardar quem criou o registro e quem
executou a atividade.

**Por quê:** em “João informou que Pedro retirou 3 litros”, João é a origem do
registro e Pedro executou a retirada. Usar um único campo perderia essa
informação.

**Consequência:** `performedBy` pode ficar vazio quando não se aplica. Os campos
de usuário também aceitam ausência para registros de sistema e para os dados
rurais ainda mantidos no fluxo local. Nos novos fluxos humanos do servidor, a
identidade vem da sessão revalidada, e não de um ID livre enviado pelo cliente.

## 8. Anotações persistentes se chamam FarmRecord

**Decisão:** usar `FarmRecord` no banco e manter “Anotações” como nome amigável
na interface.

**Por quê:** `Record` seria genérico demais e `Annotation` pode parecer apenas
um comentário. `FarmRecord` representa compras, aplicações, vistorias,
manutenções e observações sem obrigar todas elas a alterar estoque.

**Consequência:** durante a migração existem dois tipos:

- `Annotation`, formato legado usado pelas telas e pelo `localStorage`;
- `FarmRecord`, formato persistente do PostgreSQL.

A conversão será feita na futura camada API/Server.

## 9. Saldo rápido e histórico de movimentos

**Decisão:** `StockProduct.quantity` guarda o saldo atual, mas toda mudança no
banco deve produzir um `StockMovement`.

**Por quê:** consultar o saldo fica simples e rápido, enquanto o movimento
explica de onde ele veio. O movimento registra quantidade, unidade, saldo
anterior, saldo posterior, origem, pessoas, data e motivo.

**Consequência:** ninguém deve atualizar `StockProduct.quantity` diretamente
em uma página ou rota. A alteração deve passar pelo service. O seed também cria
um movimento de abertura quando inclui saldo inicial.

## 10. Estoque nunca fica negativo silenciosamente

**Decisão:** rejeitar a operação com “Estoque insuficiente.” quando uma saída
for maior que o saldo.

**Por quê:** transformar silenciosamente um saldo de 86 em zero após uma saída
de 100 esconderia uma diferença de 14 e criaria um histórico incorreto.

**Consequência:** a regra existe no service Prisma e também em uma função local
temporária usada pelo Context. A função local protege o MVP, mas ainda não cria
movimento ou auditoria persistente.

## 11. Transação Serializable, comparação e retry

**Decisão:** movimentações de estoque usam transação com isolamento
`Serializable`, comparam o saldo lido antes de atualizá-lo e repetem conflitos
transitórios até quatro vezes.

**Por quê:** duas retiradas podem chegar quase ao mesmo tempo. Apenas ler e
depois salvar sem proteção poderia fazer uma operação sobrescrever a outra.

**Consequência:** saldo, movimento e auditoria são confirmados juntos ou
desfeitos juntos. Se os conflitos continuarem, o service retorna uma mensagem
para tentar novamente. As novas tentativas não transformam erro de domínio,
como estoque insuficiente, em sucesso.

## 12. Auditoria participa da mesma transação

**Decisão:** `writeAuditLog` recebe a transação já aberta pelo service.

**Por quê:** não faria sentido alterar o saldo e falhar antes de registrar a
auditoria, ou registrar uma auditoria de algo que foi desfeito.

**Consequência:** operações importantes devem criar seus logs dentro da mesma
unidade de trabalho. `beforeData`, `afterData` e `metadata` usam JSONB para
guardar contexto variável sem transformar cada detalhe em uma coluna.

## 13. O histórico não é limitado a dez registros

**Decisão:** o banco guarda todos os movimentos, anotações e logs previstos.

**Por quê:** limitar o armazenamento apagaria informação útil para conferência
e auditoria.

**Consequência:** a interface futura poderá mostrar dez itens por página, mas
isso será paginação de consulta, não exclusão dos itens antigos.

## 14. Correções criam reversão e novo registro

**Decisão:** não editar silenciosamente uma movimentação já confirmada. O
service cria outra movimentação do tipo `REVERSAL`, ligada à original.

**Por quê:** preservar o erro original e a correção permite entender tudo o que
aconteceu.

**Consequência:** para corrigir uma saída de 3 para 2, cria-se a reversão de 3 e
depois uma nova saída de 2. Cada movimento pode ser revertido apenas uma vez, e
uma reversão não é revertida diretamente. Se desfazer uma entrada já consumida
deixaria o saldo negativo, a reversão é rejeitada.

## 15. CUID para IDs persistentes

**Decisão:** usar `cuid()` nos modelos Prisma.

**Por quê:** CUID gera identificadores textuais difíceis de colidir sem depender
de um contador central ou do horário atual.

**Consequência:** IDs do banco são strings e não devem ser gerados com
`Date.now()`. Os IDs numéricos com `Date.now()` continuam somente no modelo
legado do `localStorage` até a migração das telas.

## 16. Decimal para quantidades e dinheiro

**Decisão:** quantidades, doses, tamanhos e valores monetários estruturados usam
`Decimal` no PostgreSQL.

**Por quê:** produtos rurais podem ter 0,5 litro ou 2,75 kg. Valores monetários
também não devem sofrer imprecisões comuns de números de ponto flutuante.

**Consequência:** comandos dos services recebem números decimais como texto e
os convertem de forma controlada. A API futura deverá converter corretamente os
campos de formulário, que hoje ainda usam `number` ou texto no frontend.

A validação de “maior que zero” usa `greaterThan(0)`, e não `isPositive()`. A
Etapa 1.2 mostrou que `isPositive()` também aceita `+0`. Com a comparação
explícita, saldo inicial zero não cria um movimento de abertura vazio e uma
movimentação de quantidade zero é recusada pelo domínio antes do banco.

## 17. Datas reais usam Date, DateTime e Timestamptz

**Decisão:** acontecimentos e auditorias usam `Timestamptz(3)`; validade e data
de compra usam o tipo `Date` do PostgreSQL.

**Por quê:** um acontecimento precisa preservar instante e fuso de forma
consistente, enquanto uma validade normalmente representa apenas o dia.

**Consequência:** a futura API deverá definir como apresentar datas no fuso da
propriedade. Não se deve salvar toda data como texto apenas porque o formulário
HTML entrega uma string.

## 18. Nomes oficiais e apelidos normalizados

**Decisão:** `AreaAlias` e `ProductAlias` guardam apelidos. Nomes usados para
busca também possuem uma versão normalizada, sem diferença de acento, caixa ou
espaços repetidos.

**Por quê:** “Roça do Fundo”, “roca do fundo” e “  roça do fundo  ” devem poder
apontar para a mesma ideia. Isso prepara a busca e a interpretação futura sem
depender de IA agora.

**Consequência:** nome oficial e apelidos não podem colidir dentro da mesma
propriedade. A normalização ajuda a localizar; o nome original continua salvo
para ser exibido corretamente.

## 19. RecordSource inclui futuro sem implementar o futuro

**Decisão:** o enum possui `WEB`, `WHATSAPP`, `SYSTEM` e `API`.

**Por quê:** movimentos, anotações e auditorias precisam informar de onde uma
operação veio.

**Consequência:** `WHATSAPP` é apenas um valor reservado no modelo. Não existe
webhook, provedor, leitura de mensagens ou bot nesta etapa.

## 20. IA nunca escreve diretamente no banco

**Decisão:** uma IA futura só poderá produzir uma proposta estruturada.

**Por quê:** a interpretação pode estar errada ou ambígua. Ela não deve ignorar
saldo, propriedade, autoria, permissão ou confirmação.

**Consequência:** o fluxo deverá ser:

```text
Mensagem
  ↓
Interpretação gera proposta
  ↓
Sistema valida identidade, propriedade, permissão e dados
  ↓
Usuário confirma
  ↓
Service executa transação e auditoria
```

A IA não receberá credenciais para executar comandos livres no PostgreSQL.

## 21. PendingAction foi adiada

**Decisão:** não criar `PendingAction` nesta etapa.

**Por quê:** quando a decisão foi tomada ainda não existiam autenticação,
WhatsApp, IA nem contrato de confirmação. A autenticação web passou a existir
na Etapa 2, mas os demais estados do fluxo continuam indefinidos; criar a tabela
agora ainda exigiria adivinhar validade, reprocessamento e regras de segurança.

**Consequência:** a entidade será desenhada na etapa de confirmação, depois que
o fluxo real estiver definido. O adiamento é intencional e não impede a base
atual de evoluir.

## 22. Migração incremental preserva o Context

**Decisão:** não substituir o `AgroAppContext` de uma vez.

**Por quê:** áreas, anotações, estoque e dashboard já dependem dele. Uma troca
total nesta etapa aumentaria muito o risco de quebrar o MVP.

**Consequência:** schema e services coexistem temporariamente com o
`localStorage`. Os dados do navegador não são copiados automaticamente pelo
seed. A futura migração deverá declarar quando ler dados locais, como evitar
duplicação e quando remover a compatibilidade.

## 23. O build sempre gera o Prisma Client

**Decisão:** executar `npm run db:generate` no script `prebuild` e deixar a
configuração da fonte de dados opcional quando `DATABASE_URL` não existir.

**Por quê:** `src/generated/prisma` não pertence ao Git. Uma máquina nova ou um
ambiente de CI precisa conseguir executar `npm install` e `npm run build` sem
depender de uma geração manual anterior. Gerar o client não abre conexão com o
banco, portanto não deve exigir uma credencial que ainda não existe.

**Consequência:** `npm run build` gera o client automaticamente. Validação e
geração do schema podem funcionar sem `DATABASE_URL`; migration, seed e acesso
real ao PostgreSQL continuam exigindo uma URL válida. A pasta gerada permanece
ignorada e nunca deve ser editada à mão.

## 24. IDs atuais e snapshots históricos têm papéis diferentes

**Decisão:** manter o ID como relação com a entidade atual e gravar o nome do
produto e da área como snapshot no momento do evento.

**Por quê:** renomear “Produto A” para “Produto B” não deve reescrever a forma
como uma movimentação antiga era identificada.

**Consequência:** novas movimentações preenchem `productNameSnapshot` e
`areaNameSnapshot` dentro da mesma transação que lê as entidades. O service de
`FarmRecord` também busca os nomes e não confia em um nome enviado pelo caller.
Uma reversão copia os snapshots do movimento original. A migration
`20260807120000_stage_1_1_hardening` preenche registros antigos com o melhor
nome ainda disponível, sem substituir snapshots de produto já existentes em
`FarmRecord`.

## 25. Usuário desativado não inicia uma nova ação

**Decisão:** `createdByUserId` e `performedByUserId`, quando informados em uma
nova ação, precisam identificar usuários existentes, membros da propriedade e
com `deactivatedAt = null`.

**Por quê:** manter um vínculo antigo de `PropertyMember` não significa que a
pessoa ainda está autorizada a agir.

**Consequência:** áreas, produtos, movimentações e anotações novas usam a
validação de participação ativa. A desativação não apaga a pessoa nem remove
sua autoria de registros anteriores. Desde a Etapa 2, a sessão também
reconsulta `User` e exige `deactivatedAt = null`, e a política de papéis está
disponível para os fluxos do servidor.

## 26. Nova operação e reversão histórica usam regras diferentes

**Decisão:** uma nova operação exige propriedade, produto e área ativos; uma
reversão pode usar a propriedade, o produto ou a área original arquivados,
desde que ainda existam e correspondam à movimentação original.

**Por quê:** arquivamento impede uso futuro, mas não pode impedir a correção de
um evento que já aconteceu.

**Consequência:** `registerStockMovement` verifica a propriedade ativa dentro
da mesma transação e antes de alterar o saldo. A reversão confirma a existência
da propriedade sem exigir que ela esteja ativa, não reativa entidades e não
altera `archivedAt`. Quem realiza a reversão agora deve ser um membro ativo
quando sua identidade é informada. O autor ou executor histórico do movimento
original pode estar desativado, pois ele não está iniciando a correção atual.

## 27. StockMovement e AuditLog são append-only

**Decisão:** operações normais somente acrescentam `StockMovement` e
`AuditLog`; elas não atualizam nem apagam esses registros.

**Por quê:** editar o passado silenciosamente enfraqueceria a auditoria e
dificultaria explicar como o saldo chegou ao valor atual.

**Consequência:** correções de estoque criam uma nova movimentação, um
`ADJUSTMENT` ou um `REVERSAL`, conforme o caso. Não devem ser criados services
genéricos de update ou delete para movimentos e logs. Nesta etapa a regra é de
domínio e documentação; não foi criado trigger complexo no PostgreSQL.

## 28. A propriedade é derivada da sessão

**Decisão:** nenhum fluxo protegido confia somente no `propertyId` enviado pelo
navegador ou armazenado em cookie.

**Por quê:** uma pessoa da Fazenda A poderia alterar manualmente uma requisição
para tentar acessar a Fazenda B.

**Consequência:** o fluxo obrigatório implementado na Etapa 2 é:

```text
session.user
    ↓
PropertyMember
    ↓
Property ativa autorizada
    ↓
Service
```

O cookie contém somente um ID candidato. `requireActivePropertyContext`
revalida usuário, propriedade ativa e `PropertyMember` no PostgreSQL antes de
entregar o contexto ao layout e aos Server Actions. Os services rurais deverão
receber esse mesmo contexto autorizado quando forem ligados às telas.

## 29. Números brasileiros são normalizados na entrada

**Decisão:** o domínio trabalha com valor decimal canônico, como `2.5`, e a
futura camada de entrada converte texto brasileiro, como `2,5`, antes de chamar
um service.

**Por quê:** vírgula e ponto têm significados diferentes dependendo do formato
de entrada. Essa diferença não deve chegar ambígua ao banco.

**Consequência:** formulários, API, WhatsApp ou uma IA futura devem validar e
normalizar o texto primeiro. A IA nunca enviará um valor textual não validado
diretamente ao PostgreSQL. Esta etapa não transforma os parsers atuais em
interpretadores universais.

## 30. Anotação local e estoque formam uma operação composta

**Decisão:** no Modo Completo, uma anotação que exige estoque só é publicada
depois que produto, quantidade e próximo saldo forem validados juntos.

**Por quê:** o usuário percebe a anotação e a mudança de estoque como uma única
ação. Salvar apenas uma das duas partes deixa o MVP inconsistente.

**Consequência:** o Context prepara as duas próximas listas e publica seus
estados no mesmo evento. Se a validação falhar, nenhum estado muda. Essa é uma
garantia da ponte local atual, não uma transação de banco; a futura API deverá
orquestrar a operação persistente em uma transação real.

## 31. Testes destrutivos usam um banco local exclusivo

**Decisão:** testes de integração que recriam o PostgreSQL usam somente um
banco local descartável cujo nome contém `test` como segmento explícito. Na execução da Etapa 1.2, foi
usado `agrozap_test`, derivado apenas em memória da configuração local.

**Por quê:** provar migrations desde zero e concorrência exige apagar e recriar
um banco. Usar o banco normal de desenvolvimento poderia destruir dados válidos
e transformar uma validação em incidente.

**Consequência:** antes de qualquer `DROP DATABASE`, o runner exige host
`localhost` ou `127.0.0.1`, porta validada (usando `5432` quando omitida), nome simples com letras, números ou
`_`, segmento `test`, diferença em relação ao banco de desenvolvimento e ausência na lista
protegida `agrozap`, `postgres`, `template0` e `template1`. O identificador só é
incluído no SQL depois dessa validação.

O processo de testes recebe um marcador interno e precisa usar como
`DATABASE_URL` exatamente o banco já aprovado pelo runner. Isso impede executar
o arquivo de domínio diretamente contra outra conexão. Parâmetros que tentem
trocar host, porta ou database são recusados, e controles do `dotenv` são
removidos dos subprocessos para impedir override pelo `.env`. Os oito testes de
segurança rodam antes de qualquer `DROP`. URLs completas são retiradas dos
logs, o `.env` não é sobrescrito e o banco normal nunca é usado como alternativa
silenciosa.

## 32. Regras críticas precisam de teste unitário e integração real

**Decisão:** manter os testes unitários leves com `node:test` e acrescentar uma
suíte de integração, também com `node:test` e `tsx`, que chama os services reais
e consulta o PostgreSQL.

**Por quê:** um teste unitário explica rapidamente uma regra isolada, mas não
prova migrations, constraints, transações, rollback ou duas operações
concorrentes. A integração prova o comportamento completo sem copiar a lógica
do service para o teste.

**Consequência:** `npm run test:stage1.1` cobre a unidade da fundação,
`npm run test:stage2` cobre autenticação e política de papéis,
`npm run test:integration` prepara o banco seguro e cobre os services reais, e
`npm run test:all` executa os três grupos. O runner aplica as migrations com
`prisma migrate deploy`, executa o seed duas vezes, compara as identidades entre
as execuções e usa fixtures próprias para os cenários de domínio.

A Etapa 1.2 terminou com 8 de 8 testes unitários e 25 de 25 testes de integração
aprovados; essa contagem histórica permanece inalterada. Depois da Etapa 2, a
suíte contém 8 testes unitários em `test:stage1.1`, 17 em `test:stage2` e 45
testes de integração, divididos em 37 cenários de domínio/banco e 8 guardas de
segurança. A validação final da Etapa 2 aprovou 25/25 testes unitários, 45/45 de
integração e 70/70 pelo agregador `test:all`.

A Etapa 2.1 acrescenta treze cenários PostgreSQL: nove de isolamento A×B e
quatro de regressão contra reparenting automático. A bateria final aprovou
58/58 testes de integração e 83/83 em `test:all`, mantendo 25/25 unitários,
além de `db:validate`, `db:generate`, typecheck, lint e build.

## 33. Auth.js Credentials com sessão JWT, sem adapter

**Decisão:** usar Auth.js v5 beta (`next-auth` `5.0.0-beta.32`) com provider
`Credentials`, estratégia de sessão `JWT` e `AUTH_SECRET` obrigatório com pelo
menos 32 caracteres. Não usar adapter nem criar tabelas paralelas de conta,
sessão ou token nesta etapa.

**Por quê:** o domínio já possui `User` e telefone único. O login necessário é
direto e controlado pelo AgroZap; introduzir outro modelo de identidade agora
duplicaria a fonte de verdade sem resolver uma necessidade atual.

**Consequência:** a migration
`20260807150000_stage_2_authentication` acrescenta somente
`User.passwordHash String?`. JWT e sessão carregam apenas o ID necessário do
usuário; dados de autorização nunca são congelados no token. Como a versão do
Auth.js é beta, upgrades devem revisar changelog e testes antes de atualizar.

## 34. Senhas usam bcrypt com limites explícitos

**Decisão:** gerar e comparar hashes com `bcryptjs` `3.0.3`, custo 12, aceitando
senhas de 10 a 128 caracteres e recusando também qualquer entrada que exceda o
limite seguro de 72 bytes do bcrypt.

**Por quê:** validar somente caracteres permitiria que duas entradas longas
fossem tratadas como iguais após truncamento silencioso. Um custo único também
evita hashes criados com parâmetros inconsistentes.

**Consequência:** somente `passwordHash` é persistido. Senhas em texto puro não
entram em banco, fixtures, commits ou documentação. Quando uma conta não existe
ou não possui hash, o login ainda executa uma comparação contra um hash bcrypt
aleatório de descarte do mesmo custo e devolve a mesma falha genérica. O script
`auth:dev-password` gera uma senha temporária aleatória, atua somente contra o
banco local chamado exatamente `agrozap`, bloqueia overrides de URL para
`host`, `hostaddr`, `database` e `dbname`, e a exibe uma única vez.

## 35. Toda sessão revalida o usuário atual no banco

**Decisão:** tratar o JWT como prova de sessão, não como fotografia permanente
da autorização. `getCurrentUser` usa o ID da sessão para buscar novamente um
`User` com `deactivatedAt = null`.

**Por quê:** uma pessoa desativada depois do login não deve conservar acesso
até o JWT expirar.

**Consequência:** layouts e actions protegidos usam `requireCurrentUser`. Nome,
papel, propriedade e capacidades atuais vêm do PostgreSQL, não de campos
confiados ao navegador ou mantidos indefinidamente no token.

## 36. O cookie de propriedade ativa é um ponteiro revalidado

**Decisão:** guardar o ID candidato em `agrozap_active_property` com
`HttpOnly`, `SameSite=Lax`, `Secure` em produção e `Path=/`.

**Por quê:** a seleção precisa sobreviver à navegação, mas um cookie pode ficar
obsoleto ou ser manipulado. Ele não prova que o usuário pertence à propriedade.

**Consequência:** `resolveActivePropertyContext` aceita o ID somente se usuário
e propriedade continuam ativos e o `PropertyMember` existe. Ausência ou falha
leva a `/propriedades`. O cliente recebe uma projeção do contexto para UX, sem
se tornar autoridade de autorização.

## 37. Papéis são traduzidos em capacidades centralizadas

**Decisão:** concentrar em `property-role-policy.ts` as capacidades
`READ_PROPERTY`, `CREATE_AREA`, `CREATE_PRODUCT`, `CREATE_RECORD`, `MOVE_STOCK`,
`MANAGE_TEAM`, `ADJUST_STOCK`, `REVERSE_STOCK` e `VIEW_AUDIT`.

**Por quê:** espalhar comparações como `role === "OWNER"` por páginas e actions
facilitaria divergências. Uma política central torna as permissões revisáveis e
testáveis.

**Consequência:** `OWNER` e `MANAGER` possuem todas as capacidades nesta etapa;
`EMPLOYEE` possui leitura, criação de registro e movimentação de estoque;
`VIEWER` possui somente leitura. Regras mais restritas da gestão de equipe são
avaliadas além da capacidade geral `MANAGE_TEAM`.

## 38. Gestão de equipe protege hierarquia, identidade e último OWNER

**Decisão:** permitir que `OWNER` administre todos os papéis e que `MANAGER`
administre apenas `EMPLOYEE` e `VIEWER`. Proibir autogerenciamento e qualquer
mudança que deixe a propriedade sem ao menos um `OWNER`.

**Por quê:** capacidade genérica para equipe não deve permitir escalada de
privilégio, autoexclusão acidental ou uma propriedade sem responsável máximo.

**Consequência:** adicionar membro, trocar papel e remover vínculo revalidam o
ator dentro de transação `Serializable`. A checagem de último proprietário e o
`AuditLog` participam da mesma transação, com retry limitado em conflitos. As
ações registradas são `PROPERTY_MEMBER_ADDED`,
`PROPERTY_MEMBER_ROLE_CHANGED` e `PROPERTY_MEMBER_REMOVED`.

## 39. O localStorage rural é isolado por propriedade

**Decisão:** salvar áreas, anotações e produtos em
`agrozap-mvp-data:<propertyId>`, mantendo `agrozap-settings` como preferência
visual local.

**Por quê:** depois que uma pessoa pode alternar propriedades, uma chave rural
global misturaria dados locais de escopos diferentes.

**Consequência:** a antiga chave `agrozap-mvp-data` é copiada no máximo uma vez
para a primeira propriedade aberta após a mudança. Um marcador guarda qual
propriedade recebeu a migração, e o legado não é apagado. Essa ponte não envia
áreas, anotações nem produtos ao PostgreSQL; importação ou descarte definitivo
pertence à Etapa 3. A separação por chave evita mistura na navegação normal,
mas `localStorage` continua compartilhado por todos os usuários do mesmo perfil
de navegador. Ele não é uma fronteira de confidencialidade em dispositivo
compartilhado, e esse risco residual precisa permanecer explícito.

## 40. Proxy e Context de cliente não são fronteiras de segurança

**Decisão:** usar `src/proxy.ts` para checagem otimista de login e
`PropertyAccessContext` para adaptar a interface, mas repetir toda decisão
sensível em layout, Server Action ou service no servidor.

**Por quê:** estado e código executados no navegador podem ser alterados. O JWT
também não contém participação ou capacidades atuais.

**Consequência:** esconder botão melhora a experiência, mas não concede nem
revoga permissão. Escritas de equipe já usam o contexto autenticado e a política
do servidor; futuras escritas rurais devem seguir a mesma regra na Etapa 3.

## 41. Mitigação temporal não substitui controles distribuídos de login

**Decisão:** reduzir enumeração temporal com uma comparação bcrypt de descarte
para telefone inexistente ou conta sem senha, mantendo rate limiting distribuído
e revogação versionada de JWT fora do escopo da Etapa 2.

**Por quê:** igualar o trabalho criptográfico elimina uma diferença simples
entre caminhos, mas limites coordenados entre várias instâncias e revogação
imediata após troca de senha exigem infraestrutura e política próprias.

**Consequência:** respostas de credenciais permanecem genéricas. A aplicação
deve adicionar rate limiting na camada de implantação antes de exposição ampla
e planejar uma versão de sessão ou credencial se precisar invalidar todos os
JWTs imediatamente após troca de senha. Enquanto isso, a consulta do `User`
ativo em cada contexto protegido já revoga o acesso de contas desativadas,
atendendo ao requisito desta etapa.

## 42. Property é a fronteira tenant nesta fase

**Decisão:** tratar cada `Property` como a fronteira operacional de isolamento
multi-tenant do AgroZap.

**Por quê:** propriedades de famílias ou empresas diferentes compartilham a
mesma aplicação e o mesmo banco. Um identificador conhecido não pode funcionar
como autorização para atravessar essa fronteira.

**Consequência:** toda funcionalidade tenant-scoped nova deve provar em testes
que um usuário operando na Property A não consegue ler, relacionar nem alterar
dados da Property B. Sessão autenticada, Property ativa revalidada,
autorização no service, `propertyId` nos dados e constraints do PostgreSQL são
camadas complementares, não alternativas.

## 43. Relações tenant-scoped usam oito FKs compostas

**Decisão:** a migration
`20260807180000_stage_2_1_multi_tenant_isolation` protege com FKs compostas as
relações abaixo:

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

**Por quê:** duas FKs independentes provariam apenas que a Property existe e
que a entidade relacionada existe. Elas não provariam que ambas pertencem ao
mesmo tenant. A referência composta exige a combinação `(propertyId, id)`.

**Consequência:** os modelos de destino possuem unicidade explícita em
`(propertyId, id)`. A migration é incremental, preserva dados válidos e deve
falhar diante de corrupção antiga; não pode mover, renomear ou apagar registros
para fabricar consistência. Migrations anteriores permanecem imutáveis.

As oito relações declaram `onUpdate: Restrict` no schema Prisma e
`ON UPDATE RESTRICT` no PostgreSQL, preservando suas ações `onDelete`. Assim,
uma mudança na chave composta referenciada não propaga automaticamente uma
nova `propertyId` às linhas dependentes.

## 44. User e atores históricos continuam globais

**Decisão:** manter `User` como identidade global e usar `PropertyMember` para
cada participação local. Manter também `createdByUserId`, `performedByUserId` e
`AuditLog.actorUserId` como referências ao `User` global.

**Por quê:** a mesma pessoa pode trabalhar legitimamente nas Properties A, B e
C. Além disso, remover uma membership atual não pode apagar nem invalidar a
autoria de um fato histórico.

**Consequência:** não existe FK permanente obrigando atores históricos a
continuarem `PropertyMember`. A membership é verificada no momento de uma nova
operação; as capabilities precisam ser aplicadas pelo boundary/service
autorizador correspondente. O registro histórico preserva a identidade global
depois disso.

`AuditLog.entityId` também não recebe FK composta: ele é polimórfico e seu
`entityType` pode apontar conceitualmente para tabelas diferentes. Services e
testes continuam responsáveis por manter esse par coerente com a Property do
log.

## 45. Organization e RLS foram deliberadamente adiadas

**Decisão:** não criar `Organization` e não habilitar PostgreSQL Row Level
Security na Etapa 2.1.

**Por quê:** uma `Organization` futura poderá agrupar várias Properties para
empresa, família, cobrança e administração central, mas essa necessidade ainda
não foi modelada. RLS exige um desenho consciente de conexão, contexto por
sessão/transação e integração com Prisma e pooling; uma ativação parcial daria
falsa sensação de segurança.

**Consequência:** Property continua sendo o tenant operacional. A proteção
atual usa autorização server-side, services, FKs/constraints e testes A×B. RLS
**não está implementado** e só poderá ser adotado em uma etapa própria.

## 46. Telefone e slug são identidades globais com semânticas diferentes

**Decisão:** manter `User.phone` globalmente único e tratar `Property.slug`
como identificador globalmente único da propriedade. `Property.name` não é uma
identidade e pode se repetir.

**Por quê:** telefone identifica a pessoa global que pode possuir várias
memberships. O slug identifica uma Property específica; duas fazendas podem
legitimamente se chamar “Fazenda Santa Maria”.

**Consequência:** nomes iguais não devem ser proibidos. Ao gerar slugs, uma
camada futura deverá desambiguá-los de forma estável sem redesenhar URLs nesta
etapa.

## 47. Services rurais precisam de capability e ator confiável antes da Etapa 3

**Decisão:** não expor os services rurais atuais diretamente por Server Action
ou API até que cada escrita derive um ator confiável no servidor e aplique a
capability adequada.

**Por quê:** os services já validam o escopo de IDs relacionados, mas ainda
recebem `propertyId` e atores como parâmetros internos e não aplicam todas as
capacidades da política da Etapa 2. Um ator nulo legítimo para operação interna
não pode virar bypass em um fluxo web.

**Consequência:** antes de iniciar a persistência rural da Etapa 3, a camada de
servidor deve revalidar sessão, Property ativa e `PropertyMember`, derivar
`actorUserId`/`propertyId`/papel, exigir `CREATE_AREA`, `CREATE_PRODUCT`,
`CREATE_RECORD`, `MOVE_STOCK`, `ADJUST_STOCK` ou `REVERSE_STOCK` conforme a
operação e cobrir negativas por papel. A Etapa 2.1 não iniciou a API rural.

## 48. propertyId tenant-scoped é identidade estrutural imutável

**Decisão:** tratar a `propertyId` de `Area`, `StockProduct`, `FarmRecord` e
`StockMovement` como parte da identidade estrutural da entidade e, portanto,
imutável após a criação. Uma eventual correção de tenant não será um update
comum nem um efeito cascata; precisará de uma operação administrativa
explícita, auditada e projetada especificamente para isso.

**Por quê:** mudar a Property dessas entidades altera a fronteira tenant do
dado e pode afetar aliases, registros, estoque, reversões e auditoria. Essa não
é a semântica de uma edição comum e não deve acontecer implicitamente porque
uma chave referenciada foi atualizada.

**Consequência:** as oito FKs compostas usam `ON UPDATE RESTRICT` como defesa
contra reparenting automático. Essa ação bloqueia a alteração da chave
referenciada quando existem dependentes, mas não torna `propertyId`
absolutamente imutável no PostgreSQL: uma entidade isolada ainda pode receber
um `UPDATE` direto, e SQL coordenado pode tentar trocar ao mesmo tempo a
`propertyId` e suas referências. A garantia também depende dos services e das
permissões do banco. Triggers, RLS e a operação administrativa de correção não
serão implementados na Etapa 2.1.
