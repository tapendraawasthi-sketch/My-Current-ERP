// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const BatchSummary: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("batch-summary");
  
  const { batches, stockMovements, items, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [showExpired, setShowExpired] = useState(false);
  const [expiringWithinDays, setExpiringWithinDays] = useState(30);
  
  // Pending states for options modal
  const [pendingSelectedItemId, setPendingSelectedItemId] = useState(selectedItemId);
  const [pendingShowExpired, setPendingShowExpired] = useState(showExpired);
  const [pendingExpiringWithinDays, setPendingExpiringWithinDays] = useState(expiringWithinDays);

  const applyOptions = () => {
    setSelectedItemId(pendingSelectedItemId);
    setShowExpired(pendingShowExpired);
    setExpiringWithinDays(pendingExpiringWithinDays);
    setOptionsOpen(false);
  };

  // Helper function to calculate days between dates
  const daysBetween = (dateString1: string, dateString2: string): number => {
    const date1 = new Date(dateString1);
    const date2 = new Date(dateString2);
    const timeDiff = date2.getTime() - date1.getTime();
    return Math.floor(timeDiff / (1000 * 3600 * 24));
  };

  // Compute batch summary data
  const summaryData = useMemo(() => {
    if (!batches) return { rows: [], hasExpiringSoon: false };

    let filteredBatches = [...batches];

    if (selectedItemId) {
      filteredBatches = filteredBatches.filter(b => b.itemId === selectedItemId);
    }

    // Calculate days to expiry
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    
    const processedBatches = filteredBatches.map(batch => {
      const daysToExpiry = batch.expiryDate ? daysBetween(todayStr, batch.expiryDate) : 0;
      
      // Determine status
      let status = "VALID";
      if (daysToExpiry < 0) status = "EXPIRED";
      else if (daysToExpiry <= expiringWithinDays) status = "EXPIRING SOON";
      else if (daysToExpiry <= 90) status = "NEAR EXPIRY";
      
      // Get item name
      const item = items.find(i => i.id === batch.itemId);
      
      return {
        id: batch.id,
        itemName: item?.name || batch.itemName || "Unknown",
        batchNo: batch.batchNo || "N/A",
        mfgDate: batch.mfgDate || "N/A",
        expiryDate: batch.expiryDate || "N/A",
        daysToExpiry,
        qty: batch.qty || 0,
        rate: batch.rate || 0,
        value: (batch.qty || 0) * (batch.rate || 0),
        status
      };
    });

    // Filter based on expiry settings
    const result = processedBatches.filter(batch => {
      if (batch.daysToExpiry < 0 && !showExpired) return false;
      return true;
    });

    // Check if any batches are expiring soon
    const hasExpiringSoon = result.some(batch => 
      batch.daysToExpiry > 0 && batch.daysToExpiry <= expiringWithinDays
    );

    // Add total row
    if (result.length > 0) {
      const totalQty = result.reduce((sum, batch) => sum + batch.qty, 0);
      const totalValue = result.reduce((sum, batch) => sum + batch.value, 0);

      result.push({
        id: "total",
        itemName: "TOTAL",
        batchNo: "",
        mfgDate: "",
        expiryDate: "",
        daysToExpiry: "",
        qty: totalQty,
        rate: "",
        value: totalValue,
        status: "",
        isTotal: true
      });
    }

    return { rows: result, hasExpiringSoon };
  }, [batches, items, selectedItemId, showExpired, expiringWithinDays]);

  // Get unique items for filter
  const uniqueItems = useMemo(() => {
    const itemIds = new Set(batches?.map(b => b.itemId));
    return (items || []).filter(item => itemIds.has(item.id));
  }, [batches, items]);

  const renderCell = (columnKey: string, value: any, row: any) => {
    if (row.isTotal) {
      if (columnKey === "itemName") {
        return <span className="font-bold text-gray-800">TOTAL</span>;
      }
      if (["qty", "value"].includes(columnKey)) {
        return <span className="font-bold font-mono text-gray-800">{formatNumber(value)}</span>;
      }
      return "";
    }

    if (["daysToExpiry", "qty", "rate", "value"].includes(columnKey)) {
      if (value === 0 && columnKey !== "qty") return "";
      
      let colorClass = "text-gray-700";
      if (columnKey === "daysToExpiry") {
        if (value < 0) colorClass = "text-red-600 font-bold";
        else if (value <= expiringWithinDays) colorClass = "text-[#d97706] font-bold";
      }
      
      return <span className={`font-mono ${colorClass}`}>{formatNumber(value)}</span>;
    }
    
    if (columnKey === "status") {
      if (!value) return "";
      
      let bgClass = "bg-green-100 text-green-700"; // VALID
      if (value === "EXPIRED") bgClass = "bg-red-100 text-red-700 border border-red-200";
      else if (value === "EXPIRING SOON") bgClass = "bg-amber-100 text-amber-700 border border-amber-200";
      else if (value === "NEAR EXPIRY") bgClass = "bg-amber-50 text-amber-600 border border-amber-100";
      
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
      title="Batch Summary"
      subtitle="Stock by batch/lot number with expiry tracking"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText=""
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingSelectedItemId(selectedItemId);
        setPendingShowExpired(showExpired);
        setPendingExpiringWithinDays(expiringWithinDays);
        setOptionsOpen(true);
      }}
      actionBarButtons={[
        { label: "Print" },
        { label: "Export" }
      ]}
      toolbarLeft={
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            Item:
            <select
              value={selectedItemId}
              onChange={e => setSelectedItemId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-[180px]"
            >
              <option value="">All Items</option>
              {uniqueItems.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          
          <div className="h-4 w-px bg-gray-300 mx-1"></div>
          
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            Expiring Within:
            <div className="relative">
              <input
                type="number"
                value={expiringWithinDays}
                onChange={e => setExpiringWithinDays(parseInt(e.target.value) || 30)}
                className="h-8 pl-2.5 pr-8 text-[12px] font-mono font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-[70px]"
                min="0"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">d</span>
            </div>
          </label>
          
          <label className="text-[12px] font-medium text-gray-700 flex items-center gap-1.5 ml-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={showExpired}
              onChange={e => setShowExpired(e.target.checked)}
              className="w-4 h-4 text-[#1557b0] border-gray-300 rounded focus:ring-[#1557b0]"
            />
            Show Expired
          </label>
        </div>
      }
    >
      {/* Expiring soon warning */}
      {summaryData.hasExpiringSoon && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 p-3 mb-4 rounded-md flex items-center gap-2 font-bold text-[12px]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          WARNING: Some batches are expiring soon! Check the "Days to Expiry" column.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-6">
        <ReportGrid 
          columns={[
            { key: "itemName", label: "Item Name" },
            { key: "batchNo", label: "Batch / Lot No" },
            { key: "mfgDate", label: "Mfg Date" },
            { key: "expiryDate", label: "Expiry Date" },
            { key: "daysToExpiry", label: "Days", align: "right" },
            { key: "qty", label: "Qty", align: "right" },
            { key: "rate", label: "Rate", align: "right" },
            { key: "value", label: "Value (Rs.)", align: "right" },
            { key: "status", label: "Status" }
          ]} 
          data={summaryData.rows} 
          getRowClassName={(row) => {
            if (row.isTotal) {
              return "bg-[#eef2ff] border-t-2 border-[#c7d2fe]";
            }
            if (row.status === "EXPIRED") {
              return "bg-red-50 hover:bg-red-100";
            }
            return "";
          }}
          renderCell={renderCell}
        />
      </div>
      
      <ReportOptionsModal
        open={optionsOpen}
        title="Batch Summary Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Item Filter 
            <select
              value={pendingSelectedItemId}
              onChange={e => setPendingSelectedItemId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="">All Items</option>
              {uniqueItems.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Expiring Within (days) 
            <input
              type="number"
              value={pendingExpiringWithinDays}
              onChange={e => setPendingExpiringWithinDays(parseInt(e.target.value) || 30)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              min="0"
            />
          </label>

          <label className="flex items-center gap-2 text-[12px] font-medium text-gray-700 cursor-pointer pt-2">
            <input 
              type="checkbox" 
              checked={pendingShowExpired}
              onChange={e => setPendingShowExpired(e.target.checked)}
              className="w-4 h-4 text-[#1557b0] border-gray-300 rounded focus:ring-[#1557b0]"
            />
            Show Expired Batches
          </label>
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default BatchSummary;
