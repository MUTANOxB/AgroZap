# Mapa do código do AgroZap

Este documento é um guia simples para estudar o projeto. Você não precisa
entender tudo de uma vez. A ideia é saber onde cada parte está e acompanhar o
caminho dos dados aos poucos.

> **Importante:** existem dois caminhos de dados durante a migração. As telas
> ainda usam Context e `localStorage`. O schema Prisma e os services formam a
> nova base do servidor, mas ainda não são chamados pelas páginas.

### Visão rápida dos dois caminhos

**ATUAL — usado pela interface:**

```text
Página client
    ↓
AgroAppContext
    ↓
localStorage do navegador
    ↓
React atualiza as páginas
```

**EM CONSTRUÇÃO — fundação do servidor:**

```text
Página
    ↓
API/Server ainda não criada
    ↓
Service com regra de negócio
    ↓
Prisma
    ↓
PostgreSQL
```

O segundo fluxo descreve o destino da arquitetura. Não significa que um
cadastro feito hoje na tela já esteja chegando ao PostgreSQL.

## 1. Estrutura geral do projeto

As pastas mais importantes para começar são:

```text
AgroZap/
├── docs/                 Documentação, decisões e histórico
├── prisma/
│   ├── schema.prisma     Modelos e relações do banco
│   ├── migrations/       Histórico da estrutura do PostgreSQL
│   └── seed.ts           Dados fictícios para desenvolvimento
├── public/
│   └── brand/            Arquivos da marca AgroZap
├── src/
│   ├── app/              Páginas, layout e estilos gerais
│   ├── components/       Partes visuais reutilizáveis
│   ├── context/          Ponte temporária com o localStorage
│   ├── data/             Dados de demonstração da interface
│   ├── generated/prisma/ Prisma Client gerado automaticamente
│   ├── hooks/            Lógicas reutilizáveis dos componentes
│   ├── lib/              Conexão Prisma e funções auxiliares
│   ├── services/         Regras de negócio do novo servidor
│   └── types/            Tipos temporários usados pelas telas
├── .env.example          Exemplo sem credenciais reais
├── prisma.config.ts      Configuração de schema, migration e seed
├── package.json          Dependências e comandos do projeto
└── .next/                Arquivos gerados automaticamente pelo Next.js
```

As pastas `.next` e `src/generated/prisma` são geradas automaticamente. Não
devem ser editadas à mão.

## 2. Para que serve `src/app`

A pasta `src/app` organiza as páginas do sistema usando o sistema de rotas do
Next.js.

Cada pasta com um arquivo `page.tsx` representa uma página:

```text
src/app/dashboard/page.tsx  → /dashboard
src/app/talhoes/page.tsx    → /talhoes
src/app/registros/page.tsx  → /registros
src/app/estoque/page.tsx    → /estoque
```

Outros arquivos importantes:

- `src/app/layout.tsx`: envolve todas as páginas com o contexto e o layout.
- `src/app/page.tsx`: redireciona a página inicial para `/dashboard`.
- `src/app/globals.css`: contém estilos gerais usados pelo sistema inteiro.
- `src/app/api/clima/route.ts`: rota interna que consulta o clima real.

### Onde fica a identidade visual

O arquivo `src/app/globals.css` também funciona como o pequeno design system
do AgroZap. Ele reúne:

- cores principais;
- fundo da aplicação;
- bordas;
- sombras;
- aparência dos cards;
- botões principais e secundários;
- inputs, selects e textareas;
- estados de foco e hover.

O fundo usa somente CSS. Ele combina cores claras com curvas discretas
inspiradas em mapas topográficos, sem carregar uma imagem externa.

A nova identidade usa como referência o símbolo do balão de conversa com
linhas de campo formando um “Z”. Os arquivos preparados para o site ficam em:

```text
public/brand/agrozap-symbol-64.png
public/brand/agrozap-symbol-192.png
public/brand/agrozap-symbol-512.png
```

O símbolo aparece no menu e também é usado como ícone do navegador. O menu
combina o símbolo com o nome AgroZap, destacando “Zap” em verde vivo.

A fonte principal é Manrope. Ela é configurada em `src/app/layout.tsx` usando
o recurso de fontes do Next.js e aplicada ao projeto por uma variável CSS.

As principais classes reutilizáveis são:

- `ag-card`: aparência padrão dos cards;
- `ag-card-interactive`: hover suave para cards clicáveis;
- `ag-form-section`: caixa principal dos formulários;
- `ag-detail-group`: bloco de campos do Modo Completo;
- `ag-button-primary`: botão principal;
- `ag-button-secondary`: botão secundário;
- `ag-app-background`: fundo da área de conteúdo.

Essas classes evitam copiar a mesma sombra, borda e cor em muitos arquivos.
Quando o visual precisar mudar novamente, boa parte da alteração poderá ser
feita em `globals.css`.

Um arquivo `page.tsx` normalmente reúne o título da tela, o formulário e a
lista de itens cadastrados.

## 3. Para que serve `src/components`

Componentes são partes visuais que podem ser reutilizadas.

O arquivo `src/components/app-shell.tsx` cria a estrutura principal do
AgroZap:

- nome do sistema;
- menu de navegação;
- menu adaptado para celular;
- seletor de Modo Simples e Modo Completo;
- espaço onde cada página aparece.

A pasta `src/components/dashboard` contém partes menores da tela Início, como:

- cards de resumo;
- cards compactos do Modo Simples;
- painel de atividades;
- resumo do estoque;
- previsão do tempo;
- tarefas;
- ícones.

Separar componentes evita repetir o mesmo código e deixa as páginas menores.
Os cards desses componentes usam as mesmas classes globais das telas Área
cultivada, Anotações e Estoque. Isso mantém a identidade visual consistente.

## 4. Para que serve `src/context`

O principal arquivo dessa pasta é:

`src/context/AgroAppContext.tsx`

O Context funciona como uma memória compartilhada do aplicativo. Ele permite
que páginas diferentes usem os mesmos dados.

Por exemplo:

- Área cultivada adiciona uma área.
- Anotações consegue usar essa área como opção.
- Estoque adiciona produtos.
- Início consegue contar produtos, áreas e anotações.

O contexto guarda:

- `areas`: áreas cadastradas;
- `anotacoes`: registros da propriedade;
- `produtos`: produtos do estoque;
- `modoUso`: modo `"simples"` ou `"completo"`;
- funções para adicionar e atualizar dados;
- `adicionarAnotacaoComMovimentacao`: valida e publica uma anotação junto com
  sua mudança local de estoque;
- `isLoaded`: informa quando os dados do navegador terminaram de carregar;
- `isModoCompleto`: forma curta de saber se o modo atual é completo.

O hook `useAgroApp()` permite que uma página acesse tudo isso.

## 5. Para que servem as telas

### Início

Arquivo: `src/app/dashboard/page.tsx`

Apresenta um resumo da propriedade.

No Modo Simples, destaca ações rápidas e alertas importantes. No Modo
Simples, também apresenta clima, até três anotações recentes e até três
vencimentos em cards compactos. Essas versões mostram só o necessário para a
tela continuar útil sem ficar carregada.

No Modo Completo, aparecem os painéis maiores de atividades, clima, estoque e
tarefas, com mais informações visíveis ao mesmo tempo.

Os números dos cards são calculados com os dados do contexto.

O componente `src/components/dashboard/SimpleDashboardDetails.tsx` reúne os
três cards compactos. Ele recebe dados por props, limita as listas e organiza:

- clima compacto;
- últimas anotações;
- próximos vencimentos.

O clima vem da rota interna `/api/clima`. Os vencimentos ainda usam dados de
demonstração de `src/data/dashboardMock.ts`. As anotações vêm do
`AgroAppContext`.

### Como o clima real funciona

Os arquivos principais são:

- `src/app/api/clima/route.ts`: consulta a Open-Meteo e prepara a resposta;
- `src/hooks/useClima.ts`: pede os dados para `/api/clima`;
- `src/types/clima.ts`: descreve o formato dos dados;
- `src/components/dashboard/WeatherCard.tsx`: card detalhado;
- `src/components/dashboard/SimpleDashboardDetails.tsx`: card compacto.

O fluxo é:

```text
Card de clima
    ↓
useClima usa fetch("/api/clima")
    ↓
/api/clima procura a latitude e longitude da cidade
    ↓
/api/clima consulta a previsão na Open-Meteo
    ↓
A rota devolve um JSON simples
    ↓
O card mostra os dados reais
```

O frontend chama `/api/clima` em vez de chamar a Open-Meteo diretamente para
que a tradução dos códigos, o formato dos dados, os erros e o cache fiquem
centralizados em um só lugar.

A localização padrão é Rio Verde, GO. Para testar outra cidade no futuro, a
rota aceita parâmetros como:

```text
/api/clima?cidade=Jataí&estado=GO
```

Hoje, os cards usam a localização padrão. Para tornar a cidade configurável na
interface, será necessário passar esses parâmetros no `fetch` do
`useClima.ts`.

### Área cultivada

Arquivo: `src/app/talhoes/page.tsx`

Permite cadastrar e listar locais da propriedade.

No Modo Simples, pede nome, tipo e tamanho. No Modo Completo, mostra também
observação, cultura, safra, solo, irrigação e produtividade estimada.

### Anotações

Arquivo: `src/app/registros/page.tsx`

Guarda o histórico do que aconteceu na propriedade.

No Modo Simples, permite escrever uma anotação rápida. No Modo Completo,
mostra tipo, quantidade, responsável, valor e informações técnicas.

Algumas anotações completas também podem alterar a quantidade de um produto no
estoque.

Quando o tipo exige estoque, a página valida primeiro se o produto existe e se
a quantidade é numérica e maior que zero. Depois o Context calcula o próximo
saldo e prepara a anotação e o produto antes de publicar os dois estados. Se
alguma validação falhar, nenhuma das duas partes é salva.

### Estoque

Arquivo: `src/app/estoque/page.tsx`

Permite cadastrar produtos e acompanhar suas quantidades.

No Modo Simples, pede somente nome, quantidade e unidade. No Modo Completo,
mostra categoria, estoque mínimo, fornecedor, validade e outros detalhes.

Também calcula quais produtos estão abaixo do estoque mínimo.

## 6. Quais arquivos estudar primeiro

Uma boa ordem inicial é:

1. `src/app/layout.tsx`
2. `src/components/app-shell.tsx`
3. `src/app/globals.css`
4. `src/app/dashboard/page.tsx`
5. `src/components/dashboard/SummaryCard.tsx`
6. `src/components/dashboard/SimpleDashboardDetails.tsx`
7. `src/components/dashboard/WeatherCard.tsx`
8. `src/hooks/useClima.ts`
9. `src/app/api/clima/route.ts`
10. `src/types/clima.ts`
11. `src/data/dashboardMock.ts`
12. `src/app/talhoes/page.tsx`
13. `src/app/registros/page.tsx`
14. `src/app/estoque/page.tsx`
15. `src/context/AgroAppContext.tsx`

Comece pelo layout para entender como o sistema é montado. Depois veja uma
página simples e acompanhe o formulário até chegar ao contexto. Para estudar a
tela Início, leia primeiro `dashboard/page.tsx` e depois os componentes que ela
importa.

Para estudar somente o visual, comece por `globals.css`, depois compare
`SummaryCard.tsx`, `app-shell.tsx` e um dos formulários. Observe como as classes
`ag-...` aplicam o mesmo padrão em elementos diferentes.

Para estudar a aplicação da marca, siga esta ordem:

1. veja os arquivos de `public/brand`;
2. abra `src/components/app-shell.tsx` para encontrar o logo no menu;
3. abra `src/app/layout.tsx` para encontrar a fonte e o favicon;
4. abra `src/app/globals.css` para encontrar as cores da marca;
5. abra `src/app/dashboard/page.tsx` para ver a primeira impressão da tela
   Início.

## 7. Caminho de um dado no sistema

O fluxo básico é:

```text
Usuário preenche um campo
        ↓
onChange chama updateField
        ↓
useState atualiza formData
        ↓
Usuário envia o formulário
        ↓
handleSubmit monta o novo objeto
        ↓
Uma função do contexto adiciona o objeto à lista
        ↓
React renderiza novamente a página
        ↓
O novo item aparece na lista
        ↓
O contexto salva as listas no localStorage
```

### Estado do formulário

Cada formulário usa `useState` para guardar temporariamente o que está sendo
digitado:

```tsx
const [formData, setFormData] = useState(emptyForm);
```

`formData` contém os valores atuais. `setFormData` altera esses valores.

### Envio

Quando o usuário clica no botão, `handleSubmit` impede o recarregamento da
página, prepara os dados e chama uma função como:

```tsx
adicionarArea(newLocation);
```

### Lista

O contexto atualiza a lista. Como o React percebe a mudança, a tela é
renderizada novamente e o novo card aparece.

### Salvamento

O contexto usa `useEffect` para salvar áreas, anotações e produtos no
`localStorage`.

`localStorage` é um espaço do navegador. Por isso, os dados continuam
disponíveis depois de atualizar a página, mas ficam somente naquele navegador
e computador.

## 8. Modo Simples e Modo Completo

### O que são

O Modo Simples mostra poucos campos para permitir registros rápidos.

Na tela Início, ele também mostra informações compactas. Isso significa que os
dados continuam disponíveis, mas as listas possuem poucos itens e ocupam menos
espaço.

O Modo Completo mostra campos adicionais para um controle mais detalhado.

### Onde ficam no código

O estado principal fica em:

`src/context/AgroAppContext.tsx`

Os valores mais importantes são:

```tsx
modoUso
setModoUso
isModoCompleto
```

O seletor visual fica em:

`src/components/app-shell.tsx`

A escolha é salva no `localStorage` com a chave `agrozap-settings`.

### Como as páginas escolhem os campos

As páginas recebem `isModoCompleto` usando `useAgroApp()`:

```tsx
const { isModoCompleto } = useAgroApp();
```

Depois usam uma condição:

```tsx
{isModoCompleto && (
  <div>Campos extras</div>
)}
```

Isso significa: mostre esse bloco somente quando o Modo Completo estiver
ativo.

Na tela Anotações existe uma escolha entre dois blocos:

```tsx
{!isModoCompleto ? (
  <div>Formulário rápido</div>
) : (
  <div>Formulário completo</div>
)}
```

Assim, o usuário iniciante não precisa enfrentar um formulário grande, mas os
recursos detalhados continuam disponíveis.

Na tela Início, a escolha funciona da mesma forma:

- Modo Simples: ações rápidas, resumo, alerta e três cards compactos;
- Modo Completo: painéis maiores e mais detalhados.

## 9. Ordem de estudo para iniciante

### Dia 1 — Entender layout e páginas

- Abra `src/app/layout.tsx`.
- Veja como `AgroAppProvider` e `AppShell` envolvem as páginas.
- Abra `src/components/app-shell.tsx`.
- Observe os links do menu.
- Compare as pastas de `src/app` com os endereços do navegador.

### Dia 2 — Entender formulários

- Abra `src/app/talhoes/page.tsx`.
- Localize `<form>`, `<input>`, `<select>` e o botão.
- Procure `onChange` e `onSubmit`.
- Veja como cada campo está ligado ao `formData`.

### Dia 3 — Entender `useState`

- Procure `useState` nas páginas.
- Observe o valor inicial `emptyForm`.
- Veja como `updateField` chama `setFormData`.
- Digite no sistema e imagine qual propriedade do objeto está mudando.

### Dia 4 — Entender Context

- Abra `src/context/AgroAppContext.tsx`.
- Localize `createContext`, `AgroAppProvider` e `useAgroApp`.
- Veja as funções `adicionarArea`, `adicionarAnotacao` e
  `adicionarProduto`.
- Volte às páginas e procure onde essas funções são chamadas.

### Dia 5 — Entender `localStorage`

- No contexto, procure `localStorage.getItem`.
- Depois procure `localStorage.setItem`.
- Entenda que um trecho carrega e outro salva.
- Veja por que o código espera `isLoaded` antes de salvar.

### Dia 6 — Entender Modo Simples e Completo

- Procure `modoUso` no contexto.
- Veja o seletor em `app-shell.tsx`.
- Procure `isModoCompleto` nas quatro páginas.
- Compare o que aparece na tela ao trocar o modo.

### Dia 7 — Alterar um campo sozinho

Escolha uma mudança pequena. Por exemplo:

- trocar o texto de um placeholder;
- mudar o nome de um rótulo;
- adicionar uma opção simples em um `select`;
- alterar uma frase explicativa.

Faça uma mudança por vez, salve o arquivo e observe o resultado no navegador.
Evite começar adicionando um campo completo, porque isso exige alterar o tipo,
o estado inicial, o formulário e o objeto salvo.

## Dica final

Ao estudar uma funcionalidade, procure responder quatro perguntas:

1. Onde o valor começa?
2. Qual evento altera o valor?
3. Qual função salva o valor?
4. Onde o valor é exibido?

Se você conseguir seguir essas quatro etapas, já está entendendo o caminho
principal dos dados no AgroZap.

## 10. A nova fundação do banco

### `prisma/schema.prisma`

É o mapa dos dados persistentes. Ele define modelos, campos, tipos, relações,
índices e regras de unicidade.

Os principais modelos são:

| Modelo | Para que serve |
| --- | --- |
| `Property` | Representa uma propriedade rural. |
| `User` | Representa uma pessoa, com telefone único. |
| `PropertyMember` | Liga uma pessoa a uma propriedade e informa seu papel. |
| `Area` | Guarda uma área da propriedade. |
| `AreaAlias` | Guarda apelidos de uma área. |
| `StockProduct` | Guarda o produto e seu saldo atual. |
| `ProductAlias` | Guarda apelidos de um produto. |
| `StockMovement` | Guarda cada entrada, saída, ajuste ou reversão. |
| `FarmRecord` | Guarda uma anotação ou acontecimento rural. |
| `AuditLog` | Guarda a trilha técnica de uma operação importante. |

Áreas, produtos, movimentos, anotações e auditorias possuem `propertyId`. Isso
impede que a arquitetura dependa de uma única fazenda fixa.

### `prisma.config.ts`

Informa ao Prisma:

- onde está o schema;
- onde ficam as migrations;
- qual comando executa o seed;
- onde obter a `DATABASE_URL`.

A URL vem do ambiente. Credenciais reais não devem ser escritas nesse arquivo.

### `prisma/migrations/`

A migration é o roteiro SQL que cria e altera a estrutura do PostgreSQL. A
migration inicial desta etapa cria enums, tabelas, índices, chaves e relações.

Ela não é a mesma coisa que o seed:

- migration cria a estrutura;
- seed preenche exemplos de desenvolvimento.

### `prisma/seed.ts`

Cria uma propriedade de demonstração, usuários fictícios, participações,
áreas, produtos, apelidos, saldos iniciais e anotações.

Os telefones são reservados para desenvolvimento. O seed não lê nem importa os
dados que já existem no `localStorage`.

### `src/lib/prisma.ts`

Cria a conexão central do Prisma usando o adapter PostgreSQL. Em
desenvolvimento, guarda o client em uma variável global para que o hot reload
do Next.js não abra vários pools de conexão.

Se `DATABASE_URL` não estiver configurada, o arquivo mostra uma mensagem clara.

### `src/generated/prisma/`

É o client TypeScript gerado pelo Prisma a partir do schema. Services importam
modelos, enums e `Prisma.Decimal` dessa pasta.

Não altere os arquivos gerados. Use `npm run db:generate` depois de mudar o
schema. O script `prebuild` também executa essa geração automaticamente antes
de `npm run build`, inclusive em uma instalação limpa.

## 11. Como os modelos se relacionam

Uma visão simplificada é:

```text
Property
├── PropertyMember ── User
├── Area ── AreaAlias
├── StockProduct ── ProductAlias
├── StockMovement
├── FarmRecord
└── AuditLog
```

Um `User` pode participar de várias propriedades por meio de
`PropertyMember`. O papel pertence a essa participação, não diretamente ao
usuário.

Um `StockMovement` sempre pertence a uma propriedade e a um produto. Ele pode
também apontar para uma área, uma anotação, quem registrou e quem executou.

Um `FarmRecord` pode ser apenas uma observação, como “porteira quebrada”. Por
isso, área e produto são opcionais e uma anotação não é automaticamente uma
movimentação de estoque.

## 12. Para que serve `src/services`

Service é o lugar das regras de negócio. Uma página não deve decidir sozinha
se uma saída é permitida ou como criar a auditoria.

### Estoque

- `src/services/estoque/errors.ts`: erros de domínio com códigos estáveis.
- `src/services/estoque/local-stock.ts`: proteção temporária contra estoque
  negativo no Context.
- `src/services/estoque/product.service.ts`: cria produto, apelidos, saldo de
  abertura e auditoria.
- `src/services/estoque/stock-movement.service.ts`: cria entradas, saídas,
  ajustes e reversões no banco.
- `src/services/estoque/index.ts`: reúne as exportações da pasta.

### Áreas

- `src/services/talhoes/area.service.ts`: valida e cria área, apelidos e
  auditoria.
- `src/services/talhoes/index.ts`: reúne as exportações.

### Anotações

- `src/services/registros/farm-record.service.ts`: valida relações e cria um
  `FarmRecord` com auditoria.
- `src/services/registros/index.ts`: reúne as exportações.

### Auditoria e usuários

- `src/services/auditoria/audit-log.service.ts`: cria `AuditLog` usando a
  transação que o chamou.
- `src/services/usuarios/property-membership.ts`: encontra usuários que não
  existem, não pertencem à propriedade ou estão desativados.

### WhatsApp

`src/services/whatsapp` continua sem implementação. O diretório existe apenas
como preparação de organização. Nenhum provedor ou webhook foi adicionado.

## 13. Caminho seguro de uma movimentação no banco

O service de estoque executa este fluxo:

```text
Comando recebido pelo service
        ↓
Confere se a propriedade existe e está ativa
        ↓
Confere se o produto pertence a ela e está ativo
        ↓
Confere área ativa, anotação e usuários atuais ativos
        ↓
Lê o saldo atual
        ↓
Valida quantidade e estoque disponível
        ↓
Atualiza o saldo somente se ele não mudou
        ↓
Cria StockMovement com saldos e snapshots dos nomes
        ↓
Cria AuditLog
        ↓
Confirma a transação inteira
```

A transação usa o nível `Serializable`. Além disso, a atualização compara o
saldo lido com o saldo ainda existente no banco. Se outra operação tiver
alterado o produto no mesmo momento, o fluxo tenta novamente até quatro vezes.
Depois disso, devolve um erro de conflito em vez de gravar um resultado
duvidoso.

Saldo, movimento e auditoria são confirmados juntos. Se uma dessas partes
falhar, todas são desfeitas.

### Reversão

Uma reversão cria um novo movimento ligado ao movimento original:

```text
Movimento original: OUT -3
        ↓
Reversão: REVERSAL +3
        ↓
Se necessário, novo movimento correto: OUT -2
```

O registro original permanece no histórico. Um movimento só pode possuir uma
reversão direta. Propriedade, produto e área podem estar arquivados nessa
correção histórica, mas ainda precisam existir e corresponder à movimentação
original. A reversão não os reativa e copia os snapshots da movimentação
original.

`StockMovement` e `AuditLog` são append-only nas operações normais. Uma
correção acrescenta outro movimento ou log; ela não altera nem apaga o passado.

## 14. Tipos do frontend e tipos do banco

Os arquivos abaixo agora concentram os formatos temporários usados pelas telas:

- `src/types/talhao.ts`;
- `src/types/estoque.ts`;
- `src/types/registro.ts`.

O Context reexporta esses tipos por compatibilidade, evitando quebrar todos os
imports de uma vez.

Os formatos ainda não são iguais aos modelos Prisma. Exemplos:

| Frontend temporário | Banco |
| --- | --- |
| ID numérico com `Date.now()` | ID textual CUID |
| tamanho como `"8 hectares"` | `Decimal` + unidade separada |
| data como texto | `DateTime`/`Timestamptz` |
| valor como `"R$ 85,00"` | `Decimal` |
| responsável como texto | relações `createdBy` e `performedBy` |

A API/Server futura será responsável por validar e converter esses formatos.
Não copie o tipo legado para o banco nem envie um objeto Prisma diretamente
para um componente client.

## 15. O papel temporário do AgroAppContext

O `AgroAppContext` ainda é a fonte das telas para:

- áreas;
- anotações;
- produtos;
- Modo Simples ou Completo.

Ele continua salvando as chaves `agrozap-mvp-data` e `agrozap-settings` no
navegador. A diferença desta etapa é que a mudança local de saldo chama
`calculateLocalStockBalance`, que rejeita uma retirada sem saldo.

Na Etapa 1.1, `src/app/registros/page.tsx` também usa
`requireValidLocalStockProduct` e `parseRequiredLocalStockQuantity`. Quando a
anotação exige movimento, `adicionarAnotacaoComMovimentacao` valida o próximo
saldo antes de alterar as listas. Assim não existe anotação sem o estoque
obrigatório, nem estoque alterado sem a anotação correspondente.

Essa proteção não transforma o `localStorage` em banco. Ela não cria movimento,
auditoria, usuário ou transação PostgreSQL.

## 16. Dados locais, seed e banco são fontes diferentes

Durante a transição existem dois conjuntos independentes de demonstração:

- os exemplos do Context, usados quando o navegador ainda não possui dados;
- os exemplos do seed, inseridos no PostgreSQL quando `npm run db:seed` é
  executado.

Rodar o seed não altera o navegador. Cadastrar pela tela não altera o seed nem
o PostgreSQL. Uma etapa futura deverá decidir como importar os dados locais e
como evitar duplicação.

## 17. Comandos importantes

```bash
npm run dev          # executa a interface com hot reload
npm run test:stage1.1 # testa as regras locais críticas deste endurecimento
npm run typecheck    # verifica os tipos TypeScript
npm run lint         # verifica padrões de código
npm run build        # gera o Prisma Client e cria a versão de produção
npm run db:validate  # valida o schema Prisma
npm run db:generate  # gera o Prisma Client
npm run db:migrate   # aplica/cria migrations no ambiente de desenvolvimento
npm run db:seed      # carrega dados fictícios no PostgreSQL
```

`db:generate`, `db:validate` e o build não precisam abrir conexão e podem rodar
sem `DATABASE_URL`. `db:migrate`, `db:seed` e o uso real dos services precisam
de uma URL válida. O arquivo `.env` está ignorado pelo Git; `.env.example`
contém apenas o nome da variável.

## 18. O que estudar nesta nova etapa

Uma ordem recomendada é:

1. leia `PROJETO.md` para entender objetivo e status;
2. compare os dois fluxos no começo deste mapa;
3. abra `prisma/schema.prisma` e localize `Property`;
4. siga suas relações até `StockProduct` e `StockMovement`;
5. leia `src/services/estoque/local-stock.ts`, usado pelo MVP;
6. leia `src/services/estoque/stock-movement.service.ts`, preparado para o
   banco;
7. compare os dois caminhos sem confundi-los;
8. consulte `docs/DECISOES.md` para saber por que cada escolha foi feita;
9. consulte `docs/HISTORICO_MUDANCAS.md` para saber o que ainda não está pronto.

Ao investigar uma regra do servidor, acrescente duas perguntas às quatro do
MVP:

5. Qual service valida essa operação?
6. Quais dados e auditorias precisam ser salvos na mesma transação?

## 19. O que a Etapa 1.1 endureceu

### Snapshots históricos

`StockMovement` guarda obrigatoriamente `productNameSnapshot` e pode guardar
`areaNameSnapshot`. `FarmRecord` pode guardar os dois. Esses nomes são lidos
pelo service a partir das entidades reais, dentro da operação, e não mudam se
o cadastro for renomeado depois.

A migration incremental fica em:

`prisma/migrations/20260807120000_stage_1_1_hardening/migration.sql`

Ela adiciona as colunas, preenche registros anteriores com os nomes ainda
disponíveis e somente depois torna o snapshot de produto da movimentação
obrigatório. Ela ainda precisa ser aplicada e validada em um PostgreSQL real.

### Usuários atuais ativos

Os services de áreas, produtos, movimentações e anotações consultam
`findUserIdsWithoutActivePropertyMembership`. Se um usuário atual for
informado, ele precisa existir, pertencer à propriedade e não estar desativado.
Registros históricos continuam apontando normalmente para pessoas desativadas.

### Nova operação e reversão

```text
NOVA OPERAÇÃO
propriedade, produto e área existem, pertencem ao mesmo escopo e estão ativos

REVERSÃO HISTÓRICA
propriedade, produto e área existem e correspondem ao movimento, mesmo arquivados
```

Quem faz a reversão agora precisa ser um membro ativo quando sua identidade é
informada. Quem realizou a movimentação original pode estar desativado. Os
snapshots da reversão são copiados do movimento original.

### Histórico append-only

Os services não oferecem update ou delete normal para `StockMovement` ou
`AuditLog`. Ajustes e correções geram novos registros. A Etapa 1.1 formaliza
essa regra sem adicionar trigger complexo ao PostgreSQL.

## 20. Regras obrigatórias para a futura API

### Isolamento por propriedade

O navegador não será autoridade para escolher a propriedade. Um `propertyId`
recebido na requisição será aceito somente depois deste caminho:

```text
session.user
    ↓
PropertyMember
    ↓
Property ativa autorizada
    ↓
Service
```

Isso impede que alguém da Fazenda A altere manualmente uma requisição para
agir na Fazenda B. A regra está documentada, mas sessão e autenticação ainda
não foram implementadas.

### Números em português do Brasil

A camada de entrada converterá um texto brasileiro como `"2,5"` para o valor
canônico `"2.5"` antes de chamar os services. O domínio não receberá texto
ambíguo, e uma IA futura nunca enviará valores não validados diretamente ao
banco. Essa normalização completa ainda não foi implementada nesta etapa.
