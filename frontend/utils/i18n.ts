import i18n from "i18next"
import { initReactI18next } from "react-i18next"

const resources = {
  pt: {
    translation: {
      // App Info
      appSubtitle: "Contagem de Estoque - LOJA",

      // Menu / Navigation
      inventories: "  Inventários",
      counting: "Contagem",

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
      cancel: "Cancelar",
      yes: "Sim",

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
