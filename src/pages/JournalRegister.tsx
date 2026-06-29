// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const JournalRegister: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("journal-register");

  const { vouchers, accounts, companySettings, currentFiscalYear } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "");
  const [showNarration, setShowNarration] = useState(true);
  const [showCancelled, setShowCancelled] = useState(false);
  const [searchText, setSearchText] = useState("");

  // Pending states for options modal
  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);
  const [pendingShowNarration, setPendingShowNarration] = useState(showNarration);
  const [pendingShowCancelled, setPendingShowCancelled] = useState(showCancelled);

  const applyOptions = () => {
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
    setShowNarration(pendingShowNarration);
    setShowCancelled(pendingShowCancelled);
    setOptionsOpen(false);
  };

  // Compute journal register data
  const registerData = useMemo(() => {
    if (!vouchers || !accounts) return { rows: [], grandTotalDebit: 0, grandTotalCredit: 0 };

    // Filter journal vouchers
    let filteredVouchers = vouchers.filter(
      (v) =>
        (v.type === "journal" || v.type === "journal-voucher") &&
        (showCancelled ? true : v.status !== "cancelled") &&
        v.date >= startDate &&
        v.date <= endDate,
    );

    // Apply search filter
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      filteredVouchers = filteredVouchers.filter(
        (v) =>
          v.voucherNo.toLowerCase().includes(lowerSearch) ||
          v.narration?.toLowerCase().includes(lowerSearch) ||
          v.lines.some((line) => {
            const account = accounts.find((acc) => acc.id === line.accountId);
            return account?.name.toLowerCase().includes(lowerSearch);
          }),
      );
    }

    // Sort by date then voucher number
    filteredVouchers.sort((a, b) => {
      if (a.date !== b.date) {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      return (a.voucherNo || "").localeCompare(b.voucherNo || "");
    });

    // Build rows for each voucher
    const rows: any[] = [];
    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    filteredVouchers.forEach((voucher) => {
      // Process debit lines
      voucher.lines.forEach((line) => {
        if (line.debit > 0) {
          const account = accounts.find((acc) => acc.id === line.accountId);
          const accountName = account?.name || "Unknown Account";

          rows.push({
            id: `${voucher.id}-dr-${line.id || Math.random()}`,
            date: voucher.date,
            voucherNo: voucher.voucherNo,
            particulars: `${accountName} Dr`,
            debit: line.debit,
            credit: 0,
            type: "line",
            status: voucher.status,
          });

          if (voucher.status !== "cancelled") {
            grandTotalDebit += line.debit;
          }
        }
      });

      // Process credit lines
      voucher.lines.forEach((line) => {
        if (line.credit > 0) {
          const account = accounts.find((acc) => acc.id === line.accountId);
          const accountName = account?.name || "Unknown Account";

          rows.push({
            id: `${voucher.id}-cr-${line.id || Math.random()}`,
            date: "",
            voucherNo: "",
            particulars: `  To ${accountName}`,
            debit: 0,
            credit: line.credit,
            type: "line",
            status: voucher.status,
          });

          if (voucher.status !== "cancelled") {
            grandTotalCredit += line.credit;
          }
        }
      });

      // Add narration row if enabled
      if (showNarration && voucher.narration) {
        rows.push({
          id: `${voucher.id}-narration`,
          date: "",
          voucherNo: "",
          particulars: `(${voucher.narration})`,
          debit: 0,
          credit: 0,
          type: "narration",
          status: voucher.status,
        });
      }

      // Add separator row
      rows.push({
        id: `${voucher.id}-sep`,
        type: "separator",
      });
    });

    return {
      rows,
      grandTotalDebit,
      grandTotalCredit,
    };
  }, [vouchers, accounts, startDate, endDate, showCancelled, showNarration, searchText]);

  return (
    <ReportShell
      title="Journal Register"
      subtitle="Journal vouchers with detailed entries"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingStart(startDate);
        setPendingEnd(endDate);
        setPendingShowNarration(showNarration);
        setPendingShowCancelled(showCancelled);
        setOptionsOpen(true);
      }}
      actionBarButtons={[{ label: "Print" }, { label: "Export" }]}
      toolbarLeft={
        <>
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

          <input
            type="text"
            placeholder="Search voucher no, narration, account..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-64"
          />
        </>
      }
    >
      <div className="overflow-x-auto w-full border border-gray-200 rounded-md bg-white">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Date
              </th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Vch No
              </th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Particulars
              </th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">
                Debit (Rs.)
              </th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">
                Credit (Rs.)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {registerData.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-[12px]">
                  No journal vouchers found for the selected period.
                </td>
              </tr>
            )}

            {registerData.rows.map((row, index) => {
              if (row.type === "separator") {
                return (
                  <tr key={row.id} className="bg-white">
                    <td colSpan={5} className="p-0 border-t border-dashed border-gray-300 h-2"></td>
                  </tr>
                );
              }

              const isCancelled = row.status === "cancelled";
              const cancelClass = isCancelled ? "text-red-500 line-through" : "text-gray-700";

              if (row.type === "narration") {
                return (
                  <tr
                    key={row.id}
                    className={`bg-white hover:bg-gray-50 transition-colors ${cancelClass}`}
                  >
                    <td className="px-3 py-1"></td>
                    <td className="px-3 py-1"></td>
                    <td className="px-3 py-1 text-left text-[11px] italic text-gray-500 whitespace-normal break-words max-w-lg">
                      {row.particulars}
                    </td>
                    <td className="px-3 py-1 text-right">—</td>
                    <td className="px-3 py-1 text-right">—</td>
                  </tr>
                );
              }

              const isFirstLine = row.type === "line" && row.date;

              return (
                <tr
                  key={row.id}
                  className={`bg-white hover:bg-gray-50 transition-colors ${isFirstLine ? "font-medium" : ""} ${cancelClass}`}
                >
                  <td className="px-3 py-1.5 text-[12px]">{row.date}</td>
                  <td className="px-3 py-1.5 text-[12px]">{row.voucherNo}</td>
                  <td
                    className={`px-3 py-1.5 text-[12px] text-left ${row.particulars.startsWith("  To ") ? "pl-8" : ""}`}
                  >
                    {row.particulars}
                  </td>
                  <td
                    className="px-3 py-1.5 text-[12px] text-right font-mono"
                    style={{ color: !isCancelled && row.debit > 0 ? "#1557b0" : "inherit" }}
                  >
                    {row.debit > 0 ? formatNumber(row.debit) : ""}
                  </td>
                  <td
                    className="px-3 py-1.5 text-[12px] text-right font-mono"
                    style={{ color: !isCancelled && row.credit > 0 ? "#dc2626" : "inherit" }}
                  >
                    {row.credit > 0 ? formatNumber(row.credit) : ""}
                  </td>
                </tr>
              );
            })}

            {/* Grand total row */}
            {registerData.rows.length > 0 && (
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-left">TOTAL</td>
                <td className="px-3 py-2.5"></td>
                <td className="px-3 py-2.5"></td>
                <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-gray-800 text-right">
                  {formatNumber(registerData.grandTotalDebit)}
                </td>
                <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-gray-800 text-right">
                  {formatNumber(registerData.grandTotalCredit)}
                </td>
              </tr>
            )}

            {/* Verification row */}
            {registerData.rows.length > 0 && (
              <tr
                className={`border-t border-gray-200 ${Math.abs(registerData.grandTotalDebit - registerData.grandTotalCredit) < 0.01 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
              >
                <td
                  colSpan={5}
                  className="px-3 py-3 text-[12px] font-bold text-center border-t border-gray-200"
                >
                  {Math.abs(registerData.grandTotalDebit - registerData.grandTotalCredit) < 0.01
                    ? "✓ JOURNAL REGISTER BALANCES"
                    : "⚠️ JOURNAL REGISTER DOES NOT BALANCE"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ReportOptionsModal
        open={optionsOpen}
        title="Journal Register Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
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

          <label className="flex items-center gap-2 text-[11px] font-medium text-gray-600 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={pendingShowNarration}
              onChange={(e) => setPendingShowNarration(e.target.checked)}
              className="w-4 h-4 text-[#1557b0] rounded border-gray-300 focus:ring-[#1557b0]"
            />
            Show Narration
          </label>

          <label className="flex items-center gap-2 text-[11px] font-medium text-gray-600 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={pendingShowCancelled}
              onChange={(e) => setPendingShowCancelled(e.target.checked)}
              className="w-4 h-4 text-[#1557b0] rounded border-gray-300 focus:ring-[#1557b0]"
            />
            Show Cancelled Vouchers
          </label>
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default JournalRegister;
