import React, { useState } from "react";
import { CloudOff, ChevronDown, ChevronUp } from "lucide-react";
import { ORBIX_OFFLINE_DIAGNOSTICS } from "../../lib/ekhata/orbixQwenClient";

const ProviderOfflineCard: React.FC<{ text?: string }> = ({ text }) => {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)]"
      data-component="provider-offline-card"
      data-testid="orbix-provider-offline"
    >
      <div className="flex items-start gap-3 bg-[var(--ds-status-warning-surface)] px-3.5 py-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--ds-surface)] text-[var(--ds-status-warning)]">
          <CloudOff className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--ds-text-default)]">Orbix is temporarily limited</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--ds-text-muted)]">
            {text && !text.includes("OIP_")
              ? text
              : "We could not reach the AI service. You can keep using ERP screens and try again shortly."}
          </p>
        </div>
      </div>
      <div className="px-3.5 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--ds-text-subtle)] hover:text-[var(--ds-text-muted)]"
        >
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Technical details
        </button>
        {open && (
          <pre className="mt-2 whitespace-pre-wrap rounded-[var(--ds-radius-md)] bg-[var(--ds-surface-muted)] p-2 text-[12px] text-[var(--ds-text-muted)]">
            {ORBIX_OFFLINE_DIAGNOSTICS}
          </pre>
        )}
      </div>
    </div>
  );
};

export default ProviderOfflineCard;
