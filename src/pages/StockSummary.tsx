/**
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stock Summary page with warehouse split and low stock highlights.
 */

import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, Select, Table, NepaliDatePicker, ActionToolbar, Pagination } from "../components/ui";
import { computeAllStockPositions, getLowStockItems } from "../lib/stockUtils";
import { StockValuationMethod } from "../lib/types";
import { formatNumber, dateToAD } from "../lib/utils";
import toast from "react-hot-toast";

const StockSummary: React.FC = () => {
  const { items, stockMovements, warehouses, currentFiscalYear } = useStore();
  const [warehouseId, setWarehouseId] = useState("all");
  const [asOfDate, setAsOfDate] = useState(currentFiscalYear?.endDate || dateToAD(new Date()));
  const [valuationMethod, setValuationMethod] = useState<StockValuationMethod>(
    StockValuationMethod.WEIGHTED_AVERAGE,
  );
  const [groupBy, setGroupBy] = useState<"item" | "category">("item");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [warehouseSplit, setWarehouseSplit] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const warehouseOptions = useMemo(
    () => [
      { value: "all", label: "All Warehouses" },
      ...warehouses.map((wh) => ({ value: wh.id, label: wh.name })),
    ],
    [warehouses],
  );

  const summaryRows = useMemo(() => {
    const warehouseList =
      warehouseId === "all" ? warehouses : warehouses.filter((wh) => wh.id === warehouseId);
    const positions = computeAllStockPositions(stockMovements, items, warehouseList, asOfDate);
    return positions
      .map((row) => ({
        ...row,
        status:
          row.closingQty <= 0
            ? "out"
            : row.closingQty < (items.find((item) => item.id === row.itemId)?.reorderLevel || 0)
              ? "low"
              : "ok",
      }))
      .sort((a, b) => b.closingValue - a.closingValue);
  }, [items, stockMovements, warehouses, warehouseId, asOfDate]);

  const lowStockItems = useMemo(
    () => getLowStockItems(stockMovements, items, warehouses),
    [items, stockMovements, warehouses],
  );

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId),
    [items, selectedItemId],
  );

  const totals = useMemo(
    () => ({
      value: summaryRows.reduce((sum, row) => sum + row.closingValue, 0),
      items: summaryRows.length,
      low: summaryRows.filter((row) => {
        const itemObj = items.find((i) => i.id === row.itemId);
        const reorder = itemObj?.reorderLevel || 0;
        return row.closingQty > 0 && row.closingQty <= reorder;
      }).length,
      out: summaryRows.filter((row) => row.closingQty <= 0).length,
    }),
    [summaryRows, items],
  );

  const paginatedRows = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return summaryRows.slice(startIndex, startIndex + pageSize);
  }, [summaryRows, page, pageSize]);

  const totalPages = Math.ceil(summaryRows.length / pageSize);

  const getStockQtyElement = (qty: number, itemId?: string) => {
    let reorderLevel = 0;
    if (itemId) {
      const item = items.find((i) => i.id === itemId);
      reorderLevel = item?.reorderLevel || 0;
    }

    let className = "text-gray-800";
    if (qty === 0) className = "text-red-600 font-bold";
    else if (qty < reorderLevel) className = "text-amber-600";

    return <span className={className}>{formatNumber(qty)}</span>;
  };

  const columns = [
    { key: "itemCode", header: "Item Code" },
    { key: "itemName", header: "Item Name" },
    { key: "unit", header: "Unit" },
    {
      key: "openingQty",
      header: "Opening Stock",
      align: "right",
      render: (value: number) => formatNumber(value),
    },
    {
      key: "inQty",
      header: "Purchases Qty",
      align: "right",
      render: (value: number) => formatNumber(value),
    },
    {
      key: "outQty",
      header: "Sales Qty",
      align: "right",
      render: (value: number) => formatNumber(value),
    },
    {
      key: "closingQty",
      header: "Closing Qty",
      align: "right",
      render: (value: number, row: any) => getStockQtyElement(value, row.itemId),
    },
    {
      key: "closingRate",
      header: "Rate",
      align: "right",
      render: (value: number) => formatNumber(value),
    },
    {
      key: "closingValue",
      header: "Closing Value",
      align: "right",
      render: (value: number) => formatNumber(value),
    },
  ];

  const handleExport = () => {
    toast("Export not implemented yet.");
  };

  return (
    <div className="flex flex-col gap-4 animate-fadeIn pb-4 text-xs select-none">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Stock Summary</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Current stock positions by warehouse</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            Export Excel
          </Button>
        </div>
      </div>

      <Card border padding="md" className="no-print">
        <div className="grid gap-4 xl:grid-cols-4">
          <Select
            label="Warehouse"
            value={warehouseId}
            onChange={setWarehouseId}
            options={warehouseOptions}
          />
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
          <div className="flex items-end gap-3">
            <Button
              variant={warehouseSplit ? "primary" : "outline"}
              size="sm"
              onClick={() => setWarehouseSplit(!warehouseSplit)}
            >
              {warehouseSplit ? "Hide Warehouse Split" : "Show Warehouse Split"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        {[
          { label: "Total Items", value: totals.items, color: "var(--color-accent)" },
          { label: "Total Stock Value", value: `Rs. ${formatNumber(totals.value)}`, color: "var(--color-positive)" },
          { label: "Low Stock Items", value: totals.low, color: "#b45309" },
          { label: "Out of Stock", value: totals.out, color: "var(--color-negative)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border rounded-lg p-3" style={{ borderColor: "var(--border)" }}>
            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</div>
            <div className="text-[16px] font-bold text-gray-800 mt-0.5" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border rounded-lg overflow-hidden animate-fadeIn" style={{ borderColor: "var(--border)" }}>
        <table className="data-table">
          <thead>
            <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Item Code</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Item Name</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Unit</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Opening Stock</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Purchases Qty</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Sales Qty</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Closing Qty</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Rate</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Closing Value</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-gray-500">
                  No stock summary records available.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => {
                const itemObj = items.find((i) => i.id === row.itemId);
                const reorder = itemObj?.reorderLevel || 0;
                const isLow = row.closingQty > 0 && row.closingQty <= reorder;
                const isOut = row.closingQty <= 0;
                const bgStyle = isOut ? { background: "#fef2f2" } : isLow ? { background: "#fff7ed" } : undefined;
                return (
                  <tr key={row.itemId} style={bgStyle} className="hover:bg-[#e8eeff]">
                    <td className="px-3 py-[7px] text-[12px] text-gray-700 font-bold">{row.itemCode}</td>
                    <td className="px-3 py-[7px] text-[12px] text-gray-700">{row.itemName}</td>
                    <td className="px-3 py-[7px] text-[12px] text-gray-700">{row.unit}</td>
                    <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">{formatNumber(row.openingQty)}</td>
                    <td className="px-3 py-[7px] text-[12px] text-right font-mono amt amt-positive">{formatNumber(row.inQty)}</td>
                    <td className="px-3 py-[7px] text-[12px] text-right font-mono amt amt-negative">{formatNumber(row.outQty)}</td>
                    <td className="px-3 py-[7px] text-[12px] text-right font-mono amt font-bold">
                      <div className="flex items-center justify-end gap-1.5">
                        {isOut ? (
                          <span className="badge badge-neutral">OUT</span>
                        ) : isLow ? (
                          <span className="badge badge-neutral">LOW</span>
                        ) : null}
                        <span>{formatNumber(row.closingQty)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">Rs. {formatNumber(row.closingRate)}</td>
                    <td className="px-3 py-[7px] text-[12px] text-right font-mono amt font-bold" style={{ color: "var(--primary)" }}>Rs. {formatNumber(row.closingValue)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot className="bg-[#eef1f8] border-t-2 border-[#c5cad8] font-bold">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-[12px] text-gray-700">Total</td>
              <td colSpan={5} />
              <td className="px-3 py-2 text-[12px] text-right font-mono amt font-bold" style={{ color: "var(--primary)" }}>Rs. {formatNumber(totals.value)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        totalRecords={summaryRows.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />
    </div>
  );
};

export default StockSummary;
