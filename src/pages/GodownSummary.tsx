// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const GodownSummary: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("godown-summary");

  const { stockMovements, items, warehouses, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [asOnDate, setAsOnDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [showZeroQty, setShowZeroQty] = useState(false);
  const [expandedWarehouses, setExpandedWarehouses] = useState<Map<string, boolean>>(new Map());

  // Pending states for options modal
  const [pendingAsOnDate, setPendingAsOnDate] = useState(asOnDate);
  const [pendingSelectedWarehouseId, setPendingSelectedWarehouseId] = useState(selectedWarehouseId);
  const [pendingSelectedItemId, setPendingSelectedItemId] = useState(selectedItemId);
  const [pendingShowZeroQty, setPendingShowZeroQty] = useState(showZeroQty);

  const applyOptions = () => {
    setAsOnDate(pendingAsOnDate);
    setSelectedWarehouseId(pendingSelectedWarehouseId);
    setSelectedItemId(pendingSelectedItemId);
    setShowZeroQty(pendingShowZeroQty);
    setOptionsOpen(false);
  };

  // Initialize expanded state for all warehouses
  React.useEffect(() => {
    if (warehouses) {
      const initialExpanded = new Map<string, boolean>();
      warehouses.forEach((wh) => initialExpanded.set(wh.id, true));
      setExpandedWarehouses(initialExpanded);
    }
  }, [warehouses]);

  // Toggle warehouse expansion
  const toggleWarehouse = (warehouseId: string) => {
    setExpandedWarehouses((prev) => {
      const newMap = new Map(prev);
      newMap.set(warehouseId, !newMap.get(warehouseId));
      return newMap;
    });
  };

  // Compute godown summary data
  const summaryData = useMemo(() => {
    if (!warehouses || !items || !stockMovements) return { groupedData: [], grandTotalValue: 0 };

    // Filter movements up to asOnDate
    const filteredMovements = stockMovements.filter((m) => m.date <= asOnDate);

    // Group movements by warehouse and item
    const warehouseItemMap = new Map<
      string,
      Map<string, { qty: number; value: number; totalQty: number; totalValue: number }>
    >();

    filteredMovements.forEach((m) => {
      const whId = m.warehouseId || m.fromWarehouseId || m.toWarehouseId || "default";
      const itemId = m.itemId;

      if (selectedWarehouseId && whId !== selectedWarehouseId) return;

      if (!warehouseItemMap.has(whId)) {
        warehouseItemMap.set(whId, new Map());
      }

      const itemMap = warehouseItemMap.get(whId)!;
      const current = itemMap.get(itemId) || { qty: 0, value: 0, totalQty: 0, totalValue: 0 };

      if (m.type === "in" || m.type === "purchase" || m.type === "production") {
        current.qty += m.qty || 0;
        current.value += (m.qty || 0) * (m.rate || 0);
        current.totalQty += m.qty || 0;
        current.totalValue += (m.qty || 0) * (m.rate || 0);
      } else if (m.type === "out" || m.type === "sales" || m.type === "consumption") {
        current.qty -= m.qty || 0;
        current.value -= (m.qty || 0) * (m.rate || 0);
        current.totalQty += m.qty || 0;
        current.totalValue += (m.qty || 0) * (m.rate || 0);
      }

      itemMap.set(itemId, current);
    });

    // Add opening stock for each item
    items.forEach((item) => {
      const openingQty = item.openingQty || 0;
      const openingRate = item.openingRate || item.rate || 0;
      const openingValue = openingQty * openingRate;

      // Distribute opening stock to default warehouse or all warehouses
      const defaultWhId = "default";
      if (!warehouseItemMap.has(defaultWhId)) {
        warehouseItemMap.set(defaultWhId, new Map());
      }

      const itemMap = warehouseItemMap.get(defaultWhId)!;
      const current = itemMap.get(item.id) || { qty: 0, value: 0, totalQty: 0, totalValue: 0 };
      current.qty += openingQty;
      current.value += openingValue;
      current.totalQty += openingQty;
      current.totalValue += openingValue;
      itemMap.set(item.id, current);
    });

    // Process each warehouse
    const groupedData = [];
    let grandTotalValue = 0;

    for (const [whId, itemMap] of warehouseItemMap.entries()) {
      if (selectedWarehouseId && whId !== selectedWarehouseId) continue;

      const warehouse = warehouses.find((w) => w.id === whId);
      const warehouseName = warehouse?.name || whId;

      // Add warehouse header row
      const isExpanded = expandedWarehouses.get(whId) !== false;
      groupedData.push({
        id: `wh-${whId}`,
        warehouseName,
        isWarehouse: true,
        isExpanded,
      });

      if (isExpanded) {
        let warehouseTotalValue = 0;
        const itemRows = [];

        for (const [itemId, data] of itemMap.entries()) {
          if (selectedItemId && itemId !== selectedItemId) continue;

          const item = items.find((i) => i.id === itemId);
          if (!item) continue;

          if (!showZeroQty && data.qty === 0) continue;

          const avgRate = data.totalQty !== 0 ? data.totalValue / data.totalQty : 0;
          const value = data.qty * avgRate;

          itemRows.push({
            id: `item-${whId}-${itemId}`,
            itemName: item.name,
            unit: item.unit || "N/A",
            qty: data.qty,
            rate: avgRate,
            value,
            isItem: true,
            isNegative: data.qty < 0,
          });

          warehouseTotalValue += value;
        }

        // Add item rows
        groupedData.push(...itemRows);

        // Add warehouse subtotal row
        groupedData.push({
          id: `subtotal-${whId}`,
          itemName: `Subtotal for ${warehouseName}`,
          unit: "",
          qty: "",
          rate: "",
          value: warehouseTotalValue,
          isSubtotal: true,
        });

        grandTotalValue += warehouseTotalValue;
      }
    }

    return { groupedData, grandTotalValue };
  }, [
    warehouses,
    items,
    stockMovements,
    asOnDate,
    selectedWarehouseId,
    selectedItemId,
    showZeroQty,
    expandedWarehouses,
  ]);

  return (
    <ReportShell
      title="Godown Summary"
      subtitle="Stock by warehouse/godown location"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`As on ${asOnDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingAsOnDate(asOnDate);
        setPendingSelectedWarehouseId(selectedWarehouseId);
        setPendingSelectedItemId(selectedItemId);
        setPendingShowZeroQty(showZeroQty);
        setOptionsOpen(true);
      }}
      actionBarButtons={[{ label: "Print" }, { label: "Export" }]}
      toolbarLeft={
        <div className="flex items-center gap-1.5 flex-wrap">
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            As On:
            <input
              type="date"
              value={asOnDate}
              onChange={(e) => setAsOnDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </label>

          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] ml-1 w-[150px]"
          >
            <option value="">All Warehouses</option>
            {(warehouses || []).map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>

          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-[150px]"
          >
            <option value="">All Items</option>
            {(items || []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <label className="text-[12px] font-medium text-gray-700 flex items-center gap-1.5 ml-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showZeroQty}
              onChange={(e) => setShowZeroQty(e.target.checked)}
              className="w-4 h-4 text-[#1557b0] border-gray-300 rounded focus:ring-[#1557b0]"
            />
            Show zero qty
          </label>
        </div>
      }
    >
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-6">
        <table className="w-full text-[12px] border-collapse bg-white">
          <thead className="bg-[#f5f6fa] border-b border-gray-200">
            <tr>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-2/5">
                Item / Stock Item
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Unit
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Quantity
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Avg Rate
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Value
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {summaryData.groupedData.map((row, index) => {
              if (row.isWarehouse) {
                return (
                  <tr
                    key={row.id}
                    className="bg-[#f8fafc] font-semibold text-gray-800 cursor-pointer hover:bg-gray-50 border-y border-gray-200"
                    onClick={() => toggleWarehouse(row.id.replace("wh-", ""))}
                  >
                    <td colSpan={5} className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-[10px] w-4 text-center inline-block">
                          {row.isExpanded ? "▼" : "▶"}
                        </span>
                        <svg
                          className="w-4 h-4 text-[#1557b0]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                        {row.warehouseName}
                      </div>
                    </td>
                  </tr>
                );
              } else if (row.isSubtotal) {
                return (
                  <tr key={row.id} className="bg-gray-50 font-semibold text-gray-700">
                    <td className="px-3 py-2.5 pl-9 text-gray-500 text-[11px] tracking-wide">
                      {row.itemName}
                    </td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5 text-right font-mono text-[#1557b0]">
                      {formatNumber(row.value)}
                    </td>
                  </tr>
                );
              } else if (row.isItem) {
                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-gray-50 transition-colors ${row.isNegative ? "bg-red-50 hover:bg-red-100" : ""}`}
                  >
                    <td className="px-3 py-2.5 pl-9 text-gray-700">
                      {row.isNegative && (
                        <span className="text-red-600 font-bold mr-1" title="Negative Stock">
                          ⚠️
                        </span>
                      )}
                      {row.itemName}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{row.unit}</td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono ${row.isNegative ? "text-red-600 font-semibold" : "text-gray-700"}`}
                    >
                      {formatNumber(row.qty)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-600">
                      {row.rate === 0 ? "—" : formatNumber(row.rate)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono ${row.isNegative ? "text-red-600 font-semibold" : "text-gray-700"}`}
                    >
                      {formatNumber(row.value)}
                    </td>
                  </tr>
                );
              }
              return null;
            })}

            {/* Grand total row */}
            {summaryData.groupedData.length > 0 && (
              <tr className="bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]">
                <td className="px-3 py-3 text-gray-900">GRAND TOTAL</td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3 text-right font-mono text-[#1557b0] text-[14px]">
                  {formatNumber(summaryData.grandTotalValue)}
                </td>
              </tr>
            )}

            {summaryData.groupedData.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-500 italic">
                  No warehouse stock data found for the selected criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ReportOptionsModal
        open={optionsOpen}
        title="Godown Summary Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            As On Date
            <input
              type="date"
              value={pendingAsOnDate}
              onChange={(e) => setPendingAsOnDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Warehouse
            <select
              value={pendingSelectedWarehouseId}
              onChange={(e) => setPendingSelectedWarehouseId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="">All Warehouses</option>
              {(warehouses || []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Item
            <select
              value={pendingSelectedItemId}
              onChange={(e) => setPendingSelectedItemId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="">All Items</option>
              {(items || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-[12px] font-medium text-gray-700 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={pendingShowZeroQty}
              onChange={(e) => setPendingShowZeroQty(e.target.checked)}
              className="w-4 h-4 text-[#1557b0] border-gray-300 rounded focus:ring-[#1557b0]"
            />
            Show zero quantity items
          </label>
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default GodownSummary;
