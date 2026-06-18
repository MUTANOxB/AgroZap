# Mapa do código do AgroZap

Este documento é um guia simples para estudar o projeto. Você não precisa
entender tudo de uma vez. A ideia é saber onde cada parte está e acompanhar o
caminho dos dados aos poucos.

## 1. Estrutura geral do projeto

As pastas mais importantes para começar são:

```text
AgroZap/
├── docs/                 Documentação do projeto
├── public/
│   └── brand/            Arquivos da marca AgroZap
├── src/
│   ├── app/              Páginas, layout e estilos gerais
│   ├── components/       Partes visuais reutilizáveis
│   ├── context/          Dados compartilhados entre as páginas
│   ├── data/             Dados de demonstração
│   ├── hooks/            Lógicas reutilizáveis dos componentes
│   ├── lib/              Funções e configurações auxiliares
│   └── types/            Tipos usados pelo TypeScript
├── package.json          Dependências e comandos do projeto
└── .next/                Arquivos gerados automaticamente pelo Next.js
```

A pasta `.next` não deve ser estudada nem editada. Ela é criada
automaticamente quando o projeto é executado ou compilado.

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
