// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus, VoucherType } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const GroupVouchers: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("group-vouchers");

  const { vouchers, accounts, companySettings, currentFiscalYear } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "");
  const [searchText, setSearchText] = useState("");
  const [showLedgerSubtotals, setShowLedgerSubtotals] = useState(false);

  // Pending states for options modal
  const [pendingSelectedGroupId, setPendingSelectedGroupId] = useState(selectedGroupId);
  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);
  const [pendingShowLedgerSubtotals, setPendingShowLedgerSubtotals] = useState(showLedgerSubtotals);

  const applyOptions = () => {
    setSelectedGroupId(pendingSelectedGroupId);
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
    setShowLedgerSubtotals(pendingShowLedgerSubtotals);
    setOptionsOpen(false);
  };

  // Function to get all ledger IDs under a group (recursive)
  const getAllLedgerIds = (groupId: string, allAccounts: any[]): string[] => {
    const result: string[] = [];

    const group = allAccounts.find((acc) => acc.id === groupId);
    if (!group) return result;

    const directChildren = allAccounts.filter((acc) => acc.parentId === groupId);

    directChildren.forEach((child) => {
      if (child.isGroup) {
        // Recursively get ledgers from subgroups
        result.push(...getAllLedgerIds(child.id, allAccounts));
      } else {
        // Add ledger
        result.push(child.id);
      }
    });

    return result;
  };

  // Compute group vouchers data
  const reportData = useMemo(() => {
    if (!selectedGroupId || !vouchers || !accounts)
      return { rows: [], totalDebit: 0, totalCredit: 0 };

    // Get all ledger IDs under the selected group
    const ledgerIds = getAllLedgerIds(selectedGroupId, accounts);

    // Find the group name
    const selectedGroup = accounts.find((acc) => acc.id === selectedGroupId);
    const groupName = selectedGroup?.name || "Unknown Group";

    // Filter vouchers that affect any of the ledger IDs
    const filteredVouchers = vouchers.filter(
      (v) =>
        v.status === "posted" &&
        v.date >= startDate &&
        v.date <= endDate &&
        v.lines.some((line) => ledgerIds.includes(line.accountId)),
    );

    // Process each voucher and its matching lines
    const rows: any[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    filteredVouchers.forEach((voucher) => {
      // Get only lines that match our ledger IDs
      const matchingLines = voucher.lines.filter((line) => ledgerIds.includes(line.accountId));

      matchingLines.forEach((line) => {
        // Get the ledger name
        const ledger = accounts.find((acc) => acc.id === line.accountId);
        const ledgerName = ledger?.name || line.accountId;

        // Get contra account names (other lines in the voucher)
        const otherLines = voucher.lines.filter((l) => l.accountId !== line.accountId);
        const contraNames = otherLines
          .map((l) => {
            const acc = accounts.find((a) => a.id === l.accountId);
            return acc?.name || l.accountId;
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
            voucherTypeLabel = "Contra";
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
          case "credit-note":
            voucherTypeLabel = "Credit Note";
            break;
          case "debit-note":
            voucherTypeLabel = "Debit Note";
            break;
          case "stock-journal":
            voucherTypeLabel = "Stock Journal";
            break;
          default:
            voucherTypeLabel = voucher.type;
        }

        rows.push({
          id: `${voucher.id}-${line.id || Math.random()}`,
          date: voucher.date,
          ledgerName,
          particulars: contraNames,
          voucherNo: voucher.voucherNo || voucher.id,
          voucherType: voucherTypeLabel,
          debit: line.debit || 0,
          credit: line.credit || 0,
          voucherId: voucher.id,
        });
      });
    });

    // Filter based on search text if provided
    let finalRows = rows;
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      finalRows = rows.filter(
        (row) =>
          (row.ledgerName || "").toLowerCase().includes(lowerSearch) ||
          (row.voucherNo || "").toLowerCase().includes(lowerSearch) ||
          (row.particulars || "").toLowerCase().includes(lowerSearch),
      );
    }

    // Calculate totals on the filtered subset
    finalRows.forEach((row) => {
      totalDebit += row.debit;
      totalCredit += row.credit;
    });

    // Add total row
    if (finalRows.length > 0) {
      finalRows.push({
        id: "total",
        date: "",
        ledgerName: `Total for ${groupName}`,
        particulars: "",
        voucherNo: "",
        voucherType: "",
        debit: totalDebit,
        credit: totalCredit,
        isTotal: true,
      });
    }

    return {
      rows: finalRows,
      totalDebit,
      totalCredit,
    };
  }, [selectedGroupId, vouchers, accounts, startDate, endDate, searchText, showLedgerSubtotals]);

  // Get all groups for selector
  const groups = useMemo(() => {
    return (accounts || [])
      .filter((acc) => acc.isGroup)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [accounts]);

  // Set default group if not selected
  React.useEffect(() => {
    if (!selectedGroupId && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
      setPendingSelectedGroupId(groups[0].id);
    }
  }, [selectedGroupId, groups]);

  const renderCell = (columnKey: string, value: any, row: any) => {
    if (row.isTotal) {
      if (columnKey === "ledgerName") {
        return <span className="font-bold text-gray-800">{value}</span>;
      }
      if (columnKey === "debit" || columnKey === "credit") {
        return (
          <span className="font-bold font-mono text-gray-800">
            {value > 0 ? formatNumber(value) : "—"}
          </span>
        );
      }
      return "";
    }

    if (columnKey === "debit" || columnKey === "credit") {
      if (!value || value === 0) return "—";
      return (
        <span className={`font-mono ${columnKey === "debit" ? "text-[#1557b0]" : "text-gray-700"}`}>
          {formatNumber(value)}
        </span>
      );
    }

    if (columnKey === "particulars") {
      return <span className="text-gray-500 italic text-[11px]">{value}</span>;
    }

    if (columnKey === "ledgerName") {
      return <span className="font-medium text-gray-800">{value}</span>;
    }

    return value;
  };

  return (
    <ReportShell
      title="Group Vouchers"
      subtitle="All vouchers affecting accounts in a group"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingSelectedGroupId(selectedGroupId);
        setPendingStart(startDate);
        setPendingEnd(endDate);
        setPendingShowLedgerSubtotals(showLedgerSubtotals);
        setOptionsOpen(true);
      }}
      actionBarButtons={[{ label: "Print" }, { label: "Export" }]}
      toolbarLeft={
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            Group:
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-[180px]"
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <div className="h-4 w-px bg-gray-300 mx-1"></div>

          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            From:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </label>

          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            To:
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </label>

          <div className="relative ml-1">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <svg
                className="w-3.5 h-3.5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="h-8 pl-8 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-[140px]"
            />
          </div>
        </div>
      }
    >
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
        <ReportGrid
          columns={[
            { key: "date", label: "Date" },
            { key: "ledgerName", label: "Ledger Name" },
            { key: "particulars", label: "Particulars" },
            { key: "voucherNo", label: "Vch No" },
            { key: "voucherType", label: "Type" },
            { key: "debit", label: "Debit", align: "right" },
            { key: "credit", label: "Credit", align: "right" },
          ]}
          data={reportData.rows}
          getRowClassName={(row) => (row.isTotal ? "bg-[#eef2ff] border-t-2 border-[#c7d2fe]" : "")}
          renderCell={renderCell}
        />
      </div>

      <ReportOptionsModal
        open={optionsOpen}
        title="Group Vouchers Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Account Group
            <select
              value={pendingSelectedGroupId}
              onChange={(e) => setPendingSelectedGroupId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            From Date
            <input
              type="date"
              value={pendingStart}
              onChange={(e) => setPendingStart(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            To Date
            <input
              type="date"
              value={pendingEnd}
              onChange={(e) => setPendingEnd(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </label>

          <label className="flex items-center gap-2 text-[12px] font-medium text-gray-700 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={pendingShowLedgerSubtotals}
              onChange={(e) => setPendingShowLedgerSubtotals(e.target.checked)}
              className="w-4 h-4 text-[#1557b0] border-gray-300 rounded focus:ring-[#1557b0]"
            />
            Show ledger subtotals
          </label>
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default GroupVouchers;
