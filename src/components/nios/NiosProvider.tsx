import React, { useEffect } from "react";
import { Brain } from "lucide-react";
import { isNiosPlatformEnabled } from "../../nios/session";
import { useNiosStore } from "../../store/niosStore";
import { useStore } from "../../store/useStore";
import { NiosShell } from "./NiosShell";

const NiosLauncher: React.FC = () => {
  const { isOpen, togglePanel } = useNiosStore();
  return (
    <button
      onClick={togglePanel}
      className={`fixed bottom-4 right-4 z-[9997] h-10 px-3 flex items-center gap-2 rounded-md shadow-md text-[12px] font-medium ${
        isOpen ? "bg-[var(--ds-action-primary-hover)] text-white" : "bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white"
      }`}
      title="NIOS Intelligence Platform"
      aria-label="Open NIOS"
      style={{ right: isOpen ? "440px" : "16px" }}
    >
      <Brain size={16} />
      NIOS
    </button>
  );
};

export const NiosProvider: React.FC = () => {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const isDbReady = useStore((s) => s.isDbReady);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        useNiosStore.getState().togglePanel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isNiosPlatformEnabled() || !isAuthenticated || !isDbReady) {
    return null;
  }

  return (
    <>
      <NiosLauncher />
      <NiosShell />
    </>
  );
};

export default NiosProvider;
