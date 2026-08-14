import React, { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import Modal from "react-native-modal"
import * as DocumentPicker from "expo-document-picker"
import * as FileSystem from "expo-file-system/legacy"
import BarcodeScanner from "./BarcodeScanner"
import { WmsAddress } from "../services/api"

const ADDRESS_REGEX = /^[A-Z]{2}\d{6,7}$/
const isValidAddress = (addr: string): boolean => ADDRESS_REGEX.test(addr)

export interface AddSingleResult {
  /** true quando o endereço já estava cadastrado no inventário */
  existed: boolean
  address: WmsAddress
}

interface AddressModalProps {
  visible: boolean
  onClose: () => void
  onAddSingle: (endereco: string) => Promise<AddSingleResult>
  onImportList: (enderecos: string[]) => Promise<void>
  /** Abre a tela de contagem do endereço informado */
  onOpenAddress: (address: WmsAddress) => void
}

export default function AddressModal({ visible, onClose, onAddSingle, onImportList, onOpenAddress }: AddressModalProps) {
  const [tab, setTab] = useState<"manual" | "import">("manual")
  const [manualText, setManualText] = useState("")
  const [scannerVisible, setScannerVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleClose = () => {
    if (!loading) {
      setManualText("")
      setTab("manual")
      onClose()
    }
  }

  /** Avisa que o endereço já existe e oferece abrir a contagem dele */
  const warnAndOpenExisting = (endereco: string, address: WmsAddress) => {
    const title = "Endereço já existe"
    const message = `"${endereco}" já está cadastrado neste inventário.\n\nDeseja abrir o endereço para iniciar a contagem?`
    const open = () => {
      setManualText("")
      setTab("manual")
      onOpenAddress(address)
    }

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) open()
      return
    }
    Alert.alert(title, message, [
      { text: "Fechar", style: "cancel" },
      { text: "Abrir Endereço", onPress: open },
    ])
  }

  const handleAddManual = async () => {
    const clean = manualText.trim().toUpperCase()
    if (!clean) {
      Alert.alert("Erro", "Digite o endereço")
      return
    }
    if (!isValidAddress(clean)) {
      Alert.alert("Endereço inválido", "O endereço deve seguir um dos padrões:\nXX0000000 (2 letras + 7 dígitos, 9 caracteres) — Ex: AA0010101\nXX000000 (2 letras + 6 dígitos, 8 caracteres) — Ex: BB010403")
      return
    }
    try {
      setLoading(true)
      const result = await onAddSingle(clean)
      setManualText("")
      if (result?.existed) {
        setLoading(false)
        warnAndOpenExisting(clean, result.address)
      }
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Falha ao adicionar endereço")
    } finally {
      setLoading(false)
    }
  }

  const handleScan = async (code: string) => {
    setScannerVisible(false)
    const clean = code.trim().toUpperCase()
    if (!clean) return
    if (!isValidAddress(clean)) {
      setManualText(clean)
      setTab("manual")
      Alert.alert(
        "Endereço inválido",
        `"${clean}" não segue os padrões aceitos (XX0000000 com 9 chars ou XX000000 com 8 chars).\n\nO valor foi inserido no campo manual para você corrigir.`,
      )
      return
    }
    try {
      setLoading(true)
      const result = await onAddSingle(clean)
      if (result?.existed) {
        setLoading(false)
        warnAndOpenExisting(clean, result.address)
      } else {
        Alert.alert("Sucesso", `Endereço "${clean}" adicionado!`)
      }
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Falha ao adicionar endereço")
    } finally {
      setLoading(false)
    }
  }

  const handleImportTxt = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "text/plain",
        copyToCacheDirectory: true,
      })

      if (result.canceled || !result.assets || result.assets.length === 0) return

      const asset = result.assets[0]
      setLoading(true)

      let content: string
      if (Platform.OS === "web") {
        const response = await fetch(asset.uri)
        content = await response.text()
      } else {
        content = await FileSystem.readAsStringAsync(asset.uri, { encoding: "utf8" })
      }

      const lines = content
        .split(/\r?\n/)
        .map((l) => l.trim().toUpperCase())
        .filter((l) => l.length > 0)

      if (lines.length === 0) {
        Alert.alert("Arquivo vazio", "Nenhum endereço encontrado no arquivo")
        return
      }

      const invalid = lines.filter((l) => !isValidAddress(l))
      if (invalid.length > 0) {
        const sample = invalid.slice(0, 5).join("\n")
        Alert.alert(
          "Endereços inválidos",
          `${invalid.length} endereço(s) não respeitam os padrões aceitos (XX0000000 com 9 chars ou XX000000 com 8 chars):\n\n${sample}${invalid.length > 5 ? "\n..." : ""}\n\nNenhum endereço foi importado.`,
        )
        return
      }

      await onImportList(lines)
      Alert.alert("Sucesso", `${lines.length} endereço(s) importado(s)!`)
      handleClose()
    } catch (error: any) {
      console.error("Erro ao importar:", error)
      Alert.alert("Erro", error.message || "Falha ao importar arquivo")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Modal
        isVisible={visible && !scannerVisible}
        onBackdropPress={handleClose}
        onBackButtonPress={handleClose}
        animationIn="slideInDown"
        animationOut="slideOutUp"
        backdropOpacity={0.5}
        style={{ justifyContent: "flex-start", margin: 0 }}
        avoidKeyboard={Platform.OS === "ios"}
        propagateSwipe={true}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Adicionar Endereço</Text>
            <TouchableOpacity onPress={handleClose} disabled={loading}>
              <Ionicons name="close" size={28} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity style={[styles.tab, tab === "manual" && styles.tabActive]} onPress={() => setTab("manual")}>
              <Ionicons name="create-outline" size={18} color={tab === "manual" ? "#FFFFFF" : "#007AFF"} />
              <Text style={[styles.tabText, tab === "manual" && styles.tabTextActive]}>Manual / Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, tab === "import" && styles.tabActive]} onPress={() => setTab("import")}>
              <Ionicons name="document-text-outline" size={18} color={tab === "import" ? "#FFFFFF" : "#007AFF"} />
              <Text style={[styles.tabText, tab === "import" && styles.tabTextActive]}>Importar TXT</Text>
            </TouchableOpacity>
          </View>

          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            {tab === "manual" ? (
              <View style={styles.content}>
                <View style={styles.patternBox}>
                  <Ionicons name="information-circle-outline" size={16} color="#007AFF" />
                  <Text style={styles.patternText}>Padrões aceitos:{"\n"}<Text style={styles.patternCode}>XX0000000</Text> — 2 letras + 7 dígitos (9 chars){"\n"}<Text style={styles.patternCode}>XX000000</Text> — 2 letras + 6 dígitos (8 chars)</Text>
                </View>

                <TouchableOpacity style={styles.scanButton} onPress={() => setScannerVisible(true)} disabled={loading}>
                  <Ionicons name="scan" size={24} color="#FFFFFF" />
                  <Text style={styles.scanButtonText}>Escanear Endereço</Text>
                </TouchableOpacity>

                <Text style={styles.separator}>— ou digite manualmente —</Text>

                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.inputFlex}
                    value={manualText}
                    onChangeText={(t) => setManualText(t.toUpperCase())}
                    placeholder="Ex: AA0010101"
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                    editable={!loading}
                    maxLength={9}
                  />
                  <TouchableOpacity style={[styles.addBtn, (!manualText.trim() || loading) && styles.addBtnDisabled]} onPress={handleAddManual} disabled={!manualText.trim() || loading}>
                    {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="add" size={24} color="#FFFFFF" />}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.content}>
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
                  <Text style={styles.infoText}>
                    Arquivo .txt com um endereço por linha:{"\n"}
                    Formato 9 chars: AA0010101{"\n"}
                    Formato 8 chars: BB010403{"\n"}
                    {"\n"}
                    Todos os endereços serão validados antes da importação.
                  </Text>
                </View>
                <TouchableOpacity style={[styles.importButton, loading && { opacity: 0.6 }]} onPress={handleImportTxt} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={24} color="#FFFFFF" />
                      <Text style={styles.importButtonText}>Selecionar Arquivo TXT</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
            {Platform.OS === "android" && <View style={{ height: 60 }} />}
          </ScrollView>
        </View>
      </Modal>

      <BarcodeScanner visible={scannerVisible} onClose={() => setScannerVisible(false)} onScan={handleScan} />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: Platform.OS === "android" ? 45 : 60,
    maxHeight: "85%",
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: "bold", color: "#000" },
  tabs: { flexDirection: "row", gap: 8, marginHorizontal: 24, marginBottom: 16 },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#007AFF", backgroundColor: "#F0F8FF",
  },
  tabActive: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#007AFF" },
  tabTextActive: { color: "#FFFFFF" },
  content: { paddingHorizontal: 24, paddingBottom: 16, gap: 16 },
  patternBox: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: "#E3F2FD", borderRadius: 10, padding: 10 },
  patternText: { flex: 1, fontSize: 13, color: "#333" },
  patternCode: { fontWeight: "bold", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  scanButton: {
    backgroundColor: "#34C759", borderRadius: 12, padding: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 52,
  },
  scanButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  separator: { textAlign: "center", color: "#8E8E93", fontSize: 13 },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  inputFlex: {
    flex: 1, backgroundColor: "#F2F2F7", borderWidth: 1, borderColor: "#E5E5EA",
    borderRadius: 12, padding: 14, fontSize: 16, color: "#000", minHeight: 50,
  },
  addBtn: { backgroundColor: "#007AFF", borderRadius: 12, padding: 13, minHeight: 50, justifyContent: "center", alignItems: "center" },
  addBtnDisabled: { backgroundColor: "#C7C7CC" },
  infoBox: { flexDirection: "row", gap: 10, backgroundColor: "#E3F2FD", borderRadius: 12, padding: 14, alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 13, color: "#333", lineHeight: 20 },
  importButton: { backgroundColor: "#007AFF", borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 52 },
  importButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
})
