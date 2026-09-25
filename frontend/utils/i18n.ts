import i18n from "i18next"
import { initReactI18next } from "react-i18next"

const resources = {
  pt: {
    translation: {
      // App Info
      appSubtitle: "Contagem de Estoque - WMS",

      // Menu / Navigation
      inventories: "  Inventários",
      products: "  Base de Produtos",

      // Validação (compartilhado)
      fillAllFields: "Por favor, preencha todos os campos",

      // Inventories Screen
      noInventories: "Nenhum inventário ainda",
      createFirst: "Crie seu primeiro inventário para começar a contagem",
      items: "itens",
      open: "Aberto",
      closed: "Fechado",
      deleteInventory: "Excluir Inventário",
      confirmDeleteInventory: "Tem certeza que deseja excluir este inventário? Esta ação não pode ser desfeita e todos os itens contados serão perdidos.",
      inventoryDeleted: "Inventário excluído com sucesso",

      // Create Inventory Modal
      newInventory: "Novo Inventário",
      description: "Descrição",
      date: "Data",
      create: "Criar",
      continue: "Continuar",
      cancel: "Cancelar",

      // Products Screen
      uploadCSV: "Importar CSV",
      noProducts: "Nenhum produto cadastrado",
      uploadFirst: "Faça upload de um arquivo CSV para começar",
      uploadSuccess: "Produtos importados com sucesso!",
      productsAdded: "produtos adicionados",
      uploadError: "Erro ao fazer upload do CSV",
      deleteProduct: "Excluir Produto",
      confirmDeleteProduct: "Tem certeza que deseja excluir este produto?",
      productDeleted: "Produto excluído com sucesso",
      csvFormat: "Formato CSV: Código Produto, EAN, Descrição",
      csvWillReplace: "ATENÇÃO: O upload irá SOBRESCREVER todos os produtos existentes!",
      searchProducts: "Pesquisar produtos...",
      editProduct: "Editar Produto",
      updateProduct: "Atualizar Produto",
      productUpdated: "Produto atualizado com sucesso!",
      loadingMore: "Carregando mais...",

      // Counting Screen
      productCode: "Código do Produto",
      ean: "EAN",
      yes: "Sim",
      no: "Não",

      // Add Product Modal
      addProduct: "Adicionar Produto",
      productAdded: "Produto cadastrado com sucesso!",

      // Scanner
      scannerTitle: "Escanear Cód.Bar/QR",
      scannerInstructions: "Aponte a câmera para o código de barras ou QRcode",
      cameraPermission: "Permissão de câmera necessária",
      grantPermission: "Conceder Permissão",

      // Validation
      invalidDate: "Formato de data inválido",
    },
  },
}

// Initialize i18n with Portuguese only
i18n.use(initReactI18next).init({
  resources,
  lng: "pt",
  fallbackLng: "pt",
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
