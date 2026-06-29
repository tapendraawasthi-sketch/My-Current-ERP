// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "react-hot-toast";
import { formatADToBS } from "../lib/nepaliDate";
import {
  FileText,
  Download,
  AlertTriangle,
  XCircle,
  CheckCircle,
  RotateCcw,
  Clock,
  Plus,
  Edit,
  Trash2,
} from "lucide-react";

const BORDER = "1px solid #000";
const BG_HEADER = "#D4EABD";
const BG_CARD = "#EBF5E2";

function money(v) {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

export default function ChequeRegister() {
  const {
    cheques,
    accounts,
    vouchers,
    parties,
    bankAccounts,
    addVoucher,
    companySettings,
    updateCheque,
    saveAuditLog,
  } = useStore();

  const [activeTab, setActiveTab] = useState("cheques");
  const [bounceModal, setBounceModal] = useState({ show: false, cheque: null });
  const [bounceForm, setBounceForm] = useState({
    bounceDate: new Date().toISOString().split("T")[0],
    bounceReason: "Insufficient Funds",
    otherReason: "",
    bounceCharges: 0,
    bankChargesAccountId: "",
    notificationMethods: [],
    recoveryExpectedBy: "",
    notes: "",
  });

  const [chequeBookForm, setChequeBookForm] = useState({
    bankAccountId: "",
    startingLeaf: "",
    endingLeaf: "",
    dateReceived: new Date().toISOString().split("T")[0],
  });

  const [chequeBooks, setChequeBooks] = useState([]);

  // Load cheque books
  useEffect(() => {
    const db = getDB();
    db.chequeBooks
      .toArray()
      .catch(() => [])
      .then(setChequeBooks);
  }, []);

  // Filter accounts for bank charges
  const bankChargeAccounts = useMemo(() => {
    return accounts.filter(
      (acc) => acc.type === "expense" && acc.name.toLowerCase().includes("bank charges"),
    );
  }, [accounts]);

  // Handle bounce modal open
  const openBounceModal = (cheque) => {
    setBounceModal({ show: true, cheque });
    setBounceForm({
      bounceDate: new Date().toISOString().split("T")[0],
      bounceReason: "Insufficient Funds",
      otherReason: "",
      bounceCharges: 0,
      bankChargesAccountId: "",
      notificationMethods: [],
      recoveryExpectedBy: "",
      notes: "",
    });
  };

  // Handle bounce form submit
  const handleBounceSubmit = async () => {
    if (!bounceModal.cheque) return;

    const { cheque } = bounceModal;
    const reason =
      bounceForm.bounceReason === "Other" ? bounceForm.otherReason : bounceForm.bounceReason;

    try {
      const db = getDB();

      // Update cheque status
      await db.cheques.update(cheque.id, { status: "bounced", bouncedDate: bounceForm.bounceDate });

      // Save bounce log
      await db.chequeBounceLogs.put({
        id: generateId(),
        chequeId: cheque.id,
        bounceDate: bounceForm.bounceDate,
        bounceReason: reason,
        bounceCharges: bounceForm.bounceCharges,
        bankChargesAccountId: bounceForm.bankChargesAccountId,
        recoveryExpectedBy: bounceForm.recoveryExpectedBy,
        notes: bounceForm.notes,
        status: "bounced",
        createdAt: new Date().toISOString(),
      });

      // Determine if original was receipt or payment
      const relatedVoucher = vouchers.find((v) => v.id === cheque.voucherId);
      const isReceipt = relatedVoucher?.type.includes("receipt");
      const party = parties.find((p) => p.id === relatedVoucher?.partyId);
      const bankAccount = accounts.find((acc) => acc.id === cheque.bankAccountId);

      // Create reversal journal for original amount
      if (relatedVoucher && party && bankAccount) {
        const reversalVoucher = {
          id: generateId(),
          voucherNo: `REV-${generateId().slice(0, 6)}`,
          date: bounceForm.bounceDate,
          dateNepali: formatADToBS(bounceForm.bounceDate),
          type: "journal",
          partyId: party.id,
          narration: `Reversal of ${relatedVoucher.type} - Cheque No ${cheque.chequeNumber} bounced on ${bounceForm.bounceDate}`,
          lines: [
            {
              accountId: party.accountId || party.id,
              amount: cheque.amount,
              type: isReceipt ? "debit" : "credit",
              description: `Cheque bounce reversal`,
            },
            {
              accountId: bankAccount.id,
              amount: cheque.amount,
              type: isReceipt ? "credit" : "debit",
              description: `Cheque bounce reversal`,
            },
          ],
          subTotal: cheque.amount,
          grandTotal: cheque.amount,
          status: "posted",
          linkedDocuments: [{ type: "cheque", id: cheque.id }],
          createdAt: new Date().toISOString(),
        };

        await addVoucher(reversalVoucher);
      }

      // Create journal for bank charges if applicable
      if (bounceForm.bounceCharges > 0 && bounceForm.bankChargesAccountId) {
        const bankAccount = accounts.find((acc) => acc.id === cheque.bankAccountId);
        const chargesAccount = accounts.find((acc) => acc.id === bounceForm.bankChargesAccountId);

        if (bankAccount && chargesAccount) {
          const chargesVoucher = {
            id: generateId(),
            voucherNo: `CHG-${generateId().slice(0, 6)}`,
            date: bounceForm.bounceDate,
            dateNepali: formatADToBS(bounceForm.bounceDate),
            type: "journal",
            narration: `Bank charges for bounced cheque No ${cheque.chequeNumber}`,
            lines: [
              {
                accountId: bounceForm.bankChargesAccountId,
                amount: bounceForm.bounceCharges,
                type: "debit",
                description: `Bank charges for bounced cheque`,
              },
              {
                accountId: bankAccount.id,
                amount: bounceForm.bounceCharges,
                type: "credit",
                description: `Bank charges for bounced cheque`,
              },
            ],
            subTotal: bounceForm.bounceCharges,
            grandTotal: bounceForm.bounceCharges,
            status: "posted",
            linkedDocuments: [{ type: "cheque", id: cheque.id }],
            createdAt: new Date().toISOString(),
          };

          await addVoucher(chargesVoucher);
        }
      }

      toast.success("Cheque dishonoured. Reversal entries created.");
      setBounceModal({ show: false, cheque: null });
      // Refresh cheques - this would be handled by the store
    } catch (error) {
      console.error("Error processing bounce:", error);
      toast.error("Failed to process cheque bounce");
    }
  };

  // Handle bounce form change
  const handleBounceFormChange = (field, value) => {
    if (field === "notificationMethods") {
      const methods = [...bounceForm.notificationMethods];
      if (methods.includes(value)) {
        setBounceForm((prev) => ({
          ...prev,
          notificationMethods: methods.filter((m) => m !== value),
        }));
      } else {
        setBounceForm((prev) => ({ ...prev, notificationMethods: [...methods, value] }));
      }
    } else {
      setBounceForm((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Handle adding cheque book
  const handleAddChequeBook = async () => {
    if (
      !chequeBookForm.bankAccountId ||
      !chequeBookForm.startingLeaf ||
      !chequeBookForm.endingLeaf
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    const totalLeaves =
      parseInt(chequeBookForm.endingLeaf) - parseInt(chequeBookForm.startingLeaf) + 1;
    if (totalLeaves <= 0) {
      toast.error("Ending leaf must be greater than starting leaf");
      return;
    }

    try {
      const db = getDB();
      await db.chequeBooks.put({
        id: generateId(),
        bankAccountId: chequeBookForm.bankAccountId,
        bookName: `Cheque Book - ${chequeBookForm.startingLeaf} to ${chequeBookForm.endingLeaf}`,
        fromNumber: chequeBookForm.startingLeaf,
        toNumber: chequeBookForm.endingLeaf,
        lastUsedNumber: null,
        status: "active",
        isActive: true,
        dateReceived: chequeBookForm.dateReceived,
        createdAt: new Date().toISOString(),
      });

      toast.success("Cheque book added successfully");
      setChequeBookForm({
        bankAccountId: "",
        startingLeaf: "",
        endingLeaf: "",
        dateReceived: new Date().toISOString().split("T")[0],
      });

      // Refresh cheque books
      const updated = await db.chequeBooks.toArray();
      setChequeBooks(updated);
    } catch (error) {
      console.error("Error adding cheque book:", error);
      toast.error("Failed to add cheque book");
    }
  };

  // Calculate bounce tracker data
  const bounceTrackerData = useMemo(() => {
    const bouncedCheques = cheques.filter((c) => c.status === "bounced");
    const bounceLogs = [];

    for (const cheque of bouncedCheques) {
      const relatedVoucher = vouchers.find((v) => v.id === cheque.voucherId);
      const party = parties.find((p) => p.id === relatedVoucher?.partyId);

      bounceLogs.push({
        cheque,
        partyName: party?.name || "N/A",
        amount: cheque.amount,
        bounceDate: cheque.bouncedDate || cheque.cancelledDate || cheque.statusChangedAt,
        bounceReason: "N/A", // Would come from bounce logs table
        recoveryExpectedBy: "N/A",
        recoveryStatus: "Pending Recovery",
        daysOverdue: 0, // Calculated based on expected date
      });
    }

    return bounceLogs;
  }, [cheques, vouchers, parties]);

  // Calculate summary
  const bounceSummary = useMemo(() => {
    const totalBounceAmount = bounceTrackerData.reduce((sum, log) => sum + log.amount, 0);
    const totalRecovered = 0; // Placeholder
    const totalPending = totalBounceAmount - totalRecovered;

    return { totalBounceAmount, totalRecovered, totalPending };
  }, [bounceTrackerData]);

  // Calculate cheque book status
  const chequeBooksWithUsage = useMemo(() => {
    return chequeBooks.map((book) => {
      const start = parseInt(book.fromNumber);
      const end = parseInt(book.toNumber);
      const totalLeaves = end - start + 1;

      // Count used cheques from db.cheques where number falls in range
      const used = cheques.filter(
        (c) => c.chequeNumber >= book.fromNumber && c.chequeNumber <= book.toNumber,
      ).length;

      const remaining = totalLeaves - used;
      let status = "Active";
      if (remaining === 0) status = "Exhausted";
      if (!book.isActive) status = "Cancelled";

      return {
        ...book,
        totalLeaves,
        used,
        remaining,
        status,
      };
    });
  }, [chequeBooks, cheques]);

  // Render bounce modal
  const renderBounceModal = () => {
    if (!bounceModal.show) return null;

    const cheque = bounceModal.cheque;
    const relatedVoucher = vouchers.find((v) => v.id === cheque?.voucherId);
    const isReceipt = relatedVoucher?.type.includes("receipt");

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <div
          style={{
            backgroundColor: BG_CARD,
            padding: "20px",
            borderRadius: "8px",
            border: BORDER,
            width: "90%",
            maxWidth: "600px",
          }}
        >
          <h2
            style={{ fontSize: "18px", fontWeight: "bold", color: "#000000", marginBottom: "15px" }}
          >
            Cheque Dishonour Processing
          </h2>

          <div
            style={{
              marginBottom: "15px",
              padding: "10px",
              backgroundColor: "#fee2e2",
              borderRadius: "4px",
              border: "1px solid #dc2626",
            }}
          >
            <div style={{ fontWeight: "bold" }}>Cheque Details:</div>
            <div>
              No: {cheque.chequeNumber} | Amount: {money(cheque.amount)} |{" "}
              {isReceipt ? "Receipt" : "Payment"}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "15px",
              marginBottom: "15px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                Bounce Date *
              </label>
              <input
                type="date"
                value={bounceForm.bounceDate}
                onChange={(e) => handleBounceFormChange("bounceDate", e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px",
                  border: BORDER,
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                Bounce Reason *
              </label>
              <select
                value={bounceForm.bounceReason}
                onChange={(e) => handleBounceFormChange("bounceReason", e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px",
                  border: BORDER,
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              >
                <option value="Insufficient Funds">Insufficient Funds</option>
                <option value="Signature Mismatch">Signature Mismatch</option>
                <option value="Account Closed">Account Closed</option>
                <option value="Payment Stopped">Payment Stopped</option>
                <option value="Post-dated">Post-dated</option>
                <option value="Cheque Damaged">Cheque Damaged</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {bounceForm.bounceReason === "Other" && (
              <div style={{ gridColumn: "span 2" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                    fontSize: "12px",
                  }}
                >
                  Other Reason
                </label>
                <input
                  type="text"
                  value={bounceForm.otherReason}
                  onChange={(e) => handleBounceFormChange("otherReason", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    border: BORDER,
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
                />
              </div>
            )}

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                Bank Charges Amount
              </label>
              <input
                type="number"
                value={bounceForm.bounceCharges}
                onChange={(e) =>
                  handleBounceFormChange("bounceCharges", parseFloat(e.target.value) || 0)
                }
                style={{
                  width: "100%",
                  padding: "6px",
                  border: BORDER,
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                Bank Charges Account
              </label>
              <select
                value={bounceForm.bankChargesAccountId}
                onChange={(e) => handleBounceFormChange("bankChargesAccountId", e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px",
                  border: BORDER,
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              >
                <option value="">Select Account</option>
                {bankChargeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                Party Notification Method
              </label>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {["Phone", "WhatsApp", "Legal Notice"].map((method) => (
                  <label key={method} style={{ display: "flex", alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={bounceForm.notificationMethods.includes(method)}
                      onChange={() => handleBounceFormChange("notificationMethods", method)}
                      style={{ marginRight: "5px" }}
                    />
                    {method}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                Recovery Expected By
              </label>
              <input
                type="date"
                value={bounceForm.recoveryExpectedBy}
                onChange={(e) => handleBounceFormChange("recoveryExpectedBy", e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px",
                  border: BORDER,
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              Internal Notes
            </label>
            <textarea
              value={bounceForm.notes}
              onChange={(e) => handleBounceFormChange("notes", e.target.value)}
              rows={3}
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              onClick={() => setBounceModal({ show: false, cheque: null })}
              style={{
                backgroundColor: "#dc2626",
                color: "white",
                border: BORDER,
                padding: "6px 12px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleBounceSubmit}
              style={{
                backgroundColor: "#059669",
                color: "white",
                border: BORDER,
                padding: "6px 12px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Process Bounce
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render bounce tracker tab
  const renderBounceTracker = () => (
    <div style={{ backgroundColor: BG_CARD, padding: "15px", borderRadius: "8px", border: BORDER }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "15px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            backgroundColor: "#fee2e2",
            padding: "15px",
            borderRadius: "6px",
            border: BORDER,
          }}
        >
          <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
            Total Bounce Amount
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#dc2626" }}>
            {money(bounceSummary.totalBounceAmount)}
          </div>
        </div>
        <div
          style={{
            backgroundColor: "#dcfce7",
            padding: "15px",
            borderRadius: "6px",
            border: BORDER,
          }}
        >
          <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
            Total Recovered
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#059669" }}>
            {money(bounceSummary.totalRecovered)}
          </div>
        </div>
        <div
          style={{
            backgroundColor: "#fef9c3",
            padding: "15px",
            borderRadius: "6px",
            border: BORDER,
          }}
        >
          <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
            Total Pending Recovery
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#d97706" }}>
            {money(bounceSummary.totalPending)}
          </div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
          <thead>
            <tr style={{ backgroundColor: BG_HEADER }}>
              <th style={{ border: BORDER, padding: "8px" }}>Cheque No</th>
              <th style={{ border: BORDER, padding: "8px" }}>Party Name</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Amount</th>
              <th style={{ border: BORDER, padding: "8px" }}>Bounce Date</th>
              <th style={{ border: BORDER, padding: "8px" }}>Bounce Reason</th>
              <th style={{ border: BORDER, padding: "8px" }}>Recovery Expected By</th>
              <th style={{ border: BORDER, padding: "8px" }}>Recovery Status</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "center" }}>Days Overdue</th>
              <th style={{ border: BORDER, padding: "8px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bounceTrackerData.map((log, idx) => (
              <tr
                key={log.cheque.id}
                style={{ backgroundColor: idx % 2 === 0 ? "#f0f0f0" : "transparent" }}
              >
                <td style={{ border: BORDER, padding: "8px" }}>{log.cheque.chequeNumber}</td>
                <td style={{ border: BORDER, padding: "8px" }}>{log.partyName}</td>
                <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                  {money(log.amount)}
                </td>
                <td style={{ border: BORDER, padding: "8px" }}>{log.bounceDate}</td>
                <td style={{ border: BORDER, padding: "8px" }}>{log.bounceReason}</td>
                <td style={{ border: BORDER, padding: "8px" }}>{log.recoveryExpectedBy}</td>
                <td style={{ border: BORDER, padding: "8px" }}>
                  <span
                    style={{
                      backgroundColor:
                        log.recoveryStatus === "Fully Recovered"
                          ? "#059669"
                          : log.recoveryStatus === "Written Off"
                            ? "#dc2626"
                            : "#d97706",
                      color: "white",
                      padding: "2px 6px",
                      borderRadius: "12px",
                      fontSize: "11px",
                      fontWeight: "bold",
                    }}
                  >
                    {log.recoveryStatus}
                  </span>
                </td>
                <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                  {log.daysOverdue}
                </td>
                <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                  <button
                    onClick={() => {}}
                    style={{
                      backgroundColor: "#059669",
                      color: "white",
                      border: BORDER,
                      padding: "4px 8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "11px",
                      marginRight: "5px",
                    }}
                  >
                    Mark Recovered
                  </button>
                  <button
                    onClick={() => {}}
                    style={{
                      backgroundColor: "#1557b0",
                      color: "white",
                      border: BORDER,
                      padding: "4px 8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "11px",
                      marginRight: "5px",
                    }}
                  >
                    Send Notice
                  </button>
                  <button
                    onClick={() => {}}
                    style={{
                      backgroundColor: "#dc2626",
                      color: "white",
                      border: BORDER,
                      padding: "4px 8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "11px",
                    }}
                  >
                    Write Off
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Render cheque book register tab
  const renderChequeBookRegister = () => (
    <div style={{ backgroundColor: BG_CARD, padding: "15px", borderRadius: "8px", border: BORDER }}>
      <div style={{ marginBottom: "20px" }}>
        <h3
          style={{ fontSize: "16px", fontWeight: "bold", color: "#000000", marginBottom: "15px" }}
        >
          Add New Cheque Book
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "15px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              Bank Account
            </label>
            <select
              value={chequeBookForm.bankAccountId}
              onChange={(e) =>
                setChequeBookForm({ ...chequeBookForm, bankAccountId: e.target.value })
              }
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              <option value="">Select Bank Account</option>
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              Starting Leaf No
            </label>
            <input
              type="number"
              value={chequeBookForm.startingLeaf}
              onChange={(e) =>
                setChequeBookForm({ ...chequeBookForm, startingLeaf: e.target.value })
              }
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              Ending Leaf No
            </label>
            <input
              type="number"
              value={chequeBookForm.endingLeaf}
              onChange={(e) => setChequeBookForm({ ...chequeBookForm, endingLeaf: e.target.value })}
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              Date Received
            </label>
            <input
              type="date"
              value={chequeBookForm.dateReceived}
              onChange={(e) =>
                setChequeBookForm({ ...chequeBookForm, dateReceived: e.target.value })
              }
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
              }}
            />
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <button
              onClick={handleAddChequeBook}
              style={{
                backgroundColor: "#1557b0",
                color: "white",
                border: BORDER,
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Plus size={14} />
              Add Cheque Book
            </button>
          </div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
          <thead>
            <tr style={{ backgroundColor: BG_HEADER }}>
              <th style={{ border: BORDER, padding: "8px" }}>Bank Account</th>
              <th style={{ border: BORDER, padding: "8px" }}>Starting Leaf</th>
              <th style={{ border: BORDER, padding: "8px" }}>Ending Leaf</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Total Leaves</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Used</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Remaining</th>
              <th style={{ border: BORDER, padding: "8px" }}>Status</th>
              <th style={{ border: BORDER, padding: "8px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {chequeBooksWithUsage.map((book, idx) => {
              const bankAccount = bankAccounts.find((acc) => acc.id === book.bankAccountId);
              return (
                <tr
                  key={book.id}
                  style={{ backgroundColor: idx % 2 === 0 ? "#f0f0f0" : "transparent" }}
                >
                  <td style={{ border: BORDER, padding: "8px" }}>{bankAccount?.name || "N/A"}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{book.fromNumber}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{book.toNumber}</td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {book.totalLeaves}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {book.used}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {book.remaining}
                  </td>
                  <td style={{ border: BORDER, padding: "8px" }}>
                    <span
                      style={{
                        backgroundColor:
                          book.status === "Active"
                            ? "#059669"
                            : book.status === "Exhausted"
                              ? "#d97706"
                              : "#dc2626",
                        color: "white",
                        padding: "2px 6px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "bold",
                      }}
                    >
                      {book.status}
                    </span>
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                    <button
                      onClick={() => {}}
                      style={{
                        backgroundColor: "#1557b0",
                        color: "white",
                        border: BORDER,
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                        marginRight: "5px",
                      }}
                    >
                      <Edit size={12} />
                    </button>
                    <button
                      onClick={() => {}}
                      style={{
                        backgroundColor: "#dc2626",
                        color: "white",
                        border: BORDER,
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Render existing cheques tab (placeholder)
  const renderChequesTab = () => (
    <div style={{ backgroundColor: BG_CARD, padding: "15px", borderRadius: "8px", border: BORDER }}>
      <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#000000", marginBottom: "15px" }}>
        Cheque Register
      </h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
          <thead>
            <tr style={{ backgroundColor: BG_HEADER }}>
              <th style={{ border: BORDER, padding: "8px" }}>Cheque No</th>
              <th style={{ border: BORDER, padding: "8px" }}>Bank Account</th>
              <th style={{ border: BORDER, padding: "8px" }}>Party Name</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Amount</th>
              <th style={{ border: BORDER, padding: "8px" }}>Issue Date</th>
              <th style={{ border: BORDER, padding: "8px" }}>Status</th>
              <th style={{ border: BORDER, padding: "8px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cheques.map((cheque, idx) => {
              const relatedVoucher = vouchers.find((v) => v.id === cheque.voucherId);
              const party = parties.find((p) => p.id === relatedVoucher?.partyId);

              let rowStyle = {};
              if (cheque.status === "bounced") {
                rowStyle.backgroundColor = "#fee2e2";
              } else if (cheque.status === "cleared") {
                rowStyle.backgroundColor = "#dcfce7";
              } else {
                // Check if stale (older than 90 days)
                const issueDate = new Date(cheque.issueDate);
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                if (issueDate < ninetyDaysAgo) {
                  rowStyle.backgroundColor = "#fef9c3";
                }
              }

              return (
                <tr key={cheque.id} style={rowStyle}>
                  <td style={{ border: BORDER, padding: "8px" }}>{cheque.chequeNumber}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{cheque.bankAccountId}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{party?.name || "N/A"}</td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(cheque.amount)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px" }}>{cheque.issueDate}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>
                    <span
                      style={{
                        backgroundColor:
                          cheque.status === "bounced"
                            ? "#dc2626"
                            : cheque.status === "cleared"
                              ? "#059669"
                              : cheque.status === "cancelled"
                                ? "#6b7280"
                                : "#d97706",
                        color: "white",
                        padding: "2px 6px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "bold",
                      }}
                    >
                      {cheque.status.charAt(0).toUpperCase() + cheque.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                    {cheque.status !== "bounced" && (
                      <button
                        onClick={() => openBounceModal(cheque)}
                        style={{
                          backgroundColor: "#dc2626",
                          color: "white",
                          border: BORDER,
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "11px",
                          marginRight: "5px",
                        }}
                      >
                        Mark Bounced
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: "#E4F1D9", minHeight: "100vh", padding: "20px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#000000", marginBottom: "20px" }}>
        Cheque Register
      </h1>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: "5px", marginBottom: "20px", borderBottom: BORDER }}>
        {[
          { id: "cheques", label: "Cheques" },
          { id: "bounce", label: "Bounce Tracker" },
          { id: "books", label: "Cheque Books" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              backgroundColor: activeTab === tab.id ? BG_HEADER : "transparent",
              color: activeTab === tab.id ? "#000000" : "#666",
              border: BORDER,
              padding: "10px 16px",
              borderRadius: "4px 4px 0 0",
              cursor: "pointer",
              fontWeight: activeTab === tab.id ? "bold" : "normal",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "cheques" && renderChequesTab()}
      {activeTab === "bounce" && renderBounceTracker()}
      {activeTab === "books" && renderChequeBookRegister()}

      {/* Bounce Modal */}
      {renderBounceModal()}
    </div>
  );
}
