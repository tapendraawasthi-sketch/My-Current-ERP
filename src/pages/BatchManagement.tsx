import React, { useEffect, useMemo, useState } from "react";
import {
  Package,
  AlertTriangle,
  Clock,
  PlusCircle,
  Edit2,
  Trash2,
  Search,
  Filter,
  Download,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import {
  loadBatches,
  saveBatch,
  getNearExpiryBatches,
  getExpiredBatches,
  getBatchValueReport,
  createBatchFromPurchase,
  type BatchRecord,
  type BatchWithStatus,
} from "@/lib/batchManager";

type TabKey = "all" | "near_expiry" | "expired" | "value_report";

const emptyNewBatch = {
  itemId: "",
  itemName: "",
  batchNo: "",
  mfgDate: "",
  expiryDate: "",
  mrp: 0,
  purchaseRate: 0,
  saleRate: 0,
  openingQty: 0,
  unit: "Pcs",
  warehouseId: "",
  warehouseName: "",
  supplierId: "",
  supplierName: "",
  purchaseInvoiceNo: "",
  purchaseDate: new Date().toISOString().split("T")[0],
};

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function money(n: number): string {
  return Number(n || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function withComputedStatus(batch: BatchRecord): BatchWithStatus {
  const daysToExpiry = Math.floor(
    (new Date(batch.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  const status =
    batch.currentQty <= 0
      ? "out_of_stock"
      : daysToExpiry < 0
        ? "expired"
        : daysToExpiry <= 30
          ? "near_expiry"
          : "ok";

  return { ...batch, status, daysToExpiry };
}

function getBatchStatusBadge(status: BatchWithStatus["status"]) {
  const cls =
    status === "ok"
      ? "bg-green-100 text-green-700"
      : status === "near_expiry"
        ? "bg-amber-100 text-amber-700"
        : status === "expired"
          ? "bg-red-100 text-red-700"
          : "bg-gray-100 text-gray-600";

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function daysDisplay(days: number) {
  if (days < 0) {
    return <span className="text-red-700 font-semibold">Expired ({Math.abs(days)} days ago)</span>;
  }
  if (days <= 7) {
    return <span className="text-red-700 font-bold">Expires in {days} days</span>;
  }
  if (days <= 30) {
    return <span className="text-amber-700">Expires in {days} days</span>;
  }
  return <span className="text-green-700">{days} days</span>;
}

export default function BatchManagement() {
  const store = useStore() as any;
  const companyId = store.currentCompany?.id ?? "default";

  const [batches, setBatches] = useState<BatchWithStatus[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [searchText, setSearchText] = useState("");
  const [filterItem, setFilterItem] = useState("ALL");
  const [filterWarehouse, setFilterWarehouse] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<BatchRecord | null>(null);
  const [newBatch, setNewBatch] = useState({ ...emptyNewBatch });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const reload = () => {
    setBatches(loadBatches(companyId).map(withComputedStatus));
  };

  useEffect(() => {
    reload();
  }, [companyId]);

  const nearExpiry = useMemo(() => getNearExpiryBatches(companyId), [companyId, batches]);
  const expired = useMemo(() => getExpiredBatches(companyId), [companyId, batches]);
  const valueReport = useMemo(() => getBatchValueReport(companyId), [companyId, batches]);

  const uniqueItems = useMemo(
    () => Array.from(new Set(batches.map((b) => b.itemName).filter(Boolean))).sort(),
    [batches],
  );

  const uniqueWarehouses = useMemo(
    () => Array.from(new Set(batches.map((b) => b.warehouseName).filter(Boolean))).sort(),
    [batches],
  );

  const filteredBatches = useMemo(() => {
    const base =
      activeTab === "near_expiry" ? nearExpiry : activeTab === "expired" ? expired : batches;

    const q = searchText.trim().toLowerCase();

    return base.filter((b) => {
      if (q && !b.batchNo.toLowerCase().includes(q) && !b.itemName.toLowerCase().includes(q)) {
        return false;
      }
      if (filterItem !== "ALL" && b.itemName !== filterItem) return false;
      if (filterWarehouse !== "ALL" && b.warehouseName !== filterWarehouse) return false;
      return true;
    });
  }, [activeTab, batches, nearExpiry, expired, searchText, filterItem, filterWarehouse]);

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!newBatch.batchNo.trim()) errors.batchNo = "Batch No is required";
    if (!newBatch.itemName.trim()) errors.itemName = "Item Name is required";
    if (!newBatch.expiryDate) errors.expiryDate = "Expiry Date is required";
    if (!(Number(newBatch.openingQty) > 0)) errors.openingQty = "Opening Qty must be greater than zero";
    if (Number(newBatch.purchaseRate) < 0) errors.purchaseRate = "Purchase Rate cannot be negative";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveBatch = () => {
    if (!validate()) return;

    if (editingBatch) {
      const updated: BatchRecord = {
        ...editingBatch,
        itemId: newBatch.itemId,
        itemName: newBatch.itemName,
        batchNo: newBatch.batchNo,
        mfgDate: newBatch.mfgDate,
        expiryDate: newBatch.expiryDate,
        mrp: Number(newBatch.mrp || 0),
        purchaseRate: Number(newBatch.purchaseRate || 0),
        saleRate: Number(newBatch.saleRate || 0),
        openingQty: Number(newBatch.openingQty || 0),
        currentQty: Number(editingBatch.currentQty || 0),
        warehouseId: newBatch.warehouseId,
        warehouseName: newBatch.warehouseName,
        supplierId: newBatch.supplierId,
        supplierName: newBatch.supplierName,
        purchaseInvoiceNo: newBatch.purchaseInvoiceNo,
        purchaseDate: newBatch.purchaseDate,
      };
      saveBatch(updated);
    } else {
      createBatchFromPurchase({
        itemId: newBatch.itemId || newBatch.itemName,
        itemName: newBatch.itemName,
        batchNo: newBatch.batchNo,
        mfgDate: newBatch.mfgDate,
        expiryDate: newBatch.expiryDate,
        mrp: Number(newBatch.mrp || 0),
        purchaseRate: Number(newBatch.purchaseRate || 0),
        saleRate: Number(newBatch.saleRate || 0),
        openingQty: Number(newBatch.openingQty || 0),
        warehouseId: newBatch.warehouseId || newBatch.warehouseName,
        warehouseName: newBatch.warehouseName,
        supplierId: newBatch.supplierId || newBatch.supplierName,
        supplierName: newBatch.supplierName,
        purchaseInvoiceId: "",
        purchaseInvoiceNo: newBatch.purchaseInvoiceNo,
        purchaseDate: newBatch.purchaseDate,
        companyId,
      });
    }

    setShowAddModal(false);
    setEditingBatch(null);
    setNewBatch({ ...emptyNewBatch });
    setFormErrors({});
    reload();
  };

  const startEdit = (batch: BatchRecord) => {
    setEditingBatch(batch);
    setNewBatch({
      itemId: batch.itemId,
      itemName: batch.itemName,
      batchNo: batch.batchNo,
      mfgDate: batch.mfgDate,
      expiryDate: batch.expiryDate,
      mrp: batch.mrp,
      purchaseRate: batch.purchaseRate,
      saleRate: batch.saleRate,
      openingQty: batch.openingQty,
      unit: "Pcs",
      warehouseId: batch.warehouseId,
      warehouseName: batch.warehouseName,
      supplierId: batch.supplierId,
      supplierName: batch.supplierName,
      purchaseInvoiceNo: batch.purchaseInvoiceNo,
      purchaseDate: batch.purchaseDate,
    });
    setShowAddModal(true);
  };

  const deleteBatch = (batch: BatchRecord) => {
    if (!window.confirm(`Delete batch ${batch.batchNo}?`)) return;
    saveBatch({ ...batch, isActive: false, currentQty: 0 });
    reload();
  };

  const exportData = () => {
    const rows = filteredBatches.map((b) => ({
      "Batch No": b.batchNo,
      "Item Name": b.itemName,
      Warehouse: b.warehouseName,
      "Expiry Date": b.expiryDate,
      Qty: b.currentQty,
      MRP: b.mrp,
      Status: b.status,
    }));
    const csv = [Object.keys(rows[0] || {}).join(","), ...rows.map((r) => Object.values(r).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "batch_report.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const renderBatchTable = (extraNear = false, extraExpired = false) => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#f5f6fa] border-b border-gray-200">
            {[
              "Batch No",
              "Item Name",
              "Warehouse",
              "Mfg Date",
              "Expiry Date",
              "Days to Expiry",
              "Qty",
              "Purchase Rate",
              "MRP",
              "Supplier",
              "Status",
              extraNear ? "Return Arrangement" : extraExpired ? "Write Off" : "Actions",
            ].map((h) => (
              <th
                key={h}
                className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredBatches.length === 0 ? (
            <tr>
              <td colSpan={12} className="py-12 text-center text-[12px] text-gray-400">
                No batches found
              </td>
            </tr>
          ) : (
            filteredBatches.map((b) => (
              <tr
                key={b.id}
                className={`border-b border-gray-100 ${
                  b.status === "expired" ? "bg-red-50" : b.status === "near_expiry" ? "bg-amber-50" : ""
                }`}
              >
                <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">{b.batchNo}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700">{b.itemName}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700">{b.warehouseName || "—"}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700">{formatDate(b.mfgDate)}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700">{formatDate(b.expiryDate)}</td>
                <td className="px-3 py-2.5 text-[12px]">{daysDisplay(b.daysToExpiry)}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{b.currentQty}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{money(b.purchaseRate)}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{money(b.mrp)}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700">{b.supplierName || "—"}</td>
                <td className="px-3 py-2.5">{getBatchStatusBadge(b.status)}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700">
                  {extraNear ? (
                    <span className="text-[11px] text-gray-600">{b.supplierName || "Contact supplier"}</span>
                  ) : extraExpired ? (
                    <button
                      type="button"
                      onClick={() => {
                        saveBatch({ ...b, currentQty: 0, isActive: false });
                        reload();
                      }}
                      className="h-7 px-2 bg-red-600 text-white text-[11px] rounded"
                    >
                      Write Off
                    </button>
                  ) : (
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEdit(b)}
                        className="h-7 w-7 border border-gray-300 rounded bg-white text-[#1557b0]"
                      >
                        <Edit2 className="h-3.5 w-3.5 mx-auto" />
                      </button>
                      <button
                        onClick={() => deleteBatch(b)}
                        className="h-7 w-7 border border-red-200 rounded bg-white text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5 mx-auto" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Package className="h-4 w-4 text-[#1557b0]" />
            Batch & Expiry Management
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Track stock by batch, monitor expiry dates (FEFO), manage MRP
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingBatch(null);
              setNewBatch({ ...emptyNewBatch });
              setShowAddModal(true);
            }}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] rounded-md flex items-center gap-1.5"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Add Batch
          </button>
          <button
            onClick={exportData}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md hover:bg-gray-50 flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {expired.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 flex gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <p className="text-[12px] text-red-700">
            {expired.length} batches have expired and should be written off or returned
          </p>
        </div>
      )}

      {nearExpiry.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex gap-2">
          <Clock className="h-4 w-4 text-[#d97706]" />
          <p className="text-[12px] text-amber-800">
            {nearExpiry.length} batches expire within 30 days
          </p>
        </div>
      )}

      <div className="flex border-b border-gray-200 mb-4">
        {[
          ["all", "All Batches"],
          ["near_expiry", "Near Expiry"],
          ["expired", "Expired"],
          ["value_report", "Value Report"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as TabKey)}
            className={
              activeTab === key
                ? "px-4 py-2 border-b-2 border-[#1557b0] text-[#1557b0] text-[12px] font-medium"
                : "px-4 py-2 text-gray-500 text-[12px] hover:text-gray-700"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "all" && (
        <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4 flex flex-wrap gap-3">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search batch or item..."
              className="h-8 pl-8 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-56"
            />
          </div>

          <select
            value={filterItem}
            onChange={(e) => setFilterItem(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
          >
            <option value="ALL">All Items</option>
            {uniqueItems.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <select
            value={filterWarehouse}
            onChange={(e) => setFilterWarehouse(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
          >
            <option value="ALL">All Warehouses</option>
            {uniqueWarehouses.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      )}

      {activeTab === "value_report" ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                {["Item Name", "Total Batches", "Total Qty", "Total Value (NPR)", "Near Expiry Qty", "Expired Qty"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {valueReport.map((r) => (
                <tr key={r.itemId} className="border-b border-gray-100">
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">{r.itemName}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">{r.totalBatches}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">{r.totalQty}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{money(r.totalValue)}</td>
                  <td className="px-3 py-2.5 text-[12px] text-amber-700 text-right">{r.nearExpiryQty}</td>
                  <td className="px-3 py-2.5 text-[12px] text-red-700 text-right">{r.expiredQty}</td>
                </tr>
              ))}
              <tr className="bg-[#f5f6fa] font-semibold">
                <td className="px-3 py-2.5 text-[12px] text-gray-800">Total</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-800 text-right">
                  {valueReport.reduce((s, r) => s + r.totalBatches, 0)}
                </td>
                <td className="px-3 py-2.5 text-[12px] text-gray-800 text-right">
                  {valueReport.reduce((s, r) => s + r.totalQty, 0)}
                </td>
                <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">
                  {money(valueReport.reduce((s, r) => s + r.totalValue, 0))}
                </td>
                <td className="px-3 py-2.5 text-[12px] text-amber-700 text-right">
                  {valueReport.reduce((s, r) => s + r.nearExpiryQty, 0)}
                </td>
                <td className="px-3 py-2.5 text-[12px] text-red-700 text-right">
                  {valueReport.reduce((s, r) => s + r.expiredQty, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : activeTab === "near_expiry" ? (
        renderBatchTable(true, false)
      ) : activeTab === "expired" ? (
        renderBatchTable(false, true)
      ) : (
        renderBatchTable(false, false)
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-2xl shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-[14px] font-semibold text-gray-800">
                {editingBatch ? "Edit Batch" : "Add New Batch"}
              </h2>
            </div>

            <div className="p-4 grid grid-cols-2 gap-4">
              {[
                ["Item Name", "itemName", "text", true],
                ["Batch No", "batchNo", "text", true],
                ["Mfg Date", "mfgDate", "date", false],
                ["Expiry Date *", "expiryDate", "date", true],
                ["MRP", "mrp", "number", false],
                ["Purchase Rate", "purchaseRate", "number", true],
                ["Sale Rate", "saleRate", "number", false],
                ["Opening Qty", "openingQty", "number", true],
                ["Unit", "unit", "text", false],
                ["Warehouse", "warehouseName", "text", false],
                ["Supplier Name", "supplierName", "text", false],
                ["Purchase Invoice No", "purchaseInvoiceNo", "text", false],
                ["Purchase Date", "purchaseDate", "date", false],
              ].map(([label, key, type]) => (
                <div key={String(key)}>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>
                  <input
                    type={String(type)}
                    value={(newBatch as any)[key as string] ?? ""}
                    onChange={(e) => setNewBatch({ ...newBatch, [key as string]: type === "number" ? Number(e.target.value) : e.target.value })}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-full"
                  />
                  {formErrors[key as string] && (
                    <p className="text-[11px] text-red-600 mt-1">{formErrors[key as string]}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingBatch(null);
                  setNewBatch({ ...emptyNewBatch });
                }}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBatch}
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] rounded-md"
              >
                Save Batch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
