import React, { useState } from "react";
import { BookOpen, Shield, Info } from "lucide-react";
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
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-1" data-component="orbix-mode-selector" data-testid="orbix-mode-selector">
      <div
        role="tablist"
        aria-label="Orbix operating mode"
        className="inline-flex rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface-muted)] p-0.5"
      >
        {(["ask", "accountant"] as OrbixOperatingMode[]).map((m) => {
          const selected = m === mode;
          const Icon = m === "ask" ? Shield : BookOpen;
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              data-testid={`orbix-mode-${m}`}
              onClick={() => onChange(m)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] font-medium transition-colors duration-200 disabled:opacity-50 ${
                selected
                  ? m === "ask"
                    ? "bg-[var(--ox-surface)] text-[var(--ox-info)] shadow-[var(--ox-shadow-sm)]"
                    : "bg-[var(--ox-surface)] text-[var(--ox-primary)] shadow-[var(--ox-shadow-sm)]"
                  : "text-[var(--ox-text-muted)] hover:text-[var(--ox-text)]"
              }`}
              title={ORBIX_MODE_META[m].description}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {ORBIX_MODE_META[m].label}
              {selected && (
                <span className="hidden text-[10px] font-normal text-[var(--ox-text-subtle)] sm:inline">
                  {m === "ask" ? "· Read only" : "· Confirm"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setInfoOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--ox-radius-md)] text-[var(--ox-text-subtle)] hover:bg-[var(--ox-surface-muted)] hover:text-[var(--ox-text)]"
        aria-label="About Ask and Accountant modes"
        aria-expanded={infoOpen}
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {infoOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close mode help"
            onClick={() => setInfoOpen(false)}
          />
          <div
            role="dialog"
            className="absolute right-0 top-full z-50 mt-2 w-80 rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface-elevated)] p-3 shadow-[var(--ox-shadow-md)]"
          >
            <div className="mb-3">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ox-text)]">
                <Shield className="h-3.5 w-3.5 text-[var(--ox-info)]" />
                Ask Mode
              </p>
              <ul className="mt-1.5 space-y-1 text-[12px] text-[var(--ox-text-muted)]">
                <li>· Ask questions</li>
                <li>· Generate reports</li>
                <li>· Analyze ERP data</li>
                <li>· No record changes</li>
              </ul>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ox-text)]">
                <BookOpen className="h-3.5 w-3.5 text-[var(--ox-primary)]" />
                Accountant Mode
              </p>
              <ul className="mt-1.5 space-y-1 text-[12px] text-[var(--ox-text-muted)]">
                <li>· Everything in Ask Mode</li>
                <li>· Create transaction drafts</li>
                <li>· Modify authorized records</li>
                <li>· Confirmation before posting</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OrbixModeSelector;
