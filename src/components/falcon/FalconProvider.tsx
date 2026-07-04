import React, { useEffect, useState } from "react";
import { useStore } from "../../store/useStore";
import { useFalconStore } from "../../store/falconStore";
import { FalconPanel } from "./FalconPanel";
// Assuming FalconLauncher exists, we import it. If it doesn't, we can render a minimal one or just import it.
import FalconLauncher from "./FalconLauncher";
import { AlertCircle } from "lucide-react";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <button
          onClick={() => this.setState({ hasError: false })}
          className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-[12px] z-[9999]"
        >
          <AlertCircle size={14} /> Falcon Error - Click to reload
        </button>
      );
    }
    return this.props.children;
  }
}

export const FalconProvider: React.FC = () => {
  const currentPage = useStore((state) => state.currentPage);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const isDbReady = useStore((state) => state.isDbReady);
  const companySettings = useStore((state) => state.companySettings);

  const setContext = useFalconStore((state) => state.setContext);
  const togglePanel = useFalconStore((state) => state.togglePanel);

  // Keyboard shortcut Ctrl+/ or Ctrl+Shift+F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "/" || (e.shiftKey && e.key.toLowerCase() === "f"))
      ) {
        e.preventDefault();
        togglePanel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [togglePanel]);

  // Context auto-injection on route change
  useEffect(() => {
    if (currentPage) {
      setContext({
        route: currentPage,
        companyName: companySettings?.name || companySettings?.companyName || "Sutra ERP User",
      });
    }
  }, [currentPage, companySettings, setContext]);

  // Hide entirely if not authenticated or DB not ready
  if (!isAuthenticated || !isDbReady) {
    return null;
  }

  return (
    <ErrorBoundary>
      <FalconLauncher />
      <FalconPanel />
    </ErrorBoundary>
  );
};

export default FalconProvider;
