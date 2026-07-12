import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  ORBIX_MODE_META,
  type OrbixOperatingMode,
} from "../../lib/ekhata/orbixOperatingMode";

interface Props {
  mode: OrbixOperatingMode;
  onChange: (mode: OrbixOperatingMode) => void;
  disabled?: boolean;
}

const OrbixModeSelector: React.FC<Props> = ({ mode, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const meta = ORBIX_MODE_META[mode];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 max-w-[220px] items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 text-left hover:bg-white/[0.07] disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Orbix mode: ${meta.label}`}
        data-component="orbix-mode-selector"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Mode
        </span>
        <span className="truncate text-[11px] font-medium text-slate-200">{meta.label}</span>
        <ChevronDown className="h-3 w-3 flex-shrink-0 text-slate-500" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute bottom-full left-0 z-50 mb-1 w-[280px] overflow-hidden rounded-md border border-white/10 bg-[#121722] shadow-xl"
        >
          {(["ask", "accountant"] as OrbixOperatingMode[]).map((m) => {
            const info = ORBIX_MODE_META[m];
            const selected = m === mode;
            return (
              <button
                key={m}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(m);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2.5 text-left hover:bg-white/[0.06] ${
                  selected ? "bg-cyan-500/10" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-slate-100">{info.label}</span>
                  {selected && (
                    <span className="text-[9px] font-semibold uppercase text-cyan-400">Active</span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{info.description}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrbixModeSelector;
