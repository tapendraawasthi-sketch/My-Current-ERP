/**
 * Falcon floating launcher — retired (Wave F).
 * Opens Orbix instead.
 */
import React from "react";
import { MessageSquare } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useFalconStore } from "../../store/falconStore";

const FalconLauncher: React.FC = () => {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const currentPage = useStore((s) => s.currentPage);
  const closePanel = useFalconStore((s) => s.closePanel);

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
      className="fixed bottom-5 right-5 z-[var(--ds-z-drawer)] flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ds-intelligence)] text-white shadow-[var(--ds-shadow-2)] transition-colors hover:bg-[var(--ds-intelligence-hover)] no-print"
      title="Open Orbix"
      aria-label="Open Orbix"
    >
      <MessageSquare className="h-5 w-5" />
    </button>
  );
};

export default FalconLauncher;
