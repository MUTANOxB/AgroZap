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
`EMPLOYEE` e `VIEWER`. Os services atuais verificam a participação, mas login e
regras detalhadas para cada papel ainda serão implementados.

## 6. Telefone em formato internacional

**Decisão:** reservar um telefone único com até 16 caracteres, preparado para
valores como `+5564999999999`.

**Por quê:** futuramente o número poderá ajudar a identificar o usuário no
WhatsApp.

**Consequência:** a normalização e a confirmação do telefone deverão acontecer
no cadastro futuro. O schema sozinho não autentica a pessoa e não significa
que o WhatsApp esteja conectado.

## 7. createdBy e performedBy são identidades diferentes

**Decisão:** movimentos e anotações podem guardar quem criou o registro e quem
executou a atividade.

**Por quê:** em “João informou que Pedro retirou 3 litros”, João é a origem do
registro e Pedro executou a retirada. Usar um único campo perderia essa
informação.

**Consequência:** `performedBy` pode ficar vazio quando não se aplica. Os campos
de usuário também aceitam ausência temporária para registros de sistema e para
a fase sem login; depois da autenticação, os fluxos humanos deverão preencher
`createdBy` sempre que houver um usuário identificado.

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

**Por quê:** ainda não existem autenticação, WhatsApp, IA nem contrato de
confirmação. Criar a tabela agora exigiria adivinhar estados, validade,
reprocessamento e regras de segurança.

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
sua autoria de registros anteriores. A autenticação e as permissões por papel
continuam para a próxima etapa.

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

## 28. A propriedade futura será derivada da sessão

**Decisão:** uma futura API nunca confiará somente no `propertyId` enviado pelo
navegador.

**Por quê:** uma pessoa da Fazenda A poderia alterar manualmente uma requisição
para tentar acessar a Fazenda B.

**Consequência:** após a autenticação, o fluxo obrigatório será:

```text
session.user
    ↓
PropertyMember
    ↓
Property ativa autorizada
    ↓
Service
```

O service receberá uma propriedade validada contra a identidade autenticada.
Esta regra está formalizada agora, mas sessão, login e autorização ainda não
foram implementados.

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
`localhost` ou `127.0.0.1`, porta explícita, nome simples com letras, números ou
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

**Consequência:** `npm run test:stage1.1` cobre as regras unitárias,
`npm run test:integration` prepara o banco seguro e cobre a fundação real, e
`npm run test:all` executa os dois grupos. O runner aplica as migrations com
`prisma migrate deploy`, executa o seed duas vezes, compara as identidades entre
as execuções e usa fixtures próprias para os cenários de domínio.

A Etapa 1.2 terminou com 8 de 8 testes unitários e 25 de 25 testes de integração
aprovados. Entre as evidências estão saldo e auditoria atômicos, rollback,
retirada e reversão concorrentes, snapshots, arquivamento, isolamento entre
propriedades, aliases e `CHECK constraints` do PostgreSQL.
