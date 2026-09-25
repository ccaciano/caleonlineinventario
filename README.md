# ContAí LOJAS

Aplicativo móvel para contagem de inventário de loja. Lê código de barras com a câmera, registra os itens e entrega o resultado em uma planilha Excel.

Funciona **inteiramente offline**: não há servidor, banco de dados remoto nem chamadas de rede. Os dados ficam no armazenamento privado do aparelho.

---

## Fluxo de uso

```
Inventários  ──►  Contagem  ──►  Fechamento  ──►  Excel
  (lista)        (por item)      (trava edição)   (compartilha)
```

1. **Criar inventário** — toque no botão **+**, informe descrição e data.
2. **Contar** — abra o inventário e adicione os itens, escaneando ou digitando o código.
3. **Fechar** — encerra a contagem e a torna somente leitura.
4. **Compartilhar** — gera o `.xlsx` e entrega pela folha de compartilhamento do sistema.

---

## Funcionalidades

**Contagem de itens**

- Leitura de código de barras e QR pela câmera, ou digitação manual
- Campos: código do produto (obrigatório), quantidade (obrigatória), lote e validade (opcionais)
- Código de produto é texto livre — nenhuma leitura é recusada
- Botão de scanner dedicado para o campo de lote, que costuma vir em etiqueta separada
- **Calculadora** ao lado da quantidade, para contas do tipo caixas × unidades
- **Lanterna** para etiqueta em prateleira baixa ou corredor escuro
- Máscara automática de data (`DD/MM/AAAA`)

**Lista do que já foi contado**

- Itens mais recentes aparecem no topo
- **Campo de busca** filtra por código, lote, descrição e validade — resolve a dúvida "esse código eu já contei?" sem sair da tela
- Editar ou excluir qualquer item enquanto a contagem estiver aberta

**Inventários**

- Lista com descrição, data, total de itens e status (Aberto / Fechado)
- Puxar para atualizar
- Exclusão com confirmação
- Contagem fechada não aceita mais inclusão, edição nem exclusão

**Exportação**

Planilha `.xlsx` com duas abas:

| Aba | Conteúdo |
|---|---|
| **Produtos** | Total por código, somando todos os lançamentos |
| **Lotes** | Detalhe por código + lote + validade |

O arquivo sai como `inventario_<descrição>_<AAAAMMDD>.xlsx` e é entregue pela folha de compartilhamento (WhatsApp, e-mail, Drive, o que estiver instalado).

---

## Como rodar

Requisitos: Node.js e o app **Expo Go** no celular.

```bash
cd frontend
npm ci
npx expo start
```

Leia o QR Code com o Expo Go. Outros comandos:

```bash
npx expo start --android    # abre no emulador ou aparelho conectado
npx expo start --web        # abre no navegador
npx expo lint               # ESLint
npx tsc --noEmit            # checagem de tipos
```

### Build de produção

```bash
cd frontend
eas build --platform android --profile production
```

Gera um APK pelo EAS Build, conforme o perfil `production` em `frontend/eas.json`.

---

## Estrutura

```
frontend/
├── app/                          # Rotas (expo-router: arquivo = rota)
│   ├── _layout.tsx               # Menu lateral e barra de navegação
│   ├── index.tsx                 # Lista de inventários
│   ├── counting/[id].tsx         # Tela de contagem
│   └── +html.tsx                 # Shell HTML (build web)
│
├── components/
│   ├── BarcodeScanner.tsx        # Leitor de código
│   ├── CalculatorModal.tsx       # Calculadora
│   ├── CreateInventoryModal.tsx  # Criação de inventário
│   ├── EditItemModal.tsx         # Edição de item
│   └── TorchButton.tsx           # Lanterna
│
├── services/
│   ├── api.ts                    # Regras de negócio
│   └── localStorage.ts           # Persistência em JSON
│
├── utils/
│   ├── excelExport.ts            # Geração do .xlsx
│   └── i18n.ts                   # Textos (pt-BR)
│
└── assets/images/                # Ícones e fundo do menu
```

As telas nunca acessam a persistência direto: passam por `services/api.ts`, que concentra as regras de negócio. Detalhes de arquitetura, modelo de dados e decisões de projeto estão em [DescritivoProjeto.md](DescritivoProjeto.md).

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Expo 54 / React Native 0.81 / React 19 |
| Linguagem | TypeScript 5.9 |
| Navegação | expo-router 6 (menu lateral) |
| Armazenamento | expo-file-system (arquivo JSON local) |
| Câmera | expo-camera (nativo) · html5-qrcode (web) |
| Planilha | xlsx (SheetJS) |
| Compartilhamento | expo-sharing |
| Textos | i18next / react-i18next |

---

## Armazenamento de dados

Tudo fica em um único arquivo JSON no diretório privado do aplicativo:

```
<documentDirectory>/data/inventories.json
```

| Aspecto | Comportamento |
|---|---|
| Visibilidade | Nenhum outro app acessa o arquivo |
| Backup | `allowBackup: false` — o Android não inclui os dados no backup automático |
| Desinstalação | Os dados são apagados junto com o app |
| Sincronização | Não existe; cada aparelho tem sua própria base |

> **Importante:** a contagem só sai do aparelho pela planilha Excel. Exporte antes de desinstalar o app ou trocar de aparelho.

---

## Plataformas

**Android** é o alvo principal, distribuído como APK via EAS Build.

**Web** funciona: o scanner usa `html5-qrcode`, o download do Excel é direto e as confirmações usam os diálogos do navegador.

**iOS** tem o `bundleIdentifier` configurado e o código não depende de nada exclusivo de Android, mas não consta que tenha sido compilado ou testado.

### Identificação

| Campo | Valor |
|---|---|
| Nome | ContAí LOJAS |
| Slug | `contai-inventario` |
| Package | `com.ccaciano.inventorymanager.loja` |
| Versão | 1.0.0 (`versionCode` 8) |

### Permissões Android

`CAMERA` (leitura de código), `READ_EXTERNAL_STORAGE` e `WRITE_EXTERNAL_STORAGE` (exportação) e `INTERNET` (exigida pelo runtime do Expo; o app não faz requisições).

---

## Regras de validação

- **Código do produto** — obrigatório, convertido para maiúsculas
- **Quantidade** — obrigatória, inteiro maior que zero, até 9.999.999
- **Lote** — opcional, máximo de 7 caracteres
- **Validade** — opcional, `DD/MM/AAAA`, precisa existir no calendário (`31/02` é recusado e `29/02` só passa em ano bissexto)
- **Fechamento** — exige pelo menos um item
- **Contagem fechada** — não aceita inclusão, edição nem exclusão de itens

---

## Formatos de código lidos

EAN-13, EAN-8, UPC-A, UPC-E, QR, Code 128, Code 39, Code 93, Codabar, ITF-14, PDF417, Aztec e DataMatrix.

---

## Documentação

- [DescritivoProjeto.md](DescritivoProjeto.md) — arquitetura, modelo de dados, decisões de projeto e pontos de atenção
