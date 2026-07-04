// src/components/falcon/FalconLauncher.tsx
import React from "react";
import { MessageCircle, X } from "lucide-react";
import { useFalconStore } from "../../store/falconStore";
import { useEKhataStore } from "../../store/eKhataStore";

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
      className="fixed bottom-5 right-5 z-[9998] h-12 w-12 rounded-full bg-[#1557b0] hover:bg-[#0f4a96] text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105"
      title="Falcon AI — Sutra ERP Assistant"
      aria-label="Open Falcon AI assistant"
    >
      {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
    </button>
  );
};

export default FalconLauncher;
