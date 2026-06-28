import React, { useState, useCallback } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator, RefreshControl } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router"
import { getInventory, getWmsAddresses, addWmsAddress, deleteWmsAddress, importWmsAddresses, updateWmsAddress, closeWmsInventory, Inventory, WmsAddress } from "../../services/api"
import AddressModal from "../../components/AddressModal"

const ADDRESS_REGEX = /^[A-Z]{2}\d{7}$/
const isValidAddress = (addr: string): boolean => ADDRESS_REGEX.test(addr)

const parseAddress = (addr: string) => ({
  rua: addr.substring(0, 2),
  posicao: addr.substring(2, 5),
  altura: addr.substring(5, 7),
  profundidade: addr.substring(7, 9),
})

const sortAddresses = (addresses: WmsAddress[]): WmsAddress[] =>
  [...addresses].sort((a, b) => {
    const pa = parseAddress(a.endereco)
    const pb = parseAddress(b.endereco)
    if (pa.rua !== pb.rua) return pa.rua.localeCompare(pb.rua)
    if (pa.posicao !== pb.posicao) return pa.posicao.localeCompare(pb.posicao)
    if (pa.altura !== pb.altura) return pa.altura.localeCompare(pb.altura)
    return pa.profundidade.localeCompare(pb.profundidade)
  })

const convertFromISO = (isoStr: string): string => {
  if (!isoStr) return ""
  const [year, month, day] = isoStr.split("-")
  return `${day}/${month}/${year}`
}

export default function WmsInventoryScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const inventoryId = Array.isArray(id) ? id[0] : id

  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [addresses, setAddresses] = useState<WmsAddress[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState("")
  const [savingEditId, setSavingEditId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!inventoryId) return
    setLoading(true)
    try {
      const inv = await getInventory(inventoryId)
      const addrs = await getWmsAddresses(inventoryId)
      setInventory(inv)
      setAddresses(sortAddresses(addrs))
    } catch (error) {
      console.error("Erro ao carregar WMS:", error)
    } finally {
      setLoading(false)
    }
  }, [inventoryId])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData]),
  )

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleAddressPress = (address: WmsAddress) => {
    if (editingAddressId) return
    router.push({
      pathname: "/wms-counting/[id]",
      params: { id: address._id, inventoryId, addressName: address.endereco },
    })
  }

  const handleDeleteAddress = (address: WmsAddress) => {
    Alert.alert("Excluir Endereço", `Excluir "${address.endereco}" e todos os seus itens?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            setDeletingId(address._id)
            await deleteWmsAddress(inventoryId, address._id)
            setAddresses((prev) => sortAddresses(prev.filter((a) => a._id !== address._id)))
          } catch (error: any) {
            Alert.alert("Erro", error.message || "Falha ao excluir endereço")
          } finally {
            setDeletingId(null)
          }
        },
      },
    ])
  }

  const startEdit = (address: WmsAddress) => {
    setEditingAddressId(address._id)
    setEditingText(address.endereco)
  }

  const cancelEdit = () => {
    setEditingAddressId(null)
    setEditingText("")
  }

  const handleSaveEdit = async () => {
    if (!editingAddressId) return
    const clean = editingText.trim().toUpperCase()
    if (!isValidAddress(clean)) {
      Alert.alert("Endereço inválido", "O endereço deve seguir o padrão XX0000000\n(2 letras + 7 dígitos, total 9 caracteres)")
      return
    }
    try {
      setSavingEditId(editingAddressId)
      await updateWmsAddress(inventoryId, editingAddressId, clean)
      setAddresses((prev) => sortAddresses(prev.map((a) => (a._id === editingAddressId ? { ...a, endereco: clean } : a))))
      setEditingAddressId(null)
      setEditingText("")
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Falha ao atualizar endereço")
    } finally {
      setSavingEditId(null)
    }
  }

  const handleAddSingle = async (endereco: string) => {
    const added = await addWmsAddress(inventoryId, endereco)
    setAddresses((prev) => sortAddresses([...prev, added]))
  }

  const handleImportList = async (enderecos: string[]) => {
    const added = await importWmsAddresses(inventoryId, enderecos)
    setAddresses((prev) => sortAddresses([...prev, ...added]))
  }

  const doCloseInventory = async () => {
    try {
      setLoading(true)
      const result = await closeWmsInventory(inventoryId)
      if (result) {
        setInventory(result)
        await loadData()
      }
      Alert.alert("Sucesso", "Inventário fechado!")
    } catch {
      Alert.alert("Erro", "Não foi possível fechar o inventário.")
    } finally {
      setLoading(false)
    }
  }

  const handleCloseInventory = async () => {
    if (addresses.length === 0) {
      Alert.alert("Erro", "Adicione pelo menos um endereço antes de fechar")
      return
    }

    const emptyAddresses = addresses.filter((a) => (a.itens?.length || 0) === 0)

    if (emptyAddresses.length > 0) {
      Alert.alert("Endereços sem itens", `${emptyAddresses.length} endereço(s) não possuem itens contados.\n\nDeseja encerrar mesmo assim? Esses endereços receberão um registro nulo.`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Encerrar", style: "destructive", onPress: doCloseInventory },
      ])
    } else {
      Alert.alert("Fechar Inventário", "Deseja realmente fechar este inventário WMS?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Fechar", style: "destructive", onPress: doCloseInventory },
      ])
    }
  }

  const totalItems = addresses.reduce((sum, a) => sum + (a.itens?.filter((i) => i.qtd !== null).length || 0), 0)
  const isClosed = inventory?.status === "closed"

  const renderAddress = ({ item }: { item: WmsAddress }) => {
    const isDeleting = deletingId === item._id
    const isEditing = editingAddressId === item._id
    const isSaving = savingEditId === item._id
    const itemCount = item.itens?.filter((i) => i.qtd !== null).length || 0
    const canEdit = !isClosed && itemCount === 0

    let parsed = { rua: "--", posicao: "---", altura: "--", profundidade: "--" }
    if (item.endereco && item.endereco.length >= 9) {
      parsed = parseAddress(item.endereco)
    }

    return (
      <TouchableOpacity style={styles.addressCard} onPress={() => !isEditing && handleAddressPress(item)} activeOpacity={isEditing ? 1 : 0.7} disabled={isDeleting}>
        <View style={styles.addressLeft}>
          <View style={styles.addressIconContainer}>
            <Ionicons name="location" size={22} color="#FF9500" />
          </View>
          <View style={styles.addressInfo}>
            {isEditing ? (
              <View style={styles.editRow}>
                <TextInput style={styles.editInput} value={editingText} onChangeText={(t) => setEditingText(t.toUpperCase())} autoCapitalize="characters" autoFocus maxLength={9} placeholder="XX0000000" placeholderTextColor="#999" />
                <TouchableOpacity onPress={handleSaveEdit} disabled={isSaving} style={styles.editActionBtn}>
                  {isSaving ? <ActivityIndicator size="small" color="#34C759" /> : <Ionicons name="checkmark" size={20} color="#34C759" />}
                </TouchableOpacity>
                <TouchableOpacity onPress={cancelEdit} style={styles.editActionBtn}>
                  <Ionicons name="close" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.addressCode}>{item.endereco}</Text>
            )}
            <Text style={styles.addressMeta}>
              Rua <Text style={styles.bold}>{parsed.rua}</Text> · Pos <Text style={styles.bold}>{parsed.posicao}</Text> · Alt <Text style={styles.bold}>{parsed.altura}</Text> · Prof <Text style={styles.bold}>{parsed.profundidade}</Text>
            </Text>
            <Text style={styles.addressItemCount}>
              {itemCount} item{itemCount !== 1 ? "s" : ""} contado{itemCount !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>
        {!isEditing && (
          <View style={styles.addressRight}>
            {canEdit && (
              <TouchableOpacity onPress={() => startEdit(item)} style={styles.editBtn}>
                <Ionicons name="create-outline" size={18} color="#007AFF" />
              </TouchableOpacity>
            )}
            {!isClosed && (
              <TouchableOpacity onPress={() => handleDeleteAddress(item)} style={styles.deleteBtn} disabled={isDeleting}>
                {isDeleting ? <ActivityIndicator size="small" color="#FF3B30" /> : <Ionicons name="trash-outline" size={18} color="#FF3B30" />}
              </TouchableOpacity>
            )}
            <Ionicons name="chevron-forward" size={20} color="#FF9500" />
          </View>
        )}
      </TouchableOpacity>
    )
  }

  if (loading && !inventory) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9500" />
      </View>
    )
  }

  if (!inventory) return null

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerCard}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FF9500" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          {isClosed && (
            <View style={styles.closedBanner}>
              <Ionicons name="lock-closed" size={14} color="#D32F2F" />
              <Text style={styles.closedBannerText}>Inventário encerrado</Text>
            </View>
          )}
          <Text style={styles.headerTitle} numberOfLines={1}>
            {inventory.description}
          </Text>
          <Text style={styles.headerSubtitle}>
            {convertFromISO(inventory.date)} · {addresses.length} endereços · {totalItems} itens
          </Text>
        </View>
      </View>

      <FlatList
        data={addresses}
        renderItem={renderAddress}
        keyExtractor={(item) => item._id}
        contentContainerStyle={[styles.listContent, addresses.length === 0 && styles.listContentEmpty]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>Nenhum endereço</Text>
            <Text style={styles.emptySubtitle}>Toque no botão + para adicionar endereços de contagem</Text>
          </View>
        }
        ListFooterComponent={
          !isClosed && addresses.length > 0 ? (
            <TouchableOpacity style={styles.closeInventoryButton} onPress={handleCloseInventory} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="lock-closed" size={22} color="#FFFFFF" />
                  <Text style={styles.closeInventoryText}>Fechar Inventário WMS</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FF9500" />}
      />

      {!isClosed && (
        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <AddressModal visible={modalVisible} onClose={() => setModalVisible(false)} onAddSingle={handleAddSingle} onImportList={handleImportList} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F2F7" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F2F2F7" },
  headerCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  backButton: { padding: 4 },
  headerContent: { flex: 1, gap: 6 },
  closedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFEBEE",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFCDD2",
    alignSelf: "flex-start",
  },
  closedBannerText: { fontSize: 12, fontWeight: "bold", color: "#D32F2F" },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#000" },
  headerSubtitle: { fontSize: 13, color: "#8E8E93" },
  listContent: { padding: 16, paddingTop: 8, gap: 10, paddingBottom: 100 },
  listContentEmpty: { flex: 1 },
  addressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  addressLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  addressIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFF3E0", justifyContent: "center", alignItems: "center" },
  addressInfo: { flex: 1, gap: 2 },
  editRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  editInput: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderWidth: 1.5,
    borderColor: "#007AFF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
    fontWeight: "bold",
    color: "#000",
  },
  editActionBtn: { padding: 4 },
  addressCode: { fontSize: 17, fontWeight: "bold", color: "#000" },
  addressMeta: { fontSize: 12, color: "#8E8E93" },
  bold: { fontWeight: "700", color: "#555" },
  addressItemCount: { fontSize: 13, color: "#FF9500", fontWeight: "600", marginTop: 2 },
  addressRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  editBtn: { padding: 6, borderRadius: 8, backgroundColor: "#E3F2FD" },
  deleteBtn: { padding: 6 },
  emptyState: { alignItems: "center", paddingTop: 64, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: "bold", color: "#000", marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: "#8E8E93", marginTop: 8, textAlign: "center" },
  closeInventoryButton: {
    backgroundColor: "#FF3B30",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 56,
    marginTop: 8,
  },
  closeInventoryText: { color: "#FFFFFF", fontSize: 17, fontWeight: "bold" },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FF9500",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
})
