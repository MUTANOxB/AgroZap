# Roadmap do AgroZap

Este documento mostra a ordem planejada de evolução do AgroZap. A sequência
protege o MVP atual e evita ligar WhatsApp ou inteligência artificial antes de
existirem identidade, permissões, validações e histórico confiável.

## Como ler os status

- **Concluída:** o objetivo da etapa está disponível no fluxo principal.
- **Parcial:** uma parte funciona, mas ainda há limitações conhecidas.
- **Etapa atual:** está sendo preparada ou integrada agora.
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

A suíte implementada contém 8 testes unitários da Etapa 1, 16 testes unitários
da Etapa 2 e 45 testes de integração: 37 cenários de domínio/banco e 8 guardas
de segurança. A validação final aprovou 24/24 testes unitários, 45/45 de
integração e 69/69 pelo agregador `test:all`.

Esta etapa conclui identidade, propriedade ativa e gestão de equipe no
servidor. Ela não moveu áreas, anotações nem produtos da interface para o
PostgreSQL e não iniciou WhatsApp ou IA.

Riscos residuais deliberadamente fora do escopo: rate limiting distribuído do
login e revogação versionada de JWT após troca de senha. A revalidação do
`User` ativo permanece implementada e bloqueia contas desativadas no requisito
da Etapa 2.

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
Ela está apenas recomendada neste roadmap; não foi iniciada na Etapa 2.

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
