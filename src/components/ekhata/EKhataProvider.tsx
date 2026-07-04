import React, { useEffect } from "react";
import { useStore } from "../../store/useStore";
import { useEKhataStore } from "../../store/eKhataStore";
import { useFalconStore } from "../../store/falconStore";
import EKhataLauncher from "./EKhataLauncher";
import EKhataPanel from "./EKhataPanel";

const EKhataProvider: React.FC = () => {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const isDbReady = useStore((state) => state.isDbReady);
  const refreshLlmStatus = useEKhataStore((state) => state.refreshLlmStatus);
  const closeFalcon = useFalconStore((state) => state.closePanel);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useEKhataStore.getState().openPanel();
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
