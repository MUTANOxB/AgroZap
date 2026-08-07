# Roadmap do AgroZap

Este documento mostra a ordem planejada de evolução do AgroZap. A sequência
protege o MVP atual e evita ligar WhatsApp ou inteligência artificial antes de
existirem identidade, permissões, validações e histórico confiável.

## Como ler os status

- **Concluída:** o objetivo da etapa está disponível no fluxo principal.
- **Parcial:** uma parte funciona, mas ainda há limitações conhecidas.
- **Etapa atual:** está sendo preparada ou integrada agora.
- **Em validação:** a estrutura foi implementada, mas a bateria final ainda
  precisa confirmar o resultado completo.
- **Planejada:** ainda não foi implementada.

## ETAPA 0 — Interface MVP

**Status: parcial**

Já existe uma aplicação web responsiva com:

- painel Início;
- áreas cultivadas;
- anotações;
- estoque;
- Modo Simples e Modo Completo;
- dados de demonstração;
- persistência rural no `localStorage`, agora isolada por propriedade.

O MVP é funcional, mas áreas, anotações e produtos ainda ficam em um único
navegador, mesmo separados pela propriedade ativa. Algumas
partes do painel também usam dados de demonstração. Por isso, a etapa não é
considerada uma versão multiusuário concluída.

## ETAPA 1 — Banco + domínio + auditoria

**Status: concluída**

Entregas concluídas nesta fundação:

- PostgreSQL e Prisma 7.9;
- schema multipropriedade;
- usuários e `PropertyMember`;
- áreas e produtos com apelidos;
- `FarmRecord` para anotações persistentes;
- saldo e movimentações de estoque;
- auditoria;
- transações `Serializable`, verificação otimista e novas tentativas em
  conflitos de estoque;
- reversão de movimentações;
- migration inicial e seed de demonstração;
- validação das migrations, do seed e das regras críticas em PostgreSQL real;
- tipos TypeScript retirados progressivamente do Context;
- bloqueio de estoque negativo também no fluxo temporário do `localStorage`.

Limites conhecidos que pertencem às próximas etapas:

- ligar as páginas aos services por uma camada de API/Server;
- planejar como os dados existentes do navegador serão importados ou
  descartados com segurança.

Esses limites não reabrem a fundação da Etapa 1. Eles serão tratados nas
etapas de autenticação, API e migração do armazenamento local.

## ETAPA 1.1 — Endurecimento da fundação

**Status: concluída**

Entregas:

- geração automática do Prisma Client antes do build, sem exigir
  `DATABASE_URL` apenas para gerar ou validar;
- snapshots históricos dos nomes de produto e área em movimentações e
  anotações persistentes;
- migration incremental `20260807120000_stage_1_1_hardening`;
- novas operações restritas a usuários atuais ativos na propriedade;
- reversão histórica permitida mesmo após arquivamento do produto ou da área;
- snapshots da reversão copiados da movimentação original;
- regra append-only para `StockMovement` e `AuditLog`;
- anotação e estoque tratados como uma operação composta no MVP local;
- testes leves para as validações locais mais críticas;
- documentação do isolamento futuro por sessão e da normalização de `2,5`
  para `2.5` na camada de entrada.

A migration foi criada, aplicada desde um banco vazio e validada em PostgreSQL
real pela Etapa 1.2. Esta etapa não implementou autenticação, WhatsApp nem
inteligência artificial.

## ETAPA 1.1.1 — Bloqueio de propriedade arquivada

**Status: ajuste concluído**

O ajuste passou a bloquear uma nova movimentação quando a própria `Property`
está arquivada. Uma reversão histórica continua permitida, desde que o movimento
pertença à propriedade e quem faz a correção agora seja um membro ativo. A
integração real confirmou que o bloqueio faz rollback completo e que a reversão
não reativa propriedade, produto ou área.

## ETAPA 1.2 — Validação real com PostgreSQL

**Status: validação PostgreSQL concluída**

Entregas:

- banco local descartável `agrozap_test`, separado do desenvolvimento;
- preflight de guardas para host e porta locais, segmento `test` no nome,
  banco diferente do desenvolvimento, parâmetros sem override, lista de bancos
  protegidos, ambiente `dotenv` sanitizado e marcador interno do runner;
- logs sem URL completa nem credenciais;
- duas migrations aplicadas com `prisma migrate deploy` desde banco vazio;
- seed executado duas vezes, preservando identidades e sem duplicar os dados
  esperados;
- 8 de 8 testes unitários aprovados;
- 25 de 25 testes de integração aprovados, sendo 17 cenários de domínio/banco e
  8 cenários de segurança do runner;
- concorrência de retiradas e reversões validada sem saldo negativo nem
  duplicação efetiva;
- rollbacks, snapshots, usuários desativados, arquivamento, reversões,
  isolamento entre propriedades, aliases e `CHECK constraints` comprovados;
- correção da validação decimal de zero com `greaterThan(0)` e testes de
  regressão.

O banco normal `agrozap` não foi resetado pela suíte. A Etapa 1 está encerrada
com evidência real da fundação, sem iniciar autenticação, API, WhatsApp ou IA.

## ETAPA 2 — Autenticação + propriedade ativa + equipe + permissões

**Status: concluída**

Entregas:

- Auth.js v5 beta com provider `Credentials`, sessão `JWT` e
  `AUTH_SECRET` obrigatório;
- login por telefone brasileiro normalizado para `+55` e senha;
- hash com `bcryptjs`, custo 12, mínimo de 10 e máximo de 128 caracteres, com
  rejeição do limite de truncamento de 72 bytes do bcrypt;
- comparação com hash bcrypt aleatório de descarte para telefone inexistente
  ou conta ainda sem senha, reduzindo enumeração temporal simples;
- migration que adiciona apenas `User.passwordHash String?`, sem adapter nem
  tabelas paralelas de autenticação;
- revalidação do `User` ativo no PostgreSQL a cada contexto de sessão
  protegido;
- seleção e troca da propriedade ativa por cookie `HttpOnly`, `SameSite=Lax`,
  `Secure` em produção e `Path=/`;
- revalidação do cookie contra usuário, propriedade e `PropertyMember` ativos;
- administrar membros e papéis `OWNER`, `MANAGER`, `EMPLOYEE` e `VIEWER`;
- política central de capacidades para leitura, cadastros, registros, estoque,
  equipe e auditoria;
- proteção contra autogerenciamento, escalada por `MANAGER` e remoção ou
  rebaixamento do último `OWNER`;
- mutações de equipe e auditoria na mesma transação `Serializable`, com retry
  limitado em conflitos;
- rotas agrupadas para login, seleção de propriedade e páginas que exigem
  propriedade ativa;
- `PropertyAccessContext` como projeção de UX, sem substituir autorização no
  servidor;
- dados rurais locais isolados em `agrozap-mvp-data:<propertyId>`, com migração
  única e preservada da antiga chave global;
- script restrito ao PostgreSQL local chamado `agrozap`, sem overrides de host
  ou banco na URL, para gerar senha temporária de desenvolvimento.

A suíte validada ao final da Etapa 2 contém 8 testes unitários em
`test:stage1.1`, 17 em `test:stage2` e 45 testes de integração: 37 cenários de
domínio/banco e 8 guardas de segurança. Isso corresponde a 25/25 testes
unitários, 45/45 de integração e 70/70 pelo agregador `test:all`.

Esta etapa conclui identidade, propriedade ativa e gestão de equipe no
servidor. Ela não moveu áreas, anotações nem produtos da interface para o
PostgreSQL e não iniciou WhatsApp ou IA.

Riscos residuais deliberadamente fora do escopo: rate limiting distribuído do
login e revogação versionada de JWT após troca de senha. A revalidação do
`User` ativo permanece implementada e bloqueia contas desativadas no requisito
da Etapa 2.

## ETAPA 2.1 — Blindagem multi-tenant entre propriedades

**Status: concluída**

Nesta fase, **Property é a fronteira de isolamento tenant do AgroZap**. A regra
permanente para todas as funcionalidades novas é: um usuário operando na
Property A não pode ler, relacionar nem alterar dados da Property B. Conhecer
um ID de B nunca equivale a possuir autorização sobre ele.

A migration incremental
`20260807180000_stage_2_1_multi_tenant_isolation` acrescenta defesa relacional
sem reescrever migrations anteriores. O desenho usa chaves estrangeiras
compostas com `propertyId` e o ID relacionado para proteger oito vínculos:

1. `AreaAlias` → `Area` da mesma Property;
2. `ProductAlias` → `StockProduct` da mesma Property;
3. `FarmRecord` → `Area` da mesma Property;
4. `FarmRecord` → `StockProduct` da mesma Property;
5. `StockMovement` → `StockProduct` da mesma Property;
6. `StockMovement` → `Area` da mesma Property;
7. `StockMovement` → `FarmRecord` da mesma Property;
8. `StockMovement.reversesMovementId` → `StockMovement` da mesma Property.

Os modelos referenciados expõem a identidade composta `(propertyId, id)` para
que o PostgreSQL rejeite uma combinação A+B mesmo quando as duas FKs isoladas
seriam válidas. A migration deve preservar dados válidos e falhar claramente
se encontrar uma relação cruzada antiga; ela não move nem apaga dados para
escolher uma propriedade arbitrariamente.

A `propertyId` de `Area`, `StockProduct`, `FarmRecord` e `StockMovement` é
identidade estrutural e deve ser tratada como imutável após a criação. As oito
FKs compostas usam `ON UPDATE RESTRICT`, também declarado no schema Prisma,
para impedir reparenting automático quando uma chave referenciada possui
dependentes. Uma eventual correção futura de tenant deverá ser uma operação
administrativa explícita, auditada e desenhada especificamente para isso, não
um update comum ou efeito cascata.

`RESTRICT` não torna o campo absolutamente imutável no PostgreSQL: uma entidade
isolada ainda pode teoricamente receber `UPDATE` direto, e SQL coordenado pode
tentar alterar a `propertyId` junto das referências. A garantia também depende
dos services e das permissões. Triggers, RLS e essa operação administrativa não
foram implementados na Etapa 2.1.

`User` continua global e pode participar de várias propriedades por
`PropertyMember`. `createdByUserId`, `performedByUserId` e
`AuditLog.actorUserId` também continuam apontando para identidades globais: o
histórico não exige que o ator permaneça membro para sempre. Já
`AuditLog.entityId` é uma referência polimórfica acompanhada de `entityType` e
deliberadamente não recebe FK para uma única tabela; sua coerência permanece
responsabilidade do service e dos testes.

O fluxo de autoridade continua sendo sessão autenticada, `User` ativo,
Property candidata revalidada, `PropertyMember` atual e então
`actorUserId`/`propertyId`/papel derivados no servidor. O navegador não fornece
essas três informações como autoridade. A única exceção de entrada é o
`propertyId` candidato da tela de seleção, que só vira contexto depois da
revalidação.

Decisões explícitas desta etapa:

- `Organization` pode futuramente agrupar várias propriedades para empresa,
  família, cobrança ou administração central, mas foi deliberadamente adiada;
- PostgreSQL RLS **não foi implementado**; ele exige desenho próprio de
  conexão, sessão, transação e pooling antes de ser adotado;
- `User.phone` permanece globalmente único porque identifica uma pessoa
  global;
- `Property.slug` permanece um identificador globalmente único. Nomes de
  propriedades podem se repetir; slugs futuros devem receber desambiguação sem
  proibir duas propriedades chamadas, por exemplo, “Fazenda Santa Maria”;
- a separação por chave no `localStorage` evita mistura na navegação normal,
  mas não oferece confidencialidade entre usuários que compartilham o mesmo
  navegador e perfil. Esse risco residual permanece enquanto os cadastros
  rurais forem locais;
- os services rurais ainda não estão expostos por Server Actions ou API. Antes
  da Etapa 3, cada escrita deverá exigir a capability adequada e um ator
  confiável derivado no servidor; ator nulo não poderá virar um bypass web.

O baseline validado antes da Etapa 2.1 é: `test:stage1.1` 8/8,
`test:stage2` 17/17, 45/45 testes de integração, 25/25 unitários e 70/70 em
`test:all`. Com os treze cenários PostgreSQL adicionais — nove de isolamento e
quatro de regressão contra reparenting —, a validação final da Etapa 2.1
aprovou 58/58 testes de integração e 83/83 em `test:all`, mantendo 25/25
unitários. `db:validate`, `db:generate`, typecheck, lint e build também passaram.

## ETAPA 3 — API real e substituição do localStorage

**Status: planejada — próxima etapa recomendada**

Objetivo:

- criar Route Handlers, Server Actions ou outra camada de servidor clara;
- chamar os services sem expor o banco ao navegador;
- reutilizar a sessão, a propriedade ativa revalidada e as capacidades da
  Etapa 2 em toda escrita;
- fazer áreas, produtos e anotações usarem PostgreSQL;
- consultar movimentos e auditoria com paginação;
- manter o modo visual como preferência local quando fizer sentido;
- oferecer uma estratégia explícita para os dados já salvos no navegador.

Esta etapa termina quando atualizar duas sessões diferentes mostra o mesmo dado
da propriedade e o `localStorage` deixa de ser a fonte dos cadastros rurais.
Ela está apenas recomendada neste roadmap; não foi iniciada na Etapa 2 nem na
Etapa 2.1.

## ETAPA 4 — WhatsApp por texto e identificação por telefone

**Status: planejada**

Objetivo:

- conectar um provedor de WhatsApp escolhido conscientemente;
- receber mensagens por webhook;
- normalizar o telefone internacional;
- localizar usuário e propriedades permitidas;
- transformar a mensagem em uma proposta de operação, sem gravar diretamente.

O valor `WHATSAPP` no enum `RecordSource` apenas reserva a origem futura. Não
existe integração com WhatsApp hoje.

## ETAPA 5 — Confirmação de ações

**Status: planejada**

Objetivo:

- definir os estados e a validade de uma `PendingAction`;
- apresentar um resumo antes da execução;
- permitir confirmar, recusar ou expirar a proposta;
- executar somente services autorizados após a confirmação;
- auditar a proposta e o resultado.

A entidade `PendingAction` foi adiada para esta etapa para não fixar agora um
fluxo ainda inexistente.

## ETAPA 6 — Áudio e transcrição

**Status: planejada**

Objetivo:

- receber mensagens de áudio;
- armazená-las com política de privacidade definida;
- transcrever o conteúdo;
- enviar o texto ao mesmo fluxo seguro de proposta e confirmação.

Áudio não deve possuir um caminho especial que ignore permissões ou regras de
negócio.

## ETAPA 7 — Interpretação por inteligência artificial

**Status: planejada**

Objetivo:

- interpretar linguagem natural;
- usar nomes oficiais e apelidos de áreas e produtos;
- reconhecer ambiguidades e pedir esclarecimento;
- montar propostas estruturadas;
- nunca entregar acesso direto da IA ao PostgreSQL.

A IA poderá sugerir uma ação. A decisão final continuará passando por
validação, autorização, confirmação e service.

## ETAPA 8 — Alertas e notificações

**Status: planejada**

Possibilidades:

- estoque baixo;
- vencimento de produtos;
- tarefas e manutenções próximas;
- falhas ou ações aguardando confirmação.

Os canais e preferências serão definidos antes do envio para evitar excesso de
mensagens.

## ETAPA 9 — Novos módulos rurais

**Status: planejada**

Possibilidades futuras:

- financeiro;
- máquinas;
- manutenção;
- compras e fornecedores;
- safras e produtividade;
- relatórios e indicadores.

Esses módulos só devem ser adicionados quando o núcleo de propriedade,
usuários, registros, estoque e auditoria estiver estável.

## Por que esta ordem

```text
Interface funcional
        ↓
Banco e regras confiáveis
        ↓
Identidade e permissões
        ↓
API substitui armazenamento local
        ↓
Canal WhatsApp
        ↓
Confirmação
        ↓
Áudio e IA
```

Um canal externo aumenta o número de pessoas e situações que podem tentar
alterar dados. Por isso, banco, histórico, regras, identidade e confirmação
precisam vir antes da automação inteligente.
