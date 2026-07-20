import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
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
        gap: 20,
        background: "#f8fafc",
        padding: 32,
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a" }}>Sutra ERP - Runtime Error</div>
      <div
        style={{
          fontSize: 13,
          color: "#dc2626",
          maxWidth: 600,
          textAlign: "left",
          background: "#fef2f2",
          padding: 20,
          borderRadius: 10,
          border: "1px solid #fecaca",
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
          padding: "10px 20px",
          background: "var(--ds-action-primary)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
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
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;flex-direction:column;gap:20px;background:#f8fafc;padding:32px">
      <div style="font-size:17px;font-weight:700;color:#0f172a">Sutra ERP</div>
      <div style="font-size:13px;color:#dc2626">Error: Root element not found. Please refresh the page.</div>
      <button onclick="location.reload()" style="padding:10px 20px;background:var(--ds-action-primary);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,0.08)">
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
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;flex-direction:column;gap:20px;background:#f8fafc;padding:32px">
      <div style="font-size:17px;font-weight:700;color:#0f172a">Sutra ERP - Runtime Error</div>
      <div style="font-size:13px;color:#dc2626;max-width:600px;text-align:left;background:#fef2f2;padding:20px;border-radius:10px;border:1px solid #fecaca;overflow:auto;word-wrap:break-word;">
        ${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
      </div>
      <button onclick="location.reload()" style="padding:10px 20px;background:var(--ds-action-primary);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,0.08)">
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
      <BrowserRouter>
        <ThemeProvider>
          <App onMounted={dismissRootLoading} />
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>,
  );
} catch (err) {
  console.error("[Sutra ERP] Fatal render error:", err);
  renderFatalError(
    String(err instanceof Error ? err.stack || err.message : err || "Application failed to load"),
  );
}
