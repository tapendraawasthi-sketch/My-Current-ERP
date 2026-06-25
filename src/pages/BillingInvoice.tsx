// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Billing & Invoicing — tabbed register for:
 *   Sales Invoices · Purchase Invoices · Sales Returns · Purchase Returns
 */

import React, { useMemo, useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import {
  SearchableTable,
  Button,
  Badge,
  Select,
  NepaliDatePicker,
  PartySelect,
  ActionToolbar,
  DualDate,
} from "../components/ui";
import SalesInvoiceForm from "../components/invoice/SalesInvoiceForm";
import { Receipt, Plus, Eye, Printer, RefreshCw } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { VoucherType, VoucherStatus, PaymentStatus } from "../lib/types";
import { generateInvoicePDF } from "../lib/printUtils";
import toast from "react-hot-toast";

type TabKey = "sales" | "purchase" | "sales-return" | "purchase-return";

const TAB_META: Record<TabKey, { label: string; vt: VoucherType; color: string }> = {
  sales: { label: "Sales Invoices", vt: VoucherType.SALES_INVOICE, color: "success" },
  purchase: { label: "Purchase Invoices", vt: VoucherType.PURCHASE_INVOICE, color: "info" },
  "sales-return": { label: "Sales Returns", vt: VoucherType.SALES_RETURN, color: "warning" },
  "purchase-return": {
    label: "Purchase Returns",
    vt: VoucherType.PURCHASE_RETURN,
    color: "warning",
  },
};

const statusVariant: Record<string, string> = {
  [VoucherStatus.DRAFT]: "default",
  [VoucherStatus.POSTED]: "success",
  [VoucherStatus.CANCELLED]: "danger",
};
const paymentVariant: Record<string, string> = {
  [PaymentStatus.PAID]: "success",
  [PaymentStatus.PARTIAL]: "warning",
  [PaymentStatus.UNPAID]: "danger",
};

const BillingInvoice: React.FC = () => {
  const { invoices, accounts, parties, companySettings, currentPage } = useStore();
  const symbol = companySettings?.currencySymbol || "Rs.";

  const [tab, setTab] = useState<TabKey>("sales");
  const [mode, setMode] = useState<"list" | "new" | "edit">("list");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editType, setEditType] = useState<TabKey>("sales");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [partyId, setPartyId] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL");

  const meta = TAB_META[tab];

  useEffect(() => {
    if (currentPage === "sales-invoice") {
      setTab("sales");
    } else if (currentPage === "purchase-invoice") {
      setTab("purchase");
    } else if (currentPage === "sales-return") {
      setTab("sales-return");
    } else if (currentPage === "purchase-return") {
      setTab("purchase-return");
    }
  }, [currentPage]);

  const filtered = useMemo(() => {
    return invoices
      .filter((i) => i.type === meta.vt)
      .filter((i) => !fromDate || i.date >= fromDate)
      .filter((i) => !toDate || i.date <= toDate)
      .filter((i) => !partyId || i.partyId === partyId)
      .filter((i) => paymentFilter === "ALL" || i.paymentStatus === paymentFilter)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [invoices, meta.vt, fromDate, toDate, partyId, paymentFilter]);

  const openNew = () => {
    setActiveId(null);
    setEditType(tab);
    setMode("new");
  };
  const openEdit = (row: any) => {
    const t =
      (Object.entries(TAB_META) as [TabKey, any][]).find(([, m]) => m.vt === row.type)?.[0] ||
      "sales";
    setActiveId(row.id);
    setEditType(t);
    setMode("edit");
  };
  const backToList = () => {
    setMode("list");
    setActiveId(null);
  };

  const handlePrint = async (row: any) => {
    try {
      const blob = await generateInvoicePDF(row, companySettings, accounts, parties);
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      if (win) win.focus();
    } catch {
      toast.error("Failed to generate PDF.");
    }
  };

  if (mode === "new" || mode === "edit") {
    return (
      <SalesInvoiceForm
        invoiceId={mode === "edit" ? activeId! : undefined}
        type={editType}
        onSave={backToList}
        onCancel={backToList}
      />
    );
  }

  const columns = [
    {
      key: "invoiceNo",
      header: "Invoice No",
      render: (v: string) => <span className="font-mono font-bold text-[#000000]">{v}</span>,
    },
    { 
      key: "date", 
      header: "Date", 
      render: (_: any, row: any) => <DualDate date={row.date || row.adDate} dateNepali={row.dateNepali || row.bsDate} /> 
    },
    { key: "partyName", header: "Party", render: (v: string) => v || "—" },
    {
      key: "grandTotal",
      header: "Grand Total",
      align: "right" as const,
      render: (v: number) => (
        <span className="font-mono font-bold text-[#000000]">
          {symbol} {formatNumber(v || 0)}
        </span>
      ),
    },
    {
      key: "vatAmount",
      header: "VAT",
      align: "right" as const,
      render: (v: number) => (
        <span className="font-mono text-[#000000]">
          {symbol} {formatNumber(v || 0)}
        </span>
      ),
    },
    {
      key: "paymentStatus",
      header: "Payment",
      align: "center" as const,
      render: (v: string) => (
        <Badge variant={paymentVariant[v] || "default"} size="sm">
          {(v || "").toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center" as const,
      render: (v: string) => (
        <Badge variant={statusVariant[v] || "default"} size="sm">
          {(v || "").toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "center" as const,
      render: (_: any, row: any) => (
        <div className="flex items-center justify-center gap-1">
          {companySettings?.cbmsEnabled && !row.cbmsSubmitted && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                useStore.getState().retryCBMS(row.id);
              }}
              className="p-1.5 rounded text-amber-500 hover:text-amber-700 hover:bg-amber-50"
              title="Retry CBMS Sync"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEdit(row);
            }}
            className="p-1.5 rounded text-[#000000] hover:text-[#000000] hover:bg-[#D4EABD]"
            title="View / Edit"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrint(row);
            }}
            className="p-1.5 rounded text-[#000000] hover:text-[#1557b0] hover:bg-indigo-50"
            title="Print"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fadeIn text-xs select-none">
      {/* Header */}
      <ActionToolbar
        title="Billing & Invoicing"
        subtitle="Manage sales and purchase invoices"
        primaryAction={{
          label: `New ${TAB_META[tab].label}`,
          onClick: openNew,
          icon: <Plus className="h-4 w-4" />,
        }}
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[#9DC07A]">
        {(Object.keys(TAB_META) as TabKey[]).map((k) => {
          const m = TAB_META[k];
          const count = invoices.filter((i) => i.type === m.vt).length;
          const active = tab === k;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={
                active
                  ? "px-4 py-2 text-[12px] font-medium border-b-2 border-[#1557b0] text-[#1557b0] bg-white -mb-px transition-colors"
                  : "px-4 py-2 text-[12px] font-medium border-b-2 border-transparent text-[#000000] hover:text-[#000000] bg-white -mb-px transition-colors"
              }
            >
              {m.label}
              <span
                className={`ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-medium ${active ? "bg-[#3D6B25]/10 text-[#1557b0]" : "bg-[#EBF5E2] text-[#000000]"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-[#9DC07A] rounded-md mb-3 no-print">
        <span className="text-[11px] text-[#000000]">From Date</span>
        <div className="w-32">
          <NepaliDatePicker value={fromDate} onChange={setFromDate} />
        </div>
        <span className="text-[11px] text-[#000000]">To Date</span>
        <div className="w-32">
          <NepaliDatePicker value={toDate} onChange={setToDate} />
        </div>
        <span className="text-[11px] text-[#000000]">Party</span>
        <div className="w-48">
          <PartySelect value={partyId} onChange={setPartyId} placeholder="All parties" />
        </div>
        <span className="text-[11px] text-[#000000]">Payment Status</span>
        <div className="w-32">
          <Select
            options={[
              { value: "ALL", label: "All" },
              { value: PaymentStatus.PAID, label: "Paid" },
              { value: PaymentStatus.PARTIAL, label: "Partial" },
              { value: PaymentStatus.UNPAID, label: "Unpaid" },
            ]}
            value={paymentFilter}
            onChange={setPaymentFilter}
          />
        </div>
      </div>

      <SearchableTable
        columns={columns}
        data={filtered}
        searchFields={["invoiceNo", "partyName", "referenceNo", "narration"]}
        rowKey="id"
        onRowClick={openEdit}
        emptyMessage={`No ${meta.label.toLowerCase()} found.`}
        placeholder="Search invoice no, party or reference…"
        stickyHeader
      />
    </div>
  );
};

export default BillingInvoice;

