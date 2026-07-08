/**
 * Bootstrap authenticated session for Playwright e-Khata harness (IndexedDB + admin login).
 * Uses a lightweight path — full initializeApp() is too heavy for CI headless (NAS seed + CBMS).
 */
import { DEFAULT_FISCAL_YEAR } from "../store/store.types";
import { openDB } from "../lib/db";
import { useEKhataStore } from "../store/eKhataStore";
import { useStore } from "../store/useStore";

declare global {
  interface Window {
    __ekhataHarnessStep?: string;
  }
}

function setStep(step: string): void {
  if (typeof window !== "undefined") {
    window.__ekhataHarnessStep = step;
  }
  console.log(`[ekhata-harness] ${step}`);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

export async function bootstrapEkhataHarness(): Promise<void> {
  try {
    setStep("bootstrap start");
    const db = await withTimeout(openDB(), 20_000, "openDB");

    setStep("openDB done");
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

    setStep("company seeded");
    const fyCount = await db.fiscalYears.count();
    if (fyCount === 0) {
      await db.fiscalYears.add(DEFAULT_FISCAL_YEAR as never);
    }

    const admin = await db.users.where("username").equals("admin").first();
    if (!admin) {
      await db.users.add({
        id: "user-admin",
        username: "admin",
        name: "Administrator",
        email: "admin@e2e.test",
        role: "admin",
        passwordHash: "e2e-harness-no-login",
        isActive: true,
      } as never);
    }

    setStep("admin seeded");
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
      currentFiscalYear: DEFAULT_FISCAL_YEAR,
      fiscalYears: [DEFAULT_FISCAL_YEAR],
      accounts: [],
      parties: [],
      vouchers: [],
    });

    setStep("store ready");
    useEKhataStore.getState().openPanel();
    setStep("bootstrap complete");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setStep(`bootstrap error: ${message}`);
    throw err;
  }
}
