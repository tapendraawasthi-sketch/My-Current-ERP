// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherType, VoucherStatus } from "../lib/types";
import { ReportWorkspace } from "@/features/reports";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const CashBook: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("cash-book");

  const { vouchers, accounts, companySettings, currentFiscalYear } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "");
  const [showNarration, setShowNarration] = useState(true);

  // Pending states for options modal
  const [pendingAccountId, setPendingAccountId] = useState(selectedAccountId);
  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);
  const [pendingShowNarration, setPendingShowNarration] = useState(showNarration);

  const applyOptions = () => {
    setSelectedAccountId(pendingAccountId);
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
    setShowNarration(pendingShowNarration);
    setOptionsOpen(false);
  };

  // Find cash accounts
  const cashAccounts = useMemo(() => {
    return (accounts || []).filter(
      (acc) =>
        acc.type === "asset" &&
        (acc.name.toLowerCase().includes("cash") ||
          (acc.parentId &&
            accounts.some(
              (parent) => parent.id === acc.parentId && parent.name.toLowerCase().includes("cash"),
            )) ||
          (acc.level === "group" && acc.name.toLowerCase().includes("cash"))) &&
        !acc.isGroup,
    );
  }, [accounts]);

  // Set default account if not selected
  React.useEffect(() => {
    if (!selectedAccountId && cashAccounts.length > 0) {
      setSelectedAccountId(cashAccounts[0].id);
      setPendingAccountId(cashAccounts[0].id);
    }
  }, [selectedAccountId, cashAccounts]);

  // Compute cash book data
  const data = useMemo(() => {
    if (!selectedAccountId) return [];

    const account = accounts.find((acc) => acc.id === selectedAccountId);
    if (!account) return [];

    // Opening balance row
    let runningBalance = (account.openingBalanceDr || 0) - (account.openingBalanceCr || 0);
    const result = [
      {
        id: "opening",
        date: "",
        particulars: "Opening Balance",
        voucherNo: "",
        voucherType: "",
        debit: account.openingBalanceDr || 0,
        credit: account.openingBalanceCr || 0,
        balance: runningBalance,
        isBold: true,
        isBgMuted: true,
      },
    ];

    // Get relevant vouchers
    const relevantVouchers = (vouchers || [])
      .filter(
        (v) =>
          v.status === "posted" &&
          v.date >= startDate &&
          v.date <= endDate &&
          v.lines.some((line) => line.accountId === selectedAccountId),
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Process each voucher
    relevantVouchers.forEach((voucher) => {
      const lineForAccount = voucher.lines.find((l) => l.accountId === selectedAccountId);

      const debit = lineForAccount?.debit || 0;
      const credit = lineForAccount?.credit || 0;

      // Calculate running balance
      runningBalance += debit - credit;

      // Get other account names for particulars
      const otherLines = voucher.lines.filter((l) => l.accountId !== selectedAccountId);
      const particularNames = otherLines
        .map((line) => {
          const acc = accounts.find((a) => a.id === line.accountId);
          return acc?.name || "Unknown";
        })
        .join(", ");

      // Format voucher type
      let voucherTypeLabel = voucher.type;
      switch (voucher.type) {
        case "journal":
          voucherTypeLabel = "Journal";
          break;
        case "payment":
          voucherTypeLabel = "Payment";
          break;
        case "receipt":
          voucherTypeLabel = "Receipt";
          break;
        case "contra":
          voucherTypeLabel = "C";
          break;
        case "sales-invoice":
          voucherTypeLabel = "Sales";
          break;
        case "purchase-invoice":
          voucherTypeLabel = "Purchase";
          break;
        case "sales-return":
          voucherTypeLabel = "Sales Return";
          break;
        case "purchase-return":
          voucherTypeLabel = "Purchase Return";
          break;
        case "debit-note":
          voucherTypeLabel = "Debit Note";
          break;
        case "credit-note":
          voucherTypeLabel = "Credit Note";
          break;
        case "stock-journal":
          voucherTypeLabel = "Stock Journal";
          break;
        default:
          voucherTypeLabel = voucher.type;
      }

      // Add narration if enabled
      let particulars = particularNames;
      if (showNarration && voucher.narration) {
        particulars += ` (${voucher.narration})`;
      }

      result.push({
        id: voucher.id,
        date: voucher.date,
        particulars,
        voucherNo: voucher.voucherNo,
        voucherType: voucherTypeLabel,
        debit,
        credit,
        balance: runningBalance,
      });
    });

    // Closing balance row
    result.push({
      id: "closing",
      date: "",
      particulars: "Closing Balance",
      voucherNo: "",
      voucherType: "",
      debit: "",
      credit: "",
      balance: runningBalance,
      isBold: true,
      isBgMuted: true,
    });

    // Summary row
    const totalDebit = result.reduce((sum, row) => {
      if (row.id !== "opening" && row.id !== "closing") {
        return sum + (row.debit || 0);
      }
      return sum;
    }, 0);

    const totalCredit = result.reduce((sum, row) => {
      if (row.id !== "opening" && row.id !== "closing") {
        return sum + (row.credit || 0);
      }
      return sum;
    }, 0);

    result.push({
      id: "summary",
      date: "",
      particulars: "TOTAL",
      voucherNo: "",
      voucherType: "",
      debit: totalDebit,
      credit: totalCredit,
      balance: "",
      isBold: true,
    });

    return result;
  }, [selectedAccountId, vouchers, accounts, startDate, endDate, showNarration]);

  // Custom cell rendering
  const renderCell = (columnKey: string, value: any, row: any) => {
    if (columnKey === "debit" && value > 0) {
      return <span className="text-[var(--ds-action-primary)]">{formatNumber(value)}</span>;
    }
    if (columnKey === "credit" && value > 0) {
      return <span className="text-[var(--ds-status-danger)]">{formatNumber(value)}</span>;
    }
    if (columnKey === "balance" && row.balance !== undefined && row.balance !== "") {
      const isDr = row.balance >= 0;
      const formattedValue = isDr
        ? `${formatNumber(Math.abs(row.balance))} Dr`
        : `${formatNumber(Math.abs(row.balance))} Cr`;
      return <span className={isDr ? "text-[var(--ds-status-success)]" : "text-[var(--ds-status-danger)]"}>{formattedValue}</span>;
    }
    if (columnKey === "voucherType" && value === "C") {
      return <span>C</span>;
    }
    if (columnKey === "debit" || columnKey === "credit") {
      return formatNumber(value);
    }
    return value;
  };

  const columns = [
    { key: "date", label: "Date" },
    { key: "particulars", label: "Particulars" },
    { key: "voucherNo", label: "Vch No" },
    { key: "voucherType", label: "Type" },
    { key: "debit", label: "Debit", align: "right" as const },
    { key: "credit", label: "Credit", align: "right" as const },
    { key: "balance", label: "Balance", align: "right" as const },
  ].map((col) => ({
    ...col,
    render: (val: any, row: any) => renderCell(col.key, val, row),
  }));

  return (
    <ReportWorkspace
      title="Cash book"
      description="Cash in and out."
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodLabel={`${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingAccountId(selectedAccountId);
        setPendingStart(startDate);
        setPendingEnd(endDate);
        setPendingShowNarration(showNarration);
        setOptionsOpen(true);
      }}
      filterSlot={
        <>
          <label className="text-[12px] font-medium text-[var(--ds-text-muted)] flex items-center gap-1.5">
            Account
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              aria-label="Cash account"
              className="h-8 px-2.5 text-[13px] font-normal border border-[var(--ds-border-default)] rounded-md bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            >
              {cashAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] font-medium text-[var(--ds-text-muted)] flex items-center gap-1.5">
            From
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 px-2.5 text-[13px] font-normal border border-[var(--ds-border-default)] rounded-md bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>
          <label className="text-[12px] font-medium text-[var(--ds-text-muted)] flex items-center gap-1.5">
            To
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 px-2.5 text-[13px] font-normal border border-[var(--ds-border-default)] rounded-md bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>
          <label className="text-[12px] font-medium text-[var(--ds-text-muted)] flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showNarration}
              onChange={(e) => setShowNarration(e.target.checked)}
              className="w-4 h-4 text-[var(--ds-action-primary)] rounded border-gray-300 focus:ring-[var(--ds-action-primary)]"
            />
            Show narration
          </label>
        </>
      }
    >
      <ReportGrid columns={columns} data={data} />

      <ReportOptionsModal
        open={optionsOpen}
        title="Cash book options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-[var(--ds-text-muted)]">
            Account
            <select
              value={pendingAccountId}
              onChange={(e) => setPendingAccountId(e.target.value)}
              className="h-8 px-2.5 text-[13px] font-normal border border-[var(--ds-border-default)] rounded-md bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            >
              {cashAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-[var(--ds-text-muted)]">
            From date
            <input
              type="date"
              value={pendingStart}
              onChange={(e) => setPendingStart(e.target.value)}
              className="h-8 px-2.5 text-[13px] font-normal border border-[var(--ds-border-default)] rounded-md bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-[var(--ds-text-muted)]">
            To date
            <input
              type="date"
              value={pendingEnd}
              onChange={(e) => setPendingEnd(e.target.value)}
              className="h-8 px-2.5 text-[13px] font-normal border border-[var(--ds-border-default)] rounded-md bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>
          <label className="flex items-center gap-2 text-[12px] font-medium text-[var(--ds-text-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={pendingShowNarration}
              onChange={(e) => setPendingShowNarration(e.target.checked)}
              className="w-4 h-4 text-[var(--ds-action-primary)] rounded border-gray-300 focus:ring-[var(--ds-action-primary)]"
            />
            Show narration
          </label>
        </div>
      </ReportOptionsModal>
    </ReportWorkspace>
  );
};

export default CashBook;
