import React from "react";
import { useEKhataStore } from "../../store/eKhataStore";
import { useFalconStore } from "../../store/falconStore";
import { useStore } from "../../store/useStore";
import OrbixLogo from "./OrbixLogo";

const EKhataLauncher: React.FC = () => {
  const { isOpen, windowMode, openPanel, restorePanel, maximizePanel } = useEKhataStore();
  const closeFalcon = useFalconStore((state) => state.closePanel);
  const currentPage = useStore((s) => s.currentPage);
  const setCurrentPage = useStore((s) => s.setCurrentPage);

  // First-class Orbix route owns the workspace — never show floating launcher there.
  if (currentPage === "orbix") return null;

  const isMinimized = isOpen && windowMode === "minimized";
  const isActiveOverlay = isOpen && windowMode !== "minimized";
  if (isActiveOverlay) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        closeFalcon();
        if (isMinimized) {
          setCurrentPage("orbix");
          restorePanel();
          maximizePanel();
          return;
        }
        setCurrentPage("orbix");
        openPanel();
        maximizePanel();
      }}
      className="fixed bottom-5 right-5 z-[var(--ds-z-dropdown)] group no-print"
      title="Open Orbix (Ctrl+Shift+K)"
      aria-label="Open Orbix AI accounting workspace"
    >
      <div className="relative">
        <div className="absolute inset-0 scale-125 rounded-full bg-[var(--ds-action-primary)]/20 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-[var(--ds-border-default)] bg-[var(--ds-action-primary)] shadow-[var(--ds-shadow-2)] transition-transform duration-200 group-hover:scale-105">
          <OrbixLogo size={26} variant="full" />
        </div>
        {isMinimized && (
          <span className="absolute -right-1 -top-1 rounded-full bg-[var(--ds-status-warning)] px-1.5 py-0.5 text-[8px] font-bold text-white">
            —
          </span>
        )}
      </div>
    </button>
  );
};

export default EKhataLauncher;
