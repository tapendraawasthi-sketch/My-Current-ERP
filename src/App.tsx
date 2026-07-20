// src/App.tsx
import React, { useEffect, useRef } from "react";
import { useStore } from "./store/useStore";
import { ToastProvider } from "@/design-system";
import { F12Provider } from "./hooks/useF12Config";
import F12Panel from "./components/F12Panel";
import Layout from "./components/Layout";
import SignUpWizard from "./components/auth/SignUpWizard";
import InitErrorScreen from "./components/InitErrorScreen";
import GatewayScreen from "./components/auth/GatewayScreen";
import CompanyLoginScreen from "./components/auth/CompanyLoginScreen";
import { SessionRestoringScreen } from "./components/auth/AuthAccessSurfaces";
import { PageUrlSync } from "./routing/PageUrlSync";
import { AppPageRoutes } from "./routing/AppPageRoutes";

type AppProps = {
  onMounted?: () => void;
};

const App: React.FC<AppProps> = ({ onMounted }) => {
  const { authStage, initializeApp, setCurrentPage } = useStore();

  const initCalledRef = useRef(false);
  useEffect(() => {
    onMounted?.();
  }, [onMounted]);

  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    initializeApp();
  }, [initializeApp]);

  useEffect(() => {
    const handleNav = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail && typeof customEvent.detail === "string") {
        setCurrentPage(customEvent.detail);
      }
    };
    window.addEventListener("navigate", handleNav);
    return () => window.removeEventListener("navigate", handleNav);
  }, [setCurrentPage]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        setCurrentPage("balance-sheet");
      } else if (e.ctrlKey && e.key === "t") {
        e.preventDefault();
        setCurrentPage("trial-balance");
      } else if (e.ctrlKey && e.key === "l") {
        e.preventDefault();
        setCurrentPage("ledger");
      } else if (e.ctrlKey && e.key === "g") {
        e.preventDefault();
        setCurrentPage("vat-reports");
      } else if (e.ctrlKey && e.key === "u") {
        e.preventDefault();
        setCurrentPage("users");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setCurrentPage]);

  const renderAuthStage = () => {
    if (authStage === "checking") {
      return <SessionRestoringScreen />;
    }

    if (authStage === "error") {
      return <InitErrorScreen />;
    }

    if (authStage === "no-company") {
      return <SignUpWizard />;
    }

    if (authStage === "gateway") {
      return <GatewayScreen />;
    }

    if (authStage === "company-login") {
      return <CompanyLoginScreen />;
    }

    return (
      <F12Provider>
        <Layout>
          <AppPageRoutes />
        </Layout>
        <F12Panel />
      </F12Provider>
    );
  };

  return (
    <ToastProvider>
      <PageUrlSync />
      {renderAuthStage()}
    </ToastProvider>
  );
};

export default App;
