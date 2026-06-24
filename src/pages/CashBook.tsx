// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cash Book page showing cash-only receipts and payments.
 */

import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, Select, NepaliDatePicker, Table, DualDate } from "../components/ui";
import { formatNumber, dateToAD } from "../lib/utils";
import { VoucherType, VoucherStatus } from "../lib/types";
import toast from "react-hot-toast";
import { PillTitle, FormPanel } from "../components/BusyShell";

const CashBook: React.FC = () => {
  const { accounts, vouchers, currentFiscalYear } = useStore();
  const cashAccounts = useMemo(
    () => accounts.filter((acc) => acc.type === "asset" && acc.name.toLowerCase().includes("cash")),
    [accounts],
  );

  const [cashAccountId, setCashAccountId] = useState(cashAccounts[0]?.id || "");
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || dateToAD(new Date()));
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || dateToAD(new Date()));

  const selectedCashAccount = useMemo(
    () => cashAccounts.find((acc) => acc.id === cashAccountId),
    [cashAccounts, cashAccountId],
  );

  const filteredEntries = useMemo(() => {
    return vouchers
      .filter(
        (voucher) =>
          voucher.status === VoucherStatus.POSTED &&
          voucher.date >= startDate &&
          voucher.date <= endDate,
      )
      .flatMap((voucher) =>
        voucher.lines
          .filter((line) => line.accountId === cashAccountId)
          .map((line) => ({
            adDate: voucher.date,
            bsDate: voucher.dateNepali || voucher.date,
            voucherNo: voucher.voucherNo,
            type: voucher.type,
            party: voucher.partyName || line.accountName || "",
            narration: line.narration || voucher.narration || "",
            amount: line.debit || line.credit || 0,
            isReceipt: line.debit > 0,
            isPayment: line.credit > 0,
            balance: 0,
          })),
      );
  }, [vouchers, cashAccountId, startDate, endDate]);

  const rows = useMemo(() => {
    let balance = 0;
    return filteredEntries.map((entry) => {
      const signed = entry.isReceipt ? entry.amount : -entry.amount;
      balance += signed;
      return { ...entry, balance };
    });
  }, [filteredEntries]);

  const openingBalance = 0;
  const closingBalance = rows.length ? rows[rows.length - 1].balance : 0;

  const receiptColumns = [
    { key: "date", header: "Date", render: (_: any, row: any) => <DualDate date={row.adDate} dateNepali={row.bsDate} /> },
    { key: "voucherNo", header: "Voucher No" },
    { key: "party", header: "From (Party)" },
    { key: "narration", header: "Narration" },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (value: number) => formatNumber(value),
    },
  ];

  const paymentColumns = [
    { key: "date", header: "Date", render: (_: any, row: any) => <DualDate date={row.adDate} dateNepali={row.bsDate} /> },
    { key: "voucherNo", header: "Voucher No" },
    { key: "party", header: "To (Party)" },
    { key: "narration", header: "Narration" },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (value: number) => formatNumber(value),
    },
  ];

  const handleExport = () => {
    toast("Excel export not implemented yet for Cash Book.");
  };

  const handlePrint = () => {
    toast("Print not implemented yet for Cash Book.");
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
      setStartDate(today);
      setEndDate(today);
    } else if (type === "week") {
      const range = getThisWeekRange();
      setStartDate(range.start);
      setEndDate(range.end);
    } else if (type === "month") {
      const range = getThisMonthRange();
      setStartDate(range.start);
      setEndDate(range.end);
    } else if (type === "fy") {
      if (currentFiscalYear) {
        setStartDate(currentFiscalYear.startDate);
        setEndDate(currentFiscalYear.endDate);
      }
    }
  };

  return (


    <div style={{ background: "#e8e4f0", padding: 12 }}>


      <PillTitle title="Cash Book" />


      <FormPanel>


        <div className="flex flex-col gap-6 animate-fadeIn select-none text-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Cash Book</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Cash receipts and payments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            Print
          </Button>
        </div>
      </div>

      <Card border padding="md" className="no-print">
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => applyQuickFilter("today")}
            className="px-2.5 py-1 text-[11px] text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => applyQuickFilter("week")}
            className="px-2.5 py-1 text-[11px] text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
          >
            This Week
          </button>
          <button
            type="button"
            onClick={() => applyQuickFilter("month")}
            className="px-2.5 py-1 text-[11px] text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => applyQuickFilter("fy")}
            className="px-2.5 py-1 text-[11px] text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
          >
            This FY
          </button>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Select
            label="Cash Account"
            value={cashAccountId}
            onChange={setCashAccountId}
            options={[
              { value: "", label: "Select cash account" },
              ...cashAccounts.map((acc) => ({ value: acc.id, label: `${acc.code} · ${acc.name}` })),
            ]}
          />
          <NepaliDatePicker label="From Date" value={startDate} onChange={setStartDate} />
          <NepaliDatePicker label="To Date" value={endDate} onChange={setEndDate} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card border padding="sm" className="bg-slate-50">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Opening Balance
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900">
            {formatNumber(openingBalance)}
          </div>
        </Card>
        <Card border padding="sm" className="bg-slate-50">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Closing Balance
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900">
            {formatNumber(closingBalance)}
          </div>
        </Card>
        <Card border padding="sm" className="bg-slate-50">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Transactions</div>
          <div className="mt-2 text-lg font-bold text-slate-900">{rows.length}</div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card border padding="md">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
              Receipts / Debit
            </div>
            <div className="text-xs text-slate-500">
              Total:{" "}
              {formatNumber(
                rows.filter((r) => r.isReceipt).reduce((sum, row) => sum + row.amount, 0),
              )}
            </div>
          </div>
          <Table
            columns={receiptColumns}
            data={rows.filter((row) => row.isReceipt)}
            rowKey={(row) => `${row.voucherNo}-${row.date}-receipt`}
            emptyMessage="No cash receipts in selected range."
            stickyHeader
          />
        </Card>

        <Card border padding="md">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
              Payments / Credit
            </div>
            <div className="text-xs text-slate-500">
              Total:{" "}
              {formatNumber(
                rows.filter((r) => r.isPayment).reduce((sum, row) => sum + row.amount, 0),
              )}
            </div>
          </div>
          <Table
            columns={paymentColumns}
            data={rows.filter((row) => row.isPayment)}
            rowKey={(row) => `${row.voucherNo}-${row.date}-payment`}
            emptyMessage="No cash payments in selected range."
            stickyHeader
          />
        </Card>
      </div>
    </div>

      </FormPanel>

    </div>
  );
};

export default CashBook;

