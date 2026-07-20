// src/pages/BatchManagement.tsx
// @ts-nocheck
// NEW PAGE — Batch & Serial Number Tracking
// Batch tracking: required for pharma, food, chemicals (expiry dates)
// Serial tracking: required for electronics, machinery (warranty, per-unit history)

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import * as XLSX from "xlsx";
import toast from "@/lib/appToast";
import {
  Plus,
  Download,
  X,
  AlertTriangle,
  Package,
  Hash,
  Search,
  Save,
} from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { stampMovementBranch } from "../lib/activeBranch";
import { getDB } from "../lib/db";
import { useAppRoute, useNavigateApp } from "../routing/useAppRoute";
import {
  Button,
  PageHeader,
  PageMeta,
  EnterpriseDataTable,
  type EnterpriseColumnDef,
} from "@/design-system";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const inputCls =
  "h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-white " +
  "focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full";
const labelCls = "text-[11px] font-medium text-gray-600 block mb-1";
const formLabelCls = "text-[11px] font-medium text-gray-600 mb-1 block";
const btnPrimary =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-[var(--ds-border-default)] text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";

// Days until expiry
const daysUntilExpiry = (expiryDate: string): number => {
  if (!expiryDate) return 9999;
  const diff = new Date(expiryDate).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const emptyBatch = () => ({
  itemId: "",
  itemName: "",
  batchNo: "",
  manufacturingDate: "",
  expiryDate: "",
  purchaseDate: new Date().toISOString().split("T")[0],
  purchaseRate: 0,
  openingQty: 0,
  currentQty: 0,
  warehouseId: "",
  supplierId: "",
  supplierBatchNo: "",
  isActive: true,
  notes: "",
});

const emptySN = () => ({
  itemId: "",
  itemName: "",
  serialNo: "",
  status: "available" as const,
  purchaseDate: new Date().toISOString().split("T")[0],
  purchaseRate: 0,
  warehouseId: "",
  warrantyExpiry: "",
  notes: "",
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function BatchManagement() {
  const store = useStore() as any;
  const items = store.items || [];
  const parties = store.parties || [];
  const warehouses = store.warehouses || [];
  const batches = store.batches || [];
  const serialNumbers = store.serialNumbers || [];
  const { branchFilter, matchMovement } = useBranchFilter();
  const route = useAppRoute();
  const { openEntity, clearEntity } = useNavigateApp();
  const pageId = "batch-management";

  const [activeTab, setActiveTab] = useState<"batch" | "serial">("batch");

  // Batch state
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchForm, setBatchForm] = useState(emptyBatch());
  const [batchSearch, setBatchSearch] = useState("");
  const [filterExpiry, setFilterExpiry] = useState("ALL");

  // Serial state
  const [showSNModal, setShowSNModal] = useState(false);
  const [editingSNId, setEditingSNId] = useState<string | null>(null);
  const [snForm, setSnForm] = useState(emptySN());
  const [snSearch, setSnSearch] = useState("");
  const [snStatusFilter, setSnStatusFilter] = useState("ALL");

  // Load on mount
  useEffect(() => {
    if (store.loadBatches) store.loadBatches();
    if (store.loadSerialNumbers) store.loadSerialNumbers();
  }, []);

  // ── Auto-fill item name when itemId changes ────────────────────────────────
  const handleBatchItemChange = (itemId: string) => {
    const item = items.find((i: any) => i.id === itemId);
    setBatchForm((f: any) => ({
      ...f,
      itemId,
      itemName: item?.name || "",
      purchaseRate: item?.purchaseRate || item?.rate || 0,
    }));
  };

  const handleSNItemChange = (itemId: string) => {
    const item = items.find((i: any) => i.id === itemId);
    setSnForm((f: any) => ({
      ...f,
      itemId,
      itemName: item?.name || "",
      purchaseRate: item?.purchaseRate || item?.rate || 0,
    }));
  };

  // ── Save batch ─────────────────────────────────────────────────────────────
  const saveBatch = async () => {
    if (!batchForm.itemId) {
      toast.error("Select an item");
      return;
    }
    if (!batchForm.batchNo.trim()) {
      toast.error("Batch number is required");
      return;
    }
    if (!batchForm.currentQty && batchForm.currentQty !== 0) {
      toast.error("Quantity is required");
      return;
    }
    try {
      const payload = stampMovementBranch(
        {
          ...batchForm,
          openingQty: batchForm.openingQty || batchForm.currentQty,
        },
        warehouses,
      );
      if (editingBatchId) {
        await store.updateBatch(editingBatchId, payload);
        toast.success("Batch updated");
      } else {
        await store.addBatch(payload);
        toast.success("Batch added");
      }
      setShowBatchModal(false);
      setEditingBatchId(null);
      setBatchForm(emptyBatch());
    } catch {
      toast.error("Failed to save batch");
    }
  };

  // ── Save serial number ─────────────────────────────────────────────────────
  const saveSerialNumber = async () => {
    if (!snForm.itemId) {
      toast.error("Select an item");
      return;
    }
    if (!snForm.serialNo.trim()) {
      toast.error("Serial number is required");
      return;
    }
    // Check duplicate
    const dup = serialNumbers.find(
      (sn: any) => sn.serialNo === snForm.serialNo && sn.id !== editingSNId,
    );
    if (dup) {
      toast.error("Serial number already exists");
      return;
    }
    try {
      if (editingSNId) {
        await store.updateSerialNumber(editingSNId, stampMovementBranch(snForm, warehouses));
        toast.success("Serial number updated");
      } else {
        await store.addSerialNumber(stampMovementBranch(snForm, warehouses));
        toast.success("Serial number added");
      }
      setShowSNModal(false);
      setEditingSNId(null);
      setSnForm(emptySN());
    } catch {
      toast.error("Failed to save serial number");
    }
  };

  // ── Bulk import serial numbers ─────────────────────────────────────────────
  const handleBulkImportSN = (itemId: string, serialNos: string[]) => {
    const item = items.find((i: any) => i.id === itemId);
    serialNos.forEach(async (sn) => {
      if (!sn.trim()) return;
      await store.addSerialNumber({
        itemId,
        itemName: item?.name || "",
        serialNo: sn.trim(),
        status: "available",
        purchaseDate: new Date().toISOString().split("T")[0],
        purchaseRate: item?.purchaseRate || 0,
      });
    });
    toast.success(`${serialNos.length} serial numbers imported`);
  };

  // ── Filtered batches ───────────────────────────────────────────────────────
  const filteredBatches = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return batches.filter((b: any) => {
      if (!matchMovement({ branchId: b.branchId, warehouseId: b.warehouseId })) return false;

      const q = batchSearch.toLowerCase();
      const matchSearch =
        !q ||
        (b.batchNo || "").toLowerCase().includes(q) ||
        (b.itemName || "").toLowerCase().includes(q) ||
        (b.supplierBatchNo || "").toLowerCase().includes(q);

      const days = daysUntilExpiry(b.expiryDate);
      const matchExpiry =
        filterExpiry === "ALL" ||
        (filterExpiry === "expired" && days <= 0) ||
        (filterExpiry === "30days" && days > 0 && days <= 30) ||
        (filterExpiry === "90days" && days > 0 && days <= 90) ||
        (filterExpiry === "ok" && days > 90);

      return matchSearch && matchExpiry;
    });
  }, [batches, batchSearch, filterExpiry, matchMovement, branchFilter]);

  // ── Filtered serial numbers ────────────────────────────────────────────────
  const filteredSNs = useMemo(() => {
    return serialNumbers.filter((sn: any) => {
      if (!matchMovement({ branchId: sn.branchId, warehouseId: sn.warehouseId })) return false;

      const q = snSearch.toLowerCase();
      const matchSearch =
        !q ||
        (sn.serialNo || "").toLowerCase().includes(q) ||
        (sn.itemName || "").toLowerCase().includes(q) ||
        (sn.soldToPartyName || "").toLowerCase().includes(q);
      const matchStatus = snStatusFilter === "ALL" || sn.status === snStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [serialNumbers, snSearch, snStatusFilter, matchMovement, branchFilter]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportBatches = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        filteredBatches.map((b: any) => ({
          "Batch No": b.batchNo,
          Item: b.itemName,
          "Mfg Date": b.manufacturingDate || "",
          "Expiry Date": b.expiryDate || "",
          "Days to Expiry": b.expiryDate ? daysUntilExpiry(b.expiryDate) : "N/A",
          "Purchase Date": b.purchaseDate,
          "Purchase Rate": b.purchaseRate,
          "Opening Qty": b.openingQty,
          "Current Qty": b.currentQty,
          Value: b.currentQty * b.purchaseRate,
        })),
      ),
      "Batches",
    );
    XLSX.writeFile(wb, `BatchRegister_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportSNs = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        filteredSNs.map((sn: any) => ({
          "Serial No": sn.serialNo,
          Item: sn.itemName,
          Status: sn.status,
          "Purchase Date": sn.purchaseDate || "",
          "Purchase Rate": sn.purchaseRate || "",
          "Sold Date": sn.soldDate || "",
          "Sold To": sn.soldToPartyName || "",
          "Invoice No": sn.invoiceNo || "",
          "Warranty Expiry": sn.warrantyExpiry || "",
        })),
      ),
      "Serial Numbers",
    );
    XLSX.writeFile(wb, `SerialNumbers_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // ── Batch summary stats ────────────────────────────────────────────────────
  const batchStats = useMemo(
    () => ({
      total: batches.length,
      expired: batches.filter((b: any) => b.expiryDate && daysUntilExpiry(b.expiryDate) <= 0)
        .length,
      nearExpiry: batches.filter(
        (b: any) =>
          b.expiryDate && daysUntilExpiry(b.expiryDate) > 0 && daysUntilExpiry(b.expiryDate) <= 30,
      ).length,
      totalValue: batches.reduce(
        (s: number, b: any) => s + (b.currentQty || 0) * (b.purchaseRate || 0),
        0,
      ),
    }),
    [batches],
  );

  const snStats = useMemo(
    () => ({
      total: serialNumbers.length,
      available: serialNumbers.filter((s: any) => s.status === "available").length,
      sold: serialNumbers.filter((s: any) => s.status === "sold").length,
      damaged: serialNumbers.filter((s: any) => s.status === "damaged").length,
    }),
    [serialNumbers],
  );

  // Status badge colours
  const snStatusColors: Record<string, string> = {
    available: "bg-green-100 text-green-700",
    sold: "bg-gray-100 text-gray-700",
    returned: "bg-blue-100 text-blue-700",
    damaged: "bg-red-100 text-red-700",
    reserved: "bg-amber-100 text-amber-700",
  };

  const showForm = showBatchModal || showSNModal;

  const openBatchAdd = () => {
    setActiveTab("batch");
    setBatchForm(emptyBatch());
    setEditingBatchId(null);
    setShowSNModal(false);
    setShowBatchModal(true);
    openEntity(pageId, "new");
  };

  const openSNAdd = () => {
    setActiveTab("serial");
    setSnForm(emptySN());
    setEditingSNId(null);
    setShowBatchModal(false);
    setShowSNModal(true);
    openEntity(pageId, "new");
  };

  const openBatchEdit = (batch: any) => {
    setActiveTab("batch");
    setBatchForm({ ...batch });
    setEditingBatchId(batch.id);
    setShowSNModal(false);
    setShowBatchModal(true);
    openEntity(pageId, batch.id);
  };

  const openSNEdit = (sn: any) => {
    setActiveTab("serial");
    setSnForm({ ...sn });
    setEditingSNId(sn.id);
    setShowBatchModal(false);
    setShowSNModal(true);
    openEntity(pageId, sn.id);
  };

  const resetBatchForm = () => {
    setShowBatchModal(false);
    setEditingBatchId(null);
    setBatchForm(emptyBatch());
    clearEntity(pageId);
  };

  const resetSNForm = () => {
    setShowSNModal(false);
    setEditingSNId(null);
    setSnForm(emptySN());
    clearEntity(pageId);
  };

  const deleteBatchRow = async (batch: any) => {
    const snapshot = { ...batch };
    try {
      await store.deleteBatch(batch.id);
      if (editingBatchId === batch.id) resetBatchForm();
      toast.undo(`Batch "${batch.batchNo}" deleted`, async () => {
        try {
          const db = getDB();
          if (db.batches) await db.batches.put(snapshot);
          if (store.loadBatches) await store.loadBatches();
        } catch {
          toast.error("Failed to restore batch.");
        }
      });
    } catch {
      toast.error("Failed to delete batch");
    }
  };

  const deleteSNRow = async (sn: any) => {
    const snapshot = { ...sn };
    try {
      await store.deleteSerialNumber(sn.id);
      if (editingSNId === sn.id) resetSNForm();
      toast.undo(`Serial "${sn.serialNo}" deleted`, async () => {
        try {
          const db = getDB();
          if (db.serialNumbers) await db.serialNumbers.put(snapshot);
          if (store.loadSerialNumbers) await store.loadSerialNumbers();
        } catch {
          toast.error("Failed to restore serial number.");
        }
      });
    } catch {
      toast.error("Failed to delete serial number");
    }
  };

  const batchColumns = useMemo<EnterpriseColumnDef<any>[]>(
    () => [
      {
        id: "batchNo",
        header: "Batch no.",
        cell: (batch) => (
          <div>
            <span className="font-mono text-[12px] font-medium text-[var(--ds-text-default)]">
              {batch.batchNo}
            </span>
            {batch.supplierBatchNo ? (
              <div className="text-[10px] text-[var(--ds-text-muted)] font-normal">
                Supplier: {batch.supplierBatchNo}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: "itemName",
        header: "Item",
        cell: (batch) => <span className="text-[12px]">{batch.itemName}</span>,
      },
      {
        id: "manufacturingDate",
        header: "Mfg. date",
        cell: (batch) => batch.manufacturingDate || "—",
      },
      {
        id: "expiryDate",
        header: "Expiry date",
        cell: (batch) => {
          const days = daysUntilExpiry(batch.expiryDate);
          const isExpired = batch.expiryDate && days <= 0;
          const isNearExpiry = batch.expiryDate && days > 0 && days <= 30;
          return (
            <span
              className={
                isExpired
                  ? "text-red-600 font-medium"
                  : isNearExpiry
                    ? "text-amber-700 font-medium"
                    : ""
              }
            >
              {batch.expiryDate || "—"}
            </span>
          );
        },
      },
      {
        id: "daysLeft",
        header: "Days left",
        cell: (batch) => {
          if (!batch.expiryDate) return "—";
          const days = daysUntilExpiry(batch.expiryDate);
          const isExpired = days <= 0;
          const isNearExpiry = days > 0 && days <= 30;
          return (
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                isExpired
                  ? "bg-red-100 text-red-700"
                  : isNearExpiry
                    ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700"
              }`}
            >
              {isExpired ? "Expired" : `${days}d`}
            </span>
          );
        },
      },
      {
        id: "purchaseDate",
        header: "Purchase date",
        cell: (batch) => batch.purchaseDate || "—",
      },
      {
        id: "purchaseRate",
        header: "Rate",
        align: "right",
        financial: true,
        cell: (batch) => <span className="font-mono text-[12px]">{fmt(batch.purchaseRate)}</span>,
      },
      {
        id: "currentQty",
        header: "Qty",
        align: "right",
        financial: true,
        cell: (batch) => (
          <span
            className={`font-mono text-[12px] font-medium ${
              (batch.currentQty || 0) <= 0 ? "text-red-500" : "text-[var(--ds-text-default)]"
            }`}
          >
            {fmt(batch.currentQty)}
          </span>
        ),
      },
      {
        id: "value",
        header: "Value",
        align: "right",
        financial: true,
        cell: (batch) => (
          <span className="font-mono text-[12px] font-medium text-[var(--ds-action-primary)]">
            {fmt((batch.currentQty || 0) * (batch.purchaseRate || 0))}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: (batch) => {
          const days = daysUntilExpiry(batch.expiryDate);
          const isExpired = batch.expiryDate && days <= 0;
          return (
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                isExpired
                  ? "bg-red-100 text-red-700"
                  : (batch.currentQty || 0) <= 0
                    ? "bg-gray-100 text-gray-700"
                    : "bg-green-100 text-green-700"
              }`}
            >
              {isExpired ? "Expired" : (batch.currentQty || 0) <= 0 ? "Empty" : "Active"}
            </span>
          );
        },
      },
    ],
    [],
  );

  const snColumns = useMemo<EnterpriseColumnDef<any>[]>(
    () => [
      {
        id: "serialNo",
        header: "Serial no.",
        cell: (sn) => (
          <span className="font-mono text-[12px] font-medium text-[var(--ds-text-default)]">
            {sn.serialNo}
          </span>
        ),
      },
      {
        id: "itemName",
        header: "Item",
        cell: (sn) => <span className="text-[12px]">{sn.itemName}</span>,
      },
      {
        id: "status",
        header: "Status",
        cell: (sn) => (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
              snStatusColors[sn.status] || "bg-gray-100 text-gray-700"
            }`}
          >
            {sn.status}
          </span>
        ),
      },
      {
        id: "purchaseDate",
        header: "Purchase date",
        cell: (sn) => sn.purchaseDate || "—",
      },
      {
        id: "purchaseRate",
        header: "Purchase rate",
        align: "right",
        financial: true,
        cell: (sn) => (
          <span className="font-mono text-[12px]">
            {sn.purchaseRate ? fmt(sn.purchaseRate) : "—"}
          </span>
        ),
      },
      {
        id: "soldDate",
        header: "Sold date",
        cell: (sn) => sn.soldDate || "—",
      },
      {
        id: "soldToPartyName",
        header: "Sold to",
        cell: (sn) => sn.soldToPartyName || "—",
      },
      {
        id: "invoiceNo",
        header: "Invoice",
        cell: (sn) => (
          <span className="text-[11px] font-mono text-[var(--ds-text-muted)]">
            {sn.invoiceNo || "—"}
          </span>
        ),
      },
      {
        id: "warrantyExpiry",
        header: "Warranty expiry",
        cell: (sn) => {
          const expired = sn.warrantyExpiry && daysUntilExpiry(sn.warrantyExpiry) <= 0;
          return (
            <span className={expired ? "text-red-600" : ""}>
              {sn.warrantyExpiry || "—"}
              {expired ? " (Expired)" : ""}
            </span>
          );
        },
      },
    ],
    [],
  );

  // Deep link: /app/batch-management/new | /app/batch-management/:id
  useEffect(() => {
    if (route.pageId !== pageId) return;
    if (route.entityId === "new") {
      if (activeTab === "serial") {
        setEditingSNId(null);
        setSnForm(emptySN());
        setShowSNModal(true);
        setShowBatchModal(false);
      } else {
        setEditingBatchId(null);
        setBatchForm(emptyBatch());
        setShowBatchModal(true);
        setShowSNModal(false);
      }
      return;
    }
    if (route.entityId) {
      const batch = batches.find((b: any) => b.id === route.entityId);
      if (batch) {
        setActiveTab("batch");
        setBatchForm({ ...batch });
        setEditingBatchId(batch.id);
        setShowBatchModal(true);
        setShowSNModal(false);
        return;
      }
      const sn = serialNumbers.find((s: any) => s.id === route.entityId);
      if (sn) {
        setActiveTab("serial");
        setSnForm({ ...sn });
        setEditingSNId(sn.id);
        setShowSNModal(true);
        setShowBatchModal(false);
      }
      return;
    }
    setShowBatchModal(false);
    setShowSNModal(false);
    setEditingBatchId(null);
    setEditingSNId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.pageId, route.entityId, batches, serialNumbers, activeTab]);

  const pageMeta =
    activeTab === "batch"
      ? `${filteredBatches.length} of ${batches.length} batches`
      : `${filteredSNs.length} of ${serialNumbers.length} serial numbers`;

  const tabAddLabel = activeTab === "batch" ? "Add batch" : "Add serial no.";
  const handleTabAdd = activeTab === "batch" ? openBatchAdd : openSNAdd;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-50 overflow-hidden">
      <div className="p-4 pb-0 shrink-0 flex flex-col gap-3">
        <PageHeader
          title="Batch & Serial Number Tracking"
          description="Track inventory by batch/lot or individual serial number"
          meta={<PageMeta>{pageMeta}</PageMeta>}
          primaryAction={
            <Button
              variant="primary"
              size="small"
              onClick={handleTabAdd}
              startIcon={<Plus className="h-3.5 w-3.5" />}
            >
              {tabAddLabel}
            </Button>
          }
          secondaryActions={[
            <Button
              key="export"
              variant="secondary"
              size="small"
              onClick={activeTab === "batch" ? exportBatches : exportSNs}
              startIcon={<Download className="h-3.5 w-3.5" />}
            >
              Export
            </Button>,
          ]}
        />

        <div className="flex gap-1 mb-1">
          <button
            type="button"
            onClick={() => setActiveTab("batch")}
            className={`h-8 px-4 text-[12px] font-medium rounded-md inline-flex items-center gap-1.5 transition-colors ${
              activeTab === "batch"
                ? "bg-[var(--ds-action-primary)] text-white"
                : "bg-white border border-[var(--ds-border-default)] text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Package className="h-3.5 w-3.5" /> Batch / lot tracking
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("serial")}
            className={`h-8 px-4 text-[12px] font-medium rounded-md inline-flex items-center gap-1.5 transition-colors ${
              activeTab === "serial"
                ? "bg-[var(--ds-action-primary)] text-white"
                : "bg-white border border-[var(--ds-border-default)] text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Hash className="h-3.5 w-3.5" /> Serial number tracking
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className={`flex flex-1 flex-col min-w-0 overflow-hidden ${showForm ? "border-r border-gray-200" : ""}`}
        >
          <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
            {activeTab === "batch" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 no-print">
                  {[
                    {
                      label: "Total batches",
                      value: batchStats.total,
                      color: "text-gray-700",
                      isAmt: false,
                    },
                    {
                      label: "Expired",
                      value: batchStats.expired,
                      color: "text-red-600",
                      isAmt: false,
                    },
                    {
                      label: "Expiring (30d)",
                      value: batchStats.nearExpiry,
                      color: "text-amber-700",
                      isAmt: false,
                    },
                    {
                      label: "Total value",
                      value: batchStats.totalValue,
                      color: "text-[var(--ds-action-primary)]",
                      isAmt: true,
                    },
                  ].map((k) => (
                    <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-3">
                      <p className="text-[11px] font-medium text-gray-500">
                        {k.label}
                      </p>
                      <p className={`text-[12px] font-bold font-mono mt-1 ${k.color}`}>
                        {k.isAmt ? "Rs. " + fmt(k.value as number) : k.value}
                      </p>
                    </div>
                  ))}
                </div>

                {(batchStats.expired > 0 || batchStats.nearExpiry > 0) && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 flex items-center gap-2 text-[12px] text-red-800 no-print">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {batchStats.expired > 0 && (
                      <span>
                        <strong>{batchStats.expired} batches have expired.</strong>{" "}
                      </span>
                    )}
                    {batchStats.nearExpiry > 0 && (
                      <span>
                        <strong>{batchStats.nearExpiry} batches expiring within 30 days.</strong>
                      </span>
                    )}
                  </div>
                )}

                <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-wrap gap-3 items-end no-print">
                  <div className="flex-1 min-w-[180px] relative">
                    <label className={labelCls}>Search</label>
                    <Search className="h-3.5 w-3.5 absolute left-2.5 bottom-2 text-gray-400 pointer-events-none" />
                    <input
                      value={batchSearch}
                      onChange={(e) => setBatchSearch(e.target.value)}
                      placeholder="Batch no, item name..."
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Expiry status</label>
                    <select
                      value={filterExpiry}
                      onChange={(e) => setFilterExpiry(e.target.value)}
                      className={inputCls}
                    >
                      <option value="ALL">All</option>
                      <option value="expired">Expired</option>
                      <option value="30days">Expiring in 30 days</option>
                      <option value="90days">Expiring in 90 days</option>
                      <option value="ok">OK (&gt;90 days)</option>
                    </select>
                  </div>
                </div>

                {filteredBatches.length === 0 ? (
                  <EnterpriseDataTable
                    columns={batchColumns}
                    rows={[]}
                    getRowId={(batch) => batch.id}
                    emptyTitle={
                      batchSearch || filterExpiry !== "ALL"
                        ? "No batches match your filters"
                        : "No batches found"
                    }
                    emptyDescription={
                      batchSearch || filterExpiry !== "ALL"
                        ? "Try adjusting search or expiry filters."
                        : 'Click "Add batch" to begin tracking inventory by lot.'
                    }
                    emptyAction={
                      !batchSearch && filterExpiry === "ALL" ? (
                        <Button
                          variant="primary"
                          size="small"
                          onClick={openBatchAdd}
                          startIcon={<Plus className="h-3.5 w-3.5" />}
                        >
                          Add batch
                        </Button>
                      ) : undefined
                    }
                    caption="Batches"
                  />
                ) : (
                  <EnterpriseDataTable
                    columns={batchColumns}
                    rows={filteredBatches}
                    getRowId={(batch) => batch.id}
                    onRowClick={openBatchEdit}
                    rowActions={(batch) => [
                      { label: "Edit", onSelect: () => openBatchEdit(batch) },
                      { label: "Delete", destructive: true, onSelect: () => deleteBatchRow(batch) },
                    ]}
                    caption="Batches"
                  />
                )}
              </>
            )}

            {activeTab === "serial" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 no-print">
                  {[
                    { label: "Total units", value: snStats.total, color: "text-gray-700" },
                    { label: "Available", value: snStats.available, color: "text-green-700" },
                    { label: "Sold", value: snStats.sold, color: "text-gray-600" },
                    { label: "Damaged", value: snStats.damaged, color: "text-red-600" },
                  ].map((k) => (
                    <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-3">
                      <p className="text-[11px] font-medium text-gray-500">
                        {k.label}
                      </p>
                      <p className={`text-[12px] font-bold font-mono mt-1 ${k.color}`}>{k.value}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-wrap gap-3 items-end no-print">
                  <div className="flex-1 min-w-[180px] relative">
                    <label className={labelCls}>Search</label>
                    <Search className="h-3.5 w-3.5 absolute left-2.5 bottom-2 text-gray-400 pointer-events-none" />
                    <input
                      value={snSearch}
                      onChange={(e) => setSnSearch(e.target.value)}
                      placeholder="Serial no, item, customer..."
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Status</label>
                    <div className="flex rounded-lg border border-[var(--ds-border-default)] overflow-hidden">
                      {["ALL", "available", "sold", "returned", "damaged", "reserved"].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSnStatusFilter(s)}
                          className={`h-8 px-2.5 text-[11px] font-medium capitalize transition-colors ${snStatusFilter === s ? "bg-[var(--ds-action-primary)] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                        >
                          {s === "ALL" ? "All" : s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {filteredSNs.length === 0 ? (
                  <EnterpriseDataTable
                    columns={snColumns}
                    rows={[]}
                    getRowId={(sn) => sn.id}
                    emptyTitle={
                      snSearch || snStatusFilter !== "ALL"
                        ? "No serial numbers match your filters"
                        : "No serial numbers found"
                    }
                    emptyDescription={
                      snSearch || snStatusFilter !== "ALL"
                        ? "Try adjusting search or status filters."
                        : 'Click "Add serial no." to register a unit.'
                    }
                    emptyAction={
                      !snSearch && snStatusFilter === "ALL" ? (
                        <Button
                          variant="primary"
                          size="small"
                          onClick={openSNAdd}
                          startIcon={<Plus className="h-3.5 w-3.5" />}
                        >
                          Add serial no.
                        </Button>
                      ) : undefined
                    }
                    caption="Serial numbers"
                  />
                ) : (
                  <EnterpriseDataTable
                    columns={snColumns}
                    rows={filteredSNs}
                    getRowId={(sn) => sn.id}
                    onRowClick={openSNEdit}
                    rowActions={(sn) => [
                      { label: "Edit", onSelect: () => openSNEdit(sn) },
                      { label: "Delete", destructive: true, onSelect: () => deleteSNRow(sn) },
                    ]}
                    caption="Serial numbers"
                  />
                )}
              </>
            )}
          </div>
        </div>

        {showBatchModal && (
          <div className="w-full lg:w-[420px] xl:w-[480px] shrink-0 flex flex-col bg-white border-l border-gray-200 min-h-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
              <span className="text-[13px] font-semibold text-gray-700">
                {editingBatchId ? "Edit batch" : "Add batch / lot"}
              </span>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-700"
                onClick={resetBatchForm}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Item *</label>
                  <select
                    className={inputCls}
                    value={batchForm.itemId}
                    onChange={(e) => handleBatchItemChange(e.target.value)}
                  >
                    <option value="">— Select Item —</option>
                    {items.map((i: any) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Batch No. *</label>
                  <input
                    className={inputCls}
                    value={batchForm.batchNo}
                    onChange={(e) => setBatchForm((f: any) => ({ ...f, batchNo: e.target.value }))}
                    placeholder="e.g. BCH-2024-001"
                  />
                </div>
                <div>
                  <label className={labelCls}>Supplier Batch No.</label>
                  <input
                    className={inputCls}
                    value={batchForm.supplierBatchNo}
                    onChange={(e) =>
                      setBatchForm((f: any) => ({ ...f, supplierBatchNo: e.target.value }))
                    }
                    placeholder="Supplier's batch reference"
                  />
                </div>
                <div>
                  <label className={labelCls}>Manufacturing Date</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={batchForm.manufacturingDate}
                    onChange={(e) =>
                      setBatchForm((f: any) => ({ ...f, manufacturingDate: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Expiry Date</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={batchForm.expiryDate}
                    onChange={(e) =>
                      setBatchForm((f: any) => ({ ...f, expiryDate: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Purchase Date *</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={batchForm.purchaseDate}
                    onChange={(e) =>
                      setBatchForm((f: any) => ({ ...f, purchaseDate: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Purchase Rate (Rs.)</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={batchForm.purchaseRate || ""}
                    onChange={(e) =>
                      setBatchForm((f: any) => ({
                        ...f,
                        purchaseRate: Number(e.target.value) || 0,
                      }))
                    }
                    min={0}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelCls}>Quantity *</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={batchForm.currentQty || ""}
                    onChange={(e) =>
                      setBatchForm((f: any) => ({
                        ...f,
                        currentQty: Number(e.target.value) || 0,
                        openingQty: Number(e.target.value) || 0,
                      }))
                    }
                    min={0}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={labelCls}>Warehouse</label>
                  <select
                    className={inputCls}
                    value={batchForm.warehouseId}
                    onChange={(e) =>
                      setBatchForm((f: any) => ({ ...f, warehouseId: e.target.value }))
                    }
                  >
                    <option value="">— Select Warehouse —</option>
                    {warehouses.map((w: any) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Notes</label>
                  <input
                    className={inputCls}
                    value={batchForm.notes}
                    onChange={(e) => setBatchForm((f: any) => ({ ...f, notes: e.target.value }))}
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-gray-200 shrink-0">
              <button type="button" className={btnPrimary} onClick={saveBatch}>
                <Save className="h-3.5 w-3.5" />
                {editingBatchId ? "Update" : "Save"}
              </button>
              <button type="button" className={btnOutline} onClick={resetBatchForm}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {showSNModal && (
          <div className="w-full lg:w-[420px] xl:w-[480px] shrink-0 flex flex-col bg-white border-l border-gray-200 min-h-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
              <span className="text-[13px] font-semibold text-gray-700">
                {editingSNId ? "Edit serial number" : "Add serial number"}
              </span>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-700"
                onClick={resetSNForm}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Item *</label>
                  <select
                    className={inputCls}
                    value={snForm.itemId}
                    onChange={(e) => handleSNItemChange(e.target.value)}
                  >
                    <option value="">— Select Item —</option>
                    {items.map((i: any) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Serial Number *</label>
                  <input
                    className={inputCls}
                    value={snForm.serialNo}
                    onChange={(e) => setSnForm((f: any) => ({ ...f, serialNo: e.target.value }))}
                    placeholder="e.g. SN-2024-00001"
                  />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select
                    className={inputCls}
                    value={snForm.status}
                    onChange={(e) => setSnForm((f: any) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="available">Available</option>
                    <option value="sold">Sold</option>
                    <option value="returned">Returned</option>
                    <option value="damaged">Damaged</option>
                    <option value="reserved">Reserved</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Purchase Date</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={snForm.purchaseDate}
                    onChange={(e) =>
                      setSnForm((f: any) => ({ ...f, purchaseDate: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Purchase Rate (Rs.)</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={snForm.purchaseRate || ""}
                    onChange={(e) =>
                      setSnForm((f: any) => ({ ...f, purchaseRate: Number(e.target.value) || 0 }))
                    }
                    min={0}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelCls}>Warranty Expiry</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={snForm.warrantyExpiry}
                    onChange={(e) =>
                      setSnForm((f: any) => ({ ...f, warrantyExpiry: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Warehouse</label>
                  <select
                    className={inputCls}
                    value={snForm.warehouseId}
                    onChange={(e) => setSnForm((f: any) => ({ ...f, warehouseId: e.target.value }))}
                  >
                    <option value="">— Select Warehouse —</option>
                    {warehouses.map((w: any) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Sold details — only show when status = sold */}
                {snForm.status === "sold" && (
                  <>
                    <div>
                      <label className={labelCls}>Sold Date</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={snForm.soldDate || ""}
                        onChange={(e) =>
                          setSnForm((f: any) => ({ ...f, soldDate: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Sold To (Customer)</label>
                      <select
                        className={inputCls}
                        value={snForm.soldToPartyId || ""}
                        onChange={(e) => {
                          const party = parties.find((p: any) => p.id === e.target.value);
                          setSnForm((f: any) => ({
                            ...f,
                            soldToPartyId: e.target.value,
                            soldToPartyName: party?.name || "",
                          }));
                        }}
                      >
                        <option value="">— Select Customer —</option>
                        {parties
                          .filter((p: any) => p.type === "customer" || p.type === "both")
                          .map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Invoice No.</label>
                      <input
                        className={inputCls}
                        value={snForm.invoiceNo || ""}
                        onChange={(e) =>
                          setSnForm((f: any) => ({ ...f, invoiceNo: e.target.value }))
                        }
                        placeholder="Link to invoice number"
                      />
                    </div>
                  </>
                )}
                <div className="col-span-2">
                  <label className={labelCls}>Notes</label>
                  <input
                    className={inputCls}
                    value={snForm.notes || ""}
                    onChange={(e) => setSnForm((f: any) => ({ ...f, notes: e.target.value }))}
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-gray-200 shrink-0">
              <button type="button" className={btnPrimary} onClick={saveSerialNumber}>
                <Save className="h-3.5 w-3.5" />
                {editingSNId ? "Update" : "Save"}
              </button>
              <button type="button" className={btnOutline} onClick={resetSNForm}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
