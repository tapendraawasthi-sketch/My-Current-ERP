import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { useStore } from "@/store/useStore";
import { useTopMenuContext } from "@/hooks/useTopMenuContext";
import { logAuditEvent } from "@/lib/auditLog";
import { useTopbarPermissions } from "./useTopbarPermissions";
import {
  Field,
  ModalShell,
  OutlineButton,
  PrimaryButton,
  SelectField,
  ToggleRow,
  TopMenuDropdown,
} from "./shared";

type ExportModalKey = "current" | "masters" | "transactions" | "reports" | "format" | "logs";
type ExportFormat = "Excel (.xlsx)" | "CSV" | "PDF" | "JSON" | "XML";

interface ExportLogRow {
  id: string;
  date: string;
  exportedBy: string;
  type: string;
  fileName: string;
  format: string;
  status: string;
}

const EXPORT_LOGS_KEY = "sutraExportLogs";

export default function ExportMenu() {
  const [activeModal, setActiveModal] = useState<ExportModalKey | null>(null);
  const perms = useTopbarPermissions();

  return (
    <>
      <TopMenuDropdown
        items={[
          { key: "current", label: "Export Current Screen", shortcut: "E", locked: !perms.canExport },
          { key: "masters", label: "Export Masters", shortcut: "M", locked: !perms.canExport },
          { key: "transactions", label: "Export Transactions", shortcut: "T", locked: !perms.canExport },
          { key: "reports", label: "Export Reports", shortcut: "R", locked: !perms.canExport },
          { key: "format", label: "Format Settings", shortcut: "F" },
          { key: "logs", label: "Export Logs", shortcut: "L" },
        ]}
        onSelect={(key) => setActiveModal(key as ExportModalKey)}
      />

      {activeModal === "current" && <ExportCurrentModal onClose={() => setActiveModal(null)} />}
      {activeModal === "masters" && (
        <ExportFilterModal
          title="Export Masters"
          endpoint="/api/export/masters"
          exportType="masters"
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "transactions" && (
        <ExportFilterModal
          title="Export Transactions"
          endpoint="/api/export/transactions"
          exportType="transactions"
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "reports" && <ExportReportsModal onClose={() => setActiveModal(null)} />}
      {activeModal === "format" && <FormatSettingsModal onClose={() => setActiveModal(null)} />}
      {activeModal === "logs" && <ExportLogsModal onClose={() => setActiveModal(null)} />}
    </>
  );
}

function ExportCurrentModal({ onClose }: { onClose: () => void }) {
  const { context } = useTopMenuContext();
  const snapshot = useCurrentScreenSnapshot();

  const [format, setFormat] = useState<ExportFormat>("Excel (.xlsx)");
  const [fileName, setFileName] = useState(
    `${context.label.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [includeOpening, setIncludeOpening] = useState(true);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeNarration, setIncludeNarration] = useState(true);
  const [passwordProtect, setPasswordProtect] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const actualFileName = normalizeFileName(fileName, format);

  const runExport = async () => {
    setBusy(true);
    try {
      const response = await fetch(context.exportEndpoint, {
        method: "GET",
        headers: {
          Accept: getMimeForFormat(format),
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        downloadBlob(blob, actualFileName);
      } else {
        exportFallback(snapshot, actualFileName, format);
      }

      appendExportLog({
        id: String(Date.now()),
        date: new Date().toISOString(),
        exportedBy: "Current User",
        type: context.label,
        fileName: actualFileName,
        format,
        status: "Success",
      });

      toast.success("✓ Export completed");

      await logAuditEvent({
        action: "export_current_screen",
        module: "export",
        status: "success",
        newValue: {
          context,
          format,
          fileName: actualFileName,
          fromDate,
          toDate,
          includeOpening,
          includeHeader,
          includeNarration,
          passwordProtect,
        },
      });

      onClose();
    } catch (error) {
      try {
        exportFallback(snapshot, actualFileName, format);

        appendExportLog({
          id: String(Date.now()),
          date: new Date().toISOString(),
          exportedBy: "Current User",
          type: context.label,
          fileName: actualFileName,
          format,
          status: "Fallback",
        });

        toast.success("✓ Export completed using local data fallback");
      } catch {
        toast.error("✗ Export failed");

        await logAuditEvent({
          action: "export_current_screen",
          module: "export",
          status: "failed",
          errorReason: String(error),
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={`Export ${context.label}`}
      onClose={onClose}
      footer={
        <>
          <OutlineButton onClick={onClose}>Cancel</OutlineButton>
          <PrimaryButton onClick={runExport} disabled={busy}>
            {busy ? "Exporting..." : "Export"}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField
          label="Format"
          value={format}
          onChange={(value) => setFormat(value as ExportFormat)}
          options={["Excel (.xlsx)", "CSV", "PDF", "JSON", "XML"]}
        />
        <Field label="File Name" value={fileName} onChange={setFileName} />
        <Field label="From Date (BS)" value={fromDate} onChange={setFromDate} />
        <Field label="To Date (BS)" value={toDate} onChange={setToDate} />
      </div>

      <div className="mt-3">
        <ToggleRow label="Include Opening Balance" checked={includeOpening} onChange={setIncludeOpening} />
        <ToggleRow label="Include Company Header" checked={includeHeader} onChange={setIncludeHeader} />
        <ToggleRow label="Include Narration" checked={includeNarration} onChange={setIncludeNarration} />
        <ToggleRow label="Password Protect" checked={passwordProtect} onChange={setPasswordProtect} />
      </div>

      {passwordProtect && (
        <div className="mt-3">
          <Field label="Password" value={password} onChange={setPassword} type="password" />
          <div className="mt-1 text-[11px] text-amber-700">
            Password protection requires backend support for secure encrypted files.
          </div>
        </div>
      )}

      <div className="mt-4 rounded-md border border-gray-200 bg-[#f5f6fa] p-3 text-[12px] text-gray-600">
        Context: <strong>{context.label}</strong>
        <br />
        Endpoint: <span className="font-mono">{context.exportEndpoint}</span>
      </div>
    </ModalShell>
  );
}

function ExportFilterModal({
  title,
  endpoint,
  exportType,
  onClose,
}: {
  title: string;
  endpoint: string;
  exportType: "masters" | "transactions";
  onClose: () => void;
}) {
  const snapshot = useCurrentScreenSnapshot();

  const [format, setFormat] = useState<ExportFormat>("Excel (.xlsx)");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [voucherType, setVoucherType] = useState("All");
  const [ledgerName, setLedgerName] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const runExport = async () => {
    const fileName = normalizeFileName(`${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}`, format);

    try {
      const params = new URLSearchParams({
        format,
        fromDate,
        toDate,
        voucherType,
        ledgerName,
        statusFilter,
      });

      const response = await fetch(`${endpoint}?${params.toString()}`, {
        method: "GET",
        headers: { Accept: getMimeForFormat(format) },
      });

      if (response.ok) {
        downloadBlob(await response.blob(), fileName);
      } else {
        exportFallback(snapshot, fileName, format);
      }

      appendExportLog({
        id: String(Date.now()),
        date: new Date().toISOString(),
        exportedBy: "Current User",
        type: exportType,
        fileName,
        format,
        status: "Success",
      });

      toast.success("✓ Export completed");

      await logAuditEvent({
        action: title.toLowerCase().replace(/\s+/g, "_"),
        module: "export",
        status: "success",
        newValue: { format, fromDate, toDate, voucherType, ledgerName, statusFilter },
      });

      onClose();
    } catch (error) {
      toast.error("✗ Export failed");

      await logAuditEvent({
        action: title.toLowerCase().replace(/\s+/g, "_"),
        module: "export",
        status: "failed",
        errorReason: String(error),
      });
    }
  };

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      footer={
        <>
          <OutlineButton onClick={onClose}>Cancel</OutlineButton>
          <PrimaryButton onClick={runExport}>Export</PrimaryButton>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField
          label="Format"
          value={format}
          onChange={(value) => setFormat(value as ExportFormat)}
          options={["Excel (.xlsx)", "CSV", "PDF", "JSON", "XML"]}
        />
        <SelectField label="Status" value={statusFilter} onChange={setStatusFilter} options={["All", "Active Only", "Modified After"]} />
        <Field label="From Date (BS)" value={fromDate} onChange={setFromDate} />
        <Field label="To Date (BS)" value={toDate} onChange={setToDate} />

        {exportType === "transactions" && (
          <>
            <SelectField
              label="Voucher Type"
              value={voucherType}
              onChange={setVoucherType}
              options={["All", "Sales Invoice", "Purchase Invoice", "Receipt", "Payment", "Journal", "Contra"]}
            />
            <Field label="Ledger Name" value={ledgerName} onChange={setLedgerName} />
          </>
        )}
      </div>
    </ModalShell>
  );
}

function ExportReportsModal({ onClose }: { onClose: () => void }) {
  const setCurrentPage = useStore((state) => state.setCurrentPage);

  const reports = [
    { label: "Trial Balance", page: "trial-balance" },
    { label: "Profit & Loss", page: "profit-loss" },
    { label: "Balance Sheet", page: "balance-sheet" },
    { label: "Cash Flow Statement", page: "cash-flow" },
    { label: "Ledger Report", page: "ledger" },
    { label: "VAT Report", page: "vat-reports" },
    { label: "Stock Summary", page: "stock-summary" },
    { label: "Sales Register", page: "sales-register" },
    { label: "Purchase Register", page: "purchase-register" },
  ];

  return (
    <ModalShell title="Export Reports" onClose={onClose}>
      <div className="grid gap-2">
        {reports.map((report) => (
          <button
            key={report.page}
            type="button"
            className="h-8 rounded-md border border-gray-200 px-3 text-left text-[12px] hover:bg-gray-50"
            onClick={() => {
              setCurrentPage(report.page);
              toast.success(`✓ Switched to ${report.label}. Use Export Current Screen.`);
              onClose();
            }}
          >
            {report.label}
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

function FormatSettingsModal({ onClose }: { onClose: () => void }) {
  const existing = readExportConfig();

  const [defaultFormat, setDefaultFormat] = useState<ExportFormat>(existing.defaultFormat);
  const [includeHeader, setIncludeHeader] = useState(existing.includeHeader);
  const [includeNarration, setIncludeNarration] = useState(existing.includeNarration);
  const [defaultDateRange, setDefaultDateRange] = useState(existing.defaultDateRange);

  const save = () => {
    localStorage.setItem(
      "sutraExportConfig",
      JSON.stringify({
        defaultFormat,
        includeHeader,
        includeNarration,
        defaultDateRange,
      }),
    );

    toast.success("✓ Export settings saved");
    onClose();
  };

  return (
    <ModalShell
      title="Export Format Settings"
      onClose={onClose}
      footer={<PrimaryButton onClick={save}>Save Settings</PrimaryButton>}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField
          label="Default Format"
          value={defaultFormat}
          onChange={(value) => setDefaultFormat(value as ExportFormat)}
          options={["Excel (.xlsx)", "CSV", "PDF", "JSON", "XML"]}
        />
        <SelectField
          label="Default Date Range"
          value={defaultDateRange}
          onChange={setDefaultDateRange}
          options={["Current FY", "This Month", "Today", "Custom"]}
        />
      </div>

      <div className="mt-3">
        <ToggleRow label="Include Company Header" checked={includeHeader} onChange={setIncludeHeader} />
        <ToggleRow label="Include Narration" checked={includeNarration} onChange={setIncludeNarration} />
      </div>
    </ModalShell>
  );
}

function ExportLogsModal({ onClose }: { onClose: () => void }) {
  const logs = readExportLogs();

  return (
    <ModalShell title="Export Logs" onClose={onClose} width="max-w-3xl">
      <table className="w-full text-[12px]">
        <thead className="bg-[#f5f6fa]">
          <tr>
            {["Date", "Exported By", "Type", "File Name", "Format", "Status"].map((heading) => (
              <th key={heading} className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-gray-100">
              <td className="px-3 py-2">{new Date(log.date).toLocaleString()}</td>
              <td className="px-3 py-2">{log.exportedBy}</td>
              <td className="px-3 py-2">{log.type}</td>
              <td className="px-3 py-2 font-mono">{log.fileName}</td>
              <td className="px-3 py-2">{log.format}</td>
              <td className="px-3 py-2">{log.status}</td>
            </tr>
          ))}

          {logs.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                No export logs found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ModalShell>
  );
}

function useCurrentScreenSnapshot(): Record<string, unknown>[] {
  const currentPage = useStore((state) => state.currentPage);
  const accounts = useStore((state) => state.accounts);
  const parties = useStore((state) => state.parties);
  const items = useStore((state) => state.items);
  const vouchers = useStore((state) => state.vouchers);
  const invoices = useStore((state) => state.invoices);

  return useMemo(() => {
    if (currentPage === "accounts" || currentPage === "ledgers") return accounts as unknown as Record<string, unknown>[];
    if (currentPage === "parties") return parties as unknown as Record<string, unknown>[];
    if (currentPage === "items" || currentPage === "stock-summary") return items as unknown as Record<string, unknown>[];
    if (currentPage === "vouchers") return vouchers as unknown as Record<string, unknown>[];
    if (currentPage.includes("invoice") || currentPage === "billing") {
      return invoices as unknown as Record<string, unknown>[];
    }

    return [
      {
        screen: currentPage,
        exportedAt: new Date().toISOString(),
        note: "Generic current screen export fallback.",
      },
    ];
  }, [accounts, currentPage, invoices, items, parties, vouchers]);
}

function normalizeFileName(fileName: string, format: ExportFormat): string {
  const base = fileName.replace(/\.(xlsx|csv|pdf|json|xml)$/i, "");
  const extension =
    format === "Excel (.xlsx)"
      ? "xlsx"
      : format === "CSV"
        ? "csv"
        : format === "PDF"
          ? "pdf"
          : format === "JSON"
            ? "json"
            : "xml";

  return `${base}.${extension}`;
}

function getMimeForFormat(format: ExportFormat): string {
  if (format === "Excel (.xlsx)") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (format === "CSV") return "text/csv";
  if (format === "PDF") return "application/pdf";
  if (format === "JSON") return "application/json";
  return "application/xml";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportFallback(rows: Record<string, unknown>[], fileName: string, format: ExportFormat) {
  if (format === "Excel (.xlsx)") {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Export");
    XLSX.writeFile(workbook, fileName);
    return;
  }

  if (format === "CSV") {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    downloadBlob(new Blob([csv], { type: "text/csv" }), fileName);
    return;
  }

  if (format === "XML") {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><rows>${rows
      .map((row) => `<row>${Object.entries(row).map(([key, value]) => `<${key}>${escapeXml(String(value ?? ""))}</${key}>`).join("")}</row>`)
      .join("")}</rows>`;
    downloadBlob(new Blob([xml], { type: "application/xml" }), fileName);
    return;
  }

  downloadBlob(
    new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }),
    fileName,
  );
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function readExportConfig(): {
  defaultFormat: ExportFormat;
  includeHeader: boolean;
  includeNarration: boolean;
  defaultDateRange: string;
} {
  try {
    const parsed = JSON.parse(localStorage.getItem("sutraExportConfig") || "{}");
    return {
      defaultFormat: parsed.defaultFormat || "Excel (.xlsx)",
      includeHeader: parsed.includeHeader ?? true,
      includeNarration: parsed.includeNarration ?? true,
      defaultDateRange: parsed.defaultDateRange || "Current FY",
    };
  } catch {
    return {
      defaultFormat: "Excel (.xlsx)",
      includeHeader: true,
      includeNarration: true,
      defaultDateRange: "Current FY",
    };
  }
}

function appendExportLog(log: ExportLogRow) {
  const logs = readExportLogs();
  localStorage.setItem(EXPORT_LOGS_KEY, JSON.stringify([log, ...logs].slice(0, 50)));
}

function readExportLogs(): ExportLogRow[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(EXPORT_LOGS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
