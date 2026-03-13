import React, { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView } from "react-native"
import { useTranslation } from "react-i18next"
import { Ionicons } from "@expo/vector-icons"
import Modal from "react-native-modal"
import { createProduct } from "../services/api"

interface AddProductModalProps {
  visible: boolean
  initialCode: string
  onClose: () => void
  onSuccess: (product: { code: string; ean: string; description: string }) => void
}

export default function AddProductModal({ visible, initialCode, onClose, onSuccess }: AddProductModalProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    code: initialCode,
    ean: "",
    description: "",
  })

  React.useEffect(() => {
    if (visible) {
      setFormData({
        code: initialCode,
        ean: "",
        description: "",
      })
    }
  }, [visible, initialCode])

  const handleAdd = async () => {
    // Apenas código e descrição são obrigatórios, EAN é opcional
    if (!formData.code || !formData.description) {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert("Código e Descrição são obrigatórios")
      } else {
        Alert.alert(t("fillAllFields"), "Código e Descrição são obrigatórios")
      }
      return
    }

    try {
      setLoading(true)
      const productData = {
        code: formData.code,
        ean: formData.ean || "", // EAN pode ser vazio
        description: formData.description,
      }
      await createProduct(productData)
      onSuccess(productData)
    } catch (error) {
      console.error("Error creating product:", error)
      const errorMessage = error instanceof Error ? error.message : "Falha ao cadastrar produto"
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(errorMessage)
      } else {
        Alert.alert("Erro", errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setFormData({ code: "", ean: "", description: "" })
      onClose()
    }
  }

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      // Alinhado com a estratégia de descer do topo
      animationIn="slideInDown"
      animationOut="slideOutUp"
      backdropOpacity={0.5}
      // Posicionamento no topo e remoção de margens
      style={[styles.modal, { justifyContent: "flex-start", margin: 0 }]}
      avoidKeyboard={Platform.OS === "ios"}
      propagateSwipe={true}
    >
      <View style={[styles.modalContent, styles.modalTop]}>
        <View style={styles.modalHeader}>
          <Ionicons name="alert-circle" size={32} color="#FF9500" />
          <Text style={styles.modalTitle}>{t("productNotFound")}</Text>
          <TouchableOpacity onPress={handleClose} disabled={loading}>
            <Ionicons name="close" size={28} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        <Text style={styles.message}>{t("productNotFoundMessage")}</Text>

        <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("productCode")} *</Text>
              <TextInput style={styles.input} value={formData.code} onChangeText={(text) => setFormData({ ...formData, code: text })} placeholder={t("productCode")} placeholderTextColor="#999" editable={!loading} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("ean")} (opcional)</Text>
              <TextInput style={styles.input} value={formData.ean} onChangeText={(text) => setFormData({ ...formData, ean: text })} placeholder={t("ean")} placeholderTextColor="#999" editable={!loading} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("description")} *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder={t("description")}
                placeholderTextColor="#999"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                editable={!loading}
              />
            </View>

            <View style={styles.buttons}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleClose} disabled={loading}>
                <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.addButton, loading && styles.buttonDisabled]} onPress={handleAdd} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.addButtonText}>{t("registerProduct")}</Text>}
              </TouchableOpacity>
            </View>

            {/* Espaçador para Android */}
            {Platform.OS === "android" && <View style={{ height: 100 }} />}
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: "flex-end",
    margin: 0,
  },
  modalTop: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    padding: 24,
    paddingTop: Platform.OS === "android" ? 45 : 60, // Ajuste para o notch
    maxHeight: "90%",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 450,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
    marginLeft: 12,
  },
  message: {
    fontSize: 16,
    color: "#8E8E93",
    marginBottom: 24,
    lineHeight: 22,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
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
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  cancelButton: {
    backgroundColor: "#F2F2F7",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  addButton: {
    backgroundColor: "#34C759",
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
})
