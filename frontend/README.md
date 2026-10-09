# CaléOnline Inventário

Aplicativo mobile para gestão de inventário de estoque. Funciona 100% offline — todos os dados ficam armazenados localmente no dispositivo.

## Tecnologias

- **Expo** (React Native + TypeScript)
- **Expo Router** — navegação baseada em arquivo (Drawer)
- **expo-file-system** — armazenamento local em JSON
- **expo-camera / expo-document-picker** — leitura de código de barras e importação de CSV

## Funcionalidades

### Inventário Loja (`type: "loja"`)
Contagem simples por produto. O operador escaneia ou digita o código do produto e registra a quantidade.

### Inventário WMS (`type: "wms"`)
Contagem por endereço de estoque. Fluxo:
1. Criar inventário WMS
2. Adicionar/importar endereços (formato `AA9999999`)
3. Para cada endereço → registrar itens com: código, EAN, quantidade, unidade (UN/CX), fator, lote e validade

### Base de Produtos
- Cadastro manual de produtos (código, EAN, descrição)
- Importação em massa via CSV (suporta separador `,` ou `;`, UTF-8 e Latin-1/Windows-1252)

## Estrutura do Projeto

```
frontend/
├── app/
│   ├── _layout.tsx          # Drawer Navigator (layout raiz)
│   ├── index.tsx            # Lista de inventários
│   ├── products.tsx         # Base de produtos
│   ├── counting/[id].tsx    # Tela de contagem (InvLoja)
│   ├── wms/[id].tsx         # Gerenciar endereços WMS
│   └── wms-counting/[id].tsx# Contagem por endereço (WMS)
├── components/
│   ├── BarcodeScanner.tsx   # Scanner de câmera (web + nativo)
│   ├── CreateInventoryModal.tsx
│   ├── ProductFormModal.tsx
│   ├── AddressModal.tsx
│   └── EditItemModal.tsx
├── services/
│   ├── api.ts               # Camada de API (fachada sobre localStorage)
│   └── localStorage.ts      # Persistência em JSON (expo-file-system)
├── utils/
│   ├── excelExport.ts       # Exportação de inventário para Excel
│   └── i18n.ts              # Internacionalização (pt-BR)
└── assets/
    └── data/products.json   # Base de produtos (inicia vazia)
```

## Instalação e Execução

```bash
# Instalar dependências
npm install

# Iniciar em modo desenvolvimento
npx expo start

# Build para Android (EAS)
eas build --platform android --profile preview
```

## Formato do CSV para Importação de Produtos

O arquivo CSV deve ter três colunas na ordem: **código**, **EAN**, **descrição**.

Separadores aceitos: `;` (ponto e vírgula) ou `,` (vírgula).  
Encodings aceitos: UTF-8 (com ou sem BOM) e Windows-1252/Latin-1.  
Cabeçalho opcional — é detectado automaticamente.

**Exemplo com ponto e vírgula:**
```
CÓDIGO;EAN;DESCRIÇÃO
PROD001;7891234567890;Produto Exemplo Um
PROD002;;Produto Sem EAN
```

**Exemplo com vírgula:**
```
codigo,ean,descricao
PROD001,7891234567890,Produto Exemplo Um
```
