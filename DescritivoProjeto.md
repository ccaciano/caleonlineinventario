# ContAí LOJAS — Descritivo do Projeto

Aplicativo móvel de contagem de inventário para lojas. Funciona **inteiramente offline**: não há servidor, banco de dados remoto nem qualquer chamada de rede. Todos os dados vivem no armazenamento privado do próprio aparelho.

Este documento descreve o que o aplicativo faz e como está construído. Reflete o estado do código na branch `new_LOJAS`.

> **Atenção:** o `README.md` na raiz está desatualizado. Ele descreve um backend FastAPI + MongoDB, persistência em AsyncStorage, tela de configuração de loja, suporte a inglês e envio por e-mail — nada disso existe mais. Considere este documento a referência corrente.

---

## 1. Visão geral

O app resolve um problema específico: **contar estoque de loja com o celular**, usando a câmera como leitor de código de barras, e entregar o resultado em uma planilha Excel.

O fluxo completo tem quatro passos:

```
Inventários  ──►  Contagem  ──►  Fechamento  ──►  Excel
  (lista)        (por item)      (trava edição)   (compartilha)
```

Características que definem o produto:

- **Offline-first por decisão de arquitetura.** Não é um app online que funciona offline — ele nunca acessa a rede. Isso importa porque a contagem acontece em corredor de loja, estoque e depósito, onde não há sinal confiável.
- **Código de produto livre.** O código é texto puro: quem conta digita ou escaneia e o app aceita. Nenhuma leitura é recusada, e a contagem segue no ritmo de quem está no corredor.
- **Imutabilidade após o fechamento.** Uma contagem fechada não aceita inclusão, edição nem exclusão de itens. A trava é aplicada na camada de serviço, não só na interface.

---

## 2. Arquitetura

### 2.1 Camadas

O projeto tem três camadas com responsabilidades separadas e uma direção única de dependência:

```
┌─────────────────────────────────────────────────────┐
│  APRESENTAÇÃO                                       │
│  app/ (telas, rotas)  +  components/ (modais, UI)   │
└────────────────────────┬────────────────────────────┘
                         │ importa
                         ▼
┌─────────────────────────────────────────────────────┐
│  SERVIÇO — services/api.ts                          │
│  Regras de negócio, validações, mensagens de erro   │
└────────────────────────┬────────────────────────────┘
                         │ importa
                         ▼
┌─────────────────────────────────────────────────────┐
│  PERSISTÊNCIA — services/localStorage.ts            │
│  Leitura e escrita de JSON no sistema de arquivos   │
└─────────────────────────────────────────────────────┘
```

Nenhuma tela conversa diretamente com a persistência. Isso não é formalismo: é o que permite que a regra "contagem fechada não aceita alteração" exista em um único lugar e valha para todas as telas.

**`services/api.ts`** (80 linhas) é o contrato público. Ele reexporta os tipos (`Inventory`, `CountedItem`), aplica as regras de negócio e converte falha em exceção com mensagem em português pronta para exibição. O nome "api" é herança de quando existia um backend HTTP — hoje é apenas a fachada de serviço.

**`services/localStorage.ts`** (162 linhas) é burro por escolha: lê e escreve JSON, não conhece regra de negócio. Toda função retorna `null` ou `false` em vez de lançar exceção — quem decide o que isso significa é a camada acima.

### 2.2 Persistência

Os dados ficam em um único arquivo JSON dentro do diretório privado do app:

```
<documentDirectory>/data/inventories.json
```

`documentDirectory` é fornecido pelo `expo-file-system` e aponta para a área isolada do aplicativo. Consequências práticas:

| Aspecto | Comportamento |
|---|---|
| Visibilidade | Nenhum outro app acessa o arquivo |
| Backup | `allowBackup: false` no `app.json` — o Android **não** inclui os dados no backup automático |
| Desinstalação | Os dados são apagados junto com o app |
| Sincronização | Não existe. Cada aparelho tem sua própria base |

**A contagem não sai do aparelho a não ser pelo Excel gerado ao final.** Se o aparelho for perdido ou o app desinstalado antes da exportação, a contagem se perde.

O arquivo inteiro é lido na memória, alterado e reescrito por completo a cada operação. É a escolha certa para a escala esperada (dezenas a poucos milhares de itens por contagem), e evita a complexidade de um banco embarcado. Se uma contagem passar de algumas dezenas de milhares de itens, esse é o primeiro ponto que vai doer.

### 2.3 Modelo de dados

Duas entidades, com os itens aninhados dentro do inventário:

```ts
interface Inventory {
  _id: string                    // UUID v4 gerado localmente
  description: string            // nome dado pelo usuário
  date: string                   // ISO: "AAAA-MM-DD"
  status: "open" | "closed"
  items: CountedItem[]
  item_count?: number            // derivado em leitura, não persistido
}

interface CountedItem {
  _id: string
  inventory_id: string
  product_code: string           // texto livre
  quantity: number
  lot?: string                   // máx. 7 caracteres
  expiry_date?: string           // ISO: "AAAA-MM-DD"
  ean?: string                   // não preenchido no fluxo atual
  description?: string           // não preenchido no fluxo atual
}
```

Dois detalhes que valem registro:

- `item_count` é calculado em `getInventories()` a cada leitura, nunca gravado. Não há contador para sair de sincronia com a realidade.
- `ean` e `description` existem no tipo mas nenhuma tela os preenche, e a exportação para Excel os ignora. São campos opcionais sem uso no fluxo atual.

O `_id` é um UUID v4 gerado por uma função própria (`generateUUID` em `localStorage.ts`) baseada em `Math.random()`. Não é criptograficamente forte, mas identificadores locais em um app monousuário não precisam ser.

### 2.4 Datas

Há duas representações, e a fronteira entre elas é consistente:

- **Persistência e Excel:** ISO `AAAA-MM-DD`
- **Interface:** `DD/MM/AAAA`

A conversão acontece nas bordas, via `convertToISO` / `convertFromISO`, presentes nas telas que lidam com data. Campos de data usam máscara progressiva: o usuário digita só números e as barras aparecem sozinhas. O tratamento cobre o caso de apagar uma barra, que sem cuidado prenderia o cursor.

---

## 3. Estrutura de arquivos

```
frontend/
├── app/                          # Rotas (expo-router: arquivo = rota)
│   ├── _layout.tsx               # Drawer, barra de navegação Android
│   ├── index.tsx                 # Lista de inventários
│   ├── counting/[id].tsx         # Tela de contagem
│   └── +html.tsx                 # Shell HTML (somente build web)
│
├── components/
│   ├── BarcodeScanner.tsx        # Leitor: nativo e web
│   ├── CalculatorModal.tsx       # Calculadora com parser próprio
│   ├── CreateInventoryModal.tsx  # Criação de inventário
│   ├── EditItemModal.tsx         # Edição de item contado
│   └── TorchButton.tsx           # Lanterna
│
├── services/
│   ├── api.ts                    # Regras de negócio
│   └── localStorage.ts           # Persistência em JSON
│
├── utils/
│   ├── excelExport.ts            # Geração e compartilhamento do .xlsx
│   └── i18n.ts                   # Textos (somente pt-BR)
│
└── assets/images/                # Ícones e fundo do menu
```

São **2.832 linhas** de TypeScript ao todo. A navegação usa **expo-router**, onde o caminho do arquivo define a rota: `app/counting/[id].tsx` responde por `/counting/:id`.

---

## 4. Telas e funcionamento

### 4.1 Lista de inventários (`app/index.tsx`)

Tela inicial. Lista todas as contagens em cartões, cada um mostrando descrição, data, quantidade de itens e o status (Aberto / Fechado).

Comportamentos:

- **Recarrega ao ganhar foco** (`useFocusEffect`), então voltar da contagem sempre mostra números atualizados
- **Puxar para atualizar** recarrega manualmente
- **Botão flutuante (+)** abre o modal de criação
- **Cartão aberto** → toque leva à contagem; há um botão discreto de exclusão
- **Cartão fechado** → não navega mais para a contagem; expõe **Compartilhar** (gera o Excel) e **Excluir Inventário**

A exclusão sempre pede confirmação. No build web usa `window.confirm`, no nativo usa `Alert.alert` — a diferença existe porque o `Alert` do React Native não tem comportamento adequado no navegador.

### 4.2 Criação de inventário (`components/CreateInventoryModal.tsx`)

Modal que desce do topo. Pede descrição e data, com a data já preenchida com o dia corrente.

Validações: ambos os campos obrigatórios; a data precisa estar em `DD/MM/AAAA`, com ano entre 1900 e 2100, e precisa existir no calendário — `31/02/2026` é recusado, e `29/02` só passa em ano bissexto.

O inventário nasce com `status: "open"` e lista de itens vazia.

### 4.3 Contagem (`app/counting/[id].tsx`)

É a tela principal, onde o trabalho acontece de fato. Tem três blocos: cabeçalho, formulário de inclusão e lista do que já foi contado.

**Formulário**

| Campo | Regra |
|---|---|
| Código do Produto | Obrigatório. Texto livre, convertido para maiúsculas |
| Quantidade | Obrigatória. Só dígitos, máx. 7 (até 9.999.999). Precisa ser maior que zero |
| Lote | Opcional. Máx. 7 caracteres, maiúsculas |
| Validade | Opcional. `DD/MM/AAAA` com máscara automática |

O botão **Escanear Código** abre a câmera para preencher o código do produto. Ao lado do campo Lote há um segundo botão de scanner — lotes costumam vir em etiqueta separada. Se o código lido para o lote passar de 7 caracteres, o app avisa e limpa o campo em vez de truncar em silêncio.

Ao lado da Quantidade há um botão de **calculadora**, para quando a contagem envolve conta (caixas × unidades, somas parciais).

Junto ao campo Lote existe também um **botão de lanterna**, útil para etiqueta em prateleira baixa ou corredor mal iluminado.

**Lista de itens contados**

Mostra tudo que já foi registrado, **do mais recente para o mais antigo** — quem acabou de contar vê sua última entrada no topo.

Há um **campo de busca** sobre a lista, que filtra por código, lote, descrição e validade. Ele existe para um caso concreto: em loja, uma única posição pode ter muitos itens, e durante a contagem surge a dúvida "esse código eu já contei?". A busca é local (sobre o que está na tela), ignora maiúsculas/minúsculas e casa por trecho. O contador do cabeçalho passa a mostrar "X de Y itens" enquanto o filtro está ativo. Ao adicionar um item, o filtro é limpo automaticamente para que a nova entrada não fique escondida.

Cada item pode ser editado ou excluído enquanto a contagem estiver aberta.

**Fechamento**

O botão **Fechar Inventário** aparece quando há pelo menos um item. Pede confirmação, e depois disso a contagem vira somente leitura: o formulário some, e os botões de editar e excluir ficam desabilitados. Um aviso vermelho "Contagem encerrada" passa a ocupar o topo.

Não há como reabrir uma contagem fechada pela interface.

### 4.4 Edição de item (`components/EditItemModal.tsx`)

Modal com os mesmos quatro campos e as mesmas validações da inclusão. Serve para corrigir um item já lançado, sem precisar excluir e recontar.

---

## 5. Leitura de código de barras

`components/BarcodeScanner.tsx` é o componente mais complexo do projeto (447 linhas) porque resolve o mesmo problema de duas formas completamente diferentes, escolhendo em tempo de execução:

```
Platform.OS === "web"  ──►  WebBarcodeScanner    (html5-qrcode)
Platform.OS !== "web"  ──►  NativeBarcodeScanner (expo-camera)
```

O `expo-camera` só é carregado fora do build web, via `require()` condicional no topo do módulo. Sem isso o bundle web quebraria ao tentar resolver um módulo nativo.

**Formatos suportados no nativo:** EAN-13, EAN-8, UPC-A, UPC-E, QR, Code 128, Code 39, Code 93, Codabar, ITF-14, PDF417, Aztec e DataMatrix — cobre o que se encontra em embalagem de varejo e em etiqueta de lote.

A versão web enumera as câmeras disponíveis e permite alternar entre elas, porque em notebook a câmera frontal costuma ser a padrão e não serve para ler etiqueta.

O componente cuida de encerrar o stream de vídeo e remover o container do DOM ao fechar. Câmera que não é liberada corretamente trava o próximo uso.

---

## 6. Calculadora

`components/CalculatorModal.tsx` implementa um **parser recursivo próprio** (`evaluateExpression`), não usa `eval`.

Suporta as quatro operações, parênteses e precedência correta. Aceita `×` e `÷` como entrada e normaliza vírgula decimal para ponto. Parênteses não fechados são balanceados automaticamente antes da avaliação, então `(12+3` é válido.

No contexto da contagem o modal roda em modo `integerOnly`: o resultado é arredondado e limitado à faixa de 0 a 9.999.999, coerente com o campo de quantidade.

Escrever um parser em vez de chamar `eval` é o que impede que o campo de texto vire um vetor de execução de código arbitrário.

---

## 7. Exportação para Excel

`utils/excelExport.ts` gera o arquivo com a biblioteca **xlsx** (SheetJS). A planilha tem **duas abas**, com agregações diferentes do mesmo conjunto de dados:

**Aba "Produtos"** — total por código, somando todos os lançamentos:

| CÓDIGO | QUANTIDADE |
|---|---|

**Aba "Lotes"** — detalhamento por combinação de código + lote + validade:

| CÓDIGO PRODUTO | LOTE | QUANTIDADE | DATA FABRICAÇÃO | DATA VALIDADE |
|---|---|---|---|---|

A coluna "Data Fabricação" existe no cabeçalho mas sai sempre vazia — o app não coleta esse dado. Foi mantida para compatibilidade com o formato esperado por quem recebe a planilha.

A agregação importa: contar o mesmo produto cinco vezes em pontos diferentes da loja gera cinco lançamentos, e a aba "Produtos" entrega o total consolidado.

O arquivo é nomeado como `inventario_<descrição>_<AAAAMMDD>.xlsx`, com a descrição higienizada (não-alfanuméricos viram `_`).

A entrega difere por plataforma: no web o download é direto; no nativo o arquivo é escrito no diretório de cache e entregue à folha de compartilhamento do sistema (`expo-sharing`), de onde o usuário escolhe WhatsApp, e-mail, Drive ou o que tiver instalado.

---

## 8. Interface e navegação

**Menu lateral (Drawer)** com apenas duas entradas visíveis: Inventários e Contagem. A tela de contagem está registrada mas oculta do menu (`drawerItemStyle: display: "none"`), porque só faz sentido acessá-la a partir de um inventário.

**Modo imersivo no Android:** o `_layout.tsx` esconde a barra de navegação do sistema e a reesconde automaticamente após 3 segundos caso o usuário a faça aparecer, e também ao voltar de segundo plano. A motivação é ganhar altura de tela em aparelho pequeno durante a contagem.

**Paleta** (padrão iOS, aplicada de forma consistente):

| Cor | Uso |
|---|---|
| `#007AFF` | Primária — ações, ícones, identidade |
| `#34C759` | Botão de escanear |
| `#FF3B30` | Destrutivo — excluir, fechar |
| `#F2F2F7` | Fundo |
| `#8E8E93` | Texto secundário |

Alvos de toque têm no mínimo 44–48px, dimensionados para uso com o aparelho em uma das mãos.

**Textos** ficam centralizados em `utils/i18n.ts` usando i18next, mas **só existe português**. A infraestrutura de tradução está montada e parte dos textos ainda está fixa no código das telas — há 23 chaves traduzidas convivendo com strings literais. Não é inconsistência acidental a ponto de quebrar nada, mas é dívida visível caso outro idioma entre em cena.

---

## 9. Regras de negócio

Concentradas em `services/api.ts`, valem independentemente da tela que chamar:

1. **Contagem fechada é imutável.** `addCountedItem`, `updateCountedItem` e `deleteCountedItem` verificam `status === "open"` antes de agir e lançam exceção com mensagem específica em caso contrário.
2. **Quantidade positiva.** Precisa ser inteiro maior que zero.
3. **Lote limitado a 7 caracteres.** Aplicado por `maxLength`, por truncamento na digitação e por verificação explícita no retorno do scanner.
4. **Data em `DD/MM/AAAA`.** Formato, faixa (1900–2100) e existência no calendário são validados: dia inexistente para o mês é recusado, incluindo 29/02 fora de ano bissexto.
5. **Fechamento exige conteúdo.** Não se fecha um inventário sem nenhum item.
6. **Exclusão sempre confirma.** Vale para item e para inventário.

---

## 10. Plataformas e build

**Alvo principal:** Android, distribuído como APK via EAS Build (`eas.json`, perfil `production`).

**iOS:** o `bundleIdentifier` está configurado e o código não usa nada exclusivo de Android além da barra de navegação imersiva, que é condicional. Não consta que tenha sido compilado ou testado.

**Web:** funciona. Há 9 pontos com tratamento específico (`Platform.OS === "web"`), cobrindo scanner, confirmações, download do Excel e leitura de arquivo.

### Identificação

| Campo | Valor |
|---|---|
| Nome | ContAí LOJAS |
| Slug | `contai-inventario` |
| Package / Bundle ID | `com.ccaciano.inventorymanager.loja` |
| Versão | 1.0.0 (`versionCode` 8) |

O identificador é próprio deste aplicativo, o que o mantém instalável lado a lado com outros apps da mesma família sem conflito.

### Permissões Android

`CAMERA` (leitura de código), `READ_EXTERNAL_STORAGE` e `WRITE_EXTERNAL_STORAGE` (exportação), `INTERNET` (exigida pelo runtime do Expo; o app não faz requisições).

### Stack

| Camada | Tecnologia |
|---|---|
| Framework | Expo 54 / React Native 0.81 / React 19 |
| Linguagem | TypeScript 5.9 |
| Navegação | expo-router 6 (drawer) |
| Armazenamento | expo-file-system (JSON) |
| Câmera | expo-camera (nativo) · html5-qrcode (web) |
| Planilha | xlsx (SheetJS) |
| Compartilhamento | expo-sharing |
| Textos | i18next / react-i18next |

---

## 11. Pontos de atenção

Itens conhecidos, todos verificados no código. Nenhum impede o funcionamento.

**Perda de dados.** Uma contagem existe apenas no aparelho, com backup automático desabilitado, até que seja exportada. Perda, formatação ou desinstalação do aparelho significa perda da contagem. É a contrapartida direta da escolha offline-first, e vale explicitar para quem opera.

**Dívida de i18n.** Parte dos textos está em `i18n.ts`, parte fixa nas telas. Funciona, mas um segundo idioma exigiria consolidar isso antes.

**Plugin órfão no `app.json`.** `expo-document-picker` continua na lista de `plugins`, mas nenhuma tela do app abre seletor de arquivos. Sem efeito prático além do peso.

**Warnings de lint.** 13 no total, nenhum erro: imports não utilizados, `catch (e)` com variável não usada, dois `require()` (necessários, é o carregamento condicional da câmera por plataforma) e dois `exhaustive-deps`.

**Ausência de testes.** Não há suíte automatizada. As funções puras — `evaluateExpression` da calculadora, as conversões de data, a agregação da exportação — são candidatas naturais e baratas, caso se queira começar por algum lugar.

---

## 12. Como rodar

```bash
cd frontend
npm ci              # instala a partir do lockfile
npx expo start      # abre o Metro; leia o QR com o Expo Go
```

Outros comandos úteis:

```bash
npx expo start --android    # abre direto no emulador/aparelho Android
npx expo start --web        # abre no navegador
npx expo lint               # ESLint
npx tsc --noEmit            # checagem de tipos
```

Para gerar o APK de produção:

```bash
cd frontend
eas build --platform android --profile production
```

**Estado atual da verificação:** `tsc` sem erros, `expo lint` sem erros (13 warnings), e `expo export --platform android` gerando bundle de 5,91 MB com sucesso.
