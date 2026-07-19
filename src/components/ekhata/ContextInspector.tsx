import React from "react";
import { Building2, Calendar, Database, FileBarChart, Shield, BookOpen, Languages } from "lucide-react";
import type { OrbixOperatingMode } from "../../lib/ekhata/orbixOperatingMode";
import { ORBIX_MODE_META } from "../../lib/ekhata/orbixOperatingMode";
import type { OrbixReportPayload } from "../../lib/ekhata/orbixReportTypes";
import type { KhataConfirmationCard } from "../../lib/ekhata/types";
import type { OrbixNpKbHint } from "../../lib/ekhata/orbixQwenClient";

interface ContextInspectorProps {
  companyName: string;
  fyName: string;
  mode: OrbixOperatingMode;
  report: OrbixReportPayload | null;
  pendingCard: KhataConfirmationCard | null;
  llmOnline: boolean;
  llmModel?: string | null;
  npKb?: OrbixNpKbHint | null;
}

/** Evidence / context rail — company, fiscal, mode, sources. No provider brand names. */
const ContextInspector: React.FC<ContextInspectorProps> = ({
  companyName,
  fyName,
  mode,
  report,
  pendingCard,
  llmOnline,
  npKb,
}) => {
  const snippets = (npKb?.hint_snippets || []).filter((s) => s.snippet || s.record_id).slice(0, 3);

  return (
    <aside
      className="flex h-full flex-col overflow-y-auto bg-[var(--ds-surface-muted)] p-3"
      aria-label="Evidence and context"
      data-component="context-inspector"
      data-testid="orbix-evidence-panel"
    >
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-subtle)]">
        Evidence & context
      </p>

      <div className="space-y-2">
        <div className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[12px] text-[var(--ds-text-muted)]">
            <Building2 className="h-3.5 w-3.5" aria-hidden />
            Company
          </div>
          <p className="text-[13px] font-medium text-[var(--ds-text-default)]">{companyName}</p>
        </div>

        <div className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[12px] text-[var(--ds-text-muted)]">
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            Period
          </div>
          <p className="text-[13px] font-medium text-[var(--ds-text-default)]">FY {fyName}</p>
        </div>

        <div className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[12px] text-[var(--ds-text-muted)]">
            {mode === "ask" ? (
              <Shield className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
            )}
            Mode
          </div>
          <p className="text-[13px] font-medium text-[var(--ds-text-default)]">
            {ORBIX_MODE_META[mode].label}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--ds-text-muted)]">
            {mode === "ask" ? "Read only — no posting" : "Confirmation required before posting"}
          </p>
        </div>

        <div className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[12px] text-[var(--ds-text-muted)]">
            <Database className="h-3.5 w-3.5" aria-hidden />
            Data sources
          </div>
          <p className="text-[12px] text-[var(--ds-text-default)]">Company ledger · Inventory · Masters</p>
          <p className="mt-1 text-[12px] text-[var(--ds-text-subtle)]">
            {llmOnline ? "Orbix interpretation available" : "Interpretation limited — ERP remains usable"}
          </p>
        </div>

        {npKb?.enabled && snippets.length > 0 ? (
          <div
            className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-2.5"
            data-testid="orbix-np-kb-citations"
          >
            <div className="mb-1 flex items-center gap-1.5 text-[12px] text-[var(--ds-text-muted)]">
              <Languages className="h-3.5 w-3.5" aria-hidden />
              Language KB
            </div>
            <p className="mb-1.5 text-[12px] text-[var(--ds-text-subtle)]">
              Interpretation hints only — not posting authority
              {npKb.language_form ? ` · ${npKb.language_form}` : ""}
            </p>
            <ul className="space-y-1.5">
              {snippets.map((s, i) => (
                <li key={`${s.record_id || "hint"}-${i}`} className="text-[12px] text-[var(--ds-text-default)]">
                  <span className="font-mono text-[12px] text-[var(--ds-text-subtle)]">
                    {s.record_id || "kb"}
                    {s.domain ? ` · ${s.domain}` : ""}
                  </span>
                  {s.snippet ? (
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--ds-text-muted)]">{s.snippet}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {report && (
          <div className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-[12px] text-[var(--ds-text-muted)]">
              <FileBarChart className="h-3.5 w-3.5" aria-hidden />
              Active report
            </div>
            <p className="text-[13px] font-medium text-[var(--ds-text-default)]">{report.title}</p>
            {report.subtitle ? (
              <p className="mt-0.5 text-[12px] text-[var(--ds-text-muted)]">{report.subtitle}</p>
            ) : null}
          </div>
        )}

        {pendingCard && (
          <div
            className="rounded-[var(--ds-radius-md)] border border-[var(--ds-status-warning)]/30 bg-[var(--ds-status-warning-surface)] p-2.5"
            data-testid="orbix-evidence-draft"
          >
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-status-warning)]">
              Draft pending
            </p>
            <p className="mt-1 text-[12px] text-[var(--ds-text-default)]">
              Awaiting confirmation — nothing posted yet
            </p>
            {pendingCard.draft_id ? (
              <p className="mt-1 font-mono text-[12px] text-[var(--ds-text-subtle)]" data-testid="orbix-evidence-draft-id">
                Draft · {String(pendingCard.draft_id).slice(0, 8)}…
              </p>
            ) : null}
            {pendingCard.preview_version != null ? (
              <p className="mt-0.5 text-[12px] text-[var(--ds-text-subtle)]" data-testid="orbix-evidence-preview-version">
                Preview version · {String(pendingCard.preview_version)}
              </p>
            ) : null}
            {pendingCard.preview_hash ? (
              <p className="mt-0.5 font-mono text-[12px] text-[var(--ds-text-subtle)]" data-testid="orbix-evidence-preview-hash">
                Hash · {String(pendingCard.preview_hash).slice(0, 10)}…
              </p>
            ) : (
              <p className="mt-1 text-[12px] text-[var(--ds-text-subtle)]">Confirm preview identifiers pending</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

export default ContextInspector;
