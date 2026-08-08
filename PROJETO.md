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
- **PLANEJADO:** é uma direção futura e ainda não foi implementada.

### ATUAL — interface MVP

Hoje o AgroZap possui:

- painel Início com resumos e atalhos;
- cadastro e listagem de áreas cultivadas;
- cadastro e listagem de anotações;
- cadastro e acompanhamento de produtos do estoque;
- Modo Simples e Modo Completo;
- clima consultado por uma rota interna;
- dados de demonstração para facilitar o desenvolvimento;
- bloqueio de retirada quando o saldo local seria negativo;
- login real por telefone e senha;
- seleção e troca de propriedade ativa;
- equipe com papéis e capacidades revalidados no servidor.

As telas ainda guardam áreas, anotações e produtos no `localStorage` do
navegador por meio do `AgroAppContext`, em uma chave separada por Property.
Isso preserva o MVP durante a migração, mas tem limitações importantes: os
dados ficam naquele navegador, não são compartilhados entre usuários e ainda
não formam um histórico de banco. Em um dispositivo compartilhado,
`localStorage` também não é uma fronteira de confidencialidade entre contas do
mesmo perfil de navegador.

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

### EM CONSTRUÇÃO — boundary rural da Etapa 3A

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

Essa camada **ainda não é consumida pelas páginas rurais**. Portanto,
cadastrar algo pela interface continua alterando o `localStorage`, não o
PostgreSQL. Ter Server Actions e queries disponíveis não significa que a UI já
tenha mudado de fonte.

### PLANEJADO — experiência completa

Estão planejados para etapas futuras:

- Etapa 3B ligando as telas rurais ao boundary e ao PostgreSQL;
- Etapa 3C tratando legado local, comportamento entre sessões e histórico
  final, sem importação silenciosa;
- uso principal pelo WhatsApp, com identificação pelo telefone;
- confirmação de ações antes de alterar dados importantes;
- interpretação de texto e áudio por inteligência artificial;
- alertas, notificações e novos módulos de gestão.

Uma `Organization` poderá futuramente agrupar várias Properties para empresa,
família, cobrança ou administração central, mas foi deliberadamente adiada.
PostgreSQL RLS não foi implementado. Também não existe integração com WhatsApp,
chatbot, IA ou transcrição de áudio. A Etapa 3A está concluída; 3B e 3C
continuam planejadas.

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

Os cadastros rurais da interface ainda seguem a ponte local:

```text
Pessoa preenche uma tela
        ↓
Página chama o AgroAppContext
        ↓
Context atualiza os dados em memória
        ↓
Context salva no localStorage do navegador
        ↓
React atualiza as telas
```

O banco já atende autenticação, propriedade e equipe. O caminho rural local
ainda não chama os services persistentes. Em paralelo, a Etapa 3A já oferece o
caminho server-side que será consumido pela 3B:

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

## Como funcionará depois da integração da UI na Etapa 3B

```text
Tela ou canal autorizado
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
DTO serializável chega ao painel
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
registrou e Pedro executou. Nas actions WEB da 3A, `createdBy` é sempre o User
da sessão revalidada. `performedBy` pode chegar somente como ID candidato e
precisa ser um User ativo com membership ativa na mesma Property. Os
formulários rurais ainda precisam ser integrados na 3B para usar essa separação
na experiência real. Atores históricos continuam globais mesmo se a membership
atual for removida.

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
