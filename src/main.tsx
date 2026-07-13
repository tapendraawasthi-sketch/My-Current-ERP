import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { bootstrapPlatformRuntime } from "./store/platformBootstrap";
import { ThemeProvider } from "./context/ThemeContext";

bootstrapPlatformRuntime();

declare const __APP_BUILD_SHA__: string;
if (import.meta.env.PROD) {
  (window as unknown as { __SUTRA_BUILD__?: string }).__SUTRA_BUILD__ = __APP_BUILD_SHA__;
}

function dismissRootLoading(): void {
  const loading = document.getElementById("root-loading");
  if (!loading) return;
  loading.style.opacity = "0";
  loading.style.transition = "opacity 0.3s ease";
  window.setTimeout(() => loading.remove(), 300);
}

function FatalErrorScreen({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        flexDirection: "column",
        gap: 16,
        background: "#f5f6fa",
        padding: 24,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1f2937" }}>Sutra ERP - Runtime Error</div>
      <div
        style={{
          fontSize: 13,
          color: "#dc2626",
          maxWidth: 600,
          textAlign: "left",
          background: "#fee2e2",
          padding: 16,
          borderRadius: 8,
          overflow: "auto",
          wordWrap: "break-word",
        }}
      >
        {message}
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          padding: "8px 16px",
          background: "#1557b0",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        Reload Application
      </button>
    </div>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;flex-direction:column;gap:16px;background:#f5f6fa">
      <div style="font-size:18px;font-weight:700;color:#1f2937">Sutra ERP</div>
      <div style="font-size:13px;color:#dc2626">Error: Root element not found. Please refresh the page.</div>
      <button onclick="location.reload()" style="padding:8px 16px;background:#1557b0;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">
        Refresh
      </button>
    </div>`;
  throw new Error("Root element #root not found in DOM");
}

let reactRoot: ReturnType<typeof ReactDOM.createRoot> | null = null;
let fatalErrorShown = false;

function renderFatalError(message: string): void {
  if (fatalErrorShown) return;
  fatalErrorShown = true;
  dismissRootLoading();

  if (reactRoot) {
    reactRoot.render(<FatalErrorScreen message={message} />);
    return;
  }

  rootElement.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;flex-direction:column;gap:16px;background:#f5f6fa;padding:24px">
      <div style="font-size:18px;font-weight:700;color:#1f2937">Sutra ERP - Runtime Error</div>
      <div style="font-size:13px;color:#dc2626;max-width:600px;text-align:left;background:#fee2e2;padding:16px;border-radius:8px;overflow:auto;word-wrap:break-word;">
        ${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
      </div>
      <button onclick="location.reload()" style="padding:8px 16px;background:#1557b0;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">
        Reload Application
      </button>
    </div>`;
}

window.addEventListener("error", (event) => {
  console.error("[Sutra ERP] Uncaught error:", event.error || event.message);
  renderFatalError(
    String(event.error?.stack || event.error || event.message || "Unknown error"),
  );
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Sutra ERP] Unhandled promise rejection:", event.reason);
  renderFatalError(String(event.reason?.stack || event.reason || "Unknown rejection"));
});

try {
  reactRoot = ReactDOM.createRoot(rootElement);
  reactRoot.render(
    <ErrorBoundary>
      <ThemeProvider>
        <App onMounted={dismissRootLoading} />
      </ThemeProvider>
    </ErrorBoundary>,
  );
} catch (err) {
  console.error("[Sutra ERP] Fatal render error:", err);
  renderFatalError(
    String(err instanceof Error ? err.stack || err.message : err || "Application failed to load"),
  );
}
