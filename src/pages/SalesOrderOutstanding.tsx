// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const SalesOrderOutstanding: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("sales-order-outstanding");
  
  const { salesOrders, parties, companySettings, currentFiscalYear } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [view, setView] = useState<"details" | "summary">("details");
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "");
  const [selectedPartyId, setSelectedPartyId] = useState("");
  
  // Pending states for options modal
  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);
  const [pendingSelectedPartyId, setPendingSelectedPartyId] = useState(selectedPartyId);

  const applyOptions = () => {
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
    setSelectedPartyId(pendingSelectedPartyId);
    setOptionsOpen(false);
  };

  // Compute sales order outstanding data
  const reportData = useMemo(() => {
    if (!salesOrders) return { rows: [], totals: {} };

    let filteredOrders = salesOrders.filter(order => 
      order.status !== "fulfilled" && 
      order.status !== "cancelled" &&
      order.date >= startDate &&
      order.date <= endDate
    );

    if (selectedPartyId) {
      filteredOrders = filteredOrders.filter(order => order.partyId === selectedPartyId);
    }

    if (view === "details") {
      // Order details view - one row per order item line
      const rows = [];
      filteredOrders.forEach(order => {
        order.lines.forEach(line => {
          const orderedQty = line.qty || 0;
          const deliveredQty = line.deliveredQty || 0;
          const pendingQty = orderedQty - deliveredQty;
          const pendingValue = pendingQty * (line.rate || 0);

          // Determine status badge
          let statusDisplay = "Pending";
          if (deliveredQty > 0 && pendingQty > 0) {
            statusDisplay = `Partial (${Math.round((deliveredQty / orderedQty) * 100)}%)`;
          } else if (deliveredQty === 0) {
            statusDisplay = "Pending";
          } else if (pendingQty > 0) {
            statusDisplay = `${Math.round((pendingQty / orderedQty) * 100)}% Pending`;
          }

          rows.push({
            id: `${order.id}-${line.id}`,
            orderNo: order.orderNo,
            date: order.date,
            party: order.partyName,
            itemName: line.itemName,
            orderedQty,
            deliveredQty,
            pendingQty,
            rate: line.rate || 0,
            pendingValue,
            status: statusDisplay
          });
        });
      });

      // Add total row
      if (rows.length > 0) {
        const totalOrderedValue = rows.reduce((sum, row) => sum + (row.orderedQty * row.rate), 0);
        const totalDeliveredValue = rows.reduce((sum, row) => sum + (row.deliveredQty * row.rate), 0);
        const totalPendingValue = rows.reduce((sum, row) => sum + row.pendingValue, 0);

        rows.push({
          id: "total",
          orderNo: "TOTAL",
          date: "",
          party: "",
          itemName: "",
          orderedQty: rows.reduce((sum, row) => sum + row.orderedQty, 0),
          deliveredQty: rows.reduce((sum, row) => sum + row.deliveredQty, 0),
          pendingQty: rows.reduce((sum, row) => sum + row.pendingQty, 0),
          rate: "",
          pendingValue: totalPendingValue,
          status: "",
          isTotal: true
        });

        return { rows, totals: { totalOrderedValue, totalDeliveredValue, totalPendingValue } };
      }
      return { rows, totals: {} };
    } else {
      // Order summary view - one row per order
      const rows = filteredOrders.map(order => {
        const totalOrderedQty = order.lines.reduce((sum, line) => sum + (line.qty || 0), 0);
        const totalDeliveredQty = order.lines.reduce((sum, line) => sum + (line.deliveredQty || 0), 0);
        const totalPendingQty = totalOrderedQty - totalDeliveredQty;
        const totalOrderValue = order.lines.reduce((sum, line) => sum + ((line.qty || 0) * (line.rate || 0)), 0);
        const deliveredValue = order.lines.reduce((sum, line) => sum + ((line.deliveredQty || 0) * (line.rate || 0)), 0);
        const pendingValue = totalOrderValue - deliveredValue;

        // Determine status badge
        let statusDisplay = "Pending";
        if (totalDeliveredQty > 0 && totalPendingQty > 0) {
          statusDisplay = `Partial (${Math.round((totalDeliveredQty / totalOrderedQty) * 100)}%)`;
        } else if (totalDeliveredQty === 0) {
          statusDisplay = "Pending";
        } else if (totalPendingQty > 0) {
          statusDisplay = `${Math.round((totalPendingQty / totalOrderedQty) * 100)}% Pending`;
        }

        return {
          id: order.id,
          orderNo: order.orderNo,
          date: order.date,
          party: order.partyName,
          totalOrderValue,
          deliveredValue,
          pendingValue,
          status: statusDisplay
        };
      });

      // Add total row
      if (rows.length > 0) {
        const totalOrderValue = rows.reduce((sum, row) => sum + row.totalOrderValue, 0);
        const totalDeliveredValue = rows.reduce((sum, row) => sum + row.deliveredValue, 0);
        const totalPendingValue = rows.reduce((sum, row) => sum + row.pendingValue, 0);

        rows.push({
          id: "total",
          orderNo: "TOTAL",
          date: "",
          party: "",
          totalOrderValue,
          deliveredValue,
          pendingValue,
          status: "",
          isTotal: true
        });

        return { rows, totals: { totalOrderValue, totalDeliveredValue, totalPendingValue } };
      }
      return { rows, totals: {} };
    }
  }, [salesOrders, startDate, endDate, selectedPartyId, view]);

  // Get unique parties for filter
  const uniqueParties = useMemo(() => {
    const partySet = new Set();
    (salesOrders || []).forEach(order => {
      if (order.partyId) {
        partySet.add(order.partyId);
      }
    });
    
    return Array.from(partySet).map(id => {
      const party = parties.find(p => p.id === id);
      return { id, name: party?.name || "Unknown" };
    });
  }, [salesOrders, parties]);

  const renderCell = (columnKey: string, value: any, row: any) => {
    if (row.isTotal) {
      if (columnKey === "orderNo") {
        return <span className="font-bold text-gray-800">TOTAL</span>;
      }
      if (["orderedQty", "deliveredQty", "pendingQty", "totalOrderValue", "deliveredValue", "pendingValue"].includes(columnKey)) {
        return <span className="font-bold font-mono text-gray-800">{formatNumber(value)}</span>;
      }
      return "";
    }

    if (["orderedQty", "deliveredQty", "pendingQty", "rate", "totalOrderValue", "deliveredValue", "pendingValue"].includes(columnKey)) {
      if (value === 0 || value === "") return "";
      
      let colorClass = "text-gray-700";
      // Highlight pending values to draw attention
      if (["pendingQty", "pendingValue"].includes(columnKey)) {
        colorClass = "text-[#d97706] font-medium";
      }
      
      return <span className={`font-mono ${colorClass}`}>{formatNumber(value)}</span>;
    }
    
    if (columnKey === "status") {
      if (!value) return "";
      const isPartial = value.includes("Partial") || value.includes("%");
      return (
        <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md ${
          isPartial ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"
        }`}>
          {value}
        </span>
      );
    }

    return value;
  };

  return (
    <ReportShell
      title="Sales Order Outstanding"
      subtitle="Open sales orders pending delivery"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingStart(startDate);
        setPendingEnd(endDate);
        setPendingSelectedPartyId(selectedPartyId);
        setOptionsOpen(true);
      }}
      actionBarButtons={[
        { label: "Print" },
        { label: "Export" }
      ]}
      toolbarLeft={
        <div className="flex items-center gap-4 flex-wrap">
          {/* View toggle */}
          <div className="flex bg-gray-100 p-0.5 rounded-md border border-gray-200">
            <button
              onClick={() => setView("details")}
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
                view === "details" ? "bg-white shadow-sm text-[#1557b0]" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Order Details
            </button>
            <button
              onClick={() => setView("summary")}
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
                view === "summary" ? "bg-white shadow-sm text-[#1557b0]" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Order Summary
            </button>
          </div>

          <div className="h-4 w-px bg-gray-300"></div>

          <div className="flex items-center gap-1.5">
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
              value={selectedPartyId}
              onChange={e => setSelectedPartyId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] ml-1 w-[160px]"
            >
              <option value="">All Customers</option>
              {uniqueParties.map(party => (
                <option key={party.id} value={party.id}>{party.name}</option>
              ))}
            </select>
          </div>
        </div>
      }
    >
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-6">
        <ReportGrid 
          columns={
            view === "details" 
            ? [
                { key: "orderNo", label: "Order No" },
                { key: "date", label: "Date" },
                { key: "party", label: "Customer" },
                { key: "itemName", label: "Item" },
                { key: "orderedQty", label: "Ordered", align: "right" },
                { key: "deliveredQty", label: "Delivered", align: "right" },
                { key: "pendingQty", label: "Pending Qty", align: "right" },
                { key: "rate", label: "Rate", align: "right" },
                { key: "pendingValue", label: "Pending Val", align: "right" },
                { key: "status", label: "Status", align: "center" }
              ]
            : [
                { key: "orderNo", label: "Order No" },
                { key: "date", label: "Date" },
                { key: "party", label: "Customer" },
                { key: "totalOrderValue", label: "Total Value", align: "right" },
                { key: "deliveredValue", label: "Delivered Val", align: "right" },
                { key: "pendingValue", label: "Pending Val", align: "right" },
                { key: "status", label: "Status", align: "center" }
              ]
          } 
          data={reportData.rows} 
          getRowClassName={(row) => row.isTotal ? "bg-[#eef2ff] border-t-2 border-[#c7d2fe]" : ""}
          renderCell={renderCell}
        />
      </div>
      
      <ReportOptionsModal
        open={optionsOpen}
        title="Sales Order Outstanding Options"
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
            Customer 
            <select
              value={pendingSelectedPartyId}
              onChange={e => setPendingSelectedPartyId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="">All Customers</option>
              {uniqueParties.map(party => (
                <option key={party.id} value={party.id}>{party.name}</option>
              ))}
            </select>
          </label>
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default SalesOrderOutstanding;
