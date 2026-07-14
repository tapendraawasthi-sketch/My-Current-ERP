/**
 * Auth visual fixture bootstrap — isolated E2E metadata only.
 * Does NOT call login(), does NOT open Dexie posting paths, does NOT seed accounting vouchers.
 */
import { useStore } from "../store/useStore";

export const AUTH_FIXTURE_COMPANY_ID = "orbix-e2e-auth-fixture-company";
export const AUTH_FIXTURE_COMPANY_NAME = "Orbix E2E Auth Fixture Co";

export type AuthFixtureScreen = "gateway" | "login" | "blocked";

export type AuthFixtureCompanyMode = "one" | "empty";

declare global {
  interface Window {
    __authFixture?: {
      setScreen: (screen: AuthFixtureScreen) => void;
      setCompanyMode: (mode: AuthFixtureCompanyMode) => void;
      setTheme: (theme: "light" | "dark") => void;
      getState: () => {
        screen: AuthFixtureScreen;
        authStage: string;
        isAuthenticated: boolean;
        companyId: string | null;
      };
    };
  }
}

function isFixtureAllowed(): boolean {
  // Dev server always allowed. Production builds require explicit E2E flag.
  if (import.meta.env.DEV) return true;
  return import.meta.env.VITE_ALLOW_AUTH_FIXTURE === "true";
}

export function assertAuthFixtureAllowed(): void {
  if (!isFixtureAllowed()) {
    throw new Error(
      "Auth visual fixture blocked: not available in production without VITE_ALLOW_AUTH_FIXTURE=true",
    );
  }
}

export function applyAuthFixtureCompany(mode: AuthFixtureCompanyMode): void {
  assertAuthFixtureAllowed();
  if (mode === "empty") {
    useStore.setState({
      companySettings: null as never,
      lastLoginInfo: null,
      isAuthenticated: false,
      currentUser: null,
      authStage: "gateway",
    });
    return;
  }

  useStore.setState({
    companySettings: {
      id: AUTH_FIXTURE_COMPANY_ID,
      companyNameEn: AUTH_FIXTURE_COMPANY_NAME,
      name: AUTH_FIXTURE_COMPANY_NAME,
      pan: "E2E-999999999",
      panNumber: "E2E-999999999",
      fiscalYearStart: "2081-04-01",
      fiscalYearEnd: "2082-03-31",
    } as never,
    lastLoginInfo: {
      username: "e2e.accountant",
      loggedInAt: new Date("2026-01-15T10:00:00.000Z").toISOString(),
    } as never,
    isAuthenticated: false,
    currentUser: null,
    authStage: "gateway",
  });
}

export function applyAuthFixtureScreen(screen: AuthFixtureScreen): void {
  assertAuthFixtureAllowed();
  if (screen === "blocked") return;
  useStore.setState({
    isAuthenticated: false,
    currentUser: null,
    authStage: screen === "login" ? "company-login" : "gateway",
  });
}

export { isFixtureAllowed };
