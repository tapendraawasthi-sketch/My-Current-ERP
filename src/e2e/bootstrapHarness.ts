/**
 * Bootstrap authenticated session for Playwright e-Khata harness (IndexedDB + admin login).
 */
import { useEKhataStore } from "../store/eKhataStore";
import { useStore } from "../store/useStore";

export async function bootstrapEkhataHarness(): Promise<void> {
  await useStore.getState().initializeApp();

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
}
