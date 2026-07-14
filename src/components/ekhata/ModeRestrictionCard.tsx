import React from "react";
import { Shield, ArrowRight } from "lucide-react";
import type { ModeRestrictionPayload } from "../../lib/ekhata/orbixResponseTypes";

interface ModeRestrictionCardProps {
  payload?: ModeRestrictionPayload | null;
  text?: string;
  onSwitchMode: () => void;
}

const ModeRestrictionCard: React.FC<ModeRestrictionCardProps> = ({
  payload,
  text,
  onSwitchMode,
}) => {
  const friendly =
    text && /switch to accountant/i.test(text)
      ? "This action needs Accountant Mode. You can still review the proposed entry here without changing any records."
      : text ||
        "This action needs Accountant Mode. You can still review the proposed entry here without changing any records.";

  return (
    <div
      className="overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)]"
      data-component="mode-restriction-card"
      data-required-mode={payload?.required_mode || "accountant"}
      data-operation={payload?.requested_operation || undefined}
    >
      <div className="flex items-start gap-3 border-b border-[var(--ds-border-default)] bg-[var(--ds-surface-selected)] px-3.5 py-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--ds-surface)] text-[var(--ds-action-primary)]">
          <Shield className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--ds-text-default)]">Ask Mode — read only</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--ds-text-muted)]">{friendly}</p>
          {payload?.requested_operation && (
            <p className="mt-1 text-[12px] text-[var(--ds-text-subtle)]">
              Requested: {payload.requested_operation.replace(/_/g, " ")}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-3">
        <button
          type="button"
          onClick={onSwitchMode}
          className="inline-flex h-8 items-center gap-1.5 rounded-[var(--ds-radius-md)] bg-[var(--ds-action-primary)] px-3 text-[12px] font-medium text-white hover:bg-[var(--ds-action-primary-hover)]"
        >
          Switch to Accountant Mode
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <span className="text-[12px] text-[var(--ds-text-subtle)]">
          Confirmation will still be required before posting
        </span>
      </div>
    </div>
  );
};

export default ModeRestrictionCard;
