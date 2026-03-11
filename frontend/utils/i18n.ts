import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = '@app_language';

const resources = {
  en: {
    translation: {
      // Tabs
      storeConfig: 'Store Config',
      inventories: 'Inventories',
      
      // Store Config Screen
      storeConfigTitle: 'Store Configuration',
      storeId: 'Store ID',
      storeName: 'Store Name',
      email: 'Email',
      managerPhone: 'Manager Phone',
      managerName: 'Manager Name',
      saveConfig: 'Save Configuration',
      configSaved: 'Configuration saved successfully!',
      fillAllFields: 'Please fill all fields',
      
      // Inventories Screen
      inventoriesTitle: 'Inventory Sessions',
      createInventory: 'Create New Inventory',
      noInventories: 'No inventories yet',
      createFirst: 'Create your first inventory to start counting',
      items: 'items',
      open: 'Open',
      closed: 'Closed',
      
      // Create Inventory Modal
      newInventory: 'New Inventory',
      description: 'Description',
      date: 'Date',
      create: 'Create',
      cancel: 'Cancel',
      
      // Counting Screen
      countingTitle: 'Item Counting',
      scanBarcode: 'Scan Barcode',
      productCode: 'Product Code',
      quantity: 'Quantity',
      lot: 'Lot',
      expiryDate: 'Expiry Date',
      addItem: 'Add Item',
      countedItems: 'Counted Items',
      noItems: 'No items counted yet',
      startScanning: 'Scan or add items to begin',
      edit: 'Edit',
      delete: 'Delete',
      confirmDelete: 'Are you sure you want to delete this item?',
      yes: 'Yes',
      no: 'No',
      
      // Export Screen
      exportTitle: 'Export Report',
      exportAndClose: 'Export & Close Inventory',
      download: 'Download Excel',
      sendEmail: 'Send via Email',
      totalItems: 'Total Items',
      inventoryClosed: 'This inventory is closed',
      exportSuccess: 'Report exported successfully!',
      exportError: 'Error exporting report',
      
      // Edit Item Modal
      editItem: 'Edit Item',
      save: 'Save',
      
      // Scanner
      scannerTitle: 'Scan Barcode/QR Code',
      scannerInstructions: 'Point camera at barcode or QR code',
      cameraPermission: 'Camera permission required',
      grantPermission: 'Grant Permission',
      
      // Validation
      invalidDate: 'Invalid date format',
      invalidQuantity: 'Quantity must be greater than 0',
      
      // Settings
      language: 'Language',
      selectLanguage: 'Select Language',
    }
  },
  pt: {
    translation: {
      // Tabs
      storeConfig: 'Config. Loja',
      inventories: 'Inventários',
      
      // Store Config Screen
      storeConfigTitle: 'Configuração da Loja',
      storeId: 'Código da Loja',
      storeName: 'Nome da Loja',
      email: 'E-mail',
      managerPhone: 'Celular do Gerente',
      managerName: 'Nome do Gerente',
      saveConfig: 'Salvar Configuração',
      configSaved: 'Configuração salva com sucesso!',
      fillAllFields: 'Por favor, preencha todos os campos',
      
      // Inventories Screen
      inventoriesTitle: 'Sessões de Inventário',
      createInventory: 'Criar Novo Inventário',
      noInventories: 'Nenhum inventário ainda',
      createFirst: 'Crie seu primeiro inventário para começar a contagem',
      items: 'itens',
      open: 'Aberto',
      closed: 'Fechado',
      
      // Create Inventory Modal
      newInventory: 'Novo Inventário',
      description: 'Descrição',
      date: 'Data',
      create: 'Criar',
      cancel: 'Cancelar',
      
      // Counting Screen
      countingTitle: 'Contagem de Itens',
      scanBarcode: 'Escanear Código',
      productCode: 'Código do Produto',
      quantity: 'Quantidade',
      lot: 'Lote',
      expiryDate: 'Validade',
      addItem: 'Adicionar Item',
      countedItems: 'Itens Contados',
      noItems: 'Nenhum item contado ainda',
      startScanning: 'Escaneie ou adicione itens para começar',
      edit: 'Editar',
      delete: 'Excluir',
      confirmDelete: 'Tem certeza que deseja excluir este item?',
      yes: 'Sim',
      no: 'Não',
      
      // Export Screen
      exportTitle: 'Exportar Relatório',
      exportAndClose: 'Exportar e Fechar Inventário',
      download: 'Baixar Excel',
      sendEmail: 'Enviar por E-mail',
      totalItems: 'Total de Itens',
      inventoryClosed: 'Este inventário está fechado',
      exportSuccess: 'Relatório exportado com sucesso!',
      exportError: 'Erro ao exportar relatório',
      
      // Edit Item Modal
      editItem: 'Editar Item',
      save: 'Salvar',
      
      // Scanner
      scannerTitle: 'Escanear Código de Barras/QR',
      scannerInstructions: 'Aponte a câmera para o código de barras ou QR',
      cameraPermission: 'Permissão de câmera necessária',
      grantPermission: 'Conceder Permissão',
      
      // Validation
      invalidDate: 'Formato de data inválido',
      invalidQuantity: 'Quantidade deve ser maior que 0',
      
      // Settings
      language: 'Idioma',
      selectLanguage: 'Selecionar Idioma',
    }
  }
};

// Initialize i18n
const initI18n = async () => {
  let savedLanguage = 'pt'; // Default to Portuguese
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored) {
      savedLanguage = stored;
    }
  } catch (error) {
    console.error('Error loading language preference:', error);
  }

  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: savedLanguage,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false
      }
    });
};

export const changeLanguage = async (lang: string) => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    await i18n.changeLanguage(lang);
  } catch (error) {
    console.error('Error saving language preference:', error);
  }
};

initI18n();

export default i18n;
