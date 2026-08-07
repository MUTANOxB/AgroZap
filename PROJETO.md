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
- bloqueio de retirada quando o saldo local seria negativo.

As telas ainda guardam áreas, anotações e produtos no `localStorage` do
navegador por meio do `AgroAppContext`. Isso preserva o MVP durante a migração,
mas tem limitações importantes: os dados ficam naquele navegador, não são
compartilhados entre usuários e ainda não formam um histórico de banco.

### EM CONSTRUÇÃO — banco, domínio e auditoria

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

Essa fundação **ainda não está conectada às páginas por uma API ou Server
Action**. Portanto, cadastrar algo pela interface ainda altera o
`localStorage`, não o PostgreSQL. Ter o schema e os services prontos não
significa que o banco já esteja sendo usado pelas telas.

### PLANEJADO — experiência completa

Estão planejados para etapas futuras:

- login e identificação segura do usuário;
- seleção e gestão de múltiplas propriedades;
- vários funcionários por propriedade, com papéis e permissões;
- API real ligando as telas aos services e ao PostgreSQL;
- migração assistida dos dados locais;
- uso principal pelo WhatsApp, com identificação pelo telefone;
- confirmação de ações antes de alterar dados importantes;
- interpretação de texto e áudio por inteligência artificial;
- alertas, notificações e novos módulos de gestão.

Não existe integração com WhatsApp, chatbot, IA, transcrição de áudio ou
autenticação nesta etapa.

## Como os dados circulam hoje

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

O banco possui sua própria fundação, mas esse caminho ainda não é chamado pela
interface.

## Como deverá funcionar depois da integração

```text
Tela ou canal autorizado
        ↓
API/Server identifica propriedade e usuário
        ↓
Service valida a regra de negócio
        ↓
Prisma executa uma transação
        ↓
PostgreSQL salva dado, histórico e auditoria
        ↓
Painel consulta e mostra o resultado
```

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
registrou e Pedro executou. Essa separação existe na fundação do banco, mas
ainda depende de autenticação e da integração com as telas para funcionar na
experiência real.

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

## Regra de produto

O AgroZap deve continuar fácil de usar mesmo quando a arquitetura interna ficar
mais robusta. Banco, auditoria, permissões e IA existem para proteger e
organizar o trabalho do produtor, não para aumentar a quantidade de passos na
rotina.
