import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

export type ThemeMode = "system" | "light" | "dark";

function isDarkTheme(themeMode: ThemeMode): boolean {
  if (themeMode === "dark") return true;
  if (themeMode === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

export async function syncStatusBar(themeMode: ThemeMode): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const dark = isDarkTheme(themeMode);

  try {
    await StatusBar.show();
  } catch {
    console.warn("[Native UI] StatusBar.show failed");
  }

  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {
    console.warn("[Native UI] StatusBar.setOverlaysWebView failed");
  }

  try {
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
  } catch {
    console.warn("[Native UI] StatusBar.setStyle failed");
  }

  // Legacy Android fallback only. Android 15+ edge-to-edge relies on the
  // WebView background plus the CSS safe-area spacer.
  try {
    await StatusBar.setBackgroundColor({ color: dark ? "#0a0a14" : "#f8fafc" });
  } catch {
    console.warn("[Native UI] StatusBar.setBackgroundColor failed");
  }

  try {
    const info = await StatusBar.getInfo();
    if (info.height && info.height > 0) {
      const safeTop = Math.max(0, Math.min(info.height, 36));
      document.documentElement.style.setProperty("--app-safe-top", `${info.height}px`);
      document.documentElement.style.setProperty("--app-native-safe-top", `${safeTop}px`);
    }
  } catch {
    console.warn("[Native UI] StatusBar.getInfo failed");
  }
}
