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
        className="inline-flex rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)] p-0.5"
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
                    ? "bg-[var(--ds-surface)] text-[var(--ds-status-info)] shadow-[var(--ds-shadow-1)]"
                    : "bg-[var(--ds-surface)] text-[var(--ds-action-primary)] shadow-[var(--ds-shadow-1)]"
                  : "text-[var(--ds-text-muted)] hover:text-[var(--ds-text-default)]"
              }`}
              title={ORBIX_MODE_META[m].description}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {ORBIX_MODE_META[m].label}
              {selected && (
                <span className="hidden text-[12px] font-normal text-[var(--ds-text-subtle)] sm:inline">
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
        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--ds-radius-md)] text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-muted)] hover:text-[var(--ds-text-default)]"
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
            className="absolute right-0 top-full z-50 mt-2 w-80 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] p-3 shadow-[var(--ds-shadow-2)]"
          >
            <div className="mb-3">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ds-text-default)]">
                <Shield className="h-3.5 w-3.5 text-[var(--ds-status-info)]" />
                Ask Mode
              </p>
              <ul className="mt-1.5 space-y-1 text-[12px] text-[var(--ds-text-muted)]">
                <li>· Ask questions</li>
                <li>· Generate reports</li>
                <li>· Analyze ERP data</li>
                <li>· No record changes</li>
              </ul>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ds-text-default)]">
                <BookOpen className="h-3.5 w-3.5 text-[var(--ds-action-primary)]" />
                Accountant Mode
              </p>
              <ul className="mt-1.5 space-y-1 text-[12px] text-[var(--ds-text-muted)]">
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
