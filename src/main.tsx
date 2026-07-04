import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

declare const __APP_BUILD_SHA__: string;
// Referenced so Vite emits a new content hash per commit (browser cache bust on Render)
if (import.meta.env.PROD) {
  (window as unknown as { __SUTRA_BUILD__?: string }).__SUTRA_BUILD__ = __APP_BUILD_SHA__;
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  // This should never happen but prevents a cryptic error
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

// Global error handler for uncaught errors (shows error instead of blank page)
window.addEventListener("error", (event) => {
  console.error("[Sutra ERP] Uncaught error:", event.error || event.message);

  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;flex-direction:column;gap:16px;background:#f5f6fa;padding:24px">
        <div style="font-size:18px;font-weight:700;color:#1f2937">Sutra ERP - Runtime Error</div>
        <div style="font-size:13px;color:#dc2626;max-width:600px;text-align:left;background:#fee2e2;padding:16px;border-radius:8px;overflow:auto;word-wrap:break-word;">
          ${String(event.error?.stack || event.error || event.message || "Unknown error")}
        </div>
        <button onclick="location.reload()" style="padding:8px 16px;background:#1557b0;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">
          Reload Application
        </button>
      </div>`;
  }

  const loading = document.getElementById("root-loading");
  if (loading) loading.style.display = "none";
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Sutra ERP] Unhandled promise rejection:", event.reason);

  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;flex-direction:column;gap:16px;background:#f5f6fa;padding:24px">
        <div style="font-size:18px;font-weight:700;color:#1f2937">Sutra ERP - Unhandled Rejection</div>
        <div style="font-size:13px;color:#dc2626;max-width:600px;text-align:left;background:#fee2e2;padding:16px;border-radius:8px;overflow:auto;word-wrap:break-word;">
          ${String(event.reason?.stack || event.reason || "Unknown rejection")}
        </div>
        <button onclick="location.reload()" style="padding:8px 16px;background:#1557b0;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">
          Reload Application
        </button>
      </div>`;
  }

  const loading = document.getElementById("root-loading");
  if (loading) loading.style.display = "none";
});

try {
  ReactDOM.createRoot(rootElement).render(
    // NOTE: StrictMode causes double-renders in development - remove if causing issues
    <App />,
  );
} catch (err) {
  console.error("[Sutra ERP] Fatal render error:", err);
  rootElement.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;flex-direction:column;gap:16px;background:#f5f6fa;padding:24px">
      <div style="font-size:18px;font-weight:700;color:#1f2937">Sutra ERP</div>
      <div style="font-size:13px;color:#dc2626;max-width:400px;text-align:center">
        Application failed to load. This is usually caused by a corrupted cache.
      </div>
      <button onclick="location.reload()" style="padding:8px 16px;background:#1557b0;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">
        Reload Application
      </button>
      <button onclick="(()=>{localStorage.clear();sessionStorage.clear();location.reload()})()" style="padding:8px 16px;background:#fff;color:#374151;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;font-size:13px">
        Clear Cache & Reload
      </button>
    </div>`;
}
