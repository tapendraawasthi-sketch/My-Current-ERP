// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Package,
  TrendingUp,
  TrendingDown,
  Clock,
  Warehouse,
} from "lucide-react";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const InventoryAnalysis: React.FC = () => {
  const {
    items,
    vouchers,
    stockMovements,
    itemGroups,
    warehouses,
    batches,
    accounts,
    setCurrentPage,
  } = useStore();
  const [activeTab, setActiveTab] = useState(0);
  const [analysisPeriod, setAnalysisPeriod] = useState(90);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [reviewFlags, setReviewFlags] = useState<Set<string>>(new Set());
  const [topFilter, setTopFilter] = useState<"all" | "top10" | "bottom10">("all");

  // Helper function to find item by ID
  const getItemById = (id: string) => items.find((item) => item.id === id);

  // TAB 1: Item Profitability
  const itemProfitabilityData = useMemo(() => {
    const itemMap: Record<string, any> = {};

    // Process sales
    vouchers.forEach((voucher) => {
      if (
        (voucher.type === "sales-invoice" || voucher.type === "sales") &&
        voucher.status !== "cancelled"
      ) {
        voucher.lines?.forEach((line) => {
          if (line.itemId) {
            const itemId = line.itemId;
            const item = getItemById(itemId);
            if (!itemMap[itemId]) {
              itemMap[itemId] = {
                itemId,
                itemCode: item?.code || "N/A",
                itemName: item?.name || "N/A",
                groupName: item?.groupId
                  ? itemGroups.find((g) => g.id === item.groupId)?.name || "N/A"
                  : "N/A",
                salesQty: 0,
                salesValue: 0,
                purchaseQty: 0,
                purchaseCost: 0,
              };
            }

            const qty = line.quantity || line.qty || 0;
            const rate = line.rate || 0;
            const amount = line.amount || qty * rate || 0;

            itemMap[itemId].salesQty += qty;
            itemMap[itemId].salesValue += amount;
          }
        });
      }
    });

    // Process purchases
    vouchers.forEach((voucher) => {
      if (
        (voucher.type === "purchase-invoice" || voucher.type === "purchase") &&
        voucher.status !== "cancelled"
      ) {
        voucher.lines?.forEach((line) => {
          if (line.itemId) {
            const itemId = line.itemId;
            const item = getItemById(itemId);
            if (!itemMap[itemId]) {
              itemMap[itemId] = {
                itemId,
                itemCode: item?.code || "N/A",
                itemName: item?.name || "N/A",
                groupName: item?.groupId
                  ? itemGroups.find((g) => g.id === item.groupId)?.name || "N/A"
                  : "N/A",
                salesQty: 0,
                salesValue: 0,
                purchaseQty: 0,
                purchaseCost: 0,
              };
            }

            const qty = line.quantity || line.qty || 0;
            const rate = line.rate || 0;
            const amount = line.amount || qty * rate || 0;

            itemMap[itemId].purchaseQty += qty;
            itemMap[itemId].purchaseCost += amount;
          }
        });
      }
    });

    // Calculate profitability metrics
    const results = Object.values(itemMap).map((item) => {
      const grossProfit = item.salesValue - item.purchaseCost;
      const marginPct = item.salesValue > 0 ? (grossProfit / item.salesValue) * 100 : 0;

      return {
        ...item,
        grossProfit,
        marginPct,
      };
    });

    // Sort by margin percentage descending
    results.sort((a, b) => b.marginPct - a.marginPct);

    // Apply filters
    if (topFilter === "top10") {
      return results.slice(0, 10);
    } else if (topFilter === "bottom10") {
      return results.slice(-10).reverse();
    }

    return results;
  }, [vouchers, items, itemGroups, topFilter]);

  // Calculate totals for Tab 1
  const tab1Totals = useMemo(() => {
    return itemProfitabilityData.reduce(
      (acc, item) => {
        acc.salesQty += item.salesQty;
        acc.salesValue += item.salesValue;
        acc.purchaseCost += item.purchaseCost;
        acc.grossProfit += item.grossProfit;
        return acc;
      },
      { salesQty: 0, salesValue: 0, purchaseCost: 0, grossProfit: 0 },
    );
  }, [itemProfitabilityData]);

  // TAB 2: Movement Analysis
  const movementAnalysisData = useMemo(() => {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - analysisPeriod);

    const itemMap: Record<string, any> = {};

    // Process stock movements in the period
    stockMovements.forEach((movement) => {
      if (new Date(movement.date) >= periodStart) {
        const itemId = movement.itemId;
        const item = getItemById(itemId);

        if (!itemMap[itemId]) {
          itemMap[itemId] = {
            itemId,
            itemCode: item?.code || "N/A",
            itemName: item?.name || "N/A",
            salesInPeriod: 0,
            lastSaleDate: null,
            daysNoSale: 0,
          };
        }

        if (movement.type === "out" || movement.type === "sale") {
          itemMap[itemId].salesInPeriod += movement.quantity || 0;
          if (
            !itemMap[itemId].lastSaleDate ||
            new Date(movement.date) > new Date(itemMap[itemId].lastSaleDate)
          ) {
            itemMap[itemId].lastSaleDate = movement.date;
          }
        }
      }
    });

    // Calculate days since last sale
    Object.values(itemMap).forEach((item) => {
      if (item.lastSaleDate) {
        const lastSale = new Date(item.lastSaleDate);
        const diffTime = Math.abs(now.getTime() - lastSale.getTime());
        item.daysNoSale = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      } else {
        item.daysNoSale = Infinity; // For items never sold
      }
    });

    // Calculate average monthly sales for classification
    const monthlySalesMap: Record<string, number> = {};
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    stockMovements.forEach((movement) => {
      if (
        new Date(movement.date) >= twelveMonthsAgo &&
        (movement.type === "out" || movement.type === "sale")
      ) {
        const itemId = movement.itemId;
        if (!monthlySalesMap[itemId]) {
          monthlySalesMap[itemId] = 0;
        }
        monthlySalesMap[itemId] += movement.quantity || 0;
      }
    });

    // Calculate average monthly sales
    Object.keys(monthlySalesMap).forEach((itemId) => {
      monthlySalesMap[itemId] /= 12;
    });

    // Classify items and assign colors
    Object.values(itemMap).forEach((item) => {
      const avgMonthlySales = monthlySalesMap[item.itemId] || 0;
      if (item.salesInPeriod > avgMonthlySales * 0.5) {
        item.classification = "FAST";
      } else if (item.salesInPeriod > 0 && item.salesInPeriod <= avgMonthlySales * 0.2) {
        item.classification = "SLOW";
      } else {
        item.classification = "NON-MOVING";
      }
    });

    return Object.values(itemMap);
  }, [stockMovements, items, analysisPeriod]);

  // Group movement data by classification
  const fastMoving = movementAnalysisData.filter((item) => item.classification === "FAST");
  const slowMoving = movementAnalysisData.filter((item) => item.classification === "SLOW");
  const nonMoving = movementAnalysisData.filter((item) => item.classification === "NON-MOVING");

  // TAB 3: Stock Aging
  const stockAgingData = useMemo(() => {
    const buckets = [
      { name: "0-30 days", min: 0, max: 30 },
      { name: "31-60 days", min: 31, max: 60 },
      { name: "61-90 days", min: 61, max: 90 },
      { name: "91-180 days", min: 91, max: 180 },
      { name: "181-365 days", min: 181, max: 365 },
      { name: "365+ days", min: 366, max: Infinity },
    ];

    const itemMap: Record<string, any> = {};

    // Process incoming stock movements to calculate aging
    stockMovements.forEach((movement) => {
      if (movement.type === "in" || movement.type === "purchase") {
        const itemId = movement.itemId;
        const item = getItemById(itemId);

        if (!item) return;

        const receiptDate = new Date(movement.date);
        const today = new Date();
        const ageInDays = Math.floor(
          (today.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Find appropriate bucket
        const bucket = buckets.find((b) => ageInDays >= b.min && ageInDays <= b.max);
        if (!bucket) return;

        if (!itemMap[itemId]) {
          itemMap[itemId] = {
            itemId,
            itemName: item.name,
            unit: item.unit || "N/A",
            buckets: buckets.map(() => ({ qty: 0, value: 0 })),
            totalQty: 0,
            totalValue: 0,
          };
        }

        const qty = movement.quantity || 0;
        const rate = movement.rate || item.purchaseRate || 0;
        const value = qty * rate;

        const bucketIndex = buckets.findIndex((b) => b.name === bucket.name);
        itemMap[itemId].buckets[bucketIndex].qty += qty;
        itemMap[itemId].buckets[bucketIndex].value += value;
        itemMap[itemId].totalQty += qty;
        itemMap[itemId].totalValue += value;
      }
    });

    return Object.values(itemMap);
  }, [stockMovements, items]);

  // Calculate aging bucket totals
  const agingBucketTotals = useMemo(() => {
    const buckets = [
      { name: "0-30 days", min: 0, max: 30 },
      { name: "31-60 days", min: 31, max: 60 },
      { name: "61-90 days", min: 61, max: 90 },
      { name: "91-180 days", min: 91, max: 180 },
      { name: "181-365 days", min: 181, max: 365 },
      { name: "365+ days", min: 366, max: Infinity },
    ];

    const totals = buckets.map((bucket) => ({ qty: 0, value: 0 }));

    stockAgingData.forEach((item) => {
      item.buckets.forEach((bucketData, index) => {
        totals[index].qty += bucketData.qty;
        totals[index].value += bucketData.value;
      });
    });

    return totals;
  }, [stockAgingData]);

  // TAB 4: Godown-wise Stock
  const godownStockData = useMemo(() => {
    if (!selectedWarehouseId) return [];

    const itemMap: Record<string, any> = {};

    // Process stock movements for the selected warehouse
    stockMovements.forEach((movement) => {
      if (movement.warehouseId === selectedWarehouseId) {
        const itemId = movement.itemId;
        const item = getItemById(itemId);

        if (!item) return;

        if (!itemMap[itemId]) {
          itemMap[itemId] = {
            itemId,
            itemCode: item.code,
            itemName: item.name,
            openingQty: 0,
            received: 0,
            issued: 0,
            closingQty: 0,
            unit: item.unit || "N/A",
            value: 0,
            purchaseRate: item.purchaseRate || 0,
          };
        }

        if (movement.type === "open") {
          itemMap[itemId].openingQty += movement.quantity || 0;
        } else if (movement.type === "in") {
          itemMap[itemId].received += movement.quantity || 0;
        } else if (movement.type === "out") {
          itemMap[itemId].issued += movement.quantity || 0;
        }
      }
    });

    // Calculate closing quantities and values
    Object.values(itemMap).forEach((item) => {
      item.closingQty = item.openingQty + item.received - item.issued;
      item.value = item.closingQty * item.purchaseRate;
    });

    return Object.values(itemMap);
  }, [stockMovements, items, selectedWarehouseId]);

  // Calculate godown total value
  const godownTotalValue = useMemo(() => {
    return godownStockData.reduce((sum, item) => sum + item.value, 0);
  }, [godownStockData]);

  // TAB 5: Category-wise Valuation
  const categoryValuationData = useMemo(() => {
    const groupMap: Record<string, any> = {};

    // Group items by their group ID
    items.forEach((item) => {
      const groupId = item.groupId;
      const groupName = itemGroups.find((g) => g.id === groupId)?.name || "Uncategorized";

      if (!groupMap[groupId]) {
        groupMap[groupId] = {
          groupId,
          groupName,
          items: [],
          itemCount: 0,
          totalQty: 0,
          totalValue: 0,
        };
      }

      // Calculate item stock position
      const stockPosition = stockMovements
        .filter((m) => m.itemId === item.id)
        .reduce(
          (acc, m) => {
            if (m.type === "in" || m.type === "open") {
              acc.qty += m.quantity || 0;
              acc.value += (m.quantity || 0) * (m.rate || item.purchaseRate || 0);
            } else if (m.type === "out") {
              acc.qty -= m.quantity || 0;
              acc.value -= (m.quantity || 0) * (m.rate || item.purchaseRate || 0);
            }
            return acc;
          },
          { qty: 0, value: 0 },
        );

      groupMap[groupId].items.push({
        ...item,
        qty: stockPosition.qty,
        value: stockPosition.value,
      });

      groupMap[groupId].itemCount++;
      groupMap[groupId].totalQty += stockPosition.qty;
      groupMap[groupId].totalValue += stockPosition.value;
    });

    return Object.values(groupMap);
  }, [items, stockMovements, itemGroups]);

  // Toggle group expansion for Tab 5
  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Toggle review flag for Tab 2
  const toggleReviewFlag = (itemId: string) => {
    setReviewFlags((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Export functions
  const exportTab1ToExcel = () => {
    const headers = [
      "Item Code",
      "Item Name",
      "Group",
      "Sales Qty",
      "Sales Value NPR",
      "COGS NPR",
      "Gross Profit NPR",
      "Margin %",
    ];

    const rows = itemProfitabilityData.map((item) => [
      item.itemCode,
      item.itemName,
      item.groupName,
      item.salesQty,
      item.salesValue,
      item.purchaseCost,
      item.grossProfit,
      item.marginPct.toFixed(2) + "%",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item Profitability");
    XLSX.writeFile(wb, "Item_Profitability_Report.xlsx");
    toast.success("Item Profitability exported to Excel");
  };

  const exportTab2ToExcel = () => {
    const headers = [
      "Item Code",
      "Item Name",
      "Sales in Period",
      "Last Sale Date",
      "Days Since Last Sale",
      "Classification",
    ];

    const rows = movementAnalysisData.map((item) => [
      item.itemCode,
      item.itemName,
      item.salesInPeriod,
      item.lastSaleDate || "Never",
      item.daysNoSale === Infinity ? "Never" : item.daysNoSale,
      item.classification,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movement Analysis");
    XLSX.writeFile(wb, "Movement_Analysis_Report.xlsx");
    toast.success("Movement Analysis exported to Excel");
  };

  const exportTab4ToExcel = () => {
    if (!selectedWarehouseId) {
      toast.error("Please select a warehouse first");
      return;
    }

    const headers = [
      "Item Code",
      "Item Name",
      "Opening Qty",
      "Received",
      "Issued",
      "Closing Qty",
      "Unit",
      "Value",
    ];

    const rows = godownStockData.map((item) => [
      item.itemCode,
      item.itemName,
      item.openingQty,
      item.received,
      item.issued,
      item.closingQty,
      item.unit,
      item.value,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Godown ${selectedWarehouseId}`);
    XLSX.writeFile(wb, `Godown_${selectedWarehouseId}_Report.xlsx`);
    toast.success(`Godown ${selectedWarehouseId} report exported to Excel`);
  };

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4">
      <div className="w-full">
        {/* Standard Page Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Inventory Analysis Hub</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Comprehensive insights into stock and movement
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4 bg-white px-2 pt-2 rounded-t-md shadow-sm">
          {[
            "Item Profitability",
            "Movement Analysis",
            "Stock Aging",
            "Godown-wise Stock",
            "Category-wise Valuation",
          ].map((tab, index) => (
            <button
              key={index}
              className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors ${
                activeTab === index
                  ? "border-[#1557b0] text-[#1557b0]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              onClick={() => setActiveTab(index)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content Panels */}

        {activeTab === 0 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden max-w-full">
            <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-white">
              <div className="flex gap-2">
                <button
                  className={`h-8 px-3 text-[12px] font-medium rounded-md transition-colors ${topFilter === "all" ? "bg-[#1557b0] text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                  onClick={() => setTopFilter("all")}
                >
                  All Items
                </button>
                <button
                  className={`h-8 px-3 text-[12px] font-medium rounded-md transition-colors ${topFilter === "top10" ? "bg-[#1557b0] text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                  onClick={() => setTopFilter("top10")}
                >
                  Top 10 Profitable
                </button>
                <button
                  className={`h-8 px-3 text-[12px] font-medium rounded-md transition-colors ${topFilter === "bottom10" ? "bg-[#1557b0] text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                  onClick={() => setTopFilter("bottom10")}
                >
                  Bottom 10 Unprofitable
                </button>
              </div>
              <button
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
                onClick={exportTab1ToExcel}
              >
                <Download size={14} />
                Export
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Item Code
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Item Name
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Group
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Sales Qty
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Sales Value
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      COGS
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Gross Profit
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Margin %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {itemProfitabilityData.map((item, index) => (
                    <tr key={item.itemId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">
                        {item.itemCode}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                        {item.itemName}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{item.groupName}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                        {item.salesQty}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right font-mono">
                        {money(item.salesValue)}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right font-mono">
                        {money(item.purchaseCost)}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right font-mono">
                        {money(item.grossProfit)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-[12px] font-medium text-right ${item.marginPct > 20 ? "text-[#059669]" : item.marginPct >= 10 ? "text-[#d97706]" : "text-[#dc2626]"}`}
                      >
                        {item.marginPct.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                    <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800">TOTALS</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-right">
                      {tab1Totals.salesQty}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-right font-mono">
                      {money(tab1Totals.salesValue)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-right font-mono">
                      {money(tab1Totals.purchaseCost)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-right font-mono">
                      {money(tab1Totals.grossProfit)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-right">
                      {tab1Totals.salesValue > 0
                        ? ((tab1Totals.grossProfit / tab1Totals.salesValue) * 100).toFixed(2) + "%"
                        : "0.00%"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden max-w-full">
            <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-white">
              <div className="flex gap-2 items-center">
                <label className="text-[11px] font-medium text-gray-600">Analysis Period:</label>
                <select
                  value={analysisPeriod}
                  onChange={(e) => setAnalysisPeriod(Number(e.target.value))}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                >
                  <option value={30}>Last 30 days</option>
                  <option value={60}>Last 60 days</option>
                  <option value={90}>Last 90 days</option>
                  <option value={180}>Last 180 days</option>
                  <option value={365}>Last 365 days</option>
                </select>
              </div>
              <button
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
                onClick={exportTab2ToExcel}
              >
                <Download size={14} />
                Export
              </button>
            </div>

            <div className="overflow-x-auto">
              {/* Fast Moving Items */}
              <div className="mb-2 border-b border-gray-200">
                <div
                  className="bg-gray-50 p-2.5 flex justify-between items-center cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleGroup("fast")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">
                      {expandedGroups.has("fast") ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </span>
                    <span className="text-[11px] font-semibold text-gray-700 tracking-wide">
                      FAST MOVING ITEMS ({fastMoving.length})
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-gray-500">
                    Total Value:{" "}
                    {money(
                      fastMoving.reduce(
                        (sum, item) =>
                          sum + item.salesInPeriod * (getItemById(item.itemId)?.purchaseRate || 0),
                        0,
                      ),
                    )}
                  </span>
                </div>
                {expandedGroups.has("fast") && (
                  <table className="w-full min-w-max border-collapse">
                    <thead>
                      <tr className="bg-white border-y border-gray-200">
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Item Code
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Item Name
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Sales in Period
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Last Sale Date
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Days Since Last Sale
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Classification
                        </th>
                        <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {fastMoving.map((item) => (
                        <tr
                          key={item.itemId}
                          className="border-b border-gray-100 hover:bg-gray-50 bg-green-50/30"
                        >
                          <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">
                            {item.itemCode}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                            {item.itemName}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                            {item.salesInPeriod}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                            {item.lastSaleDate || "Never"}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                            {item.daysNoSale === Infinity ? "Never" : item.daysNoSale}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-[#059669] font-medium text-right">
                            {item.classification}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              className={`h-6 px-2 text-[10px] font-semibold uppercase rounded ${reviewFlags.has(item.itemId) ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                              onClick={() => toggleReviewFlag(item.itemId)}
                            >
                              {reviewFlags.has(item.itemId) ? "Unflag" : "Flag"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Slow Moving Items */}
              <div className="mb-2 border-b border-gray-200">
                <div
                  className="bg-gray-50 p-2.5 flex justify-between items-center cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleGroup("slow")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">
                      {expandedGroups.has("slow") ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </span>
                    <span className="text-[11px] font-semibold text-gray-700 tracking-wide">
                      SLOW MOVING ITEMS ({slowMoving.length})
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-gray-500">
                    Total Value:{" "}
                    {money(
                      slowMoving.reduce(
                        (sum, item) =>
                          sum + item.salesInPeriod * (getItemById(item.itemId)?.purchaseRate || 0),
                        0,
                      ),
                    )}
                  </span>
                </div>
                {expandedGroups.has("slow") && (
                  <table className="w-full min-w-max border-collapse">
                    <thead>
                      <tr className="bg-white border-y border-gray-200">
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Item Code
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Item Name
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Sales in Period
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Last Sale Date
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Days Since Last Sale
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Classification
                        </th>
                        <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {slowMoving.map((item) => (
                        <tr
                          key={item.itemId}
                          className="border-b border-gray-100 hover:bg-yellow-50 bg-amber-50/40"
                        >
                          <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">
                            {item.itemCode}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                            {item.itemName}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                            {item.salesInPeriod}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                            {item.lastSaleDate || "Never"}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                            {item.daysNoSale === Infinity ? "Never" : item.daysNoSale}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-[#d97706] font-medium text-right">
                            {item.classification}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              className={`h-6 px-2 text-[10px] font-semibold uppercase rounded ${reviewFlags.has(item.itemId) ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                              onClick={() => toggleReviewFlag(item.itemId)}
                            >
                              {reviewFlags.has(item.itemId) ? "Unflag" : "Flag"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Non-Moving Items */}
              <div>
                <div
                  className="bg-gray-50 p-2.5 flex justify-between items-center cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleGroup("nonmoving")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">
                      {expandedGroups.has("nonmoving") ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </span>
                    <span className="text-[11px] font-semibold text-gray-700 tracking-wide">
                      NON-MOVING ITEMS ({nonMoving.length})
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-gray-500">
                    Total Value:{" "}
                    {money(
                      nonMoving.reduce(
                        (sum, item) =>
                          sum + item.salesInPeriod * (getItemById(item.itemId)?.purchaseRate || 0),
                        0,
                      ),
                    )}
                  </span>
                </div>
                {expandedGroups.has("nonmoving") && (
                  <table className="w-full min-w-max border-collapse">
                    <thead>
                      <tr className="bg-white border-y border-gray-200">
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Item Code
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Item Name
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Sales in Period
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Last Sale Date
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Days Since Last Sale
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Classification
                        </th>
                        <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {nonMoving.map((item) => (
                        <tr
                          key={item.itemId}
                          className="border-b border-gray-100 hover:bg-red-50 bg-red-50/40"
                        >
                          <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">
                            {item.itemCode}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                            {item.itemName}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                            {item.salesInPeriod}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                            {item.lastSaleDate || "Never"}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                            {item.daysNoSale === Infinity ? "Never" : item.daysNoSale}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-[#dc2626] font-medium text-right">
                            {item.classification}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              className={`h-6 px-2 text-[10px] font-semibold uppercase rounded ${reviewFlags.has(item.itemId) ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                              onClick={() => toggleReviewFlag(item.itemId)}
                            >
                              {reviewFlags.has(item.itemId) ? "Unflag" : "Flag"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden max-w-full">
            <div className="p-4 border-b border-gray-200 bg-white">
              <h2 className="text-[13px] font-semibold text-gray-800 mb-4">Stock Aging Analysis</h2>

              {/* Summary Bars */}
              <div className="grid grid-cols-6 gap-3">
                {agingBucketTotals.map((total, index) => {
                  const totalValue = agingBucketTotals.reduce((sum, t) => sum + t.value, 0);
                  const pct = totalValue > 0 ? (total.value / totalValue) * 100 : 0;

                  return (
                    <div key={index} className="flex flex-col items-center">
                      <div className="w-full h-2 bg-gray-100 rounded-full mb-2 overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="bg-[#1557b0] h-full rounded-full transition-all duration-500"
                        ></div>
                      </div>
                      <div className="text-[10px] font-semibold text-gray-500 tracking-wide">
                        {["0-30", "31-60", "61-90", "91-180", "181-365", "365+"][index]} days
                      </div>
                      <div className="text-[11px] font-mono font-medium text-gray-800 mt-0.5">
                        {money(total.value)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th
                      className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                      rowSpan={2}
                    >
                      Item Name
                    </th>
                    <th
                      className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                      rowSpan={2}
                    >
                      Unit
                    </th>
                    {[
                      "0-30 days",
                      "31-60 days",
                      "61-90 days",
                      "91-180 days",
                      "181-365 days",
                      "365+ days",
                    ].map((label) => (
                      <th
                        key={label}
                        className="px-3 py-1.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-l border-gray-200"
                        colSpan={2}
                      >
                        {label}
                      </th>
                    ))}
                    <th
                      className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-l border-gray-200"
                      rowSpan={2}
                    >
                      Total Qty
                    </th>
                    <th
                      className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                      rowSpan={2}
                    >
                      Total Value
                    </th>
                  </tr>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    {Array(6)
                      .fill(0)
                      .map((_, i) => (
                        <React.Fragment key={i}>
                          <th className="px-2 py-1.5 text-right text-[9px] font-semibold text-gray-400 uppercase tracking-wide border-l border-gray-200">
                            Qty
                          </th>
                          <th className="px-2 py-1.5 text-right text-[9px] font-semibold text-gray-400 uppercase tracking-wide">
                            Value
                          </th>
                        </React.Fragment>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {stockAgingData.map((item, i) => (
                    <tr key={item.itemId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[12px] text-gray-700 font-medium">
                        {item.itemName}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-gray-500 text-center">
                        {item.unit}
                      </td>
                      {item.buckets.map((bucket, idx) => (
                        <React.Fragment key={idx}>
                          <td
                            className={`px-2 py-2 text-[11px] text-right border-l border-gray-100 ${bucket.qty > 0 ? "text-gray-700" : "text-gray-300"}`}
                          >
                            {bucket.qty || "-"}
                          </td>
                          <td
                            className={`px-2 py-2 text-[11px] text-right font-mono ${bucket.value > 0 ? "text-gray-700" : "text-gray-300"}`}
                          >
                            {bucket.value > 0 ? money(bucket.value) : "-"}
                          </td>
                        </React.Fragment>
                      ))}
                      <td className="px-3 py-2 text-[12px] font-medium text-gray-700 text-right border-l border-gray-200">
                        {item.totalQty}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono font-medium text-gray-700 text-right">
                        {money(item.totalValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 3 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden flex min-h-[400px]">
            {/* Sidebar - Warehouse List */}
            <div className="w-1/4 max-w-[250px] border-r border-gray-200 bg-gray-50 flex flex-col">
              <div className="p-3 border-b border-gray-200">
                <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  Warehouses
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {warehouses.length === 0 ? (
                  <div className="text-[11px] text-gray-500 p-2 text-center">
                    No warehouses configured
                  </div>
                ) : (
                  warehouses.map((warehouse) => (
                    <button
                      key={warehouse.id}
                      className={`w-full text-left px-3 py-2 text-[12px] rounded-md transition-colors ${
                        selectedWarehouseId === warehouse.id
                          ? "bg-[#1557b0] text-white font-medium shadow-sm"
                          : "text-gray-700 hover:bg-gray-200 font-medium"
                      }`}
                      onClick={() => setSelectedWarehouseId(warehouse.id)}
                    >
                      {warehouse.name}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Main Panel - Stock Details */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedWarehouseId ? (
                <>
                  <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-white">
                    <h3 className="text-[14px] font-semibold text-gray-800 flex items-center gap-2">
                      <Warehouse size={16} className="text-gray-400" />
                      {warehouses.find((w) => w.id === selectedWarehouseId)?.name}
                    </h3>
                    <div className="flex gap-4 items-center">
                      <div className="text-[12px]">
                        <span className="text-gray-500 mr-1">Total Value:</span>
                        <span className="font-mono font-bold text-gray-800">
                          {money(godownTotalValue)}
                        </span>
                      </div>
                      <button
                        className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
                        onClick={exportTab4ToExcel}
                      >
                        <Download size={14} />
                        Export
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto">
                    <table className="w-full min-w-max border-collapse">
                      <thead className="sticky top-0 bg-[#f5f6fa] shadow-sm z-10">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                            Item Code
                          </th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                            Item Name
                          </th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                            Opening Qty
                          </th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 text-[#059669]">
                            Received
                          </th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 text-[#dc2626]">
                            Issued
                          </th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                            Closing Qty
                          </th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                            Unit
                          </th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {godownStockData.map((item) => (
                          <tr
                            key={item.itemId}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >
                            <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">
                              {item.itemCode}
                            </td>
                            <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                              {item.itemName}
                            </td>
                            <td className="px-3 py-2.5 text-[12px] text-gray-500 text-right">
                              {item.openingQty}
                            </td>
                            <td className="px-3 py-2.5 text-[12px] text-[#059669] font-medium text-right">
                              {item.received}
                            </td>
                            <td className="px-3 py-2.5 text-[12px] text-[#dc2626] font-medium text-right">
                              {item.issued}
                            </td>
                            <td className="px-3 py-2.5 text-[12px] text-gray-800 font-semibold text-right">
                              {item.closingQty}
                            </td>
                            <td className="px-3 py-2.5 text-[11px] text-gray-500 text-center">
                              {item.unit}
                            </td>
                            <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right font-mono">
                              {money(item.value)}
                            </td>
                          </tr>
                        ))}
                        {godownStockData.length === 0 && (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-gray-500 text-[12px]">
                              No stock movements found for this warehouse.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                  <Warehouse size={48} className="mb-4 text-gray-300" />
                  <p className="text-[13px] font-medium">
                    Please select a warehouse from the sidebar
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 4 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden max-w-full">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Category / Item
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Items Count
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Total Qty
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Total Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categoryValuationData.map((group) => (
                    <React.Fragment key={group.groupId}>
                      <tr
                        className="bg-gray-50 hover:bg-gray-100 border-b border-gray-200 cursor-pointer"
                        onClick={() => toggleGroup(group.groupId)}
                      >
                        <td className="px-3 py-2.5 text-[12px] font-semibold text-gray-800">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">
                              {expandedGroups.has(group.groupId) ? (
                                <ChevronDown size={14} />
                              ) : (
                                <ChevronRight size={14} />
                              )}
                            </span>
                            {group.groupName}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] font-medium text-gray-600 text-right">
                          {group.itemCount}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] font-semibold text-gray-800 text-right">
                          {group.totalQty}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] font-mono font-bold text-[#1557b0] text-right">
                          {money(group.totalValue)}
                        </td>
                      </tr>

                      {expandedGroups.has(group.groupId) &&
                        group.items.map((item) => (
                          <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="pl-9 pr-3 py-2 text-[12px] text-gray-700">
                              {item.name}
                            </td>
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2 text-[12px] text-gray-600 text-right">
                              {item.qty}
                            </td>
                            <td className="px-3 py-2 text-[12px] text-gray-600 text-right font-mono">
                              {money(item.value)}
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  ))}
                  {categoryValuationData.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500 text-[12px]">
                        No items found in inventory.
                      </td>
                    </tr>
                  )}
                  {categoryValuationData.length > 0 && (
                    <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                      <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800">
                        GRAND TOTAL
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-right">
                        {categoryValuationData.reduce((sum, group) => sum + group.itemCount, 0)}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-right">
                        {categoryValuationData.reduce((sum, group) => sum + group.totalQty, 0)}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-right font-mono">
                        {money(
                          categoryValuationData.reduce((sum, group) => sum + group.totalValue, 0),
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryAnalysis;
