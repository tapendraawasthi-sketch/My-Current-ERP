import React from "react";
import { useEKhataStore } from "../../store/eKhataStore";
import { useStore } from "../../store/useStore";
import OrbixWorkspace from "./OrbixWorkspace";
import OrbixWindowControls from "./OrbixWindowControls";

/** Top command bar height in the new AppShell */
const ORBIX_CHROME_TOP = 56;

const EKhataPanel: React.FC = () => {
  const {
    isOpen,
    windowMode,
    closePanel,
    minimizePanel,
    maximizePanel,
  } = useEKhataStore();
  const currentPage = useStore((s) => s.currentPage);

  // Full page route owns the workspace UI
  if (currentPage === "orbix") return null;
  if (!isOpen || windowMode === "minimized") return null;

  const isMaximized = windowMode === "maximized";

  if (isMaximized) {
    return (
      <div
        className="fixed inset-x-0 bottom-0 z-[var(--ds-z-drawer)] flex flex-col overflow-hidden border-t border-[var(--ds-border-default)] bg-[var(--ds-canvas)] p-3 shadow-[var(--ds-shadow-2)]"
        style={{ top: ORBIX_CHROME_TOP }}
        data-component="ekhata-panel"
      >
        <div className="mb-2 flex justify-end">
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
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-[var(--ds-z-emergency)] flex flex-col overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] shadow-[var(--ds-shadow-2)]"
      style={{ width: 480, maxHeight: "min(85vh, 720px)", minHeight: 520 }}
      data-component="ekhata-panel"
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
