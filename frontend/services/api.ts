import * as LocalStorage from "./localStorage"
import initialProductsData from "../assets/data/products.json"
const initialProducts = initialProductsData as Product[]

export type Product = LocalStorage.Product
export type Inventory = LocalStorage.Inventory
export type CountedItem = LocalStorage.CountedItem
export type WmsCountedItem = LocalStorage.WmsCountedItem
export type WmsAddress = LocalStorage.WmsAddress
export type StoreConfig = LocalStorage.StoreConfig

export interface ExportData {
  inventory: Inventory
  items: CountedItem[]
  store: StoreConfig | null
}

// ==================== CONFIGURAÇÃO DA LOJA ====================

export const getStoreConfig = async (): Promise<StoreConfig | null> => LocalStorage.getStoreConfig()

export const saveStoreConfig = async (config: StoreConfig): Promise<StoreConfig> => LocalStorage.saveStoreConfig(config)

// ==================== PRODUTOS ====================

export const getProducts = async (page: number = 1, limit: number = 50, search?: string) => {
  return LocalStorage.getProductsPaginated(page, limit, search)
}

export const createProduct = async (product: Omit<Product, "_id">): Promise<Product> => {
  const cleanProduct = {
    ...product,
    code: product.code.trim(),
    ean: product.ean ? product.ean.trim() : "",
    description: product.description.trim(),
  }
  const existing = await LocalStorage.searchProductByCodeOrEan(cleanProduct.code)
  if (existing) throw new Error(`Produto com código "${cleanProduct.code}" já existe`)
  if (cleanProduct.ean) {
    const existingByEan = await LocalStorage.searchProductByCodeOrEan(cleanProduct.ean)
    if (existingByEan) throw new Error(`Produto com EAN "${cleanProduct.ean}" já existe`)
  }
  return LocalStorage.addProduct(cleanProduct)
}

export const updateProduct = async (id: string, product: Partial<Product>): Promise<Product> => {
  const updated = await LocalStorage.updateProduct(id, product)
  if (!updated) throw new Error("Produto não encontrado")
  return updated
}

export const deleteProduct = async (id: string): Promise<void> => {
  const success = await LocalStorage.deleteProduct(id)
  if (!success) throw new Error("Produto não encontrado")
}

export const searchProduct = async (query: string): Promise<Product | null> => {
  return LocalStorage.searchProductByCodeOrEan(query ? query.trim() : "")
}

export const uploadProductsFromContent = async (csvContent: string): Promise<{ count: number; message: string }> => {
  const count = await LocalStorage.importProductsFromCSV(csvContent)
  return { count, message: `${count} produtos importados com sucesso` }
}

// ==================== INVENTÁRIOS ====================

export const getInventories = async (): Promise<Inventory[]> => {
  const inventories = (await LocalStorage.getInventories()) || []
  if (!Array.isArray(inventories)) return []

  return inventories.map((inv) => {
    let actualCount: number
    if (inv.type === "wms") {
      actualCount = (inv.enderecos || []).reduce((sum, addr) => sum + (addr.itens?.length || 0), 0)
    } else {
      actualCount = inv.items ? inv.items.length : 0
    }
    return { ...inv, item_count: actualCount }
  })
}

export const createInventory = async (description: string, date: string, type: "loja" | "wms" = "loja"): Promise<Inventory> => {
  return LocalStorage.createInventory(description, date, type)
}

export const getInventory = async (id: string): Promise<Inventory> => {
  const inventory = await LocalStorage.getInventoryById(id)
  if (!inventory) throw new Error("Inventário não encontrado")
  return inventory
}

export const updateInventory = async (id: string, updates: Partial<Inventory>): Promise<Inventory> => {
  const updated = await LocalStorage.updateInventory(id, updates)
  if (!updated) throw new Error("Inventário não encontrado")
  return updated
}

export const deleteInventory = async (id: string): Promise<void> => {
  const success = await LocalStorage.deleteInventory(id)
  if (!success) throw new Error("Inventário não encontrado")
}

export const closeInventory = async (id: string): Promise<Inventory | null> => {
  return updateInventory(id, { status: "closed" })
}

// ==================== ITENS CONTADOS (InvLoja) ====================

export const getCountedItems = async (inventoryId: string): Promise<CountedItem[]> => {
  return LocalStorage.getCountedItems(inventoryId)
}

export const addCountedItem = async (inventoryId: string, item: Omit<CountedItem, "_id" | "inventory_id">): Promise<CountedItem> => {
  const inventory = await LocalStorage.getInventoryById(inventoryId)
  if (inventory?.status !== "open") throw new Error("Não é possível adicionar itens: esta contagem não está aberta.")
  const added = await LocalStorage.addCountedItem(inventoryId, item)
  if (!added) throw new Error("Inventário não encontrado")
  return added
}

export const updateCountedItem = async (inventoryId: string, itemId: string, updates: Partial<CountedItem>): Promise<CountedItem> => {
  const inventory = await LocalStorage.getInventoryById(inventoryId)
  if (inventory?.status !== "open") throw new Error("Não é possível alterar itens: esta contagem já foi encerrada.")
  const updated = await LocalStorage.updateCountedItem(inventoryId, itemId, updates)
  if (!updated) throw new Error("Item não encontrado")
  return updated
}

export const deleteCountedItem = async (inventoryId: string, itemId: string): Promise<void> => {
  const inventory = await LocalStorage.getInventoryById(inventoryId)
  if (inventory?.status !== "open") throw new Error("Não é possível excluir itens: esta contagem já foi encerrada.")
  const success = await LocalStorage.deleteCountedItem(inventoryId, itemId)
  if (!success) throw new Error("Item não encontrado")
}

// ==================== ENDEREÇOS WMS ====================

export const getWmsAddresses = async (inventoryId: string): Promise<WmsAddress[]> => {
  return LocalStorage.getWmsAddresses(inventoryId)
}

export const addWmsAddress = async (inventoryId: string, endereco: string): Promise<WmsAddress> => {
  const inventory = await LocalStorage.getInventoryById(inventoryId)
  if (!inventory) throw new Error("Inventário não encontrado")
  if (inventory.status !== "open") throw new Error("Inventário fechado")
  const existing = (inventory.enderecos || []).find((a) => a.endereco.toUpperCase() === endereco.trim().toUpperCase())
  if (existing) throw new Error(`Endereço "${endereco}" já existe neste inventário`)
  const added = await LocalStorage.addWmsAddress(inventoryId, endereco.trim().toUpperCase())
  if (!added) throw new Error("Erro ao adicionar endereço")
  return added
}

export const deleteWmsAddress = async (inventoryId: string, addressId: string): Promise<void> => {
  const inventory = await LocalStorage.getInventoryById(inventoryId)
  if (inventory?.status !== "open") throw new Error("Inventário fechado")
  const success = await LocalStorage.deleteWmsAddress(inventoryId, addressId)
  if (!success) throw new Error("Endereço não encontrado")
}

export const importWmsAddresses = async (inventoryId: string, enderecos: string[]): Promise<WmsAddress[]> => {
  const inventory = await LocalStorage.getInventoryById(inventoryId)
  if (!inventory) throw new Error("Inventário não encontrado")
  if (inventory.status !== "open") throw new Error("Inventário fechado")
  return LocalStorage.importWmsAddresses(inventoryId, enderecos)
}

export const updateWmsAddress = async (inventoryId: string, addressId: string, newEndereco: string): Promise<WmsAddress> => {
  const inventory = await LocalStorage.getInventoryById(inventoryId)
  if (!inventory) throw new Error("Inventário não encontrado")
  if (inventory.status !== "open") throw new Error("Inventário fechado")
  const dup = (inventory.enderecos || []).find((a) => a._id !== addressId && a.endereco.toUpperCase() === newEndereco.toUpperCase())
  if (dup) throw new Error(`Endereço "${newEndereco}" já existe neste inventário`)
  const updated = await LocalStorage.updateWmsAddress(inventoryId, addressId, newEndereco)
  if (!updated) throw new Error("Endereço não encontrado")
  return updated
}

export const closeWmsInventory = async (inventoryId: string): Promise<Inventory | null> => {
  const inventory = await LocalStorage.getInventoryById(inventoryId)
  if (!inventory) throw new Error("Inventário não encontrado")
  for (const addr of inventory.enderecos || []) {
    if (!addr.itens || addr.itens.length === 0) {
      await LocalStorage.addWmsItem(inventoryId, addr._id, {
        codigo: null as any,
        EAN: null as any,
        descricao: null as any,
        unit: null as any,
        fator: null as any,
        lote: null as any,
        validade: null as any,
        qtd: null as any,
      })
    }
  }
  return LocalStorage.closeInventory(inventoryId)
}

// ==================== ITENS WMS ====================

export const addWmsItem = async (inventoryId: string, addressId: string, item: Omit<WmsCountedItem, "_id">): Promise<WmsCountedItem> => {
  const inventory = await LocalStorage.getInventoryById(inventoryId)
  if (inventory?.status !== "open") throw new Error("Inventário fechado")
  const added = await LocalStorage.addWmsItem(inventoryId, addressId, item)
  if (!added) throw new Error("Endereço não encontrado")
  return added
}

export const updateWmsItem = async (inventoryId: string, addressId: string, itemId: string, updates: Partial<WmsCountedItem>): Promise<WmsCountedItem> => {
  const inventory = await LocalStorage.getInventoryById(inventoryId)
  if (inventory?.status !== "open") throw new Error("Inventário fechado")
  const updated = await LocalStorage.updateWmsItem(inventoryId, addressId, itemId, updates)
  if (!updated) throw new Error("Item não encontrado")
  return updated
}

export const deleteWmsItem = async (inventoryId: string, addressId: string, itemId: string): Promise<void> => {
  const inventory = await LocalStorage.getInventoryById(inventoryId)
  if (inventory?.status !== "open") throw new Error("Inventário fechado")
  const success = await LocalStorage.deleteWmsItem(inventoryId, addressId, itemId)
  if (!success) throw new Error("Item não encontrado")
}

// ==================== EXPORTAÇÃO ====================

export const getExportData = async (inventoryId: string): Promise<ExportData> => {
  const inventory = await LocalStorage.getInventoryById(inventoryId)
  if (!inventory) throw new Error("Inventário não encontrado")
  const store = await LocalStorage.getStoreConfig()
  return { inventory, items: inventory.items, store }
}

// ==================== UTILITÁRIOS ====================

export const clearAllData = async (onComplete?: () => void): Promise<void> => {
  try {
    await LocalStorage.clearAllData()
    if (onComplete) onComplete()
  } catch (error) {
    console.error("Erro ao limpar banco de dados:", error)
    throw error
  }
}

export const seedDatabaseIfNeeded = async (): Promise<void> => {
  try {
    const result = await getProducts(1, 1)
    const productsSource = initialProducts as Product[]
    if (result.total === 0) {
      console.log("🚚 Base vazia. Injetando produtos iniciais...")
      const productsWithIds: Product[] = productsSource.map((prod: Product) => ({
        _id: prod._id || Math.random().toString(36).substring(2, 9),
        code: prod.code,
        ean: prod.ean || "",
        description: prod.description,
      }))
      await LocalStorage.saveRawProducts(productsWithIds)
      console.log(`✅ ${productsWithIds.length} produtos carregados.`)
    }
  } catch (error) {
    console.error("❌ Falha no Seed:", error)
  }
}
