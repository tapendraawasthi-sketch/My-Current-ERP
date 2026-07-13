import React, { useEffect } from "react";
import { useStore } from "../../store/useStore";
import { useEKhataStore } from "../../store/eKhataStore";
import { useFalconStore } from "../../store/falconStore";
import EKhataLauncher from "./EKhataLauncher";
import EKhataPanel from "./EKhataPanel";
import { isNiosPlatformEnabled } from "../../nios/session";

const EKhataProvider: React.FC = () => {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const isDbReady = useStore((state) => state.isDbReady);
  const refreshLlmStatus = useEKhataStore((state) => state.refreshLlmStatus);
  const closeFalcon = useFalconStore((state) => state.closePanel);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const state = useEKhataStore.getState();
        const page = useStore.getState().currentPage;
        const setPage = useStore.getState().setCurrentPage;
        if (page === "orbix") {
          setPage("dashboard");
          state.minimizePanel();
        } else if (state.isOpen && state.windowMode === "minimized") {
          setPage("orbix");
          state.restorePanel();
          state.maximizePanel();
        } else if (!state.isOpen) {
          setPage("orbix");
          state.openPanel();
          state.maximizePanel();
        } else {
          setPage("orbix");
          state.maximizePanel();
        }
        closeFalcon();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeFalcon]);

  useEffect(() => {
    if (isAuthenticated && isDbReady) {
      refreshLlmStatus();
    }
  }, [isAuthenticated, isDbReady, refreshLlmStatus]);

  if (isNiosPlatformEnabled()) {
    return null;
  }

  if (!isAuthenticated || !isDbReady) {
    return null;
  }

  return (
    <>
      <EKhataLauncher />
      <EKhataPanel />
    </>
  );
};

export default EKhataProvider;
