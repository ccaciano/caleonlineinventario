import React, { useEffect, useMemo, useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native"
import { Ionicons } from "@expo/vector-icons"

interface CalculatorModalProps {
  visible: boolean
  initialValue?: string
  accentColor?: string
  /** Quando true, o resultado é arredondado para inteiro ao aplicar */
  integerOnly?: boolean
  onClose: () => void
  onApply: (value: number) => void
}

/**
 * Avalia uma expressão aritmética simples (+ - * /) com parênteses.
 * Suporta multiplicação implícita: "2(3+4)" = 14.
 * Lança erro quando a expressão é inválida.
 */
export const evaluateExpression = (input: string): number => {
  const src = input.replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/,/g, ".")
  if (!src) throw new Error("Expressão vazia")

  let pos = 0

  const parseFactor = (): number => {
    if (pos >= src.length) throw new Error("Expressão incompleta")
    const c = src[pos]
    if (c === "+") {
      pos++
      return parseFactor()
    }
    if (c === "-") {
      pos++
      return -parseFactor()
    }
    if (c === "(") {
      pos++
      const inner = parseExpression()
      if (src[pos] !== ")") throw new Error("Parêntese não fechado")
      pos++
      return inner
    }
    const start = pos
    while (pos < src.length && /[0-9.]/.test(src[pos])) pos++
    if (pos === start) throw new Error("Caractere inesperado")
    const numStr = src.slice(start, pos)
    if ((numStr.match(/\./g) || []).length > 1) throw new Error("Número inválido")
    const value = parseFloat(numStr)
    if (isNaN(value)) throw new Error("Número inválido")
    return value
  }

  const parseTerm = (): number => {
    let value = parseFactor()
    while (pos < src.length) {
      const c = src[pos]
      if (c === "*" || c === "/") {
        pos++
        const rhs = parseFactor()
        if (c === "/") {
          if (rhs === 0) throw new Error("Divisão por zero")
          value /= rhs
        } else {
          value *= rhs
        }
      } else if (c === "(") {
        // multiplicação implícita: 2(3+4)
        value *= parseFactor()
      } else {
        break
      }
    }
    return value
  }

  function parseExpression(): number {
    let value = parseTerm()
    while (pos < src.length && (src[pos] === "+" || src[pos] === "-")) {
      const op = src[pos]
      pos++
      const rhs = parseTerm()
      value = op === "+" ? value + rhs : value - rhs
    }
    return value
  }

  const result = parseExpression()
  if (pos !== src.length) throw new Error("Expressão inválida")
  if (!isFinite(result)) throw new Error("Resultado inválido")
  return result
}

/** Fecha automaticamente os parênteses que ficaram abertos */
const balanceParens = (expr: string): string => {
  const open = (expr.match(/\(/g) || []).length
  const close = (expr.match(/\)/g) || []).length
  return open > close ? expr + ")".repeat(open - close) : expr
}

const formatResult = (value: number): string => {
  const rounded = Math.round(value * 1e6) / 1e6
  return String(rounded)
}

const OPERATORS = ["+", "-", "*", "/"]

const KEYS: { label: string; value: string; kind: "digit" | "op" | "action" }[][] = [
  [
    { label: "C", value: "C", kind: "action" },
    { label: "(", value: "(", kind: "op" },
    { label: ")", value: ")", kind: "op" },
    { label: "⌫", value: "BACK", kind: "action" },
  ],
  [
    { label: "7", value: "7", kind: "digit" },
    { label: "8", value: "8", kind: "digit" },
    { label: "9", value: "9", kind: "digit" },
    { label: "÷", value: "/", kind: "op" },
  ],
  [
    { label: "4", value: "4", kind: "digit" },
    { label: "5", value: "5", kind: "digit" },
    { label: "6", value: "6", kind: "digit" },
    { label: "×", value: "*", kind: "op" },
  ],
  [
    { label: "1", value: "1", kind: "digit" },
    { label: "2", value: "2", kind: "digit" },
    { label: "3", value: "3", kind: "digit" },
    { label: "−", value: "-", kind: "op" },
  ],
  [
    { label: "0", value: "0", kind: "digit" },
    { label: ",", value: ".", kind: "digit" },
    { label: "=", value: "=", kind: "action" },
    { label: "+", value: "+", kind: "op" },
  ],
]

const displayExpr = (expr: string): string => expr.replace(/\*/g, "×").replace(/\//g, "÷").replace(/\./g, ",")

export default function CalculatorModal({ visible, initialValue = "", accentColor = "#007AFF", integerOnly = false, onClose, onApply }: CalculatorModalProps) {
  const [expr, setExpr] = useState("")

  useEffect(() => {
    if (visible) {
      setExpr(/^\d+([.,]\d+)?$/.test(initialValue.trim()) ? initialValue.trim().replace(",", ".") : "")
    }
  }, [visible, initialValue])

  const preview = useMemo(() => {
    if (!expr) return { value: null as number | null, error: "" }
    try {
      return { value: evaluateExpression(balanceParens(expr)), error: "" }
    } catch (e: any) {
      return { value: null as number | null, error: e?.message || "Expressão inválida" }
    }
  }, [expr])

  const handleKey = (value: string) => {
    if (value === "C") {
      setExpr("")
      return
    }
    if (value === "BACK") {
      setExpr((prev) => prev.slice(0, -1))
      return
    }
    if (value === "=") {
      if (preview.value != null) setExpr(formatResult(preview.value))
      return
    }

    setExpr((prev) => {
      const last = prev.slice(-1)

      if (OPERATORS.includes(value)) {
        // Nenhum operador pode iniciar a expressão, exceto o sinal negativo
        if (!prev && value !== "-") return prev
        // Depois de "(" só cabe o sinal negativo
        if (last === "(" && value !== "-") return prev
        // Dois operadores seguidos: substitui o anterior
        if (OPERATORS.includes(last)) return prev.slice(0, -1) + value
        return prev + value
      }

      if (value === "(") return prev + "("

      if (value === ")") {
        const open = (prev.match(/\(/g) || []).length
        const close = (prev.match(/\)/g) || []).length
        if (open <= close) return prev
        if (!last || last === "(" || OPERATORS.includes(last)) return prev
        return prev + ")"
      }

      if (value === ".") {
        // Um único separador decimal por número
        const currentNumber = prev.split(/[+\-*/()]/).pop() || ""
        if (currentNumber.includes(".")) return prev
        if (!currentNumber) return prev + "0."
        return prev + "."
      }

      // Dígito logo após ")" → multiplicação implícita
      if (last === ")") return prev + "*" + value
      return prev + value
    })
  }

  const handleApply = () => {
    if (preview.value == null) return
    onApply(preview.value)
    onClose()
  }

  const willRound = integerOnly && preview.value != null && !Number.isInteger(preview.value)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1}>
          {/* Cabeçalho */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="calculator-outline" size={20} color={accentColor} />
              <Text style={styles.headerTitle}>Calculadora</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.headerCloseBtn}>
              <Ionicons name="close" size={22} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          {/* Visor */}
          <View style={styles.display}>
            <Text style={styles.displayExpr} numberOfLines={2} adjustsFontSizeToFit>
              {displayExpr(expr) || "0"}
            </Text>
            {preview.value != null ? (
              <Text style={[styles.displayResult, { color: accentColor }]} numberOfLines={1} adjustsFontSizeToFit>
                = {displayExpr(formatResult(preview.value))}
              </Text>
            ) : expr ? (
              <Text style={styles.displayError}>{preview.error}</Text>
            ) : (
              <Text style={styles.displayHint}>Ex: (2*3)+(10/2)</Text>
            )}
          </View>

          {/* Teclado */}
          <View style={styles.keypad}>
            {KEYS.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.keyRow}>
                {row.map((key) => {
                  const isEquals = key.value === "="
                  return (
                    <TouchableOpacity
                      key={key.value}
                      style={[styles.key, key.kind === "op" && styles.keyOp, key.kind === "action" && styles.keyAction, isEquals && { backgroundColor: accentColor }]}
                      onPress={() => handleKey(key.value)}
                    >
                      <Text style={[styles.keyText, key.kind === "op" && { color: accentColor }, isEquals && styles.keyTextEquals]}>{key.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ))}
          </View>

          {willRound && <Text style={styles.roundHint}>O resultado será arredondado para um número inteiro.</Text>}

          {/* Ações */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.applyBtn, { backgroundColor: accentColor }, preview.value == null && styles.applyBtnDisabled]} onPress={handleApply} disabled={preview.value == null}>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.applyBtnText}>Usar Resultado</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 16 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    width: "100%",
    maxWidth: 360,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: "bold", color: "#000" },
  headerCloseBtn: { padding: 4 },
  display: {
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    padding: 12,
    minHeight: 88,
    justifyContent: "center",
    gap: 4,
  },
  displayExpr: { fontSize: 22, color: "#000", textAlign: "right", fontWeight: "600" },
  displayResult: { fontSize: 26, fontWeight: "bold", textAlign: "right" },
  displayError: { fontSize: 13, color: "#FF3B30", textAlign: "right" },
  displayHint: { fontSize: 13, color: "#8E8E93", textAlign: "right" },
  keypad: { gap: 8 },
  keyRow: { flexDirection: "row", gap: 8 },
  key: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  keyOp: { backgroundColor: "#FFFFFF" },
  keyAction: { backgroundColor: "#EFEFF4" },
  keyText: { fontSize: 20, fontWeight: "600", color: "#000" },
  keyTextEquals: { color: "#FFFFFF" },
  roundHint: { fontSize: 12, color: "#FF9500", textAlign: "center" },
  footer: { flexDirection: "row", gap: 8 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: "#F2F2F7", justifyContent: "center", alignItems: "center" },
  cancelBtnText: { fontSize: 15, fontWeight: "600", color: "#8E8E93" },
  applyBtn: { flex: 2, height: 48, borderRadius: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  applyBtnDisabled: { backgroundColor: "#C7C7CC" },
  applyBtnText: { fontSize: 15, fontWeight: "bold", color: "#FFFFFF" },
})
