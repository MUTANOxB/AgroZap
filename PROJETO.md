# AgroZap

## O que é o AgroZap

O AgroZap é um sistema de gestão rural pensado para funcionar como um
**caderno organizado da propriedade**. Ele reúne áreas cultivadas, anotações do
dia a dia e produtos do estoque em um lugar simples de consultar.

O princípio do projeto é:

> Simples para quem usa, muito organizado por baixo.

O produtor não deveria precisar entender banco de dados, integrações ou
inteligência artificial para registrar o que aconteceu no campo.

## Qual problema ele resolve

Muitas informações importantes ainda ficam espalhadas entre cadernos,
mensagens, memória dos funcionários e planilhas. Isso dificulta responder
perguntas como:

- quanto produto ainda existe no estoque;
- em qual área um serviço foi realizado;
- quem informou e quem executou uma atividade;
- qual era o saldo antes de uma retirada;
- por que um valor foi corrigido;
- o que aconteceu na propriedade em determinada data.

O AgroZap busca organizar essas informações sem tornar o uso complicado.

## Para quem é

O público principal é formado por produtores rurais, gestores e equipes de
propriedades pequenas e médias. A interface prioriza linguagem direta, uso no
celular e formulários que não exigem conhecimento técnico.

## Modo Simples e Modo Completo

O **Modo Simples** mostra poucos campos e ações diretas. Ele é indicado para
quem deseja fazer um registro rápido, como anotar um serviço ou cadastrar um
produto com nome, quantidade e unidade.

O **Modo Completo** apresenta campos adicionais, como safra, fornecedor,
validade, lote, dose e estoque mínimo. Os dois modos fazem parte do mesmo
sistema; a diferença é a quantidade de detalhes mostrada na tela.

## Estado do projeto

As palavras abaixo são usadas em toda a documentação:

- **ATUAL:** já funciona na interface usada pelo produtor.
- **EM CONSTRUÇÃO:** a fundação existe no código, mas o fluxo ainda não está
  completo para uso pelas telas.
- **EM REVISÃO:** a implementação existe, mas a validação final ainda precisa
  confirmar a entrega.
- **PLANEJADO:** é uma direção futura e ainda não foi implementada.

### ATUAL — interface MVP

Hoje o AgroZap possui:

- painel Início com resumos e atalhos;
- cadastro e listagem de áreas cultivadas;
- cadastro e listagem de anotações;
- cadastro e acompanhamento de produtos do estoque;
- Modo Simples e Modo Completo;
- clima consultado por uma rota interna;
- tarefas de demonstração no painel enquanto esse domínio ainda não existe;
- bloqueio persistente de retirada quando o saldo do banco seria negativo;
- login real por telefone e senha;
- seleção e troca de propriedade ativa;
- equipe com papéis e capacidades revalidados no servidor.

Na implementação da Etapa 3B, as telas de áreas, anotações, estoque e o resumo
rural do dashboard leem dados da Property ativa no PostgreSQL. Os formulários
chamam as Server Actions seguras da 3A e, depois de uma gravação bem-sucedida,
releem o banco. Em Anotações, uma criação feita numa página histórica substitui
a URL por `/registros`, voltando aos itens mais recentes. A Etapa 3B foi
aprovada e commitada no SHA `d99af2d563a0f3eb2f7dc1599404cf0565d3384b`, com
baseline validado de 142/142 testes.

O `AgroAppContext` deixou de guardar cadastros rurais. Ele mantém somente a
preferência `modoUso`, salva em `agrozap-settings`. As chaves antigas
`agrozap-mvp-data`, `agrozap-mvp-data:<propertyId>` e o marcador de migração
continuam fisicamente intactos, mas não são lidos, mesclados, apagados nem
importados durante o uso normal. O tratamento explícito desse legado pertence
à Etapa 3C.

### ATUAL — identidade, banco, domínio e auditoria

A fundação para a próxima versão já foi criada com PostgreSQL e Prisma. Ela
inclui modelos para:

- propriedades;
- usuários e participação de usuários em propriedades;
- áreas e apelidos de áreas;
- produtos e apelidos de produtos;
- movimentações de estoque;
- anotações persistentes, chamadas `FarmRecord` no código;
- auditoria das operações importantes.

Também existem services com regras para criar áreas, produtos, anotações e
movimentações. As movimentações do banco validam o saldo, registram o antes e
o depois, criam auditoria e usam transação para evitar gravações pela metade.

Nesta fase, **Property é a fronteira de isolamento tenant do AgroZap**. O
PostgreSQL protege com oito FKs compostas as relações tenant-scoped entre
aliases, áreas, produtos, registros, movimentos e reversões. Assim, uma relação
da Property A não pode apontar para uma entidade da Property B apenas porque os
dois IDs existem. Essa blindagem foi adicionada pela migration
`20260807180000_stage_2_1_multi_tenant_isolation`.

A `propertyId` de áreas, produtos, registros e movimentos é identidade
estrutural e deve permanecer imutável após a criação. As oito FKs compostas
usam `ON UPDATE RESTRICT` para não reparentar dependentes automaticamente. Uma
eventual correção futura de tenant deverá ser uma operação administrativa
explícita, auditada e projetada especificamente para isso.

Essa ação referencial não torna o campo absolutamente imutável: linhas
isoladas e SQL que altere coordenadamente as referências ainda exigem proteção
na arquitetura dos services e nas permissões. Triggers e RLS não foram
implementados nesta etapa.

`User` continua global e pode participar de várias propriedades por
`PropertyMember`. Telefone continua globalmente único. `Property.slug` também
é um identificador global, enquanto nomes legíveis de propriedades podem se
repetir.

### ATUAL — boundary rural da Etapa 3A

A Etapa 3 foi iniciada. A subetapa 3A concluiu e validou a camada server-side
rural. Ela acrescenta:

- Server Actions para áreas, produtos, `FarmRecord`, movimentos, ajustes,
  reversões e a operação combinada registro + estoque;
- queries server-only para áreas e produtos ativos, além de registros,
  movimentos e auditoria paginados;
- autorização central por capability;
- releitura da membership, do papel e do User sob lock na mesma transação das
  mutações WEB, mediante marcador interno exato e obrigatório; marcador
  ausente (`undefined`) ou forjado é recusado, evitando tanto bypass quanto a
  confirmação de uma capability revogada em paralelo;
- `propertyId`, `createdByUserId` e origem `WEB` derivados no servidor;
- validação de IDs candidatos e rejeição de campos de autoridade enviados pelo
  navegador;
- DTOs serializáveis, com `Decimal` como string e datas em formato ISO;
- parsing determinístico de números brasileiros e datas;
- consistência semântica entre `FarmRecord` e novas `StockMovement`
  vinculadas, sem impedir a reversão compensatória de legado incompatível;
- transação atômica para criar um registro junto com uma movimentação;
- respostas de erro seguras, sem detalhes de Prisma ou PostgreSQL.

### ATUAL — interface rural da Etapa 3B

As páginas rurais agora consomem essa camada. A leitura começa em uma Server
Page, passa por uma query server-only tenant-scoped e entrega somente DTOs
serializáveis ao Client Component. A escrita volta pela Server Action, que
deriva Property, ator e origem no servidor, e termina com `router.refresh()` ou
com retorno à primeira página do histórico para reler o PostgreSQL.

Talhões cadastra `Area`; Estoque cadastra `StockProduct` e mostra o saldo
persistido; Anotações cadastra `FarmRecord` e usa a operação atômica da 3A
quando o mesmo registro também movimenta estoque. A quantidade estruturada do
registro é independente da quantidade movimentada do produto. O dashboard usa
contagens, registros recentes e produtos da Property ativa no PostgreSQL.
Somente tarefas, cujo domínio persistente ainda não existe, e a integração
independente de clima ficam fora desse conjunto rural persistente.

### EM REVISÃO — edição operacional da Etapa 3B.1

A Etapa 3B.1 acrescenta edição auditável de áreas e dos metadados de produtos.
O formulário cadastral de produto não altera `StockProduct.quantity`: o saldo
só muda por uma operação explícita `ADJUSTMENT`, que calcula a diferença no
servidor e preserva movimento, auditoria e atualização do produto na mesma
transação. `EDIT_AREA` e `EDIT_PRODUCT` ficam restritas a OWNER e MANAGER, assim
como `ADJUST_STOCK`; EMPLOYEE e VIEWER não recebem essas ações na interface e
continuam protegidos pelo servidor.

A validação da implementação em revisão aprovou Stage 3B.1 12/12, integração
92/92 e `test:all` 164/164, além de schema e geração Prisma válidos.

### PLANEJADO — experiência completa

Estão planejados para etapas futuras:

- Etapa 3C tratando legado local, comportamento entre sessões e histórico
  final, sem importação silenciosa;
- uso principal pelo WhatsApp, com identificação pelo telefone;
- confirmação de ações antes de alterar dados importantes;
- interpretação de texto e áudio por inteligência artificial;
- alertas, notificações e novos módulos de gestão.

Uma `Organization` poderá futuramente agrupar várias Properties para empresa,
família, cobrança ou administração central, mas foi deliberadamente adiada.
PostgreSQL RLS não foi implementado. Também não existe integração com WhatsApp,
chatbot, IA ou transcrição de áudio. As Etapas 3A e 3B estão concluídas, a 3B.1
está em revisão e a 3C continua pendente. Isso não significa que a Etapa 3
inteira esteja concluída.

## Como os dados circulam hoje

Identidade, propriedade ativa e equipe seguem o caminho server-side:

```text
Pessoa autentica e escolhe uma propriedade
        ↓
Servidor revalida User + Property + PropertyMember
        ↓
Servidor deriva actorUserId, propertyId e capacidades
        ↓
Service usa Prisma e PostgreSQL
```

Os cadastros rurais da interface seguem o boundary da 3A:

```text
Server Page resolve a Property ativa
        ↓
query server-only exige READ_PROPERTY
        ↓
DTO serializável chega ao Client Component
        ↓
Pessoa envia o formulário para uma Server Action
        ↓
Action deriva Property + ator + WEB e chama o service
        ↓
PostgreSQL confirma a operação
        ↓
router.refresh() faz a Server Page reler o banco
```

O PostgreSQL atende autenticação, propriedade, equipe e os dados rurais das
quatro telas da 3B. O navegador mantém apenas estado temporário de formulário,
pending, erro e seleção, além da preferência visual `modoUso`.

```text
Server Action ou query rural
        ↓
requireActivePropertyContext()
        ↓
capability + propertyId/actorUserId derivados no servidor
        ↓
normalização e validação dos IDs candidatos
        ↓
service rural + Prisma + PostgreSQL
        ↓
DTO serializável ou erro seguro
```

## Como funciona a integração da UI na Etapa 3B

```text
Server Page ou Client Component autorizado
        ↓
Boundary server-side identifica propriedade e usuário
        ↓
Boundary normaliza a entrada e exige a capability
        ↓
Service valida relações e regras de negócio
        ↓
Prisma executa uma transação
        ↓
PostgreSQL salva dado, histórico e auditoria
        ↓
DTO serializável chega ao painel e `router.refresh()` relê o estado confirmado
```

As leituras paginadas usam cursor vinculado à Property e ao tipo de histórico.
`FarmRecord` e `StockMovement` são ordenados por `occurredAt` e `id`; auditoria
usa `createdAt` e `id`. A consulta busca somente o limite necessário no
PostgreSQL, em vez de carregar o histórico inteiro no navegador.

O painel continuará sendo a forma visual de cadastrar, revisar e consultar as
informações. No futuro, o WhatsApp poderá ser o meio mais rápido para registrar
uma atividade, mas não substituirá a organização e a consulta pelo painel.

## Segurança por confirmação

Uma mensagem futura como “Pedro pegou 3 litros do defensivo” não deverá ser
gravada diretamente no banco por uma IA. O sistema deverá:

1. identificar quem enviou a mensagem e a qual propriedade pertence;
2. interpretar a intenção;
3. localizar área, produto e pessoas envolvidas;
4. validar permissão e saldo;
5. mostrar uma ação pendente para confirmação;
6. somente depois executar o service e registrar a auditoria.

Esse fluxo é **PLANEJADO**. A entidade de ação pendente também foi adiada para
a etapa em que os estados de confirmação forem definidos.

## Quem registrou e quem executou

O banco foi preparado para manter duas identidades:

- `createdBy`: quem informou, confirmou ou originou o registro;
- `performedBy`: quem realizou a atividade no campo.

Por exemplo, João pode informar que Pedro retirou um produto. Nesse caso, João
registrou e Pedro executou. Nas actions WEB, `createdBy` é sempre o User da
sessão revalidada. `performedBy` pode chegar somente como ID candidato e precisa
ser um User ativo com membership ativa na mesma Property. A interface atual da
3B mantém `responsibleName` como texto histórico e não inventa
`performedByUserId` a partir dele; enquanto não houver seleção segura de membro,
esse vínculo permanece `null`. Atores históricos continuam globais mesmo se a
membership atual for removida.

## Histórico das operações

O objetivo do banco é guardar o histórico completo. Uma tela poderá mostrar
dez itens por página, mas isso não deve apagar os demais registros.

Movimentações importantes não serão corrigidas pela substituição silenciosa do
passado. Para corrigir uma saída errada de 3 litros para 2 litros, o caminho
será:

1. criar uma reversão da saída de 3 litros;
2. registrar uma nova saída correta de 2 litros;
3. manter os três registros relacionados e auditáveis.

Assim, o sistema preserva o que aconteceu e também mostra como foi corrigido.

Quando um movimento novo aponta para um `FarmRecord`, produto e área precisam
ser exatamente os mesmos, inclusive quando a área é `null`; um registro sem
produto não pode receber movimento. A consistência semântica `FarmRecord` ↔
`StockMovement` é obrigatória para novas movimentações. Reversões podem
espelhar vínculos históricos legados para preservar a capacidade de correção
compensatória, sem reescrever o movimento ou o registro antigo. Quando registro
e estoque representam uma única ação do usuário, a orquestração da 3A confirma
ambos e suas auditorias na mesma transação `Serializable`, ou desfaz tudo.

## Regra de produto

O AgroZap deve continuar fácil de usar mesmo quando a arquitetura interna ficar
mais robusta. Banco, auditoria, permissões e IA existem para proteger e
organizar o trabalho do produtor, não para aumentar a quantidade de passos na
rotina.
