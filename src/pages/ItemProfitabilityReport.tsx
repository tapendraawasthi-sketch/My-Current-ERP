// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB } from "../lib/db";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { TrendingUp, TrendingDown, Download, BarChart2, Search, Filter } from "lucide-react";
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

export default function ItemProfitabilityReport() {
  const { invoices, items, itemGroups, currentFiscalYear } = useStore();
  const [fromDate, setFromDate] = useState(currentFiscalYear?.startDate || "");
  const [toDate, setToDate] = useState(currentFiscalYear?.endDate || "");
  const [groupFilter, setGroupFilter] = useState("");
  const [salespersonFilter, setSalespersonFilter] = useState("");
  const [viewMode, setViewMode] = useState("top20"); // top20, bottom20, all
  const [salespersons, setSalespersons] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Load salespersons
  useEffect(() => {
    const db = getDB();
    db.salespersons
      .toArray()
      .then(setSalespersons)
      .catch(() => setSalespersons([]));
  }, []);

  // Calculate profit data
  const profitData = useMemo(() => {
    if (!items || !invoices) return [];

    // Sales data from invoices
    const salesByItem = new Map(); // itemId -> { qty, revenue }

    (invoices || [])
      .filter((inv) => inv.type === "sales-invoice" || inv.type === "SALES_INVOICE")
      .filter((inv) => inv.status === "posted")
      .filter((inv) => (!fromDate || inv.date >= fromDate) && (!toDate || inv.date <= toDate))
      .filter((inv) => !salespersonFilter || inv.salespersonId === salespersonFilter)
      .forEach((inv) => {
        (inv.lines || inv.items || []).forEach((line) => {
          if (!line.itemId) return;
          const existing = salesByItem.get(line.itemId) || { qty: 0, revenue: 0, salePrices: [] };
          existing.qty += Number(line.qty || line.quantity || 0);
          existing.revenue += Number(line.amount || line.total || line.qty * line.rate || 0);
          existing.salePrices.push(Number(line.rate || 0));
          salesByItem.set(line.itemId, existing);
        });
      });

    // Purchase data from invoices
    const purchaseByItem = new Map(); // itemId -> { qty, cost }

    (invoices || [])
      .filter((inv) => inv.type === "purchase-invoice" || inv.type === "PURCHASE_INVOICE")
      .filter((inv) => inv.status === "posted")
      .filter((inv) => (!fromDate || inv.date >= fromDate) && (!toDate || inv.date <= toDate))
      .forEach((inv) => {
        (inv.lines || inv.items || []).forEach((line) => {
          if (!line.itemId) return;
          const existing = purchaseByItem.get(line.itemId) || { qty: 0, cost: 0 };
          existing.qty += Number(line.qty || line.quantity || 0);
          existing.cost += Number(line.amount || line.total || line.qty * line.rate || 0);
          purchaseByItem.set(line.itemId, existing);
        });
      });

    // Combine
    let results = (items || [])
      .filter((item) => salesByItem.has(item.id))
      .filter((item) => !groupFilter || item.groupId === groupFilter)
      .map((item) => {
        const sales = salesByItem.get(item.id) || { qty: 0, revenue: 0 };
        const purch = purchaseByItem.get(item.id) || { qty: 0, cost: 0 };
        const avgPurchRate = purch.qty > 0 ? purch.cost / purch.qty : 0;
        const cogs = sales.qty * avgPurchRate;
        const grossProfit = sales.revenue - cogs;
        const marginPct = sales.revenue > 0 ? (grossProfit / sales.revenue) * 100 : 0;
        const avgSaleRate = sales.qty > 0 ? sales.revenue / sales.qty : 0;
        const group = (itemGroups || []).find((g) => g.id === item.groupId)?.name || "Ungrouped";
        return {
          item,
          group,
          unitsSold: sales.qty,
          avgSaleRate,
          revenue: sales.revenue,
          avgPurchRate,
          cogs,
          grossProfit,
          marginPct,
        };
      });

    // Sort by gross profit
    results.sort((a, b) => b.grossProfit - a.grossProfit);

    // Apply view mode filter
    if (viewMode === "top20") {
      results = results.slice(0, 20);
    } else if (viewMode === "bottom20") {
      results = results.slice(-20).reverse(); // Bottom 20, reverse for ascending order
    }

    return results.filter(
      (item) =>
        !searchTerm ||
        item.item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [
    items,
    invoices,
    fromDate,
    toDate,
    groupFilter,
    salespersonFilter,
    viewMode,
    searchTerm,
    itemGroups,
  ]);

  // Calculate summary
  const summary = useMemo(() => {
    const totalRevenue = profitData.reduce((sum, item) => sum + item.revenue, 0);
    const totalCOGS = profitData.reduce((sum, item) => sum + item.cogs, 0);
    const totalGP = profitData.reduce((sum, item) => sum + item.grossProfit, 0);
    const overallMargin = totalRevenue > 0 ? (totalGP / totalRevenue) * 100 : 0;

    return { totalRevenue, totalCOGS, totalGP, overallMargin };
  }, [profitData]);

  const lossMakingItems = profitData.filter((item) => item.marginPct < 0);

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      profitData.map((item, idx) => ({
        Rank: idx + 1,
        "Item Code": item.item.code,
        "Item Name": item.item.name,
        "Item Group": item.group,
        "Units Sold": item.unitsSold,
        "Avg Selling Rate": item.avgSaleRate,
        "Total Revenue": item.revenue,
        "Avg Purchase Rate": item.avgPurchRate,
        "Total COGS": item.cogs,
        "Gross Profit": item.grossProfit,
        "Margin %": item.marginPct,
      })),
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item Profitability");
    XLSX.writeFile(wb, `Item_Profitability_${fromDate}_to_${toDate}.xlsx`);
  };

  // Prepare chart data
  const chartData = profitData.map((item) => ({
    name: item.item.name.substring(0, 20) + (item.item.name.length > 20 ? "..." : ""),
    margin: item.marginPct,
    revenue: item.revenue,
  }));

  return (
    <div style={{ backgroundColor: BG, minHeight: "100vh", padding: "20px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#000000", marginBottom: "20px" }}>
        Item Profitability Report
      </h1>

      {/* Controls Bar */}
      <div
        style={{
          backgroundColor: BG_HEADER,
          padding: "15px",
          borderRadius: "8px",
          border: BORDER,
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "end" }}>
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
              Item Group
            </label>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
            >
              <option value="">All Groups</option>
              {itemGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
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
              Salesperson
            </label>
            <select
              value={salespersonFilter}
              onChange={(e) => setSalespersonFilter(e.target.value)}
              style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
            >
              <option value="">All Salespersons</option>
              {salespersons.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
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
              View
            </label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
            >
              <option value="top20">Top 20 Profitable</option>
              <option value="bottom20">Bottom 20 Profitable</option>
              <option value="all">All Items</option>
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
            }}
          >
            Run Analysis
          </button>
          <button
            onClick={handleExportExcel}
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
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              Search
            </label>
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
                width: "100%",
              }}
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "15px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{ backgroundColor: BG_CARD, padding: "15px", borderRadius: "8px", border: BORDER }}
        >
          <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
            Total Revenue
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
            {money(summary.totalRevenue)}
          </div>
        </div>
        <div
          style={{ backgroundColor: BG_CARD, padding: "15px", borderRadius: "8px", border: BORDER }}
        >
          <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>Total COGS</div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
            {money(summary.totalCOGS)}
          </div>
        </div>
        <div
          style={{ backgroundColor: BG_CARD, padding: "15px", borderRadius: "8px", border: BORDER }}
        >
          <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
            Total Gross Profit
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
            {money(summary.totalGP)}
          </div>
        </div>
        <div
          style={{ backgroundColor: BG_CARD, padding: "15px", borderRadius: "8px", border: BORDER }}
        >
          <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
            Overall Margin %
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
            {summary.overallMargin.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Chart */}
      <div
        style={{
          backgroundColor: BG_CARD,
          padding: "15px",
          borderRadius: "8px",
          border: BORDER,
          marginBottom: "20px",
        }}
      >
        <h2
          style={{ fontSize: "16px", fontWeight: "bold", color: "#000000", marginBottom: "15px" }}
        >
          Gross Margin by Item
        </h2>
        <div style={{ height: "350px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="horizontal"
              data={chartData}
              margin={{ top: 20, right: 30, left: 150, bottom: 50 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => [`${value}%`, "Gross Margin"]} />
              <Bar dataKey="margin" name="Gross Margin %">
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.margin >= 20 ? "#059669" : entry.margin >= 10 ? "#d97706" : "#dc2626"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Main Table */}
      <div
        style={{
          backgroundColor: BG_CARD,
          padding: "15px",
          borderRadius: "8px",
          border: BORDER,
          marginBottom: "20px",
        }}
      >
        <h2
          style={{ fontSize: "16px", fontWeight: "bold", color: "#000000", marginBottom: "15px" }}
        >
          {viewMode === "top20"
            ? "Top 20 Profitable Items"
            : viewMode === "bottom20"
              ? "Bottom 20 Profitable Items"
              : "All Items"}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
            <thead>
              <tr style={{ backgroundColor: BG_HEADER }}>
                <th style={{ border: BORDER, padding: "8px" }}>Rank</th>
                <th style={{ border: BORDER, padding: "8px" }}>Item Code</th>
                <th style={{ border: BORDER, padding: "8px" }}>Item Name</th>
                <th style={{ border: BORDER, padding: "8px" }}>Item Group</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Units Sold</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                  Avg Selling Rate
                </th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                  Total Revenue
                </th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                  Avg Purchase Rate
                </th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Total COGS</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Gross Profit</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Margin %</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "center" }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {profitData.length > 0 ? (
                profitData.map((item, idx) => {
                  const marginColor =
                    item.marginPct >= 20 ? "#059669" : item.marginPct >= 10 ? "#d97706" : "#dc2626";

                  const rowBgColor =
                    item.marginPct < 0 ? "#fee2e2" : idx % 2 === 0 ? BG_DEEP : "transparent";

                  return (
                    <tr key={item.item.id} style={{ backgroundColor: rowBgColor }}>
                      <td style={{ border: BORDER, padding: "8px" }}>{idx + 1}</td>
                      <td style={{ border: BORDER, padding: "8px" }}>{item.item.code}</td>
                      <td style={{ border: BORDER, padding: "8px" }}>{item.item.name}</td>
                      <td style={{ border: BORDER, padding: "8px" }}>{item.group}</td>
                      <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                        {item.unitsSold}
                      </td>
                      <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                        {money(item.avgSaleRate)}
                      </td>
                      <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                        {money(item.revenue)}
                      </td>
                      <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                        {money(item.avgPurchRate)}
                      </td>
                      <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                        {money(item.cogs)}
                      </td>
                      <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                        {money(item.grossProfit)}
                      </td>
                      <td
                        style={{
                          border: BORDER,
                          padding: "8px",
                          textAlign: "right",
                          color: marginColor,
                          fontWeight: "bold",
                        }}
                      >
                        {item.marginPct.toFixed(2)}%
                      </td>
                      <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                        {item.marginPct > 0 ? (
                          <TrendingUp size={16} style={{ color: "#059669" }} />
                        ) : (
                          <TrendingDown size={16} style={{ color: "#dc2626" }} />
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="12"
                    style={{ border: BORDER, padding: "16px", textAlign: "center", color: "#666" }}
                  >
                    No data found for the selected criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Loss Making Items */}
      {lossMakingItems.length > 0 && (
        <div
          style={{
            backgroundColor: "#fee2e2",
            padding: "15px",
            borderRadius: "8px",
            border: BORDER,
            marginBottom: "20px",
          }}
        >
          <h2
            style={{ fontSize: "16px", fontWeight: "bold", color: "#dc2626", marginBottom: "10px" }}
          >
            Items Selling at a Loss
          </h2>
          <div
            style={{
              backgroundColor: "#fecaca",
              padding: "10px",
              borderRadius: "6px",
              marginBottom: "15px",
              color: "#991b1b",
              fontWeight: "bold",
            }}
          >
            These items are being sold below cost. Consider repricing.
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
              <thead>
                <tr style={{ backgroundColor: "#f87171", color: "#fff" }}>
                  <th style={{ border: BORDER, padding: "8px", color: "#fff" }}>Item Code</th>
                  <th style={{ border: BORDER, padding: "8px", color: "#fff" }}>Item Name</th>
                  <th style={{ border: BORDER, padding: "8px", color: "#fff", textAlign: "right" }}>
                    Revenue
                  </th>
                  <th style={{ border: BORDER, padding: "8px", color: "#fff", textAlign: "right" }}>
                    COGS
                  </th>
                  <th style={{ border: BORDER, padding: "8px", color: "#fff", textAlign: "right" }}>
                    Gross Profit
                  </th>
                  <th style={{ border: BORDER, padding: "8px", color: "#fff", textAlign: "right" }}>
                    Margin %
                  </th>
                </tr>
              </thead>
              <tbody>
                {lossMakingItems.map((item) => (
                  <tr key={`loss-${item.item.id}`}>
                    <td style={{ border: BORDER, padding: "8px" }}>{item.item.code}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>{item.item.name}</td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(item.revenue)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(item.cogs)}
                    </td>
                    <td
                      style={{
                        border: BORDER,
                        padding: "8px",
                        textAlign: "right",
                        color: "#dc2626",
                        fontWeight: "bold",
                      }}
                    >
                      {money(item.grossProfit)}
                    </td>
                    <td
                      style={{
                        border: BORDER,
                        padding: "8px",
                        textAlign: "right",
                        color: "#dc2626",
                        fontWeight: "bold",
                      }}
                    >
                      {item.marginPct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
