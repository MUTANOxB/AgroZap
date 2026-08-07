# Glossário do AgroZap

Este glossário explica palavras usadas no projeto de forma simples. Os exemplos
foram baseados no código atual do AgroZap.

Durante a migração, algumas palavras descrevem o fluxo **ATUAL** das telas e
outras descrevem a fundação de banco **EM CONSTRUÇÃO**. Sempre observe no
exemplo se o dado está no `localStorage` ou no PostgreSQL.

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

Esse resumo continua correto para as telas atuais. Os conceitos abaixo
explicam a fundação que substituirá esse armazenamento local em uma etapa
futura.

## Banco de dados

Banco de dados é um sistema preparado para guardar e consultar informações de
forma organizada e durável.

No AgroZap, o banco guardará propriedades, usuários, áreas, produtos,
movimentações, anotações e auditorias. Diferente do `localStorage`, ele poderá
ser acessado com segurança por diferentes usuários autorizados.

Ter o schema criado não significa que as telas já estejam usando o banco.

## PostgreSQL

PostgreSQL é o programa de banco de dados escolhido para o AgroZap.

Ele organiza os dados em tabelas e oferece recursos como relações, índices,
transações, tipos decimais e JSONB.

Exemplo: uma linha de `StockProduct` guarda o saldo atual de um produto, e
várias linhas de `StockMovement` explicam como esse saldo mudou.

## Prisma

Prisma é a ferramenta usada pelo código TypeScript para trabalhar com o
PostgreSQL.

No AgroZap, o Prisma:

- lê `prisma/schema.prisma`;
- valida os modelos;
- gera o Prisma Client;
- organiza migrations;
- permite consultar e gravar dados nos services.

Exemplo: o service chama `transaction.stockMovement.create(...)` para criar uma
movimentação dentro de uma transação.

## ORM

ORM significa *Object-Relational Mapper*, ou mapeador objeto-relacional.

É uma camada que permite trabalhar com tabelas do banco usando objetos e tipos
do código. Prisma é o ORM do AgroZap.

Exemplo: o modelo `Area` do schema gera operações TypeScript como
`db.area.findFirst()` e `transaction.area.create()`.

O ORM ajuda, mas não substitui as regras de negócio. A validação de saldo ainda
pertence ao service de estoque.

## Schema

Schema é o mapa da estrutura do banco.

O arquivo `prisma/schema.prisma` diz quais modelos existem, quais campos eles
possuem e como se relacionam.

Exemplo: o schema define que um `StockMovement` pertence a uma `Property` e a
um `StockProduct`, e pode apontar para uma `Area`.

## Model

Model é a descrição de um tipo de entidade persistente.

Um model normalmente vira uma tabela no PostgreSQL.

Exemplo: `model User` descreve uma pessoa com ID, nome, telefone e datas. Cada
usuário salvo vira uma linha na tabela correspondente.

## Prisma Client

Prisma Client é o código gerado a partir do schema para fazer consultas com
TypeScript.

No AgroZap, ele é gerado em `src/generated/prisma` por:

```bash
npm run db:generate
```

Essa pasta não deve ser alterada manualmente.

## Adapter PostgreSQL

Adapter é a peça que conecta o Prisma ao driver do banco.

O AgroZap usa `@prisma/adapter-pg`. `src/lib/prisma.ts` recebe a
`DATABASE_URL`, cria o adapter e entrega uma instância central de
`PrismaClient`.

## Migration

Migration é uma alteração versionada na estrutura do banco.

Exemplo: a migration inicial cria as tabelas `Property`, `User`, `Area`,
`StockProduct`, `StockMovement`, `FarmRecord` e `AuditLog`.

Quando o schema mudar, uma nova migration deve explicar ao PostgreSQL como sair
da estrutura antiga e chegar à nova. Migration não serve para importar o
`localStorage`.

## Seed

Seed é um script que insere dados iniciais ou fictícios para desenvolvimento.

O `prisma/seed.ts` do AgroZap cria uma propriedade de demonstração, três
usuários fictícios, áreas, produtos, apelidos, saldos iniciais e anotações.

Ele é executado por:

```bash
npm run db:seed
```

Seed não é migration: a migration cria a estrutura; o seed cria exemplos
dentro dela.

## Relation

Relation, ou relação, mostra como dois modelos estão ligados.

Exemplo: uma propriedade possui vários produtos, mas cada produto pertence a
uma propriedade. Essa é uma relação de um para muitos.

Outro exemplo: usuários e propriedades se ligam por `PropertyMember`,
permitindo que os dois lados tenham vários participantes.

## Foreign key

Foreign key, ou chave estrangeira, é um campo que aponta para o ID de outro
registro e ajuda o banco a manter a relação válida.

Exemplo: `StockProduct.propertyId` aponta para `Property.id`. Assim, um produto
não deve indicar uma propriedade inexistente.

No Prisma, campos como `fields: [propertyId]` e `references: [id]` descrevem
essa ligação.

## Índice

Índice é uma estrutura que ajuda o banco a encontrar dados mais rapidamente.

Exemplo: `StockMovement` possui índice por propriedade e data. Isso prepara uma
consulta como “mostrar os movimentos mais recentes desta propriedade”.

Índices ajudam na leitura, mas ocupam espaço e precisam ser escolhidos de forma
consciente.

## Unique

`Unique` é uma regra que não permite repetir determinado valor ou combinação.

Exemplo: o mesmo usuário não pode possuir dois vínculos iguais com a mesma
propriedade, pois `PropertyMember` tem unicidade em `propertyId + userId`.

Nomes normalizados de áreas e produtos também são únicos dentro de cada
propriedade.

## CUID e UUID

CUID e UUID são formatos usados para criar IDs difíceis de repetir em sistemas
distribuídos.

O AgroZap escolheu **CUID**, configurado como `@default(cuid())` nos modelos.

Exemplo: um produto do banco recebe um ID textual gerado pelo banco/Prisma, em
vez de usar `Date.now()`.

UUID é outra opção válida, mas não é o formato escolhido nesta etapa.

## Decimal

Decimal é um tipo numérico apropriado para valores que precisam de casas
decimais previsíveis.

Exemplos no AgroZap:

- `0,5` litro de produto;
- `2,75` kg de semente;
- valor unitário de um insumo;
- tamanho e produtividade de uma área.

No banco, quantidades usam até quatro casas decimais e valores monetários
estruturados usam precisão própria. Os services usam `Prisma.Decimal` para
evitar cálculos imprecisos com ponto flutuante.

## Valor canônico

Valor canônico é o formato único que o domínio aceita depois que a entrada foi
validada e normalizada.

Exemplo: uma pessoa brasileira pode digitar `2,5`, mas a futura camada de
entrada converterá esse texto para `2.5` antes de chamar um service. O banco e
o domínio não precisam adivinhar qual separador decimal foi usado.

## DateTime

`DateTime` representa data e horário.

Exemplo: `occurredAt` informa quando uma movimentação ou anotação aconteceu.
`createdAt` informa quando o registro entrou no sistema.

Isso é diferente de validade e data de compra, que no schema usam apenas a
parte de data do PostgreSQL.

## Timestamptz

`Timestamptz` é o tipo do PostgreSQL usado para guardar um instante de tempo
com referência de fuso.

O AgroZap usa `Timestamptz(3)` em acontecimentos, criação, atualização,
arquivamento e auditoria. A interface futura deverá converter o instante para o
fuso adequado ao exibir.

## Enum

Enum é uma lista fechada de valores permitidos.

Exemplo: `StockMovementType` aceita somente:

- `IN` para entrada;
- `OUT` para saída;
- `ADJUSTMENT` para ajuste;
- `REVERSAL` para reversão.

Isso evita gravar variações como “saida”, “Saída” e “retirada” no mesmo campo.

O enum `RecordSource` inclui `WHATSAPP`, mas isso não implementa WhatsApp; ele
somente reserva uma origem para o futuro.

## Transaction

Transaction, ou transação, reúne várias alterações em uma única operação.

Exemplo: uma saída de estoque precisa atualizar o saldo, criar
`StockMovement` e criar `AuditLog`. Se a auditoria falhar, saldo e movimento
também são desfeitos.

Uma forma simples de lembrar é:

> Ou tudo é salvo, ou nada é salvo.

## Serializable

`Serializable` é um nível forte de isolamento de transação. Ele faz operações
concorrentes se comportarem como se tivessem acontecido em uma ordem segura.

Exemplo: se duas pessoas retirarem o mesmo produto ao mesmo tempo, o service
não deve deixar as duas usarem o mesmo saldo antigo.

O service combina esse nível com comparação do saldo e novas tentativas.

## Concorrência

Concorrência acontece quando duas operações tentam alterar o mesmo dado quase
ao mesmo tempo.

Exemplo: dois funcionários enviam uma retirada de 60 litros quando existem 100
litros. Apenas uma retirada pode usar aquele saldo sem que a outra reavalie a
sobra.

## Atualização otimista

Atualização otimista significa tentar salvar somente se o valor ainda for o
mesmo que foi lido.

O service de estoque atualiza o produto com uma condição semelhante a “saldo
ainda é 100”. Se outra transação já mudou o saldo, nenhuma linha é atualizada e
a operação tenta novamente.

## Retry

Retry significa tentar novamente uma operação que falhou por um conflito
temporário.

O estoque tenta uma transação concorrente até quatro vezes. Se o conflito
continuar, retorna uma mensagem pedindo nova tentativa. Erros reais de domínio,
como estoque insuficiente, não viram retry automático.

## Service

Service é um arquivo que reúne uma operação e suas regras de negócio.

Exemplo: `stock-movement.service.ts` valida quantidade, saldo, propriedade,
relações e autoria antes de alterar o banco.

A página deve pedir a operação ao service; ela não deve copiar essas regras.

## Regra de negócio

Regra de negócio é uma condição que vem do funcionamento do AgroZap, não da
aparência da tela.

Exemplos:

- uma saída não pode deixar estoque negativo;
- um usuário informado deve pertencer à propriedade;
- uma movimentação não pode ser revertida duas vezes;
- nome e apelido não podem colidir na mesma propriedade.

Essas regras pertencem aos services para valerem também em futuras APIs,
WhatsApp ou outros canais.

## Erro de domínio

Erro de domínio informa que uma regra do sistema impediu a operação.

Exemplo: `StockDomainError` com código `INSUFFICIENT_STOCK` produz a mensagem
“Estoque insuficiente.”.

O código estável ajuda uma futura API a escolher a resposta correta sem
depender apenas do texto visível.

## Audit log

Audit log é a trilha técnica de uma ação importante.

O model `AuditLog` pode registrar:

- quem agiu;
- qual foi a ação;
- qual entidade foi afetada;
- origem da operação;
- dados anteriores e posteriores;
- informações adicionais;
- data e horário.

Exemplo: uma saída pode registrar saldo antes `86`, saldo depois `83` e o ID do
produto. Auditoria não é a mesma coisa que a lista amigável de anotações.

## Append-only

Append-only significa que o histórico normal recebe novos registros, mas os
anteriores não são atualizados nem apagados.

No AgroZap, `StockMovement` e `AuditLog` seguem essa regra. Uma correção cria
um ajuste, uma reversão ou outro log. Assim, o passado continua visível e
explicável.

## JSON e JSONB no banco

JSON organiza informações em pares de nome e valor. O glossário já mostrou seu
uso em respostas de API.

No PostgreSQL, o AgroZap usa JSONB em `beforeData`, `afterData` e `metadata` do
`AuditLog`.

Exemplo simplificado:

```json
{
  "productId": "id-do-produto",
  "quantityChange": "-3"
}
```

JSONB permite guardar contexto variável. Ele não deve substituir campos e
relações importantes que precisam ser validados pelo banco.

## Property

`Property` é uma propriedade rural cadastrada no banco.

Exemplo: “Fazenda de demonstração” é uma `Property`. Áreas, produtos,
movimentos e registros pertencem a ela por `propertyId`.

O nome “Fazenda Santa Helena” ainda aparece fixo no dashboard do MVP, mas não é
a única propriedade possível no novo schema.

## PropertyMember

`PropertyMember` é o vínculo de um usuário com uma propriedade.

Exemplo: Maria pode ser `MANAGER` em uma fazenda e `VIEWER` em outra. O papel
fica no vínculo porque pertence à participação, não à pessoa em todos os
lugares.

## Alias

Alias é um apelido ou nome alternativo.

Exemplo:

```text
Nome oficial: Produto para controle de mato
Apelidos: herbicida, veneno do mato
```

`AreaAlias` e `ProductAlias` preparam buscas mais naturais. Eles não usam IA
nesta etapa.

## Normalização de nome

Normalização cria uma versão comparável de um nome, sem alterar o texto que
será exibido.

Exemplo: “Roça do Fundo” vira algo equivalente a `roca do fundo` para busca e
detecção de repetição. A versão com acento continua salva para a interface.

## StockMovement

`StockMovement` é uma mudança auditável no estoque.

Ele guarda tipo, quantidade alterada, unidade, saldo anterior, saldo posterior,
origem, data, pessoas e motivo.

Exemplo: uma saída de 3 litros com saldo de 86 registra `balanceBefore = 86` e
`balanceAfter = 83`.

## Snapshot histórico

Snapshot histórico é uma cópia de um nome no momento em que um evento
acontece.

Exemplo: uma movimentação guarda `productNameSnapshot = "Produto A"`. Se o
cadastro for renomeado depois para “Produto B”, o ID continua apontando para o
produto atual, mas o snapshot da movimentação permanece “Produto A”. O mesmo
vale para `areaNameSnapshot` quando houver uma área.

## Reversal

Reversal, ou reversão, é um novo movimento que desfaz matematicamente outro sem
apagá-lo.

Exemplo: a reversão de uma saída de 3 litros cria uma entrada de 3 ligada ao
movimento original. Depois pode ser criada a saída correta.

## createdBy e performedBy

`createdBy` indica quem registrou ou confirmou. `performedBy` indica quem
executou a atividade.

Exemplo: João registra “Pedro aplicou o produto”. João é `createdBy`; Pedro é
`performedBy`.

Esses campos já existem no banco, mas a interface ainda precisa de login para
preenchê-los de forma real.

## RecordSource

`RecordSource` informa de onde uma operação veio.

Os valores preparados são `WEB`, `WHATSAPP`, `SYSTEM` e `API`.

Exemplo: o seed usa `SYSTEM`. As futuras telas usarão normalmente `WEB` ou
`API`. O valor não prova que o canal correspondente já esteja implementado.

## API/Server do domínio

É a camada de servidor que receberá pedidos das páginas, identificará o usuário
e chamará os services.

O AgroZap já possui `/api/clima`, mas ainda não possui a API que liga cadastros
de áreas, produtos e anotações ao PostgreSQL.

O fluxo planejado é:

```text
Tela → API/Server → Service → Prisma → PostgreSQL
```

## Variável de ambiente

Variável de ambiente é uma configuração fornecida fora do código.

Exemplo: `DATABASE_URL` contém o endereço de conexão do PostgreSQL. O projeto
mostra apenas o nome em `.env.example`; o valor real fica no `.env`, que não
deve ser enviado ao Git.

## PendingAction

`PendingAction` será uma ação proposta que aguarda confirmação antes de alterar
dados.

Exemplo futuro: uma mensagem é interpretada como retirada de 3 litros, o
usuário revisa o resumo e confirma antes da execução.

Esse conceito é **PLANEJADO**. A entidade não foi criada nesta etapa porque o
fluxo de autenticação, validade e confirmação ainda precisa ser definido.

## Resumo dos dois fluxos

```text
ATUAL
Tela → Context → localStorage

EM CONSTRUÇÃO
Tela → API/Server → Service → Prisma → PostgreSQL
```

O primeiro mantém o MVP funcionando. O segundo oferece a base para dados
compartilhados, transações e auditoria, mas só passará a ser usado pelas telas
depois que a camada API/Server for implementada.
