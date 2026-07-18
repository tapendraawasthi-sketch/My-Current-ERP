/**
 * Legacy Sutra AI floating chrome — retired (Wave F).
 * Opens Orbix workspace instead of a second assistant surface.
 * Store handoffs (aging reminders, party drafts) remain via sutraAiStore.
 */
import React, { useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useSutraAiStore } from "@/store/sutraAiStore";
import { isNiosPlatformEnabled } from "@/nios/session";

const SutraAiLauncher: React.FC = () => {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const currentPage = useStore((s) => s.currentPage);
  const closePanel = useSutraAiStore((s) => s.closePanel);

  if (currentPage === "orbix" || currentPage === "pos-billing" || currentPage === "pos") {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        closePanel();
        setCurrentPage("orbix");
      }}
      title="Open Orbix"
      className="fixed bottom-4 left-4 z-[var(--ds-z-drawer)] flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ds-intelligence)] text-white shadow-[var(--ds-shadow-2)] transition-colors hover:bg-[var(--ds-intelligence-hover)] no-print"
      data-component="sutra-ai-launcher"
      aria-label="Open Orbix"
    >
      <MessageSquare className="h-5 w-5" />
    </button>
  );
};

const SutraAiProvider: React.FC = () => {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const isDbReady = useStore((state) => state.isDbReady);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const closePanel = useSutraAiStore((state) => state.closePanel);
  const refreshLlmStatus = useSutraAiStore((state) => state.refreshLlmStatus);

  useEffect(() => {
    closePanel();
  }, [closePanel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        closePanel();
        setCurrentPage("orbix");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closePanel, setCurrentPage]);

  useEffect(() => {
    if (isAuthenticated && isDbReady) {
      refreshLlmStatus(true);
    }
  }, [isAuthenticated, isDbReady, refreshLlmStatus]);

  if (isNiosPlatformEnabled()) return null;
  if (!isAuthenticated || !isDbReady) return null;

  return <SutraAiLauncher />;
};

export default SutraAiProvider;
