import React, { useEffect } from "react";
import { Brain } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useSutraAiStore } from "@/store/sutraAiStore";
import SutraAIChat from "@/ai/interface/AIChat";

const SutraAiLauncher: React.FC = () => {
  const togglePanel = useSutraAiStore((s) => s.togglePanel);
  const isOpen = useSutraAiStore((s) => s.isOpen);

  if (isOpen) return null;

  return (
    <button
      type="button"
      onClick={togglePanel}
      title="SUTRA AI (Ctrl+Shift+A)"
      className="fixed bottom-4 left-4 z-[9997] h-10 w-10 flex items-center justify-center rounded-full shadow-lg transition-all bg-[#1557b0] hover:bg-[#0f4a96] text-white hover:scale-105"
      data-component="sutra-ai-launcher"
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
