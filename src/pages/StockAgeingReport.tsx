// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB } from "../lib/db";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  Package,
  TrendingDown,
  AlertTriangle,
  Download,
  Search,
  Filter,
  RefreshCw,
} from "lucide-react";

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

export default function StockAgeingReport() {
  const { items, stockMovements, itemGroups, warehouses } = useStore();
  const [referenceDate, setReferenceDate] = useState(new Date().toISOString().split("T")[0]);
  const [groupFilter, setGroupFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("totalValue");
  const [sortDirection, setSortDirection] = useState("desc");
  const [searchTerm, setSearchTerm] = useState("");

  // Calculate ageing data
  const ageingData = useMemo(() => {
    if (!items?.length || !stockMovements?.length) return [];

    const refDate = new Date(referenceDate || new Date().toISOString().split("T")[0]);

    return items
      .filter((item) => item.type !== "service")
      .filter((item) => !groupFilter || item.groupId === groupFilter)
      .map((item) => {
        // Get IN movements for this item, sorted oldest first
        const inMovements = stockMovements
          .filter(
            (m) =>
              m.itemId === item.id &&
              (m.type === "in" || m.type === "purchase" || m.movementType === "IN"),
          )
          .filter((m) => !warehouseFilter || m.warehouseId === warehouseFilter)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map((m) => ({
            date: m.date,
            qty: Number(m.quantity || m.qty || 0),
            rate: Number(m.rate || m.costRate || 0),
            remainingQty: Number(m.quantity || m.qty || 0),
          }));

        // Get OUT movements sorted oldest first
        const outMovements = stockMovements
          .filter(
            (m) =>
              m.itemId === item.id &&
              (m.type === "out" || m.type === "sales" || m.movementType === "OUT"),
          )
          .filter((m) => !warehouseFilter || m.warehouseId === warehouseFilter)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // FIFO consumption
        let outQtyRemaining = outMovements.reduce(
          (s, m) => s + Number(m.quantity || m.qty || 0),
          0,
        );
        for (const inLot of inMovements) {
          if (outQtyRemaining <= 0) break;
          const consume = Math.min(inLot.remainingQty, outQtyRemaining);
          inLot.remainingQty -= consume;
          outQtyRemaining -= consume;
        }

        // Bucket the remaining stock
        const buckets = { b0_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b180plus: 0 };
        const bucketValues = { b0_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b180plus: 0 };

        for (const inLot of inMovements) {
          if (inLot.remainingQty <= 0) continue;
          const days = Math.floor(
            (refDate.getTime() - new Date(inLot.date).getTime()) / (1000 * 60 * 60 * 24),
          );
          const val = inLot.remainingQty * inLot.rate;
          if (days <= 30) {
            buckets.b0_30 += inLot.remainingQty;
            bucketValues.b0_30 += val;
          } else if (days <= 60) {
            buckets.b31_60 += inLot.remainingQty;
            bucketValues.b31_60 += val;
          } else if (days <= 90) {
            buckets.b61_90 += inLot.remainingQty;
            bucketValues.b61_90 += val;
          } else if (days <= 180) {
            buckets.b91_180 += inLot.remainingQty;
            bucketValues.b91_180 += val;
          } else {
            buckets.b180plus += inLot.remainingQty;
            bucketValues.b180plus += val;
          }
        }

        const totalQty = Object.values(buckets).reduce((s, v) => s + v, 0);
        const totalValue = Object.values(bucketValues).reduce((s, v) => s + v, 0);
        const avgRate = totalQty > 0 ? totalValue / totalQty : 0;
        const isDeadStock = buckets.b180plus > 0 && buckets.b180plus / Math.max(totalQty, 1) > 0.5;

        return { item, buckets, bucketValues, totalQty, totalValue, avgRate, isDeadStock };
      })
      .filter((row) => {
        if (categoryFilter === "DEAD") return row.isDeadStock;
        if (categoryFilter === "NEAR-DEAD")
          return row.buckets.b180plus / Math.max(row.totalQty, 1) > 0.5;
        return row.totalQty > 0;
      })
      .filter(
        (row) =>
          !searchTerm ||
          row.item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.item.name.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];

        if (sortDirection === "asc") {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue > bValue ? -1 : 1;
        }
      });
  }, [
    items,
    stockMovements,
    referenceDate,
    groupFilter,
    warehouseFilter,
    categoryFilter,
    searchTerm,
    sortBy,
    sortDirection,
  ]);

  // Calculate summary values
  const summary = useMemo(() => {
    const totalValue = ageingData.reduce((sum, row) => sum + row.totalValue, 0);
    const value0_30 = ageingData.reduce((sum, row) => sum + row.bucketValues.b0_30, 0);
    const value91_180plus = ageingData.reduce(
      (sum, row) => sum + row.bucketValues.b91_180 + row.bucketValues.b180plus,
      0,
    );
    const deadStockValue = ageingData.reduce((sum, row) => sum + row.bucketValues.b180plus, 0);

    return { totalValue, value0_30, value91_180plus, deadStockValue };
  }, [ageingData]);

  const handleRunReport = () => {
    // Report is recalculated via useMemo when filters change
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      ageingData.map((row) => ({
        "Item Code": row.item.code,
        "Item Name": row.item.name,
        "Item Group": row.item.groupId,
        Unit: row.item.unit,
        "Total Stock Qty": row.totalQty,
        "Avg Cost Rate": row.avgRate,
        "Total Stock Value": row.totalValue,
        "0-30 Days Qty": row.buckets.b0_30,
        "0-30 Days Value": row.bucketValues.b0_30,
        "31-60 Days Qty": row.buckets.b31_60,
        "31-60 Days Value": row.bucketValues.b31_60,
        "61-90 Days Qty": row.buckets.b61_90,
        "61-90 Days Value": row.bucketValues.b61_90,
        "91-180 Days Qty": row.buckets.b91_180,
        "91-180 Days Value": row.bucketValues.b91_180,
        "180+ Days Qty": row.buckets.b180plus,
        "180+ Days Value": row.bucketValues.b180plus,
        "Is Dead Stock": row.isDeadStock ? "YES" : "NO",
      })),
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Ageing Report");
    XLSX.writeFile(wb, `Stock_Ageing_Report_${referenceDate}.xlsx`);
    toast.success("Exported to Excel successfully");
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection("desc");
    }
  };

  const deadStockItems = ageingData.filter((row) => row.isDeadStock);

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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <h1 style={{ fontSize: "14px", fontWeight: "bold", color: "#000000", margin: 0 }}>
            Stock Ageing Report
          </h1>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "end" }}>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "3px",
                  fontSize: "11px",
                  fontWeight: "bold",
                }}
              >
                Item Group
              </label>
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                style={{ padding: "4px", border: BORDER, borderRadius: "4px", fontSize: "11px" }}
              >
                <option value="">All Groups</option>
                {itemGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "3px",
                  fontSize: "11px",
                  fontWeight: "bold",
                }}
              >
                Warehouse
              </label>
              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                style={{ padding: "4px", border: BORDER, borderRadius: "4px", fontSize: "11px" }}
              >
                <option value="">All Warehouses</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "3px",
                  fontSize: "11px",
                  fontWeight: "bold",
                }}
              >
                Reference Date
              </label>
              <input
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
                style={{ padding: "4px", border: BORDER, borderRadius: "4px", fontSize: "11px" }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "3px",
                  fontSize: "11px",
                  fontWeight: "bold",
                }}
              >
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ padding: "4px", border: BORDER, borderRadius: "4px", fontSize: "11px" }}
              >
                <option value="ALL">All</option>
                <option value="NEAR-DEAD">Near-Dead (90+ days &gt;50%)</option>
                <option value="DEAD">Dead (180+ days)</option>
              </select>
            </div>

            <button
              onClick={handleRunReport}
              style={{
                backgroundColor: "#1557b0",
                color: "white",
                border: BORDER,
                padding: "6px 12px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "11px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <RefreshCw size={12} />
              Run Report
            </button>

            <button
              onClick={handleExportExcel}
              style={{
                backgroundColor: "#059669",
                color: "white",
                border: BORDER,
                padding: "6px 12px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "11px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Download size={12} />
              Export Excel
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "15px", marginTop: "15px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Search size={14} style={{ color: "#000000" }} />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: "4px 8px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "11px",
                width: "200px",
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
            Total Stock Value
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
            {money(summary.totalValue)}
          </div>
        </div>
        <div
          style={{
            backgroundColor: "#dcfce7",
            padding: "15px",
            borderRadius: "8px",
            border: BORDER,
          }}
        >
          <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
            0-30 Days Value
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#166534" }}>
            {money(summary.value0_30)}
          </div>
        </div>
        <div
          style={{
            backgroundColor: "#fef9c3",
            padding: "15px",
            borderRadius: "8px",
            border: BORDER,
          }}
        >
          <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
            Slow Moving (91+ Days)
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#854d0e" }}>
            {money(summary.value91_180plus)}
          </div>
        </div>
        <div
          style={{
            backgroundColor: "#dc2626",
            padding: "15px",
            borderRadius: "8px",
            border: BORDER,
          }}
        >
          <div style={{ fontSize: "12px", color: "white", marginBottom: "5px" }}>
            Dead Stock Value
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "white" }}>
            {money(summary.deadStockValue)}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div
        style={{ backgroundColor: BG_CARD, padding: "15px", borderRadius: "8px", border: BORDER }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
            <thead>
              <tr style={{ backgroundColor: BG_HEADER }}>
                <th
                  style={{ border: BORDER, padding: "8px", cursor: "pointer" }}
                  onClick={() => handleSort("item.code")}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>Item Code</span>
                    {sortBy === "item.code" && <span>{sortDirection === "asc" ? "↑" : "↓"}</span>}
                  </div>
                </th>
                <th
                  style={{ border: BORDER, padding: "8px", cursor: "pointer" }}
                  onClick={() => handleSort("item.name")}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>Item Name</span>
                    {sortBy === "item.name" && <span>{sortDirection === "asc" ? "↑" : "↓"}</span>}
                  </div>
                </th>
                <th style={{ border: BORDER, padding: "8px" }}>Item Group</th>
                <th style={{ border: BORDER, padding: "8px" }}>Unit</th>
                <th
                  style={{ border: BORDER, padding: "8px", cursor: "pointer", textAlign: "right" }}
                  onClick={() => handleSort("totalQty")}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>Total Qty</span>
                    {sortBy === "totalQty" && <span>{sortDirection === "asc" ? "↑" : "↓"}</span>}
                  </div>
                </th>
                <th
                  style={{ border: BORDER, padding: "8px", cursor: "pointer", textAlign: "right" }}
                  onClick={() => handleSort("avgRate")}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>Avg Cost Rate</span>
                    {sortBy === "avgRate" && <span>{sortDirection === "asc" ? "↑" : "↓"}</span>}
                  </div>
                </th>
                <th
                  style={{ border: BORDER, padding: "8px", cursor: "pointer", textAlign: "right" }}
                  onClick={() => handleSort("totalValue")}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>Total Value</span>
                    {sortBy === "totalValue" && <span>{sortDirection === "asc" ? "↑" : "↓"}</span>}
                  </div>
                </th>
                <th
                  style={{
                    border: BORDER,
                    padding: "8px",
                    backgroundColor: "#dcfce7",
                    color: "#166534",
                    textAlign: "center",
                  }}
                >
                  0-30 Days
                </th>
                <th
                  style={{
                    border: BORDER,
                    padding: "8px",
                    backgroundColor: "#fef9c3",
                    color: "#854d0e",
                    textAlign: "center",
                  }}
                >
                  31-60 Days
                </th>
                <th
                  style={{
                    border: BORDER,
                    padding: "8px",
                    backgroundColor: "#fed7aa",
                    color: "#9a3412",
                    textAlign: "center",
                  }}
                >
                  61-90 Days
                </th>
                <th
                  style={{
                    border: BORDER,
                    padding: "8px",
                    backgroundColor: "#fecaca",
                    color: "#991b1b",
                    textAlign: "center",
                  }}
                >
                  91-180 Days
                </th>
                <th
                  style={{
                    border: BORDER,
                    padding: "8px",
                    backgroundColor: "#f87171",
                    color: "#fff",
                    textAlign: "center",
                  }}
                >
                  180+ Days
                </th>
                <th style={{ border: BORDER, padding: "8px" }}>Dead Stock</th>
              </tr>
            </thead>
            <tbody>
              {ageingData.length > 0 ? (
                ageingData.map((row, idx) => (
                  <tr
                    key={row.item.id}
                    style={{ backgroundColor: idx % 2 === 0 ? BG_DEEP : "transparent" }}
                  >
                    <td style={{ border: BORDER, padding: "8px" }}>{row.item.code}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>{row.item.name}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>{row.item.groupId}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>{row.item.unit}</td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {row.totalQty}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(row.avgRate)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(row.totalValue)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {row.buckets.b0_30} | {money(row.bucketValues.b0_30)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {row.buckets.b31_60} | {money(row.bucketValues.b31_60)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {row.buckets.b61_90} | {money(row.bucketValues.b61_90)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {row.buckets.b91_180} | {money(row.bucketValues.b91_180)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {row.buckets.b180plus} | {money(row.bucketValues.b180plus)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                      <span
                        style={{
                          backgroundColor: row.isDeadStock ? "#f87171" : "#dcfce7",
                          color: row.isDeadStock ? "#fff" : "#166534",
                          padding: "2px 6px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: "bold",
                        }}
                      >
                        {row.isDeadStock ? "YES" : "NO"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="12"
                    style={{ border: BORDER, padding: "16px", textAlign: "center", color: "#666" }}
                  >
                    No data found for the selected filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dead Stock Summary */}
      {deadStockItems.length > 0 && (
        <div
          style={{
            marginTop: "20px",
            backgroundColor: "#fee2e2",
            padding: "15px",
            borderRadius: "8px",
            border: BORDER,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <h2 style={{ fontSize: "14px", fontWeight: "bold", color: "#000000" }}>
              DEAD STOCK SUMMARY
            </h2>
            <div style={{ fontSize: "12px", fontWeight: "bold", color: "#dc2626" }}>
              Total Dead Stock Value:{" "}
              {money(deadStockItems.reduce((sum, row) => sum + row.bucketValues.b180plus, 0))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              backgroundColor: "#fecaca",
              padding: "10px",
              borderRadius: "6px",
              marginBottom: "10px",
            }}
          >
            <AlertTriangle size={16} style={{ color: "#991b1b" }} />
            <span style={{ color: "#991b1b", fontWeight: "bold" }}>
              RECOMMENDED ACTION: Markdown or Write-Off
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
              <thead>
                <tr style={{ backgroundColor: "#f87171", color: "#fff" }}>
                  <th style={{ border: BORDER, padding: "8px", color: "#fff" }}>Item Code</th>
                  <th style={{ border: BORDER, padding: "8px", color: "#fff" }}>Item Name</th>
                  <th style={{ border: BORDER, padding: "8px", color: "#fff", textAlign: "right" }}>
                    Dead Qty
                  </th>
                  <th style={{ border: BORDER, padding: "8px", color: "#fff", textAlign: "right" }}>
                    Dead Value
                  </th>
                  <th style={{ border: BORDER, padding: "8px", color: "#fff" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {deadStockItems.map((row) => (
                  <tr key={`dead-${row.item.id}`}>
                    <td style={{ border: BORDER, padding: "8px" }}>{row.item.code}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>{row.item.name}</td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {row.buckets.b180plus}
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
                      {money(row.bucketValues.b180plus)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                      <button
                        onClick={() => {}}
                        style={{
                          backgroundColor: "#dc2626",
                          color: "white",
                          border: BORDER,
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "11px",
                        }}
                      >
                        Write Off
                      </button>
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
