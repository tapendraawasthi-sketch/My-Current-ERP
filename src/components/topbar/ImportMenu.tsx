import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { logAuditEvent } from "@/lib/auditLog";
import { useTopbarPermissions } from "./useTopbarPermissions";
import {
  Field,
  ModalShell,
  OutlineButton,
  PrimaryButton,
  SelectField,
  TopMenuDropdown,
} from "./shared";

type ImportModalKey = "masters" | "transactions" | "bank" | "payroll" | "logs";
type DuplicateMode = "Skip" | "Update" | "Create Duplicate";

interface ParsedRow {
  rowNo: number;
  values: Record<string, string>;
  errors: string[];
}

interface ImportLogRow {
  id: string;
  date: string;
  importedBy: string;
  type: string;
  fileName: string;
  total: number;
  success: number;
  failed: number;
  status: string;
}

const REQUIRED_FIELDS: Record<string, string[]> = {
  "Import Masters": ["Name"],
  "Import Transactions": ["Voucher Date", "Voucher Number", "Party Ledger", "Amount", "Narration"],
  "Import Bank Statements": ["Date", "Description", "Amount"],
  "Import Payroll Data": ["Employee ID", "Employee Name", "Basic Salary"],
};

const SYSTEM_FIELDS: Record<string, string[]> = {
  "Import Masters": [
    "Code",
    "Name",
    "PAN",
    "VAT Number",
    "Address",
    "Phone",
    "Email",
    "Opening Balance",
    "Status",
  ],
  "Import Transactions": [
    "Voucher Date",
    "Voucher Number",
    "Party Ledger",
    "Ledger",
    "Debit",
    "Credit",
    "Amount",
    "Narration",
    "Reference No",
  ],
  "Import Bank Statements": [
    "Date",
    "Description",
    "Cheque No",
    "Debit",
    "Credit",
    "Amount",
    "Balance",
  ],
  "Import Payroll Data": [
    "Employee ID",
    "Employee Name",
    "Basic Salary",
    "Allowances",
    "Deductions",
    "PF",
    "CIT",
    "Tax",
  ],
};

export default function ImportMenu() {
  const [activeModal, setActiveModal] = useState<ImportModalKey | null>(null);
  const perms = useTopbarPermissions();

  return (
    <>
      <TopMenuDropdown
        items={[
          { key: "masters", label: "Import Masters", shortcut: "M", locked: !perms.canImport },
          {
            key: "transactions",
            label: "Import Transactions",
            shortcut: "T",
            locked: !perms.canImport,
          },
          {
            key: "bank",
            label: "Import Bank Statements",
            shortcut: "B",
            locked: !perms.canImport,
          },
          {
            key: "payroll",
            label: "Import Payroll Data",
            shortcut: "P",
            locked: !perms.canImport,
          },
          { key: "logs", label: "Import Logs", shortcut: "L" },
        ]}
        onSelect={(key) => setActiveModal(key as ImportModalKey)}
      />

      {activeModal === "masters" && (
        <ImportWizard
          title="Import Masters"
          endpoint="/api/import/masters"
          importOptions={["Ledgers", "Stock Items", "Employees", "Cost Centers", "Customers", "Suppliers"]}
          accept=".xlsx,.csv"
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === "transactions" && (
        <ImportWizard
          title="Import Transactions"
          endpoint="/api/import/transactions"
          importOptions={[
            "Sales Invoice",
            "Purchase Invoice",
            "Receipt",
            "Payment",
            "Journal",
            "Contra",
            "Debit Note",
            "Credit Note",
          ]}
          accept=".xlsx,.csv"
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === "bank" && (
        <ImportWizard
          title="Import Bank Statements"
          endpoint="/api/import/bank-statement"
          importOptions={["CSV", "Excel", "OFX", "QIF"]}
          accept=".xlsx,.csv,.ofx,.qif"
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === "payroll" && (
        <ImportWizard
          title="Import Payroll Data"
          endpoint="/api/import/payroll"
          importOptions={["Employee Payroll CSV", "Employee Payroll Excel"]}
          accept=".xlsx,.csv"
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === "logs" && <ImportLogsModal onClose={() => setActiveModal(null)} />}
    </>
  );
}

function ImportWizard({
  title,
  endpoint,
  importOptions,
  accept,
  onClose,
}: {
  title: string;
  endpoint: string;
  importOptions: string[];
  accept: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const [importType, setImportType] = useState(importOptions[0] || "");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("Skip");
  const [submitting, setSubmitting] = useState(false);

  const requiredFields = REQUIRED_FIELDS[title] ?? [];
  const systemFields = SYSTEM_FIELDS[title] ?? [];

  const mappedRows = useMemo(() => {
    return rows.map((row) => {
      const mappedValues: Record<string, string> = {};
      Object.entries(mapping).forEach(([sourceField, targetField]) => {
        if (!targetField) return;
        mappedValues[targetField] = row.values[sourceField] || "";
      });

      const errors = [...row.errors];

      requiredFields.forEach((field) => {
        if (!String(mappedValues[field] || "").trim()) {
          errors.push(`${field} is required`);
        }
      });

      if (mappedValues.Amount && Number.isNaN(Number(mappedValues.Amount))) {
        errors.push("Amount must be numeric");
      }

      if (mappedValues["Basic Salary"] && Number.isNaN(Number(mappedValues["Basic Salary"]))) {
        errors.push("Basic Salary must be numeric");
      }

      return {
        ...row,
        values: mappedValues,
        errors: Array.from(new Set(errors)),
      };
    });
  }, [mapping, requiredFields, rows]);

  const totals = useMemo(() => {
    const total = mappedRows.length;
    const failed = mappedRows.filter((row) => row.errors.length > 0).length;
    return {
      total,
      failed,
      success: total - failed,
    };
  }, [mappedRows]);

  const parseFile = async (file: File) => {
    setFileName(file.name);

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension === "ofx" || extension === "qif") {
      const text = await file.text();
      const parsed = parsePlainStatement(text);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoMap(parsed.headers, systemFields));
      setStep(3);
      return;
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
      defval: "",
    });

    const fileHeaders = raw.length > 0 ? Object.keys(raw[0]) : [];
    const parsedRows: ParsedRow[] = raw.map((row, index) => ({
      rowNo: index + 2,
      values: Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, String(value ?? "").trim()]),
      ),
      errors: [],
    }));

    setHeaders(fileHeaders);
    setRows(parsedRows);
    setMapping(autoMap(fileHeaders, systemFields));
    setStep(3);
  };

  const downloadTemplate = () => {
    const templateHeaders = systemFields.length ? systemFields : ["Name"];
    const worksheet = XLSX.utils.aoa_to_sheet([templateHeaders]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, `${title.replace(/\s+/g, "_")}_Template.xlsx`);
  };

  const downloadErrorFile = () => {
    const errorRows = mappedRows
      .filter((row) => row.errors.length > 0)
      .map((row) => ({
        Row: row.rowNo,
        Errors: row.errors.join("; "),
        ...row.values,
      }));

    if (errorRows.length === 0) {
      toast.success("No errors to download");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(errorRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Errors");
    XLSX.writeFile(workbook, `${title.replace(/\s+/g, "_")}_Errors.xlsx`);
  };

  const submit = async () => {
    const validRows = mappedRows.filter((row) => row.errors.length === 0);

    if (validRows.length === 0) {
      toast.error("✗ No valid rows to import");
      return;
    }

    setSubmitting(true);

    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importType,
          duplicateMode,
          fileName,
          rows: validRows.map((row) => row.values),
        }),
      });

      toast.success(`✓ Import completed: ${validRows.length} rows`);

      await logAuditEvent({
        action: title.toLowerCase().replace(/\s+/g, "_"),
        module: "import",
        status: "success",
        newValue: {
          importType,
          duplicateMode,
          fileName,
          total: mappedRows.length,
          success: validRows.length,
          failed: mappedRows.length - validRows.length,
        },
      });

      setStep(5);
    } catch (error) {
      toast.error("✗ Import failed");

      await logAuditEvent({
        action: title.toLowerCase().replace(/\s+/g, "_"),
        module: "import",
        status: "failed",
        errorReason: String(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      width="max-w-5xl"
      footer={
        <>
          {step > 1 && step < 5 && (
            <OutlineButton onClick={() => setStep(step - 1)}>Back</OutlineButton>
          )}

          {step === 1 && <PrimaryButton onClick={() => setStep(2)}>Next</PrimaryButton>}
          {step === 2 && <OutlineButton onClick={downloadTemplate}>Download Template</OutlineButton>}
          {step === 3 && <PrimaryButton onClick={() => setStep(4)}>Preview</PrimaryButton>}
          {step === 4 && (
            <>
              <OutlineButton onClick={downloadErrorFile}>Download Error File</OutlineButton>
              <PrimaryButton onClick={submit} disabled={submitting || totals.success === 0}>
                {submitting ? "Importing..." : "Import All Valid"}
              </PrimaryButton>
            </>
          )}
          {step === 5 && <PrimaryButton onClick={onClose}>Done</PrimaryButton>}
        </>
      }
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[11px] font-semibold text-gray-500">Step {step} of 5</div>
        <div className="text-[11px] text-gray-500">
          Total: {totals.total} | Success: {totals.success} | Failed: {totals.failed}
        </div>
      </div>

      {step === 1 && (
        <div className="grid gap-3">
          <SelectField
            label="Import Type"
            value={importType}
            onChange={setImportType}
            options={importOptions}
          />
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-[12px] text-blue-700">
            Choose the type of data you want to import into Sutra ERP.
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3">
          <input
            type="file"
            accept={accept}
            className="text-[12px]"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                parseFile(file).catch((error) => {
                  toast.error(`✗ Failed to parse file: ${String(error)}`);
                });
              }
            }}
          />

          <div className="rounded-md border border-gray-200 p-3 text-[12px] text-gray-600">
            Accepted formats: {accept}. Upload a file to continue to field mapping.
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-3">
          <div className="text-[12px] font-semibold text-gray-800">Field Mapping</div>

          {headers.length === 0 ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
              No columns detected. Please upload a valid file.
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-[#f5f6fa]">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">File Column</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">System Field</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((header) => (
                  <tr key={header} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-medium">{header}</td>
                    <td className="px-3 py-2">
                      <select
                        value={mapping[header] || ""}
                        onChange={(event) =>
                          setMapping((prev) => ({
                            ...prev,
                            [header]: event.target.value,
                          }))
                        }
                        className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-[12px]"
                      >
                        <option value="">-- Ignore --</option>
                        {systemFields.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-semibold text-gray-800">Validation Preview</div>
            <select
              value={duplicateMode}
              onChange={(event) => setDuplicateMode(event.target.value as DuplicateMode)}
              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-[12px]"
            >
              <option value="Skip">Skip Duplicates</option>
              <option value="Update">Update Existing</option>
              <option value="Create Duplicate">Create Duplicate</option>
            </select>
          </div>

          <div className="max-h-[360px] overflow-auto rounded-md border border-gray-200">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-[#f5f6fa]">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">Row</th>
                  {systemFields.slice(0, 8).map((field) => (
                    <th key={field} className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">
                      {field}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">Errors</th>
                </tr>
              </thead>
              <tbody>
                {mappedRows.slice(0, 10).map((row) => (
                  <tr
                    key={row.rowNo}
                    className={`border-b border-gray-100 ${row.errors.length > 0 ? "bg-red-50" : ""}`}
                  >
                    <td className="px-3 py-2 font-mono">{row.rowNo}</td>
                    {systemFields.slice(0, 8).map((field) => (
                      <td key={field} className="px-3 py-2">
                        {row.values[field] || "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-red-700">{row.errors.join("; ") || "—"}</td>
                  </tr>
                ))}

                {mappedRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                      No rows to preview.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-green-700">
          Import result: Total {totals.total}, Success {totals.success}, Failed {totals.failed}.
        </div>
      )}
    </ModalShell>
  );
}

function autoMap(headers: string[], systemFields: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  headers.forEach((header) => {
    const normalizedHeader = normalize(header);
    const match = systemFields.find((field) => normalize(field) === normalizedHeader);
    mapping[header] = match || "";
  });

  return mapping;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parsePlainStatement(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.split(/\r?\n/).filter(Boolean);

  const rows = lines.slice(0, 200).map((line, index) => ({
    rowNo: index + 1,
    values: {
      Date: "",
      Description: line.slice(0, 80),
      Amount: "",
    },
    errors: [],
  }));

  return {
    headers: ["Date", "Description", "Amount"],
    rows,
  };
}

function ImportLogsModal({ onClose }: { onClose: () => void }) {
  const logs: ImportLogRow[] = [];

  return (
    <ModalShell title="Import Logs" onClose={onClose} width="max-w-3xl">
      <table className="w-full text-[12px]">
        <thead className="bg-[#f5f6fa]">
          <tr>
            {["Date", "Imported By", "Type", "File Name", "Total", "Success", "Failed", "Status"].map(
              (heading) => (
                <th key={heading} className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">
                  {heading}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                No import logs found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ModalShell>
  );
}
