import React, { useState, useCallback } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, FlatList } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router"
import { getInventory, searchProduct, addWmsItem, deleteWmsItem, WmsCountedItem, Inventory, Product } from "../../services/api"
import BarcodeScanner from "../../components/BarcodeScanner"
import ProductFormModal from "../../components/ProductFormModal"

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

type ScanTarget = "code" | "lot"

export default function WmsCountingScreen() {
  const router = useRouter()
  const { id: addressId, inventoryId, addressName } = useLocalSearchParams()
  const addrId = Array.isArray(addressId) ? addressId[0] : addressId
  const invId = Array.isArray(inventoryId) ? inventoryId[0] : inventoryId
  const addrName = Array.isArray(addressName) ? addressName[0] : addressName

  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [items, setItems] = useState<WmsCountedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [scannerVisible, setScannerVisible] = useState(false)
  const [scanTarget, setScanTarget] = useState<ScanTarget>("code")
  const [searchingProduct, setSearchingProduct] = useState(false)
  const [productFound, setProductFound] = useState<{ code: string; ean: string; description: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [addProductModalVisible, setAddProductModalVisible] = useState(false)
  const [pendingSearchCode, setPendingSearchCode] = useState("")

  const [formData, setFormData] = useState({
    quantity: "",
    lot: "",
    expiry_date: "",
    unit: "UN" as "UN" | "CX",
    fator: "1",
  })

  const totalPecas = (() => {
    const qty = parseInt(formData.quantity || "0")
    const fat = parseInt(formData.fator || "0")
    if (isNaN(qty) || isNaN(fat)) return 0
    return qty * fat
  })()

  const loadData = useCallback(async () => {
    if (!invId || !addrId) return
    setLoading(true)
    try {
      const inv = await getInventory(invId)
      setInventory(inv)
      const addr = (inv.enderecos || []).find((a) => a._id === addrId)
      setItems(addr?.itens || [])
    } catch (error) {
      console.error("Erro ao carregar WMS Counting:", error)
    } finally {
      setLoading(false)
    }
  }, [invId, addrId])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData]),
  )

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchQuery("")
      setProductFound(null)
      return
    }
    setSearchQuery(query)
    setSearchingProduct(true)
    try {
      const product = await searchProduct(query)
      if (product) {
        setProductFound({ code: product.code, ean: product.ean || "", description: product.description })
      } else {
        setProductFound(null)
        setPendingSearchCode(query.trim())
        Alert.alert(
          "Produto não encontrado",
          `O código "${query.trim()}" não está cadastrado na base de produtos.\n\nDeseja cadastrar um novo produto?`,
          [
            { text: "Não", style: "cancel" },
            { text: "Sim", onPress: () => setAddProductModalVisible(true) },
          ],
        )
      }
    } catch {
      Alert.alert("Erro", "Falha ao buscar produto")
    } finally {
      setSearchingProduct(false)
    }
  }

  const handleProductAdded = async () => {
    setAddProductModalVisible(false)
    if (pendingSearchCode) {
      await handleSearch(pendingSearchCode)
    }
  }

  const handleScan = (code: string) => {
    setScannerVisible(false)
    if (scanTarget === "code") {
      setSearchQuery(code)
      handleSearch(code)
    } else {
      setFormData((prev) => ({ ...prev, lot: code }))
    }
  }

  const openScanner = (target: ScanTarget) => {
    setScanTarget(target)
    setScannerVisible(true)
  }

  const handleUnitChange = (newUnit: "UN" | "CX") => {
    setFormData((prev) => ({
      ...prev,
      unit: newUnit,
      fator: newUnit === "UN" ? "1" : "",
    }))
  }

  const handleAddItem = async () => {
    if (!productFound) {
      Alert.alert("Erro", "Busque um produto primeiro")
      return
    }
    if (!formData.quantity) {
      Alert.alert("Erro", "Informe a quantidade")
      return
    }
    const qty = parseInt(formData.quantity)
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Quantidade inválida", "A quantidade deve ser maior que zero")
      return
    }
    if (!formData.fator) {
      Alert.alert("Erro", "Informe o Fator de Conversão")
      return
    }
    const fat = parseInt(formData.fator)
    if (isNaN(fat) || fat <= 0) {
      Alert.alert("Fator inválido", "O fator de conversão deve ser maior que zero")
      return
    }
    if (formData.expiry_date && !isValidDate(formData.expiry_date)) {
      Alert.alert("Data inválida", "Use o formato DD/MM/AAAA")
      return
    }

    try {
      setLoading(true)
      const newItem = await addWmsItem(invId, addrId, {
        codigo: productFound.code,
        EAN: productFound.ean || undefined,
        descricao: productFound.description,
        unit: formData.unit,
        fator: fat,
        lote: formData.lot.trim() || "",
        validade: formData.expiry_date ? convertToISO(formData.expiry_date) : "",
        qtd: qty,
      })
      setItems((prev) => [...prev, newItem])
      setFormData({ quantity: "", lot: "", expiry_date: "", unit: "UN", fator: "1" })
      setSearchQuery("")
      setProductFound(null)
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Falha ao adicionar item")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteItem = (item: WmsCountedItem) => {
    Alert.alert("Excluir", "Confirma exclusão deste item?", [
      { text: "Não", style: "cancel" },
      {
        text: "Sim",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteWmsItem(invId, addrId, item._id)
            setItems((prev) => prev.filter((i) => i._id !== item._id))
          } catch (error: any) {
            Alert.alert("Erro", error.message || "Falha ao excluir item")
          }
        },
      },
    ])
  }

  const isClosed = inventory?.status === "closed"

  const renderItem = ({ item }: { item: WmsCountedItem }) => {
    const isNullItem = item.qtd === null || item.qtd === undefined
    const itemTotalPecas = !isNullItem && item.qtd != null && item.fator != null ? item.qtd * item.fator : null

    return (
      <View style={[styles.itemCard, isNullItem && styles.nullItemCard]}>
        {isNullItem ? (
          <Text style={styles.nullItemText}>— Endereço sem itens contados —</Text>
        ) : (
          <>
            <View style={styles.itemHeader}>
              <View style={styles.itemCodeRow}>
                <Ionicons name="barcode-outline" size={18} color="#FF9500" />
                <Text style={styles.itemCode}>{item.codigo}</Text>
              </View>
              {!isClosed && (
                <TouchableOpacity onPress={() => handleDeleteItem(item)} style={styles.actionBtn}>
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </View>
            {item.descricao ? <Text style={styles.itemDesc} numberOfLines={1}>{item.descricao}</Text> : null}
            <View style={styles.itemDetails}>
              <Text style={styles.detailChip}>Qtd: <Text style={styles.detailValue}>{item.qtd}</Text></Text>
              {item.unit ? <Text style={styles.detailChip}>UM: <Text style={styles.detailValue}>{item.unit}</Text></Text> : null}
              {item.fator != null ? <Text style={styles.detailChip}>Fator: <Text style={styles.detailValue}>{item.fator}</Text></Text> : null}
              {itemTotalPecas != null ? <Text style={[styles.detailChip, styles.totalChip]}>Total: <Text style={styles.detailValue}>{itemTotalPecas}</Text></Text> : null}
              {item.lote ? <Text style={styles.detailChip}>Lote: <Text style={styles.detailValue}>{item.lote}</Text></Text> : null}
              {item.validade ? <Text style={styles.detailChip}>Val: <Text style={styles.detailValue}>{convertFromISO(item.validade)}</Text></Text> : null}
            </View>
          </>
        )}
      </View>
    )
  }

  if (loading && !inventory) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#FF9500" /></View>
  }

  if (!inventory) return null

  return (
    <>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.navigate({ pathname: "/wms/[id]", params: { id: invId } })} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FF9500" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              {isClosed && (
                <View style={styles.closedBanner}>
                  <Ionicons name="lock-closed" size={13} color="#D32F2F" />
                  <Text style={styles.closedText}>Inventário encerrado</Text>
                </View>
              )}
              <Text style={styles.addressTitle}>{addrName || addrId}</Text>
              <Text style={styles.inventoryName} numberOfLines={1}>{inventory.description}</Text>
            </View>
          </View>

          {/* Formulário */}
          {!isClosed && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Adicionar Item</Text>

              {/* Busca de produto */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Código do Produto *</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.inputFlex}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={() => handleSearch(searchQuery)}
                    placeholder="Digite ou escaneie o código"
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity style={styles.scanIconBtn} onPress={() => openScanner("code")}>
                    <Ionicons name="scan-outline" size={22} color="#FF9500" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.searchBtn, searchingProduct && { opacity: 0.6 }]} onPress={() => handleSearch(searchQuery)} disabled={searchingProduct}>
                    {searchingProduct ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="search" size={20} color="#FFFFFF" />}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Produto encontrado */}
              {productFound && (
                <View style={styles.productFound}>
                  <View style={styles.productFoundHeader}>
                    <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                    <Text style={styles.productFoundTitle}>Produto Encontrado</Text>
                  </View>
                  <Text style={styles.productCode}>{productFound.code}</Text>
                  {productFound.ean ? <Text style={styles.productMeta}>EAN: {productFound.ean}</Text> : null}
                  <Text style={styles.productMeta} numberOfLines={2}>{productFound.description}</Text>
                </View>
              )}

              {/* Quantidade */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Quantidade *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.quantity}
                  onChangeText={(t) => setFormData({ ...formData, quantity: t.replace(/[^0-9]/g, "") })}
                  placeholder="0"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>

              {/* Unidade de Medida */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Unid. Medida *</Text>
                <View style={styles.unitRow}>
                  <TouchableOpacity
                    style={[styles.unitBtn, formData.unit === "UN" && styles.unitBtnActive]}
                    onPress={() => handleUnitChange("UN")}
                  >
                    <Text style={[styles.unitBtnText, formData.unit === "UN" && styles.unitBtnTextActive]}>UN</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.unitBtn, formData.unit === "CX" && styles.unitBtnActive]}
                    onPress={() => handleUnitChange("CX")}
                  >
                    <Text style={[styles.unitBtnText, formData.unit === "CX" && styles.unitBtnTextActive]}>CX</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Fator de Conversão */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Fator de Conversão *</Text>
                <TextInput
                  style={[styles.input, formData.unit === "UN" && styles.inputDisabled]}
                  value={formData.fator}
                  onChangeText={(t) => {
                    if (formData.unit === "CX") {
                      setFormData({ ...formData, fator: t.replace(/[^0-9]/g, "") })
                    }
                  }}
                  placeholder={formData.unit === "UN" ? "1 (fixo)" : "Digite o fator"}
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  editable={formData.unit === "CX"}
                />
              </View>

              {/* Total Peças (calculado) */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Total Peças</Text>
                <View style={styles.totalPecasBox}>
                  <Ionicons name="calculator-outline" size={18} color="#8E8E93" />
                  <Text style={styles.totalPecasValue}>{totalPecas}</Text>
                  <Text style={styles.totalPecasHint}>Qtd × Fator</Text>
                </View>
              </View>

              {/* Lote */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Lote (opcional)</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.inputFlex}
                    value={formData.lot}
                    onChangeText={(t) => setFormData({ ...formData, lot: t })}
                    placeholder="Ex: KG10001"
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity style={styles.scanIconBtn} onPress={() => openScanner("lot")}>
                    <Ionicons name="scan-outline" size={22} color="#FF9500" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Validade */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Validade (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.expiry_date}
                  onChangeText={(t) => {
                    let f = t.replace(/\D/g, "")
                    if (f.length >= 2) f = f.slice(0, 2) + "/" + f.slice(2)
                    if (f.length >= 5) f = f.slice(0, 5) + "/" + f.slice(5, 9)
                    setFormData({ ...formData, expiry_date: f })
                  }}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>

              <TouchableOpacity
                style={[styles.addButton, (!productFound || loading) && styles.addButtonDisabled]}
                onPress={handleAddItem}
                disabled={!productFound || loading}
              >
                {loading ? <ActivityIndicator color="#FFFFFF" /> : (
                  <>
                    <Ionicons name="add-circle" size={22} color="#FFFFFF" />
                    <Text style={styles.addButtonText}>Adicionar Item</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Lista de itens */}
          <View style={styles.itemsSection}>
            <View style={styles.itemsHeader}>
              <Text style={styles.sectionTitle}>Itens neste Endereço</Text>
              <Text style={styles.itemCount}>{items.filter(i => i.qtd !== null).length} item{items.filter(i => i.qtd !== null).length !== 1 ? "s" : ""}</Text>
            </View>
            {items.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={40} color="#C7C7CC" />
                <Text style={styles.emptyText}>Nenhum item ainda</Text>
              </View>
            ) : (
              <FlatList data={items} renderItem={renderItem} keyExtractor={(item) => item._id} scrollEnabled={false} contentContainerStyle={{ gap: 8 }} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BarcodeScanner visible={scannerVisible} onClose={() => setScannerVisible(false)} onScan={handleScan} />

      <ProductFormModal
        visible={addProductModalVisible}
        product={pendingSearchCode ? ({ code: pendingSearchCode, ean: "", description: "" } as Product) : null}
        onClose={() => setAddProductModalVisible(false)}
        onSuccess={handleProductAdded}
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F2F7" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F2F2F7" },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  backButton: { padding: 4 },
  headerContent: { flex: 1, gap: 4 },
  closedBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFEBEE", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: "#FFCDD2", alignSelf: "flex-start" },
  closedText: { fontSize: 11, fontWeight: "bold", color: "#D32F2F" },
  addressTitle: { fontSize: 22, fontWeight: "bold", color: "#FF9500" },
  inventoryName: { fontSize: 13, color: "#8E8E93" },
  formSection: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 17, fontWeight: "bold", color: "#000" },
  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: "#000" },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  inputFlex: {
    flex: 1, backgroundColor: "#F2F2F7", borderWidth: 1, borderColor: "#E5E5EA",
    borderRadius: 12, padding: 13, fontSize: 15, color: "#000", minHeight: 48,
  },
  input: {
    backgroundColor: "#F2F2F7", borderWidth: 1, borderColor: "#E5E5EA",
    borderRadius: 12, padding: 13, fontSize: 15, color: "#000", minHeight: 48,
  },
  inputDisabled: {
    backgroundColor: "#EBEBEB", color: "#8E8E93",
  },
  scanIconBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center", borderRadius: 10, backgroundColor: "#FFF3E0", borderWidth: 1, borderColor: "#FF9500" },
  searchBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center", borderRadius: 10, backgroundColor: "#FF9500" },
  unitRow: { flexDirection: "row", gap: 10 },
  unitBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
    borderColor: "#E5E5EA", backgroundColor: "#F2F2F7", alignItems: "center",
  },
  unitBtnActive: { backgroundColor: "#FF9500", borderColor: "#FF9500" },
  unitBtnText: { fontSize: 16, fontWeight: "bold", color: "#8E8E93" },
  unitBtnTextActive: { color: "#FFFFFF" },
  totalPecasBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#F9F9FB", borderWidth: 1, borderColor: "#E5E5EA",
    borderRadius: 12, padding: 13, minHeight: 48,
  },
  totalPecasValue: { fontSize: 18, fontWeight: "bold", color: "#FF9500" },
  totalPecasHint: { fontSize: 12, color: "#8E8E93", marginLeft: "auto" },
  productFound: { backgroundColor: "#E8F5E9", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#34C759", gap: 4 },
  productFoundHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  productFoundTitle: { fontSize: 14, fontWeight: "bold", color: "#34C759" },
  productCode: { fontSize: 16, fontWeight: "bold", color: "#000" },
  productMeta: { fontSize: 13, color: "#555" },
  addButton: { backgroundColor: "#FF9500", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, minHeight: 52 },
  addButtonDisabled: { backgroundColor: "#C7C7CC" },
  addButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  itemsSection: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  itemsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemCount: { fontSize: 13, fontWeight: "600", color: "#8E8E93" },
  itemCard: { backgroundColor: "#F2F2F7", borderRadius: 12, padding: 12, gap: 4 },
  nullItemCard: { backgroundColor: "#FFF3E0", borderWidth: 1, borderColor: "#FFCC80" },
  nullItemText: { fontSize: 13, color: "#FF9500", fontStyle: "italic", textAlign: "center", paddingVertical: 4 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemCodeRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  itemCode: { fontSize: 15, fontWeight: "bold", color: "#000" },
  itemDesc: { fontSize: 13, color: "#555" },
  itemDetails: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  detailChip: { fontSize: 12, backgroundColor: "#E3F2FD", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, color: "#555" },
  totalChip: { backgroundColor: "#FFF3E0" },
  detailValue: { fontWeight: "bold", color: "#000" },
  actionBtn: { padding: 4 },
  emptyState: { alignItems: "center", padding: 24 },
  emptyText: { fontSize: 15, color: "#8E8E93", marginTop: 8 },
})
