import React from "react";
import { Building2, Calendar, Database, FileBarChart, Shield, BookOpen } from "lucide-react";
import type { OrbixOperatingMode } from "../../lib/ekhata/orbixOperatingMode";
import { ORBIX_MODE_META } from "../../lib/ekhata/orbixOperatingMode";
import type { OrbixReportPayload } from "../../lib/ekhata/orbixReportTypes";
import type { KhataConfirmationCard } from "../../lib/ekhata/types";

interface ContextInspectorProps {
  companyName: string;
  fyName: string;
  mode: OrbixOperatingMode;
  report: OrbixReportPayload | null;
  pendingCard: KhataConfirmationCard | null;
  llmOnline: boolean;
  llmModel?: string | null;
}

const ContextInspector: React.FC<ContextInspectorProps> = ({
  companyName,
  fyName,
  mode,
  report,
  pendingCard,
  llmOnline,
  llmModel,
}) => {
  return (
    <aside
      className="flex h-full flex-col overflow-y-auto bg-[var(--ox-surface-muted)] p-3"
      aria-label="Context inspector"
      data-component="context-inspector"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-subtle)]">
        Context
      </p>

      <div className="space-y-2">
        <div className="rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface)] p-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-[var(--ox-text-muted)]">
            <Building2 className="h-3.5 w-3.5" />
            Company
          </div>
          <p className="text-[13px] font-medium text-[var(--ox-text)]">{companyName}</p>
        </div>

        <div className="rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface)] p-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-[var(--ox-text-muted)]">
            <Calendar className="h-3.5 w-3.5" />
            Period
          </div>
          <p className="text-[13px] font-medium text-[var(--ox-text)]">FY {fyName}</p>
        </div>

        <div className="rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface)] p-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-[var(--ox-text-muted)]">
            {mode === "ask" ? <Shield className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
            Mode
          </div>
          <p className="text-[13px] font-medium text-[var(--ox-text)]">
            {ORBIX_MODE_META[mode].label}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--ox-text-muted)]">
            {mode === "ask" ? "Read only" : "Confirmation before posting"}
          </p>
        </div>

        <div className="rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface)] p-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-[var(--ox-text-muted)]">
            <Database className="h-3.5 w-3.5" />
            Data sources
          </div>
          <p className="text-[12px] text-[var(--ox-text)]">Company ledger · Inventory · Masters</p>
          <p className="mt-1 text-[11px] text-[var(--ox-text-subtle)]" title={llmModel || undefined}>
            {llmOnline ? "Orbix Online" : "Local / limited"}
          </p>
        </div>

        {report && (
          <div className="rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface)] p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-[var(--ox-text-muted)]">
              <FileBarChart className="h-3.5 w-3.5" />
              Active report
            </div>
            <p className="text-[13px] font-medium text-[var(--ox-text)]">{report.title}</p>
            <p className="mt-0.5 text-[11px] text-[var(--ox-text-muted)]">{report.subtitle}</p>
          </div>
        )}

        {pendingCard && (
          <div className="rounded-[var(--ox-radius-md)] border border-[var(--ox-warning)]/30 bg-[var(--ox-warning-soft)] p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ox-warning)]">
              Draft pending
            </p>
            <p className="mt-1 text-[12px] text-[var(--ox-text)]">
              {String(pendingCard.intent || "Transaction")} draft awaiting confirmation
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default ContextInspector;
