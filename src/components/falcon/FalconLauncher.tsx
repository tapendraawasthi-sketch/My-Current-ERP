// src/components/falcon/FalconLauncher.tsx
import React from "react";
import { MessageCircle, X } from "lucide-react";
import { useFalconStore } from "../../store/falconStore";
import { useEKhataStore } from "../../store/eKhataStore";

/** Quiet Assist launcher — no glow/scale circus (IMPLEMENT_NOW Wave 1). */
const FalconLauncher: React.FC = () => {
  const { isOpen, togglePanel } = useFalconStore();
  const closeEKhata = useEKhataStore((state) => state.closePanel);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!isOpen) closeEKhata();
        togglePanel();
      }}
      className="fixed bottom-5 right-5 z-[var(--ds-z-drawer)] flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ds-action-primary)] text-[var(--ds-action-primary-text)] shadow-[var(--ds-shadow-2)] transition-colors hover:bg-[var(--ds-action-primary-hover)] no-print"
      title="Assist"
      aria-label="Open assist"
    >
      {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
    </button>
  );
};

export default FalconLauncher;
