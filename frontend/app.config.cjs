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
      permissions: ["CAMERA", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE"],
    },
    plugins: ["expo-router", ["expo-camera", { cameraPermission: "Permitir uso da câmera." }], ["expo-file-system", { copyToCacheDirectory: true }], "expo-sharing", "expo-document-picker"],
    extra: {
      eas: { projectId: "d24dde2b-807f-44ee-a62a-c0e2525f6daf" },
    },
  },
}
