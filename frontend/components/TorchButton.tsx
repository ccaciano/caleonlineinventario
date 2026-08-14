import React, { useCallback, useEffect, useRef, useState } from "react"
import { View, TouchableOpacity, StyleSheet, Platform, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect } from "expo-router"

// Importar CameraView apenas para plataformas nativas
let CameraView: any = null
let useCameraPermissions: any = null
if (Platform.OS !== "web") {
  const cameraModule = require("expo-camera")
  CameraView = cameraModule.CameraView
  useCameraPermissions = cameraModule.useCameraPermissions
}

interface TorchButtonProps {
  accentColor?: string
  size?: number
}

const notify = (title: string, message: string) => {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(`${title}\n\n${message}`)
    return
  }
  Alert.alert(title, message)
}

/**
 * Botão que liga/desliga a lanterna (flash) do celular.
 * Nativo: monta uma CameraView invisível com enableTorch (a câmera precisa estar ativa para o flash acender).
 * Web: usa a constraint "torch" do MediaStreamTrack (disponível no Chrome Android).
 */
export default function TorchButton({ accentColor = "#007AFF", size = 22 }: TorchButtonProps) {
  const [permission, requestPermission] = useCameraPermissions ? useCameraPermissions() : [null, async () => null]
  const [torchOn, setTorchOn] = useState(false)
  const streamRef = useRef<any>(null)

  const stopWebTorch = useCallback(() => {
    const stream = streamRef.current
    streamRef.current = null
    if (!stream) return
    try {
      stream.getVideoTracks().forEach((track: any) => {
        try {
          track.applyConstraints({ advanced: [{ torch: false }] })
        } catch {}
        track.stop()
      })
    } catch {}
  }, [])

  const turnOff = useCallback(() => {
    if (Platform.OS === "web") stopWebTorch()
    setTorchOn(false)
  }, [stopWebTorch])

  // Garante que a lanterna apague ao sair da tela ou desmontar o componente
  useFocusEffect(
    useCallback(() => {
      return () => turnOff()
    }, [turnOff]),
  )

  useEffect(() => {
    return () => {
      if (Platform.OS === "web") stopWebTorch()
    }
  }, [stopWebTorch])

  const toggleWeb = async () => {
    if (torchOn) {
      turnOff()
      return
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      notify("Lanterna indisponível", "Este navegador não permite acessar a lanterna do dispositivo.")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } })
      const track: any = stream.getVideoTracks()[0]
      const capabilities = track?.getCapabilities ? track.getCapabilities() : null
      if (!capabilities || !("torch" in capabilities)) {
        stream.getTracks().forEach((t: any) => t.stop())
        notify("Lanterna indisponível", "Este dispositivo/navegador não expõe o controle da lanterna.")
        return
      }
      await track.applyConstraints({ advanced: [{ torch: true }] })
      streamRef.current = stream
      setTorchOn(true)
    } catch {
      notify("Lanterna indisponível", "Não foi possível ligar a lanterna. Verifique a permissão de câmera.")
    }
  }

  const toggleNative = async () => {
    if (torchOn) {
      setTorchOn(false)
      return
    }
    if (!permission?.granted) {
      const result = await requestPermission()
      if (!result?.granted) {
        notify("Permissão necessária", "Permita o acesso à câmera para usar a lanterna.")
        return
      }
    }
    setTorchOn(true)
  }

  const handlePress = () => {
    if (Platform.OS === "web") {
      toggleWeb()
    } else {
      toggleNative()
    }
  }

  return (
    <>
      <TouchableOpacity style={[styles.button, { borderColor: accentColor }, torchOn && { backgroundColor: accentColor }]} onPress={handlePress} accessibilityLabel={torchOn ? "Apagar lanterna" : "Acender lanterna"}>
        <Ionicons name={torchOn ? "flashlight" : "flashlight-outline"} size={size} color={torchOn ? "#FFFFFF" : accentColor} />
      </TouchableOpacity>

      {torchOn && Platform.OS !== "web" && CameraView ? (
        <View style={styles.hiddenCamera} pointerEvents="none">
          <CameraView style={styles.hiddenCameraView} facing="back" enableTorch />
        </View>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "#FFF9E6",
    borderWidth: 1,
  },
  // A câmera precisa estar renderizada para o flash permanecer aceso
  hiddenCamera: { position: "absolute", top: 0, left: 0, width: 1, height: 1, opacity: 0.01 },
  hiddenCameraView: { width: 1, height: 1 },
})
