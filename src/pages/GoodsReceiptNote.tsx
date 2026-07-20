// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Goods receipt page with list view and new/edit form.
 */

import { DualDate } from "../components/ui/DualDate";
import React, { useMemo, useState } from "react";
import { ActionToolbar } from "../components/ui";
import { useStore } from "../store/useStore";
import { Card, Badge, Button, SearchableTable } from "../components/ui";
import { Plus, ClipboardList } from "lucide-react";
import ChallanForm from "../components/delivery/ChallanForm";
import { useBranchFilter } from "../hooks/useBranchFilter";

const STATUS_VARIANT: Record<string, string> = {
  draft: "default",
  received: "success",
  invoiced: "secondary",
  cancelled: "danger",
};

const GoodsReceiptNote: React.FC = () => {
  const { goodsReceiptNotes } = useStore();
  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();
  const [mode, setMode] = useState<"list" | "new" | "edit">("list");
  const [activeId, setActiveId] = useState<string | null>(null);

  const rows = useMemo(() => {
    return [...goodsReceiptNotes]
      .filter((r) => matchBranch((r as { branchId?: string }).branchId))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [goodsReceiptNotes, matchBranch, branchFilter]);

  if (mode !== "list") {
    return (
      <ChallanForm
        type="grn"
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
      key: "grnNo",
      header: "GRN No",
      render: (v: string) => <span className="font-mono font-bold text-[var(--ds-action-primary)]">{v}</span>,
    },
    {
      key: "date",
      header: "Date",
      render: (_: any, row: any) => (
        <DualDate date={row.date || row.adDate} dateNepali={row.dateNepali || row.bsDate} />
      ),
    },
    { key: "partyName", header: "Supplier" },
    { key: "purchaseOrderId", header: "Purchase Order", render: (val: string) => val || "—" },
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
      <ActionToolbar title="Goods receipt" subtitle="Received goods from vendors" />
      <div className="flex items-center justify-between border-b border-[var(--ds-action-primary)] pb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--ds-action-primary)] tracking-tight flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[var(--ds-action-primary)]" /> Goods receipts
          </h2>
          <p className="text-[12px] text-[var(--ds-action-primary)] mt-0.5 uppercase tracking-wider font-bold">
            Incoming goods before purchase invoicing
          </p>
        </div>
        <div className="flex items-center gap-2">
          {branchOptions.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              aria-label="Branch"
            >
              <option value="all">All branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.code || b.id}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setMode("new")}
          >
            New GRN
          </Button>
        </div>
      </div>

      <Card border padding="none">
        <SearchableTable
          columns={columns as any}
          data={rows}
          rowKey="id"
          searchFields={["grnNo", "partyName", "purchaseOrderId"]}
          emptyMessage="No goods receipt notes available."
          onRowClick={(row: any) => {
            setActiveId(row.id);
            setMode("edit");
          }}
          placeholder="Search GRN no, supplier or purchase order…"
        />
      </Card>
    </div>
  );
};

export default GoodsReceiptNote;
