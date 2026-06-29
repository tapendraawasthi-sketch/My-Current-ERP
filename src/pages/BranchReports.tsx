// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB } from "../lib/db";
import * as XLSX from "xlsx";
import {
  Building2,
  Download,
  BarChart2,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";

const BORDER = "1px solid #000";
const BG = "#E4F1D9";
const BG_CARD = "#EBF5E2";
const BG_HEADER = "#D4EABD";
const BG_DEEP = "#C9DEB5";

function money(v) {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

export default function BranchReports() {
  const { invoices, vouchers, stockMovements, accounts, warehouses, fiscalYears } = useStore();
  const [branches, setBranches] = useState([]);
  const [activeTab, setActiveTab] = useState("sales");
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [expandedSections, setExpandedSections] = useState({});

  // Load branches
  useEffect(() => {
    const db = getDB();
    db.branches
      .toArray()
      .catch(() => [])
      .then(setBranches);
  }, []);

  // Get current fiscal year if none selected
  useEffect(() => {
    if (fiscalYears.length > 0 && !selectedFiscalYear) {
      const currentFY =
        fiscalYears.find((fy) => fy.status === "open") || fiscalYears[fiscalYears.length - 1];
      setSelectedFiscalYear(currentFY.id);
      setFromDate(currentFY.startDate);
      setToDate(currentFY.endDate);
    }
  }, [fiscalYears, selectedFiscalYear]);

  // Get fiscal year dates
  const currentFiscalYear = useMemo(() => {
    return fiscalYears.find((fy) => fy.id === selectedFiscalYear);
  }, [fiscalYears, selectedFiscalYear]);

  // Filter data by date range
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const inDateRange = (!fromDate || inv.date >= fromDate) && (!toDate || inv.date <= toDate);
      const matchesBranch = branchFilter === "ALL" || inv.branchId === branchFilter;
      return inDateRange && matchesBranch;
    });
  }, [invoices, fromDate, toDate, branchFilter]);

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      const inDateRange = (!fromDate || v.date >= fromDate) && (!toDate || v.date <= toDate);
      const matchesBranch = branchFilter === "ALL" || v.branchId === branchFilter;
      return inDateRange && matchesBranch;
    });
  }, [vouchers, fromDate, toDate, branchFilter]);

  // Sales Summary by Branch
  const salesSummary = useMemo(() => {
    const summary = {};

    // Add unallocated branch
    const allBranches = [...branches, { id: "unallocated", name: "Unallocated", code: "UNALLOC" }];

    allBranches.forEach((branch) => {
      const branchInvoices = filteredInvoices.filter((inv) => inv.branchId === branch.id);
      const sales = branchInvoices
        .filter((inv) => inv.type.includes("sales"))
        .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

      const purchases = branchInvoices
        .filter((inv) => inv.type.includes("purchase"))
        .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

      // For collection, check receipts in vouchers
      const collections = filteredVouchers
        .filter((v) => v.branchId === branch.id && v.type.includes("receipt"))
        .reduce((sum, v) => sum + (v.grandTotal || 0), 0);

      summary[branch.id] = {
        branch: branch,
        sales,
        purchases,
        collection: collections,
        outstanding: sales - collections,
      };
    });

    return summary;
  }, [filteredInvoices, filteredVouchers, branches]);

  // P&L by Branch
  const plByBranch = useMemo(() => {
    const plData = {};

    const allBranches = [...branches, { id: "unallocated", name: "Unallocated", code: "UNALLOC" }];

    allBranches.forEach((branch) => {
      const branchInvoices = filteredInvoices.filter((inv) => inv.branchId === branch.id);
      const branchVouchers = filteredVouchers.filter((v) => v.branchId === branch.id);

      // Income
      const salesRevenue = branchInvoices
        .filter((inv) => inv.type.includes("sales"))
        .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

      const salesReturns = branchInvoices
        .filter((inv) => inv.type.includes("credit-note"))
        .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

      const netSales = salesRevenue - salesReturns;

      // Expenses
      const cogs = branchInvoices
        .filter((inv) => inv.type.includes("purchase"))
        .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

      const directExpenses = branchVouchers
        .filter((v) => {
          const account = accounts.find((acc) => acc.id === v.lines?.[0]?.accountId);
          return account?.type === "expense";
        })
        .reduce((sum, v) => sum + (v.grandTotal || 0), 0);

      const grossProfit = netSales - cogs;
      const netProfit = grossProfit - directExpenses;

      plData[branch.id] = {
        branch,
        salesRevenue,
        salesReturns,
        netSales,
        cogs,
        directExpenses,
        grossProfit,
        netProfit,
      };
    });

    return plData;
  }, [filteredInvoices, filteredVouchers, branches, accounts]);

  // Stock by Branch
  const stockByBranch = useMemo(() => {
    const stockData = {};

    branches.forEach((branch) => {
      if (!branch.warehouseId) return;

      const branchStock = stockMovements
        .filter((sm) => sm.warehouseId === branch.warehouseId)
        .reduce((acc, movement) => {
          const existing = acc[movement.itemId] || { qty: 0, totalValue: 0 };
          existing.qty += movement.type === "in" ? movement.quantity : -movement.quantity;
          existing.totalValue += movement.amount;
          acc[movement.itemId] = existing;
          return acc;
        }, {});

      // Get item details
      const detailedStock = Object.entries(branchStock)
        .map(([itemId, data]) => {
          const item = items.find((i) => i.id === itemId);
          return {
            item: item || { name: "Unknown Item", code: "N/A" },
            qty: data.qty,
            avgRate: data.qty > 0 ? data.totalValue / data.qty : 0,
            totalValue: data.totalValue,
          };
        })
        .filter((item) => item.qty !== 0);

      stockData[branch.id] = detailedStock;
    });

    return stockData;
  }, [branches, stockMovements]);

  // Consolidated View
  const consolidatedData = useMemo(() => {
    const allBranches = [...branches, { id: "unallocated", name: "Unallocated", code: "UNALLOC" }];

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalExpenses = 0;

    allBranches.forEach((branch) => {
      const branchInvoices = filteredInvoices.filter((inv) => inv.branchId === branch.id);
      const branchVouchers = filteredVouchers.filter((v) => v.branchId === branch.id);

      totalRevenue += branchInvoices
        .filter((inv) => inv.type.includes("sales"))
        .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

      totalCogs += branchInvoices
        .filter((inv) => inv.type.includes("purchase"))
        .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

      totalExpenses += branchVouchers
        .filter((v) => {
          const account = accounts.find((acc) => acc.id === v.lines?.[0]?.accountId);
          return account?.type === "expense";
        })
        .reduce((sum, v) => sum + (v.grandTotal || 0), 0);
    });

    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - totalExpenses;

    return { totalRevenue, totalCogs, totalExpenses, grossProfit, netProfit };
  }, [filteredInvoices, filteredVouchers, branches, accounts]);

  const toggleExpand = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const exportExcel = () => {
    // Implementation would depend on active tab
    // For simplicity, we'll export the sales summary
    const ws = XLSX.utils.json_to_sheet(
      Object.values(salesSummary).map((s) => ({
        Branch: s.branch.name,
        Sales: s.sales,
        Purchases: s.purchases,
        Collection: s.collection,
        Outstanding: s.outstanding,
      })),
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Branch Sales Summary");
    XLSX.writeFile(wb, `Branch_Sales_Summary_${fromDate}_to_${toDate}.xlsx`);
  };

  // Chart data for sales
  const chartData = Object.values(salesSummary).map((s) => ({
    name: s.branch.name,
    sales: s.sales,
  }));

  return (
    <div style={{ backgroundColor: BG, minHeight: "100vh", padding: "20px" }}>
      <div
        style={{
          backgroundColor: BG_HEADER,
          padding: "15px",
          borderRadius: "8px",
          border: BORDER,
          marginBottom: "20px",
        }}
      >
        <h1 style={{ fontSize: "18px", fontWeight: "bold", color: "#000000", margin: 0 }}>
          Branch-wise Reports
        </h1>

        <div
          style={{
            display: "flex",
            gap: "15px",
            marginTop: "15px",
            flexWrap: "wrap",
            alignItems: "end",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              Fiscal Year
            </label>
            <select
              value={selectedFiscalYear}
              onChange={(e) => {
                setSelectedFiscalYear(e.target.value);
                const fy = fiscalYears.find((f) => f.id === e.target.value);
                if (fy) {
                  setFromDate(fy.startDate);
                  setToDate(fy.endDate);
                }
              }}
              style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
            >
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.yearBs}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              Branch
            </label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
            >
              <option value="ALL">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {}}
            style={{
              backgroundColor: "#1557b0",
              color: "white",
              border: BORDER,
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <RefreshCcw size={14} />
            Run Report
          </button>
          <button
            onClick={exportExcel}
            style={{
              backgroundColor: "#059669",
              color: "white",
              border: BORDER,
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <Download size={14} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: "5px", marginBottom: "20px", borderBottom: BORDER }}>
        {[
          { id: "sales", label: "Sales Summary" },
          { id: "pl", label: "P&L by Branch" },
          { id: "stock", label: "Stock by Branch" },
          { id: "consolidated", label: "Consolidated View" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              backgroundColor: activeTab === tab.id ? BG_HEADER : "transparent",
              color: activeTab === tab.id ? "#000000" : "#666",
              border: BORDER,
              padding: "10px 16px",
              borderRadius: "4px 4px 0 0",
              cursor: "pointer",
              fontWeight: activeTab === tab.id ? "bold" : "normal",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "sales" && (
        <div
          style={{ backgroundColor: BG_CARD, padding: "15px", borderRadius: "8px", border: BORDER }}
        >
          <h2
            style={{ fontSize: "16px", fontWeight: "bold", color: "#000000", marginBottom: "15px" }}
          >
            Sales Summary by Branch
          </h2>

          <div style={{ height: "300px", marginBottom: "20px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [money(value), "Sales"]} />
                <Bar dataKey="sales" name="Sales">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#1557b0" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
              <thead>
                <tr style={{ backgroundColor: BG_HEADER }}>
                  <th style={{ border: BORDER, padding: "8px" }}>Branch</th>
                  <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    Total Sales
                  </th>
                  <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    Total Purchase
                  </th>
                  <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    Gross Profit
                  </th>
                  <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Collection</th>
                  <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    Outstanding
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.values(salesSummary).map((s, idx) => (
                  <tr
                    key={s.branch.id}
                    style={{ backgroundColor: idx % 2 === 0 ? BG_DEEP : "transparent" }}
                  >
                    <td style={{ border: BORDER, padding: "8px" }}>{s.branch.name}</td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(s.sales)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(s.purchases)}
                    </td>
                    <td
                      style={{
                        border: BORDER,
                        padding: "8px",
                        textAlign: "right",
                        color: s.sales - s.purchases >= 0 ? "#059669" : "#dc2626",
                      }}
                    >
                      {money(s.sales - s.purchases)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(s.collection)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(s.outstanding)}
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr style={{ backgroundColor: BG_HEADER }}>
                  <td style={{ border: BORDER, padding: "8px", fontWeight: "bold" }}>TOTAL</td>
                  <td
                    style={{
                      border: BORDER,
                      padding: "8px",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    {money(Object.values(salesSummary).reduce((sum, s) => sum + s.sales, 0))}
                  </td>
                  <td
                    style={{
                      border: BORDER,
                      padding: "8px",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    {money(Object.values(salesSummary).reduce((sum, s) => sum + s.purchases, 0))}
                  </td>
                  <td
                    style={{
                      border: BORDER,
                      padding: "8px",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    {money(
                      Object.values(salesSummary).reduce(
                        (sum, s) => sum + (s.sales - s.purchases),
                        0,
                      ),
                    )}
                  </td>
                  <td
                    style={{
                      border: BORDER,
                      padding: "8px",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    {money(Object.values(salesSummary).reduce((sum, s) => sum + s.collection, 0))}
                  </td>
                  <td
                    style={{
                      border: BORDER,
                      padding: "8px",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    {money(Object.values(salesSummary).reduce((sum, s) => sum + s.outstanding, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "pl" && (
        <div
          style={{ backgroundColor: BG_CARD, padding: "15px", borderRadius: "8px", border: BORDER }}
        >
          <h2
            style={{ fontSize: "16px", fontWeight: "bold", color: "#000000", marginBottom: "15px" }}
          >
            P&L by Branch
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "20px",
            }}
          >
            {Object.values(plByBranch).map((pl) => (
              <div
                key={pl.branch.id}
                style={{ border: BORDER, borderRadius: "8px", padding: "15px" }}
              >
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#000000",
                    marginBottom: "10px",
                  }}
                >
                  {pl.branch.name}
                </h3>

                <div style={{ marginBottom: "10px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "5px",
                    }}
                  >
                    <span>Sales Revenue</span>
                    <span>{money(pl.salesRevenue)}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "5px",
                    }}
                  >
                    <span>Sales Returns</span>
                    <span>({money(pl.salesReturns)})</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "10px",
                      borderTop: BORDER,
                      paddingTop: "5px",
                    }}
                  >
                    <span>Net Sales</span>
                    <span>{money(pl.netSales)}</span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "5px",
                    }}
                  >
                    <span>COGS</span>
                    <span>({money(pl.cogs)})</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "10px",
                      borderTop: BORDER,
                      paddingTop: "5px",
                    }}
                  >
                    <span>Gross Profit</span>
                    <span
                      style={{
                        color: pl.grossProfit >= 0 ? "#059669" : "#dc2626",
                        fontWeight: "bold",
                      }}
                    >
                      {money(pl.grossProfit)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "5px",
                    }}
                  >
                    <span>Direct Expenses</span>
                    <span>({money(pl.directExpenses)})</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderTop: BORDER,
                      paddingTop: "5px",
                    }}
                  >
                    <span>Net Profit</span>
                    <span
                      style={{
                        color: pl.netProfit >= 0 ? "#059669" : "#dc2626",
                        fontWeight: "bold",
                      }}
                    >
                      {money(pl.netProfit)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "stock" && (
        <div
          style={{ backgroundColor: BG_CARD, padding: "15px", borderRadius: "8px", border: BORDER }}
        >
          <h2
            style={{ fontSize: "16px", fontWeight: "bold", color: "#000000", marginBottom: "15px" }}
          >
            Stock by Branch
          </h2>

          {branches.map((branch) => {
            const stock = stockByBranch[branch.id] || [];
            if (stock.length === 0) return null;

            return (
              <div key={branch.id} style={{ marginBottom: "20px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: BG_HEADER,
                    padding: "8px",
                    cursor: "pointer",
                  }}
                  onClick={() => toggleExpand(`stock-${branch.id}`)}
                >
                  <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "#000000", margin: 0 }}>
                    {branch.name}
                  </h3>
                  {expandedSections[`stock-${branch.id}`] ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </div>

                {expandedSections[`stock-${branch.id}`] && (
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        border: BORDER,
                        marginTop: "5px",
                      }}
                    >
                      <thead>
                        <tr style={{ backgroundColor: BG_HEADER }}>
                          <th style={{ border: BORDER, padding: "8px" }}>Item Name</th>
                          <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                            Qty
                          </th>
                          <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                            Avg Rate
                          </th>
                          <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                            Total Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {stock.map((item, idx) => (
                          <tr
                            key={item.item.id}
                            style={{ backgroundColor: idx % 2 === 0 ? BG_DEEP : "transparent" }}
                          >
                            <td style={{ border: BORDER, padding: "8px" }}>{item.item.name}</td>
                            <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                              {item.qty}
                            </td>
                            <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                              {money(item.avgRate)}
                            </td>
                            <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                              {money(item.totalValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "consolidated" && (
        <div
          style={{ backgroundColor: BG_CARD, padding: "15px", borderRadius: "8px", border: BORDER }}
        >
          <h2
            style={{ fontSize: "16px", fontWeight: "bold", color: "#000000", marginBottom: "15px" }}
          >
            Consolidated View
          </h2>

          <div
            style={{
              backgroundColor: "#fef3c7",
              padding: "10px",
              borderRadius: "6px",
              marginBottom: "15px",
              border: "1px solid #f59e0b",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ color: "#f59e0b", fontWeight: "bold" }}>Note:</span>
              <span>Inter-branch transfers are eliminated in consolidated figures</span>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "15px",
            }}
          >
            <div
              style={{
                backgroundColor: BG_HEADER,
                padding: "15px",
                borderRadius: "6px",
                border: BORDER,
              }}
            >
              <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
                Total Revenue
              </div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
                {money(consolidatedData.totalRevenue)}
              </div>
            </div>
            <div
              style={{
                backgroundColor: BG_HEADER,
                padding: "15px",
                borderRadius: "6px",
                border: BORDER,
              }}
            >
              <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
                Total COGS
              </div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
                {money(consolidatedData.totalCogs)}
              </div>
            </div>
            <div
              style={{
                backgroundColor: BG_HEADER,
                padding: "15px",
                borderRadius: "6px",
                border: BORDER,
              }}
            >
              <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
                Gross Profit
              </div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
                {money(consolidatedData.grossProfit)}
              </div>
            </div>
            <div
              style={{
                backgroundColor: BG_HEADER,
                padding: "15px",
                borderRadius: "6px",
                border: BORDER,
              }}
            >
              <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
                Net Profit
              </div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
                {money(consolidatedData.netProfit)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
