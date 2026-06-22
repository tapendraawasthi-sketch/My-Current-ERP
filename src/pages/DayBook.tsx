/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Day Book page showing all transactions grouped by voucher type.
 */

import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, Select, NepaliDatePicker } from "../components/ui";
import { computeDayBook } from "../lib/accounting";
import { formatNumber, dateToAD } from "../lib/utils";
import { VoucherStatus, VoucherType } from "../lib/types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import toast from "react-hot-toast";

const DAY_BOOK_GROUPS: { type: VoucherType[]; label: string }[] = [
  { type: [VoucherType.PAYMENT], label: "PAYMENT VOUCHERS" },
  { type: [VoucherType.RECEIPT], label: "RECEIPT VOUCHERS" },
  { type: [VoucherType.JOURNAL], label: "JOURNAL ENTRIES" },
  { type: [VoucherType.SALES_INVOICE], label: "SALES INVOICES" },
  { type: [VoucherType.PURCHASE_INVOICE], label: "PURCHASE INVOICES" },
  { type: [VoucherType.CONTRA], label: "CONTRA VOUCHERS" },
  { type: [VoucherType.DEBIT_NOTE, VoucherType.CREDIT_NOTE], label: "DEBIT / CREDIT NOTES" },
];

const DayBook: React.FC = () => {
  const { vouchers, accounts, currentFiscalYear } = useStore();
  const [isRange, setIsRange] = useState(false);
  const [date, setDate] = useState(currentFiscalYear?.startDate || dateToAD(new Date()));
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || dateToAD(new Date()));

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((voucher) => {
      if (voucher.status !== VoucherStatus.POSTED) return false;
      if (!isRange) {
        return voucher.date === date;
      }
      return voucher.date >= date && voucher.date <= endDate;
    });
  }, [vouchers, date, endDate, isRange]);

  const groupedEntries = useMemo(() => {
    return DAY_BOOK_GROUPS.map((group) => {
      const groupVoucherTypes = group.type;
      const groupVouchers = filteredVouchers.filter((voucher) =>
        groupVoucherTypes.includes(voucher.type),
      );

      const rows = groupVouchers.flatMap((voucher) =>
        voucher.lines.map((line) => ({
          voucherId: voucher.id,
          voucherNo: voucher.voucherNo,
          date: voucher.dateNepali || voucher.date,
          time: voucher.time || "",
          type: voucher.type,
          narration: line.narration || voucher.narration || "",
          partyAccount: voucher.partyName || line.accountName || "",
          debit: line.debit,
          credit: line.credit,
          voucherTypeLabel: voucher.type,
        })),
      );

      const subtotal = rows.reduce(
        (acc, row) => ({ debit: acc.debit + row.debit, credit: acc.credit + row.credit }),
        { debit: 0, credit: 0 },
      );

      return {
        label: group.label,
        rows,
        subtotal,
      };
    }).filter((group) => group.rows.length > 0);
  }, [filteredVouchers]);

  const totals = useMemo(() => {
    return groupedEntries.reduce(
      (acc, group) => ({
        debt: acc.debt + group.subtotal.debit,
        cred: acc.cred + group.subtotal.credit,
      }),
      { debt: 0, cred: 0 },
    );
  }, [groupedEntries]);

  const handleExportPDF = () => {
    if (!groupedEntries.length) {
      toast("No data to print.");
      return;
    }

    try {
      const doc = new jsPDF({ unit: "pt" });
      doc.setFontSize(13);
      doc.text("Day Book", 40, 40);
      doc.setFontSize(10);
      const subtitle = isRange ? `Period: ${date} to ${endDate}` : `Date: ${date}`;
      doc.text(subtitle, 40, 58);

      let cursorY = 80;
      groupedEntries.forEach((group) => {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(group.label, 40, cursorY);
        cursorY += 16;

        const body = group.rows.map((row) => [
          row.date,
          row.voucherNo,
          row.time || "-",
          row.type,
          row.partyAccount,
          row.narration,
          formatNumber(row.debit),
          formatNumber(row.credit),
        ]);

        autoTable(doc, {
          startY: cursorY,
          head: [
            [
              "Date (BS)",
              "Voucher No",
              "Time",
              "Type",
              "Party / Account",
              "Narration",
              "Debit",
              "Credit",
            ],
          ],
          body,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [30, 58, 96], textColor: 255 },
          margin: { left: 40, right: 40 },
        });

        cursorY = (doc as any).lastAutoTable.finalY + 12;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Subtotal Debit: ${formatNumber(group.subtotal.debit)}  |  Subtotal Credit: ${formatNumber(group.subtotal.credit)}`,
          40,
          cursorY,
        );
        cursorY += 18;
      });

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(
        `Grand Total Debit: ${formatNumber(totals.debt)}  |  Grand Total Credit: ${formatNumber(totals.cred)}`,
        40,
        (doc as any).lastAutoTable.finalY + 32,
      );

      const url = URL.createObjectURL(doc.output("blob"));
      const win = window.open(url);
      if (win) win.focus();
    } catch (error: any) {
      toast.error(error?.message || "Could not generate Day Book PDF.");
    }
  };

  const handleExportExcel = () => {
    toast("Excel export not implemented yet for Day Book.");
  };

  const getThisWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(now.setDate(diff));
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    return { start: dateToAD(start), end: dateToAD(end) };
  };

  const getThisMonthRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: dateToAD(start), end: dateToAD(end) };
  };

  const applyQuickFilter = (type: "today" | "week" | "month" | "fy") => {
    const today = dateToAD(new Date());
    if (type === "today") {
      setIsRange(false);
      setDate(today);
    } else if (type === "week") {
      const range = getThisWeekRange();
      setIsRange(true);
      setDate(range.start);
      setEndDate(range.end);
    } else if (type === "month") {
      const range = getThisMonthRange();
      setIsRange(true);
      setDate(range.start);
      setEndDate(range.end);
    } else if (type === "fy") {
      if (currentFiscalYear) {
        setIsRange(true);
        setDate(currentFiscalYear.startDate);
        setEndDate(currentFiscalYear.endDate);
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-fadeIn select-none text-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Day Book</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">All transactions for the selected date</p>
        </div>
      </div>

      <div className="page-toolbar mb-3 no-print">
        <div className="page-toolbar-left gap-3 flex-wrap">
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              className={`h-7 px-2.5 text-[11px] font-semibold rounded transition-colors ${!isRange ? "bg-[#1557b0] text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
              onClick={() => setIsRange(false)}
            >
              Single Date
            </button>
            <button
              type="button"
              className={`h-7 px-2.5 text-[11px] font-semibold rounded transition-colors ${isRange ? "bg-[#1557b0] text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
              onClick={() => setIsRange(true)}
            >
              Date Range
            </button>
          </div>

          <div className="flex items-center gap-1 border-l pl-3 shrink-0" style={{ borderColor: "var(--border)" }}>
            <button type="button" onClick={() => applyQuickFilter("today")} className="h-7 px-2.5 text-[11px] font-semibold rounded border border-gray-300 text-gray-600 hover:bg-gray-50">Today</button>
            <button type="button" onClick={() => applyQuickFilter("week")} className="h-7 px-2.5 text-[11px] font-semibold rounded border border-gray-300 text-gray-600 hover:bg-gray-50">This Week</button>
            <button type="button" onClick={() => applyQuickFilter("month")} className="h-7 px-2.5 text-[11px] font-semibold rounded border border-gray-300 text-gray-600 hover:bg-gray-50">This Month</button>
            <button type="button" onClick={() => applyQuickFilter("fy")} className="h-7 px-2.5 text-[11px] font-semibold rounded border border-gray-300 text-gray-600 hover:bg-gray-50">This FY</button>
          </div>

          <div className="flex items-center gap-2 border-l pl-3 shrink-0" style={{ borderColor: "var(--border)" }}>
            <NepaliDatePicker label="From Date" value={date} onChange={setDate} />
            {isRange && <NepaliDatePicker label="To Date" value={endDate} onChange={setEndDate} />}
          </div>
        </div>
        <div className="page-toolbar-right flex items-center gap-2 shrink-0">
          <button type="button" onClick={handleExportExcel} className="h-8 px-3 text-[11px] font-semibold border rounded-md text-gray-600 hover:bg-gray-50 flex items-center gap-1.5" style={{ borderColor: "var(--border)" }}>
            Export Excel
          </button>
          <button type="button" onClick={handleExportPDF} className="h-8 px-3 text-[11px] font-semibold border rounded-md text-gray-600 hover:bg-gray-50 flex items-center gap-1.5" style={{ borderColor: "var(--border)" }}>
            Print PDF
          </button>
        </div>
      </div>

      {groupedEntries.length === 0 ? (
        <Card border padding="md" className="text-center py-8 text-gray-500">
          No day book entries for selected date(s).
        </Card>
      ) : (
        groupedEntries.map((group) => (
          <div key={group.label} className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 border-y" style={{ borderColor: "var(--border)" }}>
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700">{group.label}</span>
              <span className="text-[10px] font-bold text-blue-600">Dr: {formatNumber(group.subtotal?.debit||0)} | Cr: {formatNumber(group.subtotal?.credit||0)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date (BS)</th>
                    <th>Voucher No</th>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Party / Account</th>
                    <th>Narration</th>
                    <th className="th-right">Debit</th>
                    <th className="th-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="whitespace-nowrap">{row.date}</td>
                      <td className="font-mono font-bold">{row.voucherNo}</td>
                      <td>{row.time || "—"}</td>
                      <td>
                        <span className={`badge badge-${row.type?.replace(/-/g,'')}`}>{row.type?.replace(/-/g,' ').toUpperCase()}</span>
                      </td>
                      <td className="font-semibold text-gray-800">{row.partyAccount}</td>
                      <td className="text-gray-605">{row.narration}</td>
                      <td className="amt amt-dr">{row.debit > 0 ? formatNumber(row.debit) : "—"}</td>
                      <td className="amt amt-cr">{row.credit > 0 ? formatNumber(row.credit) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      <Card border padding="sm" className="bg-slate-50">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-505">Grand totals</div>
          <div className="text-sm font-bold text-slate-900">
            Debit: {formatNumber(totals.debt)} | Credit: {formatNumber(totals.cred)}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DayBook;
