import React, { useState, useEffect, useRef, useCallback } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native"
import { useTranslation } from "react-i18next"
import { Ionicons } from "@expo/vector-icons"
import Modal from "react-native-modal"

// Importar CameraView apenas para plataformas nativas
let CameraView: any = null
let useCameraPermissions: any = null
if (Platform.OS !== "web") {
  const cameraModule = require("expo-camera")
  CameraView = cameraModule.CameraView
  useCameraPermissions = cameraModule.useCameraPermissions
}

// Identidade estável: o hook precisa ser chamado incondicionalmente em todo render
const useCameraPermissionsSafe: any = useCameraPermissions || (() => [null, () => {}])

const SCAN_W = 300
const SCAN_H = 160

// Tipos com dígito verificador validável.
// UPC-E fica de fora de propósito: o dígito dele é calculado sobre o UPC-A expandido,
// então a conta direta nos 8 dígitos daria falso negativo.
const GTIN_VALIDATED_TYPES = ["ean13", "ean8", "upca"]

// "EAN_13", "ean13", "UPC_A", "upc_a", "QR_CODE", "qr" -> "ean13", "upca", "qrcode", "qr"
const normType = (t: string) => (t || "").toLowerCase().replace(/[_\s-]/g, "")

function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13].includes(code.length)) return false
  const digits = code.split("").map(Number)
  const check = digits.pop()!
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

// Exige N leituras consecutivas iguais antes de aceitar.
// QR é robusto contra leitura parcial, então exige menos.
function useScanFilter(onAccept: (code: string) => void) {
  const lastRef = useRef({ code: "", count: 0 })
  const onAcceptRef = useRef(onAccept)
  onAcceptRef.current = onAccept // evita callback desatualizado dentro do scanner

  // Só mexem em refs, então a identidade pode ser estável e entrar em deps de efeito.
  const accept = useCallback((raw: string, rawType: string) => {
    const code = (raw || "").trim()
    const type = normType(rawType)
    if (!code) return

    if (GTIN_VALIDATED_TYPES.includes(type) && !isValidGtin(code)) return

    const required = type.startsWith("qr") ? 1 : 3
    lastRef.current =
      lastRef.current.code === code
        ? { code, count: lastRef.current.count + 1 }
        : { code, count: 1 }

    if (lastRef.current.count >= required) {
      lastRef.current = { code: "", count: 0 }
      onAcceptRef.current(code)
    }
  }, [])

  const reset = useCallback(() => {
    lastRef.current = { code: "", count: 0 }
  }, [])

  return { accept, reset }
}

interface BarcodeScannerComponentProps {
  visible: boolean
  onClose: () => void
  onScan: (code: string) => void
}

// Componente para Web - Abordagem simplificada
function WebBarcodeScanner({ visible, onClose, onScan }: BarcodeScannerComponentProps) {
  const { t } = useTranslation()
  const [cameras, setCameras] = useState<any[]>([])
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const html5QrCodeRef = useRef<any>(null)
  const containerIdRef = useRef(`qr-scanner-${Date.now()}`)

  const { accept: acceptScan, reset: resetFilter } = useScanFilter(async (code) => {
    await cleanup()
    onScan(code)
  })

  // A lib só decodifica a região do qrbox, então a moldura também delimita a leitura.
  const buildStartConfig = () => ({
    fps: 10,
    qrbox: { width: SCAN_W, height: SCAN_H },
    videoConstraints: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      focusMode: "continuous",
    } as any,
  })

  useEffect(() => {
    if (visible && Platform.OS === "web") {
      initScanner()
    }

    return () => {
      cleanup()
    }
  }, [visible])

  const cleanup = async () => {
    try {
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop()
        } catch {}
        try {
          html5QrCodeRef.current.clear()
        } catch {}
        html5QrCodeRef.current = null
      }
    } catch {}

    // Remover container do DOM
    if (typeof document !== "undefined") {
      const container = document.getElementById(containerIdRef.current)
      if (container && container.parentNode) {
        container.parentNode.removeChild(container)
      }
    }
  }

  const initScanner = async () => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      setStatus("error")
      setErrorMessage("Ambiente web não disponível")
      return
    }

    setStatus("loading")
    setErrorMessage("")
    resetFilter()

    try {
      // Importar html5-qrcode
      const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import("html5-qrcode")

      // Obter lista de câmeras
      let devices
      try {
        devices = await Html5Qrcode.getCameras()
      } catch {
        setStatus("error")
        setErrorMessage("Não foi possível acessar as câmeras. Verifique as permissões.")
        return
      }

      if (!devices || devices.length === 0) {
        setStatus("error")
        setErrorMessage("Nenhuma câmera encontrada")
        return
      }

      setCameras(devices)

      // Encontrar câmera preferida (frontal para notebook)
      let preferredIndex = devices.findIndex((d: any) => d.label.toLowerCase().includes("front") || d.label.toLowerCase().includes("user") || d.label.toLowerCase().includes("facetime") || d.label.toLowerCase().includes("integrated"))
      if (preferredIndex === -1) preferredIndex = 0
      setCurrentCameraIndex(preferredIndex)

      // Criar container no DOM
      await cleanup() // Limpar anterior se existir

      const container = document.createElement("div")
      container.id = containerIdRef.current
      container.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 400px;
        height: 300px;
        z-index: 9999;
        background: #000;
        border-radius: 16px;
        overflow: hidden;
      `
      document.body.appendChild(container)

      // Iniciar scanner. formatsToSupport precisa ir no construtor: em start() é ignorado.
      html5QrCodeRef.current = new Html5Qrcode(containerIdRef.current, {
        verbose: false,
        formatsToSupport: [F.QR_CODE, F.CODE_128, F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E],
        useBarCodeDetectorIfSupported: true,
      })

      await html5QrCodeRef.current.start(
        devices[preferredIndex].id,
        buildStartConfig(),
        (text: string, result: any) => acceptScan(text, result?.result?.format?.formatName ?? ""),
        () => {}, // Ignorar erros de scan
      )

      setStatus("ready")
    } catch (e: any) {
      console.error("Scanner init error:", e)
      setStatus("error")
      setErrorMessage(e.message || "Erro ao inicializar scanner")
    }
  }

  const handleClose = async () => {
    await cleanup()
    onClose()
  }

  const switchCamera = async () => {
    if (cameras.length <= 1) return

    const nextIndex = (currentCameraIndex + 1) % cameras.length
    setCurrentCameraIndex(nextIndex)
    resetFilter()

    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop()
        await html5QrCodeRef.current.start(
          cameras[nextIndex].id,
          buildStartConfig(),
          (text: string, result: any) => acceptScan(text, result?.result?.format?.formatName ?? ""),
          () => {},
        )
      }
    } catch (e) {
      console.error("Error switching camera:", e)
    }
  }

  if (!visible) return null

  return (
    <Modal isVisible={visible} onBackdropPress={handleClose} onBackButtonPress={handleClose} style={styles.fullScreenModal} animationIn="fadeIn" animationOut="fadeOut">
      <View style={styles.scannerContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t("scannerTitle")}</Text>
          <View style={styles.headerButtons}>
            {cameras.length > 1 && (
              <TouchableOpacity onPress={switchCamera} style={styles.switchCameraButton}>
                <Ionicons name="camera-reverse" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={32} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Área central - o scanner é renderizado via DOM diretamente no body */}
        <View style={styles.cameraPlaceholder}>
          {status === "loading" && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>Inicializando câmera...</Text>
            </View>
          )}
          {status === "error" && (
            <View style={styles.statusContainer}>
              <Ionicons name="videocam-off" size={64} color="#FF3B30" />
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={initScanner}>
                <Text style={styles.retryButtonText}>Tentar Novamente</Text>
              </TouchableOpacity>
            </View>
          )}
          {status === "ready" && (
            <View style={styles.scanOverlay}>
              <View style={[styles.scanArea, { width: SCAN_W, height: SCAN_H }]} />
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.instructionsText}>{t("scannerInstructions")}</Text>
          {cameras.length > 0 && <Text style={styles.cameraTypeText}>Câmera: {cameras[currentCameraIndex]?.label || "Carregando..."}</Text>}
          <Text style={styles.tipText}>Se não funcionar, feche e digite o código manualmente</Text>
        </View>
      </View>
    </Modal>
  )
}

// Componente para dispositivos nativos (iOS/Android) usando expo-camera
function NativeBarcodeScanner({ visible, onClose, onScan }: BarcodeScannerComponentProps) {
  const { t } = useTranslation()
  const [permission, requestPermission] = useCameraPermissionsSafe()
  const [scanned, setScanned] = useState(false)
  const [facing, setFacing] = useState<"front" | "back">("back")
  const [layout, setLayout] = useState({ width: 0, height: 0 })

  const { accept: acceptScan, reset: resetFilter } = useScanFilter((code) => {
    setScanned(true)
    onScan(code)
  })

  useEffect(() => {
    if (visible) {
      setScanned(false)
      resetFilter()
    }
  }, [visible, resetFilter])

  // O código precisa estar TODO dentro da moldura, com uma folga pequena.
  const isInsideScanArea = (bounds?: {
    origin: { x: number; y: number }
    size: { width: number; height: number }
  }) => {
    if (!bounds || !layout.width) return false
    const tol = 8
    const left = (layout.width - SCAN_W) / 2 - tol
    const top = (layout.height - SCAN_H) / 2 - tol
    const right = left + SCAN_W + tol * 2
    const bottom = top + SCAN_H + tol * 2
    const { x, y } = bounds.origin
    return x >= left && y >= top && x + bounds.size.width <= right && y + bounds.size.height <= bottom
  }

  const handleBarCodeScanned = (result: any) => {
    if (scanned || !result?.data) return
    if (__DEV__) console.log("[scan]", result.type, result.data, result.bounds, layout)
    if (!isInsideScanArea(result.bounds)) return
    acceptScan(result.data, result.type)
  }

  const handleClose = () => {
    setScanned(false)
    onClose()
  }

  const toggleCameraFacing = () => {
    setFacing((current) => (current === "back" ? "front" : "back"))
  }

  if (!CameraView || !visible) return null

  // Verificar permissão
  if (!permission) {
    return (
      <Modal isVisible={visible} onBackdropPress={handleClose} style={styles.modal}>
        <View style={styles.permissionContainer}>
          <Text style={styles.statusText}>Carregando...</Text>
        </View>
      </Modal>
    )
  }

  if (!permission.granted) {
    return (
      <Modal isVisible={visible} onBackdropPress={handleClose} style={styles.modal}>
        <View style={styles.permissionContainer}>
          <Ionicons name="videocam-off" size={64} color="#8E8E93" />
          <Text style={styles.permissionTitle}>{t("cameraPermission")}</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>{t("grantPermission")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
            <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    )
  }

  return (
    <Modal isVisible={visible} onBackdropPress={handleClose} style={styles.fullScreenModal}>
      <View style={styles.scannerContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("scannerTitle")}</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={toggleCameraFacing} style={styles.switchCameraButton}>
              <Ionicons name="camera-reverse" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={32} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cameraContainer} onLayout={(e) => setLayout(e.nativeEvent.layout)}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing={facing}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "ean13", "ean8", "code128", "upc_a", "upc_e"],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          />
          <View style={styles.scanOverlay}>
            <View style={[styles.scanArea, { width: SCAN_W, height: SCAN_H }]} />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.instructionsText}>{t("scannerInstructions")}</Text>
          <Text style={styles.cameraTypeText}>Câmera: {facing === "front" ? "Frontal" : "Traseira"}</Text>
          {scanned && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                resetFilter()
                setScanned(false)
              }}
            >
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Escanear Novamente</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  )
}

export default function BarcodeScanner(props: BarcodeScannerComponentProps) {
  if (Platform.OS === "web") {
    return <WebBarcodeScanner {...props} />
  }
  return <NativeBarcodeScanner {...props} />
}

const styles = StyleSheet.create({
  modal: { margin: 0, justifyContent: "center", alignItems: "center" },
  fullScreenModal: { margin: 0 },
  permissionContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 16,
    maxWidth: 320,
  },
  permissionTitle: { fontSize: 18, fontWeight: "bold", color: "#000", textAlign: "center" },
  permissionButton: { backgroundColor: "#1D6DA0", borderRadius: 12, padding: 16, width: "100%", alignItems: "center" },
  permissionButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  cancelButton: { padding: 12 },
  cancelButtonText: { color: "#8E8E93", fontSize: 16 },
  scannerContainer: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: 48,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    zIndex: 100,
  },
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 20, fontWeight: "bold", color: "#FFFFFF" },
  switchCameraButton: { padding: 4, backgroundColor: "rgba(255, 255, 255, 0.2)", borderRadius: 8 },
  closeButton: { padding: 4 },
  cameraContainer: { flex: 1, position: "relative" },
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  statusContainer: {
    alignItems: "center",
    gap: 16,
    padding: 32,
  },
  statusText: { color: "#FFFFFF", fontSize: 16 },
  errorText: { color: "#FF3B30", fontSize: 16, textAlign: "center" },
  retryButton: {
    flexDirection: "row",
    backgroundColor: "#1D6DA0",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    gap: 8,
  },
  retryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  scanArea: {
    borderWidth: 3,
    borderColor: "#2BA74A",
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  footer: {
    padding: 24,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    alignItems: "center",
    gap: 8,
    zIndex: 100,
  },
  instructionsText: { fontSize: 16, color: "#FFFFFF", textAlign: "center" },
  cameraTypeText: { fontSize: 14, color: "#2BA74A", fontWeight: "600", textAlign: "center" },
  tipText: { fontSize: 12, color: "#FFD60A", textAlign: "center" },
})
