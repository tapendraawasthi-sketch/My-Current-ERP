// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const StockItemReport: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("stock-item-report");

  const { items, stockMovements, warehouses, companySettings, currentFiscalYear } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [valuationMethod, setValuationMethod] = useState<"weighted-average" | "fifo">(
    "weighted-average",
  );

  // Pending states for options modal
  const [pendingSelectedItemId, setPendingSelectedItemId] = useState(selectedItemId);
  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);
  const [pendingSelectedWarehouseId, setPendingSelectedWarehouseId] = useState(selectedWarehouseId);
  const [pendingValuationMethod, setPendingValuationMethod] = useState(valuationMethod);

  const applyOptions = () => {
    setSelectedItemId(pendingSelectedItemId);
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
    setSelectedWarehouseId(pendingSelectedWarehouseId);
    setValuationMethod(pendingValuationMethod);
    setOptionsOpen(false);
  };

  // Set default item if not selected
  React.useEffect(() => {
    if (!selectedItemId && items.length > 0) {
      setSelectedItemId(items[0].id);
      setPendingSelectedItemId(items[0].id);
    }
  }, [selectedItemId, items]);

  // Compute stock item report data
  const reportData = useMemo(() => {
    if (!selectedItemId || !stockMovements) return { rows: [], summary: {} };

    const selectedItem = items.find((item) => item.id === selectedItemId);
    if (!selectedItem) return { rows: [], summary: {} };

    let result = [];
    let runningBalance = selectedItem.openingQty || 0;
    let totalInwardQty = 0;
    let totalOutwardQty = 0;

    // Add opening balance row
    result.push({
      id: "opening",
      date: startDate,
      particulars: "Opening Stock",
      voucherNo: "",
      inwardQty: selectedItem.openingQty || 0,
      outwardQty: 0,
      rate: selectedItem.openingRate || selectedItem.rate || 0,
      value: (selectedItem.openingQty || 0) * (selectedItem.openingRate || selectedItem.rate || 0),
      balanceQty: runningBalance,
      isOpening: true,
    });

    totalInwardQty = selectedItem.openingQty || 0;

    // Filter movements for this item and date range
    let filteredMovements = (stockMovements || []).filter(
      (m) => m.itemId === selectedItemId && m.date >= startDate && m.date <= endDate,
    );

    // Apply warehouse filter if specified
    if (selectedWarehouseId) {
      filteredMovements = filteredMovements.filter((m) => m.warehouseId === selectedWarehouseId);
    }

    // Sort by date
    filteredMovements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Process each movement
    filteredMovements.forEach((movement) => {
      // Determine type label based on voucher number prefix
      let typeLabel = movement.type === "in" ? "Stock In" : "Stock Out";
      if (movement.voucherNo) {
        if (movement.voucherNo.startsWith("SI")) typeLabel = "Sales";
        else if (movement.voucherNo.startsWith("PI")) typeLabel = "Purchase";
        else if (movement.voucherNo.startsWith("SJ")) typeLabel = "Stock Transfer";
        else if (movement.voucherNo.startsWith("MI")) typeLabel = "Material Issued";
        else if (movement.voucherNo.startsWith("MR")) typeLabel = "Material Received";
      }

      // Update running balance
      if (movement.type === "in") {
        runningBalance += movement.qty || 0;
        totalInwardQty += movement.qty || 0;
      } else {
        runningBalance -= movement.qty || 0;
        totalOutwardQty += movement.qty || 0;
      }

      result.push({
        id: movement.id,
        date: movement.date,
        particulars: `${movement.voucherNo || "N/A"} — ${typeLabel}`,
        voucherNo: movement.voucherNo || "N/A",
        inwardQty: movement.type === "in" ? movement.qty || 0 : 0,
        outwardQty: movement.type === "out" ? movement.qty || 0 : 0,
        rate: movement.rate || 0,
        value: (movement.qty || 0) * (movement.rate || 0),
        balanceQty: runningBalance,
      });
    });

    // Add closing balance row
    result.push({
      id: "closing",
      date: "",
      particulars: "Closing Stock",
      voucherNo: "",
      inwardQty: "",
      outwardQty: "",
      rate:
        runningBalance > 0
          ? (result.reduce((sum, r) => sum + r.value, 0) - result[0].value) / runningBalance
          : 0,
      value: "",
      balanceQty: runningBalance,
      isClosing: true,
    });

    // Calculate summary
    const closingValue = result.reduce((sum, r) => sum + r.value, 0) - result[0].value;
    const summary = {
      totalInwardQty,
      totalOutwardQty,
      closingQty: runningBalance,
      closingValue,
    };

    return {
      rows: result,
      summary,
    };
  }, [selectedItemId, stockMovements, items, startDate, endDate, selectedWarehouseId]);

  // Determine if negative stock warning is needed
  const hasNegativeStock = reportData.summary.closingQty < 0;

  // Get all warehouses for filter
  const allWarehouses = useMemo(
    () => [{ id: "", name: "All Warehouses" }, ...(warehouses || [])],
    [warehouses],
  );

  const renderCell = (columnKey: string, value: any, row: any) => {
    if (row.isOpening || row.isClosing) {
      if (columnKey === "particulars") {
        return <span className="font-bold text-gray-800">{value}</span>;
      }
      if (
        ["inwardQty", "outwardQty", "rate", "value", "balanceQty"].includes(columnKey) &&
        value !== ""
      ) {
        return <span className="font-bold font-mono text-gray-800">{formatNumber(value)}</span>;
      }
      return value;
    }

    if (["inwardQty", "outwardQty", "rate", "value", "balanceQty"].includes(columnKey)) {
      if (value === 0 || value === "") return "";
      return (
        <span
          className={`font-mono ${columnKey === "balanceQty" && value < 0 ? "text-red-600 font-semibold" : ""}`}
        >
          {formatNumber(value)}
        </span>
      );
    }

    if (columnKey === "particulars") {
      const parts = value.split(" — ");
      if (parts.length === 2) {
        return (
          <span>
            {parts[0]} <span className="text-[11px] text-gray-500 italic ml-1">— {parts[1]}</span>
          </span>
        );
      }
    }

    return value;
  };

  return (
    <ReportShell
      title="Stock Item Report"
      subtitle="Detailed movement history for selected item"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingSelectedItemId(selectedItemId);
        setPendingStart(startDate);
        setPendingEnd(endDate);
        setPendingSelectedWarehouseId(selectedWarehouseId);
        setPendingValuationMethod(valuationMethod);
        setOptionsOpen(true);
      }}
      actionBarButtons={[{ label: "Print" }, { label: "Export" }]}
      toolbarLeft={
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            Item:
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-[180px]"
            >
              {(items || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5 ml-1">
            From:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </label>

          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            To:
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </label>

          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5 ml-1">
            Whouse:
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-[150px]"
            >
              {allWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
    >
      {/* Negative stock warning */}
      {hasNegativeStock && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 mb-4 rounded-md flex items-center gap-2 font-bold text-[12px]">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          NEGATIVE STOCK — Closing balance is negative. Please verify transactions.
        </div>
      )}

      {/* Summary section */}
      <div className="grid grid-cols-4 gap-4 text-[12px] mb-4">
        <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm flex flex-col justify-center">
          <div className="text-[10px] font-semibold text-gray-500 tracking-wide mb-1">
            Total Inward Qty
          </div>
          <div className="text-[16px] font-mono font-bold text-[#1557b0]">
            {formatNumber(reportData.summary.totalInwardQty)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm flex flex-col justify-center">
          <div className="text-[10px] font-semibold text-gray-500 tracking-wide mb-1">
            Total Outward Qty
          </div>
          <div className="text-[16px] font-mono font-bold text-[#d97706]">
            {formatNumber(reportData.summary.totalOutwardQty)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm flex flex-col justify-center">
          <div className="text-[10px] font-semibold text-gray-500 tracking-wide mb-1">
            Closing Stock Qty
          </div>
          <div
            className={`text-[16px] font-mono font-bold ${reportData.summary.closingQty < 0 ? "text-red-600" : "text-[#059669]"}`}
          >
            {formatNumber(reportData.summary.closingQty)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm flex flex-col justify-center">
          <div className="text-[10px] font-semibold text-gray-500 tracking-wide mb-1">
            Closing Stock Value
          </div>
          <div className="text-[16px] font-mono font-bold text-gray-800">
            Rs. {formatNumber(reportData.summary.closingValue)}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-6">
        <ReportGrid
          columns={[
            { key: "date", label: "Date" },
            { key: "particulars", label: "Particulars" },
            { key: "voucherNo", label: "Vch No" },
            { key: "inwardQty", label: "Inward Qty", align: "right" },
            { key: "outwardQty", label: "Outward Qty", align: "right" },
            { key: "rate", label: "Rate", align: "right" },
            { key: "value", label: "Value", align: "right" },
            { key: "balanceQty", label: "Balance", align: "right" },
          ]}
          data={reportData.rows}
          getRowClassName={(row) => {
            if (row.isOpening) return "bg-[#f8fafc] border-b border-gray-200";
            if (row.isClosing) return "bg-[#eef2ff] border-t-2 border-[#c7d2fe]";
            return "";
          }}
          renderCell={renderCell}
        />
      </div>

      <ReportOptionsModal
        open={optionsOpen}
        title="Stock Item Report Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Stock Item
            <select
              value={pendingSelectedItemId}
              onChange={(e) => setPendingSelectedItemId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              {(items || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            From Date
            <input
              type="date"
              value={pendingStart}
              onChange={(e) => setPendingStart(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            To Date
            <input
              type="date"
              value={pendingEnd}
              onChange={(e) => setPendingEnd(e.target.value)}
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
              {allWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Valuation Method
            <select
              value={pendingValuationMethod}
              onChange={(e) =>
                setPendingValuationMethod(e.target.value as "weighted-average" | "fifo")
              }
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="weighted-average">Weighted Average</option>
              <option value="fifo">FIFO</option>
            </select>
          </label>
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default StockItemReport;
