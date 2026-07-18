// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "@/lib/appToast";
import * as XLSX from "xlsx";
import {
  Factory,
  Package,
  ArrowRight,
  ArrowLeft,
  FileText,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  Printer,
} from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

const BORDER = "1px solid var(--ds-border-default)";
const BG = "var(--ds-surface-muted)";
const BG_CARD = "var(--ds-surface-muted)";
const BG_HEADER = "var(--ds-surface-hover)";
const BG_DEEP = "var(--ds-surface-muted)";
const OVERDUE_BG = "#fee2e2";
const COMPLETE_BG = "#dcfce7";
const PENDING_BG = "#fef9c3";

function money(v) {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

export default function JobWorkRegister({ defaultTab = "out" }: { defaultTab?: string }) {
  const { parties, items, accounts, vouchers, companySettings, addVoucher } = useStore();
  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [jobWorkOrders, setJobWorkOrders] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);

  // Out form state
  const [outForm, setOutForm] = useState({
    date: new Date().toISOString().split("T")[0],
    jobWorkerId: "",
    expectedReturnDate: "",
    description: "",
    materials: [],
    deliveryChallanNo: "",
    status: "Draft",
    notes: "",
  });

  // In form state
  const [inForm, setInForm] = useState({
    date: new Date().toISOString().split("T")[0],
    againstOrderId: "",
    jobWorkerId: "",
    jobWorkCharges: 0,
    jobWorkAccount: "",
    finishedGoods: [],
    scrapMaterials: [],
  });

  // Register filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterJobWorker, setFilterJobWorker] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Load job work orders
  useEffect(() => {
    const db = getDB();
    db.jobWorkOrders
      .toArray()
      .catch(() => [])
      .then(setJobWorkOrders);
  }, []);

  // Filter job workers
  const jobWorkers = useMemo(() => {
    return parties.filter((p) => p.type === "vendor" || p.type === "supplier");
  }, [parties]);

  // Filter job work orders for register
  const filteredOrders = useMemo(() => {
    let filtered = jobWorkOrders.filter((o) => matchBranch(o.branchId));

    if (dateFrom) {
      filtered = filtered.filter((o) => o.date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter((o) => o.date <= dateTo);
    }
    if (filterJobWorker !== "ALL") {
      filtered = filtered.filter((o) => o.jobWorkerId === filterJobWorker);
    }
    if (filterStatus !== "ALL") {
      filtered = filtered.filter((o) => o.status === filterStatus);
    }

    return filtered;
  }, [jobWorkOrders, dateFrom, dateTo, filterJobWorker, filterStatus, matchBranch, branchFilter]);

  // Summary counts
  const summaryCounts = useMemo(() => {
    const openOrders = jobWorkOrders.filter(
      (o) => o.status === "Sent" || o.status === "In-Process",
    ).length;
    const overdueOrders = jobWorkOrders.filter(
      (o) =>
        o.expectedReturnDate &&
        new Date(o.expectedReturnDate) < new Date() &&
        o.status !== "Completed",
    ).length;
    const completedThisMonth = jobWorkOrders.filter(
      (o) =>
        o.status === "Completed" &&
        new Date(o.date).getMonth() === new Date().getMonth() &&
        new Date(o.date).getFullYear() === new Date().getFullYear(),
    ).length;

    return { openOrders, overdueOrders, completedThisMonth };
  }, [jobWorkOrders]);

  // Handle adding material line for out form
  const addMaterialLine = () => {
    setOutForm((prev) => ({
      ...prev,
      materials: [
        ...prev.materials,
        { itemId: "", qty: 0, unit: "", rate: 0, amount: 0, notes: "" },
      ],
    }));
  };

  // Handle updating material line for out form
  const updateMaterialLine = (index, field, value) => {
    setOutForm((prev) => {
      const newMaterials = [...prev.materials];
      newMaterials[index] = { ...newMaterials[index], [field]: value };

      // Calculate amount if qty and rate are provided
      if (field === "qty" || field === "rate") {
        const rate = newMaterials[index].rate || 0;
        const qty = newMaterials[index].qty || 0;
        newMaterials[index].amount = rate * qty;
      }

      // Calculate total material value
      const totalValue = newMaterials.reduce((sum, line) => sum + line.amount, 0);

      return { ...prev, materials: newMaterials, totalMaterialValue: totalValue };
    });
  };

  // Handle removing material line
  const removeMaterialLine = (index) => {
    setOutForm((prev) => {
      const newMaterials = prev.materials.filter((_, i) => i !== index);
      const totalValue = newMaterials.reduce((sum, line) => sum + line.amount, 0);
      return { ...prev, materials: newMaterials, totalMaterialValue: totalValue };
    });
  };

  // Handle adding finished goods line for in form
  const addFinishedGoodLine = () => {
    setInForm((prev) => ({
      ...prev,
      finishedGoods: [...prev.finishedGoods, { itemId: "", qty: 0, unit: "", rate: 0, amount: 0 }],
    }));
  };

  // Handle updating finished goods line
  const updateFinishedGoodLine = (index, field, value) => {
    setInForm((prev) => {
      const newFG = [...prev.finishedGoods];
      newFG[index] = { ...newFG[index], [field]: value };

      if (field === "qty" || field === "rate") {
        const rate = newFG[index].rate || 0;
        const qty = newFG[index].qty || 0;
        newFG[index].amount = rate * qty;
      }

      return { ...prev, finishedGoods: newFG };
    });
  };

  // Handle adding scrap material line
  const addScrapLine = () => {
    setInForm((prev) => ({
      ...prev,
      scrapMaterials: [
        ...prev.scrapMaterials,
        { itemId: "", qty: 0, unit: "", rate: 0, amount: 0 },
      ],
    }));
  };

  // Handle updating scrap material line
  const updateScrapLine = (index, field, value) => {
    setInForm((prev) => {
      const newScrap = [...prev.scrapMaterials];
      newScrap[index] = { ...newScrap[index], [field]: value };

      if (field === "qty" || field === "rate") {
        const rate = newScrap[index].rate || 0;
        const qty = newScrap[index].qty || 0;
        newScrap[index].amount = rate * qty;
      }

      return { ...prev, scrapMaterials: newScrap };
    });
  };

  // Handle saving job work out order
  const handleSaveOutOrder = async () => {
    if (!outForm.jobWorkerId) {
      toast.error("Please select a job worker");
      return;
    }

    if (outForm.materials.length === 0) {
      toast.error("Please add at least one material line");
      return;
    }

    try {
      const db = getDB();
      const jobWorker = jobWorkers.find((jw) => jw.id === outForm.jobWorkerId);
      const orderNo = `JWO-${new Date().toISOString().split("T")[0]}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      const orderData = {
        id: editingOrder?.id || generateId(),
        orderNo,
        type: "out",
        date: outForm.date,
        jobWorkerId: outForm.jobWorkerId,
        jobWorkerName: jobWorker?.name || "N/A",
        expectedReturnDate: outForm.expectedReturnDate,
        description: outForm.description,
        materials: outForm.materials,
        totalMaterialValue: outForm.materials.reduce((sum, line) => sum + line.amount, 0),
        deliveryChallanNo: outForm.deliveryChallanNo,
        status: outForm.status,
        notes: outForm.notes,
        branchId: editingOrder?.branchId || readActiveBranchId() || undefined,
        createdAt: new Date().toISOString(),
      };

      await db.jobWorkOrders.put(orderData);
      toast.success("Job Work Out order saved successfully");

      // Refresh orders
      const updated = await db.jobWorkOrders.toArray();
      setJobWorkOrders(updated);

      // Reset form
      setOutForm({
        date: new Date().toISOString().split("T")[0],
        jobWorkerId: "",
        expectedReturnDate: "",
        description: "",
        materials: [],
        deliveryChallanNo: "",
        status: "Draft",
        notes: "",
      });
      setEditingOrder(null);
    } catch (error) {
      console.error("Error saving job work order:", error);
      toast.error("Failed to save job work order");
    }
  };

  // Handle saving job work in receipt
  const handleSaveInReceipt = async () => {
    if (!inForm.againstOrderId) {
      toast.error("Please select an existing job work order");
      return;
    }

    if (inForm.finishedGoods.length === 0) {
      toast.error("Please add at least one finished good");
      return;
    }

    try {
      const db = getDB();
      const jobWorker = jobWorkers.find((jw) => jw.id === inForm.jobWorkerId);
      const receiptNo = `JWI-${new Date().toISOString().split("T")[0]}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      // Calculate net job work cost
      const scrapAmount = inForm.scrapMaterials.reduce((sum, line) => sum + line.amount, 0);
      const netJobWorkCost = inForm.jobWorkCharges - scrapAmount;

      const receiptData = {
        id: generateId(),
        orderNo: receiptNo,
        type: "in",
        date: inForm.date,
        againstOrderId: inForm.againstOrderId,
        jobWorkerId: inForm.jobWorkerId,
        jobWorkerName: jobWorker?.name || "N/A",
        jobWorkCharges: inForm.jobWorkCharges,
        jobWorkAccount: inForm.jobWorkAccount,
        finishedGoods: inForm.finishedGoods,
        scrapMaterials: inForm.scrapMaterials,
        netJobWorkCost,
        status: "Completed",
        branchId: readActiveBranchId() || undefined,
        createdAt: new Date().toISOString(),
      };

      await db.jobWorkOrders.put(receiptData);

      // Update the original order status
      await db.jobWorkOrders.update(inForm.againstOrderId, {
        status: "Completed",
        completedAt: new Date().toISOString(),
      });

      toast.success("Job Work In receipt saved successfully");

      // Refresh orders
      const updated = await db.jobWorkOrders.toArray();
      setJobWorkOrders(updated);

      // Reset form
      setInForm({
        date: new Date().toISOString().split("T")[0],
        againstOrderId: "",
        jobWorkerId: "",
        jobWorkCharges: 0,
        jobWorkAccount: "",
        finishedGoods: [],
        scrapMaterials: [],
      });
    } catch (error) {
      console.error("Error saving job work receipt:", error);
      toast.error("Failed to save job work receipt");
    }
  };

  // Handle editing an order
  const handleEditOrder = (order) => {
    if (order.type === "out") {
      setOutForm({
        date: order.date,
        jobWorkerId: order.jobWorkerId,
        expectedReturnDate: order.expectedReturnDate,
        description: order.description,
        materials: order.materials || [],
        deliveryChallanNo: order.deliveryChallanNo,
        status: order.status,
        notes: order.notes,
      });
      setEditingOrder(order);
      setActiveTab("out");
    }
  };

  // Handle deleting an order
  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm("Are you sure you want to delete this job work order?")) return;

    try {
      const db = getDB();
      await db.jobWorkOrders.delete(orderId);
      toast.success("Job work order deleted successfully");

      // Refresh orders
      const updated = await db.jobWorkOrders.toArray();
      setJobWorkOrders(updated);
    } catch (error) {
      console.error("Error deleting job work order:", error);
      toast.error("Failed to delete job work order");
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      jobWorkOrders.map((order) => ({
        "Order No": order.orderNo,
        Date: order.date,
        "Job Worker": order.jobWorkerName,
        "Materials Sent": order.materials?.length || 0,
        Status: order.status,
        "Expected Return": order.expectedReturnDate,
        "Job Work Cost": order.jobWorkCharges || 0,
        "Scrap Recovered": order.scrapMaterials?.reduce((sum, line) => sum + line.amount, 0) || 0,
      })),
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Job work");
    XLSX.writeFile(wb, "Job_Work_Register.xlsx");
  };

  // Render Job Work Out tab
  const renderJobWorkOut = () => (
    <div style={{ padding: "20px" }}>
      <div
        style={{
          backgroundColor: BG_CARD,
          padding: "20px",
          borderRadius: "8px",
          border: BORDER,
          marginBottom: "20px",
        }}
      >
        <h2
          style={{ fontSize: "18px", fontWeight: "bold", color: "var(--ds-text-default)", marginBottom: "15px" }}
        >
          {editingOrder ? "Edit Job Work Out Order" : "New Job Work Out Order"}
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "15px",
            marginBottom: "15px",
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
              Order No
            </label>
            <input
              type="text"
              value={editingOrder?.orderNo || `JWO-${new Date().toISOString().split("T")[0]}-TEMP`}
              disabled
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
                backgroundColor: "#f0f0f0",
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
              Date
            </label>
            <input
              type="date"
              value={outForm.date}
              onChange={(e) => setOutForm({ ...outForm, date: e.target.value })}
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
              Job Worker
            </label>
            <select
              value={outForm.jobWorkerId}
              onChange={(e) => setOutForm({ ...outForm, jobWorkerId: e.target.value })}
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              <option value="">Select Job Worker</option>
              {jobWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
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
              Expected Return Date
            </label>
            <input
              type="date"
              value={outForm.expectedReturnDate}
              onChange={(e) => setOutForm({ ...outForm, expectedReturnDate: e.target.value })}
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
              Description of Work
            </label>
            <textarea
              value={outForm.description}
              onChange={(e) => setOutForm({ ...outForm, description: e.target.value })}
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

        <h3
          style={{ fontSize: "14px", fontWeight: "bold", color: "var(--ds-text-default)", marginBottom: "10px" }}
        >
          Materials Sent
        </h3>
        <div style={{ overflowX: "auto", marginBottom: "15px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
            <thead>
              <tr style={{ backgroundColor: BG_HEADER }}>
                <th style={{ border: BORDER, padding: "6px" }}>Item</th>
                <th style={{ border: BORDER, padding: "6px" }}>Qty Sent</th>
                <th style={{ border: BORDER, padding: "6px" }}>Unit</th>
                <th style={{ border: BORDER, padding: "6px" }}>Rate</th>
                <th style={{ border: BORDER, padding: "6px" }}>Amount</th>
                <th style={{ border: BORDER, padding: "6px" }}>Notes</th>
                <th style={{ border: BORDER, padding: "6px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {outForm.materials.map((line, index) => (
                <tr key={index}>
                  <td style={{ border: BORDER, padding: "4px" }}>
                    <select
                      value={line.itemId}
                      onChange={(e) => updateMaterialLine(index, "itemId", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "4px",
                        border: BORDER,
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}
                    >
                      <option value="">Select Item</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ border: BORDER, padding: "4px" }}>
                    <input
                      type="number"
                      value={line.qty}
                      onChange={(e) =>
                        updateMaterialLine(index, "qty", parseFloat(e.target.value) || 0)
                      }
                      style={{
                        width: "100%",
                        padding: "4px",
                        border: BORDER,
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}
                    />
                  </td>
                  <td style={{ border: BORDER, padding: "4px" }}>
                    <input
                      type="text"
                      value={line.unit}
                      onChange={(e) => updateMaterialLine(index, "unit", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "4px",
                        border: BORDER,
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}
                    />
                  </td>
                  <td style={{ border: BORDER, padding: "4px" }}>
                    <input
                      type="number"
                      value={line.rate}
                      onChange={(e) =>
                        updateMaterialLine(index, "rate", parseFloat(e.target.value) || 0)
                      }
                      style={{
                        width: "100%",
                        padding: "4px",
                        border: BORDER,
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}
                    />
                  </td>
                  <td style={{ border: BORDER, padding: "4px", textAlign: "right" }}>
                    {money(line.amount)}
                  </td>
                  <td style={{ border: BORDER, padding: "4px" }}>
                    <input
                      type="text"
                      value={line.notes}
                      onChange={(e) => updateMaterialLine(index, "notes", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "4px",
                        border: BORDER,
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}
                    />
                  </td>
                  <td style={{ border: BORDER, padding: "4px", textAlign: "center" }}>
                    <button
                      onClick={() => removeMaterialLine(index)}
                      style={{
                        backgroundColor: "#dc2626",
                        color: "white",
                        border: BORDER,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "10px",
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={addMaterialLine}
          style={{
            backgroundColor: "var(--ds-action-primary)",
            color: "white",
            border: BORDER,
            padding: "4px 10px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            marginBottom: "10px",
          }}
        >
          <Plus size={12} />
          Add Material Line
        </button>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "15px",
            marginBottom: "15px",
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
              Total Material Value
            </label>
            <input
              type="text"
              value={money(outForm.materials.reduce((sum, line) => sum + line.amount, 0))}
              disabled
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
                backgroundColor: "#f0f0f0",
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
              Status
            </label>
            <select
              value={outForm.status}
              onChange={(e) => setOutForm({ ...outForm, status: e.target.value })}
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="In-Process">In-Process</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
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
              Delivery Challan No
            </label>
            <input
              type="text"
              value={outForm.deliveryChallanNo}
              onChange={(e) => setOutForm({ ...outForm, deliveryChallanNo: e.target.value })}
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

        <div style={{ marginBottom: "15px" }}>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            Internal Notes
          </label>
          <textarea
            value={outForm.notes}
            onChange={(e) => setOutForm({ ...outForm, notes: e.target.value })}
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

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleSaveOutOrder}
            style={{
              backgroundColor: "var(--ds-action-primary)",
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
            <FileText size={14} />
            Save Order
          </button>
          <button
            onClick={() => {}}
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
            <Printer size={14} />
            Print Delivery Challan
          </button>
        </div>
      </div>

      {/* Existing Orders List */}
      <div
        style={{ backgroundColor: BG_CARD, padding: "20px", borderRadius: "8px", border: BORDER }}
      >
        <h2
          style={{ fontSize: "18px", fontWeight: "bold", color: "var(--ds-text-default)", marginBottom: "15px" }}
        >
          Existing Orders
        </h2>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
            <thead>
              <tr style={{ backgroundColor: BG_HEADER }}>
                <th style={{ border: BORDER, padding: "8px" }}>Order No</th>
                <th style={{ border: BORDER, padding: "8px" }}>Date</th>
                <th style={{ border: BORDER, padding: "8px" }}>Job Worker</th>
                <th style={{ border: BORDER, padding: "8px" }}>Materials</th>
                <th style={{ border: BORDER, padding: "8px" }}>Status</th>
                <th style={{ border: BORDER, padding: "8px" }}>Expected Return</th>
                <th style={{ border: BORDER, padding: "8px" }}>Days Pending</th>
                <th style={{ border: BORDER, padding: "8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobWorkOrders
                .filter((o) => o.type === "out")
                .map((order) => {
                  const isOverdue =
                    order.expectedReturnDate &&
                    new Date(order.expectedReturnDate) < new Date() &&
                    order.status !== "Completed";
                  const daysPending = order.expectedReturnDate
                    ? Math.ceil(
                        (new Date(order.expectedReturnDate) - new Date()) / (1000 * 60 * 60 * 24),
                      )
                    : 0;

                  return (
                    <tr
                      key={order.id}
                      style={{
                        backgroundColor: isOverdue
                          ? OVERDUE_BG
                          : order.status === "Completed"
                            ? COMPLETE_BG
                            : PENDING_BG,
                      }}
                    >
                      <td style={{ border: BORDER, padding: "8px" }}>{order.orderNo}</td>
                      <td style={{ border: BORDER, padding: "8px" }}>{order.date}</td>
                      <td style={{ border: BORDER, padding: "8px" }}>{order.jobWorkerName}</td>
                      <td style={{ border: BORDER, padding: "8px" }}>
                        {order.materials?.length || 0}
                      </td>
                      <td style={{ border: BORDER, padding: "8px" }}>
                        <span
                          style={{
                            backgroundColor:
                              order.status === "Completed"
                                ? "#059669"
                                : order.status === "Cancelled"
                                  ? "#6b7280"
                                  : isOverdue
                                    ? "#dc2626"
                                    : "#d97706",
                            color: "white",
                            padding: "2px 6px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: "bold",
                          }}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td style={{ border: BORDER, padding: "8px" }}>{order.expectedReturnDate}</td>
                      <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                        {daysPending}
                      </td>
                      <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                        <button
                          onClick={() => handleEditOrder(order)}
                          style={{
                            backgroundColor: "var(--ds-action-primary)",
                            color: "white",
                            border: BORDER,
                            padding: "4px 8px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "11px",
                            marginRight: "5px",
                          }}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => setActiveTab("in")}
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
                          <ArrowLeft size={12} />
                        </button>
                        <button
                          onClick={() => {}}
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
                          <Printer size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteOrder(order.id)}
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
    </div>
  );

  // Render Job Work In tab
  const renderJobWorkIn = () => (
    <div style={{ padding: "20px" }}>
      <div
        style={{
          backgroundColor: BG_CARD,
          padding: "20px",
          borderRadius: "8px",
          border: BORDER,
          marginBottom: "20px",
        }}
      >
        <h2
          style={{ fontSize: "18px", fontWeight: "bold", color: "var(--ds-text-default)", marginBottom: "15px" }}
        >
          Job Work In Receipt
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "15px",
            marginBottom: "15px",
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
              Receipt No
            </label>
            <input
              type="text"
              value={`JWI-${new Date().toISOString().split("T")[0]}-TEMP`}
              disabled
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
                backgroundColor: "#f0f0f0",
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
              Date
            </label>
            <input
              type="date"
              value={inForm.date}
              onChange={(e) => setInForm({ ...inForm, date: e.target.value })}
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
              Against Job Work Order
            </label>
            <select
              value={inForm.againstOrderId}
              onChange={(e) => {
                setInForm({ ...inForm, againstOrderId: e.target.value });
                // Pre-fill job worker if order is selected
                const order = jobWorkOrders.find((o) => o.id === e.target.value);
                if (order) {
                  setInForm((prev) => ({ ...prev, jobWorkerId: order.jobWorkerId }));
                }
              }}
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              <option value="">Select Order</option>
              {jobWorkOrders
                .filter((o) => o.type === "out" && o.status !== "Completed")
                .map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNo} - {order.jobWorkerName}
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
              Job Worker
            </label>
            <select
              value={inForm.jobWorkerId}
              onChange={(e) => setInForm({ ...inForm, jobWorkerId: e.target.value })}
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
              }}
              disabled={!inForm.againstOrderId}
            >
              <option value="">Select Job Worker</option>
              {jobWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
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
              Job Work Charges
            </label>
            <input
              type="number"
              value={inForm.jobWorkCharges}
              onChange={(e) =>
                setInForm({ ...inForm, jobWorkCharges: parseFloat(e.target.value) || 0 })
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
              Job Work Account
            </label>
            <select
              value={inForm.jobWorkAccount}
              onChange={(e) => setInForm({ ...inForm, jobWorkAccount: e.target.value })}
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              <option value="">Select Account</option>
              {accounts
                .filter((acc) => acc.type === "expense")
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <h3
          style={{ fontSize: "14px", fontWeight: "bold", color: "var(--ds-text-default)", marginBottom: "10px" }}
        >
          Finished Goods Received
        </h3>
        <div style={{ overflowX: "auto", marginBottom: "15px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
            <thead>
              <tr style={{ backgroundColor: BG_HEADER }}>
                <th style={{ border: BORDER, padding: "6px" }}>Item Received</th>
                <th style={{ border: BORDER, padding: "6px" }}>Qty</th>
                <th style={{ border: BORDER, padding: "6px" }}>Unit</th>
                <th style={{ border: BORDER, padding: "6px" }}>Rate</th>
                <th style={{ border: BORDER, padding: "6px" }}>Amount</th>
                <th style={{ border: BORDER, padding: "6px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inForm.finishedGoods.map((line, index) => (
                <tr key={index}>
                  <td style={{ border: BORDER, padding: "4px" }}>
                    <select
                      value={line.itemId}
                      onChange={(e) => updateFinishedGoodLine(index, "itemId", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "4px",
                        border: BORDER,
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}
                    >
                      <option value="">Select Item</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ border: BORDER, padding: "4px" }}>
                    <input
                      type="number"
                      value={line.qty}
                      onChange={(e) =>
                        updateFinishedGoodLine(index, "qty", parseFloat(e.target.value) || 0)
                      }
                      style={{
                        width: "100%",
                        padding: "4px",
                        border: BORDER,
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}
                    />
                  </td>
                  <td style={{ border: BORDER, padding: "4px" }}>
                    <input
                      type="text"
                      value={line.unit}
                      onChange={(e) => updateFinishedGoodLine(index, "unit", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "4px",
                        border: BORDER,
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}
                    />
                  </td>
                  <td style={{ border: BORDER, padding: "4px" }}>
                    <input
                      type="number"
                      value={line.rate}
                      onChange={(e) =>
                        updateFinishedGoodLine(index, "rate", parseFloat(e.target.value) || 0)
                      }
                      style={{
                        width: "100%",
                        padding: "4px",
                        border: BORDER,
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}
                    />
                  </td>
                  <td style={{ border: BORDER, padding: "4px", textAlign: "right" }}>
                    {money(line.amount)}
                  </td>
                  <td style={{ border: BORDER, padding: "4px", textAlign: "center" }}>
                    <button
                      onClick={() =>
                        setInForm((prev) => ({
                          ...prev,
                          finishedGoods: prev.finishedGoods.filter((_, i) => i !== index),
                        }))
                      }
                      style={{
                        backgroundColor: "#dc2626",
                        color: "white",
                        border: BORDER,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "10px",
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={addFinishedGoodLine}
          style={{
            backgroundColor: "var(--ds-action-primary)",
            color: "white",
            border: BORDER,
            padding: "4px 10px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            marginBottom: "10px",
          }}
        >
          <Plus size={12} />
          Add Finished Good
        </button>

        <h3
          style={{ fontSize: "14px", fontWeight: "bold", color: "var(--ds-text-default)", marginBottom: "10px" }}
        >
          Scrap Materials
        </h3>
        <div style={{ overflowX: "auto", marginBottom: "15px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
            <thead>
              <tr style={{ backgroundColor: BG_HEADER }}>
                <th style={{ border: BORDER, padding: "6px" }}>Scrap Item</th>
                <th style={{ border: BORDER, padding: "6px" }}>Scrap Qty</th>
                <th style={{ border: BORDER, padding: "6px" }}>Unit</th>
                <th style={{ border: BORDER, padding: "6px" }}>Scrap Rate</th>
                <th style={{ border: BORDER, padding: "6px" }}>Scrap Amount</th>
                <th style={{ border: BORDER, padding: "6px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inForm.scrapMaterials.map((line, index) => (
                <tr key={index}>
                  <td style={{ border: BORDER, padding: "4px" }}>
                    <select
                      value={line.itemId}
                      onChange={(e) => updateScrapLine(index, "itemId", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "4px",
                        border: BORDER,
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}
                    >
                      <option value="">Select Item</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ border: BORDER, padding: "4px" }}>
                    <input
                      type="number"
                      value={line.qty}
                      onChange={(e) =>
                        updateScrapLine(index, "qty", parseFloat(e.target.value) || 0)
                      }
                      style={{
                        width: "100%",
                        padding: "4px",
                        border: BORDER,
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}
                    />
                  </td>
                  <td style={{ border: BORDER, padding: "4px" }}>
                    <input
                      type="text"
                      value={line.unit}
                      onChange={(e) => updateScrapLine(index, "unit", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "4px",
                        border: BORDER,
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}
                    />
                  </td>
                  <td style={{ border: BORDER, padding: "4px" }}>
                    <input
                      type="number"
                      value={line.rate}
                      onChange={(e) =>
                        updateScrapLine(index, "rate", parseFloat(e.target.value) || 0)
                      }
                      style={{
                        width: "100%",
                        padding: "4px",
                        border: BORDER,
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}
                    />
                  </td>
                  <td style={{ border: BORDER, padding: "4px", textAlign: "right" }}>
                    {money(line.amount)}
                  </td>
                  <td style={{ border: BORDER, padding: "4px", textAlign: "center" }}>
                    <button
                      onClick={() =>
                        setInForm((prev) => ({
                          ...prev,
                          scrapMaterials: prev.scrapMaterials.filter((_, i) => i !== index),
                        }))
                      }
                      style={{
                        backgroundColor: "#dc2626",
                        color: "white",
                        border: BORDER,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "10px",
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={addScrapLine}
          style={{
            backgroundColor: "var(--ds-action-primary)",
            color: "white",
            border: BORDER,
            padding: "4px 10px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            marginBottom: "15px",
          }}
        >
          <Plus size={12} />
          Add Scrap Material
        </button>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "15px",
            marginBottom: "15px",
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
              Job Work Charges
            </label>
            <input
              type="text"
              value={money(inForm.jobWorkCharges)}
              disabled
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
                backgroundColor: "#f0f0f0",
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
              Scrap Amount
            </label>
            <input
              type="text"
              value={money(inForm.scrapMaterials.reduce((sum, line) => sum + line.amount, 0))}
              disabled
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
                backgroundColor: "#f0f0f0",
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
              Net Job Work Cost
            </label>
            <input
              type="text"
              value={money(
                inForm.jobWorkCharges -
                  inForm.scrapMaterials.reduce((sum, line) => sum + line.amount, 0),
              )}
              disabled
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
                backgroundColor: "#f0f0f0",
              }}
            />
          </div>
        </div>

        <button
          onClick={handleSaveInReceipt}
          style={{
            backgroundColor: "var(--ds-action-primary)",
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
          <FileText size={14} />
          Save Receipt
        </button>
      </div>
    </div>
  );

  // Render Job work tab
  const renderJobWorkRegister = () => (
    <div style={{ padding: "20px" }}>
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
            backgroundColor: BG_HEADER,
            padding: "15px",
            borderRadius: "6px",
            border: BORDER,
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--ds-text-default)", marginBottom: "5px" }}>Open Orders</div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--ds-text-default)" }}>
            {summaryCounts.openOrders}
          </div>
        </div>
        <div
          style={{
            backgroundColor: OVERDUE_BG,
            padding: "15px",
            borderRadius: "6px",
            border: BORDER,
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--ds-text-default)", marginBottom: "5px" }}>
            Overdue Orders
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#dc2626" }}>
            {summaryCounts.overdueOrders}
          </div>
        </div>
        <div
          style={{
            backgroundColor: COMPLETE_BG,
            padding: "15px",
            borderRadius: "6px",
            border: BORDER,
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--ds-text-default)", marginBottom: "5px" }}>
            Completed This Month
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--ds-text-default)" }}>
            {summaryCounts.completedThisMonth}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "15px",
          marginBottom: "20px",
          flexWrap: "wrap",
          alignItems: "end",
        }}
      >
        {branchOptions.length > 0 && (
          <div>
            <label
              style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
            >
              Branch
            </label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
              aria-label="Branch"
            >
              <option value="all">All branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.code || b.id}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            From Date
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
          />
        </div>
        <div>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            To Date
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
          />
        </div>
        <div>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            Job Worker
          </label>
          <select
            value={filterJobWorker}
            onChange={(e) => setFilterJobWorker(e.target.value)}
            style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
          >
            <option value="ALL">All Workers</option>
            {jobWorkers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
          >
            <option value="ALL">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="In-Process">In-Process</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
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
      </div>

      <div
        style={{ backgroundColor: BG_CARD, padding: "20px", borderRadius: "8px", border: BORDER }}
      >
        <h2
          style={{ fontSize: "18px", fontWeight: "bold", color: "var(--ds-text-default)", marginBottom: "15px" }}
        >
          Job work
        </h2>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
            <thead>
              <tr style={{ backgroundColor: BG_HEADER }}>
                <th style={{ border: BORDER, padding: "8px" }}>Order No</th>
                <th style={{ border: BORDER, padding: "8px" }}>Job Worker</th>
                <th style={{ border: BORDER, padding: "8px" }}>Materials Sent</th>
                <th style={{ border: BORDER, padding: "8px" }}>Date Sent</th>
                <th style={{ border: BORDER, padding: "8px" }}>Expected Return</th>
                <th style={{ border: BORDER, padding: "8px" }}>Finished Goods</th>
                <th style={{ border: BORDER, padding: "8px" }}>Status</th>
                <th style={{ border: BORDER, padding: "8px" }}>Pending Days</th>
                <th style={{ border: BORDER, padding: "8px" }}>Job Work Cost</th>
                <th style={{ border: BORDER, padding: "8px" }}>Scrap Recovered</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const isOverdue =
                  order.expectedReturnDate &&
                  new Date(order.expectedReturnDate) < new Date() &&
                  order.status !== "Completed";
                const pendingDays = order.expectedReturnDate
                  ? Math.ceil(
                      (new Date(order.expectedReturnDate) - new Date()) / (1000 * 60 * 60 * 24),
                    )
                  : 0;

                return (
                  <tr
                    key={order.id}
                    style={{
                      backgroundColor: isOverdue
                        ? OVERDUE_BG
                        : order.status === "Completed"
                          ? COMPLETE_BG
                          : PENDING_BG,
                    }}
                  >
                    <td style={{ border: BORDER, padding: "8px" }}>{order.orderNo}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>{order.jobWorkerName}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>
                      {order.materials?.length || 0}
                    </td>
                    <td style={{ border: BORDER, padding: "8px" }}>{order.date}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>{order.expectedReturnDate}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>
                      {order.finishedGoods?.length || 0}
                    </td>
                    <td style={{ border: BORDER, padding: "8px" }}>
                      <span
                        style={{
                          backgroundColor:
                            order.status === "Completed"
                              ? "#059669"
                              : order.status === "Cancelled"
                                ? "#6b7280"
                                : isOverdue
                                  ? "#dc2626"
                                  : "#d97706",
                          color: "white",
                          padding: "2px 6px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: "bold",
                        }}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                      {pendingDays}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(order.jobWorkCharges || 0)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(
                        order.scrapMaterials?.reduce((sum, line) => sum + line.amount, 0) || 0,
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Render Job Work Bill tab
  const renderJobWorkBill = () => (
    <div style={{ padding: "20px" }}>
      <div
        style={{ backgroundColor: BG_CARD, padding: "20px", borderRadius: "8px", border: BORDER }}
      >
        <h2
          style={{ fontSize: "18px", fontWeight: "bold", color: "var(--ds-text-default)", marginBottom: "15px" }}
        >
          Job Work Bill
        </h2>

        <div style={{ marginBottom: "15px" }}>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            Select Completed Job Work Order
          </label>
          <select
            value=""
            onChange={() => {}}
            style={{
              width: "100%",
              padding: "6px",
              border: BORDER,
              borderRadius: "4px",
              fontSize: "12px",
            }}
          >
            <option value="">Select Completed Order</option>
            {jobWorkOrders
              .filter((o) => o.type === "out" && o.status === "Completed")
              .map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderNo} - {order.jobWorkerName}
                </option>
              ))}
          </select>
        </div>

        <div style={{ border: BORDER, padding: "20px", marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
            <div>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: "var(--ds-text-default)",
                  marginBottom: "5px",
                }}
              >
                {companySettings?.name || "Your Company"}
              </h3>
              <div style={{ fontSize: "12px", color: "var(--ds-text-default)" }}>
                {companySettings?.address || "Your Address"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--ds-text-default)" }}>
                PAN: {companySettings?.panNumber || "PAN"}
              </div>
            </div>
            <div>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: "var(--ds-text-default)",
                  marginBottom: "5px",
                }}
              >
                Job Worker
              </h3>
              <div style={{ fontSize: "12px", color: "var(--ds-text-default)" }}>Company Name</div>
              <div style={{ fontSize: "12px", color: "var(--ds-text-default)" }}>Address</div>
              <div style={{ fontSize: "12px", color: "var(--ds-text-default)" }}>PAN: XXXXXXXX</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
            <div>
              <div style={{ fontSize: "12px", color: "var(--ds-text-default)" }}>
                <strong>Job Order Reference:</strong> JWO-XXXX
              </div>
              <div style={{ fontSize: "12px", color: "var(--ds-text-default)" }}>
                <strong>Date:</strong> {new Date().toISOString().split("T")[0]}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--ds-text-default)" }}>
                <strong>Bill No:</strong> JWB-XXXX
              </div>
              <div style={{ fontSize: "12px", color: "var(--ds-text-default)" }}>
                <strong>Bill Date:</strong> {new Date().toISOString().split("T")[0]}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <h4
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                color: "var(--ds-text-default)",
                marginBottom: "10px",
              }}
            >
              Materials Supplied
            </h4>
            <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
              <thead>
                <tr style={{ backgroundColor: BG_HEADER }}>
                  <th style={{ border: BORDER, padding: "6px" }}>Item</th>
                  <th style={{ border: BORDER, padding: "6px" }}>Quantity</th>
                  <th style={{ border: BORDER, padding: "6px" }}>Rate</th>
                  <th style={{ border: BORDER, padding: "6px" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: BORDER, padding: "6px" }}>Item 1</td>
                  <td style={{ border: BORDER, padding: "6px" }}>100</td>
                  <td style={{ border: BORDER, padding: "6px" }}>100.00</td>
                  <td style={{ border: BORDER, padding: "6px", textAlign: "right" }}>10,000.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <h4
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                color: "var(--ds-text-default)",
                marginBottom: "10px",
              }}
            >
              Finished Goods Returned
            </h4>
            <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
              <thead>
                <tr style={{ backgroundColor: BG_HEADER }}>
                  <th style={{ border: BORDER, padding: "6px" }}>Item</th>
                  <th style={{ border: BORDER, padding: "6px" }}>Quantity</th>
                  <th style={{ border: BORDER, padding: "6px" }}>Rate</th>
                  <th style={{ border: BORDER, padding: "6px" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: BORDER, padding: "6px" }}>Finished Item 1</td>
                  <td style={{ border: BORDER, padding: "6px" }}>95</td>
                  <td style={{ border: BORDER, padding: "6px" }}>120.00</td>
                  <td style={{ border: BORDER, padding: "6px", textAlign: "right" }}>11,400.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <h4
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                color: "var(--ds-text-default)",
                marginBottom: "10px",
              }}
            >
              Scrap Recovered
            </h4>
            <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
              <thead>
                <tr style={{ backgroundColor: BG_HEADER }}>
                  <th style={{ border: BORDER, padding: "6px" }}>Item</th>
                  <th style={{ border: BORDER, padding: "6px" }}>Quantity</th>
                  <th style={{ border: BORDER, padding: "6px" }}>Rate</th>
                  <th style={{ border: BORDER, padding: "6px" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: BORDER, padding: "6px" }}>Scrap Item 1</td>
                  <td style={{ border: BORDER, padding: "6px" }}>5</td>
                  <td style={{ border: BORDER, padding: "6px" }}>50.00</td>
                  <td style={{ border: BORDER, padding: "6px", textAlign: "right" }}>250.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <h4
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                color: "var(--ds-text-default)",
                marginBottom: "10px",
              }}
            >
              Services Rendered
            </h4>
            <div style={{ fontSize: "12px", color: "var(--ds-text-default)", marginBottom: "10px" }}>
              Manufacturing and processing of raw materials into finished goods as per
              specifications provided.
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
            <div style={{ width: "300px" }}>
              <div
                style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}
              >
                <span>Job Work Charges:</span>
                <span>Rs. 1,500.00</span>
              </div>
              <div
                style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}
              >
                <span>Less: Scrap Value:</span>
                <span>(Rs. 250.00)</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "5px",
                  borderTop: BORDER,
                  paddingTop: "5px",
                }}
              >
                <span>
                  <strong>Net Payable:</strong>
                </span>
                <span>
                  <strong>Rs. 1,250.00</strong>
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px" }}>
            <div>
              <div style={{ marginBottom: "40px", borderBottom: "1px solid #000" }}>&nbsp;</div>
              <div>Receiver's Signature</div>
            </div>
            <div>
              <div style={{ marginBottom: "40px", borderBottom: "1px solid #000" }}>&nbsp;</div>
              <div>Authorized Signatory</div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
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
              display: "flex",
              alignItems: "center",
              gap: "5px",
              margin: "0 auto",
            }}
          >
            <Printer size={14} />
            Print Job Work Bill
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: BG, minHeight: "100vh" }}>
      <h1
        style={{
          fontSize: "24px",
          fontWeight: "bold",
          color: "var(--ds-text-default)",
          padding: "20px",
          marginBottom: "0",
        }}
      >
        Job work
      </h1>

      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          gap: "5px",
          padding: "0 20px",
          marginBottom: "20px",
          borderBottom: BORDER,
        }}
      >
        {[
          { id: "out", label: "Job Work Out", icon: ArrowRight },
          { id: "in", label: "Job Work In", icon: ArrowLeft },
          { id: "register", label: "Job work", icon: FileText },
          { id: "bill", label: "Job Work Bill", icon: Factory },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
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
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "out" && renderJobWorkOut()}
      {activeTab === "in" && renderJobWorkIn()}
      {activeTab === "register" && renderJobWorkRegister()}
      {activeTab === "bill" && renderJobWorkBill()}
    </div>
  );
}
