import React, { useEffect, useState } from "react";
import { useEKhataStore } from "../../store/eKhataStore";
import { useStore } from "../../store/useStore";
import OrbixWorkspace from "./OrbixWorkspace";
import OrbixWindowControls from "./OrbixWindowControls";

/** Top command bar height in the new AppShell */
const ORBIX_CHROME_TOP = 56;

function useIsMobileViewport(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return mobile;
}

const EKhataPanel: React.FC = () => {
  const {
    isOpen,
    windowMode,
    closePanel,
    minimizePanel,
    maximizePanel,
  } = useEKhataStore();
  const currentPage = useStore((s) => s.currentPage);
  const isMobile = useIsMobileViewport();

  // Full page route owns the workspace UI
  if (currentPage === "orbix") return null;
  if (!isOpen || windowMode === "minimized") return null;

  const isMaximized = windowMode === "maximized";
  // STEP 7.4 — mobile always uses full-screen overlay (nav drawer already exists)
  const showFullscreen = isMaximized || isMobile;

  if (showFullscreen) {
    return (
      <div
        className="fixed inset-x-0 bottom-0 z-[var(--ds-z-drawer)] flex flex-col overflow-hidden border-t border-[var(--ds-border-default)] bg-[var(--ds-canvas)] p-3 shadow-[var(--ds-shadow-2)] max-md:inset-0 max-md:z-[var(--ds-z-modal)] max-md:border-0 max-md:p-0"
        style={isMobile ? undefined : { top: ORBIX_CHROME_TOP }}
        data-component="ekhata-panel"
        data-orbix-layout={isMobile ? "mobile-fullscreen" : "maximized"}
      >
        <div className="mb-2 flex justify-end max-md:mb-0 max-md:border-b max-md:border-[var(--ds-border-default)] max-md:bg-[var(--ds-surface)] max-md:px-2 max-md:py-1.5">
          <OrbixWindowControls
            windowMode={isMobile ? "maximized" : windowMode}
            onMinimize={minimizePanel}
            onMaximize={maximizePanel}
            onClose={closePanel}
            hideMaximize={isMobile}
          />
        </div>
        <div className="min-h-0 flex-1 max-md:px-2 max-md:pb-2">
          <OrbixWorkspace variant="overlay" onClose={closePanel} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-[var(--ds-z-emergency)] flex flex-col overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] shadow-[var(--ds-shadow-2)]"
      style={{ width: 480, maxHeight: "min(85vh, 720px)", minHeight: 520 }}
      data-component="ekhata-panel"
      data-orbix-layout="docked"
    >
      <div className="flex items-center justify-end border-b border-[var(--ds-border-default)] px-2 py-1">
        <OrbixWindowControls
          windowMode={windowMode}
          onMinimize={minimizePanel}
          onMaximize={maximizePanel}
          onClose={closePanel}
        />
      </div>
      <div className="min-h-0 flex-1">
        <OrbixWorkspace variant="overlay" onClose={closePanel} />
      </div>
    </div>
  );
};

export default EKhataPanel;
