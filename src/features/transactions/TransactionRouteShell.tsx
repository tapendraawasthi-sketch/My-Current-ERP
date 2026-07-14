/**
 * UI-7 — route boundary that wraps production transaction pages
 * in the shared TransactionWorkspace without editing page line fingerprints.
 */
import React, { useState } from "react";
import { useStore } from "@/store/useStore";
import {
  TransactionWorkspace,
  TransactionInspector,
  type TransactionDocMode,
} from "@/features/transactions";

export function TransactionRouteShell({
  family,
  mode,
  title,
  description,
  children,
}: {
  family: string;
  mode: TransactionDocMode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const companySettings = useStore((s) => s.companySettings);
  const currentFiscalYear = useStore((s) => s.currentFiscalYear);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  return (
    <TransactionWorkspace
      title={title}
      description={description}
      family={family}
      mode={mode}
      companyName={
        companySettings?.companyNameEn ||
        (companySettings as { name?: string } | null)?.name ||
        "Company"
      }
      fiscalYearName={currentFiscalYear?.name || "—"}
      lifecycle="draft"
      inspectorOpen={inspectorOpen}
      onToggleInspector={() => setInspectorOpen((v) => !v)}
      inspector={
        <TransactionInspector>
          <p className="text-[13px] text-[var(--ds-text-default)]">
            Company · fiscal year · document evidence
          </p>
          <p className="text-[12px] text-[var(--ds-text-muted)]">
            Posting uses the authoritative domain command for this document family.
          </p>
        </TransactionInspector>
      }
    >
      {children}
    </TransactionWorkspace>
  );
}
