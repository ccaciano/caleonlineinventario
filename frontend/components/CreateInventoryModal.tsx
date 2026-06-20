import React, { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView } from "react-native"
import { useTranslation } from "react-i18next"
import { Ionicons } from "@expo/vector-icons"
import Modal from "react-native-modal"
import { createInventory } from "../services/api"

interface CreateInventoryModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}

const isValidDate = (dateStr: string): boolean => {
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/
  const match = dateStr.match(regex)
  if (!match) return false
  const day = parseInt(match[1])
  const month = parseInt(match[2])
  const year = parseInt(match[3])
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100
}

const convertToISO = (dateStr: string): string => {
  const [day, month, year] = dateStr.split("/")
  return `${year}-${month}-${day}`
}

const getCurrentDateFormatted = (): string => {
  const today = new Date()
  const day = String(today.getDate()).padStart(2, "0")
  const month = String(today.getMonth() + 1).padStart(2, "0")
  return `${day}/${month}/${today.getFullYear()}`
}

export default function CreateInventoryModal({ visible, onClose, onSuccess }: CreateInventoryModalProps) {
  const { t } = useTranslation()
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(getCurrentDateFormatted())
  const [type, setType] = useState<"loja" | "wms">("loja")
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!description || !date) {
      Alert.alert(t("fillAllFields"))
      return
    }
    if (!isValidDate(date)) {
      Alert.alert(t("invalidDate"), "Use o formato DD/MM/AAAA")
      return
    }
    try {
      setLoading(true)
      await createInventory(description, convertToISO(date), type)
      setDescription("")
      setDate(getCurrentDateFormatted())
      setType("loja")
      onSuccess()
    } catch (error) {
      console.error("Error creating inventory:", error)
      Alert.alert("Erro", "Falha ao criar inventário")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setDescription("")
      setDate(getCurrentDateFormatted())
      setType("loja")
      onClose()
    }
  }

  const handleDateChange = (text: string) => {
    let formatted = text.replace(/\D/g, "")
    if (formatted.length >= 2) formatted = formatted.slice(0, 2) + "/" + formatted.slice(2)
    if (formatted.length >= 5) formatted = formatted.slice(0, 5) + "/" + formatted.slice(5, 9)
    setDate(formatted)
  }

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      animationIn="slideInDown"
      animationOut="slideOutUp"
      backdropOpacity={0.5}
      style={[styles.modal, { justifyContent: "flex-start", margin: 0 }]}
      avoidKeyboard={Platform.OS === "ios"}
      propagateSwipe={true}
    >
      <View style={[styles.modalContent, styles.modalTop]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t("newInventory")}</Text>
          <TouchableOpacity onPress={handleClose} disabled={loading}>
            <Ionicons name="close" size={28} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.form}>

            {/* Seleção de tipo */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tipo de Inventário</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[styles.typeButton, type === "loja" && styles.typeButtonActive]}
                  onPress={() => setType("loja")}
                  disabled={loading}
                >
                  <Ionicons name="storefront-outline" size={20} color={type === "loja" ? "#FFFFFF" : "#007AFF"} />
                  <Text style={[styles.typeButtonText, type === "loja" && styles.typeButtonTextActive]}>Inv. Loja</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, type === "wms" && styles.typeButtonActiveWms]}
                  onPress={() => setType("wms")}
                  disabled={loading}
                >
                  <Ionicons name="cube-outline" size={20} color={type === "wms" ? "#FFFFFF" : "#FF9500"} />
                  <Text style={[styles.typeButtonText, type === "wms" && styles.typeButtonTextActive]}>Inv. WMS</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.hint}>
                {type === "loja" ? "Contagem simples por código, lote e validade" : "Contagem por endereço de armazenamento (Rua/Posição/Altura/Prof.)"}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("description")}</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder={t("description")}
                placeholderTextColor="#999"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("date")}</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={handleDateChange}
                placeholder="DD/MM/AAAA"
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={10}
                editable={!loading}
              />
              <Text style={styles.hint}>Formato: DD/MM/AAAA</Text>
            </View>

            <View style={styles.buttons}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleClose} disabled={loading}>
                <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, type === "wms" ? styles.createButtonWms : styles.createButton, loading && styles.buttonDisabled]}
                onPress={handleCreate}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.createButtonText}>{t("create")}</Text>}
              </TouchableOpacity>
            </View>

            {Platform.OS === "android" && <View style={{ height: 60 }} />}
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modal: { justifyContent: "flex-end", margin: 0 },
  modalTop: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    padding: 24,
    paddingTop: Platform.OS === "android" ? 45 : 60,
    maxHeight: "90%",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 350,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: { fontSize: 24, fontWeight: "bold", color: "#000" },
  form: { gap: 16 },
  inputGroup: { gap: 8 },
  label: { fontSize: 16, fontWeight: "600", color: "#000" },
  typeSelector: { flexDirection: "row", gap: 12 },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#007AFF",
    backgroundColor: "#F0F8FF",
  },
  typeButtonActive: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  typeButtonActiveWms: { backgroundColor: "#FF9500", borderColor: "#FF9500" },
  typeButtonText: { fontSize: 15, fontWeight: "700", color: "#007AFF" },
  typeButtonTextActive: { color: "#FFFFFF" },
  input: {
    backgroundColor: "#F2F2F7",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#000",
    minHeight: 52,
  },
  hint: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  buttons: { flexDirection: "row", gap: 12, marginTop: 8 },
  button: { flex: 1, borderRadius: 12, padding: 16, alignItems: "center", justifyContent: "center", minHeight: 52 },
  cancelButton: { backgroundColor: "#F2F2F7", borderWidth: 1, borderColor: "#E5E5EA" },
  cancelButtonText: { fontSize: 16, fontWeight: "600", color: "#000", textAlign: "center" },
  createButton: { backgroundColor: "#007AFF" },
  createButtonWms: { backgroundColor: "#FF9500" },
  createButtonText: { fontSize: 16, fontWeight: "bold", color: "#FFFFFF", textAlign: "center" },
  buttonDisabled: { opacity: 0.6 },
})
