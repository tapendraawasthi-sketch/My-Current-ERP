import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import { PartyType, VoucherType, PaymentStatus, VoucherStatus } from "../lib/types";
import { formatNumber } from "../lib/utils";
import { Card, Select, Button, Input, Modal } from "../components/ui";
import { NepaliDatePicker } from "../components/ui";
import ReceiptVoucherForm from "../components/voucher/ReceiptVoucherForm";
import toast from "react-hot-toast";

interface BillRow {
  invoiceId: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  partyId: string;
  partyName: string;
  partyAccountId: string;
  originalAmount: number;
  paidAmount: number;
  balance: number;
  daysOverdue: number;
  isOverdue: boolean;
}

const BillWisePending: React.FC = () => {
  const { billWiseEntries, parties, companySettings, vouchers } = useStore();
  const symbol = companySettings?.currencySymbol || "Rs.";

  const [partyType, setPartyType] = useState<"customer" | "supplier" | "all">("all");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [asOnDate, setAsOnDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [showSettled, setShowSettled] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeReceiptInvoice, setActiveReceiptInvoice] = useState<BillRow | null>(null);

  // Filter parties based on party type
  const filteredParties = useMemo(() => {
    if (partyType === "all") return parties.filter((p) => p.isActive);
    if (partyType === "customer")
      return parties.filter(
        (p) => p.isActive && (p.type === PartyType.CUSTOMER || p.type === PartyType.BOTH),
      );
    return parties.filter(
      (p) => p.isActive && (p.type === PartyType.SUPPLIER || p.type === PartyType.BOTH),
    );
  }, [parties, partyType]);

  const partyOptions = useMemo(
    () => filteredParties.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` })),
    [filteredParties],
  );

  // Calculate days overdue
  const getDaysOverdue = (dueDateStr: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - dueDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Generate bill rows
  const billRows = useMemo((): BillRow[] => {
    const filtered = billWiseEntries.filter((entry) => {
      // Filter by party
      if (selectedPartyId && entry.partyId !== selectedPartyId) return false;

      // Filter by partyType
      const p = parties.find((pt) => pt.id === entry.partyId);
      if (partyType === "customer" && p?.type !== PartyType.CUSTOMER && p?.type !== PartyType.BOTH)
        return false;
      if (partyType === "supplier" && p?.type !== PartyType.SUPPLIER && p?.type !== PartyType.BOTH)
        return false;

      // As On Date filter
      if (asOnDate && entry.date > asOnDate) return false;

      // Show Settled filter
      if (!showSettled && entry.isSettled) return false;

      return true;
    });

    const rows: BillRow[] = filtered.map((entry) => {
      const party = parties.find((p) => p.id === entry.partyId);
      const daysOverdue = getDaysOverdue(entry.dueDate);
      const isOverdue = daysOverdue > 0 && !entry.isSettled;

      return {
        invoiceId: entry.voucherId,
        invoiceNo: entry.voucherNo,
        invoiceDate: entry.date,
        dueDate: entry.dueDate,
        partyId: entry.partyId,
        partyName: party?.name || "Unknown Party",
        partyAccountId: party?.accountId || "",
        originalAmount: entry.originalAmount,
        paidAmount: entry.allocatedAmount || 0,
        balance: entry.balanceAmount,
        daysOverdue: isOverdue ? daysOverdue : 0,
        isOverdue,
      };
    });

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return rows.filter(
        (r) =>
          r.invoiceNo.toLowerCase().includes(query) || r.partyName.toLowerCase().includes(query),
      );
    }

    return rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [billWiseEntries, partyType, selectedPartyId, asOnDate, showSettled, searchQuery, parties]);

  // Calculate summary totals
  const summary = useMemo(() => {
    const totalBills = billRows.length;
    const totalOriginal = billRows.reduce((sum, r) => sum + r.originalAmount, 0);
    const totalPaid = billRows.reduce((sum, r) => sum + r.paidAmount, 0);
    const totalBalance = billRows.reduce((sum, r) => sum + r.balance, 0);

    return {
      totalBills,
      totalOriginal,
      totalPaid,
      totalBalance,
    };
  }, [billRows]);

  const handleExportCSV = () => {
    const headers = [
      "Invoice No",
      "Date",
      "Due Date",
      "Party Name",
      "Original Amt",
      "Paid Amt",
      "Pending Amt",
      "Days Overdue",
    ];
    const rows = billRows.map((r) => [
      r.invoiceNo,
      r.invoiceDate,
      r.dueDate,
      r.partyName,
      r.originalAmount.toString(),
      r.paidAmount.toString(),
      r.balance.toString(),
      r.daysOverdue.toString(),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((row) => row.map((val) => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const a = document.createElement("a");
    a.href = encodedUri;
    a.download = `Bill_Wise_Pending_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReceivePayment = (row: BillRow) => {
    // 1. Create a temporary draft voucher in the store's vouchers list
    const tempVoucher = {
      id: "temp-receipt",
      voucherNo: "RV-TEMP",
      type: VoucherType.RECEIPT,
      status: VoucherStatus.DRAFT,
      partyId: row.partyId,
      partyName: row.partyName,
      date: new Date().toISOString().split("T")[0],
      dateNepali: "",
      narration: `Payment received for Invoice ${row.invoiceNo}`,
      lines: [
        {
          accountId: row.partyAccountId,
          debit: 0,
          credit: row.balance,
        },
      ],
      totalDebit: row.balance,
      totalCredit: row.balance,
    };

    useStore.setState({
      vouchers: [...vouchers.filter((v) => v.id !== "temp-receipt"), tempVoucher as any],
    });

    setActiveReceiptInvoice(row);
  };

  const handleCloseModal = () => {
    // Remove the temp voucher from the store
    useStore.setState({
      vouchers: vouchers.filter((v) => v.id !== "temp-receipt"),
    });
    setActiveReceiptInvoice(null);
  };

  // DOM Hack to click the checkbox inside the modal when it mounts
  useEffect(() => {
    if (!activeReceiptInvoice) return;

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const elements = document.querySelectorAll("tr");
      let found = false;
      for (const tr of Array.from(elements)) {
        if (tr.textContent?.includes(activeReceiptInvoice.invoiceNo)) {
          const checkbox = tr.querySelector('input[type="checkbox"]') as HTMLInputElement;
          if (checkbox) {
            if (!checkbox.checked) {
              checkbox.click();
            }
            found = true;
            break;
          }
        }
      }
      if (found || attempts > 30) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [activeReceiptInvoice]);

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none text-xs page-wrapper">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Bill-wise Pending</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Outstanding invoices with pending balances
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            icon={<span className="text-sm">📄</span>}
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            icon={<span className="text-sm">🖨️</span>}
          >
            Print
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card border padding="md" className="no-print">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            label="Party Type"
            options={[
              { value: "all", label: "All" },
              { value: "customer", label: "Customers (Sales)" },
              { value: "supplier", label: "Suppliers (Purchase)" },
            ]}
            value={partyType}
            onChange={(v) => {
              setPartyType(v as any);
              setSelectedPartyId("");
            }}
          />

          <Select
            label="Party"
            options={[{ value: "", label: "All Parties" }, ...partyOptions]}
            value={selectedPartyId}
            onChange={setSelectedPartyId}
            searchable
          />

          <NepaliDatePicker label="As On Date" value={asOnDate} onChange={setAsOnDate} />

          <div className="flex items-end pb-1.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showSettled}
                onChange={(e) => setShowSettled(e.target.checked)}
                className="h-4 w-4 accent-[#1557b0]"
              />
              <span className="text-[12px] font-semibold text-gray-700">Show Settled Bills</span>
            </label>
          </div>
        </div>

        <div className="mt-4">
          <Input
            label="Search"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by bill number or party name..."
          />
        </div>
      </Card>

      {/* Table */}
      <div className="w-full overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
        <table className="data-table w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                Invoice No
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                Date
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                Due Date
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                Party Name
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                Original Amt
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                Paid Amt
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                Pending Amt
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-center">
                Days Overdue
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-center no-print">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150">
            {billRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-6 text-gray-400">
                  No pending bills found.
                </td>
              </tr>
            ) : (
              billRows.map((row) => (
                <tr key={row.invoiceId} className="hover:bg-[#e8eeff] bg-white transition-colors">
                  <td className="px-3 py-2 text-[12px] text-gray-700 font-bold">{row.invoiceNo}</td>
                  <td className="px-3 py-2 text-[12px] text-gray-700">{row.invoiceDate}</td>
                  <td className="px-3 py-2 text-[12px] text-gray-700">{row.dueDate}</td>
                  <td className="px-3 py-2 text-[12px] text-gray-700 font-medium">
                    {row.partyName}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-right font-mono text-gray-700">
                    {symbol} {formatNumber(row.originalAmount)}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-right font-mono text-gray-500">
                    {symbol} {formatNumber(row.paidAmount)}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-right font-mono font-bold text-[#dc2626]">
                    {symbol} {formatNumber(row.balance)}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-center font-bold">
                    {row.isOverdue ? (
                      <span className="badge bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">
                        OVERDUE {row.daysOverdue} days
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-center no-print">
                    <Button variant="primary" size="xs" onClick={() => handleReceivePayment(row)}>
                      Receive Payment
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {billRows.length > 0 && (
            <tfoot className="bg-[#eef2ff] font-bold text-[12px] border-t-2 border-[#c7d2fe] text-gray-800">
              <tr>
                <td colSpan={4} className="px-3 py-2.5 text-left font-bold">
                  TOTAL ({summary.totalBills} Bills)
                </td>
                <td className="px-3 py-2.5 text-right font-mono">
                  {symbol} {formatNumber(summary.totalOriginal)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono">
                  {symbol} {formatNumber(summary.totalPaid)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[#dc2626]">
                  {symbol} {formatNumber(summary.totalBalance)}
                </td>
                <td colSpan={2} className="no-print"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Receive Payment Modal */}
      {activeReceiptInvoice && (
        <Modal isOpen={true} onClose={handleCloseModal} title="Receive Payment" size="lg">
          <div className="max-h-[80vh] overflow-y-auto p-1">
            <ReceiptVoucherForm
              voucherId="temp-receipt"
              onSave={() => {
                handleCloseModal();
                toast.success("Payment recorded successfully.");
              }}
              onCancel={handleCloseModal}
            />
          </div>
        </Modal>
      )}

      {/* Print-Only Header */}
      <div className="print-only hidden">
        <div className="mb-6 flex justify-between items-end border-b pb-4">
          <div>
            <h1 className="text-[18px] font-bold text-gray-800">SUTRA ERP</h1>
            <h2 className="text-[14px] font-bold text-gray-800 uppercase">
              Bill-Wise Pending Report
            </h2>
            <p className="text-[11px] text-gray-500 mt-1">Outstanding bills pending settlement</p>
          </div>
          <div className="text-right text-[10px] text-gray-400">
            Report Date: {new Date().toISOString().split("T")[0]}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillWisePending;
