module.exports = {
  expo: {
    name: "CaléOnline Inventário",
    slug: "cale-online-inventario",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "frontend",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.marcosmascarenhas.inventorymanager",
    },
    android: {
      package: "com.marcosmascarenhas.inventorymanager",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#007AFF",
      },
      permissions: ["CAMERA", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE"],
    },
    plugins: ["expo-router", ["expo-camera", { cameraPermission: "Permitir uso da câmera." }], ["expo-file-system", { copyToCacheDirectory: true }], "expo-sharing", "expo-document-picker"],
    extra: {
      eas: {},
    },
  },
}
