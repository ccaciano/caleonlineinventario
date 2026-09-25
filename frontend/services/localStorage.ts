import * as FileSystem from "expo-file-system/legacy"

const DATA_DIR = `${FileSystem.documentDirectory}data/`

const FILES = {
  inventories: `${DATA_DIR}inventories.json`,
}

const ensureDataDir = async (): Promise<void> => {
  const dirInfo = await FileSystem.getInfoAsync(DATA_DIR)
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true })
  }
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

export interface Inventory {
  _id: string
  description: string
  date: string
  status: "open" | "closed"
  items: CountedItem[]
  item_count?: number
}

// ==================== INVENTÁRIOS ====================

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

// ==================== UTILITÁRIOS ====================

const generateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
