import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.lifelog.app",
  appName: "LifeLog",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#080b09",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#080b09",
      overlaysWebView: true,
    },
    LocalNotifications: {
      smallIcon: "ic_launcher",
      iconColor: "#4fa3a5",
    },
  },
};

export default config;
