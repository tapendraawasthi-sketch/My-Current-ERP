// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Inventory report page with valuation comparison, batch tracking, and reorder alerts.
 */

import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, Select, Table, NepaliDatePicker, ActionToolbar } from "../components/ui";
import {
  computeAllStockPositions,
  getLowStockItems,
  getStockValuationSummary,
} from "../lib/stockUtils";
import { StockValuationMethod } from "../lib/types";
import { formatNumber, dateToAD } from "../lib/utils";
import toast from "react-hot-toast";

const InventoryReport: React.FC = () => {
  const { items, stockMovements, warehouses, currentFiscalYear } = useStore();
  const [activeTab, setActiveTab] = useState<"valuation" | "batch" | "reorder">("valuation");
  const [asOfDate, setAsOfDate] = useState(currentFiscalYear?.endDate || dateToAD(new Date()));
  const [valuationMethod, setValuationMethod] = useState<StockValuationMethod>(
    StockValuationMethod.WEIGHTED_AVERAGE,
  );

  const valuationRows = useMemo(() => {
    if (activeTab !== "valuation") return [];
    return getStockValuationSummary(stockMovements, items, warehouses, valuationMethod, asOfDate);
  }, [activeTab, stockMovements, items, warehouses, valuationMethod, asOfDate]);

  const reorderRows = useMemo(() => {
    return getLowStockItems(stockMovements, items, warehouses).map((item) => ({
      ...item,
      reorderLevel: item.reorderLevel || 0,
    }));
  }, [stockMovements, items, warehouses]);

  const batchRows = useMemo(() => {
    return [];
  }, []);

  const getStockQtyElement = (qty: number, itemId?: string, rowReorderLevel?: number) => {
    let reorderLevel = rowReorderLevel;
    if (reorderLevel === undefined && itemId) {
      const item = items.find((i) => i.id === itemId);
      reorderLevel = item?.reorderLevel || 0;
    }
    reorderLevel = reorderLevel || 0;

    let className = "text-gray-800";
    if (qty === 0) className = "text-red-600 font-bold";
    else if (qty < reorderLevel) className = "text-amber-600";

    return <span className={className}>{formatNumber(qty)}</span>;
  };

  const valuationColumns = [
    { key: "itemName", header: "Item Name" },
    {
      key: "qty",
      header: "Qty",
      align: "right",
      render: (value: number, row: any) => getStockQtyElement(value, row.itemId),
    },
    { key: "rate", header: "Rate", align: "right", render: (value: number) => formatNumber(value) },
    {
      key: "value",
      header: "Value",
      align: "right",
      render: (value: number) => formatNumber(value),
    },
  ];

  const reorderColumns = [
    { key: "code", header: "Item Code" },
    { key: "name", header: "Item Name" },
    { key: "warehouseName", header: "Warehouse" },
    {
      key: "currentStock",
      header: "Current Stock",
      align: "right",
      render: (value: number, row: any) => getStockQtyElement(value, undefined, row.reorderLevel),
    },
    {
      key: "reorderLevel",
      header: "Reorder Level",
      align: "right",
      render: (value: number) => formatNumber(value),
    },
  ];

  const handleExport = () => {
    toast("Export not implemented yet for Inventory Report.");
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none text-xs">
      <ActionToolbar title="Inventory Report" subtitle="Item-wise stock movements" />
      <div className="flex flex-wrap justify-end gap-2 border-b border-gray-200 pb-5">
        <Button variant="outline" size="sm" onClick={handleExport}>
          Export
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-xs font-bold ${activeTab === "valuation" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          onClick={() => setActiveTab("valuation")}
        >
          Stock Valuation
        </button>
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-xs font-bold ${activeTab === "batch" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          onClick={() => setActiveTab("batch")}
        >
          Batch Tracking
        </button>
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-xs font-bold ${activeTab === "reorder" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          onClick={() => setActiveTab("reorder")}
        >
          Reorder Report
        </button>
      </div>

      <Card border padding="md">
        <div className="grid gap-4 xl:grid-cols-3">
          <NepaliDatePicker label="As of Date" value={asOfDate} onChange={setAsOfDate} />
          <Select
            label="Valuation Method"
            value={valuationMethod}
            onChange={(value) => setValuationMethod(value as StockValuationMethod)}
            options={[
              { value: StockValuationMethod.WEIGHTED_AVERAGE, label: "Weighted Average" },
              { value: StockValuationMethod.FIFO, label: "FIFO" },
            ]}
          />
          <div className="flex items-end">
            <Button variant="secondary" size="sm" onClick={() => setActiveTab("valuation")}>
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {activeTab === "valuation" && (
        <Card border padding="md">
          <Table
            columns={valuationColumns}
            data={valuationRows}
            rowKey={(row) => row.itemId}
            emptyMessage="No valuation rows available."
            stickyHeader
          />
        </Card>
      )}

      {activeTab === "batch" && (
        <Card border padding="md" className="text-center text-slate-500">
          <div className="py-10">Batch tracking is not enabled or no batch data available.</div>
        </Card>
      )}

      {activeTab === "reorder" && (
        <Card border padding="md">
          <Table
            columns={reorderColumns}
            data={reorderRows}
            rowKey={(row) => `${row.id}-${row.warehouseId}`}
            emptyMessage="No items below reorder level."
            stickyHeader
          />
        </Card>
      )}
    </div>
  );
};

export default InventoryReport;

