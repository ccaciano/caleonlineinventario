import * as FileSystem from "expo-file-system/legacy"

// Diretório base para armazenamento de dados
const DATA_DIR = `${FileSystem.documentDirectory}data/`

// Arquivos de dados
const FILES = {
  products: `${DATA_DIR}products.json`,
  inventories: `${DATA_DIR}inventories.json`,
  storeConfig: `${DATA_DIR}store_config.json`,
}

// Garantir que o diretório de dados existe
const ensureDataDir = async (): Promise<void> => {
  const dirInfo = await FileSystem.getInfoAsync(DATA_DIR)
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true })
  }
}

// Ler arquivo JSON
export const readJsonFile = async <T>(filePath: string, defaultValue: T): Promise<T> => {
  try {
    await ensureDataDir()
    const fileInfo = await FileSystem.getInfoAsync(filePath)

    if (!fileInfo.exists) {
      return defaultValue
    }

    const content = await FileSystem.readAsStringAsync(filePath, {
      encoding: "utf8",
    })

    return JSON.parse(content) as T
  } catch (error) {
    console.error(`Erro ao ler arquivo ${filePath}:`, error)
    return defaultValue
  }
}

// Escrever arquivo JSON
export const writeJsonFile = async <T>(filePath: string, data: T): Promise<void> => {
  try {
    await ensureDataDir()
    const content = JSON.stringify(data, null, 2)
    await FileSystem.writeAsStringAsync(filePath, content, {
      encoding: "utf8",
    })
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
  const newProduct: Product = {
    ...product,
    _id: generateUUID(),
  }
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

  return products.find((p) => p.code.toLowerCase() === queryLower || p.ean.toLowerCase() === queryLower) || null
}

export const getProductsPaginated = async (page: number, limit: number, search?: string): Promise<{ products: Product[]; total: number; page: number; totalPages: number }> => {
  let products = await getProducts()

  // Filtrar por busca se fornecido
  if (search) {
    const searchLower = search.toLowerCase()
    products = products.filter((p) => p.code.toLowerCase().includes(searchLower) || p.ean.toLowerCase().includes(searchLower) || p.description.toLowerCase().includes(searchLower))
  }

  const total = products.length
  const totalPages = Math.ceil(total / limit)
  const startIndex = (page - 1) * limit
  const paginatedProducts = products.slice(startIndex, startIndex + limit)

  return {
    products: paginatedProducts,
    total,
    page,
    totalPages,
  }
}

// ==================== INVENTÁRIOS ====================

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

export interface Inventory {
  _id: string
  description: string
  date: string
  status: "open" | "closed"
  items: CountedItem[]
  item_count?: number
}

export const getInventories = async (): Promise<Inventory[]> => {
  return readJsonFile<Inventory[]>(FILES.inventories, [])
}

export const saveInventories = async (inventories: Inventory[]): Promise<void> => {
  await writeJsonFile(FILES.inventories, inventories)
}

export const createInventory = async (description: string, date: string): Promise<Inventory> => {
  const inventories = await getInventories()
  const newInventory: Inventory = {
    _id: generateUUID(),
    description,
    date,
    status: "open",
    items: [],
  }
  inventories.push(newInventory)
  await saveInventories(inventories)
  return newInventory
}

export const getInventoryById = async (id: string): Promise<Inventory | null> => {
  const inventories = await getInventories()
  return inventories.find((inv) => inv._id === id) || null
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

// ==================== ITENS CONTADOS ====================

export const addCountedItem = async (inventoryId: string, item: Omit<CountedItem, "_id" | "inventory_id">): Promise<CountedItem | null> => {
  const inventories = await getInventories()
  const index = inventories.findIndex((inv) => inv._id === inventoryId)

  if (index === -1) return null

  const newItem: CountedItem = {
    ...item,
    _id: generateUUID(),
    inventory_id: inventoryId,
  }

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

  inventories[invIndex].items[itemIndex] = {
    ...inventories[invIndex].items[itemIndex],
    ...updates,
  }

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

// ==================== CONFIGURAÇÃO DA LOJA ====================

export interface StoreConfig {
  store_id: string
  store_name: string
  email: string
  manager_phone: string
  manager_name: string
}

export const getStoreConfig = async (): Promise<StoreConfig | null> => {
  const config = await readJsonFile<StoreConfig | null>(FILES.storeConfig, null)
  return config
}

export const saveStoreConfig = async (config: StoreConfig): Promise<StoreConfig> => {
  await writeJsonFile(FILES.storeConfig, config)
  return config
}

// ==================== UTILITÁRIOS ====================

// Gerar UUID simples
const generateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Limpar todos os dados
export const clearAllData = async (): Promise<void> => {
  await saveProducts([])
  await saveInventories([])
  await writeJsonFile(FILES.storeConfig, null)
}

// Importar produtos de CSV (substitui todos os produtos existentes)
export const importProductsFromCSV = async (csvContent: string): Promise<number> => {
  const lines = csvContent.split("\n").filter((line) => line.trim())

  if (lines.length === 0) {
    return 0
  }

  // Detectar delimitador (vírgula ou ponto-e-vírgula)
  const firstLine = lines[0]
  const delimiter = firstLine.includes(";") ? ";" : ","

  // Verificar se primeira linha é cabeçalho
  const firstLineLower = firstLine.toLowerCase()
  const hasHeader = firstLineLower.includes("codigo") || firstLineLower.includes("código") || firstLineLower.includes("code") || firstLineLower.includes("ean") || firstLineLower.includes("descri")

  const startIndex = hasHeader ? 1 : 0

  // Se tem cabeçalho, mapear as colunas
  let codeIndex = 0
  let eanIndex = 1
  let descIndex = 2

  if (hasHeader) {
    const headers = firstLine.split(delimiter).map((h) => h.trim().toLowerCase().replace(/['"]/g, ""))

    headers.forEach((header, index) => {
      if (header.includes("codigo") || header.includes("código") || header === "code") {
        codeIndex = index
      } else if (header.includes("ean")) {
        eanIndex = index
      } else if (header.includes("descri")) {
        descIndex = index
      }
    })
  }

  const products: Product[] = []

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Tratar campos com aspas que podem conter o delimitador
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

    // Limpar valores (remover aspas)
    const cleanValues = values.map((v) => v.replace(/^["']|["']$/g, "").trim())

    const code = cleanValues[codeIndex] || ""
    const ean = cleanValues[eanIndex] || ""
    const description = cleanValues[descIndex] || ""

    if (code) {
      // Só adiciona se tiver código
      products.push({
        _id: generateUUID(),
        code,
        ean,
        description,
      })
    }
  }

  await saveProducts(products)
  return products.length
}
