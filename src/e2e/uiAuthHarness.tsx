/**
 * E2E-only auth visual harness — renders real GatewayScreen / CompanyLoginScreen.
 * No auto-authentication. Production builds require VITE_ALLOW_AUTH_FIXTURE=true.
 */
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "../context/ThemeContext";
import GatewayScreen from "../components/auth/GatewayScreen";
import CompanyLoginScreen from "../components/auth/CompanyLoginScreen";
import {
  applyAuthFixtureCompany,
  applyAuthFixtureScreen,
  assertAuthFixtureAllowed,
  isFixtureAllowed,
  type AuthFixtureCompanyMode,
  type AuthFixtureScreen,
} from "./bootstrapUiAuthHarness";
import { useStore } from "../store/useStore";
import "../styles.css";

function AuthFixtureApp() {
  const [screen, setScreen] = useState<AuthFixtureScreen>("gateway");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const authStage = useStore((s) => s.authStage);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const companySettings = useStore((s) => s.companySettings);

  useEffect(() => {
    try {
      assertAuthFixtureAllowed();
      applyAuthFixtureCompany("one");
      applyAuthFixtureScreen("gateway");
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setScreen("blocked");
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.__authFixture = {
      setScreen: (s) => {
        applyAuthFixtureScreen(s);
        setScreen(s);
      },
      setCompanyMode: (mode: AuthFixtureCompanyMode) => {
        applyAuthFixtureCompany(mode);
        setScreen("gateway");
      },
      setTheme: (theme) => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("orbix_theme_pref", theme);
        localStorage.setItem("sutra_theme", theme);
      },
      getState: () => ({
        screen,
        authStage: useStore.getState().authStage,
        isAuthenticated: useStore.getState().isAuthenticated,
        companyId: (useStore.getState().companySettings as { id?: string } | null)?.id ?? null,
      }),
    };
  }, [ready, screen]);

  if (error || screen === "blocked" || !isFixtureAllowed()) {
    return (
      <div data-testid="ui-auth-fixture-blocked" className="p-6 text-[13px] text-red-700">
        Auth visual fixture unavailable in this build.
        {error ? ` ${error}` : ""}
      </div>
    );
  }

  if (!ready) {
    return (
      <div data-testid="ui-auth-fixture-loading" className="p-6 text-[13px] text-gray-600">
        Loading auth fixture…
      </div>
    );
  }

  return (
    <ThemeProvider>
      <div
        data-testid="ui-auth-fixture-ready"
        data-auth-stage={authStage}
        data-authenticated={String(isAuthenticated)}
        data-company-id={(companySettings as { id?: string } | null)?.id ?? ""}
        className="min-h-screen"
      >
        {authStage === "company-login" ? <CompanyLoginScreen /> : <GatewayScreen />}
      </div>
    </ThemeProvider>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Auth fixture root missing");
ReactDOM.createRoot(root).render(<AuthFixtureApp />);
