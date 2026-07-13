import React, { useEffect } from "react";
import { Brain } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useSutraAiStore } from "@/store/sutraAiStore";
import SutraAIChat from "@/ai/interface/AIChat";
import { isNiosPlatformEnabled } from "@/nios/session";

const SutraAiLauncher: React.FC = () => {
  const togglePanel = useSutraAiStore((s) => s.togglePanel);
  const isOpen = useSutraAiStore((s) => s.isOpen);
  const currentPage = useStore((s) => s.currentPage);

  if (isOpen || currentPage === "orbix") return null;

  return (
    <button
      type="button"
      onClick={togglePanel}
      title="SUTRA AI (Ctrl+Shift+A)"
      className="fixed bottom-4 left-4 z-[40] flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ox-primary)] text-white shadow-[var(--ox-shadow-md)] transition-all hover:bg-[var(--ox-primary-hover)] hover:scale-105 no-print"
      data-component="sutra-ai-launcher"
      aria-label="Open Sutra AI"
    >
      <Brain className="h-5 w-5" />
    </button>
  );
};

const SutraAiProvider: React.FC = () => {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const isDbReady = useStore((state) => state.isDbReady);
  const refreshLlmStatus = useSutraAiStore((state) => state.refreshLlmStatus);
  const openPanel = useSutraAiStore((state) => state.openPanel);
  const closePanel = useSutraAiStore((state) => state.closePanel);
  const isOpen = useSutraAiStore((state) => state.isOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        openPanel();
        return;
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        closePanel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openPanel, closePanel, isOpen]);

  useEffect(() => {
    if (isAuthenticated && isDbReady) {
      refreshLlmStatus(true);
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
      <SutraAiLauncher />
      <SutraAIChat />
    </>
  );
};

export default SutraAiProvider;
