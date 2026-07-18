// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "@/lib/appToast";
import * as XLSX from "xlsx";
import {
  User,
  MapPin,
  Target,
  TrendingUp,
  Plus,
  Edit2,
  Trash2,
  Download,
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
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

const BORDER = "1px solid #000";
const BG = "#E4F1D9";
const BG_CARD = "var(--ds-surface-muted)";
const BG_HEADER = "var(--ds-surface-hover)";
const BG_DEEP = "var(--ds-surface-muted)";

function money(v) {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const NEPAL_PROVINCES = [
  "Koshi",
  "Madhesh",
  "Bagmati",
  "Gandaki",
  "Lumbini",
  "Karnali",
  "Sudurpashchim",
];

const COMMISSION_TYPES = [
  "Percentage of Sales",
  "Percentage of Collection",
  "Fixed Amount",
  "None",
];

export default function SalespersonMaster() {
  const { invoices, employees, fiscalYears, vouchers } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [activeTab, setActiveTab] = useState("master");
  const [salespersons, setSalespersons] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    mobile: "",
    email: "",
    province: "Bagmati",
    district: "",
    assignedArea: "",
    territory: "",
    commissionType: "None",
    commissionRate: 0,
    monthlyTarget: 0,
    employeeId: "",
    isActive: true,
    joiningDate: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [filteredSalespersons, setFilteredSalespersons] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Performance report filters
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("Full Year");
  const [selectedSalesperson, setSelectedSalesperson] = useState("ALL");

  // Area-wise report state
  const [expandedAreas, setExpandedAreas] = useState({});
  const [expandedDistricts, setExpandedDistricts] = useState({});
  const [expandedSalespersons, setExpandedSalespersons] = useState({});

  // Load salespersons
  useEffect(() => {
    const db = getDB();
    db.salespersons
      .toArray()
      .catch(() => [])
      .then(setSalespersons);
  }, []);

  // Update filtered list
  useEffect(() => {
    const filtered = salespersons.filter(
      (sp) =>
        matchBranch((sp as any).branchId) &&
        (sp.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          sp.name.toLowerCase().includes(searchTerm.toLowerCase())),
    );
    setFilteredSalespersons(filtered);
  }, [salespersons, searchTerm, branchFilter]);

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const clearForm = () => {
    setForm({
      code: "",
      name: "",
      mobile: "",
      email: "",
      province: "Bagmati",
      district: "",
      assignedArea: "",
      territory: "",
      commissionType: "None",
      commissionRate: 0,
      monthlyTarget: 0,
      employeeId: "",
      isActive: true,
      joiningDate: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.code.trim()) {
      toast.error("Code is required");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      const db = getDB();
      const existing = editingId ? salespersons.find((sp) => sp.id === editingId) : null;
      await db.salespersons.put({
        id: editingId || generateId(),
        ...form,
        branchId: existing?.branchId || readActiveBranchId() || undefined,
        updatedAt: new Date().toISOString(),
      });
      toast.success(editingId ? "Updated successfully" : "Created successfully");

      const updated = await db.salespersons.toArray();
      setSalespersons(updated);
      clearForm();
    } catch (error) {
      console.error("Error saving salesperson:", error);
      toast.error("Failed to save");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this salesperson?")) return;

    try {
      const db = getDB();
      await db.salespersons.delete(id);
      toast.success("Deleted successfully");

      const updated = await db.salespersons.toArray();
      setSalespersons(updated);
    } catch (error) {
      console.error("Error deleting salesperson:", error);
      toast.error("Failed to delete");
    }
  };

  const handleEdit = (sp) => {
    setForm({
      code: sp.code,
      name: sp.name,
      mobile: sp.mobile || "",
      email: sp.email || "",
      province: sp.province || "Bagmati",
      district: sp.district || "",
      assignedArea: sp.assignedArea || "",
      territory: sp.territory || "",
      commissionType: sp.commissionType || "None",
      commissionRate: sp.commissionRate || 0,
      monthlyTarget: sp.monthlyTarget || 0,
      employeeId: sp.employeeId || "",
      isActive: sp.isActive !== undefined ? sp.isActive : true,
      joiningDate: sp.joiningDate || new Date().toISOString().split("T")[0],
      notes: sp.notes || "",
    });
    setEditingId(sp.id);
  };

  // Performance Report Data
  const performanceData = useMemo(() => {
    if (!selectedFiscalYear) return [];

    const fy = fiscalYears.find((f) => f.id === selectedFiscalYear);
    if (!fy) return [];

    const startDate =
      selectedPeriod === "Full Year" ? fy.startDate : new Date().toISOString().split("T")[0]; // Simplified for example
    const endDate =
      selectedPeriod === "Full Year" ? fy.endDate : new Date().toISOString().split("T")[0];

    const reportData = salespersons
      .filter((sp) => matchBranch((sp as any).branchId))
      .map((sp) => {
      const salesInvoices = invoices.filter(
        (inv) =>
          matchBranch((inv as any).branchId) &&
          inv.salespersonId === sp.id &&
          inv.type.includes("sales") &&
          inv.status === "posted" &&
          inv.date >= startDate &&
          inv.date <= endDate,
      );

      const totalSales = salesInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
      const invoiceCount = salesInvoices.length;

      const collections = vouchers.filter(
        (v) =>
          matchBranch((v as any).branchId) &&
          v.salespersonId === sp.id &&
          v.type.includes("receipt") &&
          v.date >= startDate &&
          v.date <= endDate,
      );
      const totalCollection = collections.reduce((sum, v) => sum + (v.grandTotal || 0), 0);

      const monthsInPeriod = selectedPeriod === "Full Year" ? 12 : 1;
      const target = sp.monthlyTarget * monthsInPeriod;
      const achievementPct = target > 0 ? (totalSales / target) * 100 : 0;
      const outstanding = totalSales - totalCollection;

      let commissionEarned = 0;
      if (sp.commissionType === "Percentage of Sales") {
        commissionEarned = totalSales * (sp.commissionRate / 100);
      } else if (sp.commissionType === "Percentage of Collection") {
        commissionEarned = totalCollection * (sp.commissionRate / 100);
      } else if (sp.commissionType === "Fixed Amount") {
        commissionEarned = sp.commissionRate * invoiceCount;
      }

      return {
        sp,
        totalSales,
        totalCollection,
        outstanding,
        invoiceCount,
        target,
        achievementPct,
        commissionEarned,
      };
    });

    return reportData;
  }, [salespersons, invoices, vouchers, selectedFiscalYear, selectedPeriod, branchFilter]);

  // Area-wise Report Data
  const areaWiseData = useMemo(() => {
    const grouped = {};

    invoices
      .filter((inv) => inv.salespersonId && matchBranch((inv as any).branchId))
      .forEach((inv) => {
        const sp = salespersons.find((s) => s.id === inv.salespersonId);
        if (!sp) return;

        const province = sp.province || "Unassigned";
        const district = sp.district || "Unassigned";

        if (!grouped[province]) grouped[province] = {};
        if (!grouped[province][district]) grouped[province][district] = {};

        if (!grouped[province][district][sp.id]) {
          grouped[province][district][sp.id] = {
            salesperson: sp,
            invoices: [],
          };
        }

        grouped[province][district][sp.id].invoices.push(inv);
      });

    // Calculate totals
    Object.keys(grouped).forEach((province) => {
      Object.keys(grouped[province]).forEach((district) => {
        Object.keys(grouped[province][district]).forEach((spId) => {
          const spData = grouped[province][district][spId];
          const totalSales = spData.invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
          spData.totalSales = totalSales;
        });
      });
    });

    return grouped;
  }, [invoices, salespersons, branchFilter]);

  // Top areas chart data
  const topAreasData = useMemo(() => {
    const areaTotals = [];

    Object.keys(areaWiseData).forEach((province) => {
      Object.keys(areaWiseData[province]).forEach((district) => {
        let total = 0;
        Object.keys(areaWiseData[province][district]).forEach((spId) => {
          total += areaWiseData[province][district][spId].totalSales || 0;
        });
        areaTotals.push({ name: `${province}/${district}`, sales: total });
      });
    });

    return areaTotals.sort((a, b) => b.sales - a.sales).slice(0, 10);
  }, [areaWiseData]);

  const exportPerformanceExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      performanceData.map((p) => ({
        Salesperson: p.sp.name,
        "Area/Route": p.sp.assignedArea,
        Target: p.target,
        "Actual Sales": p.totalSales,
        "Achievement %": p.achievementPct,
        Collection: p.totalCollection,
        Outstanding: p.outstanding,
        Invoices: p.invoiceCount,
        Commission: p.commissionEarned,
      })),
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Performance");
    XLSX.writeFile(wb, "Sales_Performance_Report.xlsx");
  };

  const toggleExpand = (type, id) => {
    if (type === "area") {
      setExpandedAreas((prev) => ({ ...prev, [id]: !prev[id] }));
    } else if (type === "district") {
      setExpandedDistricts((prev) => ({ ...prev, [id]: !prev[id] }));
    } else if (type === "sp") {
      setExpandedSalespersons((prev) => ({ ...prev, [id]: !prev[id] }));
    }
  };

  return (
    <div style={{ backgroundColor: BG, minHeight: "100vh", padding: "20px" }}>
      <h1
        style={{
          fontSize: "24px",
          fontWeight: "bold",
          color: "#000000",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>Salesperson Master</span>
        {branchOptions.length > 0 && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
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
      </h1>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: "5px", marginBottom: "20px", borderBottom: BORDER }}>
        {[
          { id: "master", label: "Salesperson Master" },
          { id: "performance", label: "Sales Performance" },
          { id: "area", label: "Area-wise Sales" },
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
      {activeTab === "master" && (
        <div style={{ display: "flex", gap: "20px" }}>
          {/* Left Panel - List */}
          <div
            style={{
              width: "260px",
              backgroundColor: BG_CARD,
              border: BORDER,
              padding: "15px",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
              }}
            >
              <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#000000" }}>
                Salespersons
              </h2>
              <button
                onClick={clearForm}
                style={{
                  backgroundColor: "var(--ds-action-primary)",
                  color: "white",
                  border: BORDER,
                  padding: "4px 8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Plus size={14} />
              </button>
            </div>

            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                marginBottom: "10px",
                fontSize: "12px",
              }}
            />

            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              {filteredSalespersons.map((sp) => (
                <div
                  key={sp.id}
                  onClick={() => handleEdit(sp)}
                  style={{
                    padding: "8px",
                    border: BORDER,
                    borderRadius: "4px",
                    marginBottom: "5px",
                    cursor: "pointer",
                    backgroundColor: editingId === sp.id ? BG_HEADER : "transparent",
                  }}
                >
                  <div style={{ fontWeight: "bold", fontSize: "12px" }}>
                    {sp.code} - {sp.name}
                  </div>
                  <div style={{ fontSize: "11px", color: "#666" }}>
                    {sp.assignedArea || sp.territory}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel - Form */}
          <div
            style={{
              flex: 1,
              backgroundColor: BG_CARD,
              border: BORDER,
              padding: "20px",
              borderRadius: "8px",
            }}
          >
            <h2
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                color: "#000000",
                marginBottom: "20px",
              }}
            >
              {editingId ? "Edit Salesperson" : "Add New Salesperson"}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "15px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                    fontSize: "12px",
                  }}
                >
                  Code*
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => handleInputChange("code", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    border: BORDER,
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
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
                  Name*
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    border: BORDER,
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
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
                  Mobile
                </label>
                <input
                  type="text"
                  value={form.mobile}
                  onChange={(e) => handleInputChange("mobile", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    border: BORDER,
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
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
                  Email
                </label>
                <input
                  type="text"
                  value={form.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    border: BORDER,
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
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
                  Province
                </label>
                <select
                  value={form.province}
                  onChange={(e) => handleInputChange("province", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    border: BORDER,
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
                >
                  {NEPAL_PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
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
                  District
                </label>
                <input
                  type="text"
                  value={form.district}
                  onChange={(e) => handleInputChange("district", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    border: BORDER,
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
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
                  Assigned Area/Route
                </label>
                <input
                  type="text"
                  value={form.assignedArea}
                  onChange={(e) => handleInputChange("assignedArea", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    border: BORDER,
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
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
                  Territory
                </label>
                <input
                  type="text"
                  value={form.territory}
                  onChange={(e) => handleInputChange("territory", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    border: BORDER,
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
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
                  Commission Type
                </label>
                <select
                  value={form.commissionType}
                  onChange={(e) => handleInputChange("commissionType", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    border: BORDER,
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
                >
                  {COMMISSION_TYPES.map((ct) => (
                    <option key={ct} value={ct}>
                      {ct}
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
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  value={form.commissionRate}
                  onChange={(e) =>
                    handleInputChange("commissionRate", parseFloat(e.target.value) || 0)
                  }
                  style={{
                    width: "100%",
                    padding: "6px",
                    border: BORDER,
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
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
                  Monthly Target (Rs.)
                </label>
                <input
                  type="number"
                  value={form.monthlyTarget}
                  onChange={(e) =>
                    handleInputChange("monthlyTarget", parseFloat(e.target.value) || 0)
                  }
                  style={{
                    width: "100%",
                    padding: "6px",
                    border: BORDER,
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
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
                  Linked Employee
                </label>
                <select
                  value={form.employeeId}
                  onChange={(e) => handleInputChange("employeeId", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    border: BORDER,
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
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
                  Is Active
                </label>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => handleInputChange("isActive", e.target.checked)}
                  style={{ marginRight: "5px" }}
                />
                Active
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
                  Joining Date
                </label>
                <input
                  type="date"
                  value={form.joiningDate}
                  onChange={(e) => handleInputChange("joiningDate", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    border: BORDER,
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
                />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                    fontSize: "12px",
                  }}
                >
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "6px",
                    border: BORDER,
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
              <button
                onClick={handleSave}
                style={{
                  backgroundColor: "var(--ds-action-primary)",
                  color: "white",
                  border: BORDER,
                  padding: "8px 16px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Save
              </button>
              <button
                onClick={clearForm}
                style={{
                  backgroundColor: BG_HEADER,
                  color: "#000000",
                  border: BORDER,
                  padding: "8px 16px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Clear
              </button>
              {editingId && (
                <button
                  onClick={() => handleDelete(editingId)}
                  style={{
                    backgroundColor: "#dc2626",
                    color: "white",
                    border: BORDER,
                    padding: "8px 16px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "performance" && (
        <div
          style={{ backgroundColor: BG_CARD, border: BORDER, padding: "20px", borderRadius: "8px" }}
        >
          <div
            style={{
              display: "flex",
              gap: "15px",
              marginBottom: "20px",
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
                onChange={(e) => setSelectedFiscalYear(e.target.value)}
                style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
              >
                <option value="">Select Fiscal Year</option>
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
                Period
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
              >
                <option value="Full Year">Full Year</option>
                <option value="Month">Month</option>
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
                value={selectedSalesperson}
                onChange={(e) => setSelectedSalesperson(e.target.value)}
                style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
              >
                <option value="ALL">All Salespersons</option>
                {salespersons
                  .filter((sp) => matchBranch((sp as any).branchId))
                  .map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {}}
              style={{
                backgroundColor: "var(--ds-action-primary)",
                color: "white",
                border: BORDER,
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Run Report
            </button>
            <button
              onClick={exportPerformanceExcel}
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

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
              <thead>
                <tr style={{ backgroundColor: BG_HEADER }}>
                  <th style={{ border: BORDER, padding: "8px" }}>Salesperson</th>
                  <th style={{ border: BORDER, padding: "8px" }}>Area/Route</th>
                  <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Target</th>
                  <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    Actual Sales
                  </th>
                  <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    Achievement %
                  </th>
                  <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Collection</th>
                  <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    Outstanding
                  </th>
                  <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Invoices</th>
                  <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Commission</th>
                </tr>
              </thead>
              <tbody>
                {performanceData.map((p, idx) => {
                  const achievementColor =
                    p.achievementPct >= 100
                      ? "#059669"
                      : p.achievementPct >= 75
                        ? "#d97706"
                        : "#dc2626";

                  return (
                    <tr
                      key={p.sp.id}
                      style={{ backgroundColor: idx % 2 === 0 ? BG_DEEP : "transparent" }}
                    >
                      <td style={{ border: BORDER, padding: "8px" }}>{p.sp.name}</td>
                      <td style={{ border: BORDER, padding: "8px" }}>{p.sp.assignedArea}</td>
                      <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                        {money(p.target)}
                      </td>
                      <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                        {money(p.totalSales)}
                      </td>
                      <td
                        style={{
                          border: BORDER,
                          padding: "8px",
                          textAlign: "right",
                          color: achievementColor,
                          fontWeight: "bold",
                        }}
                      >
                        {p.achievementPct.toFixed(2)}%
                      </td>
                      <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                        {money(p.totalCollection)}
                      </td>
                      <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                        {money(p.outstanding)}
                      </td>
                      <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                        {p.invoiceCount}
                      </td>
                      <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                        {money(p.commissionEarned)}
                      </td>
                    </tr>
                  );
                })}
                {/* Total Row */}
                <tr style={{ backgroundColor: BG_HEADER }}>
                  <td style={{ border: BORDER, padding: "8px", fontWeight: "bold" }}>TOTAL</td>
                  <td style={{ border: BORDER, padding: "8px" }}></td>
                  <td
                    style={{
                      border: BORDER,
                      padding: "8px",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    {money(performanceData.reduce((sum, p) => sum + p.target, 0))}
                  </td>
                  <td
                    style={{
                      border: BORDER,
                      padding: "8px",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    {money(performanceData.reduce((sum, p) => sum + p.totalSales, 0))}
                  </td>
                  <td
                    style={{
                      border: BORDER,
                      padding: "8px",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    {performanceData.length > 0
                      ? (
                          performanceData.reduce((sum, p) => sum + p.achievementPct, 0) /
                          performanceData.length
                        ).toFixed(2)
                      : "0.00"}
                    %
                  </td>
                  <td
                    style={{
                      border: BORDER,
                      padding: "8px",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    {money(performanceData.reduce((sum, p) => sum + p.totalCollection, 0))}
                  </td>
                  <td
                    style={{
                      border: BORDER,
                      padding: "8px",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    {money(performanceData.reduce((sum, p) => sum + p.outstanding, 0))}
                  </td>
                  <td
                    style={{
                      border: BORDER,
                      padding: "8px",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    {performanceData.reduce((sum, p) => sum + p.invoiceCount, 0)}
                  </td>
                  <td
                    style={{
                      border: BORDER,
                      padding: "8px",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    {money(performanceData.reduce((sum, p) => sum + p.commissionEarned, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "area" && (
        <div
          style={{ backgroundColor: BG_CARD, border: BORDER, padding: "20px", borderRadius: "8px" }}
        >
          <div
            style={{
              display: "flex",
              gap: "15px",
              marginBottom: "20px",
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
                Province
              </label>
              <select
                value=""
                onChange={() => {}}
                style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
              >
                <option value="">All Provinces</option>
                {NEPAL_PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {}}
              style={{
                backgroundColor: "var(--ds-action-primary)",
                color: "white",
                border: BORDER,
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Run Report
            </button>
          </div>

          <div style={{ height: "300px", marginBottom: "20px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topAreasData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [money(value), "Sales"]} />
                <Bar dataKey="sales" name="Sales">
                  {topAreasData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="var(--ds-action-primary)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ overflowY: "auto", maxHeight: "600px" }}>
            {Object.keys(areaWiseData).map((province) => (
              <div key={province}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: BG_HEADER,
                    padding: "8px",
                    cursor: "pointer",
                    border: BORDER,
                    marginBottom: "2px",
                  }}
                  onClick={() => toggleExpand("area", province)}
                >
                  <div style={{ fontWeight: "bold" }}>
                    <span style={{ marginRight: "5px" }}>
                      {expandedAreas[province] ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </span>
                    {province}
                  </div>
                  <div style={{ fontWeight: "bold" }}>
                    {money(
                      Object.values(areaWiseData[province]).reduce(
                        (sum, dist) =>
                          sum + Object.values(dist).reduce((s, sp) => s + (sp.totalSales || 0), 0),
                        0,
                      ),
                    )}
                  </div>
                </div>

                {expandedAreas[province] &&
                  Object.keys(areaWiseData[province]).map((district) => (
                    <div key={district} style={{ marginLeft: "20px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          backgroundColor: BG_DEEP,
                          padding: "6px",
                          cursor: "pointer",
                          border: BORDER,
                          marginBottom: "2px",
                        }}
                        onClick={() => toggleExpand("district", `${province}-${district}`)}
                      >
                        <div>
                          <span style={{ marginRight: "5px" }}>
                            {expandedDistricts[`${province}-${district}`] ? (
                              <ChevronDown size={14} />
                            ) : (
                              <ChevronRight size={14} />
                            )}
                          </span>
                          {district}
                        </div>
                        <div>
                          {money(
                            Object.values(areaWiseData[province][district]).reduce(
                              (sum, sp) => sum + (sp.totalSales || 0),
                              0,
                            ),
                          )}
                        </div>
                      </div>

                      {expandedDistricts[`${province}-${district}`] &&
                        Object.keys(areaWiseData[province][district]).map((spId) => {
                          const spData = areaWiseData[province][district][spId];
                          return (
                            <div key={spId} style={{ marginLeft: "40px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  backgroundColor: "white",
                                  padding: "6px",
                                  cursor: "pointer",
                                  border: BORDER,
                                  marginBottom: "2px",
                                }}
                                onClick={() =>
                                  toggleExpand("sp", `${province}-${district}-${spId}`)
                                }
                              >
                                <div>
                                  <span style={{ marginRight: "5px" }}>
                                    {expandedSalespersons[`${province}-${district}-${spId}`] ? (
                                      <ChevronDown size={14} />
                                    ) : (
                                      <ChevronRight size={14} />
                                    )}
                                  </span>
                                  {spData.salesperson.name}
                                </div>
                                <div>{money(spData.totalSales)}</div>
                              </div>

                              {expandedSalespersons[`${province}-${district}-${spId}`] && (
                                <div
                                  style={{
                                    marginLeft: "60px",
                                    borderLeft: "2px solid #ccc",
                                    paddingLeft: "10px",
                                  }}
                                >
                                  {spData.invoices.map((inv) => (
                                    <div
                                      key={inv.id}
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        padding: "4px 0",
                                      }}
                                    >
                                      <div>
                                        {inv.invoiceNo} - {inv.date}
                                      </div>
                                      <div>{money(inv.grandTotal)}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
