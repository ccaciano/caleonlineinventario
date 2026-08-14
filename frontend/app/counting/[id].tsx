import React, { useState, useCallback } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, FlatList } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useLocalSearchParams, useRouter } from "expo-router"
import { getInventory, getCountedItems, addCountedItem, deleteCountedItem, closeInventory, updateCountedItem, Inventory, CountedItem } from "../../services/api"
import BarcodeScanner from "../../components/BarcodeScanner"
import EditItemModal from "../../components/EditItemModal"
import CalculatorModal from "../../components/CalculatorModal"
import TorchButton from "../../components/TorchButton"
import { useFocusEffect } from "expo-router"

const isValidDate = (dateStr: string): boolean => {
  if (!dateStr) return true
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/
  const match = dateStr.match(regex)
  if (!match) return false
  const day = parseInt(match[1])
  const month = parseInt(match[2])
  const year = parseInt(match[3])
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100
}

const convertToISO = (dateStr: string): string => {
  if (!dateStr) return ""
  const [day, month, year] = dateStr.split("/")
  return `${year}-${month}-${day}`
}

const convertFromISO = (isoStr: any): string => {
  if (!isoStr || typeof isoStr !== "string") return "-"
  try {
    const datePart = isoStr.split("T")[0]
    const parts = datePart.split("-")
    if (parts.length !== 3) return isoStr
    const [year, month, day] = parts
    return `${day}/${month}/${year}`
  } catch {
    return "-"
  }
}

export default function CountingScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const inventoryId = Array.isArray(id) ? id[0] : id

  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [items, setItems] = useState<CountedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [scannerVisible, setScannerVisible] = useState(false)
  const [editItem, setEditItem] = useState<CountedItem | null>(null)
  const [scanTarget, setScanTarget] = useState<"code">("code")
  const [calculatorVisible, setCalculatorVisible] = useState(false)

  const [formData, setFormData] = useState({
    product_code: "",
    quantity: "",
    lot: "",
    expiry_date: "",
  })

  const loadData = useCallback(async () => {
    if (!inventoryId) return
    setLoading(true)
    try {
      const invData = await getInventory(inventoryId)
      const itemsData = await getCountedItems(inventoryId)
      setInventory(invData)
      setItems(itemsData)
    } catch (error) {
      console.error("Erro ao carregar:", error)
    } finally {
      setLoading(false)
    }
  }, [inventoryId])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData]),
  )

  const handleScan = (code: string) => {
    setScannerVisible(false)
    setFormData((prev) => ({ ...prev, product_code: code }))
  }

  const handleCalculatorResult = (value: number) => {
    const rounded = Math.min(Math.max(0, Math.round(value)), 9999999)
    setFormData((prev) => ({ ...prev, quantity: String(rounded) }))
  }

  const handleAddItem = async () => {
    if (!formData.product_code.trim()) {
      Alert.alert("Erro", "Informe o código do produto")
      return
    }
    if (!formData.quantity) {
      Alert.alert("Erro", "Preencha a quantidade")
      return
    }
    const quantity = parseInt(formData.quantity)
    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert("Quantidade inválida", "A quantidade deve ser um número maior que zero")
      return
    }
    if (formData.expiry_date && !isValidDate(formData.expiry_date)) {
      Alert.alert("Data inválida", "Use o formato DD/MM/AAAA")
      return
    }

    try {
      setLoading(true)
      const newItem = await addCountedItem(inventoryId, {
        product_code: formData.product_code.trim(),
        quantity,
        lot: formData.lot.trim() || "",
        expiry_date: formData.expiry_date ? convertToISO(formData.expiry_date) : "",
      })
      setItems([newItem, ...items])
      setFormData({ product_code: "", quantity: "", lot: "", expiry_date: "" })
      Alert.alert("Sucesso", "Item adicionado!")
    } catch (error) {
      console.error("Error adding item:", error)
      Alert.alert("Erro", "Falha ao adicionar item")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteItem = (item: CountedItem) => {
    Alert.alert("Excluir", "Confirma exclusão deste item?", [
      { text: "Não", style: "cancel" },
      {
        text: "Sim",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCountedItem(inventoryId, item._id!)
            setItems(items.filter((i) => i._id !== item._id))
          } catch (error: any) {
            Alert.alert("Ação não permitida", error.message || "Não foi possível excluir o item.")
          }
        },
      },
    ])
  }

  const handleEditSuccess = () => {
    setEditItem(null)
    loadData()
  }

  const handleCloseInventory = async () => {
    if (items.length === 0) {
      Alert.alert("Erro", "Adicione pelo menos um item antes de fechar o inventário")
      return
    }
    Alert.alert("Fechar Inventário", "Deseja realmente fechar este inventário?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Fechar",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true)
            const result = await closeInventory(inventoryId)
            if (result) setInventory(result)
            Alert.alert("Sucesso", "Inventário fechado com sucesso!")
          } catch {
            Alert.alert("Erro", "Não foi possível fechar o inventário.")
          } finally {
            setLoading(false)
          }
        },
      },
    ])
  }

  const renderItem = ({ item }: { item: CountedItem }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={styles.itemCodeContainer}>
          <Ionicons name="barcode-outline" size={20} color="#007AFF" />
          <Text style={styles.itemCode}>{item.product_code}</Text>
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity onPress={() => !isClosed && setEditItem(item)} style={[styles.actionButton, isClosed && { opacity: 0.3 }]} disabled={isClosed}>
            <Ionicons name="create-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteItem(item)} style={[styles.actionButton, isClosed && { opacity: 0.3 }]} disabled={isClosed}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.itemDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Quantidade:</Text>
          <Text style={styles.detailValue}>{item.quantity}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Lote:</Text>
          <Text style={styles.detailValue}>{item.lot || "-"}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Validade:</Text>
          <Text style={styles.detailValue}>{item.expiry_date ? convertFromISO(item.expiry_date) : "-"}</Text>
        </View>
      </View>
    </View>
  )

  if (loading && !inventory) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    )
  }

  if (!inventory) return null

  const isClosed = inventory?.status === "closed"

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            {isClosed && (
              <View style={styles.alertBanner}>
                <Ionicons name="lock-closed" size={16} color="#D32F2F" />
                <Text style={styles.alertText}>Contagem encerrada</Text>
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.title} numberOfLines={1}>{inventory.description}</Text>
              <Text style={styles.subtitle}>{convertFromISO(inventory.date)}</Text>
            </View>
          </View>
        </View>

        {/* Formulário de adição */}
        {!isClosed && (
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Adicionar Item</Text>

            {/* Botão Escanear */}
            <TouchableOpacity style={styles.scanButton} onPress={() => setScannerVisible(true)}>
              <Ionicons name="scan" size={28} color="#FFFFFF" />
              <Text style={styles.scanButtonText}>Escanear Código</Text>
            </TouchableOpacity>

            <View style={styles.form}>
              {/* Código */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Código do Produto</Text>
                <View style={styles.inputWithButton}>
                  <TextInput
                    style={styles.inputFlex}
                    value={formData.product_code}
                    onChangeText={(text) => setFormData({ ...formData, product_code: text })}
                    placeholder="Digite ou escaneie o código"
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              {/* Quantidade */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Quantidade *</Text>
                <View style={styles.inputWithButton}>
                  <TextInput
                    style={styles.inputFlex}
                    value={formData.quantity}
                    onChangeText={(text) => setFormData({ ...formData, quantity: text.replace(/[^0-9]/g, "").slice(0, 7) })}
                    placeholder="0"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={7}
                  />
                  <TouchableOpacity style={styles.iconButton} onPress={() => setCalculatorVisible(true)} accessibilityLabel="Abrir calculadora">
                    <Ionicons name="calculator-outline" size={22} color="#007AFF" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Lote */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Lote (opcional)</Text>
                <View style={styles.inputWithButton}>
                  <TextInput
                    style={styles.inputFlex}
                    value={formData.lot}
                    onChangeText={(text) => setFormData({ ...formData, lot: text.slice(0, 7) })}
                    placeholder="Ex: KG10001"
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                    maxLength={7}
                  />
                  <TorchButton accentColor="#007AFF" />
                </View>
              </View>

              {/* Validade */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Validade (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.expiry_date}
                  onChangeText={(text: string) => {
                    const rawPrev = formData.expiry_date.replace(/\D/g, "")
                    const rawNew = text.replace(/\D/g, "")
                    let raw = rawNew
                    // User deleted a slash: same digit count but shorter text → remove last digit too
                    if (rawNew.length >= rawPrev.length && text.length < formData.expiry_date.length) {
                      raw = rawNew.slice(0, -1)
                    }
                    raw = raw.slice(0, 8)
                    let f = raw
                    if (f.length > 2) f = f.slice(0, 2) + "/" + f.slice(2)
                    if (f.length > 5) f = f.slice(0, 5) + "/" + f.slice(5)
                    setFormData({ ...formData, expiry_date: f })
                  }}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>

              <TouchableOpacity
                style={[styles.addButton, (!formData.product_code.trim() || loading) && styles.addButtonDisabled]}
                onPress={handleAddItem}
                disabled={!formData.product_code.trim() || loading}
              >
                {loading ? <ActivityIndicator color="#FFFFFF" /> : (
                  <>
                    <Ionicons name="add-circle" size={24} color="#FFFFFF" />
                    <Text style={styles.addButtonText}>Adicionar Item</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Lista de itens */}
        <View style={styles.itemsSection}>
          <View style={styles.itemsHeader}>
            <Text style={styles.sectionTitle}>Itens Contados</Text>
            <Text style={styles.itemCount}>{items.length} itens</Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptyText}>Nenhum item ainda</Text>
              <Text style={styles.emptySubtext}>Escaneie ou digite o código acima</Text>
            </View>
          ) : (
            <FlatList data={items} renderItem={renderItem} keyExtractor={(item) => item._id || ""} scrollEnabled={false} contentContainerStyle={styles.itemsList} />
          )}
        </View>

        {!isClosed && items.length > 0 && (
          <TouchableOpacity style={styles.closeButton} onPress={handleCloseInventory} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : (
              <>
                <Ionicons name="lock-closed" size={24} color="#FFFFFF" />
                <Text style={styles.closeButtonText}>Fechar Inventário</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <CalculatorModal visible={calculatorVisible} initialValue={formData.quantity} accentColor="#007AFF" integerOnly onClose={() => setCalculatorVisible(false)} onApply={handleCalculatorResult} />

      <BarcodeScanner visible={scannerVisible} onClose={() => setScannerVisible(false)} onScan={handleScan} />

      {editItem && (
        <EditItemModal visible={!!editItem} item={editItem} inventoryId={inventoryId} onClose={() => setEditItem(null)} onSuccess={handleEditSuccess} />
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F2F7" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F2F2F7" },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, gap: 12 },
  backButton: { padding: 4 },
  headerContent: { flex: 1, flexDirection: "column", gap: 8 },
  alertBanner: { backgroundColor: "#FFEBEE", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#FFCDD2" },
  alertText: { color: "#D32F2F", fontWeight: "bold", fontSize: 13 },
  headerInfo: { width: "100%" },
  title: { fontSize: 20, fontWeight: "bold", color: "#000" },
  subtitle: { fontSize: 14, color: "#8E8E93" },
  inputSection: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#000" },
  scanButton: {
    backgroundColor: "#34C759",
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: 64,
  },
  scanButtonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold" },
  form: { gap: 12 },
  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: "#000" },
  inputWithButton: { flexDirection: "row", gap: 8, alignItems: "center" },
  inputFlex: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#000",
    minHeight: 48,
  },
  input: {
    backgroundColor: "#F2F2F7",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#000",
    minHeight: 48,
  },
  iconButton: { width: 44, height: 44, justifyContent: "center", alignItems: "center", borderRadius: 10, backgroundColor: "#E8F1FF", borderWidth: 1, borderColor: "#007AFF" },
  addButton: { backgroundColor: "#007AFF", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8, minHeight: 52 },
  addButtonDisabled: { backgroundColor: "#C7C7CC" },
  addButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  itemsSection: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, gap: 16 },
  itemsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemCount: { fontSize: 14, fontWeight: "600", color: "#8E8E93" },
  itemsList: { gap: 12 },
  itemCard: { backgroundColor: "#F2F2F7", borderRadius: 12, padding: 12 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#E5E5EA" },
  itemCodeContainer: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  itemCode: { fontSize: 16, fontWeight: "bold", color: "#000" },
  itemActions: { flexDirection: "row", gap: 8 },
  actionButton: { padding: 4 },
  itemDetails: { gap: 4 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  detailLabel: { fontSize: 13, color: "#8E8E93", fontWeight: "500", width: 90 },
  detailValue: { flex: 1, fontSize: 14, fontWeight: "600", color: "#000", textAlign: "right" },
  emptyState: { alignItems: "center", padding: 32 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#8E8E93", marginTop: 12 },
  emptySubtext: { fontSize: 14, color: "#C7C7CC", marginTop: 4 },
  closeButton: { backgroundColor: "#FF3B30", borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 56 },
  closeButtonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold" },
})
