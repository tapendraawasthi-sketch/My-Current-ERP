// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const InventoryReport: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("inventory-ageing");

  const { stockMovements, items, itemGroups, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [asOnDate, setAsOnDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [showOnlySlowMoving, setShowOnlySlowMoving] = useState(false);

  // Pending states for options modal
  const [pendingAsOnDate, setPendingAsOnDate] = useState(asOnDate);
  const [pendingSelectedGroupId, setPendingSelectedGroupId] = useState(selectedGroupId);
  const [pendingShowOnlySlowMoving, setPendingShowOnlySlowMoving] = useState(showOnlySlowMoving);

  const applyOptions = () => {
    setAsOnDate(pendingAsOnDate);
    setSelectedGroupId(pendingSelectedGroupId);
    setShowOnlySlowMoving(pendingShowOnlySlowMoving);
    setOptionsOpen(false);
  };

  // Helper function to calculate days between dates
  const daysBetween = (dateString1: string, dateString2: string): number => {
    const date1 = new Date(dateString1);
    const date2 = new Date(dateString2);
    const timeDiff = date2.getTime() - date1.getTime();
    return Math.floor(timeDiff / (1000 * 3600 * 24));
  };

  // Compute inventory report data
  const reportData = useMemo(() => {
    if (!stockMovements || !items)
      return { rows: [], summary: { slowMovingCount: 0, totalSlowValue: 0 } };

    const itemMap = new Map();
    const today = new Date(asOnDate);

    // Initialize all items
    items.forEach((item) => {
      if (selectedGroupId && item.groupId !== selectedGroupId) return;

      itemMap.set(item.id, {
        id: item.id,
        itemName: item.name,
        unit: item.unit || "N/A",
        b0to30: 0,
        b31to60: 0,
        b61to90: 0,
        b90plus: 0,
        totalQty: 0,
        totalValue: 0,
        avgRate: item.rate || 0,
      });
    });

    // Process stock movements
    stockMovements.forEach((movement) => {
      if (movement.type !== "in") return; // Only consider inward movements
      if (movement.date > asOnDate) return; // Ignore future movements

      const itemData = itemMap.get(movement.itemId);
      if (!itemData) return;

      const daysSince = daysBetween(movement.date, asOnDate);
      const qty = movement.qty || 0;
      const value = qty * (movement.rate || 0);

      // Add to appropriate bucket based on age
      if (daysSince <= 30) {
        itemData.b0to30 += qty;
      } else if (daysSince <= 60) {
        itemData.b31to60 += qty;
      } else if (daysSince <= 90) {
        itemData.b61to90 += qty;
      } else {
        itemData.b90plus += qty;
      }

      itemData.totalQty += qty;
      itemData.totalValue += value;
    });

    // Calculate summary
    let slowMovingCount = 0;
    let totalSlowValue = 0;

    // Convert map to array and calculate status
    const rows = Array.from(itemMap.values()).map((itemData) => {
      // Determine status
      let status = "NORMAL";
      if (itemData.b90plus > 0) {
        status = "SLOW MOVING";
        slowMovingCount++;
        totalSlowValue += itemData.totalValue;
      } else if (itemData.totalQty === 0) {
        status = "NIL STOCK";
      }

      return {
        ...itemData,
        status,
      };
    });

    // Filter for slow moving items if option is selected
    const filteredRows = showOnlySlowMoving ? rows.filter((row) => row.b90plus > 0) : rows;

    // Add total row
    if (filteredRows.length > 0) {
      const totalRow = {
        id: "total",
        itemName: "TOTAL",
        unit: "",
        b0to30: filteredRows.reduce((sum, row) => sum + row.b0to30, 0),
        b31to60: filteredRows.reduce((sum, row) => sum + row.b31to60, 0),
        b61to90: filteredRows.reduce((sum, row) => sum + row.b61to90, 0),
        b90plus: filteredRows.reduce((sum, row) => sum + row.b90plus, 0),
        totalQty: filteredRows.reduce((sum, row) => sum + row.totalQty, 0),
        totalValue: filteredRows.reduce((sum, row) => sum + row.totalValue, 0),
        status: "",
        isTotal: true,
      };

      filteredRows.push(totalRow);
    }

    return {
      rows: filteredRows,
      summary: { slowMovingCount, totalSlowValue },
    };
  }, [stockMovements, items, asOnDate, selectedGroupId, showOnlySlowMoving]);

  // Get item groups for filter
  const itemGroupOptions = useMemo(
    () => [{ id: "", name: "All Groups" }, ...(itemGroups || [])],
    [itemGroups],
  );

  const renderCell = (columnKey: string, value: any, row: any) => {
    if (row.isTotal) {
      if (columnKey === "itemName") {
        return <span className="font-bold text-gray-800">TOTAL</span>;
      }
      if (
        ["b0to30", "b31to60", "b61to90", "b90plus", "totalQty", "totalValue"].includes(columnKey)
      ) {
        return <span className="font-bold font-mono text-gray-800">{formatNumber(value)}</span>;
      }
      return "";
    }

    if (["b0to30", "b31to60", "b61to90", "b90plus", "totalQty", "totalValue"].includes(columnKey)) {
      if (value === 0) return "—";

      let colorClass = "text-gray-700";
      // Highlight > 90 days slow moving stock
      if (columnKey === "b90plus") {
        colorClass = "text-[#dc2626] font-semibold"; // Red for very slow moving
      } else if (columnKey === "b61to90") {
        colorClass = "text-[#d97706] font-medium"; // Amber for approaching slow
      }

      return <span className={`font-mono ${colorClass}`}>{formatNumber(value)}</span>;
    }

    if (columnKey === "status") {
      if (!value) return "";

      let bgClass = "bg-green-100 text-green-700"; // NORMAL
      if (value === "SLOW MOVING") bgClass = "bg-red-100 text-red-700 border border-red-200";
      else if (value === "NIL STOCK") bgClass = "bg-gray-100 text-gray-600";

      return (
        <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md ${bgClass}`}>
          {value}
        </span>
      );
    }

    return value;
  };

  return (
    <ReportShell
      title="Inventory Ageing Report"
      subtitle="Stock age distribution analysis"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`As on ${asOnDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingAsOnDate(asOnDate);
        setPendingSelectedGroupId(selectedGroupId);
        setPendingShowOnlySlowMoving(showOnlySlowMoving);
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
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] ml-1 w-[160px]"
          >
            {itemGroupOptions.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>

          <label className="text-[12px] font-medium text-gray-700 flex items-center gap-1.5 ml-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlySlowMoving}
              onChange={(e) => setShowOnlySlowMoving(e.target.checked)}
              className="w-4 h-4 text-[#1557b0] border-gray-300 rounded focus:ring-[#1557b0]"
            />
            Show only slow-moving items
          </label>
        </div>
      }
    >
      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5 flex flex-col">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Items with stock &gt;90 days old
          </span>
          <span
            className={`text-[14px] font-semibold mt-1 ${reportData.summary.slowMovingCount > 0 ? "text-[#d97706]" : "text-gray-900"}`}
          >
            {reportData.summary.slowMovingCount}
          </span>
        </div>
        <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5 flex flex-col">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Total Slow-Moving Stock Value
          </span>
          <span
            className={`text-[14px] font-semibold mt-1 font-mono ${reportData.summary.totalSlowValue > 0 ? "text-[#dc2626]" : "text-gray-900"}`}
          >
            Rs. {formatNumber(reportData.summary.totalSlowValue)}
          </span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-6">
        <ReportGrid
          columns={[
            { key: "itemName", label: "Item Name" },
            { key: "unit", label: "Unit" },
            { key: "b0to30", label: "0-30 Days", align: "right" },
            { key: "b31to60", label: "31-60 Days", align: "right" },
            { key: "b61to90", label: "61-90 Days", align: "right" },
            { key: "b90plus", label: ">90 Days", align: "right" },
            { key: "totalQty", label: "Total Qty", align: "right" },
            { key: "totalValue", label: "Total Value", align: "right" },
            { key: "status", label: "Status", align: "center" },
          ]}
          data={reportData.rows}
          getRowClassName={(row) => {
            if (row.isTotal) return "bg-[#eef2ff] border-t-2 border-[#c7d2fe]";
            if (row.b90plus > 0) return "bg-red-50 hover:bg-red-100 transition-colors";
            return "";
          }}
          renderCell={renderCell}
        />
      </div>

      <ReportOptionsModal
        open={optionsOpen}
        title="Inventory Ageing Report Options"
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
            Item Group
            <select
              value={pendingSelectedGroupId}
              onChange={(e) => setPendingSelectedGroupId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              {itemGroupOptions.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-[12px] font-medium text-gray-700 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={pendingShowOnlySlowMoving}
              onChange={(e) => setPendingShowOnlySlowMoving(e.target.checked)}
              className="w-4 h-4 text-[#1557b0] border-gray-300 rounded focus:ring-[#1557b0]"
            />
            Show Only Slow-Moving Items (&gt;90 days)
          </label>
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default InventoryReport;
