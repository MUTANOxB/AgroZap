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
- persistência no `localStorage`.

O MVP é funcional, mas os dados ainda ficam em um único navegador. Algumas
partes do painel também usam dados de demonstração. Por isso, a etapa não é
considerada uma versão multiusuário concluída.

## ETAPA 1 — Banco, domínio e auditoria

**Status: etapa atual — fundação técnica implementada, integração pendente**

Entregas já preparadas:

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
- tipos TypeScript retirados progressivamente do Context;
- bloqueio de estoque negativo também no fluxo temporário do `localStorage`.

Ainda falta para encerrar esta etapa de ponta a ponta:

- configurar um PostgreSQL real em cada ambiente;
- ligar as páginas aos services por uma camada de API/Server;
- definir testes automatizados para as regras críticas;
- planejar como os dados existentes do navegador serão importados ou
  descartados com segurança.

## ETAPA 2 — Autenticação, usuários e equipe

**Status: planejada**

Objetivo:

- implementar login;
- identificar o usuário atual;
- selecionar a propriedade ativa;
- administrar membros e papéis `OWNER`, `MANAGER`, `EMPLOYEE` e `VIEWER`;
- aplicar autorização nas operações do servidor.

O schema já representa os papéis, mas isso ainda não é um sistema de login nem
uma política completa de permissões.

## ETAPA 3 — API real e substituição do localStorage

**Status: planejada**

Objetivo:

- criar Route Handlers, Server Actions ou outra camada de servidor clara;
- chamar os services sem expor o banco ao navegador;
- fazer áreas, produtos e anotações usarem PostgreSQL;
- consultar movimentos e auditoria com paginação;
- manter o modo visual como preferência local quando fizer sentido;
- oferecer uma estratégia explícita para os dados já salvos no navegador.

Esta etapa termina quando atualizar duas sessões diferentes mostra o mesmo dado
da propriedade e o `localStorage` deixa de ser a fonte dos cadastros rurais.

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
