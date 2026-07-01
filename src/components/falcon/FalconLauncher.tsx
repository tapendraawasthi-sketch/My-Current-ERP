// src/components/falcon/FalconLauncher.tsx
import React from "react";
import { MessageCircle, X } from "lucide-react";
import { useFalconStore } from "../../store/falconStore";

const FalconLauncher: React.FC = () => {
  const { isOpen, togglePanel } = useFalconStore();

  return (
    <button
      type="button"
      onClick={togglePanel}
      className="fixed bottom-5 right-5 z-[9998] h-12 w-12 rounded-full bg-[#1557b0] hover:bg-[#0f4a96] text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105"
      title="Falcon — Sutra ERP Assistant"
      aria-label="Open Falcon assistant"
    >
      {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
    </button>
  );
};

export default FalconLauncher;
