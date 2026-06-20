import * as FileSystem from "expo-file-system/legacy"

const DATA_DIR = `${FileSystem.documentDirectory}data/`

const FILES = {
  products: `${DATA_DIR}products.json`,
  inventories: `${DATA_DIR}inventories.json`,
  storeConfig: `${DATA_DIR}store_config.json`,
}

const ensureDataDir = async (): Promise<void> => {
  const dirInfo = await FileSystem.getInfoAsync(DATA_DIR)
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true })
  }
}

export const saveRawProducts = async (products: Product[]): Promise<void> => {
  await writeJsonFile(FILES.products, products)
}

export const readJsonFile = async <T>(filePath: string, defaultValue: T): Promise<T> => {
  try {
    await ensureDataDir()
    const fileInfo = await FileSystem.getInfoAsync(filePath)
    if (!fileInfo.exists) return defaultValue
    const content = await FileSystem.readAsStringAsync(filePath, { encoding: "utf8" })
    return JSON.parse(content) as T
  } catch (error) {
    console.error(`Erro ao ler arquivo ${filePath}:`, error)
    return defaultValue
  }
}

export const writeJsonFile = async <T>(filePath: string, data: T): Promise<void> => {
  try {
    await ensureDataDir()
    const content = JSON.stringify(data, null, 2)
    await FileSystem.writeAsStringAsync(filePath, content, { encoding: "utf8" })
  } catch (error) {
    console.error(`Erro ao escrever arquivo ${filePath}:`, error)
    throw error
  }
}

// ==================== PRODUTOS ====================

export interface Product {
  _id: string
  code: string
  ean: string
  description: string
}

export const getProducts = async (): Promise<Product[]> => {
  return readJsonFile<Product[]>(FILES.products, [])
}

export const saveProducts = async (products: Product[]): Promise<void> => {
  await writeJsonFile(FILES.products, products)
}

export const addProduct = async (product: Omit<Product, "_id">): Promise<Product> => {
  const products = await getProducts()
  const newProduct: Product = { ...product, _id: generateUUID() }
  products.push(newProduct)
  await saveProducts(products)
  return newProduct
}

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product | null> => {
  const products = await getProducts()
  const index = products.findIndex((p) => p._id === id)
  if (index === -1) return null
  products[index] = { ...products[index], ...updates }
  await saveProducts(products)
  return products[index]
}

export const deleteProduct = async (id: string): Promise<boolean> => {
  const products = await getProducts()
  const index = products.findIndex((p) => p._id === id)
  if (index === -1) return false
  products.splice(index, 1)
  await saveProducts(products)
  return true
}

export const searchProductByCodeOrEan = async (query: string): Promise<Product | null> => {
  const products = await getProducts()
  const queryLower = query.toLowerCase()
  return products.find((p) => p.code.toLowerCase().replace(" ", "") === queryLower || p.ean.toLowerCase().replace(" ", "") === queryLower) || null
}

export const getProductsPaginated = async (page: number, limit: number, search?: string): Promise<{ products: Product[]; total: number; page: number; totalPages: number }> => {
  let products = await getProducts()
  if (search) {
    const searchLower = search.toLowerCase()
    products = products.filter((p) => p.code.toLowerCase().includes(searchLower) || p.ean.toLowerCase().includes(searchLower) || p.description.toLowerCase().includes(searchLower))
  }
  const total = products.length
  const totalPages = Math.ceil(total / limit)
  const startIndex = (page - 1) * limit
  return { products: products.slice(startIndex, startIndex + limit), total, page, totalPages }
}

// ==================== TIPOS ====================

export interface CountedItem {
  _id: string
  inventory_id: string
  product_code: string
  ean?: string
  description?: string
  quantity: number
  lot?: string
  expiry_date?: string
}

export interface WmsCountedItem {
  _id: string
  codigo: string
  EAN?: string
  descricao?: string
  unit?: string
  fator?: number
  lote: string
  validade: string
  qtd: number
}

export interface WmsAddress {
  _id: string
  endereco: string
  itens: WmsCountedItem[]
}

export interface Inventory {
  _id: string
  description: string
  date: string
  status: "open" | "closed"
  type: "loja" | "wms"
  items: CountedItem[]
  enderecos?: WmsAddress[]
  item_count?: number
}

// ==================== INVENTÁRIOS ====================

export const getInventories = async (): Promise<Inventory[]> => {
  return readJsonFile<Inventory[]>(FILES.inventories, [])
}

export const saveInventories = async (inventories: Inventory[]): Promise<void> => {
  await writeJsonFile(FILES.inventories, inventories)
}

export const createInventory = async (description: string, date: string, type: "loja" | "wms" = "loja"): Promise<Inventory> => {
  const inventories = await getInventories()
  const newInventory: Inventory = {
    _id: generateUUID(),
    description,
    date,
    status: "open",
    type,
    items: [],
    enderecos: type === "wms" ? [] : undefined,
  }
  inventories.push(newInventory)
  await saveInventories(inventories)
  return newInventory
}

export const getInventoryById = async (id: string): Promise<Inventory | null> => {
  const inventories = await getInventories()
  const inv = inventories.find((inv) => inv._id === id)
  if (!inv) return null
  return JSON.parse(JSON.stringify(inv))
}

export const updateInventory = async (id: string, updates: Partial<Inventory>): Promise<Inventory | null> => {
  const inventories = await getInventories()
  const index = inventories.findIndex((inv) => inv._id === id)
  if (index === -1) return null
  inventories[index] = { ...inventories[index], ...updates }
  await saveInventories(inventories)
  return inventories[index]
}

export const deleteInventory = async (id: string): Promise<boolean> => {
  const inventories = await getInventories()
  const index = inventories.findIndex((inv) => inv._id === id)
  if (index === -1) return false
  inventories.splice(index, 1)
  await saveInventories(inventories)
  return true
}

export const closeInventory = async (id: string): Promise<Inventory | null> => {
  return updateInventory(id, { status: "closed" })
}

// ==================== ITENS CONTADOS (InvLoja) ====================

export const addCountedItem = async (inventoryId: string, item: Omit<CountedItem, "_id" | "inventory_id">): Promise<CountedItem | null> => {
  const inventories = await getInventories()
  const index = inventories.findIndex((inv) => inv._id === inventoryId)
  if (index === -1) return null
  const newItem: CountedItem = { ...item, _id: generateUUID(), inventory_id: inventoryId }
  inventories[index].items.push(newItem)
  await saveInventories(inventories)
  return newItem
}

export const updateCountedItem = async (inventoryId: string, itemId: string, updates: Partial<CountedItem>): Promise<CountedItem | null> => {
  const inventories = await getInventories()
  const invIndex = inventories.findIndex((inv) => inv._id === inventoryId)
  if (invIndex === -1) return null
  const itemIndex = inventories[invIndex].items.findIndex((item) => item._id === itemId)
  if (itemIndex === -1) return null
  inventories[invIndex].items[itemIndex] = { ...inventories[invIndex].items[itemIndex], ...updates }
  await saveInventories(inventories)
  return inventories[invIndex].items[itemIndex]
}

export const deleteCountedItem = async (inventoryId: string, itemId: string): Promise<boolean> => {
  const inventories = await getInventories()
  const invIndex = inventories.findIndex((inv) => inv._id === inventoryId)
  if (invIndex === -1) return false
  const itemIndex = inventories[invIndex].items.findIndex((item) => item._id === itemId)
  if (itemIndex === -1) return false
  inventories[invIndex].items.splice(itemIndex, 1)
  await saveInventories(inventories)
  return true
}

export const getCountedItems = async (inventoryId: string): Promise<CountedItem[]> => {
  const inventory = await getInventoryById(inventoryId)
  return inventory?.items || []
}

// ==================== ENDEREÇOS WMS ====================

export const addWmsAddress = async (inventoryId: string, endereco: string): Promise<WmsAddress | null> => {
  const inventories = await getInventories()
  const index = inventories.findIndex((inv) => inv._id === inventoryId)
  if (index === -1) return null
  if (!inventories[index].enderecos) inventories[index].enderecos = []
  const newAddress: WmsAddress = { _id: generateUUID(), endereco, itens: [] }
  inventories[index].enderecos!.push(newAddress)
  await saveInventories(inventories)
  return newAddress
}

export const deleteWmsAddress = async (inventoryId: string, addressId: string): Promise<boolean> => {
  const inventories = await getInventories()
  const invIndex = inventories.findIndex((inv) => inv._id === inventoryId)
  if (invIndex === -1) return false
  const enderecos = inventories[invIndex].enderecos || []
  const addrIndex = enderecos.findIndex((a) => a._id === addressId)
  if (addrIndex === -1) return false
  enderecos.splice(addrIndex, 1)
  inventories[invIndex].enderecos = enderecos
  await saveInventories(inventories)
  return true
}

export const getWmsAddresses = async (inventoryId: string): Promise<WmsAddress[]> => {
  const inv = await getInventoryById(inventoryId)
  return inv?.enderecos || []
}

export const updateWmsAddress = async (inventoryId: string, addressId: string, newEndereco: string): Promise<WmsAddress | null> => {
  const inventories = await getInventories()
  const invIndex = inventories.findIndex((inv) => inv._id === inventoryId)
  if (invIndex === -1) return null
  const enderecos = inventories[invIndex].enderecos || []
  const addrIndex = enderecos.findIndex((a) => a._id === addressId)
  if (addrIndex === -1) return null
  enderecos[addrIndex] = { ...enderecos[addrIndex], endereco: newEndereco }
  inventories[invIndex].enderecos = enderecos
  await saveInventories(inventories)
  return enderecos[addrIndex]
}

export const importWmsAddresses = async (inventoryId: string, enderecosList: string[]): Promise<WmsAddress[]> => {
  const inventories = await getInventories()
  const invIndex = inventories.findIndex((inv) => inv._id === inventoryId)
  if (invIndex === -1) return []
  if (!inventories[invIndex].enderecos) inventories[invIndex].enderecos = []
  const existing = inventories[invIndex].enderecos!.map((e) => e.endereco.trim().toUpperCase())
  const added: WmsAddress[] = []
  for (const end of enderecosList) {
    const clean = end.trim().toUpperCase()
    if (clean && !existing.includes(clean)) {
      const newAddr: WmsAddress = { _id: generateUUID(), endereco: clean, itens: [] }
      inventories[invIndex].enderecos!.push(newAddr)
      existing.push(clean)
      added.push(newAddr)
    }
  }
  await saveInventories(inventories)
  return added
}

// ==================== ITENS WMS ====================

export const addWmsItem = async (inventoryId: string, addressId: string, item: Omit<WmsCountedItem, "_id">): Promise<WmsCountedItem | null> => {
  const inventories = await getInventories()
  const invIndex = inventories.findIndex((inv) => inv._id === inventoryId)
  if (invIndex === -1) return null
  const enderecos = inventories[invIndex].enderecos || []
  const addrIndex = enderecos.findIndex((a) => a._id === addressId)
  if (addrIndex === -1) return null
  const newItem: WmsCountedItem = { ...item, _id: generateUUID() }
  enderecos[addrIndex].itens.push(newItem)
  inventories[invIndex].enderecos = enderecos
  await saveInventories(inventories)
  return newItem
}

export const updateWmsItem = async (inventoryId: string, addressId: string, itemId: string, updates: Partial<WmsCountedItem>): Promise<WmsCountedItem | null> => {
  const inventories = await getInventories()
  const invIndex = inventories.findIndex((inv) => inv._id === inventoryId)
  if (invIndex === -1) return null
  const enderecos = inventories[invIndex].enderecos || []
  const addrIndex = enderecos.findIndex((a) => a._id === addressId)
  if (addrIndex === -1) return null
  const itemIndex = enderecos[addrIndex].itens.findIndex((i) => i._id === itemId)
  if (itemIndex === -1) return null
  enderecos[addrIndex].itens[itemIndex] = { ...enderecos[addrIndex].itens[itemIndex], ...updates }
  inventories[invIndex].enderecos = enderecos
  await saveInventories(inventories)
  return enderecos[addrIndex].itens[itemIndex]
}

export const deleteWmsItem = async (inventoryId: string, addressId: string, itemId: string): Promise<boolean> => {
  const inventories = await getInventories()
  const invIndex = inventories.findIndex((inv) => inv._id === inventoryId)
  if (invIndex === -1) return false
  const enderecos = inventories[invIndex].enderecos || []
  const addrIndex = enderecos.findIndex((a) => a._id === addressId)
  if (addrIndex === -1) return false
  const itemIndex = enderecos[addrIndex].itens.findIndex((i) => i._id === itemId)
  if (itemIndex === -1) return false
  enderecos[addrIndex].itens.splice(itemIndex, 1)
  inventories[invIndex].enderecos = enderecos
  await saveInventories(inventories)
  return true
}

// ==================== CONFIGURAÇÃO DA LOJA ====================

export interface StoreConfig {
  store_id: string
  store_name: string
  email: string
  manager_phone: string
  manager_name: string
}

export const getStoreConfig = async (): Promise<StoreConfig | null> => {
  return readJsonFile<StoreConfig | null>(FILES.storeConfig, null)
}

export const saveStoreConfig = async (config: StoreConfig): Promise<StoreConfig> => {
  await writeJsonFile(FILES.storeConfig, config)
  return config
}

// ==================== UTILITÁRIOS ====================

const generateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const clearAllData = async (): Promise<void> => {
  await saveProducts([])
  await saveInventories([])
  await writeJsonFile(FILES.storeConfig, null)
}

export const importProductsFromCSV = async (csvContent: string): Promise<number> => {
  const lines = csvContent.split("\n").filter((line) => line.trim())
  if (lines.length === 0) return 0

  const firstLine = lines[0]
  const delimiter = firstLine.includes(";") ? ";" : ","
  const firstLineLower = firstLine.toLowerCase()
  const hasHeader = firstLineLower.includes("codigo") || firstLineLower.includes("código") || firstLineLower.includes("code") || firstLineLower.includes("ean") || firstLineLower.includes("descri")

  const startIndex = hasHeader ? 1 : 0
  let codeIndex = 0
  let eanIndex = 1
  let descIndex = 2

  if (hasHeader) {
    const headers = firstLine.split(delimiter).map((h) => h.trim().toLowerCase().replace(/['"]/g, ""))
    headers.forEach((header, index) => {
      if (header.includes("codigo") || header.includes("código") || header === "code") codeIndex = index
      else if (header.includes("ean")) eanIndex = index
      else if (header.includes("descri")) descIndex = index
    })
  }

  const products: Product[] = []

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values: string[] = []
    let currentValue = ""
    let inQuotes = false

    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes
      } else if (char === delimiter && !inQuotes) {
        values.push(currentValue.trim())
        currentValue = ""
      } else {
        currentValue += char
      }
    }
    values.push(currentValue.trim())

    const cleanValues = values.map((v) => v.replace(/^["']|["']$/g, "").trim())
    const code = cleanValues[codeIndex] || ""
    const ean = cleanValues[eanIndex] || ""
    const description = cleanValues[descIndex] || ""

    if (code) {
      products.push({ _id: generateUUID(), code, ean, description })
    }
  }

  await saveProducts(products)
  return products.length
}
