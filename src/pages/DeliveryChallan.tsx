// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Delivery Challan page with list view and new/edit form.
 */

import React, { useMemo, useState } from "react";
import { ActionToolbar } from "../components/ui";
import { useStore } from "../store/useStore";
import { Card, Badge, Button, SearchableTable } from "../components/ui";
import { Plus, Truck } from "lucide-react";
import ChallanForm from "../components/delivery/ChallanForm";

const STATUS_VARIANT: Record<string, string> = {
  draft: "default",
  dispatched: "success",
  received: "success",
  invoiced: "secondary",
  cancelled: "danger",
};

const DeliveryChallan: React.FC = () => {
  const { deliveryChallans, parties, setCurrentPage } = useStore();
  const [mode, setMode] = useState<"list" | "new" | "edit">("list");
  const [activeId, setActiveId] = useState<string | null>(null);

  const rows = useMemo(() => {
    return [...deliveryChallans].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [deliveryChallans]);

  if (mode !== "list") {
    return (
      <ChallanForm
        type="challan"
        id={mode === "edit" ? activeId || undefined : undefined}
        onSave={() => {
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
      key: "challanNo",
      header: "Challan No",
      render: (v: string) => <span className="font-mono font-bold text-slate-700">{v}</span>,
    },
    { key: "date", header: "Date", render: (_: any, row: any) => <DualDate date={row.date || row.adDate} dateNepali={row.dateNepali || row.bsDate} /> },
    { key: "partyName", header: "Customer" },
    { key: "salesOrderId", header: "Sales Order", render: (val: string) => val || "—" },
    { key: "totalQty", header: "Qty", align: "right" },
    {
      key: "status",
      header: "Status",
      render: (v: string) => (
        <Badge variant={(STATUS_VARIANT[v] as any) || "default"} size="sm">
          {(v || "").toUpperCase()}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5 animate-fadeIn text-xs">
      <ActionToolbar title="Delivery Challan" subtitle="Goods delivery notes" />
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Truck className="h-5 w-5 text-[#1557b0]" /> Delivery Challans
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wider font-bold">
            Outgoing goods before invoicing
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setMode("new")}
        >
          New Challan
        </Button>
      </div>

      <Card border padding="none">
        <SearchableTable
          columns={columns as any}
          data={rows}
          rowKey="id"
          searchFields={["challanNo", "partyName", "salesOrderId"]}
          emptyMessage="No delivery challans available."
          onRowClick={(row: any) => {
            setActiveId(row.id);
            setMode("edit");
          }}
          placeholder="Search challan no, customer or sales order…"
        />
      </Card>
    </div>
  );
};

export default DeliveryChallan;

