/**
 * Bootstrap authenticated session for Playwright e-Khata harness (IndexedDB + admin login).
 * Uses a lightweight path — full initializeApp() is too heavy for CI headless (NAS seed + CBMS).
 */
import { hashPassword } from "../store/store.types";
import { openDB } from "../lib/db";
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
    const db = await openDB();

    const companyCount = await db.companySettings.count();
    if (companyCount === 0) {
      await db.companySettings.add({
        id: "main",
        name: "E2E Test Co",
        companyNameEn: "E2E Test Co",
        panNumber: "000000000",
        currencySymbol: "Rs.",
        address: "Kathmandu, Nepal",
        isActive: true,
      } as never);
    }

    const admin = await db.users.where("username").equals("admin").first();
    if (!admin) {
      await db.users.add({
        id: "user-admin",
        username: "admin",
        name: "Administrator",
        email: "admin@e2e.test",
        role: "admin",
        passwordHash: await hashPassword("admin123"),
        isActive: true,
      } as never);
    }

    useStore.setState({
      isDbReady: true,
      isInitializing: false,
      isAuthenticated: true,
      authStage: "authenticated",
      selectedCompanyId: "main",
      currentUser: {
        id: "user-admin",
        username: "admin",
        name: "Administrator",
        role: "admin",
      },
      companySettings: (await db.companySettings.get("main")) as never,
      accounts: [],
      parties: [],
      vouchers: [],
    });

    useEKhataStore.getState().openPanel();
    _dbg("bootstrap complete", { panelOpen: useEKhataStore.getState().isOpen });
  } catch (err) {
    _dbg("bootstrap error", { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}
