// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "react-hot-toast";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  CheckCircle,
  AlertTriangle,
  FileText,
  Factory,
  Wrench,
  BarChart2,
  Package,
} from "lucide-react";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const cardClass = "bg-white border border-gray-200 rounded-md shadow-sm p-4";
const tableHeadClass =
  "bg-[#f5f6fa] border-b border-gray-200 px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const tableCellClass = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";

const primaryBtn =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm";
const outlineBtn =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm";
const inputClass =
  "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] transition-shadow";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function stockForItem(itemId: string, stockMovements: any[]) {
  return (stockMovements || [])
    .filter((m) => m.itemId === itemId)
    .reduce((s, m) => {
      const qty = Number(m.quantity || m.qty || 0);
      const type = String(m.type || "").toLowerCase();
      if (type === "in" || type === "purchase" || type.includes("in")) return s + qty;
      return s - qty;
    }, 0);
}

function statusBadge(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "completed")
    return (
      <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-semibold tracking-wide">
        Completed
      </span>
    );
  if (s === "cancelled")
    return (
      <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-semibold tracking-wide">
        Cancelled
      </span>
    );
  if (s === "in-process")
    return (
      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-semibold tracking-wide">
        In-Process
      </span>
    );
  if (s === "released")
    return (
      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-semibold tracking-wide">
        Released
      </span>
    );
  if (s === "draft")
    return (
      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 rounded text-[10px] font-semibold tracking-wide">
        Draft
      </span>
    );
  if (s === "active")
    return (
      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-semibold tracking-wide">
        Active
      </span>
    );
  if (s === "obsolete")
    return (
      <span className="px-2 py-0.5 bg-gray-200 text-gray-600 border border-gray-300 rounded text-[10px] font-semibold tracking-wide">
        Obsolete
      </span>
    );
  return (
    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 rounded text-[10px] font-semibold tracking-wide">
      {status || "Unknown"}
    </span>
  );
}

function Modal({ open, title, children, onClose, wide = false }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white border border-gray-200 shadow-xl rounded-lg w-full ${wide ? "max-w-6xl" : "max-w-3xl"} flex flex-col max-h-[90vh]`}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <h2 className="text-[15px] font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export default function BOMProduction() {
  const {
    items = [],
    stockMovements = [],
    vouchers = [],
    accounts = [],
    warehouses = [],
    parties = [],
    addVoucher,
    currentFiscalYear = {},
  } = useStore();

  const [activeTab, setActiveTab] = useState("BOM Master");

  const [boms, setBoms] = useState([]);
  const [productionOrders, setProductionOrders] = useState([]);
  const [jobWorkOrders, setJobWorkOrders] = useState([]);

  const [bomModal, setBomModal] = useState(false);
  const [editingBom, setEditingBom] = useState(null);
  const [bomForm, setBomForm] = useState({
    name: "",
    finishedProductId: "",
    outputQty: 1,
    version: "1.0",
    status: "Draft",
    notes: "",
    components: [],
  });

  const [poForm, setPoForm] = useState({
    orderNo: "",
    finishedProductId: "",
    bomId: "",
    plannedQty: 1,
    startDate: todayISO(),
    endDate: todayISO(),
    warehouseId: "",
  });

  const [selectedPO, setSelectedPO] = useState(null);
  const [materialPreview, setMaterialPreview] = useState([]);
  const [actualQty, setActualQty] = useState("");
  const [completionPreview, setCompletionPreview] = useState(null);

  const [jobForm, setJobForm] = useState({
    jobWorkerId: "",
    dateSent: todayISO(),
    expectedReturn: todayISO(),
    processingCharges: 0,
    materials: [],
  });

  const [returnJobId, setReturnJobId] = useState("");
  const [returnItemId, setReturnItemId] = useState("");
  const [returnQty, setReturnQty] = useState("");
  const [returnCharges, setReturnCharges] = useState("");

  const [selectedCostPO, setSelectedCostPO] = useState("");

  useEffect(() => {
    const db = getDB();
    db.table("boms")
      .toArray()
      .catch(() => [])
      .then(setBoms);
    db.table("productionOrders")
      .toArray()
      .catch(() => [])
      .then(setProductionOrders);
    db.table("jobWorkOrders")
      .toArray()
      .catch(() => [])
      .then(setJobWorkOrders);
  }, []);

  const totalStandardCost = useMemo(() => {
    return (bomForm.components || []).reduce((s, c) => {
      const netQty = Number(c.qty || 0) * (1 + Number(c.wastage || 0) / 100);
      return s + netQty * Number(c.rate || 0);
    }, 0);
  }, [bomForm.components]);

  function openBom(bom?: any) {
    setEditingBom(bom || null);
    setBomForm(
      bom
        ? { ...bom, components: bom.components || [] }
        : {
            name: "",
            finishedProductId: "",
            outputQty: 1,
            version: "1.0",
            status: "Draft",
            notes: "",
            components: [],
          },
    );
    setBomModal(true);
  }

  function addBomComponent() {
    setBomForm((f) => ({
      ...f,
      components: [
        ...(f.components || []),
        {
          id: generateId(),
          itemId: "",
          itemName: "",
          unit: "PCS",
          qty: 1,
          wastage: 0,
          rate: 0,
        },
      ],
    }));
  }

  function updateBomComponent(index: number, changes: any) {
    setBomForm((f) => {
      const rows = [...(f.components || [])];
      let row = { ...rows[index], ...changes };

      if (changes.itemId) {
        const item = items.find((i) => i.id === changes.itemId);
        row = {
          ...row,
          itemId: item?.id || "",
          itemName: item?.name || "",
          unit: item?.unit || item?.uom || "PCS",
          rate: Number(item?.purchasePrice || item?.purchaseRate || item?.rate || row.rate || 0),
        };
      }

      rows[index] = row;
      return { ...f, components: rows };
    });
  }

  function removeBomComponent(index: number) {
    setBomForm((f) => ({
      ...f,
      components: (f.components || []).filter((_, i) => i !== index),
    }));
  }

  function calculateRollup() {
    const activeBoms = boms.filter((b) => b.status === "Active");

    const rows = (bomForm.components || []).map((c) => {
      const childBom = activeBoms.find((b) => b.finishedProductId === c.itemId);
      if (!childBom) return c;

      const unitCost = Number(childBom.totalStandardCost || 0) / Number(childBom.outputQty || 1);
      return { ...c, rate: unitCost };
    });

    const newTotal = rows.reduce((s, c) => {
      const netQty = Number(c.qty || 0) * (1 + Number(c.wastage || 0) / 100);
      return s + netQty * Number(c.rate || 0);
    }, 0);

    setBomForm((f) => ({ ...f, components: rows }));
    toast.success(`Cost roll-up complete. New standard cost: Rs. ${money(newTotal)}`);
  }

  async function saveBom() {
    if (!bomForm.finishedProductId) return toast.error("Select finished product");
    if (!Number(bomForm.outputQty || 0)) return toast.error("Output quantity is required");

    const product = items.find((i) => i.id === bomForm.finishedProductId);

    const row = {
      ...bomForm,
      id: editingBom?.id || bomForm.id || generateId(),
      name: bomForm.name || `${product?.name || "BOM"} v${bomForm.version}`,
      totalStandardCost,
      createdAt: editingBom?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await getDB()
      .table("boms")
      .put(row)
      .catch(() => {});
    setBoms((rows) => rows.filter((x) => x.id !== row.id).concat(row));
    setBomModal(false);
    toast.success("BOM saved");
  }

  async function deleteBom(id: string) {
    if (!confirm("Delete this BOM?")) return;
    await getDB()
      .table("boms")
      .delete(id)
      .catch(() => {});
    setBoms((rows) => rows.filter((x) => x.id !== id));
    toast.success("BOM deleted");
  }

  function generateOrderNo() {
    const fy =
      currentFiscalYear?.fiscalYearBS || currentFiscalYear?.name || new Date().getFullYear();
    return `PO-${String(fy).slice(0, 4)}-${String(productionOrders.length + 1).padStart(4, "0")}`;
  }

  function onPOProductChange(productId: string) {
    const activeBom = boms.find((b) => b.finishedProductId === productId && b.status === "Active");
    setPoForm((f) => ({
      ...f,
      finishedProductId: productId,
      bomId: activeBom?.id || "",
    }));
  }

  async function createPO() {
    if (!poForm.finishedProductId) return toast.error("Select finished product");
    if (!poForm.bomId) return toast.error("Select BOM");
    if (Number(poForm.plannedQty || 0) <= 0)
      return toast.error("Planned quantity must be greater than zero");

    const row = {
      id: generateId(),
      orderNo: poForm.orderNo || generateOrderNo(),
      finishedProductId: poForm.finishedProductId,
      bomId: poForm.bomId,
      plannedQty: Number(poForm.plannedQty || 1),
      actualQty: 0,
      startDate: poForm.startDate,
      endDate: poForm.endDate,
      warehouseId: poForm.warehouseId,
      status: "Planned",
      createdAt: new Date().toISOString(),
    };

    await getDB()
      .table("productionOrders")
      .put(row)
      .catch(() => {});
    setProductionOrders((rows) => [...rows, row]);

    setPoForm({
      orderNo: "",
      finishedProductId: "",
      bomId: "",
      plannedQty: 1,
      startDate: todayISO(),
      endDate: todayISO(),
      warehouseId: "",
    });

    toast.success("Production order created");
  }

  async function updatePOStatus(po: any, status: string, changes: any = {}) {
    const row = {
      ...po,
      ...changes,
      status,
      updatedAt: new Date().toISOString(),
    };

    await getDB()
      .table("productionOrders")
      .put(row)
      .catch(() => {});
    setProductionOrders((rows) => rows.map((x) => (x.id === po.id ? row : x)));
    setSelectedPO(row);
  }

  function materialAvailability(po: any) {
    const bom = boms.find((b) => b.id === po?.bomId);
    if (!bom) return [];

    return (bom.components || []).map((c) => {
      const required =
        (Number(c.qty || 0) * (1 + Number(c.wastage || 0) / 100) * Number(po.plannedQty || 0)) /
        Number(bom.outputQty || 1);

      const available = stockForItem(c.itemId, stockMovements);

      return {
        ...c,
        required,
        available,
        sufficient: available >= required,
      };
    });
  }

  function previewIssue(po: any) {
    const rows = materialAvailability(po);
    setMaterialPreview(rows);
  }

  async function confirmIssue(po: any) {
    const rows = materialPreview.length ? materialPreview : materialAvailability(po);

    if (!rows.length) return toast.error("No materials to issue");

    const voucher = {
      id: generateId(),
      type: "stock-journal",
      status: "posted",
      date: todayISO(),
      narration: `Material Issue for Production Order ${po.orderNo}`,
      productionOrderId: po.id,
      lines: rows.map((r) => ({
        id: generateId(),
        itemId: r.itemId,
        itemName: r.itemName,
        qty: r.required,
        quantity: r.required,
        type: "out",
        debit: 0,
        credit: Number(r.required || 0) * Number(r.rate || 0),
      })),
    };

    if (addVoucher) await addVoucher(voucher);
    else
      await getDB()
        .table("vouchers")
        .put(voucher)
        .catch(() => {});

    await updatePOStatus(po, "In-Process", {
      issuedAt: new Date().toISOString(),
      issuedMaterials: rows,
    });

    setMaterialPreview([]);
    toast.success("Materials issued and order moved to In-Process");
  }

  function previewComplete(po: any) {
    const bom = boms.find((b) => b.id === po.bomId);
    if (!bom) return toast.error("BOM not found");

    const qty = Number(actualQty || po.plannedQty || 0);
    if (qty <= 0) return toast.error("Enter actual quantity produced");

    const standardCost = (Number(bom.totalStandardCost || 0) / Number(bom.outputQty || 1)) * qty;
    const issuedRows = po.issuedMaterials || materialAvailability(po);
    const issuedCost = issuedRows.reduce(
      (s, r) => s + Number(r.required || 0) * Number(r.rate || 0),
      0,
    );

    setCompletionPreview({
      po,
      qty,
      standardCost,
      issuedCost,
      variance: issuedCost - standardCost,
      bom,
    });
  }

  async function confirmComplete() {
    const p = completionPreview;
    if (!p) return;

    const fgVoucher = {
      id: generateId(),
      type: "stock-journal",
      status: "posted",
      date: todayISO(),
      narration: `Finished Goods Receipt for Production Order ${p.po.orderNo}`,
      productionOrderId: p.po.id,
      lines: [
        {
          id: generateId(),
          itemId: p.po.finishedProductId,
          qty: p.qty,
          quantity: p.qty,
          type: "in",
          debit: p.standardCost,
          credit: 0,
        },
      ],
    };

    const costVoucher = {
      id: generateId(),
      type: "journal",
      status: "posted",
      date: todayISO(),
      narration: `Production Cost Transfer for ${p.po.orderNo}`,
      productionOrderId: p.po.id,
      lines: [
        {
          id: generateId(),
          accountName: "Finished Goods Inventory",
          debit: p.standardCost,
          credit: 0,
        },
        { id: generateId(), accountName: "Work in Process", debit: 0, credit: p.standardCost },
        ...(Math.abs(p.variance) > 0.01
          ? [
              {
                id: generateId(),
                accountName: "Production Variance",
                debit: p.variance > 0 ? p.variance : 0,
                credit: p.variance < 0 ? Math.abs(p.variance) : 0,
              },
            ]
          : []),
      ],
    };

    if (addVoucher) {
      await addVoucher(fgVoucher);
      await addVoucher(costVoucher);
    } else {
      await getDB()
        .table("vouchers")
        .put(fgVoucher)
        .catch(() => {});
      await getDB()
        .table("vouchers")
        .put(costVoucher)
        .catch(() => {});
    }

    await updatePOStatus(p.po, "Completed", {
      actualQty: p.qty,
      completedDate: todayISO(),
      standardCost: p.standardCost,
      actualCost: p.issuedCost,
    });

    setCompletionPreview(null);
    setActualQty("");
    toast.success("Production completed");
  }

  function addJobMaterial() {
    setJobForm((f) => ({
      ...f,
      materials: [
        ...(f.materials || []),
        {
          id: generateId(),
          itemId: "",
          itemName: "",
          qty: 1,
          unit: "PCS",
          rate: 0,
        },
      ],
    }));
  }

  function updateJobMaterial(index: number, changes: any) {
    setJobForm((f) => {
      const rows = [...(f.materials || [])];
      let row = { ...rows[index], ...changes };

      if (changes.itemId) {
        const item = items.find((i) => i.id === changes.itemId);
        row = {
          ...row,
          itemId: item?.id || "",
          itemName: item?.name || "",
          unit: item?.unit || item?.uom || "PCS",
          rate: Number(item?.purchasePrice || item?.rate || 0),
        };
      }

      rows[index] = row;
      return { ...f, materials: rows };
    });
  }

  function removeJobMaterial(index: number) {
    setJobForm((f) => ({
      ...f,
      materials: (f.materials || []).filter((_, i) => i !== index),
    }));
  }

  async function saveJobOut() {
    if (!jobForm.jobWorkerId) return toast.error("Select job worker");
    if (!jobForm.materials.length) return toast.error("Add at least one material");

    const row = {
      id: generateId(),
      type: "out",
      status: "open",
      jobWorkerId: jobForm.jobWorkerId,
      dateSent: jobForm.dateSent,
      expectedReturn: jobForm.expectedReturn,
      materials: jobForm.materials,
      processingCharges: Number(jobForm.processingCharges || 0),
      createdAt: new Date().toISOString(),
    };

    await getDB()
      .table("jobWorkOrders")
      .add(row)
      .catch(() => {});
    setJobWorkOrders((rows) => [...rows, row]);

    setJobForm({
      jobWorkerId: "",
      dateSent: todayISO(),
      expectedReturn: todayISO(),
      processingCharges: 0,
      materials: [],
    });

    toast.success("Job work out saved");
  }

  async function markJobReturn() {
    const job = jobWorkOrders.find((j) => j.id === returnJobId);
    if (!job) return toast.error("Select job work order");
    if (!returnItemId) return toast.error("Select finished item");
    if (Number(returnQty || 0) <= 0) return toast.error("Enter quantity received");

    const row = {
      ...job,
      status: "returned",
      returnItemId,
      returnQty: Number(returnQty || 0),
      returnCharges: Number(returnCharges || 0),
      returnedAt: new Date().toISOString(),
    };

    await getDB()
      .table("jobWorkOrders")
      .put(row)
      .catch(() => {});
    setJobWorkOrders((rows) => rows.map((j) => (j.id === row.id ? row : j)));

    toast.success("Job work marked returned");
  }

  const completedPO = productionOrders.find((p) => p.id === selectedCostPO);
  const completedBom = boms.find((b) => b.id === completedPO?.bomId);

  const costSheet = useMemo(() => {
    if (!completedPO || !completedBom) return null;

    const actualQtyProduced = Number(completedPO.actualQty || completedPO.plannedQty || 0);
    const factor = actualQtyProduced / Number(completedBom.outputQty || 1);

    const rows = (completedBom.components || []).map((c) => {
      const stdQty = Number(c.qty || 0) * factor;
      const issue = (completedPO.issuedMaterials || []).find((m) => m.itemId === c.itemId);
      const actualQtyIssued = Number(issue?.required || stdQty);
      const stdRate = Number(c.rate || 0);
      const actualRate = Number(issue?.rate || c.rate || 0);
      const stdCost = stdQty * stdRate;
      const actualCost = actualQtyIssued * actualRate;

      return {
        component: c.itemName,
        stdQty,
        actualQty: actualQtyIssued,
        qtyVar: actualQtyIssued - stdQty,
        stdRate,
        actualRate,
        rateVar: actualRate - stdRate,
        stdCost,
        actualCost,
        variance: actualCost - stdCost,
      };
    });

    const standardCost = rows.reduce((s, r) => s + r.stdCost, 0);
    const actualCost = rows.reduce((s, r) => s + r.actualCost, 0);

    return {
      rows,
      standardCost,
      actualCost,
      variance: actualCost - standardCost,
    };
  }, [completedPO, completedBom]);

  const tabs = [
    { id: "BOM Master", icon: <FileText size={14} /> },
    { id: "Production Orders", icon: <Factory size={14} /> },
    { id: "Job Work", icon: <Wrench size={14} /> },
    { id: "Production Cost Sheet", icon: <BarChart2 size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4 text-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Package size={18} className="text-[#1557b0]" /> BOM & Production
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Manage Bills of Materials, production orders, job work and cost analysis.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-[12px] rounded-t-md font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === t.id
                ? "bg-white text-[#1557b0] border-t border-l border-r border-gray-200 shadow-[0_-2px_0_0_#1557b0]"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            {t.icon} {t.id}
          </button>
        ))}
      </div>

      {activeTab === "BOM Master" && (
        <div className={cardClass}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[14px] font-semibold text-gray-700">Bills of Materials</h2>
            <button className={primaryBtn} onClick={() => openBom()}>
              <Plus size={14} /> Create BOM
            </button>
          </div>

          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {[
                    "BOM Name",
                    "Finished Product",
                    "Output Qty",
                    "Components",
                    "Standard Cost",
                    "Version",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th className={tableHeadClass} key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {boms.map((b) => (
                  <tr key={b.id} className="bg-white hover:bg-gray-50">
                    <td className={`${tableCellClass} font-medium`}>{b.name}</td>
                    <td className={tableCellClass}>
                      {items.find((i) => i.id === b.finishedProductId)?.name || b.finishedProductId}
                    </td>
                    <td className={tableCellClass}>{b.outputQty}</td>
                    <td className={tableCellClass}>
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-semibold">
                        {(b.components || []).length} items
                      </span>
                    </td>
                    <td className={`${tableCellClass} font-semibold text-gray-900`}>
                      Rs. {money(b.totalStandardCost)}
                    </td>
                    <td className={tableCellClass}>v{b.version}</td>
                    <td className={tableCellClass}>{statusBadge(b.status)}</td>
                    <td className={tableCellClass}>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openBom(b)}
                          className="text-gray-500 hover:text-[#1557b0]"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => deleteBom(b.id)}
                          className="text-gray-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!boms.length && (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center p-8 text-gray-500 text-[12px] bg-gray-50/50"
                    >
                      No Bills of Materials found. Click "Create BOM" to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "Production Orders" && (
        <div className="space-y-4">
          <div className={cardClass}>
            <h2 className="text-[14px] font-semibold text-gray-700 mb-4 border-b border-gray-100 pb-2">
              Create Production Order
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Order No.
                </label>
                <input
                  className={inputClass}
                  placeholder="Auto-generated if empty"
                  value={poForm.orderNo}
                  onChange={(e) => setPoForm({ ...poForm, orderNo: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Finished Product
                </label>
                <select
                  className={inputClass}
                  value={poForm.finishedProductId}
                  onChange={(e) => onPOProductChange(e.target.value)}
                >
                  <option value="">Select Finished Product</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  BOM Version
                </label>
                <select
                  className={inputClass}
                  value={poForm.bomId}
                  onChange={(e) => setPoForm({ ...poForm, bomId: e.target.value })}
                >
                  <option value="">Select BOM</option>
                  {boms
                    .filter(
                      (b) =>
                        !poForm.finishedProductId ||
                        b.finishedProductId === poForm.finishedProductId,
                    )
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} v{b.version}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Planned Quantity
                </label>
                <input
                  className={inputClass}
                  type="number"
                  value={poForm.plannedQty}
                  onChange={(e) => setPoForm({ ...poForm, plannedQty: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Start Date
                </label>
                <input
                  className={inputClass}
                  type="date"
                  value={poForm.startDate}
                  onChange={(e) => setPoForm({ ...poForm, startDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">End Date</label>
                <input
                  className={inputClass}
                  type="date"
                  value={poForm.endDate}
                  onChange={(e) => setPoForm({ ...poForm, endDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Destination Warehouse
                </label>
                <select
                  className={inputClass}
                  value={poForm.warehouseId}
                  onChange={(e) => setPoForm({ ...poForm, warehouseId: e.target.value })}
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <button className={primaryBtn} onClick={createPO}>
                  Create Order
                </button>
              </div>
            </div>

            {poForm.bomId && Number(poForm.plannedQty || 0) > 0 && (
              <div className="mt-5 border border-indigo-200 rounded-md p-4 bg-indigo-50/30">
                <div className="font-semibold text-[13px] text-indigo-900 mb-3 flex items-center gap-2">
                  <Package size={16} /> Material Availability Check
                </div>
                <div className="overflow-x-auto rounded border border-indigo-100 bg-white shadow-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {["Component", "Required", "Available", "Sufficient"].map((h) => (
                          <th key={h} className={tableHeadClass}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {materialAvailability({ ...poForm }).map((m) => (
                        <tr key={m.itemId}>
                          <td className={`${tableCellClass} font-medium`}>{m.itemName}</td>
                          <td className={tableCellClass}>{money(m.required)}</td>
                          <td className={tableCellClass}>{money(m.available)}</td>
                          <td className={tableCellClass}>
                            {m.sufficient ? (
                              <span className="flex items-center gap-1 text-green-600 font-semibold text-[11px]">
                                <CheckCircle size={12} /> Yes
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-600 font-semibold text-[11px]">
                                <AlertTriangle size={12} /> No
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {materialAvailability({ ...poForm }).some((m) => !m.sufficient) && (
                  <div className="mt-3 text-[12px] text-amber-700 bg-amber-50 p-2 border border-amber-200 rounded flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    Insufficient material found.
                    <button
                      className="underline font-medium hover:text-amber-900 transition-colors"
                      onClick={() =>
                        toast(
                          "Purchase requisition workflow can be opened from Purchase Management.",
                        )
                      }
                    >
                      Create Purchase Requisition
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={cardClass}>
            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {[
                      "Order No",
                      "Finished Product",
                      "BOM Ver",
                      "Planned Qty",
                      "Actual Qty",
                      "Dates",
                      "Warehouse",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th className={tableHeadClass} key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {productionOrders.map((po) => {
                    const bom = boms.find((b) => b.id === po.bomId);
                    return (
                      <tr key={po.id} className="bg-white hover:bg-gray-50">
                        <td className={`${tableCellClass} font-mono font-medium text-gray-800`}>
                          {po.orderNo}
                        </td>
                        <td className={`${tableCellClass} font-medium`}>
                          {items.find((i) => i.id === po.finishedProductId)?.name}
                        </td>
                        <td className={tableCellClass}>v{bom?.version}</td>
                        <td className={tableCellClass}>{po.plannedQty}</td>
                        <td
                          className={`${tableCellClass} font-semibold ${po.actualQty > 0 ? "text-green-700" : ""}`}
                        >
                          {po.actualQty || <span className="text-gray-400 font-normal">-</span>}
                        </td>
                        <td className={tableCellClass}>
                          <div className="flex flex-col gap-0.5 text-[10px]">
                            <span>S: {po.startDate}</span>
                            <span className="text-gray-500">E: {po.endDate}</span>
                          </div>
                        </td>
                        <td className={tableCellClass}>
                          {warehouses.find((w) => w.id === po.warehouseId)?.name || (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className={tableCellClass}>{statusBadge(po.status)}</td>
                        <td className={tableCellClass}>
                          {po.status === "Planned" && (
                            <button
                              className={outlineBtn}
                              onClick={() => updatePOStatus(po, "Released")}
                            >
                              Release Order
                            </button>
                          )}
                          {po.status === "Released" && (
                            <button
                              className={primaryBtn}
                              onClick={() => {
                                setSelectedPO(po);
                                previewIssue(po);
                              }}
                            >
                              Issue Materials
                            </button>
                          )}
                          {po.status === "In-Process" && (
                            <button
                              className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                              onClick={() => setSelectedPO(po)}
                            >
                              Complete Production
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!productionOrders.length && (
                    <tr>
                      <td
                        colSpan={10}
                        className="text-center p-8 text-gray-500 text-[12px] bg-gray-50/50"
                      >
                        No production orders found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedPO && selectedPO.status === "Released" && materialPreview.length > 0 && (
            <div className={`${cardClass} bg-indigo-50/30 border-indigo-100 shadow-md`}>
              <h2 className="text-[14px] font-semibold text-indigo-900 mb-3 border-b border-indigo-100 pb-2">
                Material Issue Preview: {selectedPO.orderNo}
              </h2>

              <div className="overflow-x-auto rounded border border-indigo-100 bg-white shadow-sm mb-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {["Component", "Required", "Available", "Sufficient"].map((h) => (
                        <th className={tableHeadClass} key={h}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {materialPreview.map((m) => (
                      <tr key={m.itemId}>
                        <td className={`${tableCellClass} font-medium`}>{m.itemName}</td>
                        <td className={tableCellClass}>{money(m.required)}</td>
                        <td className={tableCellClass}>{money(m.available)}</td>
                        <td className={tableCellClass}>
                          {m.sufficient ? (
                            <span className="text-green-600 font-semibold text-[11px] flex items-center gap-1">
                              <CheckCircle size={12} /> Yes
                            </span>
                          ) : (
                            <span className="text-red-600 font-semibold text-[11px] flex items-center gap-1">
                              <AlertTriangle size={12} /> No
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <button className={primaryBtn} onClick={() => confirmIssue(selectedPO)}>
                  Confirm & Issue Materials
                </button>
              </div>
            </div>
          )}

          {selectedPO && selectedPO.status === "In-Process" && (
            <div className={`${cardClass} bg-emerald-50/30 border-emerald-100 shadow-md`}>
              <h2 className="text-[14px] font-semibold text-emerald-900 mb-3 border-b border-emerald-100 pb-2">
                Complete Production: {selectedPO.orderNo}
              </h2>
              <div className="flex items-end gap-3 mb-4">
                <div>
                  <label className="block text-[11px] font-medium text-emerald-800 mb-1">
                    Actual Qty Produced
                  </label>
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="Actual Qty"
                    value={actualQty}
                    onChange={(e) => setActualQty(e.target.value)}
                  />
                </div>
                <button
                  className="h-8 px-4 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-[12px] font-medium rounded-md transition-colors"
                  onClick={() => previewComplete(selectedPO)}
                >
                  Preview Completion
                </button>
              </div>

              {completionPreview && (
                <div className="border border-emerald-200 rounded-md p-4 bg-white shadow-sm">
                  <div className="flex items-center gap-6 mb-4 text-[12px]">
                    <div className="flex flex-col">
                      <span className="text-gray-500 font-medium">Standard Cost</span>
                      <span className="text-gray-900 font-bold text-[14px]">
                        Rs. {money(completionPreview.standardCost)}
                      </span>
                    </div>
                    <div className="w-px h-8 bg-gray-200"></div>
                    <div className="flex flex-col">
                      <span className="text-gray-500 font-medium">Actual Cost (Issued)</span>
                      <span className="text-gray-900 font-bold text-[14px]">
                        Rs. {money(completionPreview.issuedCost)}
                      </span>
                    </div>
                    <div className="w-px h-8 bg-gray-200"></div>
                    <div className="flex flex-col">
                      <span className="text-gray-500 font-medium">Variance</span>
                      <span
                        className={`font-bold text-[14px] ${completionPreview.variance > 0 ? "text-red-600" : "text-green-600"}`}
                      >
                        Rs. {money(completionPreview.variance)}{" "}
                        {completionPreview.variance > 0 ? "(Adverse)" : "(Favorable)"}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end pt-3 border-t border-gray-100">
                    <button
                      className="h-8 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                      onClick={confirmComplete}
                    >
                      <CheckCircle size={14} /> Confirm Complete Production
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "Job Work" && (
        <div className="space-y-4">
          <div className={cardClass}>
            <h2 className="text-[14px] font-semibold text-gray-700 mb-4 border-b border-gray-100 pb-2">
              Job Work Out
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Job Worker / Contractor
                </label>
                <select
                  className={inputClass}
                  value={jobForm.jobWorkerId}
                  onChange={(e) => setJobForm({ ...jobForm, jobWorkerId: e.target.value })}
                >
                  <option value="">Select Job Worker</option>
                  {parties
                    .filter(
                      (p) =>
                        String(p.type || "").includes("job-worker") ||
                        String(p.type || "").includes("contractor"),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Date Sent
                </label>
                <input
                  className={inputClass}
                  type="date"
                  value={jobForm.dateSent}
                  onChange={(e) => setJobForm({ ...jobForm, dateSent: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Expected Return
                </label>
                <input
                  className={inputClass}
                  type="date"
                  value={jobForm.expectedReturn}
                  onChange={(e) => setJobForm({ ...jobForm, expectedReturn: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Processing Charges (Est.)
                </label>
                <input
                  className={inputClass}
                  type="number"
                  placeholder="Charges"
                  value={jobForm.processingCharges}
                  onChange={(e) =>
                    setJobForm({ ...jobForm, processingCharges: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[12px] font-semibold text-gray-700 uppercase tracking-wide">
                  Materials Sent
                </h3>
                <button className={outlineBtn} onClick={addJobMaterial}>
                  <Plus size={14} className="text-[#1557b0]" /> Add Material
                </button>
              </div>

              <div className="space-y-2">
                {(jobForm.materials || []).map((m, idx) => (
                  <div
                    key={m.id}
                    className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center bg-white p-2 border border-gray-200 rounded shadow-sm"
                  >
                    <select
                      className={inputClass}
                      value={m.itemId}
                      onChange={(e) => updateJobMaterial(idx, { itemId: e.target.value })}
                    >
                      <option value="">Select Item</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                        Qty:
                      </span>
                      <input
                        className={`${inputClass} pl-8`}
                        type="number"
                        value={m.qty}
                        onChange={(e) => updateJobMaterial(idx, { qty: Number(e.target.value) })}
                      />
                    </div>
                    <input
                      className={`${inputClass} bg-gray-50 text-gray-500`}
                      value={m.unit}
                      readOnly
                      placeholder="Unit"
                    />
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                        Rate:
                      </span>
                      <input
                        className={`${inputClass} pl-9`}
                        type="number"
                        value={m.rate}
                        onChange={(e) => updateJobMaterial(idx, { rate: Number(e.target.value) })}
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        onClick={() => removeJobMaterial(idx)}
                        title="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {(!jobForm.materials || jobForm.materials.length === 0) && (
                  <div className="text-center p-4 border border-dashed border-gray-300 rounded bg-white text-[12px] text-gray-500">
                    No materials added yet.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button className={primaryBtn} onClick={saveJobOut}>
                <Save size={14} /> Save Job Work Out
              </button>
            </div>
          </div>

          <div className={`${cardClass} bg-green-50/30 border-green-100`}>
            <h2 className="text-[14px] font-semibold text-green-900 mb-4 border-b border-green-100 pb-2">
              Job Work In (Receive)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-medium text-green-800 mb-1">
                  Select Open Job
                </label>
                <select
                  className={inputClass}
                  value={returnJobId}
                  onChange={(e) => setReturnJobId(e.target.value)}
                >
                  <option value="">-- Open Jobs --</option>
                  {jobWorkOrders
                    .filter((j) => j.status === "open")
                    .map((j) => (
                      <option key={j.id} value={j.id}>
                        {parties.find((p) => p.id === j.jobWorkerId)?.name} - Sent: {j.dateSent}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-green-800 mb-1">
                  Finished Goods Received
                </label>
                <select
                  className={inputClass}
                  value={returnItemId}
                  onChange={(e) => setReturnItemId(e.target.value)}
                >
                  <option value="">-- Select Item --</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-green-800 mb-1">
                  Qty Received
                </label>
                <input
                  className={inputClass}
                  type="number"
                  placeholder="0"
                  value={returnQty}
                  onChange={(e) => setReturnQty(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-green-800 mb-1">
                  Actual Processing Charges Paid
                </label>
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="0.00"
                    value={returnCharges}
                    onChange={(e) => setReturnCharges(e.target.value)}
                  />
                  <button
                    className="h-8 px-4 bg-green-600 hover:bg-green-700 text-white text-[12px] font-medium rounded-md transition-colors whitespace-nowrap"
                    onClick={markJobReturn}
                  >
                    Mark Received
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="text-[14px] font-semibold text-gray-700 mb-4 border-b border-gray-100 pb-2">
              Outstanding Job Work
            </h2>

            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {[
                      "Worker",
                      "Materials Sent",
                      "Date Sent",
                      "Expected Return",
                      "Days Outstanding",
                      "Action",
                    ].map((h) => (
                      <th className={tableHeadClass} key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {jobWorkOrders
                    .filter((j) => j.status === "open")
                    .map((j) => {
                      const overdue = todayISO() > j.expectedReturn;
                      const days = Math.max(
                        0,
                        Math.floor((Date.now() - new Date(j.dateSent).getTime()) / 86400000),
                      );

                      return (
                        <tr
                          key={j.id}
                          className={`bg-white hover:bg-gray-50 ${overdue ? "bg-red-50/30" : ""}`}
                        >
                          <td className={`${tableCellClass} font-medium`}>
                            {parties.find((p) => p.id === j.jobWorkerId)?.name}
                          </td>
                          <td className={tableCellClass}>
                            <span
                              className="text-[11px] text-gray-600 truncate max-w-[200px] block"
                              title={(j.materials || []).map((m) => m.itemName).join(", ")}
                            >
                              {(j.materials || []).map((m) => m.itemName).join(", ")}
                            </span>
                          </td>
                          <td className={tableCellClass}>{j.dateSent}</td>
                          <td className={tableCellClass}>
                            <span className={overdue ? "text-red-600 font-semibold" : ""}>
                              {j.expectedReturn}
                            </span>
                          </td>
                          <td className={tableCellClass}>
                            {days > 0 ? (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${overdue ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}
                              >
                                {days} Days
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className={tableCellClass}>
                            <button
                              className="text-[11px] font-medium text-[#1557b0] hover:underline flex items-center gap-1"
                              onClick={() => {
                                setReturnJobId(j.id);
                                document
                                  .querySelector(".bg-green-50\\/30")
                                  ?.scrollIntoView({ behavior: "smooth" });
                              }}
                            >
                              <CheckCircle size={12} /> Receive
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  {!jobWorkOrders.filter((j) => j.status === "open").length && (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center p-8 text-gray-500 text-[12px] bg-gray-50/50"
                      >
                        No outstanding job work records.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Production Cost Sheet" && (
        <div className={cardClass}>
          <div className="mb-6 max-w-md">
            <label className="block text-[11px] font-medium text-gray-600 mb-1">
              Select Completed Production Order
            </label>
            <select
              className={inputClass}
              value={selectedCostPO}
              onChange={(e) => setSelectedCostPO(e.target.value)}
            >
              <option value="">-- Choose Order --</option>
              {productionOrders
                .filter((p) => p.status === "Completed")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.orderNo}
                  </option>
                ))}
            </select>
          </div>

          {costSheet ? (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-md border border-gray-200 shadow-sm">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {[
                        "Component",
                        "Standard Qty",
                        "Actual Qty",
                        "Qty Var",
                        "Std Rate",
                        "Actual Rate",
                        "Rate Var",
                        "Std Cost",
                        "Actual Cost",
                        "Total Variance",
                      ].map((h) => (
                        <th className={tableHeadClass} key={h}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {costSheet.rows.map((r, idx) => (
                      <tr key={idx} className="bg-white hover:bg-gray-50">
                        <td className={`${tableCellClass} font-medium`}>{r.component}</td>
                        <td className={tableCellClass}>{money(r.stdQty)}</td>
                        <td className={tableCellClass}>{money(r.actualQty)}</td>
                        <td
                          className={`${tableCellClass} ${r.qtyVar !== 0 ? (r.qtyVar > 0 ? "text-red-600" : "text-green-600") : ""}`}
                        >
                          {money(r.qtyVar)}
                        </td>
                        <td className={tableCellClass}>{money(r.stdRate)}</td>
                        <td className={tableCellClass}>{money(r.actualRate)}</td>
                        <td
                          className={`${tableCellClass} ${r.rateVar !== 0 ? (r.rateVar > 0 ? "text-red-600" : "text-green-600") : ""}`}
                        >
                          {money(r.rateVar)}
                        </td>
                        <td className={tableCellClass}>{money(r.stdCost)}</td>
                        <td className={tableCellClass}>{money(r.actualCost)}</td>
                        <td
                          className={`${tableCellClass} font-semibold ${r.variance > 0 ? "text-red-600" : "text-green-600"}`}
                        >
                          {money(r.variance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex gap-8">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-gray-500 tracking-wide">
                      Total Standard Cost
                    </span>
                    <span className="text-[16px] font-bold text-gray-800">
                      Rs. {money(costSheet.standardCost)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-gray-500 tracking-wide">
                      Total Actual Cost
                    </span>
                    <span className="text-[16px] font-bold text-gray-800">
                      Rs. {money(costSheet.actualCost)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[11px] font-medium text-gray-500 tracking-wide">
                    Net Variance
                  </span>
                  <span
                    className={`text-[18px] font-black ${costSheet.variance > 0 ? "text-red-600" : "text-green-600"}`}
                  >
                    Rs. {money(costSheet.variance)}
                    <span className="text-[12px] font-semibold ml-2 bg-white px-2 py-0.5 rounded border border-current">
                      {costSheet.variance > 0 ? "Adverse" : "Favorable"}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-10 border border-dashed border-gray-300 rounded-lg bg-gray-50 flex flex-col items-center justify-center text-gray-500 text-center">
              <BarChart2 size={32} className="mb-3 text-gray-400" />
              <p className="text-[13px] font-medium text-gray-700">No Cost Sheet Selected</p>
              <p className="text-[11px] mt-1 max-w-sm">
                Select a completed production order above to view its detailed cost and variance
                analysis.
              </p>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      <Modal
        open={bomModal}
        title={editingBom ? "Edit Bill of Materials" : "Create Bill of Materials"}
        onClose={() => setBomModal(false)}
        wide
      >
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-4">
          <h3 className="text-[12px] font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Master Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Finished Product
              </label>
              <select
                className={inputClass}
                value={bomForm.finishedProductId}
                onChange={(e) => setBomForm({ ...bomForm, finishedProductId: e.target.value })}
              >
                <option value="">Select Finished Product</option>
                {items
                  .filter((i) => i.type !== "raw-material")
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                BOM Name (Optional)
              </label>
              <input
                className={inputClass}
                placeholder="e.g. Standard Recipe v1"
                value={bomForm.name}
                onChange={(e) => setBomForm({ ...bomForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Output Qty (Batch Size)
              </label>
              <input
                className={inputClass}
                type="number"
                value={bomForm.outputQty}
                onChange={(e) => setBomForm({ ...bomForm, outputQty: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Version</label>
              <input
                className={inputClass}
                value={bomForm.version}
                onChange={(e) => setBomForm({ ...bomForm, version: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Status</label>
              <select
                className={inputClass}
                value={bomForm.status}
                onChange={(e) => setBomForm({ ...bomForm, status: e.target.value })}
              >
                <option>Draft</option>
                <option>Active</option>
                <option>Obsolete</option>
              </select>
            </div>
            <div className="md:col-span-4">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Notes / Instructions
              </label>
              <textarea
                className={`${inputClass} h-auto py-2`}
                rows={2}
                placeholder="Production instructions, routing notes, etc."
                value={bomForm.notes}
                onChange={(e) => setBomForm({ ...bomForm, notes: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 bg-blue-50/50 p-3 rounded-md border border-blue-100">
          <div className="flex items-center gap-3">
            <h3 className="text-[13px] font-semibold text-blue-900">Components / Raw Materials</h3>
          </div>
          <div className="flex gap-2">
            <button className={outlineBtn} onClick={addBomComponent}>
              <Plus size={14} className="text-[#1557b0]" /> Add Component
            </button>
            <button className={outlineBtn} onClick={calculateRollup}>
              <BarChart2 size={14} className="text-emerald-600" /> Cost Roll-up
            </button>
            <button className={primaryBtn} onClick={saveBom}>
              <Save size={14} /> Save BOM
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="w-full border-collapse">
            <thead className="bg-[#f5f6fa]">
              <tr>
                {[
                  "Item",
                  "Item Name",
                  "Unit",
                  "Required Qty",
                  "Wastage %",
                  "Net Qty",
                  "Std Rate (NPR)",
                  "Line Cost",
                  "Action",
                ].map((h) => (
                  <th key={h} className={tableHeadClass}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(bomForm.components || []).map((c, idx) => {
                const netQty = Number(c.qty || 0) * (1 + Number(c.wastage || 0) / 100);
                const lineCost = netQty * Number(c.rate || 0);

                return (
                  <tr key={c.id || idx} className="bg-white hover:bg-gray-50">
                    <td className={tableCellClass}>
                      <select
                        className={`${inputClass} w-32`}
                        value={c.itemId}
                        onChange={(e) => updateBomComponent(idx, { itemId: e.target.value })}
                      >
                        <option value="">-- Item --</option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`${tableCellClass} font-medium`}>
                      {c.itemName || <span className="text-gray-400 italic">Select item</span>}
                    </td>
                    <td className={tableCellClass}>{c.unit}</td>
                    <td className={tableCellClass}>
                      <input
                        className={`${inputClass} w-20 font-semibold text-center`}
                        type="number"
                        value={c.qty}
                        onChange={(e) => updateBomComponent(idx, { qty: Number(e.target.value) })}
                      />
                    </td>
                    <td className={tableCellClass}>
                      <input
                        className={`${inputClass} w-16 text-center`}
                        type="number"
                        value={c.wastage}
                        onChange={(e) =>
                          updateBomComponent(idx, { wastage: Number(e.target.value) })
                        }
                      />
                    </td>
                    <td className={`${tableCellClass} font-medium text-indigo-700`}>
                      {money(netQty)}
                    </td>
                    <td className={tableCellClass}>
                      <input
                        className={`${inputClass} w-24`}
                        type="number"
                        value={c.rate}
                        onChange={(e) => updateBomComponent(idx, { rate: Number(e.target.value) })}
                      />
                    </td>
                    <td className={`${tableCellClass} font-semibold text-gray-900`}>
                      {money(lineCost)}
                    </td>
                    <td className={tableCellClass}>
                      <button
                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                        onClick={() => removeBomComponent(idx)}
                        title="Remove Component"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {(!bomForm.components || bomForm.components.length === 0) && (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center p-8 text-gray-500 text-[12px] bg-gray-50/50 border-b border-gray-100"
                  >
                    No components added. Click "Add Component" above.
                  </td>
                </tr>
              )}

              <tr className="bg-blue-50/30">
                <td
                  className={`${tableCellClass} font-bold text-right text-gray-700 uppercase tracking-wide`}
                  colSpan={7}
                >
                  Total Standard Cost:
                </td>
                <td
                  className={`${tableCellClass} font-bold text-[14px] text-[#1557b0]`}
                  colSpan={2}
                >
                  Rs. {money(totalStandardCost)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
