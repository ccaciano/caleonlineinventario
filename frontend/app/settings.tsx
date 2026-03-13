import React, { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { clearAllData } from "../services/api" // Ajuste o caminho conforme seu projeto

export default function SettingsScreen() {
  const [loading, setLoading] = useState(false)

  const handleClearAllData = () => {
    Alert.alert("Limpar Todos os Dados", "ATENÇÃO: Esta ação irá apagar permanentemente:\n\n• Configuração da Loja\n• Todos os Produtos\n• Todos os Inventários\n\nEsta ação não pode ser desfeita. Deseja continuar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sim, APAGAR TUDO",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true)
            await clearAllData()
            Alert.alert("Sucesso", "Banco de dados limpo com sucesso!")
          } catch (error) {
            Alert.alert("Erro", "Falha ao limpar os dados")
          } finally {
            setLoading(false)
          }
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Configurações do App</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Gerenciamento de Dados</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={handleClearAllData} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FF3B30" />
          ) : (
            <>
              <Ionicons name="trash-bin-outline" size={22} color="#FF3B30" />
              <Text style={styles.dangerText}>Apagar todos os dados</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.helperText}> Use esta opção apenas se desejar resetar o aplicativo completamente. </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F2F7", padding: 20 },
  headerTitle: { fontSize: 28, fontWeight: "bold", marginBottom: 24 },
  section: { backgroundColor: "#FFF", borderRadius: 12, padding: 16, gap: 12 },
  sectionLabel: { fontSize: 14, color: "#8E8E93", textTransform: "uppercase" },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#E5E5EA",
  },
  dangerText: { color: "#FF3B30", fontSize: 16, fontWeight: "600" },
  helperText: { fontSize: 12, color: "#8E8E93", marginTop: 4 },
})
