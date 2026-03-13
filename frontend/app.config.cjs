module.exports = {
  expo: {
    name: "CaléOnline Inventário",
    slug: "caleo-online-v1",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "frontend",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.ccaciano.inventorymanager",
    },
    android: {
      package: "com.ccaciano.inventorymanager",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#007AFF",
      },
      // Adicionamos as permissões necessárias para o scanner e arquivos
      permissions: ["CAMERA", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE"],
    },
    plugins: ["expo-router", ["expo-camera", { cameraPermission: "Permitir uso da câmera para leitura de códigos de barras." }], "expo-file-system", "expo-sharing", "expo-document-picker"],
    extra: {
      eas: {},
    },
  },
}
