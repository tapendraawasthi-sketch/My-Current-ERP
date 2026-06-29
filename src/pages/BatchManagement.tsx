// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import {
  Package,
  AlertTriangle,
  Calendar,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Bell,
  Lock,
  Clock,
} from "lucide-react";

const BORDER = "1px solid #000";
const BG = "#E4F1D9";
const BG_CARD = "#EBF5E2";
const BG_HEADER = "#D4EABD";
const BG_DEEP = "#C9DEB5";
const EXPIRED_BG = "#fee2e2";
const NEAR_EXPIRY_BG = "#fef9c3";
const OK_BG = "#dcfce7";

function money(v) {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const TABS = [
  { id: "master", label: "Batch Master" },
  { id: "near_expiry", label: "Near-Expiry Dashboard" },
  { id: "on_hold", label: "Batches On Hold" },
  { id: "report", label: "Expiry Report" },
  { id: "fifo", label: "FIFO Picker" },
];

export default function BatchManagement() {
  const { batches, items, warehouses, addVoucher, accounts, companySettings } = useStore();
  const [activeTab, setActiveTab] = useState("master");
  const [allBatches, setAllBatches] = useState([]);
  const [filteredBatches, setFilteredBatches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({
    id: "",
    batchName: "",
    itemId: "",
    mfgDate: "",
    expiryDate: "",
    mrp: 0,
    purchaseRate: 0,
    salesRate: 0,
    godownId: "",
    openingQty: 0,
    isActive: true,
    trackExpiry: false,
    isOnHold: false,
    holdReason: "",
  });
  const [writeOffModal, setWriteOffModal] = useState({ show: false, batch: null });
  const [writeOffData, setWriteOffData] = useState({ date: "", reason: "" });
  const [expiryFilters, setExpiryFilters] = useState({
    itemGroupId: "",
    itemId: "",
    daysRange: 30,
  });
  const [reportData, setReportData] = useState([]);
  const [reportFilters, setReportFilters] = useState({
    fromDate: "",
    toDate: "",
    itemGroupId: "",
  });
  const [selectedItemForFifo, setSelectedItemForFifo] = useState("");

  // Load batches from DB
  useEffect(() => {
    const db = getDB();
    Promise.all([db.batches.toArray().catch(() => [])]).then(([batchData]) => {
      setAllBatches(batchData);
    });
  }, []);

  // Recompute filtered batches when allBatches or search term changes
  useEffect(() => {
    let result = allBatches;

    if (searchTerm) {
      result = result.filter(
        (b) =>
          b.batchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.itemId.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (activeTab === "master") {
      // For master tab, show all batches
    } else if (activeTab === "near_expiry") {
      // Filter for near-expiry batches
      const days = expiryFilters.daysRange === "ALL" ? 9999 : expiryFilters.daysRange;
      result = result.filter((b) => {
        const daysToExp = daysToExpiry(b.expiryDate);
        return daysToExp <= days && daysToExp >= 0;
      });
    } else if (activeTab === "on_hold") {
      // Filter for held batches
      result = result.filter((b) => b.isOnHold);
    }

    setFilteredBatches(result);
  }, [allBatches, searchTerm, activeTab, expiryFilters]);

  // Calculate days to expiry
  const daysToExpiry = (expiryDate) => {
    if (!expiryDate) return 9999;
    const today = new Date();
    const expiry = new Date(expiryDate);
    return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  };

  // Determine status and color
  const getStatusAndColor = (days) => {
    if (days < 0) return { status: "EXPIRED", color: "#dc2626", bgColor: EXPIRED_BG };
    if (days <= 30) return { status: "CRITICAL", color: "#d97706", bgColor: NEAR_EXPIRY_BG };
    if (days <= 60) return { status: "NEAR EXPIRY", color: "#f59e0b", bgColor: NEAR_EXPIRY_BG };
    if (days <= 90) return { status: "WATCH", color: "#eab308", bgColor: NEAR_EXPIRY_BG };
    return { status: "OK", color: "#059669", bgColor: OK_BG };
  };

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Handle form submission
  const handleSubmit = async () => {
    const db = getDB();
    const batchToSave = {
      ...form,
      id: form.id || generateId(),
      createdAt: form.id ? undefined : new Date().toISOString(),
    };

    try {
      await db.batches.put(batchToSave);
      setAllBatches((prev) => [...prev.filter((b) => b.id !== batchToSave.id), batchToSave]);
      setShowForm(false);
      setForm({
        id: "",
        batchName: "",
        itemId: "",
        mfgDate: "",
        expiryDate: "",
        mrp: 0,
        purchaseRate: 0,
        salesRate: 0,
        godownId: "",
        openingQty: 0,
        isActive: true,
        trackExpiry: false,
        isOnHold: false,
        holdReason: "",
      });
      toast.success(form.id ? "Batch updated successfully" : "Batch created successfully");
    } catch (error) {
      console.error("Error saving batch:", error);
      toast.error("Failed to save batch");
    }
  };

  // Handle edit
  const handleEdit = (batch) => {
    setForm({
      id: batch.id,
      batchName: batch.batchName,
      itemId: batch.itemId,
      mfgDate: batch.mfgDate || "",
      expiryDate: batch.expiryDate || "",
      mrp: batch.mrp || 0,
      purchaseRate: batch.purchaseRate || 0,
      salesRate: batch.salesRate || 0,
      godownId: batch.godownId || "",
      openingQty: batch.openingQty || 0,
      isActive: batch.isActive !== undefined ? batch.isActive : true,
      trackExpiry: batch.trackExpiry || false,
      isOnHold: batch.isOnHold || false,
      holdReason: batch.holdReason || "",
    });
    setShowForm(true);
  };

  // Handle delete
  const handleDelete = async (id) => {
    const db = getDB();
    try {
      await db.batches.delete(id);
      setAllBatches((prev) => prev.filter((b) => b.id !== id));
      toast.success("Batch deleted successfully");
    } catch (error) {
      console.error("Error deleting batch:", error);
      toast.error("Failed to delete batch");
    }
  };

  // Handle hold/release
  const handleHoldToggle = async (batchId, isHold, reason = "") => {
    const db = getDB();
    try {
      await db.batches.update(batchId, { isOnHold: isHold, holdReason: reason });
      setAllBatches((prev) =>
        prev.map((b) => (b.id === batchId ? { ...b, isOnHold: isHold, holdReason: reason } : b)),
      );
      toast.success(isHold ? "Batch placed on hold" : "Batch released");
    } catch (error) {
      console.error("Error updating hold status:", error);
      toast.error("Failed to update hold status");
    }
  };

  // Handle write-off submission
  const handleWriteOffSubmit = async () => {
    if (!writeOffData.date || !writeOffData.reason) {
      toast.error("Please provide date and reason for write-off");
      return;
    }

    const batch = writeOffModal.batch;
    const item = items.find((i) => i.id === batch.itemId);

    if (!item) {
      toast.error("Item not found for this batch");
      return;
    }

    // Create a stock journal voucher for write-off
    const writeOffVoucher = {
      id: generateId(),
      voucherNo: `WR-${generateId().slice(0, 6)}`,
      date: writeOffData.date,
      dateNepali: "", // Will be computed later
      type: "stock-journal",
      partyId: null,
      lines: [
        {
          itemId: batch.itemId,
          warehouseId: batch.godownId,
          batchId: batch.id,
          quantity: batch.openingQty,
          rate: batch.purchaseRate,
          amount: batch.openingQty * batch.purchaseRate,
          type: "credit", // Remove stock
          narration: `Write-off expired batch ${batch.batchName}: ${writeOffData.reason}`,
        },
        {
          itemId: batch.itemId,
          warehouseId: batch.godownId,
          batchId: batch.id,
          quantity: batch.openingQty,
          rate: batch.purchaseRate,
          amount: batch.openingQty * batch.purchaseRate,
          type: "debit", // Expense account
          accountId: "EXPIRED_STOCK_WRITE_OFF_ACCOUNT_ID", // This needs to be a real account ID
          narration: `Write-off expired batch ${batch.batchName}: ${writeOffData.reason}`,
        },
      ],
      subTotal: batch.openingQty * batch.purchaseRate,
      grandTotal: batch.openingQty * batch.purchaseRate,
      status: "posted",
      narration: `Write-off expired batch ${batch.batchName}: ${writeOffData.reason}`,
      createdAt: new Date().toISOString(),
    };

    try {
      await addVoucher(writeOffVoucher);
      await handleDelete(batch.id);
      setWriteOffModal({ show: false, batch: null });
      setWriteOffData({ date: "", reason: "" });
      toast.success("Batch written off successfully");
    } catch (error) {
      console.error("Error writing off batch:", error);
      toast.error("Failed to write off batch");
    }
  };

  // Render batch master tab
  const renderBatchMaster = () => (
    <div style={{ padding: "20px", backgroundColor: BG_CARD, borderRadius: "8px", border: BORDER }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>Batch Master</h2>
        <button
          onClick={() => {
            setForm({
              id: "",
              batchName: "",
              itemId: "",
              mfgDate: "",
              expiryDate: "",
              mrp: 0,
              purchaseRate: 0,
              salesRate: 0,
              godownId: "",
              openingQty: 0,
              isActive: true,
              trackExpiry: false,
              isOnHold: false,
              holdReason: "",
            });
            setShowForm(true);
          }}
          style={{
            backgroundColor: "#1557b0",
            color: "white",
            border: BORDER,
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <Plus size={16} />
          Add Batch
        </button>
      </div>

      {showForm && (
        <div
          style={{
            marginBottom: "20px",
            padding: "15px",
            backgroundColor: BG_DEEP,
            borderRadius: "8px",
            border: BORDER,
          }}
        >
          <h3 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "15px" }}>
            {form.id ? "Edit Batch" : "Add New Batch"}
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "15px",
            }}
          >
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Batch Name *
              </label>
              <input
                type="text"
                value={form.batchName}
                onChange={(e) => handleInputChange("batchName", e.target.value)}
                style={{ width: "100%", padding: "8px", border: BORDER, borderRadius: "4px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Item *
              </label>
              <select
                value={form.itemId}
                onChange={(e) => handleInputChange("itemId", e.target.value)}
                style={{ width: "100%", padding: "8px", border: BORDER, borderRadius: "4px" }}
              >
                <option value="">Select Item</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Mfg Date
              </label>
              <input
                type="date"
                value={form.mfgDate}
                onChange={(e) => handleInputChange("mfgDate", e.target.value)}
                style={{ width: "100%", padding: "8px", border: BORDER, borderRadius: "4px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Expiry Date
              </label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={(e) => handleInputChange("expiryDate", e.target.value)}
                style={{ width: "100%", padding: "8px", border: BORDER, borderRadius: "4px" }}
                disabled={!form.trackExpiry}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Track Expiry
              </label>
              <input
                type="checkbox"
                checked={form.trackExpiry}
                onChange={(e) => handleInputChange("trackExpiry", e.target.checked)}
                style={{ marginRight: "5px" }}
              />
              Enable expiry tracking
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                MRP
              </label>
              <input
                type="number"
                value={form.mrp}
                onChange={(e) => handleInputChange("mrp", parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: "8px", border: BORDER, borderRadius: "4px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Purchase Rate
              </label>
              <input
                type="number"
                value={form.purchaseRate}
                onChange={(e) => handleInputChange("purchaseRate", parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: "8px", border: BORDER, borderRadius: "4px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Sales Rate
              </label>
              <input
                type="number"
                value={form.salesRate}
                onChange={(e) => handleInputChange("salesRate", parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: "8px", border: BORDER, borderRadius: "4px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Warehouse
              </label>
              <select
                value={form.godownId}
                onChange={(e) => handleInputChange("godownId", e.target.value)}
                style={{ width: "100%", padding: "8px", border: BORDER, borderRadius: "4px" }}
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.code} - {wh.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Opening Qty
              </label>
              <input
                type="number"
                value={form.openingQty}
                onChange={(e) => handleInputChange("openingQty", parseInt(e.target.value) || 0)}
                style={{ width: "100%", padding: "8px", border: BORDER, borderRadius: "4px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Active
              </label>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => handleInputChange("isActive", e.target.checked)}
                style={{ marginRight: "5px" }}
              />
              Is Active
            </div>
          </div>
          <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
            <button
              onClick={handleSubmit}
              style={{
                backgroundColor: "#059669",
                color: "white",
                border: BORDER,
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              {form.id ? "Update" : "Save"} Batch
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                backgroundColor: "#dc2626",
                color: "white",
                border: BORDER,
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
        <Search size={18} style={{ color: "#000000" }} />
        <input
          type="text"
          placeholder="Search batches..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: "8px", border: BORDER, borderRadius: "4px", width: "300px" }}
        />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
          <thead>
            <tr style={{ backgroundColor: BG_HEADER }}>
              <th style={{ border: BORDER, padding: "8px" }}>Batch No</th>
              <th style={{ border: BORDER, padding: "8px" }}>Item</th>
              <th style={{ border: BORDER, padding: "8px" }}>Mfg Date</th>
              <th style={{ border: BORDER, padding: "8px" }}>Expiry Date</th>
              <th style={{ border: BORDER, padding: "8px" }}>Days Remaining</th>
              <th style={{ border: BORDER, padding: "8px" }}>Status</th>
              <th style={{ border: BORDER, padding: "8px" }}>Qty</th>
              <th style={{ border: BORDER, padding: "8px" }}>Purchase Rate</th>
              <th style={{ border: BORDER, padding: "8px" }}>Value</th>
              <th style={{ border: BORDER, padding: "8px" }}>Warehouse</th>
              <th style={{ border: BORDER, padding: "8px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBatches.map((batch) => {
              const item = items.find((i) => i.id === batch.itemId);
              const days = daysToExpiry(batch.expiryDate);
              const { status, color, bgColor } = getStatusAndColor(days);
              const value = (batch.openingQty || 0) * (batch.purchaseRate || 0);

              return (
                <tr key={batch.id} style={{ backgroundColor: bgColor }}>
                  <td style={{ border: BORDER, padding: "8px" }}>{batch.batchName}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{item?.name || "N/A"}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{batch.mfgDate}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{batch.expiryDate}</td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>{days}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>
                    <span
                      style={{
                        backgroundColor: color,
                        color: "white",
                        padding: "2px 6px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "bold",
                      }}
                    >
                      {status}
                    </span>
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {batch.openingQty}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(batch.purchaseRate)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(value)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px" }}>{batch.godownId}</td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                    {!batch.isOnHold ? (
                      <button
                        onClick={() => handleHoldToggle(batch.id, true)}
                        style={{
                          backgroundColor: "#d97706",
                          color: "white",
                          border: BORDER,
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "11px",
                          marginRight: "5px",
                        }}
                      >
                        Hold
                      </button>
                    ) : (
                      <button
                        onClick={() => handleHoldToggle(batch.id, false)}
                        style={{
                          backgroundColor: "#059669",
                          color: "white",
                          border: BORDER,
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "11px",
                          marginRight: "5px",
                        }}
                      >
                        Release
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(batch)}
                      style={{
                        backgroundColor: "#1557b0",
                        color: "white",
                        border: BORDER,
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                        marginRight: "5px",
                      }}
                    >
                      <Edit size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(batch.id)}
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
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Render near-expiry dashboard
  const renderNearExpiryDashboard = () => {
    const expiringIn30 = allBatches.filter((b) => {
      const days = daysToExpiry(b.expiryDate);
      return days >= 0 && days <= 30;
    });
    const expiringIn60 = allBatches.filter((b) => {
      const days = daysToExpiry(b.expiryDate);
      return days >= 0 && days <= 60;
    });
    const expiringIn90 = allBatches.filter((b) => {
      const days = daysToExpiry(b.expiryDate);
      return days >= 0 && days <= 90;
    });

    const expired = allBatches.filter((b) => daysToExpiry(b.expiryDate) < 0);

    const value30 = expiringIn30.reduce((sum, b) => sum + b.openingQty * b.purchaseRate, 0);
    const value60 = expiringIn60.reduce((sum, b) => sum + b.openingQty * b.purchaseRate, 0);
    const value90 = expiringIn90.reduce((sum, b) => sum + b.openingQty * b.purchaseRate, 0);
    const valueExpired = expired.reduce((sum, b) => sum + b.openingQty * b.purchaseRate, 0);

    return (
      <div
        style={{ padding: "20px", backgroundColor: BG_CARD, borderRadius: "8px", border: BORDER }}
      >
        <h2
          style={{ fontSize: "18px", fontWeight: "bold", color: "#000000", marginBottom: "20px" }}
        >
          Near-Expiry Dashboard
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "15px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "#fecaca",
              padding: "15px",
              borderRadius: "8px",
              border: BORDER,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#dc2626" }}>
              {expired.length}
            </div>
            <div style={{ color: "#000000", marginTop: "5px" }}>Already Expired</div>
            <div style={{ color: "#000000", fontWeight: "bold", marginTop: "5px" }}>
              {money(valueExpired)}
            </div>
          </div>
          <div
            style={{
              backgroundColor: EXPIRED_BG,
              padding: "15px",
              borderRadius: "8px",
              border: BORDER,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#dc2626" }}>
              {expiringIn30.length}
            </div>
            <div style={{ color: "#000000", marginTop: "5px" }}>Expiring in 30 Days</div>
            <div style={{ color: "#000000", fontWeight: "bold", marginTop: "5px" }}>
              {money(value30)}
            </div>
          </div>
          <div
            style={{
              backgroundColor: NEAR_EXPIRY_BG,
              padding: "15px",
              borderRadius: "8px",
              border: BORDER,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#d97706" }}>
              {expiringIn60.length}
            </div>
            <div style={{ color: "#000000", marginTop: "5px" }}>Expiring in 60 Days</div>
            <div style={{ color: "#000000", fontWeight: "bold", marginTop: "5px" }}>
              {money(value60)}
            </div>
          </div>
          <div
            style={{
              backgroundColor: NEAR_EXPIRY_BG,
              padding: "15px",
              borderRadius: "8px",
              border: BORDER,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#f59e0b" }}>
              {expiringIn90.length}
            </div>
            <div style={{ color: "#000000", marginTop: "5px" }}>Expiring in 90 Days</div>
            <div style={{ color: "#000000", fontWeight: "bold", marginTop: "5px" }}>
              {money(value90)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "15px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Item Group
            </label>
            <select
              value={expiryFilters.itemGroupId}
              onChange={(e) => setExpiryFilters({ ...expiryFilters, itemGroupId: e.target.value })}
              style={{ padding: "8px", border: BORDER, borderRadius: "4px" }}
            >
              <option value="">All Groups</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Item
            </label>
            <select
              value={expiryFilters.itemId}
              onChange={(e) => setExpiryFilters({ ...expiryFilters, itemId: e.target.value })}
              style={{ padding: "8px", border: BORDER, borderRadius: "4px" }}
            >
              <option value="">All Items</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Days Filter
            </label>
            <select
              value={expiryFilters.daysRange}
              onChange={(e) => setExpiryFilters({ ...expiryFilters, daysRange: e.target.value })}
              style={{ padding: "8px", border: BORDER, borderRadius: "4px" }}
            >
              <option value={30}>30 Days</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days</option>
              <option value="ALL">All</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
            <thead>
              <tr style={{ backgroundColor: BG_HEADER }}>
                <th style={{ border: BORDER, padding: "8px" }}>Item Name</th>
                <th style={{ border: BORDER, padding: "8px" }}>Batch No</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Qty In Stock</th>
                <th style={{ border: BORDER, padding: "8px" }}>Expiry Date</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                  Days Remaining
                </th>
                <th style={{ border: BORDER, padding: "8px" }}>Value</th>
                <th style={{ border: BORDER, padding: "8px" }}>Status</th>
                <th style={{ border: BORDER, padding: "8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map((batch) => {
                const item = items.find((i) => i.id === batch.itemId);
                const days = daysToExpiry(batch.expiryDate);
                const { status, color, bgColor } = getStatusAndColor(days);
                const value = (batch.openingQty || 0) * (batch.purchaseRate || 0);

                return (
                  <tr key={batch.id} style={{ backgroundColor: bgColor }}>
                    <td style={{ border: BORDER, padding: "8px" }}>{item?.name || "N/A"}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>{batch.batchName}</td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {batch.openingQty}
                    </td>
                    <td style={{ border: BORDER, padding: "8px" }}>{batch.expiryDate}</td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>{days}</td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(value)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px" }}>
                      <span
                        style={{
                          backgroundColor: color,
                          color: "white",
                          padding: "2px 6px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: "bold",
                        }}
                      >
                        {status}
                      </span>
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                      <button
                        onClick={() => handleHoldToggle(batch.id, true)}
                        style={{
                          backgroundColor: "#d97706",
                          color: "white",
                          border: BORDER,
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "11px",
                          marginRight: "5px",
                        }}
                      >
                        Hold
                      </button>
                      <button
                        onClick={() => setWriteOffModal({ show: true, batch })}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render on-hold tab
  const renderOnHoldTab = () => {
    const heldBatches = allBatches.filter((b) => b.isOnHold);

    return (
      <div
        style={{ padding: "20px", backgroundColor: BG_CARD, borderRadius: "8px", border: BORDER }}
      >
        <h2
          style={{ fontSize: "18px", fontWeight: "bold", color: "#000000", marginBottom: "20px" }}
        >
          Batches On Hold
        </h2>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
            <thead>
              <tr style={{ backgroundColor: BG_HEADER }}>
                <th style={{ border: BORDER, padding: "8px" }}>Item</th>
                <th style={{ border: BORDER, padding: "8px" }}>Batch No</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Qty</th>
                <th style={{ border: BORDER, padding: "8px" }}>Expiry Date</th>
                <th style={{ border: BORDER, padding: "8px" }}>Hold Reason</th>
                <th style={{ border: BORDER, padding: "8px" }}>Hold Date</th>
                <th style={{ border: BORDER, padding: "8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {heldBatches.map((batch) => {
                const item = items.find((i) => i.id === batch.itemId);

                return (
                  <tr key={batch.id}>
                    <td style={{ border: BORDER, padding: "8px" }}>{item?.name || "N/A"}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>{batch.batchName}</td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {batch.openingQty}
                    </td>
                    <td style={{ border: BORDER, padding: "8px" }}>{batch.expiryDate}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>{batch.holdReason}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>
                      {batch.createdAt?.split("T")[0]}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                      <button
                        onClick={() => handleHoldToggle(batch.id, false)}
                        style={{
                          backgroundColor: "#059669",
                          color: "white",
                          border: BORDER,
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "11px",
                          marginRight: "5px",
                        }}
                      >
                        Release
                      </button>
                      <button
                        onClick={() => setWriteOffModal({ show: true, batch })}
                        style={{
                          backgroundColor: "#dc2626",
                          color: "white",
                          border: BORDER,
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "11px",
                          marginRight: "5px",
                        }}
                      >
                        Write Off
                      </button>
                      <button
                        onClick={() => {}}
                        style={{
                          backgroundColor: "#1557b0",
                          color: "white",
                          border: BORDER,
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "11px",
                        }}
                      >
                        Return
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render expiry report
  const renderExpiryReport = () => {
    const runReport = () => {
      let result = allBatches;

      if (reportFilters.fromDate) {
        result = result.filter((b) => new Date(b.expiryDate) >= new Date(reportFilters.fromDate));
      }
      if (reportFilters.toDate) {
        result = result.filter((b) => new Date(b.expiryDate) <= new Date(reportFilters.toDate));
      }
      if (reportFilters.itemGroupId) {
        result = result.filter((b) => {
          const item = items.find((i) => i.id === b.itemId);
          return item?.groupId === reportFilters.itemGroupId;
        });
      }

      setReportData(result);
    };

    const exportExcel = () => {
      if (reportData.length === 0) {
        toast.error("No data to export");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(
        reportData.map((b) => {
          const item = items.find((i) => i.id === b.itemId);
          const warehouse = warehouses.find((w) => w.id === b.godownId);
          const days = daysToExpiry(b.expiryDate);
          return {
            "Item Code": item?.code || "N/A",
            "Item Name": item?.name || "N/A",
            "Batch No": b.batchName,
            "Batch Qty": b.openingQty,
            "MFG Date": b.mfgDate,
            "Expiry Date": b.expiryDate,
            "Days to Expiry": days,
            "Purchase Rate": b.purchaseRate,
            "Stock Value": (b.openingQty || 0) * (b.purchaseRate || 0),
            Warehouse: warehouse?.name || "N/A",
          };
        }),
      );

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Expiry Report");
      XLSX.writeFile(wb, `Expiry_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Exported to Excel successfully");
    };

    const totalNearExpiry = reportData
      .filter((b) => daysToExpiry(b.expiryDate) >= 0 && daysToExpiry(b.expiryDate) <= 90)
      .reduce((sum, b) => sum + b.openingQty * b.purchaseRate, 0);

    const totalExpired = reportData
      .filter((b) => daysToExpiry(b.expiryDate) < 0)
      .reduce((sum, b) => sum + b.openingQty * b.purchaseRate, 0);

    return (
      <div
        style={{ padding: "20px", backgroundColor: BG_CARD, borderRadius: "8px", border: BORDER }}
      >
        <h2
          style={{ fontSize: "18px", fontWeight: "bold", color: "#000000", marginBottom: "20px" }}
        >
          Expiry Report
        </h2>

        <div style={{ display: "flex", gap: "15px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Expiring Between
            </label>
            <input
              type="date"
              value={reportFilters.fromDate}
              onChange={(e) => setReportFilters({ ...reportFilters, fromDate: e.target.value })}
              style={{ padding: "8px", border: BORDER, borderRadius: "4px" }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>And</label>
            <input
              type="date"
              value={reportFilters.toDate}
              onChange={(e) => setReportFilters({ ...reportFilters, toDate: e.target.value })}
              style={{ padding: "8px", border: BORDER, borderRadius: "4px" }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Item Group
            </label>
            <select
              value={reportFilters.itemGroupId}
              onChange={(e) => setReportFilters({ ...reportFilters, itemGroupId: e.target.value })}
              style={{ padding: "8px", border: BORDER, borderRadius: "4px" }}
            >
              <option value="">All Groups</option>
            </select>
          </div>
          <button
            onClick={runReport}
            style={{
              backgroundColor: "#1557b0",
              color: "white",
              border: BORDER,
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              alignSelf: "flex-end",
            }}
          >
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
              alignSelf: "flex-end",
            }}
          >
            Export Excel
          </button>
          <button
            onClick={() => {}}
            style={{
              backgroundColor: "#1557b0",
              color: "white",
              border: BORDER,
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              alignSelf: "flex-end",
            }}
          >
            Print
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "20px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: NEAR_EXPIRY_BG,
              padding: "15px",
              borderRadius: "8px",
              border: BORDER,
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#000000" }}>
              Total Near-Expiry Value
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "#d97706" }}>
              {money(totalNearExpiry)}
            </div>
          </div>
          <div
            style={{
              backgroundColor: EXPIRED_BG,
              padding: "15px",
              borderRadius: "8px",
              border: BORDER,
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#000000" }}>
              Total Expired Value
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "#dc2626" }}>
              {money(totalExpired)}
            </div>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
            <thead>
              <tr style={{ backgroundColor: BG_HEADER }}>
                <th style={{ border: BORDER, padding: "8px" }}>Item Code</th>
                <th style={{ border: BORDER, padding: "8px" }}>Item Name</th>
                <th style={{ border: BORDER, padding: "8px" }}>Batch No</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Batch Qty</th>
                <th style={{ border: BORDER, padding: "8px" }}>MFG Date</th>
                <th style={{ border: BORDER, padding: "8px" }}>Expiry Date</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                  Days to Expiry
                </th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                  Purchase Rate
                </th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Stock Value</th>
                <th style={{ border: BORDER, padding: "8px" }}>Warehouse</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((batch) => {
                const item = items.find((i) => i.id === batch.itemId);
                const warehouse = warehouses.find((w) => w.id === batch.godownId);
                const days = daysToExpiry(batch.expiryDate);

                return (
                  <tr key={batch.id}>
                    <td style={{ border: BORDER, padding: "8px" }}>{item?.code || "N/A"}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>{item?.name || "N/A"}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>{batch.batchName}</td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {batch.openingQty}
                    </td>
                    <td style={{ border: BORDER, padding: "8px" }}>{batch.mfgDate}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>{batch.expiryDate}</td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>{days}</td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(batch.purchaseRate)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(batch.openingQty * batch.purchaseRate)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px" }}>{warehouse?.name || "N/A"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render FIFO picker
  const renderFIFOPicker = () => {
    const item = items.find((i) => i.id === selectedItemForFifo);
    const relevantBatches = allBatches
      .filter((b) => b.itemId === selectedItemForFifo)
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

    return (
      <div
        style={{ padding: "20px", backgroundColor: BG_CARD, borderRadius: "8px", border: BORDER }}
      >
        <h2
          style={{ fontSize: "18px", fontWeight: "bold", color: "#000000", marginBottom: "20px" }}
        >
          FIFO Expiry Picker
        </h2>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Select Item
          </label>
          <select
            value={selectedItemForFifo}
            onChange={(e) => setSelectedItemForFifo(e.target.value)}
            style={{ padding: "8px", border: BORDER, borderRadius: "4px", width: "300px" }}
          >
            <option value="">Select an item to see FIFO picking order</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} - {item.name}
              </option>
            ))}
          </select>
        </div>

        {selectedItemForFifo && (
          <div>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                color: "#000000",
                marginBottom: "15px",
              }}
            >
              FIFO Order for {item?.name || "Selected Item"}
            </h3>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                How many units do you want to sell?
              </label>
              <input
                type="number"
                placeholder="Enter quantity to pick"
                style={{ padding: "8px", border: BORDER, borderRadius: "4px", width: "200px" }}
              />
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
                <thead>
                  <tr style={{ backgroundColor: BG_HEADER }}>
                    <th style={{ border: BORDER, padding: "8px" }}>Batch No</th>
                    <th style={{ border: BORDER, padding: "8px" }}>Expiry Date</th>
                    <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      Available Qty
                    </th>
                    <th style={{ border: BORDER, padding: "8px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {relevantBatches.map((batch) => {
                    const days = daysToExpiry(batch.expiryDate);
                    const { status, color } = getStatusAndColor(days);

                    return (
                      <tr key={batch.id}>
                        <td style={{ border: BORDER, padding: "8px" }}>{batch.batchName}</td>
                        <td style={{ border: BORDER, padding: "8px" }}>{batch.expiryDate}</td>
                        <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                          {batch.openingQty}
                        </td>
                        <td style={{ border: BORDER, padding: "8px" }}>
                          <span
                            style={{
                              backgroundColor: color,
                              color: "white",
                              padding: "2px 6px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: "bold",
                            }}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              style={{
                marginTop: "20px",
                padding: "15px",
                backgroundColor: BG_DEEP,
                borderRadius: "8px",
                border: BORDER,
              }}
            >
              <h4
                style={{
                  fontSize: "14px",
                  fontWeight: "bold",
                  color: "#000000",
                  marginBottom: "10px",
                }}
              >
                FIFO Consumption Plan
              </h4>
              <p style={{ color: "#000000" }}>
                {relevantBatches.length > 0
                  ? `When selling units from "${item?.name}", the system will prioritize batches by expiry date (earliest first).`
                  : "No batches available for this item."}
              </p>
              {relevantBatches.slice(0, 3).map((batch, idx) => (
                <p key={batch.id} style={{ color: "#000000", marginTop: "5px" }}>
                  {idx + 1}. {batch.batchName} (exp: {batch.expiryDate})
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: BG, minHeight: "100vh", padding: "20px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#000000", marginBottom: "20px" }}>
        Batch Management
      </h1>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: "5px", marginBottom: "20px", borderBottom: BORDER }}>
        {TABS.map((tab) => (
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
      {activeTab === "master" && renderBatchMaster()}
      {activeTab === "near_expiry" && renderNearExpiryDashboard()}
      {activeTab === "on_hold" && renderOnHoldTab()}
      {activeTab === "report" && renderExpiryReport()}
      {activeTab === "fifo" && renderFIFOPicker()}

      {/* Write-Off Modal */}
      {writeOffModal.show && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: BG_CARD,
              padding: "20px",
              borderRadius: "8px",
              border: BORDER,
              width: "90%",
              maxWidth: "500px",
            }}
          >
            <h2
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                color: "#000000",
                marginBottom: "15px",
              }}
            >
              Write Off Batch: {writeOffModal.batch?.batchName}
            </h2>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Write-Off Date
              </label>
              <input
                type="date"
                value={writeOffData.date}
                onChange={(e) => setWriteOffData({ ...writeOffData, date: e.target.value })}
                style={{ width: "100%", padding: "8px", border: BORDER, borderRadius: "4px" }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Reason for Write-Off
              </label>
              <textarea
                value={writeOffData.reason}
                onChange={(e) => setWriteOffData({ ...writeOffData, reason: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: BORDER,
                  borderRadius: "4px",
                  minHeight: "80px",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => {
                  setWriteOffModal({ show: false, batch: null });
                  setWriteOffData({ date: "", reason: "" });
                }}
                style={{
                  backgroundColor: "#dc2626",
                  color: "white",
                  border: BORDER,
                  padding: "8px 16px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleWriteOffSubmit}
                style={{
                  backgroundColor: "#059669",
                  color: "white",
                  border: BORDER,
                  padding: "8px 16px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Confirm Write-Off
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
