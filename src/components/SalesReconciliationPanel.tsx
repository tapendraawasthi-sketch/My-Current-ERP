/**
 * Minimal Sales accounting reconciliation panel (Phase 6.5.10).
 * Read-only — does not repair records.
 */

import React, { useState } from "react";
import {
  runSalesReconciliation,
  type ReconciliationReport,
} from "@/platform/sync/reconciliation";
import { getDB } from "@/lib/db";

const SalesReconciliationPanel: React.FC<{ companyId?: string }> = ({ companyId }) => {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedCompany, setResolvedCompany] = useState(companyId || "");

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      let cid = companyId;
      if (!cid) {
        const settings = await getDB().companySettings.toCollection().first();
        cid =
          (settings as { companyId?: string } | undefined)?.companyId ||
          settings?.id ||
          "main";
      }
      setResolvedCompany(cid);
      const next = await runSalesReconciliation(cid);
      setReport(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconciliation failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="border border-gray-200 bg-white p-3 text-[12px] text-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-800">Sales Reconciliation</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Read-only invoice / journal / VAT / COGS / stock checks
            {resolvedCompany ? ` · ${resolvedCompany}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md disabled:opacity-50"
        >
          {running ? "Running…" : "Run"}
        </button>
      </div>
      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 px-2 py-1 mb-2">{error}</div>
      )}
      {report && (
        <div>
          <div
            className={
              report.pass
                ? "bg-green-50 text-green-700 border border-green-200 px-2 py-1 mb-2"
                : "bg-red-50 text-red-700 border border-red-200 px-2 py-1 mb-2"
            }
          >
            {report.pass ? "PASS" : "FAIL"} — {report.summary.errors} error(s),{" "}
            {report.summary.warnings} warning(s)
          </div>
          <div className="max-h-64 overflow-auto border border-gray-200">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Code
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Severity
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Message
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.findings.length === 0 ? (
                  <tr>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700" colSpan={3}>
                      No findings
                    </td>
                  </tr>
                ) : (
                  report.findings.map((f, idx) => (
                    <tr key={`${f.code}-${idx}`} className="border-b border-gray-100">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">{f.code}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{f.severity}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{f.message}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesReconciliationPanel;
