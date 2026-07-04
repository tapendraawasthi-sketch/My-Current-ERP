import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { getBSTodayLong, getBSToday } from "../lib/nepaliDate";

const fmt = (n: number) =>
  Math.abs(Number(n) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface MetricCellProps {
  label: string;
  value: number;
  onClick: () => void;
  isLast?: boolean;
}

const MetricCell: React.FC<MetricCellProps> = ({ label, value, onClick, isLast }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 min-w-0 text-left px-4 py-3 bg-white hover:bg-gray-50 transition-colors cursor-pointer ${
      isLast ? "" : "border-r border-gray-200"
    }`}
  >
    <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
    <div className="text-[15px] font-mono font-semibold text-gray-800 mt-1 truncate">
      Rs. {fmt(value)}
    </div>
  </button>
);

const FinancialDashboard: React.FC = () => {
  const { invoices, accounts, setCurrentPage } = useStore();

  const today = new Date();
  const adDateStr = today.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  let bsDateStr = "";
  try {
    bsDateStr = getBSTodayLong();
  } catch {
    bsDateStr = getBSToday();
  }

  const cashBankBalance = useMemo(() => {
    let total = 0;
    for (const acc of accounts) {
      if (acc.isGroup || acc.isActive === false) continue;
      const name = (acc.name || "").toLowerCase();
      const group = (acc.group || acc.groupName || "").toLowerCase();
      if (
        name.includes("cash") ||
        name.includes("bank") ||
        group.includes("cash") ||
        group.includes("bank")
      ) {
        total += Number(acc.balance || 0);
      }
    }
    return total;
  }, [accounts]);

  const arOutstanding = useMemo(() => {
    let total = 0;
    for (const inv of invoices) {
      const t = String(inv.type || "").toLowerCase();
      if (!(t.includes("sales-invoice") || t === "sales_invoice")) continue;
      if (inv.status !== "posted") continue;
      const ps = (inv.paymentStatus || "").toLowerCase();
      if (ps === "unpaid" || ps === "partial") {
        total += Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0);
      }
    }
    return total;
  }, [invoices]);

  const apOutstanding = useMemo(() => {
    let total = 0;
    for (const inv of invoices) {
      const t = String(inv.type || "").toLowerCase();
      if (!(t.includes("purchase-invoice") || t === "purchase_invoice")) continue;
      if (inv.status !== "posted") continue;
      const ps = (inv.paymentStatus || "").toLowerCase();
      if (ps === "unpaid" || ps === "partial") {
        total += Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0);
      }
    }
    return total;
  }, [invoices]);

  const vatPayable = useMemo(() => {
    let output = 0;
    let input = 0;
    for (const inv of invoices) {
      if (inv.status !== "posted") continue;
      const t = String(inv.type || "").toLowerCase();
      const vat = Number(inv.vatAmount || inv.taxAmount || 0);
      if (t.includes("sales-invoice") || t === "sales_invoice") output += vat;
      if (t.includes("purchase-invoice") || t === "purchase_invoice") input += vat;
    }
    return Math.max(0, output - input);
  }, [invoices]);

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Dashboard</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {bsDateStr} · {adDateStr}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row border border-gray-200 rounded-md bg-white overflow-hidden">
        <MetricCell
          label="Cash & Bank"
          value={cashBankBalance}
          onClick={() => setCurrentPage("ledger")}
        />
        <MetricCell
          label="Outstanding Receivables"
          value={arOutstanding}
          onClick={() => setCurrentPage("outstanding-receivables")}
        />
        <MetricCell
          label="Outstanding Payables"
          value={apOutstanding}
          onClick={() => setCurrentPage("outstanding-payables")}
        />
        <MetricCell
          label="VAT Payable"
          value={vatPayable}
          onClick={() => setCurrentPage("vat-reports")}
          isLast
        />
      </div>
    </div>
  );
};

export default FinancialDashboard;
