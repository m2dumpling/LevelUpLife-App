import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.leveluplife.app",
  appName: "LevelUp Life",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      // Legacy Android fallback only. Android 15+ status bar fusion is handled
      // by edge-to-edge WebView overlay, CSS background, and safe-area layout.
      backgroundColor: "#0a0a14",
      overlaysWebView: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_leveluplife",
      iconColor: "#7c3aed",
    },
  },
};

export default config;
