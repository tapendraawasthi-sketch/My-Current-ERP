import React from "react";
import { BookOpen, X } from "lucide-react";
import { useEKhataStore } from "../../store/eKhataStore";
import { useFalconStore } from "../../store/falconStore";

const EKhataLauncher: React.FC = () => {
  const { isOpen, togglePanel } = useEKhataStore();
  const closeFalcon = useFalconStore((state) => state.closePanel);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!isOpen) closeFalcon();
        togglePanel();
      }}
      className="fixed bottom-[4.75rem] right-5 z-[9998] h-12 w-12 rounded-full bg-[#059669] hover:bg-[#047857] text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105"
      title="e-Khata — Natural language ledger entries (Ctrl+Shift+K)"
      aria-label="Open e-Khata ledger chat"
    >
      {isOpen ? <X className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
    </button>
  );
};

export default EKhataLauncher;
