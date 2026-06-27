// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const StockSummary: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("stock-summary");
  
  const { items, stockMovements, companySettings, currentFiscalYear, itemGroups } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [showZeroStock, setShowZeroStock] = useState(false);
  const [valuationMethod, setValuationMethod] = useState<"weighted-average" | "fifo">("weighted-average");
  
  // Pending states for options modal
  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);
  const [pendingSelectedGroupId, setPendingSelectedGroupId] = useState(selectedGroupId);
  const [pendingShowZeroStock, setPendingShowZeroStock] = useState(showZeroStock);
  const [pendingValuationMethod, setPendingValuationMethod] = useState(valuationMethod);

  const applyOptions = () => {
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
    setSelectedGroupId(pendingSelectedGroupId);
    setShowZeroStock(pendingShowZeroStock);
    setValuationMethod(pendingValuationMethod);
    setOptionsOpen(false);
  };

  // Get unique groups for dropdown
  const groups = useMemo(() => {
    return (itemGroups || []).map(group => ({ id: group.id, name: group.name }));
  }, [itemGroups]);

  // Compute stock summary data
  const summaryData = useMemo(() => {
    if (!items || !stockMovements) return { rows: [], totalClosingValue: 0, negativeStockCount: 0, totalItems: 0 };

    const result = [];
    let totalClosingValue = 0;
    let negativeStockCount = 0;
    let totalItems = 0;

    items.forEach(item => {
      // Skip if group filter is applied and item doesn't belong to selected group
      if (selectedGroupId && item.groupId !== selectedGroupId) return;

      // Opening stock
      const openingQty = item.openingQty || 0;
      const openingRate = item.openingRate || item.rate || 0;
      const openingValue = openingQty * openingRate;

      // Filter movements for this item in date range
      const itemMovements = (stockMovements || []).filter(m => 
        m.itemId === item.id && 
        m.date >= startDate && 
        m.date <= endDate
      );

      // Calculate inward movements
      const inwardMovements = itemMovements.filter(m => m.type === "in");
      const inwardQty = inwardMovements.reduce((sum, m) => sum + (m.qty || 0), 0);
      const inwardValue = inwardMovements.reduce((sum, m) => sum + (m.amount || 0), 0);

      // Calculate outward movements
      const outwardMovements = itemMovements.filter(m => m.type === "out");
      const outwardQty = outwardMovements.reduce((sum, m) => sum + (m.qty || 0), 0);
      const outwardValue = outwardMovements.reduce((sum, m) => sum + (m.amount || 0), 0);

      // Calculate closing
      const closingQty = openingQty + inwardQty - outwardQty;

      // Calculate closing value using weighted average
      const totalQtyIn = openingQty + inwardQty;
      const totalValueIn = openingValue + inwardValue;
      const avgRate = totalQtyIn > 0 ? totalValueIn / totalQtyIn : 0;
      const closingValue = closingQty * avgRate;

      // Only show if closing is non-zero or had movements during period
      if (!showZeroStock && closingQty === 0 && inwardQty === 0 && outwardQty === 0) return;

      // Add row to results
      result.push({
        id: item.id,
        item: item.name,
        unit: item.unit || "N/A",
        openingQty,
        openingValue,
        inwardQty,
        inwardValue,
        outwardQty,
        outwardValue,
        closingQty,
        closingRate: avgRate,
        closingValue,
        isNegative: closingQty < 0
      });

      totalItems++;

      if (closingQty < 0) {
        negativeStockCount++;
      }

      totalClosingValue += closingValue;
    });

    if (result.length > 0) {
      // Add grand total row
      result.push({
        id: "total",
        item: "GRAND TOTAL",
        unit: "",
        openingQty: result.reduce((sum, r) => sum + r.openingQty, 0),
        openingValue: result.reduce((sum, r) => sum + r.openingValue, 0),
        inwardQty: result.reduce((sum, r) => sum + r.inwardQty, 0),
        inwardValue: result.reduce((sum, r) => sum + r.inwardValue, 0),
        outwardQty: result.reduce((sum, r) => sum + r.outwardQty, 0),
        outwardValue: result.reduce((sum, r) => sum + r.outwardValue, 0),
        closingQty: result.reduce((sum, r) => sum + r.closingQty, 0),
        closingRate: 0,
        closingValue: totalClosingValue,
        isTotal: true
      });
    }

    return {
      rows: result,
      totalClosingValue,
      negativeStockCount,
      totalItems
    };
  }, [items, stockMovements, startDate, endDate, selectedGroupId, showZeroStock]);

  // Summary stats
  const summaryStats = {
    totalClosingValue: summaryData.totalClosingValue,
    negativeStockCount: summaryData.negativeStockCount,
    totalItems: summaryData.totalItems
  };

  const columns = [
    { key: "item", label: "Item Name" },
    { key: "unit", label: "Unit" },
    { key: "openingQty", label: "Opening Qty", align: "right" },
    { key: "openingValue", label: "Opening Value", align: "right" },
    { key: "inwardQty", label: "Inward Qty", align: "right" },
    { key: "inwardValue", label: "Inward Value", align: "right" },
    { key: "outwardQty", label: "Outward Qty", align: "right" },
    { key: "outwardValue", label: "Outward Value", align: "right" },
    { key: "closingQty", label: "Closing Qty", align: "right" },
    { key: "closingRate", label: "Avg Rate", align: "right" },
    { key: "closingValue", label: "Closing Value", align: "right" }
  ];

  const renderCell = (columnKey: string, value: any, row: any) => {
    if (row.isTotal) {
      if (columnKey === "item") {
        return <span className="font-bold text-gray-800">{value}</span>;
      }
      if (["openingQty", "openingValue", "inwardQty", "inwardValue", "outwardQty", "outwardValue", "closingQty", "closingValue"].includes(columnKey)) {
        return <span className="font-bold font-mono text-gray-800">{formatNumber(value)}</span>;
      }
      return "";
    }

    if (columnKey === "item") {
      return (
        <span className="flex items-center gap-1.5">
          {row.isNegative && <span className="text-red-600 font-bold" title="Negative Stock">⚠️</span>}
          {value}
        </span>
      );
    }

    if (["openingQty", "openingValue", "inwardQty", "inwardValue", "outwardQty", "outwardValue", "closingQty", "closingRate", "closingValue"].includes(columnKey)) {
      return (
        <span className={`font-mono ${row.isNegative && ["closingQty", "closingValue"].includes(columnKey) ? "text-red-600 font-semibold" : ""}`}>
          {formatNumber(value)}
        </span>
      );
    }

    return value;
  };

  return (
    <ReportShell
      title="Stock Summary"
      subtitle="Inventory valuation and movement summary"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingStart(startDate);
        setPendingEnd(endDate);
        setPendingSelectedGroupId(selectedGroupId);
        setPendingShowZeroStock(showZeroStock);
        setPendingValuationMethod(valuationMethod);
        setOptionsOpen(true);
      }}
      actionBarButtons={[
        { label: "Print" },
        { label: "Export to Excel" }
      ]}
      toolbarLeft={
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            From: 
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
            />
          </label>
          
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            To: 
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
            />
          </label>
          
          <select
            value={selectedGroupId}
            onChange={e => setSelectedGroupId(e.target.value)}
            className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-[200px]"
          >
            <option value="">All Item Groups</option>
            {groups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>
      }
    >
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-4 text-[12px]">
        <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm flex flex-col justify-center">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Closing Stock Value</div>
          <div className="text-[14px] font-mono font-bold text-[#1557b0]">Rs. {formatNumber(summaryStats.totalClosingValue)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm flex flex-col justify-center">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Items with Negative Stock</div>
          <div className={`text-[14px] font-mono font-bold ${summaryStats.negativeStockCount > 0 ? "text-red-600" : "text-gray-800"}`}>
            {summaryStats.negativeStockCount}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm flex flex-col justify-center">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Items</div>
          <div className="text-[14px] font-mono font-bold text-gray-800">{summaryStats.totalItems}</div>
        </div>
      </div>
      
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-6">
        <ReportGrid 
          columns={columns} 
          data={summaryData.rows} 
          getRowClassName={(row) => {
            if (row.isTotal) return "bg-[#eef2ff] border-t-2 border-[#c7d2fe]";
            if (row.isNegative) return "bg-red-50 text-red-700 border-red-100 hover:bg-red-100";
            return "";
          }}
          renderCell={renderCell}
        />
      </div>
      
      <ReportOptionsModal
        open={optionsOpen}
        title="Stock Summary Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            From Date 
            <input 
              type="date" 
              value={pendingStart} 
              onChange={e => setPendingStart(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
            />
          </label>
          
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            To Date 
            <input 
              type="date" 
              value={pendingEnd} 
              onChange={e => setPendingEnd(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
            />
          </label>
          
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Item Group 
            <select
              value={pendingSelectedGroupId}
              onChange={e => setPendingSelectedGroupId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="">All Groups</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Valuation Method 
            <select
              value={pendingValuationMethod}
              onChange={e => setPendingValuationMethod(e.target.value as "weighted-average" | "fifo")}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="weighted-average">Weighted Average</option>
              <option value="fifo">FIFO</option>
            </select>
          </label>
          
          <label className="flex items-center gap-2 text-[12px] font-medium text-gray-700 cursor-pointer pt-2">
            <input 
              type="checkbox" 
              checked={pendingShowZeroStock}
              onChange={e => setPendingShowZeroStock(e.target.checked)}
              className="w-4 h-4 text-[#1557b0] border-gray-300 rounded focus:ring-[#1557b0]"
            />
            Show items with zero closing stock
          </label>
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default StockSummary;
