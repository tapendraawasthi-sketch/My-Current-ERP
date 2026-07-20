import React, { useState, useMemo } from "react";
import { TrendingUp, Users, Package, BarChart2, Download, ArrowUp, ArrowDown } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { useStore } from "@/store/useStore";
import * as XLSX from "xlsx";
import { useBranchFilter } from "@/hooks/useBranchFilter";

// Types
interface PartyAnalysis {
  partyId: string;
  partyName: string;
  totalAmount: number;
  invoiceCount: number;
  avgInvoiceValue: number;
  lastTransactionDate: string;
  growthPct: number; // compared to previous period (computed as 0 if no previous data)
}

interface ItemAnalysis {
  itemId: string;
  itemName: string;
  totalQty: number;
  totalAmount: number;
  transactionCount: number;
  avgRate: number;
  grossProfit: number; // totalAmount - (totalQty * avgPurchaseRate)
  grossMarginPct: number;
}

interface MonthlyTrend {
  month: string; // "Baisakh", "Jestha", etc.
  salesAmount: number;
  purchaseAmount: number;
  grossProfit: number;
}

// Constants
const CHART_COLORS = [
  "var(--ds-action-primary)",
  "#059669",
  "#d97706",
  "#dc2626",
  "#0284c7",
  "#7c3aed",
  "#db2777",
  "#ea580c",
];
const NEPALI_MONTHS = [
  "Baisakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

// Compute functions
const computeTopParties = (
  invoices: any[],
  partyType: "customer" | "vendor",
  topN: number,
): PartyAnalysis[] => {
  if (!invoices || invoices.length === 0) return [];

  const relevantInvoices = invoices.filter((inv) => {
    if (partyType === "customer") {
      return inv.type === "SALES" || inv.type === "SALES_INVOICE";
    } else {
      return inv.type === "PURCHASE" || inv.type === "PURCHASE_INVOICE";
    }
  });

  if (relevantInvoices.length === 0) return [];

  const grouped = relevantInvoices.reduce(
    (acc, inv) => {
      const partyKey = inv.partyName || inv.partyId || "Unknown";
      const amount = inv.netTotal ?? inv.grandTotal ?? inv.totalAmount ?? 0;

      if (!acc[partyKey]) {
        acc[partyKey] = {
          partyId: inv.partyId || "unknown",
          partyName: partyKey,
          totalAmount: 0,
          invoiceCount: 0,
          lastTransactionDate: inv.date || inv.invoiceDate || "",
        };
      }

      acc[partyKey].totalAmount += amount;
      acc[partyKey].invoiceCount += 1;
      if (
        new Date(inv.date || inv.invoiceDate || "") > new Date(acc[partyKey].lastTransactionDate)
      ) {
        acc[partyKey].lastTransactionDate = inv.date || inv.invoiceDate || "";
      }

      return acc;
    },
    {} as Record<string, any>,
  );

  const result: PartyAnalysis[] = (Object.values(grouped) as any[]).map((p) => ({
    partyId: p.partyId,
    partyName: p.partyName,
    totalAmount: p.totalAmount,
    invoiceCount: p.invoiceCount,
    avgInvoiceValue: p.totalAmount / p.invoiceCount,
    lastTransactionDate: p.lastTransactionDate,
    growthPct: 0, // Placeholder, would require historical comparison
  }));

  return result.sort((a, b) => b.totalAmount - a.totalAmount).slice(0, topN);
};

const computeTopItems = (
  invoices: any[],
  itemType: "sales" | "purchase",
  topN: number,
): ItemAnalysis[] => {
  if (!invoices || invoices.length === 0) return [];

  const relevantInvoices = invoices.filter((inv) => {
    if (itemType === "sales") {
      return inv.type === "SALES" || inv.type === "SALES_INVOICE";
    } else {
      return inv.type === "PURCHASE" || inv.type === "PURCHASE_INVOICE";
    }
  });

  if (relevantInvoices.length === 0) return [];

  const allLines: any[] = [];
  relevantInvoices.forEach((inv) => {
    if (inv.lines && Array.isArray(inv.lines)) {
      inv.lines.forEach((line) => {
        allLines.push({ ...line, invoiceType: inv.type });
      });
    }
  });

  if (allLines.length === 0) return [];

  const grouped = allLines.reduce(
    (acc, line) => {
      const itemName = line.itemName || line.name || "Unknown";
      const qty = line.qty || line.quantity || 0;
      const amount = line.amount || (line.rate || 0) * qty || 0;

      if (!acc[itemName]) {
        acc[itemName] = {
          itemId: line.itemId || "unknown",
          itemName,
          totalQty: 0,
          totalAmount: 0,
          transactionCount: 0,
          totalCost: 0, // Placeholder for purchase rate calculation
        };
      }

      acc[itemName].totalQty += qty;
      acc[itemName].totalAmount += amount;
      acc[itemName].transactionCount += 1;

      return acc;
    },
    {} as Record<string, any>,
  );

  const result: ItemAnalysis[] = (Object.values(grouped) as any[]).map((item) => ({
    itemId: item.itemId,
    itemName: item.itemName,
    totalQty: item.totalQty,
    totalAmount: item.totalAmount,
    transactionCount: item.transactionCount,
    avgRate: item.totalAmount / item.totalQty,
    grossProfit: 0, // Placeholder - would need purchase rates
    grossMarginPct: 0, // Placeholder
  }));

  return result.sort((a, b) => b.totalAmount - a.totalAmount).slice(0, topN);
};

const computeMonthlyTrend = (invoices: any[], months: number): MonthlyTrend[] => {
  if (!invoices || invoices.length === 0) return [];

  // Get the current Nepali month index
  const now = new Date();
  const currentMonthIndex = now.getMonth(); // 0-11

  // Get the start month for the range
  const startMonthIndex = (currentMonthIndex - months + 1 + 12) % 12;

  // Create a map of month names to objects
  const monthMap: Record<string, MonthlyTrend> = {};
  for (let i = 0; i < months; i++) {
    const monthIndex = (startMonthIndex + i) % 12;
    const monthName = NEPALI_MONTHS[monthIndex];
    monthMap[monthName] = {
      month: monthName,
      salesAmount: 0,
      purchaseAmount: 0,
      grossProfit: 0,
    };
  }

  // Process invoices
  invoices.forEach((inv) => {
    const dateStr = inv.dateNepali || inv.date || inv.invoiceDate;
    if (!dateStr) return;

    // Extract month from date (assuming format YYYY-MM-DD or similar)
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return;

    const monthIndex = date.getMonth();
    const monthName = NEPALI_MONTHS[monthIndex];

    // Only process if the month is in our range
    if (!monthMap[monthName]) return;

    const amount = inv.netTotal ?? inv.grandTotal ?? inv.totalAmount ?? 0;

    if (inv.type === "SALES" || inv.type === "SALES_INVOICE") {
      monthMap[monthName].salesAmount += amount;
    } else if (inv.type === "PURCHASE" || inv.type === "PURCHASE_INVOICE") {
      monthMap[monthName].purchaseAmount += amount;
    }
  });

  // Convert to array and sort by month order
  const result: MonthlyTrend[] = [];
  for (let i = 0; i < months; i++) {
    const monthIndex = (startMonthIndex + i) % 12;
    const monthName = NEPALI_MONTHS[monthIndex];
    if (monthMap[monthName]) {
      result.push(monthMap[monthName]);
    }
  }

  return result;
};

const SalesPurchaseAnalysis: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"customers" | "vendors" | "items" | "trends">(
    "customers",
  );
  const [topN, setTopN] = useState<number>(10);
  const [trendMonths, setTrendMonths] = useState<number>(6);
  const [itemType, setItemType] = useState<"sales" | "purchase">("sales");
  const [filterPeriod, setFilterPeriod] = useState<
    "thisYear" | "thisQuarter" | "thisMonth" | "custom"
  >("thisYear");

  const { invoices, vouchers } = useStore();
  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();
  const allInvoices = useMemo(() => {
    const scopedInvoices = (invoices ?? []).filter((inv) =>
      matchBranch((inv as { branchId?: string }).branchId),
    );
    const scopedVouchers = (vouchers ?? []).filter(
      (v) =>
        (v.type === "SALES" || v.type === "PURCHASE") &&
        matchBranch((v as { branchId?: string }).branchId),
    );
    return [...scopedInvoices, ...scopedVouchers];
  }, [invoices, vouchers, matchBranch, branchFilter]);

  const topCustomers = useMemo(
    () => computeTopParties(allInvoices, "customer", topN),
    [allInvoices, topN],
  );
  const topVendors = useMemo(
    () => computeTopParties(allInvoices, "vendor", topN),
    [allInvoices, topN],
  );
  const topItems = useMemo(
    () => computeTopItems(allInvoices, itemType, topN),
    [allInvoices, itemType, topN],
  );
  const monthlyTrend = useMemo(
    () => computeMonthlyTrend(allInvoices, trendMonths),
    [allInvoices, trendMonths],
  );

  // KPI calculations
  const totalSales = allInvoices
    .filter((inv) => inv.type === "SALES" || inv.type === "SALES_INVOICE")
    .reduce((sum, inv) => sum + (inv.netTotal ?? inv.grandTotal ?? inv.totalAmount ?? 0), 0);

  const totalPurchases = allInvoices
    .filter((inv) => inv.type === "PURCHASE" || inv.type === "PURCHASE_INVOICE")
    .reduce((sum, inv) => sum + (inv.netTotal ?? inv.grandTotal ?? inv.totalAmount ?? 0), 0);

  const topCustomer = topCustomers[0] || { partyName: "None", totalAmount: 0 };
  const topItem = topItems[0] || { itemName: "None", totalQty: 0 };

  // Export function
  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    // Top Customers Sheet
    if (topCustomers.length > 0) {
      const customerData = topCustomers.map((c, i) => ({
        Rank: i + 1,
        "Party Name": c.partyName,
        "Invoice Count": c.invoiceCount,
        "Total Amount": c.totalAmount,
        "Avg Invoice Value": c.avgInvoiceValue,
        "Last Transaction": c.lastTransactionDate,
      }));
      const ws1 = XLSX.utils.json_to_sheet(customerData);
      XLSX.utils.book_append_sheet(wb, ws1, "Top Customers");
    }

    // Top Vendors Sheet
    if (topVendors.length > 0) {
      const vendorData = topVendors.map((v, i) => ({
        Rank: i + 1,
        "Party Name": v.partyName,
        "Invoice Count": v.invoiceCount,
        "Total Amount": v.totalAmount,
        "Avg Invoice Value": v.avgInvoiceValue,
        "Last Transaction": v.lastTransactionDate,
      }));
      const ws2 = XLSX.utils.json_to_sheet(vendorData);
      XLSX.utils.book_append_sheet(wb, ws2, "Top Vendors");
    }

    // Top Items Sheet
    if (topItems.length > 0) {
      const itemData = topItems.map((i, j) => ({
        Rank: j + 1,
        "Item Name": i.itemName,
        "Total Qty": i.totalQty,
        "Total Amount": i.totalAmount,
        "Avg Rate": i.avgRate,
        "Gross Margin %": i.grossMarginPct,
      }));
      const ws3 = XLSX.utils.json_to_sheet(itemData);
      XLSX.utils.book_append_sheet(wb, ws3, "Top Items");
    }

    // Monthly Trends Sheet
    if (monthlyTrend.length > 0) {
      const trendData = monthlyTrend.map((t) => ({
        Month: t.month,
        "Sales Amount": t.salesAmount,
        "Purchase Amount": t.purchaseAmount,
        "Gross Profit": t.grossProfit,
      }));
      const ws4 = XLSX.utils.json_to_sheet(trendData);
      XLSX.utils.book_append_sheet(wb, ws4, "Monthly Trends");
    }

    XLSX.writeFile(wb, "SalesPurchaseAnalysis.xlsx");
  };

  // Render rank icons
  const renderRankIcon = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return rank;
  };

  // Render margin percentage with color
  const renderMarginCell = (margin: number) => {
    let color = "text-gray-700";
    if (margin > 20) color = "text-green-600";
    else if (margin > 10) color = "text-amber-600";
    else if (margin < 0) color = "text-red-600";

    return <span className={color}>{margin.toFixed(2)}%</span>;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 pb-20">
      <div className="p-4 bg-white border-b border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Sales & Purchase Analysis</h1>
            <p className="text-sm text-gray-600">
              Top customers, vendors, products and business trends
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {branchOptions.length > 0 && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-9 px-3 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                aria-label="Branch"
              >
                <option value="all">All branches</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.code || b.id}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-[var(--ds-action-primary)] rounded-md hover:bg-[var(--ds-action-primary-hover)]"
            >
              <Download className="h-4 w-4" />
              Export Report
            </button>
            <select
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="h-9 px-3 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            >
              {[5, 10, 20].map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value as any)}
              className="h-9 px-3 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            >
              <option value="thisYear">This Year</option>
              <option value="thisQuarter">This Quarter</option>
              <option value="thisMonth">This Month</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-4 gap-4 p-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Total Sales</p>
          <p className="text-lg font-bold text-gray-900">
            Rs. {totalSales.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Total Purchases</p>
          <p className="text-lg font-bold text-gray-900">
            Rs. {totalPurchases.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Top Customer</p>
          <p className="text-lg font-bold text-gray-900">{topCustomer.partyName}</p>
          <p className="text-sm text-gray-600">
            Rs. {topCustomer.totalAmount.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Top Item</p>
          <p className="text-lg font-bold text-gray-900">{topItem.itemName}</p>
          <p className="text-sm text-gray-600">{topItem.totalQty} units</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        {(["customers", "vendors", "items", "trends"] as const).map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              activeTab === tab
                ? "text-[var(--ds-action-primary)] border-b-2 border-[var(--ds-action-primary)]"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "customers" && "Top Customers"}
            {tab === "vendors" && "Top Vendors"}
            {tab === "items" && "Top Items"}
            {tab === "trends" && "Monthly Trends"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Top Customers Tab */}
        {activeTab === "customers" && (
          <div className="space-y-6">
            {topCustomers.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                No sales data found. Start by creating invoices.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Table */}
                  <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                              Rank
                            </th>
                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                              Party Name
                            </th>
                            <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                              Invoice Count
                            </th>
                            <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                              Total Amount
                            </th>
                            <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                              Avg Invoice
                            </th>
                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                              Last Transaction
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {topCustomers.map((customer, index) => (
                            <tr key={customer.partyId} className="hover:bg-gray-50">
                              <td className="px-4 py-2 whitespace-nowrap text-[12px] text-gray-700">
                                {renderRankIcon(index + 1)}
                              </td>
                              <td className="px-4 py-2 text-[12px] text-gray-700">
                                {customer.partyName}
                              </td>
                              <td className="px-4 py-2 text-right text-[12px] text-gray-700">
                                {customer.invoiceCount}
                              </td>
                              <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                                Rs. {customer.totalAmount.toLocaleString("en-IN")}
                              </td>
                              <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                                Rs.{" "}
                                {customer.avgInvoiceValue.toLocaleString("en-IN", {
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-4 py-2 text-[12px] text-gray-700">
                                {customer.lastTransactionDate}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Horizontal Bar Chart */}
                    <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
                      <h3 className="text-md font-semibold mb-4">Top Customers - Amount</h3>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart
                          layout="vertical"
                          data={topCustomers.slice(0, 10)}
                          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis
                            type="category"
                            dataKey="partyName"
                            width={90}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip
                            formatter={(value) => [
                              `Rs. ${Number(value).toLocaleString("en-IN")}`,
                              "Amount",
                            ]}
                          />
                          <Bar dataKey="totalAmount" fill="var(--ds-action-primary)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Right: Pie Chart */}
                  <div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <h3 className="text-md font-semibold mb-4">Top 5 Customers Distribution</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={topCustomers.slice(0, 5)}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="totalAmount"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {topCustomers.slice(0, 5).map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => [
                              `Rs. ${Number(value).toLocaleString("en-IN")}`,
                              "Amount",
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-4 text-center">
                        <p className="text-sm font-medium">
                          Total: Rs.{" "}
                          {topCustomers
                            .reduce((sum, c) => sum + c.totalAmount, 0)
                            .toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Top Vendors Tab */}
        {activeTab === "vendors" && (
          <div className="space-y-6">
            {topVendors.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                No purchase data found. Start by creating invoices.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Table */}
                  <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                              Rank
                            </th>
                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                              Party Name
                            </th>
                            <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                              Invoice Count
                            </th>
                            <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                              Total Amount
                            </th>
                            <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                              Avg Invoice
                            </th>
                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                              Last Transaction
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {topVendors.map((vendor, index) => (
                            <tr key={vendor.partyId} className="hover:bg-gray-50">
                              <td className="px-4 py-2 whitespace-nowrap text-[12px] text-gray-700">
                                {renderRankIcon(index + 1)}
                              </td>
                              <td className="px-4 py-2 text-[12px] text-gray-700">
                                {vendor.partyName}
                              </td>
                              <td className="px-4 py-2 text-right text-[12px] text-gray-700">
                                {vendor.invoiceCount}
                              </td>
                              <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                                Rs. {vendor.totalAmount.toLocaleString("en-IN")}
                              </td>
                              <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                                Rs.{" "}
                                {vendor.avgInvoiceValue.toLocaleString("en-IN", {
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-4 py-2 text-[12px] text-gray-700">
                                {vendor.lastTransactionDate}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Horizontal Bar Chart */}
                    <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
                      <h3 className="text-md font-semibold mb-4">Top Vendors - Amount</h3>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart
                          layout="vertical"
                          data={topVendors.slice(0, 10)}
                          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis
                            type="category"
                            dataKey="partyName"
                            width={90}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip
                            formatter={(value) => [
                              `Rs. ${Number(value).toLocaleString("en-IN")}`,
                              "Amount",
                            ]}
                          />
                          <Bar dataKey="totalAmount" fill="var(--ds-action-primary)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Right: Pie Chart */}
                  <div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <h3 className="text-md font-semibold mb-4">Top 5 Vendors Distribution</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={topVendors.slice(0, 5)}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="totalAmount"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {topVendors.slice(0, 5).map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => [
                              `Rs. ${Number(value).toLocaleString("en-IN")}`,
                              "Amount",
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-4 text-center">
                        <p className="text-sm font-medium">
                          Total: Rs.{" "}
                          {topVendors
                            .reduce((sum, v) => sum + v.totalAmount, 0)
                            .toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Top Items Tab */}
        {activeTab === "items" && (
          <div className="space-y-6">
            {topItems.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                No {itemType} data found. Start by creating invoices.
              </div>
            ) : (
              <>
                <div className="flex gap-4 mb-4">
                  <button
                    className={`px-4 py-2 text-sm font-medium rounded-md ${
                      itemType === "sales"
                        ? "bg-[var(--ds-action-primary)] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    onClick={() => setItemType("sales")}
                  >
                    Sales Items
                  </button>
                  <button
                    className={`px-4 py-2 text-sm font-medium rounded-md ${
                      itemType === "purchase"
                        ? "bg-[var(--ds-action-primary)] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    onClick={() => setItemType("purchase")}
                  >
                    Purchase Items
                  </button>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          Rank
                        </th>
                        <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          Item Name
                        </th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          Total Qty
                        </th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          Total Amount
                        </th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          Avg Rate
                        </th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          Gross Margin %
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {topItems.map((item, index) => (
                        <tr key={item.itemId} className="hover:bg-gray-50">
                          <td className="px-4 py-2 whitespace-nowrap text-[12px] text-gray-700">
                            {renderRankIcon(index + 1)}
                          </td>
                          <td className="px-4 py-2 text-[12px] text-gray-700">{item.itemName}</td>
                          <td className="px-4 py-2 text-right text-[12px] text-gray-700">
                            {item.totalQty}
                          </td>
                          <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                            Rs. {item.totalAmount.toLocaleString("en-IN")}
                          </td>
                          <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                            Rs. {item.avgRate.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2 text-right text-[12px] text-gray-700">
                            {renderMarginCell(item.grossMarginPct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bar Chart for Items */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-md font-semibold mb-4">Top Items - Amount</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      layout="vertical"
                      data={topItems.slice(0, 10)}
                      margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis
                        type="category"
                        dataKey="itemName"
                        width={90}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value) => [
                          `Rs. ${Number(value).toLocaleString("en-IN")}`,
                          "Amount",
                        ]}
                      />
                      <Bar dataKey="totalAmount" fill="var(--ds-action-primary)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}

        {/* Monthly Trends Tab */}
        {activeTab === "trends" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Last</label>
              <select
                value={trendMonths}
                onChange={(e) => setTrendMonths(Number(e.target.value))}
                className="h-9 px-3 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
              >
                {[3, 6, 12].map((n) => (
                  <option key={n} value={n}>
                    {n} months
                  </option>
                ))}
              </select>
            </div>

            {monthlyTrend.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                No trend data found. Start by creating invoices.
              </div>
            ) : (
              <>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-md font-semibold mb-4">Sales vs Purchase vs Gross Profit</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={monthlyTrend}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => [
                          `Rs. ${Number(value).toLocaleString("en-IN")}`,
                          "Amount",
                        ]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="salesAmount"
                        stroke="var(--ds-action-primary)"
                        name="Sales"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="purchaseAmount"
                        stroke="#d97706"
                        name="Purchases"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="grossProfit"
                        stroke="#059669"
                        name="Gross Profit"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          Month
                        </th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          Sales
                        </th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          Purchases
                        </th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          Gross Profit
                        </th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          Margin %
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {monthlyTrend.map((trend, index) => {
                        const marginPct =
                          trend.salesAmount > 0 ? (trend.grossProfit / trend.salesAmount) * 100 : 0;

                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap text-[12px] text-gray-700">
                              {trend.month}
                            </td>
                            <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                              Rs. {trend.salesAmount.toLocaleString("en-IN")}
                            </td>
                            <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                              Rs. {trend.purchaseAmount.toLocaleString("en-IN")}
                            </td>
                            <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                              Rs. {trend.grossProfit.toLocaleString("en-IN")}
                            </td>
                            <td className="px-4 py-2 text-right text-[12px]">
                              <span className={marginPct >= 0 ? "text-green-600" : "text-red-600"}>
                                {marginPct.toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Comparison Card */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-md font-semibold mb-2">Month-over-Month Comparison</h3>
                  <div className="flex items-center gap-4">
                    {monthlyTrend.length > 1 && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Sales:</span>
                          {monthlyTrend[monthlyTrend.length - 1].salesAmount >=
                          monthlyTrend[monthlyTrend.length - 2].salesAmount ? (
                            <div className="flex items-center gap-1">
                              <ArrowUp className="h-4 w-4 text-green-600" />
                              <span className="text-green-600">
                                +
                                {(
                                  ((monthlyTrend[monthlyTrend.length - 1].salesAmount -
                                    monthlyTrend[monthlyTrend.length - 2].salesAmount) /
                                    monthlyTrend[monthlyTrend.length - 2].salesAmount) *
                                  100
                                ).toFixed(2)}
                                %
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <ArrowDown className="h-4 w-4 text-red-600" />
                              <span className="text-red-600">
                                {(
                                  ((monthlyTrend[monthlyTrend.length - 1].salesAmount -
                                    monthlyTrend[monthlyTrend.length - 2].salesAmount) /
                                    monthlyTrend[monthlyTrend.length - 2].salesAmount) *
                                  100
                                ).toFixed(2)}
                                %
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Purchases:</span>
                          {monthlyTrend[monthlyTrend.length - 1].purchaseAmount >=
                          monthlyTrend[monthlyTrend.length - 2].purchaseAmount ? (
                            <div className="flex items-center gap-1">
                              <ArrowUp className="h-4 w-4 text-green-600" />
                              <span className="text-green-600">
                                +
                                {(
                                  ((monthlyTrend[monthlyTrend.length - 1].purchaseAmount -
                                    monthlyTrend[monthlyTrend.length - 2].purchaseAmount) /
                                    monthlyTrend[monthlyTrend.length - 2].purchaseAmount) *
                                  100
                                ).toFixed(2)}
                                %
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <ArrowDown className="h-4 w-4 text-red-600" />
                              <span className="text-red-600">
                                {(
                                  ((monthlyTrend[monthlyTrend.length - 1].purchaseAmount -
                                    monthlyTrend[monthlyTrend.length - 2].purchaseAmount) /
                                    monthlyTrend[monthlyTrend.length - 2].purchaseAmount) *
                                  100
                                ).toFixed(2)}
                                %
                              </span>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesPurchaseAnalysis;
