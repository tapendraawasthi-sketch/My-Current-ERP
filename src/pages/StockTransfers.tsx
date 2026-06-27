// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const StockTransfers: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("stock-transfers");
  
  const { stockMovements, vouchers, items, warehouses, companySettings, currentFiscalYear } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "");
  const [selectedFromWarehouseId, setSelectedFromWarehouseId] = useState("");
  const [selectedToWarehouseId, setSelectedToWarehouseId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  
  // Pending states for options modal
  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);
  const [pendingSelectedFromWarehouseId, setPendingSelectedFromWarehouseId] = useState(selectedFromWarehouseId);
  const [pendingSelectedToWarehouseId, setPendingSelectedToWarehouseId] = useState(selectedToWarehouseId);
  const [pendingSelectedItemId, setPendingSelectedItemId] = useState(selectedItemId);

  const applyOptions = () => {
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
    setSelectedFromWarehouseId(pendingSelectedFromWarehouseId);
    setSelectedToWarehouseId(pendingSelectedToWarehouseId);
    setSelectedItemId(pendingSelectedItemId);
    setOptionsOpen(false);
  };

  // Compute stock transfers data
  const transfersData = useMemo(() => {
    if (!stockMovements && !vouchers) return [];

    const result = [];
    const processedVoucherIds = new Set();

    // Process stock movements that represent transfers
    const movementTransfers = (stockMovements || []).filter(m => 
      m.type === "transfer" || 
      (m.fromWarehouseId && m.toWarehouseId && m.fromWarehouseId !== m.toWarehouseId) ||
      (m.warehouseId && m.toWarehouseId && m.warehouseId !== m.toWarehouseId) // Some systems use warehouseId as from
    );

    movementTransfers.forEach(m => {
      if (m.date < startDate || m.date > endDate) return;
      if (selectedFromWarehouseId && m.fromWarehouseId !== selectedFromWarehouseId) return;
      if (selectedToWarehouseId && m.toWarehouseId !== selectedToWarehouseId) return;
      if (selectedItemId && m.itemId !== selectedItemId) return;

      const item = items.find(i => i.id === m.itemId);
      const fromWarehouse = warehouses.find(w => w.id === m.fromWarehouseId);
      const toWarehouse = warehouses.find(w => w.id === m.toWarehouseId);

      result.push({
        id: m.id,
        date: m.date,
        voucherNo: m.referenceNo || m.voucherNo || "Transfer Entry",
        itemName: item?.name || "Unknown Item",
        fromWarehouse: fromWarehouse?.name || m.fromWarehouseId || "Unknown",
        toWarehouse: toWarehouse?.name || m.toWarehouseId || "Unknown",
        qty: m.qty || 0,
        rate: m.rate || 0,
        value: (m.qty || 0) * (m.rate || 0),
        narration: m.narration || "Stock Transfer Movement",
        type: "movement"
      });
    });

    // Process stock journal vouchers that represent transfers
    const stockJournalVouchers = (vouchers || []).filter(v => 
      v.type === "stock-journal" && 
      v.status === "posted"
    );

    stockJournalVouchers.forEach(v => {
      if (v.date < startDate || v.date > endDate) return;
      if (processedVoucherIds.has(v.id)) return; // Avoid duplicates
      
      v.lines.forEach(line => {
        if (line.fromWarehouseId && line.toWarehouseId && line.fromWarehouseId !== line.toWarehouseId) {
          if (selectedFromWarehouseId && line.fromWarehouseId !== selectedFromWarehouseId) return;
          if (selectedToWarehouseId && line.toWarehouseId !== selectedToWarehouseId) return;
          if (selectedItemId && line.itemId !== selectedItemId) return;

          const item = items.find(i => i.id === line.itemId);
          const fromWarehouse = warehouses.find(w => w.id === line.fromWarehouseId);
          const toWarehouse = warehouses.find(w => w.id === line.toWarehouseId);

          result.push({
            id: `${v.id}-${line.id || Math.random()}`,
            date: v.date,
            voucherNo: v.voucherNo || v.id,
            itemName: item?.name || "Unknown Item",
            fromWarehouse: fromWarehouse?.name || line.fromWarehouseId || "Unknown",
            toWarehouse: toWarehouse?.name || line.toWarehouseId || "Unknown",
            qty: line.qty || 0,
            rate: line.rate || 0,
            value: (line.qty || 0) * (line.rate || 0),
            narration: v.narration || `Stock Transfer: ${fromWarehouse?.name || line.fromWarehouseId} → ${toWarehouse?.name || line.toWarehouseId}`,
            type: "voucher"
          });
        }
      });
      
      processedVoucherIds.add(v.id);
    });

    // Sort by date then voucher number
    result.sort((a, b) => {
      if (a.date !== b.date) {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      return (a.voucherNo || "").localeCompare(b.voucherNo || "");
    });

    // Add grand total row
    if (result.length > 0) {
      const totalQty = result.reduce((sum, row) => sum + row.qty, 0);
      const totalValue = result.reduce((sum, row) => sum + row.value, 0);

      result.push({
        id: "total",
        date: "",
        voucherNo: "TOTAL",
        itemName: "",
        fromWarehouse: "",
        toWarehouse: "",
        qty: totalQty,
        rate: "",
        value: totalValue,
        narration: "",
        isTotal: true
      });
    }

    return result;
  }, [stockMovements, vouchers, items, warehouses, startDate, endDate, selectedFromWarehouseId, selectedToWarehouseId, selectedItemId]);

  // Get warehouse options
  const warehouseOptions = useMemo(() => [
    { id: "", name: "All Warehouses" },
    ...(warehouses || [])
  ], [warehouses]);

  // Get item options
  const itemOptions = useMemo(() => [
    { id: "", name: "All Items" },
    ...(items || [])
  ], [items]);

  const renderCell = (columnKey: string, value: any, row: any) => {
    if (row.isTotal) {
      if (columnKey === "voucherNo") {
        return <span className="font-bold text-gray-800">TOTAL</span>;
      }
      if (columnKey === "qty" || columnKey === "value") {
        return <span className="font-bold font-mono text-gray-800">{formatNumber(value)}</span>;
      }
      return "";
    }

    if (["qty", "rate", "value"].includes(columnKey)) {
      if (value === 0 || value === "") return "";
      return <span className="font-mono">{formatNumber(value)}</span>;
    }
    
    if (columnKey === "narration") {
      return <span className="text-[11px] text-gray-500 italic">{value}</span>;
    }

    return value;
  };

  return (
    <ReportShell
      title="Stock Transfers"
      subtitle="Inter-warehouse stock movement report"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingStart(startDate);
        setPendingEnd(endDate);
        setPendingSelectedFromWarehouseId(selectedFromWarehouseId);
        setPendingSelectedToWarehouseId(selectedToWarehouseId);
        setPendingSelectedItemId(selectedItemId);
        setOptionsOpen(true);
      }}
      actionBarButtons={[
        { label: "Print" },
        { label: "Export" }
      ]}
      toolbarLeft={
        <div className="flex items-center gap-1.5 flex-wrap">
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            From: 
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
            />
          </label>
          
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5 ml-1">
            To: 
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
            />
          </label>
          
          <select
            value={selectedFromWarehouseId}
            onChange={e => setSelectedFromWarehouseId(e.target.value)}
            className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] ml-1 w-[130px]"
          >
            <option value="" disabled>From Whse...</option>
            {warehouseOptions.map(warehouse => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
            ))}
          </select>
          
          <select
            value={selectedToWarehouseId}
            onChange={e => setSelectedToWarehouseId(e.target.value)}
            className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-[130px]"
          >
            <option value="" disabled>To Whse...</option>
            {warehouseOptions.map(warehouse => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
            ))}
          </select>
          
          <select
            value={selectedItemId}
            onChange={e => setSelectedItemId(e.target.value)}
            className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-[150px]"
          >
            <option value="" disabled>Select Item...</option>
            {itemOptions.map(item => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
      }
    >
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-6">
        <ReportGrid 
          columns={[
            { key: "date", label: "Date" },
            { key: "voucherNo", label: "Vch No" },
            { key: "itemName", label: "Item Name" },
            { key: "fromWarehouse", label: "From Warehouse" },
            { key: "toWarehouse", label: "To Warehouse" },
            { key: "qty", label: "Qty", align: "right" },
            { key: "rate", label: "Rate", align: "right" },
            { key: "value", label: "Value (Rs.)", align: "right" },
            { key: "narration", label: "Narration" }
          ]} 
          data={transfersData} 
          getRowClassName={(row) => {
            if (row.isTotal) {
              return "bg-[#eef2ff] border-t-2 border-[#c7d2fe]";
            }
            // Highlight same warehouse transfers (should not happen)
            if (row.fromWarehouse === row.toWarehouse && row.fromWarehouse !== "Unknown") {
              return "bg-red-50 text-red-700";
            }
            return "";
          }}
          renderCell={renderCell}
        />
      </div>
      
      <ReportOptionsModal
        open={optionsOpen}
        title="Stock Transfers Options"
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
            From Warehouse 
            <select
              value={pendingSelectedFromWarehouseId}
              onChange={e => setPendingSelectedFromWarehouseId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              {warehouseOptions.map(warehouse => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </label>
          
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            To Warehouse 
            <select
              value={pendingSelectedToWarehouseId}
              onChange={e => setPendingSelectedToWarehouseId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              {warehouseOptions.map(warehouse => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </label>
          
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Item Filter 
            <select
              value={pendingSelectedItemId}
              onChange={e => setPendingSelectedItemId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              {itemOptions.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default StockTransfers;
