import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import "./index.css";
import App from "./App";

// 初始化 Capacitor + SQLite 插件（必须在渲染前完成）
async function init() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { CapacitorSQLite } = await import("@capacitor-community/sqlite");
      // 初始化 web store，确保原生插件就绪
      await CapacitorSQLite.initWebStore();
    } catch (e) {
      console.warn("SQLite plugin init failed:", e);
    }
  }
}

init().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
