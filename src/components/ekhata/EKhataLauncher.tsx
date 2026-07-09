import React from "react";
import { useEKhataStore } from "../../store/eKhataStore";
import { useFalconStore } from "../../store/falconStore";
import OrbixLogo from "./OrbixLogo";

const EKhataLauncher: React.FC = () => {
  const { isOpen, windowMode, openPanel, restorePanel } = useEKhataStore();
  const closeFalcon = useFalconStore((state) => state.closePanel);

  const isMinimized = isOpen && windowMode === "minimized";
  const isActive = isOpen && windowMode !== "minimized";

  if (isActive) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        closeFalcon();
        if (isMinimized) {
          restorePanel();
        } else {
          openPanel();
        }
      }}
      className="fixed bottom-[4.75rem] right-5 z-[9998] group"
      title={
        isMinimized
          ? "Restore Orbix — AI (Ctrl+Shift+K)"
          : "Orbix — AI Accounting Mode (Ctrl+Shift+K)"
      }
      aria-label={isMinimized ? "Restore Orbix AI" : "Open Orbix AI accounting assistant"}
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-cyan-500/30 blur-md scale-125 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div
          className="relative h-12 w-12 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105 shadow-lg shadow-black/30 border border-white/10"
          style={{
            background: isMinimized
              ? "linear-gradient(135deg, #0e7490 0%, #1d4ed8 50%, #7c3aed 100%)"
              : "linear-gradient(135deg, #0e7490 0%, #1d4ed8 50%, #7c3aed 100%)",
          }}
        >
          <OrbixLogo size={28} variant="full" />
        </div>
        {isMinimized && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-orange-500 text-[8px] font-bold text-white shadow-lg">
            —
          </span>
        )}
        {!isOpen && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#0a0e17] shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
        )}
      </div>
    </button>
  );
};

export default EKhataLauncher;
