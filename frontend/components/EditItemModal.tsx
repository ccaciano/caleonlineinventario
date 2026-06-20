import React, { useState, useEffect } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import Modal from "react-native-modal"
import { updateCountedItem, CountedItem } from "../services/api"

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

const convertFromISO = (isoStr: string): string => {
  if (!isoStr) return ""
  const parts = isoStr.split("-")
  if (parts.length !== 3) return ""
  const [year, month, day] = parts
  return `${day}/${month}/${year}`
}

interface EditItemModalProps {
  visible: boolean
  item: CountedItem
  inventoryId: string
  onClose: () => void
  onSuccess: () => void
}

export default function EditItemModal({ visible, item, inventoryId, onClose, onSuccess }: EditItemModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    product_code: item.product_code || "",
    quantity: item.quantity.toString(),
    lot: item.lot || "",
    expiry_date: convertFromISO(item.expiry_date || ""),
  })

  useEffect(() => {
    setFormData({
      product_code: item.product_code || "",
      quantity: item.quantity.toString(),
      lot: item.lot || "",
      expiry_date: convertFromISO(item.expiry_date || ""),
    })
  }, [item])

  const handleSave = async () => {
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
      await updateCountedItem(inventoryId, item._id!, {
        product_code: formData.product_code.trim(),
        quantity,
        lot: formData.lot || "",
        expiry_date: formData.expiry_date ? convertToISO(formData.expiry_date) : "",
      })
      onSuccess()
    } catch (error) {
      console.error("Error updating item:", error)
      Alert.alert("Erro", "Falha ao atualizar item")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      animationIn="slideInDown"
      animationOut="slideOutUp"
      backdropOpacity={0.5}
      style={[styles.modal, { justifyContent: "flex-start", margin: 0 }]}
      avoidKeyboard={Platform.OS === "ios"}
      propagateSwipe={true}
    >
      <View style={[styles.modalContent, styles.modalTop]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Editar Item</Text>
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Ionicons name="close" size={28} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Código do Produto</Text>
              <TextInput
                style={styles.input}
                value={formData.product_code}
                onChangeText={(text) => setFormData({ ...formData, product_code: text })}
                placeholder="Código do produto"
                autoCapitalize="characters"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Quantidade *</Text>
              <TextInput
                style={styles.input}
                value={formData.quantity}
                onChangeText={(text) => setFormData({ ...formData, quantity: text.replace(/[^0-9]/g, "") })}
                placeholder="Quantidade"
                keyboardType="numeric"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Lote (opcional)</Text>
              <TextInput
                style={styles.input}
                value={formData.lot}
                onChangeText={(text) => setFormData({ ...formData, lot: text })}
                placeholder="Lote"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Validade (opcional)</Text>
              <TextInput
                style={styles.input}
                value={formData.expiry_date}
                onChangeText={(text) => {
                  let formatted = text.replace(/\D/g, "")
                  if (formatted.length >= 2) formatted = formatted.slice(0, 2) + "/" + formatted.slice(2)
                  if (formatted.length >= 5) formatted = formatted.slice(0, 5) + "/" + formatted.slice(5, 9)
                  setFormData({ ...formData, expiry_date: formatted })
                }}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                maxLength={10}
                editable={!loading}
              />
            </View>

            <View style={styles.buttons}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={loading}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]} onPress={handleSave} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Salvar</Text>}
              </TouchableOpacity>
            </View>

            {Platform.OS === "android" && <View style={{ height: 100 }} />}
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modal: { justifyContent: "flex-end", margin: 0 },
  modalTop: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: Platform.OS === "android" ? 40 : 60,
    maxHeight: "90%",
    backgroundColor: "#FFF",
  },
  modalContent: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 400 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: "bold", color: "#000" },
  form: { gap: 16 },
  inputGroup: { gap: 8 },
  label: { fontSize: 16, fontWeight: "600", color: "#000" },
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
  buttons: { flexDirection: "row", gap: 12, marginTop: 8 },
  button: { flex: 1, borderRadius: 12, padding: 16, alignItems: "center", justifyContent: "center", minHeight: 52 },
  cancelButton: { backgroundColor: "#F2F2F7", borderWidth: 1, borderColor: "#E5E5EA" },
  cancelButtonText: { fontSize: 16, fontWeight: "600", color: "#000", textAlign: "center" },
  saveButton: { backgroundColor: "#007AFF" },
  saveButtonText: { fontSize: 16, fontWeight: "bold", color: "#FFFFFF", textAlign: "center" },
  buttonDisabled: { opacity: 0.6 },
})
