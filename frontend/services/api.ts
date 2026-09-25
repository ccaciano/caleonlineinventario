import * as LocalStorage from "./localStorage"

export type Inventory = LocalStorage.Inventory
export type CountedItem = LocalStorage.CountedItem

export interface ExportData {
  inventory: Inventory
  items: CountedItem[]
}

// ==================== INVENTÁRIOS ====================

export const getInventories = async (): Promise<Inventory[]> => {
  const inventories = (await LocalStorage.getInventories()) || []
  if (!Array.isArray(inventories)) return []

  return inventories.map((inv) => ({ ...inv, item_count: inv.items ? inv.items.length : 0 }))
}

export const createInventory = async (description: string, date: string): Promise<Inventory> => {
  return LocalStorage.createInventory(description, date)
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

// ==================== EXPORTAÇÃO ====================

export const getExportData = async (inventoryId: string): Promise<ExportData> => {
  const inventory = await LocalStorage.getInventoryById(inventoryId)
  if (!inventory) throw new Error("Inventário não encontrado")
  return { inventory, items: inventory.items }
}
