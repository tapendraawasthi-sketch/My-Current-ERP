// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Receipt Vouchers — list & entry page.
 */

import React, { useState, useMemo } from "react";
import { ActionToolbar } from "../components/ui";
import { useStore } from "../store/useStore";
import { SearchableTable, Button, Badge, Select, NepaliDatePicker } from "../components/ui";
import ReceiptVoucherForm from "../components/voucher/ReceiptVoucherForm";
import { Download, Plus, Eye } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { VoucherType, VoucherStatus } from "../lib/types";
import { PillTitle, FormPanel } from "../components/BusyShell";

const statusVariant = {
  [VoucherStatus.DRAFT]: "default",
  [VoucherStatus.POSTED]: "success",
  [VoucherStatus.CANCELLED]: "danger",
};

const ReceiptVoucher: React.FC = () => {
  const { vouchers, companySettings } = useStore();
  const symbol = companySettings?.currencySymbol || "Rs.";

  const [mode, setMode] = useState<"list" | "new" | "edit">("list");
  const [activeId, setActiveId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const receipts = useMemo(
    () => vouchers.filter((v) => v.type === VoucherType.RECEIPT),
    [vouchers],
  );

  const filtered = useMemo(() => {
    return receipts
      .filter((v) => statusFilter === "ALL" || v.status === statusFilter)
      .filter((v) => !fromDate || v.date >= fromDate)
      .filter((v) => !toDate || v.date <= toDate)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [receipts, statusFilter, fromDate, toDate]);

  const openNew = () => {
    setActiveId(null);
    setMode("new");
  };
  const openEdit = (row: any) => {
    setActiveId(row.id);
    setMode("edit");
  };
  const backToList = () => {
    setMode("list");
    setActiveId(null);
  };

  if (mode === "new" || mode === "edit") {
    return (
      <ReceiptVoucherForm
        voucherId={mode === "edit" ? activeId! : undefined}
        onSave={backToList}
        onCancel={backToList}
      />
    );
  }

  const columns = [
    {
      key: "voucherNo",
      header: "Voucher No",
      render: (v: string) => <span className="font-mono font-bold text-slate-700">{v}</span>,
    },
    { key: "dateNepali", header: "Date (BS)", render: (v: string) => v || "—" },
    { key: "date", header: "Date (AD)" },
    { key: "partyName", header: "Received From", render: (v: string) => v || "—" },
    {
      key: "narration",
      header: "Narration",
      render: (v: string) => <span className="line-clamp-1 max-w-[220px]">{v || "—"}</span>,
    },
    {
      key: "totalDebit",
      header: "Amount",
      align: "right",
      render: (v: number) => (
        <span className="font-mono text-green-600">
          {symbol} {formatNumber(v || 0)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (v: string) => (
        <Badge variant={statusVariant[v] || "default"}>{(v || "").toUpperCase()}</Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "center",
      render: (_: any, row: any) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            openEdit(row);
          }}
          className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
          title="View / Edit"
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (


    <div style={{ background: "#fffbe6", padding: 12 }}>


      <PillTitle title="Add Receipt Voucher" />


      <FormPanel>


        <div className="flex flex-col gap-6 animate-fadeIn text-xs select-none">
      <ActionToolbar title="Receipt Vouchers" subtitle="Cash and bank receipts" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Download className="h-5 w-5 text-green-600" />
            <span>RECEIPT VOUCHERS</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1 leading-none font-semibold uppercase tracking-wider">
            Money received — customer payments, income & deposits
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openNew} icon={<Plus className="h-4 w-4" />}>
          New Receipt Voucher
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 border border-gray-200 rounded-xl shadow-sm">
        <NepaliDatePicker label="From Date" value={fromDate} onChange={setFromDate} />
        <NepaliDatePicker label="To Date" value={toDate} onChange={setToDate} />
        <Select
          label="Status"
          options={[
            { value: "ALL", label: "All Statuses" },
            { value: VoucherStatus.DRAFT, label: "Draft" },
            { value: VoucherStatus.POSTED, label: "Posted" },
            { value: VoucherStatus.CANCELLED, label: "Cancelled" },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      <SearchableTable
        columns={columns}
        data={filtered}
        searchFields={["voucherNo", "narration", "partyName", "referenceNo"]}
        rowKey="id"
        onRowClick={openEdit}
        emptyMessage="No receipt vouchers found. Create your first entry."
        placeholder="Search voucher no, payer or narration…"
        stickyHeader
      />
    </div>

      </FormPanel>

    </div>
  );
};

export default ReceiptVoucher;
