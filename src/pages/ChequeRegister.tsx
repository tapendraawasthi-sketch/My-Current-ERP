// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "@/lib/appToast";
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
import { useBranchFilter } from "../hooks/useBranchFilter";

const BORDER = "1px solid var(--ds-action-primary)";
const BG_HEADER = "var(--ds-action-primary)";
const BG_CARD = "var(--ds-surface-muted)";

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

  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();
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

  const resolveChequeBranch = (cheque) => {
    if (cheque?.branchId) return cheque.branchId;
    const related = vouchers.find((v) => v.id === cheque?.voucherId);
    return related?.branchId;
  };

  const filteredCheques = useMemo(
    () => cheques.filter((c) => matchBranch(resolveChequeBranch(c))),
    [cheques, vouchers, matchBranch, branchFilter],
  );

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
    const bouncedCheques = filteredCheques.filter((c) => c.status === "bounced");
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
  }, [filteredCheques, vouchers, parties]);

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
      >
        <div
        >
          <h2
            className="mb-4 text-[18px] font-bold text-[var(--ds-text-default)]"
          >
            Cheque Dishonour Processing
          </h2>

          <div
          >
            <div>Cheque Details:</div>
            <div>
              No: {cheque.chequeNumber} | Amount: {money(cheque.amount)} |{" "}
              {isReceipt ? "Receipt" : "Payment"}
            </div>
          </div>

          <div
          >
            <div>
              <label
              >
                Bounce Date *
              </label>
              <input
                type="date"
                value={bounceForm.bounceDate}
                onChange={(e) => handleBounceFormChange("bounceDate", e.target.value)}
              />
            </div>
            <div>
              <label
              >
                Bounce Reason *
              </label>
              <select
                value={bounceForm.bounceReason}
                onChange={(e) => handleBounceFormChange("bounceReason", e.target.value)}
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
              <div>
                <label
                >
                  Other Reason
                </label>
                <input
                  type="text"
                  value={bounceForm.otherReason}
                  onChange={(e) => handleBounceFormChange("otherReason", e.target.value)}
                />
              </div>
            )}

            <div>
              <label
              >
                Bank Charges Amount
              </label>
              <input
                type="number"
                value={bounceForm.bounceCharges}
                onChange={(e) =>
                  handleBounceFormChange("bounceCharges", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <label
              >
                Bank Charges Account
              </label>
              <select
                value={bounceForm.bankChargesAccountId}
                onChange={(e) => handleBounceFormChange("bankChargesAccountId", e.target.value)}
              >
                <option value="">Select Account</option>
                {bankChargeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
              >
                Party Notification Method
              </label>
              <div>
                {["Phone", "WhatsApp", "Legal Notice"].map((method) => (
                  <label key={method}>
                    <input
                      type="checkbox"
                      checked={bounceForm.notificationMethods.includes(method)}
                      onChange={() => handleBounceFormChange("notificationMethods", method)}
                    />
                    {method}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label
              >
                Recovery Expected By
              </label>
              <input
                type="date"
                value={bounceForm.recoveryExpectedBy}
                onChange={(e) => handleBounceFormChange("recoveryExpectedBy", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label
            >
              Internal Notes
            </label>
            <textarea
              value={bounceForm.notes}
              onChange={(e) => handleBounceFormChange("notes", e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <button
              onClick={() => setBounceModal({ show: false, cheque: null })}
            >
              Cancel
            </button>
            <button
              onClick={handleBounceSubmit}
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
    <div>
      <div
      >
        <div
        >
          <div className="mb-1 text-[12px] text-[var(--ds-text-default)]">
            Total Bounce Amount
          </div>
          <div>
            {money(bounceSummary.totalBounceAmount)}
          </div>
        </div>
        <div
        >
          <div className="mb-1 text-[12px] text-[var(--ds-text-default)]">
            Total Recovered
          </div>
          <div>
            {money(bounceSummary.totalRecovered)}
          </div>
        </div>
        <div
        >
          <div className="mb-1 text-[12px] text-[var(--ds-text-default)]">
            Total Pending Recovery
          </div>
          <div>
            {money(bounceSummary.totalPending)}
          </div>
        </div>
      </div>

      <div>
        <table>
          <thead>
            <tr>
              <th>Cheque No</th>
              <th>Party Name</th>
              <th>Amount</th>
              <th>Bounce Date</th>
              <th>Bounce Reason</th>
              <th>Recovery Expected By</th>
              <th>Recovery Status</th>
              <th>Days Overdue</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bounceTrackerData.map((log, idx) => (
              <tr
                key={log.cheque.id}
              >
                <td>{log.cheque.chequeNumber}</td>
                <td>{log.partyName}</td>
                <td>
                  {money(log.amount)}
                </td>
                <td>{log.bounceDate}</td>
                <td>{log.bounceReason}</td>
                <td>{log.recoveryExpectedBy}</td>
                <td>
                  <span
                  >
                    {log.recoveryStatus}
                  </span>
                </td>
                <td>
                  {log.daysOverdue}
                </td>
                <td>
                  <button
                    onClick={() => {}}
                  >
                    Mark Recovered
                  </button>
                  <button
                    onClick={() => {}}
                  >
                    Send Notice
                  </button>
                  <button
                    onClick={() => {}}
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
    <div>
      <div>
        <h3
          className="mb-4 text-[16px] font-bold text-[var(--ds-text-default)]"
        >
          Add New Cheque Book
        </h3>
        <div
        >
          <div>
            <label
            >
              Bank Account
            </label>
            <select
              value={chequeBookForm.bankAccountId}
              onChange={(e) =>
                setChequeBookForm({ ...chequeBookForm, bankAccountId: e.target.value })
              }
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
            >
              Starting Leaf No
            </label>
            <input
              type="number"
              value={chequeBookForm.startingLeaf}
              onChange={(e) =>
                setChequeBookForm({ ...chequeBookForm, startingLeaf: e.target.value })
              }
            />
          </div>
          <div>
            <label
            >
              Ending Leaf No
            </label>
            <input
              type="number"
              value={chequeBookForm.endingLeaf}
              onChange={(e) => setChequeBookForm({ ...chequeBookForm, endingLeaf: e.target.value })}
            />
          </div>
          <div>
            <label
            >
              Date Received
            </label>
            <input
              type="date"
              value={chequeBookForm.dateReceived}
              onChange={(e) =>
                setChequeBookForm({ ...chequeBookForm, dateReceived: e.target.value })
              }
            />
          </div>
          <div>
            <button
              onClick={handleAddChequeBook}
            >
              <Plus size={14} />
              Add Cheque Book
            </button>
          </div>
        </div>
      </div>

      <div>
        <table>
          <thead>
            <tr>
              <th>Bank Account</th>
              <th>Starting Leaf</th>
              <th>Ending Leaf</th>
              <th>Total Leaves</th>
              <th>Used</th>
              <th>Remaining</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {chequeBooksWithUsage.map((book, idx) => {
              const bankAccount = bankAccounts.find((acc) => acc.id === book.bankAccountId);
              return (
                <tr
                  key={book.id}
                >
                  <td>{bankAccount?.name || "N/A"}</td>
                  <td>{book.fromNumber}</td>
                  <td>{book.toNumber}</td>
                  <td>
                    {book.totalLeaves}
                  </td>
                  <td>
                    {book.used}
                  </td>
                  <td>
                    {book.remaining}
                  </td>
                  <td>
                    <span
                    >
                      {book.status}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => {}}
                    >
                      <Edit size={12} />
                    </button>
                    <button
                      onClick={() => {}}
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
    <div>
      <h2 className="mb-4 text-[16px] font-bold text-[var(--ds-text-default)]">
        Cheque register
      </h2>
      <div>
        <table>
          <thead>
            <tr>
              <th>Cheque No</th>
              <th>Bank Account</th>
              <th>Party Name</th>
              <th>Amount</th>
              <th>Issue Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCheques.map((cheque, idx) => {
              const relatedVoucher = vouchers.find((v) => v.id === cheque.voucherId);
              const party = parties.find((p) => p.id === relatedVoucher?.partyId);

              const rowStyle = {};
              if (cheque.status === "bounced") {
                rowStyle.backgroundColor = "var(--ds-action-primary)";
              } else if (cheque.status === "cleared") {
                rowStyle.backgroundColor = "var(--ds-action-primary)";
              } else {
                // Check if stale (older than 90 days)
                const issueDate = new Date(cheque.issueDate);
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                if (issueDate < ninetyDaysAgo) {
                  rowStyle.backgroundColor = "var(--ds-action-primary)";
                }
              }

              return (
                <tr key={cheque.id} style={rowStyle}>
                  <td>{cheque.chequeNumber}</td>
                  <td>{cheque.bankAccountId}</td>
                  <td>{party?.name || "N/A"}</td>
                  <td>
                    {money(cheque.amount)}
                  </td>
                  <td>{cheque.issueDate}</td>
                  <td>
                    <span
                    >
                      {cheque.status.charAt(0).toUpperCase() + cheque.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    {cheque.status !== "bounced" && (
                      <button
                        onClick={() => openBounceModal(cheque)}
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
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[16px] font-semibold text-[var(--ds-text-strong)]">Cheque register</h1>
        {branchOptions.length > 0 && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            aria-label="Branch"
          >
            <option value="all">All branches</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || b.code || b.id}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="mb-5 flex gap-1 border-b border-[var(--ds-border-default)]">
        {[
          { id: "cheques", label: "Cheques" },
          { id: "bounce", label: "Bounce Tracker" },
          { id: "books", label: "Cheque Books" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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
