// @ts-nocheck
import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Database, Upload, Download, FileSpreadsheet, CheckSquare } from "lucide-react";

const BORDER = "1px solid #000";
const BG_HEADER = "#D4EABD";
const BTN = (bg: string): React.CSSProperties => ({
  padding: "6px 14px",
  background: bg,
  border: BORDER,
  borderRadius: 3,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  color: bg === "#fff" ? "#000" : "#fff",
});
const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "5px 8px",
  border: BORDER,
  borderRadius: 3,
  fontSize: 12,
  background: "#fff",
  outline: "none",
};

const MASTER_TYPES = [
  "Account",
  "Account Group",
  "Item",
  "Item Group",
  "Unit",
  "Unit Conversion",
  "Bill Sundry",
  "Tax Category",
  "Sale Type",
  "Purchase Type",
  "Discount Structure",
  "Standard Narration",
  "Cost Centre",
  "Warehouse",
  "Currency",
];

export default function DataExportImport() {
  const { accounts, items, parties, units, invoices, vouchers } = useStore();
  const [activeTab, setActiveTab] = useState<
    "import-excel" | "import-vouchers" | "export-masters" | "import-dat"
  >("export-masters");
  const [selectedMasters, setSelectedMasters] = useState<string[]>(MASTER_TYPES);
  const [exportBalances, setExportBalances] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importType, setImportType] = useState("accounts");

  const toggleMaster = (m: string) =>
    setSelectedMasters((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const handleExport = () => {
    const dataToExport: Record<string, any[]> = {};
    if (selectedMasters.includes("Account"))
      dataToExport["accounts"] = accounts.filter((a: any) => !a.isGroup);
    if (selectedMasters.includes("Item")) dataToExport["items"] = items;
    if (exportBalances) {
      dataToExport["account_balances"] = accounts
        .filter((a: any) => !a.isGroup)
        .map((a: any) => ({
          code: a.code,
          name: a.name,
          balance: a.balance || 0,
          type: a.type,
        }));
    }
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sutra_erp_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert(
      "Export complete! File downloaded as JSON.\n\nFor Excel export, add 'xlsx' library usage in this handler.",
    );
  };

  const handleImportExcel = () => {
    if (!importFile) return alert("Please select a file first.");
    alert(
      `Import from Excel/Google Sheet:\n\nFile: ${importFile.name}\nType: ${importType}\n\nTo implement:\n1. Parse Excel with 'xlsx' library (already in package.json)\n2. Map columns to Busy/ERP field names\n3. Loop and call add${importType.charAt(0).toUpperCase() + importType.slice(1)}() from store\n\nSee xlsx docs: XLSX.utils.sheet_to_json(workbook.Sheets[sheet])`,
    );
  };

  const TABS = [
    { id: "export-masters", label: "Export Masters Data", icon: Download },
    { id: "import-excel", label: "Import from Excel", icon: FileSpreadsheet },
    { id: "import-vouchers", label: "Import Vouchers", icon: Upload },
    { id: "import-dat", label: "Import DAT/ZIP File", icon: Database },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderBottom: BORDER,
          background: BG_HEADER,
        }}
      >
        <Database style={{ width: 16, height: 16 }} />
        <span style={{ fontWeight: 700, fontSize: 14 }}>Data Export / Import</span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: BORDER, background: "#F5FAF0" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRight: BORDER,
              fontSize: 12,
              fontWeight: activeTab === id ? 700 : 500,
              background: activeTab === id ? BG_HEADER : "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon style={{ width: 12, height: 12 }} />
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {activeTab === "export-masters" && (
          <div>
            <h3 style={{ marginTop: 0, fontSize: 13, fontWeight: 700 }}>Export Masters Data</h3>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button style={BTN("#fff")} onClick={() => setSelectedMasters(MASTER_TYPES)}>
                  Select All
                </button>
                <button style={BTN("#fff")} onClick={() => setSelectedMasters([])}>
                  Clear All
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 6,
                }}
              >
                {MASTER_TYPES.map((m) => (
                  <label
                    key={m}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMasters.includes(m)}
                      onChange={() => toggleMaster(m)}
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={exportBalances}
                  onChange={(e) => setExportBalances(e.target.checked)}
                />
                Export Opening/Closing Balances
              </label>
            </div>
            <button style={BTN("#3D6B25")} onClick={handleExport}>
              <Download style={{ width: 12, height: 12, display: "inline", marginRight: 6 }} />
              Export Selected Masters ({selectedMasters.length} types)
            </button>
            <div style={{ marginTop: 12, fontSize: 11, color: "#666" }}>
              Currently exports as JSON. To export as Excel, use:{" "}
              <code style={{ background: "#f0f0f0", padding: "1px 4px" }}>
                XLSX.utils.json_to_sheet(data)
              </code>{" "}
              (xlsx package already installed).
            </div>
          </div>
        )}

        {activeTab === "import-excel" && (
          <div>
            <h3 style={{ marginTop: 0, fontSize: 13, fontWeight: 700 }}>
              Import Masters from Excel / Google Sheet
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 480 }}>
              <label style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>Master Type to Import</div>
                <select
                  value={importType}
                  onChange={(e) => setImportType(e.target.value)}
                  style={INPUT_STYLE}
                >
                  <option value="accounts">Account Masters</option>
                  <option value="items">Item Masters</option>
                  <option value="parties">Party Masters</option>
                </select>
              </label>
              <label style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>Excel File (.xlsx / .csv)</div>
                <input
                  type="file"
                  accept=".xlsx,.csv,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  style={{ ...INPUT_STYLE, padding: "4px 8px" }}
                />
              </label>
              <div
                style={{
                  border: BORDER,
                  borderRadius: 4,
                  padding: 12,
                  background: "#F5FAF0",
                  fontSize: 11,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  Field Mapping (Busy 21 → ERP):
                </div>
                {importType === "accounts" &&
                  [
                    "ACC_NAME → name",
                    "ACC_ALIAS → alias (optional)",
                    "ACC_PRINT_NAME → printName",
                    "ACC_GROUP → group",
                    "ACC_TEL_NO → phone",
                    "ACC_EMAIL → email",
                  ].map((f) => (
                    <div key={f} style={{ marginBottom: 2 }}>
                      • {f}
                    </div>
                  ))}
                {importType === "items" &&
                  [
                    "ITEM_NAME → name",
                    "ITEM_ALIAS → alias (optional)",
                    "ITEM_MAIN_UNIT → unit",
                    "ITEM_SALE_PRICE → salesRate",
                    "ITEM_PURC_PRICE → purchaseRate",
                    "ITEM_MRP → mrp",
                    "ITEM_HSN_CODE → hsnCode",
                  ].map((f) => (
                    <div key={f} style={{ marginBottom: 2 }}>
                      • {f}
                    </div>
                  ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={BTN("#3D6B25")} onClick={handleImportExcel}>
                  Import Now
                </button>
                <button
                  style={BTN("#fff")}
                  onClick={() =>
                    alert(
                      "Download sample Excel template for " +
                        importType +
                        ".\n\nImplement by creating an XLSX template using the xlsx library with predefined column headers.",
                    )
                  }
                >
                  Download Sample Template
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "import-vouchers" && (
          <div>
            <h3 style={{ marginTop: 0, fontSize: 13, fontWeight: 700 }}>
              Import Vouchers from Excel
            </h3>
            <div
              style={{
                border: BORDER,
                borderRadius: 4,
                padding: 16,
                background: "#FFFDE7",
                maxWidth: 500,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
                Supported Voucher Types for Import:
              </div>
              {[
                "Payment",
                "Receipt",
                "Journal",
                "Purchase Invoice",
                "Sales Invoice",
                "Contra",
                "Debit Note",
                "Credit Note",
              ].map((v) => (
                <label
                  key={v}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    marginBottom: 4,
                    cursor: "pointer",
                  }}
                >
                  <input type="checkbox" defaultChecked />
                  {v}
                </label>
              ))}
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <label style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 3 }}>Excel File</div>
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    style={{ ...INPUT_STYLE, padding: "4px" }}
                  />
                </label>
              </div>
              <button
                style={{ ...BTN("#3D6B25"), marginTop: 12 }}
                onClick={() =>
                  alert(
                    "Voucher import from Excel:\n\n1. Parse Excel with xlsx library\n2. Map date, account, debit, credit columns\n3. Call addVoucher() from store for each row\n4. Show import summary (success/error count)",
                  )
                }
              >
                Start Import
              </button>
            </div>
          </div>
        )}

        {activeTab === "import-dat" && (
          <div>
            <h3 style={{ marginTop: 0, fontSize: 13, fontWeight: 700 }}>
              Import Data from Busy DAT/ZIP File
            </h3>
            <div style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>Select DAT/ZIP file</div>
                <input type="file" accept=".dat,.zip" style={{ ...INPUT_STYLE, padding: "4px" }} />
              </label>
              <div
                style={{
                  border: BORDER,
                  borderRadius: 4,
                  padding: 12,
                  background: "#F5FAF0",
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  Selectable Voucher Types for Import:
                </div>
                {[
                  "Account Masters",
                  "Item Masters",
                  "Purchase Vouchers",
                  "Sales Vouchers",
                  "Receipt Vouchers",
                  "Payment Vouchers",
                  "Journal Vouchers",
                  "Stock Movements",
                ].map((v) => (
                  <label
                    key={v}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      marginBottom: 3,
                    }}
                  >
                    <input type="checkbox" defaultChecked />
                    {v}
                  </label>
                ))}
              </div>
              <button
                style={BTN("#3D6B25")}
                onClick={() =>
                  alert(
                    "DAT/ZIP Import:\n\nThis requires a custom Busy 21 DAT file parser.\nImplementation steps:\n1. Unzip the file\n2. Parse the proprietary DAT format\n3. Map to ERP schema\n4. Batch import via store actions",
                  )
                }
              >
                Analyse & Import
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
