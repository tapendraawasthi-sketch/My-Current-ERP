/**
 * Bootstrap authenticated session for Playwright e-Khata harness (IndexedDB + admin login).
 */
import { useEKhataStore } from "../store/eKhataStore";
import { useStore } from "../store/useStore";

export async function bootstrapEkhataHarness(): Promise<void> {
  // #region agent log
  const _dbg = (msg: string, data: Record<string, unknown>) => {
    fetch("http://localhost:7330/ingest/a7e67c06-a5cf-446a-8ca6-f81cab3c7d24", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ab6f1a" },
      body: JSON.stringify({
        sessionId: "ab6f1a",
        hypothesisId: "H2",
        location: "bootstrapHarness.ts",
        message: msg,
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  };
  // #endregion

  try {
    _dbg("bootstrap start", {});
    await useStore.getState().initializeApp();
    _dbg("initializeApp done", { authStage: useStore.getState().authStage, isAuthenticated: useStore.getState().isAuthenticated });

    const state = useStore.getState();
    if (state.authStage === "no-company") {
      useStore.setState({ authStage: "gateway" });
    }

    if (!useStore.getState().isAuthenticated) {
      useStore.getState().selectCompanyForLogin("main");
      const ok = await useStore.getState().login("admin", "admin123");
      if (!ok) {
        throw new Error("e-Khata harness login failed (admin / admin123)");
      }
    }

    useEKhataStore.getState().openPanel();
    _dbg("bootstrap complete", { panelOpen: useEKhataStore.getState().isOpen });
  } catch (err) {
    _dbg("bootstrap error", { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}
