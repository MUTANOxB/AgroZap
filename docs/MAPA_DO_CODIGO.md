# Mapa do código do AgroZap

Este documento é um guia simples para estudar o projeto. Você não precisa
entender tudo de uma vez. A ideia é saber onde cada parte está e acompanhar o
caminho dos dados aos poucos.

> **Importante:** a Etapa 2 colocou autenticação, propriedade ativa e equipe no
> PostgreSQL. Áreas, anotações e produtos das telas continuam temporariamente
> no Context e no `localStorage`, agora separados por propriedade. Portanto,
> a Etapa 3A acrescentou um boundary rural no servidor sem ainda trocar a
> fonte da UI. Existem quatro caminhos/estados que não devem ser confundidos.

### Visão rápida dos quatro caminhos

**ATUAL — identidade, propriedade e equipe no servidor:**

```text
Página, layout ou Server Action
    ↓
Auth.js + usuário atual + contexto da propriedade + política/equipe
    ↓
Prisma
    ↓
PostgreSQL
```

**ATUAL — cadastros rurais usados pela interface:**

```text
Página client
    ↓
PropertyAccessContext (UX) + AgroAppContext
    ↓
agrozap-mvp-data:<propertyId> no localStorage
    ↓
React atualiza as páginas
```

**ATUAL — boundary rural disponível no servidor desde a 3A:**

```text
Server Action ou query server-only
    ↓
requireActivePropertyContext + capability + input normalizado
    ↓
Service rural com regra de negócio
    ↓
Prisma
    ↓
PostgreSQL
    ↓
DTO serializável ou erro seguro
```

**PLANEJADO — integração das páginas na Etapa 3B:**

```text
Página rural
    ↓
boundary da 3A
    ↓
PostgreSQL compartilhado entre sessões
```

O primeiro fluxo atende login, seleção e equipe. O segundo mantém o MVP rural
no navegador. O terceiro é código server-side real da 3A, mas ainda não é
chamado pelas páginas rurais. O quarto descreve a 3B.

## 1. Estrutura geral do projeto

As pastas mais importantes para começar são:

```text
AgroZap/
├── docs/                 Documentação, decisões e histórico
├── prisma/
│   ├── schema.prisma     Modelos e relações do banco
│   ├── migrations/       Histórico da estrutura do PostgreSQL
│   └── seed.ts           Dados fictícios para desenvolvimento
├── tests/
│   └── integration/      Runner seguro e testes com PostgreSQL real
├── scripts/
│   └── auth-dev-password.ts  Senha temporária somente para banco local
├── public/
│   └── brand/            Arquivos da marca AgroZap
├── src/
│   ├── app/              Rotas públicas, autenticadas e por propriedade
│   ├── components/       Partes visuais reutilizáveis
│   ├── context/          Projeção de acesso e ponte rural local
│   ├── data/             Dados de demonstração da interface
│   ├── generated/prisma/ Prisma Client gerado automaticamente
│   ├── hooks/            Lógicas reutilizáveis dos componentes
│   ├── lib/              Conexão Prisma e funções auxiliares
│   ├── services/         Auth, autorização, equipe, domínio e boundary rural
│   ├── types/            Tipos temporários usados pelas telas
│   ├── auth.config.ts    Configuração compartilhada do Auth.js
│   ├── auth.ts           Credentials e callbacks da sessão
│   └── proxy.ts          Checagem otimista das rotas protegidas
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
src/app/login/page.tsx                                      → /login
src/app/(authenticated)/propriedades/page.tsx              → /propriedades
src/app/(authenticated)/(property)/dashboard/page.tsx      → /dashboard
src/app/(authenticated)/(property)/talhoes/page.tsx        → /talhoes
src/app/(authenticated)/(property)/registros/page.tsx      → /registros
src/app/(authenticated)/(property)/estoque/page.tsx        → /estoque
src/app/(authenticated)/(property)/equipe/page.tsx         → /equipe
```

Pastas entre parênteses são grupos de rota do Next.js: organizam layouts e
proteções, mas não aparecem no endereço. `(authenticated)` exige um usuário
atual; `(property)` exige também uma propriedade ativa autorizada.

Outros arquivos importantes:

- `src/app/layout.tsx`: define HTML, fonte, metadados e estilos globais, sem
  exigir login.
- `src/app/(authenticated)/layout.tsx`: revalida o usuário ativo.
- `src/app/(authenticated)/(property)/layout.tsx`: revalida a propriedade,
  monta os Contexts e o `AppShell`.
- `src/app/page.tsx`: redireciona a página inicial para `/dashboard`.
- `src/app/globals.css`: contém estilos gerais usados pelo sistema inteiro.
- `src/app/api/clima/route.ts`: rota interna que consulta o clima real.
- `src/app/api/auth/[...nextauth]/route.ts`: endpoints de sessão do Auth.js.
- arquivos `actions.ts`: Server Actions de login, logout, seleção e equipe;
- `src/app/(authenticated)/(property)/rural-actions.ts`: boundary WEB rural da
  3A. As páginas ainda não o importam na 3A.

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
- usuário, propriedade ativa e papel atuais;
- link para trocar a propriedade;
- link para a equipe;
- ação de logout;
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

Os dois arquivos principais dessa pasta são:

- `src/context/PropertyAccessContext.tsx`;
- `src/context/AgroAppContext.tsx`.

O `PropertyAccessContext` leva para os componentes client a projeção que o
servidor já resolveu: usuário, propriedade, papel e capacidades. Seu método
`can()` serve para adaptar botões e formulários. Ele não autoriza uma operação;
qualquer escrita precisa revalidar tudo no servidor.

O `AgroAppContext` funciona como uma memória compartilhada dos cadastros rurais.
Ele permite que páginas diferentes usem os mesmos dados locais.

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

O provider recebe `activePropertyId` do layout protegido. Áreas, anotações e
produtos são lidos e salvos em `agrozap-mvp-data:<propertyId>`. A preferência
visual continua em `agrozap-settings`.

## 5. Para que servem as telas

### Início

Arquivo: `src/app/(authenticated)/(property)/dashboard/page.tsx`

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

Arquivo: `src/app/(authenticated)/(property)/talhoes/page.tsx`

Permite cadastrar e listar locais da propriedade.

No Modo Simples, pede nome, tipo e tamanho. No Modo Completo, mostra também
observação, cultura, safra, solo, irrigação e produtividade estimada.

### Anotações

Arquivo: `src/app/(authenticated)/(property)/registros/page.tsx`

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

Arquivo: `src/app/(authenticated)/(property)/estoque/page.tsx`

Permite cadastrar produtos e acompanhar suas quantidades.

No Modo Simples, pede somente nome, quantidade e unidade. No Modo Completo,
mostra categoria, estoque mínimo, fornecedor, validade e outros detalhes.

Também calcula quais produtos estão abaixo do estoque mínimo.

## 6. Quais arquivos estudar primeiro

Uma boa ordem inicial é:

1. `src/app/layout.tsx`
2. `src/components/app-shell.tsx`
3. `src/app/globals.css`
4. `src/app/(authenticated)/(property)/dashboard/page.tsx`
5. `src/components/dashboard/SummaryCard.tsx`
6. `src/components/dashboard/SimpleDashboardDetails.tsx`
7. `src/components/dashboard/WeatherCard.tsx`
8. `src/hooks/useClima.ts`
9. `src/app/api/clima/route.ts`
10. `src/types/clima.ts`
11. `src/data/dashboardMock.ts`
12. `src/app/(authenticated)/(property)/talhoes/page.tsx`
13. `src/app/(authenticated)/(property)/registros/page.tsx`
14. `src/app/(authenticated)/(property)/estoque/page.tsx`
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
5. abra `src/app/(authenticated)/(property)/dashboard/page.tsx` para ver a primeira impressão da tela
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
- Compare com `src/app/(authenticated)/layout.tsx` e
  `src/app/(authenticated)/(property)/layout.tsx`.
- Veja como apenas o layout com propriedade ativa adiciona
  `PropertyAccessProvider`, `AgroAppProvider` e `AppShell`.
- Abra `src/components/app-shell.tsx`.
- Observe os links do menu.
- Compare as pastas de `src/app` com os endereços do navegador.

### Dia 2 — Entender formulários

- Abra `src/app/(authenticated)/(property)/talhoes/page.tsx`.
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
- Observe que a chave rural inclui `activePropertyId` e que o legado global é
  migrado no máximo uma vez.

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
impede que a arquitetura dependa de uma única fazenda fixa. Na Etapa 2.1,
`Property` também é formalizada como a fronteira de isolamento tenant: uma
relação de A não pode apontar para uma entidade de B.

### `prisma.config.ts`

Informa ao Prisma:

- onde está o schema;
- onde ficam as migrations;
- qual comando executa o seed;
- onde obter a `DATABASE_URL`.

A URL vem do ambiente. Credenciais reais não devem ser escritas nesse arquivo.

### `prisma/migrations/`

A migration é o roteiro SQL que cria e altera a estrutura do PostgreSQL. A
migration inicial cria enums, tabelas, índices, chaves, relações e constraints.
A migration da Etapa 1.1 acrescenta e preenche os snapshots históricos. As duas
foram aplicadas em ordem desde um banco vazio durante a Etapa 1.2.

A migration de autenticação da Etapa 2 acrescenta `User.passwordHash`. A
migration incremental
`20260807180000_stage_2_1_multi_tenant_isolation` adiciona as FKs compostas que
obrigam relações tenant-scoped a reutilizar a mesma `propertyId`. Ela não
reescreve as migrations anteriores e deve falhar, sem apagar nem mover dados,
caso encontre uma relação cruzada antiga.

Ela não é a mesma coisa que o seed:

- migration cria a estrutura;
- seed preenche exemplos de desenvolvimento.

### `prisma/seed.ts`

Cria uma propriedade de demonstração, usuários fictícios, participações,
áreas, produtos, apelidos, saldos iniciais e anotações.

Os telefones são reservados para desenvolvimento. O seed não lê nem importa os
dados que já existem no `localStorage`. A suíte de integração executa o seed
duas vezes e confirma que os registros esperados não são duplicados.

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

### Boundary rural da Etapa 3A

- `src/services/autorizacao/property-capability-guard.ts`: exige uma ou várias
  capabilities e devolve `FORBIDDEN` sem revelar o papel atual;
- `src/services/autorizacao/rural-web-authorization.ts`: recebe das actions um
  singleton `server-only` exato e obrigatório em toda mutação WEB; recusa
  `undefined` ou objeto forjado, relê a membership e o User sob lock na
  transação da escrita e reaplica a capability atual;
- `src/services/rural/rural-web-inputs.ts`: valida inputs públicos recebidos
  como `unknown` e recusa campos de autoridade;
- `src/services/rural/rural-input-normalization.ts`: normaliza decimal PT-BR,
  datas de banco e `occurredAt`;
- `src/services/rural/rural-dtos.ts`: converte resultados para contratos
  serializáveis;
- `src/services/rural/rural-query.service.ts`: contém queries tenant-scoped,
  paginação e wrappers da Property atual;
- `src/services/rural/rural-action-result.ts`: traduz sucesso e erros para um
  envelope seguro.

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
original. Se o movimento legado já vincula um `FarmRecord` com produto ou área
semanticamente diferente, a reversão pode espelhar esse vínculo para manter a
correção compensatória possível; ela não altera o movimento nem o registro
antigo. O escopo da Property e as referências históricas continuam
obrigatórios.

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

O boundary da 3A já valida e converte os formatos persistentes, mas as páginas
legadas só passarão a chamá-lo na 3B. Não copie o tipo legado para o banco nem
envie um objeto Prisma diretamente para um componente client.

## 15. O papel temporário do AgroAppContext

O `AgroAppContext` ainda é a fonte das telas para:

- áreas;
- anotações;
- produtos;
- Modo Simples ou Completo.

Ele salva os cadastros na chave `agrozap-mvp-data:<propertyId>` e a preferência
visual em `agrozap-settings`. A antiga chave global `agrozap-mvp-data` é
preservada e copiada, no máximo uma vez, para a primeira propriedade aberta
após a mudança. O marcador
`agrozap-mvp-data:property-scope-migration:v1` impede que o mesmo legado seja
replicado em várias propriedades. A mudança local de saldo também chama
`calculateLocalStockBalance`, que rejeita uma retirada sem saldo.

Desde a Etapa 1.1,
`src/app/(authenticated)/(property)/registros/page.tsx` também usa
`requireValidLocalStockProduct` e `parseRequiredLocalStockQuantity`. Quando a
anotação exige movimento, `adicionarAnotacaoComMovimentacao` valida o próximo
saldo antes de alterar as listas. Assim não existe anotação sem o estoque
obrigatório, nem estoque alterado sem a anotação correspondente.

Esse isolamento e essa proteção não transformam o `localStorage` em banco. As
áreas, anotações e produtos da interface não criam movimento, auditoria ou
transação PostgreSQL. Usuário, propriedade e equipe, por outro lado, já usam o
banco pela arquitetura da Etapa 2. Além disso, todas as chaves da mesma origem
ficam disponíveis ao mesmo perfil de navegador: separar a chave por Property
evita mistura na navegação normal, mas não protege confidencialidade entre
usuários de um dispositivo compartilhado.

## 16. Dados locais, seed e banco são fontes diferentes

Durante a transição existem conjuntos independentes de demonstração:

- os exemplos do Context, usados separadamente por propriedade quando o
  navegador ainda não possui dados naquela chave;
- os exemplos do seed, inseridos no PostgreSQL quando `npm run db:seed` é
  executado.

Rodar o seed não altera os cadastros rurais do navegador. Cadastrar área,
anotação ou produto pela tela não altera o seed nem o PostgreSQL. Login,
propriedade ativa e equipe já consultam o banco, e a 3A acrescentou o boundary
rural ainda não consumido pelas telas. A Etapa 3C decidirá como importar ou
descartar dados locais sem duplicação.

## 17. Comandos importantes

```bash
npm run dev          # executa a interface com hot reload
npm run test:stage1.1 # testa as regras locais críticas deste endurecimento
npm run test:stage2  # testa autenticação e política de papéis
npm run test:stage3a # testa guard, parsers, DTOs, inputs e erros do boundary
npm run test:integration # recria agrozap_test e testa o PostgreSQL real
npm run test:all     # executa testes unitários e de integração
npm run typecheck    # verifica os tipos TypeScript
npm run lint         # verifica padrões de código
npm run build        # gera o Prisma Client e cria a versão de produção
npm run db:validate  # valida o schema Prisma
npm run db:generate  # gera o Prisma Client
npm run db:migrate   # aplica/cria migrations no ambiente de desenvolvimento
npm run db:seed      # carrega dados fictícios no PostgreSQL
npm run auth:dev-password -- <telefone> # gera senha temporária só no banco local
```

`db:generate`, `db:validate` e o build não precisam abrir conexão e podem rodar
sem `DATABASE_URL`. `db:migrate`, `db:seed` e o uso real dos services precisam
de uma URL válida. O arquivo `.env` está ignorado pelo Git; `.env.example`
contém apenas nomes e exemplos sem credenciais. As rotas autenticadas também
exigem um `AUTH_SECRET` aleatório com pelo menos 32 caracteres. O valor real e a
senha temporária nunca devem ser enviados ao Git ou copiados para a
documentação.

## 18. O que estudar nesta nova etapa

Uma ordem recomendada é:

1. leia `PROJETO.md` para entender objetivo e status;
2. compare os três fluxos no começo deste mapa;
3. leia `src/auth.config.ts`, `src/auth.ts` e
   `src/services/auth/current-user.ts`;
4. siga `src/app/(authenticated)/(property)/layout.tsx` até
   `requireActivePropertyContext`;
5. compare `PropertyAccessContext` com
   `property-role-policy.ts`, lembrando que somente o servidor autoriza;
6. leia `src/services/equipe/team.service.ts` e depois as actions de `/equipe`;
7. abra `prisma/schema.prisma`, localize `User`, `Property` e `PropertyMember`;
8. compare `src/services/estoque/local-stock.ts`, usado pelo MVP, com
   `src/services/estoque/stock-movement.service.ts`, já preparado para o banco;
9. consulte `docs/DECISOES.md` e `docs/HISTORICO_MUDANCAS.md` para separar o que
   está concluído do que pertence à Etapa 3.

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
obrigatório. A Etapa 1.2 aplicou essa migration depois da migration inicial em
um PostgreSQL vazio e confirmou as duas como concluídas, sem rollback.

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

## 20. Fronteira de autenticação atual e regras para a API rural

### Isolamento por propriedade

O navegador não é autoridade para escolher a propriedade. O cookie contém
somente um ID candidato, aceito depois deste caminho:

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
agir na Fazenda B. Sessão, login e contexto de propriedade já implementam essa
regra para as rotas e actions da Etapa 2. O boundary rural da 3A reutiliza o
contexto revalidado e recusa `propertyId` solto ou aninhado no input público.

### Números em português do Brasil

A camada da 3A converte um texto brasileiro como `"2,5"` para o valor canônico
`"2.5"` antes de chamar os services. Também aceita `1.234,56`, `1000` e
`1000.25`, mas recusa `1.234` por ambiguidade. Uma IA futura nunca deverá enviar
valores não validados diretamente ao banco. A normalização de telefone do
login continua sendo uma regra separada.

## 21. Como funciona a validação PostgreSQL atual

O runner criado na Etapa 1.2 também executa os cenários das Etapas 2 e 2.1. Os
testes reais ficam em `tests/integration/`:

- `run.ts`: executa o preflight de segurança, prepara o banco, aplica
  migrations, executa o seed duas vezes, compara as identidades e inicia os
  testes;
- `test-database.ts`: concentra as guardas e recria somente o banco descartável
  autorizado;
- `test-database-safety.test.ts`: exercita oito cenários de proteção do runner;
- `fixtures.ts`: cria propriedades, usuários, produtos e áreas exclusivos para
  cada cenário;
- `foundation.integration.test.ts`: contém dezessete cenários de domínio e
  PostgreSQL real;
- `stage2.integration.test.ts`: cobre autenticação, propriedade ativa, equipe,
  concorrência, auditoria e isolamento da Etapa 2;
- `stage2-1-multitenancy.integration.test.ts`: tenta diretamente as oito
  relações cross-property, confirma o grafo equivalente dentro da mesma
  Property e cobre quatro tentativas de reparenting por `propertyId`;
- `stage3a-domain.integration.test.ts`: cobre coerência semântica, ator WEB,
  `performedBy`, atomicidade e concorrência da operação combinada;
- `stage3a-queries.integration.test.ts`: cobre queries A×B, paginação,
  ordenação e recusa de cursor fora do escopo.

### Proteção do banco de desenvolvimento

Na execução padrão, o runner pode derivar `agrozap_test` em memória a partir de
uma `DATABASE_URL` local. Também aceita `TEST_DATABASE_URL`, mas nunca grava a
URL escolhida no `.env` e nunca mostra a conexão completa nos logs.

Antes de apagar ou criar qualquer banco, ele confere:

```text
host é localhost ou 127.0.0.1 e a porta é validada (5432 quando omitida)
        ↓
nome contém test como segmento e usa somente letras, números ou underscore
        ↓
nome é diferente do banco de desenvolvimento
        ↓
nome não é agrozap, postgres, template0 ou template1
        ↓
overrides de URL e controles do dotenv são removidos
        ↓
8 testes das guardas passam antes de qualquer DROP
        ↓
runner marca o processo e aponta DATABASE_URL para o banco já aprovado
        ↓
somente então agrozap_test pode ser recriado
```

Os testes de domínio também recusam execução direta sem o marcador interno. A
saída dos subprocessos passa por redação de URLs antes de chegar ao console.
Assim, a suíte pode ser destrutiva no banco descartável sem colocar o banco
normal `agrozap` em risco.

### O que a suíte consulta de verdade

O teste de integração não copia a lógica do service. Ele chama o service real e
consulta o PostgreSQL para conferir o estado confirmado. A suíte cobre:

- migrations desde banco vazio e seed idempotente;
- login por credenciais, usuário desativado e propriedade ativa revalidada;
- regras de equipe, último `OWNER`, autogerenciamento e auditorias atômicas;
- saldo, movimento e auditoria na mesma transação;
- rollback por estoque insuficiente, usuário desativado ou propriedade
  arquivada;
- duas retiradas concorrentes de 8 sobre saldo 10, com uma única retirada
  efetiva e saldo final 2;
- snapshots após renomear produto e área;
- diferença entre `createdBy` e `performedBy`;
- operações novas bloqueadas após arquivamento e reversões históricas
  permitidas;
- reversão duplicada, reversão de reversão e duas reversões concorrentes;
- isolamento entre propriedades e escopo dos aliases;
- recusa de reparenting automático de área, produto, registro e movimento;
- `CHECK constraints` como última barreira contra saldos e movimentos
  inválidos.

A suíte validada antes da Etapa 2.1 totaliza 45 casos de integração: 37 de
domínio/banco (fundação e Etapa 2) e 8 guardas de segurança.
`test:stage1.1` contém 8 testes unitários, e `test:stage2`, 17. A validação final
da Etapa 2 aprovou 25/25 testes unitários, 45/45 de integração e 70/70 pelo
agregador `test:all`.

Os treze cenários adicionais da Etapa 2.1 elevaram a suíte para 58/58 testes de
integração e 83/83 em `test:all`, mantendo 25/25 unitários. `db:validate`,
`db:generate`, typecheck, lint e build também passaram.

A Etapa 3A acrescentou testes unitários e PostgreSQL aos arquivos acima e ao
script `test:stage3a`. A validação final da nova contagem ainda está em
andamento; os números só devem ser atualizados após toda a bateria obrigatória
passar.

### Regressão de quantidade zero

A integração mostrou que `Decimal.isPositive()` considera `+0` positivo. Os
services agora usam `greaterThan(0)`: saldo inicial zero não cria movimento de
abertura, e uma movimentação de quantidade zero é recusada com
`INVALID_QUANTITY` antes de chegar ao banco. Os dois comportamentos possuem
cobertura de regressão.

## 22. Mapa da Etapa 2

### Login e sessão

Os arquivos centrais são:

- `src/auth.config.ts`: segredo, estratégia JWT, página de login e caminhos
  protegidos;
- `src/auth.ts`: provider `Credentials`, telefone/senha e callbacks que mantêm
  somente o ID necessário na sessão;
- `src/services/auth/phone.ts`: normaliza telefone brasileiro para `+55`;
- `src/services/auth/password.ts`: limites e bcrypt custo 12;
- `src/services/auth/credentials.service.ts`: busca a conta e valida a senha;
- `src/services/auth/current-user.ts`: reconsulta o usuário ativo;
- `src/app/api/auth/[...nextauth]/route.ts`: expõe os handlers do Auth.js;
- `src/proxy.ts`: checagem otimista de JWT antes das rotas protegidas.

```text
/login envia telefone e senha
        ↓
normalizePhone produz +55...
        ↓
Credentials busca User e compara bcrypt
        ↓
JWT guarda o ID do usuário
        ↓
requireCurrentUser reconsulta User com deactivatedAt = null
```

Para uma conta inexistente ou ainda sem `passwordHash`, o fluxo também compara
contra um hash bcrypt aleatório de descarte do mesmo custo. A resposta continua
genérica, reduzindo uma diferença temporal simples sem prometer proteção total
contra enumeração.

Auth.js está na versão v5 beta (`next-auth` `5.0.0-beta.32`), usa sessão `JWT`
e não usa adapter. A migration
`prisma/migrations/20260807150000_stage_2_authentication/migration.sql`
acrescenta apenas `passwordHash` opcional a `User`.

### Propriedade ativa

Os arquivos em `src/services/propriedades/` separam três responsabilidades:

- `active-property-cookie.ts`: lê, grava e limpa
  `agrozap_active_property` com `HttpOnly`, `SameSite=Lax`, `Secure` em produção
  e `Path=/`;
- `active-property.service.ts`: confirma no PostgreSQL que usuário, propriedade
  e vínculo continuam ativos;
- `active-property-context.ts`: combina sessão e cookie ou redireciona para
  `/propriedades`.

A página e as actions de seleção ficam em
`src/app/(authenticated)/propriedades/`. O cookie não contém nome, papel nem
capacidades e nunca é suficiente sozinho.

### Política e equipe

`src/services/autorizacao/property-role-policy.ts` é a fonte central das
capacidades:

| Papel | Capacidades nesta etapa |
| --- | --- |
| `OWNER` | todas |
| `MANAGER` | todas, com limites adicionais ao administrar equipe |
| `EMPLOYEE` | `READ_PROPERTY`, `CREATE_RECORD`, `MOVE_STOCK` |
| `VIEWER` | `READ_PROPERTY` |

A tela fica em `src/app/(authenticated)/(property)/equipe/`, e as regras
transacionais ficam em `src/services/equipe/team.service.ts`. O service
revalida o ator, impede autogerenciamento, limita `MANAGER` a `EMPLOYEE` e
`VIEWER`, e mantém pelo menos um `OWNER`. Adição, troca de papel, remoção e seu
`AuditLog` usam a mesma transação `Serializable`, com retry limitado em conflito.

### Limites de segurança conhecidos

O helper `npm run auth:dev-password -- <telefone>` só aceita execução fora de
produção contra PostgreSQL local e banco chamado exatamente `agrozap`. Ele
recusa parâmetros de URL que tentem sobrescrever `host`, `hostaddr`, `database`
ou `dbname`, valida o usuário ativo e mostra a senha temporária aleatória uma
única vez.

A Etapa 2 não inclui rate limiting distribuído de login nem revogação
versionada dos JWTs depois de uma troca de senha. Esses controles exigem uma
decisão de implantação posterior. A revalidação de `User.deactivatedAt` em cada
contexto protegido já bloqueia contas desativadas e continua sendo a garantia
exigida nesta etapa.

## 23. Mapa da Etapa 2.1

### A fronteira tenant

Na arquitetura atual, **Property é a fronteira de isolamento tenant do
AgroZap**. Toda consulta ou escrita persistente tenant-scoped deve carregar uma
`propertyId`, e toda entidade relacionada precisa pertencer à mesma Property.
A regra de revisão para todas as etapas futuras é:

```text
User + Property A
        ↓
não lê, não relaciona e não altera
        ↓
dados da Property B
```

Conhecer um CUID de produto, área, registro, movimento ou membership de B não
é autorização. O caminho de autoridade permanece:

```text
browser envia somente dados necessários
        ↓
Auth.js identifica o User
        ↓
requireCurrentUser revalida o User ativo
        ↓
requireActivePropertyContext revalida Property + PropertyMember
        ↓
servidor deriva actorUserId + propertyId + papel/capabilities
        ↓
service
        ↓
PostgreSQL
```

Na seleção, o `propertyId` do formulário é apenas candidato. As ações de equipe
não aceitam `actorUserId`, `actorRole` nem `propertyId` do navegador como
autoridade; elas os derivam novamente no servidor.

### Oito relações protegidas no PostgreSQL

A migration
`prisma/migrations/20260807180000_stage_2_1_multi_tenant_isolation/migration.sql`
usa chaves estrangeiras compostas. Os modelos de destino oferecem unicidade em
`(propertyId, id)`, e a FK inclui a Property nos dois lados:

| Origem | Destino exigido na mesma Property |
| --- | --- |
| `AreaAlias(propertyId, areaId)` | `Area(propertyId, id)` |
| `ProductAlias(propertyId, productId)` | `StockProduct(propertyId, id)` |
| `FarmRecord(propertyId, areaId)` | `Area(propertyId, id)` |
| `FarmRecord(propertyId, productId)` | `StockProduct(propertyId, id)` |
| `StockMovement(propertyId, productId)` | `StockProduct(propertyId, id)` |
| `StockMovement(propertyId, areaId)` | `Area(propertyId, id)` |
| `StockMovement(propertyId, farmRecordId)` | `FarmRecord(propertyId, id)` |
| `StockMovement(propertyId, reversesMovementId)` | `StockMovement(propertyId, id)` |

Isso impede que duas referências individualmente existentes sejam combinadas
como Property A + entidade da Property B. Relações opcionais continuam
opcionais, mas, quando preenchidas, precisam respeitar a combinação composta.

### propertyId como identidade estrutural

A `propertyId` de `Area`, `StockProduct`, `FarmRecord` e `StockMovement` faz
parte da identidade estrutural da entidade e deve ser tratada como imutável
após a criação. Mudar esse valor não é uma edição comum: seria mover o dado
entre fronteiras tenant. Uma eventual correção futura deverá ser uma operação
administrativa explícita, auditada e projetada especificamente para isso.

Por esse motivo, as oito relações compostas declaram `onUpdate: Restrict` no
Prisma e `ON UPDATE RESTRICT` na migration. A ação preserva os comportamentos
`onDelete` existentes e impede que a atualização de uma chave referenciada
com dependentes propague automaticamente outra `propertyId` para as linhas
filhas.

`RESTRICT` é uma barreira importante, mas não cria imutabilidade absoluta no
PostgreSQL. Uma entidade sem dependentes ainda pode teoricamente receber um
`UPDATE` direto, e SQL coordenado pode tentar alterar simultaneamente a
`propertyId` e as referências envolvidas. A regra continua dependendo também
da arquitetura dos services e das permissões de banco. A Etapa 2.1 não criou
trigger, RLS nem uma operação administrativa de reparenting.

A migration é incremental. Ela não altera migrations antigas e não tenta
“consertar” corrupção escolhendo uma fazenda: se houver dado cruzado anterior,
a criação da constraint deve falhar claramente.

### Entidades globais e exceção polimórfica

`User` não pertence exclusivamente a uma Property. A pessoa é global e se liga
a uma ou várias propriedades por `PropertyMember`; o papel pode mudar em cada
vínculo. Da mesma forma, `createdByUserId`, `performedByUserId` e
`AuditLog.actorUserId` guardam atores globais. Remover uma membership atual não
apaga nem invalida o histórico de outra Property ou a autoria anterior.

`AuditLog.entityId` é deliberadamente polimórfico. Junto de `entityType`, ele
pode descrever `Area`, `StockProduct`, `StockMovement`, `FarmRecord` ou
`PropertyMember`, portanto não existe uma única tabela de destino para uma FK
composta. Os services e testes precisam manter esse identificador coerente com
a `propertyId` do log.

### Identificadores globais

- `User.phone` permanece globalmente único, pois identifica a pessoa global;
- `Property.slug` permanece um identificador globalmente único da Property;
- `Property.name` pode se repetir. Duas “Fazenda Santa Maria” são válidas, e
  uma futura geração de slug deverá desambiguá-las sem proibir o mesmo nome.

### O que não foi implementado

`Organization` foi deliberadamente adiada. No futuro, ela poderá agrupar
Properties de uma empresa ou família e concentrar cobrança ou administração,
mas o modelo não foi antecipado.

PostgreSQL RLS **não foi implementado**. A proteção desta etapa usa autoridade
no servidor, services, FKs/constraints e testes reais. RLS só deve ser avaliado
depois de projetar contexto de conexão/sessão, transações e pooling com Prisma.

A Etapa 2.1 também não criou API rural, WhatsApp, IA, billing nem qualquer parte
da Etapa 3.

### Services rurais e ponte local

`area.service.ts`, `product.service.ts`, `farm-record.service.ts` e
`stock-movement.service.ts` já filtravam IDs relacionados pela Property quando
a Etapa 2.1 terminou, mas ainda não estavam expostos. A Etapa 3A passou a
expô-los por um boundary que deriva ator e Property no servidor e exige a
capability correspondente. As telas continuam sem usar essas actions até a
3B; `propertyId`, papel ou ator nulo nunca viram autoridade do browser.

O `AgroAppContext` continua usando
`agrozap-mvp-data:<propertyId>`. Essa chave impede que a navegação normal misture
duas Properties, mas `localStorage` pertence ao perfil inteiro do navegador.
Em dispositivo compartilhado, outro usuário pode enumerar dados locais de uma
Property aberta anteriormente. Esse risco residual só termina com uma migração
segura do armazenamento; ela não faz parte da Etapa 2.1.

### Testes validados

O baseline validado é `test:stage1.1` 8/8, `test:stage2` 17/17, 25/25 testes
unitários, 45/45 de integração e 70/70 em `test:all`. Os treze casos PostgreSQL
da Etapa 2.1 incluem nove cenários de relações A×B e quatro regressões de
reparenting. Eles preservam relações dentro de A, mantêm um mesmo User em A e
B, confirmam que remover uma membership não afeta a outra e provam que não há
propagação automática de `propertyId` por cascata.

Com esses casos, a validação final aprovou 58/58 testes de integração e 83/83
em `test:all`, mantendo 25/25 unitários. `db:validate`, `db:generate`,
typecheck, lint e build também passaram.

## 24. Mapa da Etapa 3A

### Boundary de mutações WEB

As actions ficam em
`src/app/(authenticated)/(property)/rural-actions.ts`:

- `createAreaAction`;
- `createStockProductAction`;
- `createFarmRecordAction`;
- `registerStockMovementAction`, para IN, OUT e ADJUSTMENT;
- `reverseStockMovementAction`;
- `createFarmRecordWithStockMovementAction`.

Todas chamam `requireActivePropertyContext()`. O navegador fornece apenas dados
funcionais; `rural-web-inputs.ts` recusa em qualquer profundidade
`propertyId`, `createdByUserId`, `actorUserId`, `role`, `capability` e `source`.
Depois disso, a action deriva Property e ator atuais e fixa `RecordSource.WEB`.
Ela também passa o singleton `server-only` `RURAL_WEB_AUTHORIZATION` ao
service. Esse marcador exato é obrigatório em todas as seis mutações WEB;
`undefined` e qualquer objeto forjado são recusados. Na mesma transação que
fará a escrita, o service bloqueia e relê a membership e o User, aplicando de
novo a capability atual; uma autorização lida antes de um downgrade não fica
congelada. Somente fontes explicitamente não-WEB podem omitir o marcador.

### Capabilities por operação

| Operação | Capability exigida |
| --- | --- |
| listar áreas, produtos, registros e movimentos | `READ_PROPERTY` |
| criar área | `CREATE_AREA` |
| criar produto sem saldo inicial | `CREATE_PRODUCT` |
| criar produto com saldo inicial positivo | `CREATE_PRODUCT` + `ADJUST_STOCK` |
| criar FarmRecord | `CREATE_RECORD` |
| IN ou OUT | `MOVE_STOCK` |
| ADJUSTMENT | `ADJUST_STOCK` |
| reversão | `REVERSE_STOCK` |
| ler AuditLog | `VIEW_AUDIT` |
| FarmRecord + IN/OUT | `CREATE_RECORD` + `MOVE_STOCK` |
| FarmRecord + ADJUSTMENT | `CREATE_RECORD` + `ADJUST_STOCK` |

O guard não compara papéis nas actions. Ele consulta a matriz central:

- OWNER e MANAGER possuem todas as capabilities;
- EMPLOYEE possui `READ_PROPERTY`, `CREATE_RECORD` e `MOVE_STOCK`;
- VIEWER possui somente `READ_PROPERTY`.

### Queries e cursor

`rural-query.service.ts` separa wrappers públicos sem Property fornecida pelo
browser das implementações internas com `propertyId` explícito. Estas só são
expostas ao harness quando o marcador seguro do runner de integração está
ativo. Todas as consultas Prisma possuem filtro de Property.

Áreas e produtos retornam somente linhas ativas, ordenadas por nome e ID.
Registros e movimentos usam `occurredAt DESC, id DESC`; auditoria usa
`createdAt DESC, id DESC`. O cursor codifica versão, tipo, Property, instante e
ID em Base64 URL-safe. Antes da próxima página, a âncora é confirmada na mesma
Property. O limite padrão é 25, o máximo é 100 e a query solicita apenas
`limit + 1`.

### Parsing de decimal e data

`rural-input-normalization.ts` produz texto decimal canônico:

| Entrada | Saída |
| --- | --- |
| `12,5` | `12.5` |
| `1.234,56` | `1234.56` |
| `1000` | `1000` |
| `1000.25` | `1000.25` |
| `1.234` | erro de ambiguidade |

Datas de colunas `Date` usam `YYYY-MM-DD` em `00:00Z`. `occurredAt` aceita
data simples ancorada em `12:00Z` ou instante com `Z`/offset explícito. Entradas
vazias, calendários impossíveis e horário sem timezone falham claramente.

### DTOs e erros

`rural-dtos.ts` define `AreaDto`, `StockProductDto`, `FarmRecordDto`,
`StockMovementDto`, `AuditLogDto` e `CursorPage<T>`. Nenhum deles contém
`Prisma.Decimal`, `Date` ou modelo Prisma cru.

`rural-action-result.ts` cria o envelope:

```text
sucesso → { ok: true, data: DTO }
falha conhecida → { ok: false, error: { code, message } }
falha interna → { ok: false, error: { code: INTERNAL_ERROR, message genérica } }
```

### Consistência e transação combinada

`stock-movement.service.ts` revalida o FarmRecord vinculado ao criar uma nova
movimentação. Produto diferente, área diferente, diferença entre `null` e ID
ou FarmRecord sem produto geram `FARM_RECORD_MOVEMENT_MISMATCH`.

Essa igualdade semântica não é aplicada retroativamente à reversão histórica.
Se um movimento legado same-Property já possui vínculo incompatível, a
reversão pode espelhar suas referências e snapshots para permitir a correção
compensatória, sem reescrever o original nem o FarmRecord antigo.

`createFarmRecordWithStockMovement` executa o helper transacional do registro e
o helper de estoque no mesmo `Prisma.TransactionClient`. O movimento recebe
`farmRecordId`, `productId` e `areaId` do registro já validado; não aceita uma
segunda versão desses IDs no input combinado. Saldo, registro, movimento e
auditorias confirmam juntos ou são revertidos juntos.

### Limite desta subetapa

A 3A não alterou:

- `AgroAppContext`;
- as páginas client de área, anotação, estoque e dashboard;
- `agrozap-mvp-data`;
- `agrozap-mvp-data:<propertyId>`;
- `agrozap-mvp-data:property-scope-migration:v1`;
- `agrozap-settings`.

A 3B conectará essas páginas ao boundary. A 3C tratará legado, cross-session e
histórico final, sem importação silenciosa. A validação final da 3A aprovou
19/19 testes unitários próprios, 78/78 de integração e 122/122 em `test:all`,
além de schema, geração do client, typecheck, lint e build.
