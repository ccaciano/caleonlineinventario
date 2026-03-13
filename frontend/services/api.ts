// ==================== SERVIÇO DE API LOCAL ====================
// Este arquivo foi refatorado para funcionar 100% offline
// usando armazenamento local em vez de chamadas HTTP

import * as LocalStorage from "./localStorage"
import initialProducts from "../assets/data/products.json"

// Re-exportar tipos do localStorage
export type Product = LocalStorage.Product
export type Inventory = LocalStorage.Inventory
export type CountedItem = LocalStorage.CountedItem
export type StoreConfig = LocalStorage.StoreConfig

// Tipo para dados de exportação
export interface ExportData {
  inventory: Inventory
  items: CountedItem[]
  store: StoreConfig | null
}

// ==================== CONFIGURAÇÃO DA LOJA ====================
export const getStoreConfig = async (): Promise<StoreConfig | null> => {
  return LocalStorage.getStoreConfig()
}

export const saveStoreConfig = async (config: StoreConfig): Promise<StoreConfig> => {
  return LocalStorage.saveStoreConfig(config)
}

// ==================== PRODUTOS ====================

export const getProducts = async (page: number = 1, limit: number = 50, search?: string): Promise<{ products: Product[]; total: number; page: number; totalPages: number }> => {
  return LocalStorage.getProductsPaginated(page, limit, search)
}

export const createProduct = async (product: Omit<Product, "_id">): Promise<Product> => {
  // Verificar se já existe produto com mesmo código
  const existing = await LocalStorage.searchProductByCodeOrEan(product.code)
  if (existing) {
    throw new Error(`Produto com código "${product.code}" já existe`)
  }

  // Verificar EAN se fornecido
  if (product.ean) {
    const existingByEan = await LocalStorage.searchProductByCodeOrEan(product.ean)
    if (existingByEan) {
      throw new Error(`Produto com EAN "${product.ean}" já existe`)
    }
  }

  return LocalStorage.addProduct(product)
}

export const updateProduct = async (id: string, product: Partial<Product>): Promise<Product> => {
  const updated = await LocalStorage.updateProduct(id, product)
  if (!updated) {
    throw new Error("Produto não encontrado")
  }
  return updated
}

export const deleteProduct = async (id: string): Promise<void> => {
  const success = await LocalStorage.deleteProduct(id)
  if (!success) {
    throw new Error("Produto não encontrado")
  }
}

export const searchProduct = async (query: string): Promise<Product | null> => {
  return LocalStorage.searchProductByCodeOrEan(query)
}

export const uploadProducts = async (file: { uri: string; name: string; type: string }, clearExisting: boolean = true): Promise<{ count: number; message: string }> => {
  // Esta função é chamada do componente de upload
  // O conteúdo do CSV já é processado diretamente
  throw new Error("Use uploadProductsFromContent instead")
}

export const uploadProductsFromContent = async (csvContent: string, clearExisting: boolean = true): Promise<{ count: number; message: string }> => {
  const count = await LocalStorage.importProductsFromCSV(csvContent)
  return {
    count,
    message: `${count} produtos importados com sucesso`,
  }
}

// ==================== INVENTÁRIOS ====================

export const getInventories = async (): Promise<Inventory[]> => {
  // 1. Pega a lista, mas garante que se vier null/undefined, vire um array vazio []
  const inventories = (await LocalStorage.getInventories()) || []

  // 2. Verifica se inventories é realmente um array antes de usar o map
  if (!Array.isArray(inventories)) {
    return []
  }

  const updatedInventories = inventories.map((inv) => {
    // Garante que inv.items exista para não quebrar o .length
    const actualCount = inv && inv.items ? inv.items.length : 0

    return {
      ...inv,
      item_count: actualCount,
    }
  })

  return updatedInventories
}

export const createInventory = async (description: string, date: string): Promise<Inventory> => {
  return LocalStorage.createInventory(description, date)
}

export const getInventory = async (id: string): Promise<Inventory> => {
  const inventory = await LocalStorage.getInventoryById(id)
  if (!inventory) {
    throw new Error("Inventário não encontrado")
  }
  return inventory
}

export const updateInventory = async (id: string, updates: Partial<Inventory>): Promise<Inventory> => {
  const updated = await LocalStorage.updateInventory(id, updates)
  if (!updated) {
    throw new Error("Inventário não encontrado")
  }
  return updated
}

export const deleteInventory = async (id: string): Promise<void> => {
  const success = await LocalStorage.deleteInventory(id)
  if (!success) {
    throw new Error("Inventário não encontrado")
  }
}

export const closeInventory = async (id: string): Promise<Inventory> => {
  const closed = await LocalStorage.closeInventory(id)
  if (!closed) {
    throw new Error("Inventário não encontrado")
  }
  return closed
}

// ==================== ITENS CONTADOS ====================

export const getCountedItems = async (inventoryId: string): Promise<CountedItem[]> => {
  return LocalStorage.getCountedItems(inventoryId)
}

export const addCountedItem = async (inventoryId: string, item: Omit<CountedItem, "_id" | "inventory_id">): Promise<CountedItem> => {
  const added = await LocalStorage.addCountedItem(inventoryId, item)
  if (!added) {
    throw new Error("Inventário não encontrado")
  }
  return added
}

export const updateCountedItem = async (inventoryId: string, itemId: string, updates: Partial<CountedItem>): Promise<CountedItem> => {
  const updated = await LocalStorage.updateCountedItem(inventoryId, itemId, updates)
  if (!updated) {
    throw new Error("Item não encontrado")
  }
  return updated
}

export const deleteCountedItem = async (inventoryId: string, itemId: string): Promise<void> => {
  const success = await LocalStorage.deleteCountedItem(inventoryId, itemId)
  if (!success) {
    throw new Error("Item não encontrado")
  }
}

// ==================== EXPORTAÇÃO ====================

export const getExportData = async (inventoryId: string): Promise<ExportData> => {
  const inventory = await LocalStorage.getInventoryById(inventoryId)
  if (!inventory) {
    throw new Error("Inventário não encontrado")
  }

  const store = await LocalStorage.getStoreConfig()

  return {
    inventory,
    items: inventory.items,
    store,
  }
}

// ==================== UTILITÁRIOS ====================

export const clearAllData = async (): Promise<void> => {
  await LocalStorage.clearAllData()
}

// ==================== CARGA INICIAL (SEED) ====================
export const seedDatabaseIfNeeded = async (): Promise<void> => {
  try {
    const result = await getProducts(1, 1)

    if (result.total === 0) {
      console.log("🚚 Base vazia. Injetando base L'Occitane...")

      // Mapeamos o JSON para garantir que cada item tenha um _id (UUID)
      const productsWithIds: Product[] = initialProducts.map((prod) => ({
        _id: prod._id || Math.random().toString(36).substring(2, 9), // Usa o ID do JSON ou gera um
        code: prod.code,
        ean: prod.ean || "",
        description: prod.description,
      }))

      // Salva o blocão de uma vez (Alta performance)
      await LocalStorage.saveRawProducts(productsWithIds)

      console.log(`✅ ${productsWithIds.length} produtos carregados.`)
    }
  } catch (error) {
    console.error("❌ Falha no Seed:", error)
  }
}
