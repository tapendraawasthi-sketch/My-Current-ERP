// @ts-nocheck
import React, { useState, useRef } from "react";
import { useStore } from "../../store/useStore";
import { getDB, generateId } from "../../lib/db";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  Database,
  Upload,
  Download,
  FileSpreadsheet,
  CheckSquare,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";

const BORDER = "1px solid #000";
const BG_HEADER = "#D4EABD";
const BG_CARD = "#EBF5E2";

export default function DataExportImport() {
  const [activeTab, setActiveTab] = useState("export-masters");
  const [tallyStep, setTallyStep] = useState(1);
  const [tallyFile, setTallyFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [mapping, setMapping] = useState({});
  const [progress, setProgress] = useState(0);
  const [statusLog, setStatusLog] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const { accounts, items, parties } = useStore();

  // Parse Tally XML
  const parseTallyXML = (xmlText) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");

    const result = { groups: [], ledgers: [], stockItems: [], units: [], parties: [] };

    // Parse Groups
    const groupNodes = doc.querySelectorAll("GROUP");
    groupNodes.forEach((g) => {
      const name = g.getAttribute("NAME") || g.querySelector("NAME")?.textContent?.trim();
      const parent = g.querySelector("PARENT")?.textContent?.trim();
      if (name) result.groups.push({ name, parent });
    });

    // Parse Ledgers
    const ledgerNodes = doc.querySelectorAll("LEDGER");
    ledgerNodes.forEach((l) => {
      const name = l.getAttribute("NAME") || l.querySelector("NAME")?.textContent?.trim();
      const parent = l.querySelector("PARENT")?.textContent?.trim();
      const openingBal = l.querySelector("OPENINGBALANCE")?.textContent?.trim() || "0";
      const address = l.querySelector("ADDRESS ADDR")?.textContent?.trim() || "";
      const pan = l.querySelector("INCOMETAXNUMBER")?.textContent?.trim() || "";
      const gst = l.querySelector("GSTREGISTRATIONNUMBER")?.textContent?.trim() || "";
      if (name) {
        result.ledgers.push({ name, parent, openingBalance: openingBal, address, pan, gstNo: gst });
        // Identify parties
        if (parent === "Sundry Debtors" || parent === "Sundry Creditors") {
          result.parties.push({
            name,
            type: parent === "Sundry Debtors" ? "customer" : "vendor",
            openingBalance: openingBal,
            address,
            pan,
          });
        }
      }
    });

    // Parse Stock Items
    const stockNodes = doc.querySelectorAll("STOCKITEM");
    stockNodes.forEach((s) => {
      const name = s.getAttribute("NAME") || s.querySelector("NAME")?.textContent?.trim();
      const parent = s.querySelector("PARENT")?.textContent?.trim();
      const unit = s.querySelector("BASEUNITS")?.textContent?.trim();
      const rate =
        s.querySelector("STANDARDCOST RATEOFVAT, BASELCVALUE")?.textContent?.trim() || "0";
      const qty = s.querySelector("CLOSINGBALANCE")?.textContent?.trim() || "0";
      if (name) result.stockItems.push({ name, parent, unit, rate, openingQty: qty });
    });

    // Parse Units
    const unitNodes = doc.querySelectorAll("UNIT");
    unitNodes.forEach((u) => {
      const name = u.getAttribute("NAME") || u.querySelector("NAME")?.textContent?.trim();
      const symbol = u.querySelector("ORIGINALNAME")?.textContent?.trim() || name;
      if (name) result.units.push({ name, symbol });
    });

    return result;
  };

  // Handle file upload
  const handleTallyFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "text/xml") {
      setTallyFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const xmlText = event.target.result;
          const parsed = parseTallyXML(xmlText);
          setParsedData(parsed);
          // Detect conflicts
          const detectedConflicts = [];
          [...parsed.ledgers, ...parsed.stockItems].forEach((item) => {
            const existingAcc = accounts.some(
              (acc) => acc.name.toLowerCase() === item.name.toLowerCase(),
            );
            const existingItem = items.some(
              (it) => it.name.toLowerCase() === item.name.toLowerCase(),
            );
            if (existingAcc || existingItem) {
              detectedConflicts.push({
                name: item.name,
                type: existingAcc ? "Ledger" : "Item",
                conflict: "Name exists",
                resolution: "skip", // default
              });
            }
          });
          setConflicts(detectedConflicts);
        } catch (err) {
          toast.error("Error parsing XML file");
        }
      };
      reader.readAsText(file);
    } else {
      toast.error("Please select a valid XML file");
    }
  };

  // Handle next step
  const handleNextStep = () => {
    if (tallyStep === 1 && tallyFile) {
      setTallyStep(2);
    } else if (tallyStep === 2) {
      setTallyStep(3);
    } else if (tallyStep === 3) {
      setTallyStep(4);
      runImport();
    }
  };

  // Run import
  const runImport = async () => {
    const db = getDB();
    let imported = 0;
    let skipped = 0;
    const errors = [];

    setStatusLog(["Starting import..."]);

    // Import units first
    for (const unit of parsedData.units) {
      try {
        const existingUnit = await db.units.where("name").equals(unit.name).first();
        if (
          existingUnit &&
          conflicts.some((c) => c.name === unit.name && c.resolution === "skip")
        ) {
          skipped++;
          continue;
        }
        await db.units.put({
          id: generateId(),
          code: unit.symbol?.substring(0, 10) || unit.name?.substring(0, 10),
          name: unit.name,
          symbol: unit.symbol || unit.name,
          isActive: true,
        });
        imported++;
      } catch (e) {
        errors.push(`Unit ${unit.name}: ${e.message}`);
      }
    }
    setProgress(10);
    setStatusLog((prev) => [...prev, `✓ Units imported: ${parsedData.units.length}`]);

    // Import account groups (as isGroup=true accounts)
    for (const group of parsedData.groups) {
      try {
        const accountType = mapping[group.parent] || "asset";
        await db.accounts.put({
          id: generateId(),
          code: "",
          name: group.name,
          type: accountType,
          level: "subgroup",
          isGroup: true,
          isActive: true,
          balance: 0,
          openingBalance: 0,
          openingBalanceDr: 0,
          openingBalanceCr: 0,
        });
        imported++;
      } catch (e) {
        errors.push(`Group ${group.name}: ${e.message}`);
      }
    }
    setProgress(30);
    setStatusLog((prev) => [...prev, `✓ Account groups imported: ${parsedData.groups.length}`]);

    // Import ledgers (as accounts)
    for (const ledger of parsedData.ledgers) {
      try {
        const accountType = mapping[ledger.parent] || "asset";
        const balStr = String(ledger.openingBalance || "0").replace(/[^0-9.-]/g, "");
        const balNum = parseFloat(balStr) || 0;
        await db.accounts.put({
          id: generateId(),
          code: "",
          name: ledger.name,
          type: accountType,
          level: "ledger",
          isGroup: false,
          isActive: true,
          balance: balNum,
          openingBalance: Math.abs(balNum),
          openingBalanceDr: balNum > 0 ? balNum : 0,
          openingBalanceCr: balNum < 0 ? Math.abs(balNum) : 0,
        });
        imported++;
      } catch (e) {
        errors.push(`Ledger ${ledger.name}: ${e.message}`);
      }
    }
    setProgress(60);
    setStatusLog((prev) => [...prev, `✓ Ledgers imported: ${parsedData.ledgers.length}`]);

    // Import parties
    for (const party of parsedData.parties) {
      try {
        await db.parties.put({
          id: generateId(),
          code: "",
          name: party.name,
          type: party.type,
          pan: party.pan || "",
          address: party.address || "",
          isActive: true,
        });
        imported++;
      } catch (e) {
        errors.push(`Party ${party.name}: ${e.message}`);
      }
    }
    setProgress(80);
    setStatusLog((prev) => [...prev, `✓ Parties imported: ${parsedData.parties.length}`]);

    // Import stock items
    for (const item of parsedData.stockItems) {
      try {
        await db.items.put({
          id: generateId(),
          code: "",
          name: item.name,
          type: "product",
          isActive: true,
          unit: item.unit || "pcs",
        });
        imported++;
      } catch (e) {
        errors.push(`Item ${item.name}: ${e.message}`);
      }
    }
    setProgress(100);
    setStatusLog((prev) => [...prev, `✓ Items imported: ${parsedData.stockItems.length}`]);

    const result = { imported, skipped, errors };
    setImportResult(result);
    setStatusLog((prev) => [
      ...prev,
      `Import completed. Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors.length}`,
    ]);
  };

  // Render Tally Migration
  const renderTallyMigration = () => {
    if (tallyStep === 1) {
      return (
        <div>
          <div
            style={{
              border: "2px dashed #666",
              borderRadius: "8px",
              padding: "40px",
              textAlign: "center",
              backgroundColor: BG_CARD,
              marginBottom: "20px",
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={48} style={{ margin: "0 auto 15px", color: "#666" }} />
            <h3
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                color: "#000000",
                marginBottom: "10px",
              }}
            >
              Drop your Tally XML export file here or click to browse
            </h3>
            <p style={{ color: "#666", marginBottom: "15px" }}>Accepted: .xml files only</p>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xml"
              onChange={handleTallyFileChange}
              style={{ display: "none" }}
            />
          </div>

          <div
            style={{
              marginBottom: "20px",
              padding: "15px",
              backgroundColor: "#f0f0f0",
              borderRadius: "6px",
              border: BORDER,
            }}
          >
            <h4
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                color: "#000000",
                marginBottom: "10px",
              }}
            >
              HOW TO EXPORT FROM TALLY PRIME:
            </h4>
            <ol style={{ textAlign: "left", padding: "0 20px", color: "#000000" }}>
              <li>Open Tally Prime</li>
              <li>Go to Gateway → Alt+E (Export)</li>
              <li>Choose 'Data' → 'Complete Data'</li>
              <li>Select format: XML</li>
              <li>Export the file and upload it here</li>
            </ol>
          </div>

          {tallyFile && (
            <div
              style={{
                marginBottom: "20px",
                padding: "10px",
                backgroundColor: "#dcfce7",
                borderRadius: "6px",
                border: "1px solid #059669",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <CheckCircle size={20} style={{ color: "#059669" }} />
              <span style={{ color: "#000000" }}>
                ✓ File loaded: {tallyFile.name} ({(tallyFile.size / 1024).toFixed(2)} KB)
              </span>
            </div>
          )}

          <button
            onClick={handleNextStep}
            disabled={!tallyFile}
            style={{
              backgroundColor: tallyFile ? "#1557b0" : "#ccc",
              color: "white",
              border: BORDER,
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: tallyFile ? "pointer" : "not-allowed",
            }}
          >
            NEXT: PARSE FILE
          </button>
        </div>
      );
    }

    if (tallyStep === 2) {
      return (
        <div>
          <h3
            style={{ fontSize: "16px", fontWeight: "bold", color: "#000000", marginBottom: "15px" }}
          >
            Parse & Preview
          </h3>

          {parsedData ? (
            <div style={{ marginBottom: "20px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "15px",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    padding: "10px",
                    backgroundColor: BG_HEADER,
                    borderRadius: "4px",
                    border: BORDER,
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#000000" }}>Groups Found</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
                    {parsedData.groups.length}
                  </div>
                </div>
                <div
                  style={{
                    padding: "10px",
                    backgroundColor: BG_HEADER,
                    borderRadius: "4px",
                    border: BORDER,
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#000000" }}>Ledgers Found</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
                    {parsedData.ledgers.length}
                  </div>
                </div>
                <div
                  style={{
                    padding: "10px",
                    backgroundColor: BG_HEADER,
                    borderRadius: "4px",
                    border: BORDER,
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#000000" }}>Stock Items Found</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
                    {parsedData.stockItems.length}
                  </div>
                </div>
                <div
                  style={{
                    padding: "10px",
                    backgroundColor: BG_HEADER,
                    borderRadius: "4px",
                    border: BORDER,
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#000000" }}>Units Found</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
                    {parsedData.units.length}
                  </div>
                </div>
                <div
                  style={{
                    padding: "10px",
                    backgroundColor: BG_HEADER,
                    borderRadius: "4px",
                    border: BORDER,
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#000000" }}>Parties Found</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
                    {parsedData.parties.length}
                  </div>
                </div>
                <div
                  style={{
                    padding: "10px",
                    backgroundColor: BG_HEADER,
                    borderRadius: "4px",
                    border: BORDER,
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#000000" }}>Opening Balances</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
                    {parsedData.ledgers.filter((l) => parseFloat(l.openingBalance) !== 0).length}
                  </div>
                </div>
              </div>

              {conflicts.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <h4
                    style={{
                      fontSize: "14px",
                      fontWeight: "bold",
                      color: "#000000",
                      marginBottom: "10px",
                    }}
                  >
                    Detected Conflicts
                  </h4>
                  <div
                    style={{
                      border: BORDER,
                      borderRadius: "4px",
                      maxHeight: "300px",
                      overflowY: "auto",
                    }}
                  >
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ backgroundColor: BG_HEADER }}>
                          <th style={{ border: BORDER, padding: "6px", fontSize: "12px" }}>Name</th>
                          <th style={{ border: BORDER, padding: "6px", fontSize: "12px" }}>Type</th>
                          <th style={{ border: BORDER, padding: "6px", fontSize: "12px" }}>
                            Conflict
                          </th>
                          <th style={{ border: BORDER, padding: "6px", fontSize: "12px" }}>
                            Resolution
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {conflicts.map((conflict, index) => (
                          <tr key={index}>
                            <td style={{ border: BORDER, padding: "6px", fontSize: "12px" }}>
                              {conflict.name}
                            </td>
                            <td style={{ border: BORDER, padding: "6px", fontSize: "12px" }}>
                              {conflict.type}
                            </td>
                            <td style={{ border: BORDER, padding: "6px", fontSize: "12px" }}>
                              {conflict.conflict}
                            </td>
                            <td style={{ border: BORDER, padding: "6px", fontSize: "12px" }}>
                              <select
                                value={conflict.resolution}
                                onChange={(e) => {
                                  const updated = [...conflicts];
                                  updated[index].resolution = e.target.value;
                                  setConflicts(updated);
                                }}
                                style={{
                                  padding: "4px",
                                  fontSize: "12px",
                                  border: BORDER,
                                  borderRadius: "4px",
                                }}
                              >
                                <option value="skip">Skip</option>
                                <option value="overwrite">Overwrite</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
              Parsing Tally XML...
            </div>
          )}

          <button
            onClick={handleNextStep}
            style={{
              backgroundColor: "#1557b0",
              color: "white",
              border: BORDER,
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            NEXT: CONFIGURE MAPPING
          </button>
        </div>
      );
    }

    if (tallyStep === 3) {
      return (
        <div>
          <h3
            style={{ fontSize: "16px", fontWeight: "bold", color: "#000000", marginBottom: "15px" }}
          >
            Account Group Mapping
          </h3>

          <div
            style={{
              marginBottom: "20px",
              padding: "15px",
              backgroundColor: "#f0f0f0",
              borderRadius: "6px",
              border: BORDER,
            }}
          >
            <p style={{ color: "#000000", marginBottom: "10px" }}>
              Map Tally groups to your system's account types. Adjust as needed:
            </p>
          </div>

          <div
            style={{ border: BORDER, borderRadius: "4px", maxHeight: "400px", overflowY: "auto" }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: BG_HEADER }}>
                  <th style={{ border: BORDER, padding: "6px", fontSize: "12px" }}>Tally Group</th>
                  <th style={{ border: BORDER, padding: "6px", fontSize: "12px" }}>
                    Your System Nature
                  </th>
                </tr>
              </thead>
              <tbody>
                {parsedData?.groups.map((group, index) => {
                  const suggestedType = group.parent?.includes("Debtors")
                    ? "asset"
                    : group.parent?.includes("Creditors")
                      ? "liability"
                      : group.parent?.includes("Bank")
                        ? "asset"
                        : group.parent?.includes("Cash")
                          ? "asset"
                          : group.parent?.includes("Sales")
                            ? "income"
                            : group.parent?.includes("Purchase")
                              ? "expense"
                              : group.parent?.includes("Capital")
                                ? "equity"
                                : "asset";

                  return (
                    <tr key={index}>
                      <td style={{ border: BORDER, padding: "6px", fontSize: "12px" }}>
                        {group.name}
                      </td>
                      <td style={{ border: BORDER, padding: "6px", fontSize: "12px" }}>
                        <select
                          value={mapping[group.name] || suggestedType}
                          onChange={(e) => {
                            setMapping((prev) => ({ ...prev, [group.name]: e.target.value }));
                          }}
                          style={{
                            width: "100%",
                            padding: "4px",
                            fontSize: "12px",
                            border: BORDER,
                            borderRadius: "4px",
                          }}
                        >
                          <option value="asset">Asset</option>
                          <option value="liability">Liability</option>
                          <option value="equity">Equity</option>
                          <option value="income">Income</option>
                          <option value="expense">Expense</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleNextStep}
            style={{
              backgroundColor: "#1557b0",
              color: "white",
              border: BORDER,
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              marginTop: "15px",
            }}
          >
            NEXT: IMPORT DATA
          </button>
        </div>
      );
    }

    if (tallyStep === 4) {
      return (
        <div>
          <h3
            style={{ fontSize: "16px", fontWeight: "bold", color: "#000000", marginBottom: "15px" }}
          >
            Import Progress
          </h3>

          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                height: "20px",
                border: BORDER,
                borderRadius: "10px",
                overflow: "hidden",
                backgroundColor: "#e0e0e0",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  backgroundColor: BG_HEADER,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div style={{ textAlign: "center", marginTop: "5px", color: "#000000" }}>
              {progress}%
            </div>
          </div>

          <div
            style={{
              border: BORDER,
              borderRadius: "4px",
              maxHeight: "300px",
              overflowY: "auto",
              marginBottom: "20px",
            }}
          >
            {statusLog.map((log, index) => (
              <div
                key={index}
                style={{
                  padding: "6px",
                  borderBottom: index < statusLog.length - 1 ? BORDER : "none",
                  fontSize: "12px",
                  color: "#000000",
                }}
              >
                {log}
              </div>
            ))}
          </div>

          {importResult && (
            <div
              style={{
                marginBottom: "20px",
                padding: "15px",
                borderRadius: "6px",
                border: BORDER,
                backgroundColor: importResult.errors.length > 0 ? "#fee2e2" : "#dcfce7",
              }}
            >
              <h4
                style={{
                  fontSize: "14px",
                  fontWeight: "bold",
                  color: "#000000",
                  marginBottom: "10px",
                }}
              >
                Import Summary
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "15px",
                  marginBottom: "15px",
                }}
              >
                <div style={{ padding: "10px", backgroundColor: BG_HEADER, borderRadius: "4px" }}>
                  <div style={{ fontSize: "12px", color: "#000000" }}>Imported</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
                    {importResult.imported}
                  </div>
                </div>
                <div style={{ padding: "10px", backgroundColor: BG_HEADER, borderRadius: "4px" }}>
                  <div style={{ fontSize: "12px", color: "#000000" }}>Skipped</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
                    {importResult.skipped}
                  </div>
                </div>
                <div style={{ padding: "10px", backgroundColor: BG_HEADER, borderRadius: "4px" }}>
                  <div style={{ fontSize: "12px", color: "#000000" }}>Errors</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
                    {importResult.errors.length}
                  </div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div style={{ marginTop: "15px" }}>
                  <h5
                    style={{
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "#dc2626",
                      marginBottom: "5px",
                    }}
                  >
                    Errors:
                  </h5>
                  <div
                    style={{
                      maxHeight: "150px",
                      overflowY: "auto",
                      fontSize: "11px",
                      color: "#dc2626",
                    }}
                  >
                    {importResult.errors.map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const content = importResult.errors.join("\n");
                      const blob = new Blob([content], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "import_errors.txt";
                      a.click();
                    }}
                    style={{
                      backgroundColor: "#dc2626",
                      color: "white",
                      border: BORDER,
                      padding: "4px 8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "11px",
                      marginTop: "10px",
                    }}
                  >
                    DOWNLOAD ERROR LOG
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: "#1557b0",
              color: "white",
              border: BORDER,
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            FINISH
          </button>
        </div>
      );
    }
  };

  // Render existing tabs
  const renderExportMasters = () => (
    <div style={{ padding: "20px" }}>
      <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#000000", marginBottom: "15px" }}>
        Export Masters
      </h3>
      <p style={{ color: "#666", marginBottom: "20px" }}>Select masters to export to Excel</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "15px",
          marginBottom: "20px",
        }}
      >
        {["Account Masters", "Item Masters", "Party Masters", "Units", "Cost Centers"].map(
          (master) => (
            <label
              key={master}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px",
                border: BORDER,
                borderRadius: "4px",
              }}
            >
              <input type="checkbox" defaultChecked />
              {master}
            </label>
          ),
        )}
      </div>

      <button
        onClick={() => {
          toast.success("Export started...");
        }}
        style={{
          backgroundColor: "#1557b0",
          color: "white",
          border: BORDER,
          padding: "8px 16px",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Export Selected Masters
      </button>
    </div>
  );

  const renderImportFromExcel = () => (
    <div style={{ padding: "20px" }}>
      <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#000000", marginBottom: "15px" }}>
        Import from Excel
      </h3>

      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Import Type
        </label>
        <select style={{ width: "100%", padding: "8px", border: BORDER, borderRadius: "4px" }}>
          <option>Accounts</option>
          <option>Items</option>
          <option>Parties</option>
          <option>Opening Balances</option>
        </select>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Excel File
        </label>
        <input
          type="file"
          accept=".xlsx,.csv"
          style={{ width: "100%", padding: "8px", border: BORDER, borderRadius: "4px" }}
        />
      </div>

      <button
        onClick={() => {
          toast.success("Import started...");
        }}
        style={{
          backgroundColor: "#1557b0",
          color: "white",
          border: BORDER,
          padding: "8px 16px",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Start Import
      </button>
    </div>
  );

  const renderImportVouchers = () => (
    <div style={{ padding: "20px" }}>
      <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#000000", marginBottom: "15px" }}>
        Import Vouchers from Excel
      </h3>

      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Excel File
        </label>
        <input
          type="file"
          accept=".xlsx,.csv"
          style={{ width: "100%", padding: "8px", border: BORDER, borderRadius: "4px" }}
        />
      </div>

      <button
        onClick={() => {
          toast.success("Voucher import started...");
        }}
        style={{
          backgroundColor: "#1557b0",
          color: "white",
          border: BORDER,
          padding: "8px 16px",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Start Import
      </button>
    </div>
  );

  return (
    <div style={{ backgroundColor: "#f5f6fa", minHeight: "500px", padding: "20px" }}>
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "8px",
          border: BORDER,
          overflow: "hidden",
        }}
      >
        {/* Tab Navigation */}
        <div style={{ display: "flex", borderBottom: BORDER, backgroundColor: BG_HEADER }}>
          {[
            { id: "export-masters", label: "Export Masters" },
            { id: "import-excel", label: "Import from Excel" },
            { id: "import-vouchers", label: "Import Vouchers" },
            { id: "tally-import", label: "Tally XML Migration" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "12px 16px",
                border: "none",
                borderBottom: activeTab === tab.id ? `3px solid #1557b0` : "none",
                backgroundColor: activeTab === tab.id ? BG_HEADER : "transparent",
                color: activeTab === tab.id ? "#000000" : "#666",
                fontWeight: activeTab === tab.id ? "bold" : "normal",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ padding: "20px" }}>
          {activeTab === "export-masters" && renderExportMasters()}
          {activeTab === "import-excel" && renderImportFromExcel()}
          {activeTab === "import-vouchers" && renderImportVouchers()}
          {activeTab === "tally-import" && renderTallyMigration()}
        </div>
      </div>
    </div>
  );
}
