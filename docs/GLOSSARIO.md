# Glossário do AgroZap

Este glossário explica palavras usadas no projeto de forma simples. Os exemplos
foram baseados no código atual do AgroZap.

## React

React é uma ferramenta para criar interfaces.

Ele permite dividir uma tela em pequenas partes e atualizar automaticamente o
que aparece quando os dados mudam.

No AgroZap, quando uma nova área é cadastrada, o React atualiza a lista de
áreas sem precisar recarregar a página inteira.

## Next.js

Next.js é a estrutura usada para organizar e executar o AgroZap. Ele trabalha
junto com o React e oferece recursos como páginas e rotas.

No projeto, o endereço de uma tela é definido pela pasta em `src/app`:

```text
src/app/estoque/page.tsx → /estoque
```

## Componente

Um componente é uma parte da interface.

Pode ser um botão, um card, um menu ou até uma página inteira.

Por exemplo, `SummaryCard.tsx` é o componente que mostra um número resumido na
tela Início.

Componentes ajudam a evitar repetição de código.

## Page

`Page` significa página.

No Next.js, um arquivo chamado `page.tsx` representa o conteúdo de um endereço
do sistema.

Exemplos:

- `src/app/dashboard/page.tsx`: tela Início;
- `src/app/talhoes/page.tsx`: tela Área cultivada;
- `src/app/registros/page.tsx`: tela Anotações;
- `src/app/estoque/page.tsx`: tela Estoque.

## Layout

Layout é a estrutura visual que envolve as páginas.

No arquivo `src/app/layout.tsx`, o AgroZap adiciona o contexto e o menu ao redor
do conteúdo de cada tela.

O layout evita repetir o menu em todos os arquivos `page.tsx`.

## useState

`useState` é um recurso do React usado para guardar um valor que pode mudar
enquanto a página está aberta.

Nos formulários do AgroZap, ele guarda o que o usuário está digitando:

```tsx
const [formData, setFormData] = useState(emptyForm);
```

- `formData` é o valor atual.
- `setFormData` é a função usada para alterar o valor.
- `emptyForm` é o valor inicial.

Quando o estado muda, o React atualiza a tela.

## useEffect

`useEffect` executa uma ação depois que o React mostra a página ou quando algum
valor muda.

No `AgroAppContext.tsx`, ele é usado para:

- carregar informações do `localStorage`;
- salvar informações no `localStorage`;
- evitar acessar recursos do navegador cedo demais.

## Context

Context é uma memória compartilhada entre várias partes do aplicativo.

O `AgroAppContext.tsx` guarda:

- áreas;
- anotações;
- produtos;
- modo de uso;
- funções para adicionar e atualizar dados.

Assim, uma área cadastrada em Área cultivada pode ser usada na tela Anotações.

## localStorage

`localStorage` é um espaço de armazenamento do navegador.

O AgroZap usa esse espaço para manter os cadastros e o modo de uso depois que a
página é atualizada.

Esses dados ficam somente naquele navegador e computador. O `localStorage` não
é um banco de dados.

## Props

Props são informações enviadas de um componente para outro.

Imagine um card que precisa receber um título e um número:

```tsx
<SummaryCard metric={metric} href="/estoque" />
```

Nesse exemplo, `metric` e `href` são props.

O componente usa essas informações para definir o que deve mostrar e para onde
deve levar o usuário.

## Array

Array é uma lista de valores.

No AgroZap, existem arrays de áreas, anotações e produtos:

```tsx
const [produtos, setProdutos] = useState<StockProduct[]>(initialProducts);
```

Nesse caso, `produtos` é uma lista de produtos do estoque.

Os itens de um array ficam em uma ordem e podem ser adicionados, procurados,
filtrados ou exibidos.

## Map

`map` é uma função usada para percorrer um array e transformar cada item em
outra coisa.

No AgroZap, ela costuma transformar dados em elementos visuais:

```tsx
produtos.map((product) => (
  <article key={product.id}>{product.name}</article>
))
```

Cada produto do array vira um card na página.

O `map` não é a mesma coisa que mapa geográfico.

## Formulário

Formulário é um conjunto de campos usado para receber informações.

Na tela Estoque, o formulário recebe:

- nome do produto;
- quantidade;
- unidade;
- outros detalhes no Modo Completo.

O formulário começa com `<form>` e normalmente possui uma função ligada ao
evento `onSubmit`.

## onChange

`onChange` é um evento executado quando o usuário altera um campo.

Exemplo:

```tsx
onChange={(event) => updateField("name", event.target.value)}
```

Nesse caso:

- o usuário digita no campo;
- `onChange` percebe a alteração;
- `event.target.value` contém o texto atual;
- `updateField` salva esse texto no estado.

## onSubmit

`onSubmit` é o evento executado quando o formulário é enviado.

Exemplo:

```tsx
<form onSubmit={handleSubmit}>
```

No AgroZap, `handleSubmit` geralmente:

1. impede o recarregamento da página;
2. prepara o novo objeto;
3. envia o objeto para o Context;
4. limpa o formulário.

## Tailwind

Tailwind é a ferramenta usada para estilizar a interface com classes prontas.

Exemplo:

```tsx
className="rounded-xl bg-emerald-700 px-5 py-3 text-white"
```

Essas classes dizem que o elemento deve ter:

- cantos arredondados;
- fundo verde;
- espaçamento interno;
- texto branco.

O Tailwind permite escrever o estilo diretamente no elemento.

## Design system

Design system é um conjunto de regras visuais compartilhadas pelo projeto.

No AgroZap, ele define quais cores, bordas, sombras, botões, campos e cards
devem ser usados. As regras principais ficam em `src/app/globals.css`.

Isso evita que cada tela invente uma aparência diferente.

## Identidade visual

Identidade visual é o conjunto de elementos que faz uma marca ser reconhecida.

No AgroZap, ela é formada por:

- símbolo do balão com campos formando um “Z”;
- verde escuro;
- verde vivo;
- bege-terra;
- fundo claro;
- fonte Manrope;
- cantos arredondados e detalhes suaves.

O símbolo fica em `public/brand`, a fonte é configurada em
`src/app/layout.tsx` e as cores ficam em `src/app/globals.css`.

## Token de design

Token de design é um valor com nome usado para representar uma decisão visual.

Exemplo:

```css
--ag-primary: #075b35;
--ag-accent: #58bd08;
--ag-secondary: #c89a5b;
```

Em vez de decorar os códigos das cores, os componentes podem usar a ideia de
cor principal, destaque ou apoio.

## Classe reutilizável

Uma classe reutilizável é um nome de estilo que pode ser aplicado em vários
elementos.

Por exemplo:

```tsx
className="ag-card"
```

Essa classe aplica a superfície, a borda e a sombra padrão de um card do
AgroZap. Ela é usada no Início, em Área cultivada, Anotações e Estoque.

Outros exemplos são `ag-button-primary` e `ag-form-section`.

## Variável CSS

Variável CSS guarda um valor visual que pode ser reaproveitado.

Exemplo simplificado:

```css
:root {
  --ag-primary: #176b4b;
}
```

Depois, a mesma cor pode ser usada em vários lugares. Se a identidade mudar,
é possível alterar o valor principal sem procurar cada ocorrência da cor.

## Hover

Hover é o estado visual mostrado quando o ponteiro do mouse fica sobre um
elemento.

Nos cards do AgroZap, o hover aumenta levemente a profundidade e move o card
alguns pixels. O efeito é discreto para indicar interação sem chamar atenção
demais.

## Estado de foco

Foco indica qual campo ou botão está sendo usado naquele momento.

Quando um input do AgroZap recebe foco, sua borda fica verde e aparece um
contorno suave. Isso ajuda quem usa teclado e também deixa o preenchimento mais
claro no celular.

## Estado ativo

Estado ativo mostra qual opção está selecionada ou qual página está aberta.

No menu do AgroZap, a página ativa recebe fundo levemente claro e uma linha
verde viva na lateral. No seletor de modo, o botão ativo aparece destacado.

Isso ajuda o usuário a entender onde está e qual modo está usando.

## Design responsivo

Design responsivo é a organização visual que se adapta ao espaço disponível.

No AgroZap, o menu fica lateral no computador e recolhido no celular. Cards
podem aparecer em várias colunas no desktop e em uma coluna no celular.

O conteúdo é o mesmo. Somente a disposição muda para continuar confortável de
usar.

## Responsividade

Responsividade é a capacidade da interface de se adaptar ao tamanho da tela.

O AgroZap funciona em celular, tablet e computador usando classes do Tailwind:

```tsx
className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
```

Esse exemplo significa:

- celular: uma coluna;
- tela a partir de `sm`: duas colunas;
- tela a partir de `xl`: quatro colunas.

Não são páginas diferentes. É o mesmo conteúdo reorganizado conforme o espaço.

## Modo Simples

O Modo Simples mostra poucos campos e prioriza registros rápidos.

Exemplos:

- Anotações mostra descrição, data e local opcional.
- Estoque mostra nome, quantidade e unidade.
- Área cultivada mostra nome, tipo e tamanho.

Na tela Início, o Modo Simples não significa uma tela vazia. Ele mostra ações
rápidas, resumo, alertas, clima compacto, últimas anotações e próximos
vencimentos. As listas são curtas para evitar excesso de informação.

O valor usado no código é:

```tsx
"simples"
```

Ele é o modo padrão do AgroZap.

## Modo Completo

O Modo Completo mostra campos adicionais para um controle mais detalhado.

Por exemplo, pode mostrar fornecedor, safra, validade, dose aplicada e estoque
mínimo.

As páginas consultam a variável `isModoCompleto`:

```tsx
{isModoCompleto && (
  <div>Campos adicionais</div>
)}
```

O bloco aparece somente quando o Modo Completo está ativo.

A escolha entre os modos fica no menu e é salva no `localStorage`.

Na tela Início, o Modo Completo usa painéis maiores e exibe mais detalhes que
os cards compactos do Modo Simples.

## Dados mockados

Dados mockados são informações de demonstração usadas enquanto o sistema ainda
não possui uma integração real.

No AgroZap, os próximos vencimentos da tela Início ainda usam dados mockados
de `src/data/dashboardMock.ts`. O clima deixou de ser mockado e agora vem da
Open-Meteo.

Isso permite construir e testar a interface agora. No futuro, esses dados
podem ser substituídos por informações vindas de uma API ou banco de dados.

## API

API é uma forma de dois sistemas trocarem informações.

No AgroZap, a API da Open-Meteo fornece dados como temperatura, umidade, vento
e chuva.

O AgroZap também possui uma rota interna chamada `/api/clima`. Ela conversa
com a Open-Meteo e entrega ao card somente as informações necessárias.

## Rota interna

Uma rota interna é um endereço criado dentro do próprio projeto.

A rota de clima fica em:

```text
src/app/api/clima/route.ts
```

Seu endereço é:

```text
/api/clima
```

O frontend usa essa rota em vez de chamar a Open-Meteo diretamente. Assim, a
tradução das condições, o tratamento de erros e o cache ficam organizados em
um único arquivo.

## JSON

JSON é um formato de texto usado para transportar dados organizados.

Uma resposta simplificada do clima se parece com:

```json
{
  "sucesso": true,
  "local": "Rio Verde, GO",
  "temperatura": 27,
  "condicao": "Parcialmente nublado"
}
```

Cada informação possui um nome e um valor.

## fetch

`fetch` é uma função usada para fazer uma requisição e buscar dados.

No `useClima.ts`, o AgroZap usa:

```tsx
fetch("/api/clima")
```

Quando a resposta chega, o componente guarda os dados e atualiza o card.

## Geocoding

Geocoding é o processo de transformar o nome de um lugar em coordenadas.

Por exemplo:

```text
Rio Verde, GO → latitude e longitude
```

A previsão do tempo precisa dessas coordenadas para saber qual ponto do mapa
deve consultar. Por isso, `/api/clima` primeiro procura a cidade e depois pede
a previsão.

## Cache

Cache é uma cópia temporária de uma resposta.

A rota de clima guarda a previsão por cerca de 30 minutos. Isso evita chamar a
Open-Meteo toda vez que alguém abre ou atualiza a tela.

Depois desse período, uma nova consulta pode atualizar os dados.

## Resumo do fluxo

Um fluxo comum do AgroZap é:

```text
Usuário digita
→ onChange atualiza o useState
→ onSubmit envia o formulário
→ Context atualiza um array
→ map transforma os itens em cards
→ React atualiza a tela
→ useEffect salva os dados no localStorage
```
