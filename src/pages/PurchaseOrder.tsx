// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Purchase Order register — list + new + edit.
 */

import { DualDate } from "../components/ui/DualDate";
import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Badge, Button, Select, SearchableTable, ActionToolbar } from "../components/ui";
import { Plus, ClipboardList } from "lucide-react";
import { formatNumber } from "../lib/utils";
import OrderForm, { loadOrders, OrderRecord } from "../components/order/OrderForm";

const getStatusBadge = (status: string) => {
  const val = (status || "").toLowerCase();
  switch (val) {
    case "draft":
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded bg-[#EBF5E2] text-[#000000]">
          Draft
        </span>
      );
    case "approved":
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded bg-[#D4EABD] text-[#000000]">
          Approved
        </span>
      );
    case "fulfilled":
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded bg-green-100 text-green-700">
          Fulfilled
        </span>
      );
    case "partial":
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-700">
          Partial
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded bg-red-100 text-red-700">
          Cancelled
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded bg-[#EBF5E2] text-[#000000]">
          {status}
        </span>
      );
  }
};

const STATUS_VARIANT: Record<string, string> = {
  draft: "default",
  approved: "success",
  fulfilled: "success",
  partial: "warning",
  cancelled: "danger",
};

const PurchaseOrder: React.FC = () => {
  const { parties, companySettings, invoices } = useStore();
  const symbol = companySettings?.currencySymbol || "Rs.";

  const [mode, setMode] = useState<"list" | "new" | "edit">("list");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>(() => loadOrders());
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    (window as any).__sutraParties = parties;
  }, [parties]);

  const refresh = () => setOrders(loadOrders());

  const enriched = useMemo(() => {
    return orders
      .filter((o) => o.type === "purchase")
      .map((o) => {
        const linked = invoices.filter(
          (i: any) => i.orderRef === o.orderNo && i.status === "posted",
        );
        const billed = linked.reduce((s: number, i: any) => s + (Number(i.grandTotal) || 0), 0);
        const pct = o.grandTotal > 0 ? Math.min(100, Math.round((billed / o.grandTotal) * 100)) : 0;
        let status = o.status;
        if (status !== "cancelled" && pct >= 100) status = "fulfilled";
        else if (status !== "cancelled" && pct > 0) status = "partial";
        return {
          ...o,
          fulfilledPercent: pct,
          fulfilledInvoiceIds: linked.map((i: any) => i.id),
          status,
        };
      })
      .filter((o) => statusFilter === "ALL" || o.status === statusFilter)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [orders, invoices, statusFilter]);

  if (mode === "new" || mode === "edit") {
    return (
      <OrderForm
        type="purchase"
        orderId={mode === "edit" ? activeId! : undefined}
        onSave={() => {
          refresh();
          setMode("list");
          setActiveId(null);
        }}
        onCancel={() => {
          setMode("list");
          setActiveId(null);
        }}
      />
    );
  }

  const columns = [
    {
      key: "orderNo",
      header: "Order No",
      render: (v: string) => <span className="font-mono font-bold text-[#000000]">{v}</span>,
    },
    {
      key: "date",
      header: "Date",
      render: (_: any, row: any) => (
        <DualDate date={row.date || row.adDate} dateNepali={row.dateNepali || row.bsDate} />
      ),
    },
    { key: "expectedDate", header: "Expected", render: (v: string) => v || "—" },
    {
      key: "partyId",
      header: "Supplier",
      render: (v: string) => parties.find((p: any) => p.id === v)?.name || "—",
    },
    {
      key: "grandTotal",
      header: "Total",
      align: "right",
      render: (v: number) => `${symbol} ${formatNumber(v)}`,
    },
    {
      key: "fulfilledPercent",
      header: "Fulfilled",
      align: "right",
      render: (v: number) => `${v || 0}%`,
    },
    { key: "status", header: "Status", render: (v: string) => getStatusBadge(v) },
  ];

  return (
    <div className="flex flex-col gap-5 animate-fadeIn text-xs">
      <ActionToolbar title="Purchase Orders" subtitle="Vendor orders and goods receipt" />

      <div className="flex items-center justify-end gap-2 border-b border-[#9DC07A] pb-4">
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "ALL", label: "All Statuses" },
            { value: "draft", label: "Draft" },
            { value: "approved", label: "Approved" },
            { value: "partial", label: "Partial" },
            { value: "fulfilled", label: "Fulfilled" },
            { value: "cancelled", label: "Cancelled" },
          ]}
          compact
        />
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            setActiveId(null);
            setMode("new");
          }}
        >
          New Purchase Order
        </Button>
      </div>

      <Card border padding="none">
        <SearchableTable
          columns={columns as any}
          data={enriched}
          searchFields={["orderNo", "reference"]}
          emptyMessage="No purchase orders yet."
          onRowClick={(row: any) => {
            setActiveId(row.id);
            setMode("edit");
          }}
        />
      </Card>
    </div>
  );
};

export default PurchaseOrder;
