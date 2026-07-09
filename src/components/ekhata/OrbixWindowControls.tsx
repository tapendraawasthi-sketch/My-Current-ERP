import React from "react";
import { Minus, Square, X, Copy } from "lucide-react";
import type { OrbixWindowMode } from "@/lib/ekhata/orbixChatStorage";

interface OrbixWindowControlsProps {
  windowMode: OrbixWindowMode;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

const WinBtn: React.FC<{
  onClick: () => void;
  title: string;
  hoverClass: string;
  children: React.ReactNode;
}> = ({ onClick, title, hoverClass, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`h-7 w-9 flex items-center justify-center text-slate-400 transition-colors ${hoverClass}`}
  >
    {children}
  </button>
);

const OrbixWindowControls: React.FC<OrbixWindowControlsProps> = ({
  windowMode,
  onMinimize,
  onMaximize,
  onClose,
}) => (
  <div className="flex items-center flex-shrink-0 -mr-1">
    <WinBtn onClick={onMinimize} title="Minimize" hoverClass="hover:bg-white/10 hover:text-slate-200">
      <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
    </WinBtn>
    <WinBtn
      onClick={onMaximize}
      title={windowMode === "maximized" ? "Restore" : "Maximize"}
      hoverClass="hover:bg-white/10 hover:text-slate-200"
    >
      {windowMode === "maximized" ? (
        <Copy className="h-3 w-3" strokeWidth={2} />
      ) : (
        <Square className="h-3 w-3" strokeWidth={2} />
      )}
    </WinBtn>
    <WinBtn onClick={onClose} title="Close" hoverClass="hover:bg-red-500/80 hover:text-white">
      <X className="h-3.5 w-3.5" strokeWidth={2.5} />
    </WinBtn>
  </div>
);

export default OrbixWindowControls;
