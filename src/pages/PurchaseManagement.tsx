// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "@/lib/appToast";
import { Plus, Edit, Trash2, CheckCircle, Star, CheckSquare, XCircle } from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const PurchaseManagement: React.FC = () => {
  const { parties, items, purchaseOrders, vouchers, addPurchaseOrder } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [activeTab, setActiveTab] = useState(0);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);

  const [showRfqForm, setShowRfqForm] = useState(false);
  const [showReqForm, setShowReqForm] = useState(false);

  const [editingRfq, setEditingRfq] = useState<any>(null);
  const [editingReq, setEditingReq] = useState<any>(null);

  const [expandedRfq, setExpandedRfq] = useState<string | null>(null);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  const [rfqForm, setRfqForm] = useState({
    rfqNo: "",
    date: new Date().toISOString().split("T")[0],
    requiredByDate: "",
    suppliers: [] as string[],
    items: [{ id: generateId(), itemId: "", description: "", quantity: 0, unit: "", remarks: "" }],
  });

  const [reqForm, setReqForm] = useState({
    requesterName: "",
    department: "",
    dateRequired: "",
    items: [{ id: generateId(), itemId: "", quantity: 0, purpose: "" }],
    status: "draft",
  });

  // Load data from DB
  useEffect(() => {
    const db = getDB();
    db.table("rfqs")
      .toArray()
      .then(setRfqs)
      .catch(() => setRfqs([]));
    db.table("requisitions")
      .toArray()
      .then(setRequisitions)
      .catch(() => setRequisitions([]));
  }, []);

  // Suppliers
  const suppliers = useMemo(() => {
    return parties.filter(
      (p) =>
        (p.type === "supplier" || p.type === "both") &&
        matchBranch((p as { branchId?: string }).branchId),
    );
  }, [parties, matchBranch, branchFilter]);

  const scopedRfqs = useMemo(
    () => rfqs.filter((r) => matchBranch(r.branchId)),
    [rfqs, matchBranch, branchFilter],
  );

  const scopedPurchaseOrders = useMemo(
    () => (purchaseOrders || []).filter((po: any) => matchBranch(po.branchId)),
    [purchaseOrders, matchBranch, branchFilter],
  );

  // Items
  const itemOptions = useMemo(() => {
    return items.filter((i) => i.isActive);
  }, [items]);

  // Generate RFQ number
  const generateRfqNo = () => {
    const bsYear = "2081";
    const count = rfqs.length + 1;
    return `RFQ-${bsYear}-${count.toString().padStart(3, "0")}`;
  };

  // Handle RFQ form changes
  const handleRfqFormChange = (field: string, value: any) => {
    if (field === "suppliers") {
      setRfqForm((prev) => ({
        ...prev,
        suppliers: Array.isArray(value) ? value : [value],
      }));
    } else {
      setRfqForm((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Handle RFQ item changes
  const handleRfqItemChange = (index: number, field: string, value: any) => {
    setRfqForm((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };

      if (field === "itemId") {
        const item = itemOptions.find((i) => i.id === value);
        if (item) {
          newItems[index].unit = item.unit || "Pcs";
          if (!newItems[index].description) {
            newItems[index].description = item.name;
          }
        }
      }

      return { ...prev, items: newItems };
    });
  };

  const addRfqItemRow = () => {
    setRfqForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { id: generateId(), itemId: "", description: "", quantity: 0, unit: "", remarks: "" },
      ],
    }));
  };

  const removeRfqItemRow = (index: number) => {
    if (rfqForm.items.length > 1) {
      setRfqForm((prev) => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      }));
    }
  };

  const saveRfq = async () => {
    if (
      !rfqForm.date ||
      !rfqForm.requiredByDate ||
      rfqForm.suppliers.length === 0 ||
      rfqForm.items.length === 0
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    const db = getDB();
    const rfqRecord = {
      id: editingRfq?.id || generateId(),
      ...rfqForm,
      branchId: editingRfq?.branchId || readActiveBranchId() || undefined,
      status: "open",
      responses: editingRfq?.responses || [],
      createdAt: editingRfq?.createdAt || new Date().toISOString(),
    };

    try {
      await db.table("rfqs").put(rfqRecord);
      if (editingRfq) {
        setRfqs((prev) => prev.map((r) => (r.id === rfqRecord.id ? rfqRecord : r)));
      } else {
        setRfqs((prev) => [...prev, rfqRecord]);
      }
      setShowRfqForm(false);
      setEditingRfq(null);
      setRfqForm({
        rfqNo: generateRfqNo(),
        date: new Date().toISOString().split("T")[0],
        requiredByDate: "",
        suppliers: [],
        items: [
          { id: generateId(), itemId: "", description: "", quantity: 0, unit: "", remarks: "" },
        ],
      });
      toast.success("RFQ saved successfully");
    } catch (error) {
      toast.error("Failed to save RFQ");
    }
  };

  const handleReqFormChange = (field: string, value: any) => {
    setReqForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleReqItemChange = (index: number, field: string, value: any) => {
    setReqForm((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const addReqItemRow = () => {
    setReqForm((prev) => ({
      ...prev,
      items: [...prev.items, { id: generateId(), itemId: "", quantity: 0, purpose: "" }],
    }));
  };

  const removeReqItemRow = (index: number) => {
    if (reqForm.items.length > 1) {
      setReqForm((prev) => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      }));
    }
  };

  const saveRequisition = async () => {
    if (
      !reqForm.requesterName ||
      !reqForm.department ||
      !reqForm.dateRequired ||
      reqForm.items.length === 0
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    const db = getDB();
    const reqRecord = {
      id: editingReq?.id || generateId(),
      ...reqForm,
      status: reqForm.status || "draft",
      createdAt: editingReq?.createdAt || new Date().toISOString(),
    };

    try {
      await db.table("requisitions").put(reqRecord);
      if (editingReq) {
        setRequisitions((prev) => prev.map((r) => (r.id === reqRecord.id ? reqRecord : r)));
      } else {
        setRequisitions((prev) => [...prev, reqRecord]);
      }
      setShowReqForm(false);
      setEditingReq(null);
      setReqForm({
        requesterName: "",
        department: "",
        dateRequired: "",
        items: [{ id: generateId(), itemId: "", quantity: 0, purpose: "" }],
        status: "draft",
      });
      toast.success("Requisition saved successfully");
    } catch (error) {
      toast.error("Failed to save requisition");
    }
  };

  const approveRequisition = async (id: string) => {
    const db = getDB();
    try {
      await db.table("requisitions").update(id, { status: "approved" });
      setRequisitions((prev) => prev.map((r) => (r.id === id ? { ...r, status: "approved" } : r)));
      toast.success("Requisition approved");
    } catch {
      toast.error("Failed to approve requisition");
    }
  };

  const convertRfqToPo = (rfq: any) => {
    if (!rfq.suppliers || rfq.suppliers.length === 0) {
      toast.error("No suppliers attached to this RFQ");
      return;
    }
    const bestSupplier = rfq.suppliers[0];
    const po = {
      id: generateId(),
      poNo: `PO-${rfq.rfqNo.substring(4)}`,
      date: new Date().toISOString().split("T")[0],
      partyId: bestSupplier,
      items: rfq.items.map((i: any) => ({ ...i, rate: 0, taxRate: 0 })),
      totalAmount: 0,
      status: "pending",
      rfqId: rfq.id,
      deliveryDate: rfq.requiredByDate,
      branchId: rfq.branchId || readActiveBranchId() || undefined,
    };

    if (addPurchaseOrder) {
      addPurchaseOrder(po);
    } else {
      const db = getDB();
      db.table("purchaseOrders")
        .add(po)
        .catch(() => {});
    }

    const db = getDB();
    db.table("rfqs")
      .update(rfq.id, { status: "converted" })
      .then(() => {
        setRfqs((prev) => prev.map((r) => (r.id === rfq.id ? { ...r, status: "converted" } : r)));
      });

    toast.success("RFQ converted to Purchase Order");
  };

  const threeWayMatches = useMemo(() => {
    const purchaseInvoices = vouchers.filter(
      (v) => v.type === "purchase-invoice" && matchBranch((v as { branchId?: string }).branchId),
    );
    return purchaseInvoices.map((invoice) => {
      const po = scopedPurchaseOrders.find((po) => po.id === invoice.purchaseOrderId);
      const grn = vouchers.find((v) => v.id === invoice.grnId);
      const status = getMatchingStatus(invoice, po, grn);
      return { invoice, po, grn, status };
    });
  }, [vouchers, scopedPurchaseOrders, matchBranch, branchFilter]);

  function getMatchingStatus(invoice: any, po: any, grn: any) {
    if (!grn) return "Missing GRN";
    if (!po) return "Missing PO";

    const invoiceTotal = invoice.totalAmount || invoice.grandTotal || 0;
    const poTotal = po.totalAmount || 0;
    const priceDiff = poTotal > 0 ? Math.abs((invoiceTotal - poTotal) / poTotal) : 0;

    if (priceDiff > 0.02) return "Price Variance";

    const grnQty = grn.lines?.reduce((s: number, l: any) => s + (l.quantity || 0), 0) || 0;
    const invQty = invoice.lines?.reduce((s: number, l: any) => s + (l.quantity || 0), 0) || 0;

    if (grnQty !== invQty) return "Qty Variance";

    return "Matched";
  }

  const vendorScores = useMemo(() => {
    const supplierList = parties.filter(
      (p) => p.type === "supplier" && matchBranch((p as { branchId?: string }).branchId),
    );

    return supplierList
      .map((supplier) => {
        const supplierOrders = scopedPurchaseOrders.filter((po) => po.partyId === supplier.id);
        const totalOrders = supplierOrders.length;

        let onTimeDeliveries = 0;
        let totalDeliveries = 0;

        supplierOrders.forEach((order) => {
          const grn = vouchers.find(
            (v) => v.purchaseOrderId === order.id && v.type === "goods-receipt-note",
          );
          if (grn) {
            totalDeliveries++;
            const orderDate = new Date(order.deliveryDate || order.date);
            const receiptDate = new Date(grn.date);
            if (receiptDate <= orderDate) {
              onTimeDeliveries++;
            }
          }
        });

        const onTimeDelivery =
          totalDeliveries > 0
            ? (onTimeDeliveries / totalDeliveries) * 100
            : totalOrders > 0
              ? 50
              : 0;

        const returnVouchers = vouchers.filter(
          (v) => v.partyId === supplier.id && v.type === "purchase-return",
        );
        const qualityScore = Math.max(0, 100 - returnVouchers.length * 10);
        const priceCompetitiveness = 80;
        const overallScore =
          totalOrders === 0
            ? 0
            : onTimeDelivery * 0.4 + qualityScore * 0.35 + priceCompetitiveness * 0.25;

        return {
          supplier,
          totalOrders,
          onTimeDelivery,
          qualityScore,
          priceCompetitiveness,
          overallScore,
        };
      })
      .filter((s) => s.totalOrders > 0)
      .sort((a, b) => b.overallScore - a.overallScore);
  }, [parties, scopedPurchaseOrders, vouchers, matchBranch, branchFilter]);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "matched":
      case "approved":
      case "converted":
        return (
          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide">
            {status}
          </span>
        );
      case "price variance":
      case "qty variance":
      case "submitted":
        return (
          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide">
            {status}
          </span>
        );
      case "missing grn":
      case "missing po":
      case "rejected":
        return (
          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide">
            {status}
          </span>
        );
      default:
        return (
          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4">
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Purchase Management</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Manage RFQs, Requisitions, Three-Way Matching, and Vendor Scoring
            </p>
          </div>
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
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4 bg-white px-2 pt-2 rounded-t-md shadow-sm">
          {["RFQ", "Purchase Requisition", "Three-Way Matching", "Vendor Scorecard"].map(
            (tab, index) => (
              <button
                key={index}
                className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors ${
                  activeTab === index
                    ? "border-[var(--ds-action-primary)] text-[var(--ds-action-primary)]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={() => setActiveTab(index)}
              >
                {tab}
              </button>
            ),
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 0 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-semibold text-gray-800">
                Request for Quotation (RFQ)
              </h2>
              <button
                className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
                onClick={() => {
                  setEditingRfq(null);
                  setRfqForm({
                    rfqNo: generateRfqNo(),
                    date: new Date().toISOString().split("T")[0],
                    requiredByDate: "",
                    suppliers: [],
                    items: [
                      {
                        id: generateId(),
                        itemId: "",
                        description: "",
                        quantity: 0,
                        unit: "",
                        remarks: "",
                      },
                    ],
                  });
                  setShowRfqForm(true);
                }}
              >
                <Plus size={14} />
                New RFQ
              </button>
            </div>

            {showRfqForm && (
              <div className="mb-6 bg-white border border-gray-200 shadow-sm rounded-md p-4">
                <h3 className="text-[14px] font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                  {editingRfq ? "Edit RFQ" : "Create New RFQ"}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      RFQ Number
                    </label>
                    <input
                      type="text"
                      value={rfqForm.rfqNo}
                      readOnly
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-gray-50 focus:outline-none w-full text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Date</label>
                    <input
                      type="date"
                      value={rfqForm.date}
                      onChange={(e) => handleRfqFormChange("date", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Required By Date
                    </label>
                    <input
                      type="date"
                      value={rfqForm.requiredByDate}
                      onChange={(e) => handleRfqFormChange("requiredByDate", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-[11px] font-medium text-gray-600 mb-2">
                    Select Suppliers
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3 bg-gray-50 border border-gray-200 rounded-md max-h-40 overflow-y-auto">
                    {suppliers.map((supplier) => (
                      <label
                        key={supplier.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={rfqForm.suppliers.includes(supplier.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleRfqFormChange("suppliers", [...rfqForm.suppliers, supplier.id]);
                            } else {
                              handleRfqFormChange(
                                "suppliers",
                                rfqForm.suppliers.filter((id: string) => id !== supplier.id),
                              );
                            }
                          }}
                          className="h-3.5 w-3.5 text-[var(--ds-action-primary)] rounded border-gray-300 focus:ring-[var(--ds-action-primary)]"
                        />
                        <span className="text-[12px] text-gray-700">{supplier.name}</span>
                      </label>
                    ))}
                    {suppliers.length === 0 && (
                      <span className="text-[12px] text-gray-500">No suppliers available.</span>
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[12px] font-semibold text-gray-800">Items</label>
                    <button
                      type="button"
                      className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded hover:bg-gray-50 transition-colors shadow-sm"
                      onClick={addRfqItemRow}
                    >
                      Add Item
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <table className="w-full min-w-max border-collapse">
                      <thead>
                        <tr className="bg-[#f5f6fa] border-b border-gray-200">
                          <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                            Item
                          </th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                            Description
                          </th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">
                            Quantity
                          </th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">
                            Unit
                          </th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                            Remarks
                          </th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-12">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rfqForm.items.map((item, index) => (
                          <tr key={item.id} className="bg-white border-b border-gray-100">
                            <td className="px-3 py-2 align-top">
                              <select
                                value={item.itemId}
                                onChange={(e) =>
                                  handleRfqItemChange(index, "itemId", e.target.value)
                                }
                                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                              >
                                <option value="">Select Item</option>
                                {itemOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.code} - {opt.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) =>
                                  handleRfqItemChange(index, "description", e.target.value)
                                }
                                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <input
                                type="number"
                                value={item.quantity || ""}
                                onChange={(e) =>
                                  handleRfqItemChange(
                                    index,
                                    "quantity",
                                    Number(e.target.value) || 0,
                                  )
                                }
                                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white text-right focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <input
                                type="text"
                                value={item.unit}
                                readOnly
                                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-gray-50 text-gray-500 focus:outline-none w-full"
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <input
                                type="text"
                                value={item.remarks}
                                onChange={(e) =>
                                  handleRfqItemChange(index, "remarks", e.target.value)
                                }
                                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                              />
                            </td>
                            <td className="px-3 py-2 align-top text-center">
                              <button
                                type="button"
                                className="h-8 w-8 inline-flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                onClick={() => removeRfqItemRow(index)}
                                disabled={rfqForm.items.length <= 1}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button
                    className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
                    onClick={() => setShowRfqForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="h-8 px-4 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md transition-colors shadow-sm"
                    onClick={saveRfq}
                  >
                    Save RFQ
                  </button>
                </div>
              </div>
            )}

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      RFQ No
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Date
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Items
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Suppliers Invited
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Responses
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scopedRfqs.map((rfq) => (
                    <React.Fragment key={rfq.id}>
                      <tr
                        className="bg-white hover:bg-gray-50 border-b border-gray-100 text-[12px] cursor-pointer transition-colors"
                        onClick={() => setExpandedRfq(expandedRfq === rfq.id ? null : rfq.id)}
                      >
                        <td className="px-3 py-2.5 text-gray-800 font-medium">{rfq.rfqNo}</td>
                        <td className="px-3 py-2.5 text-gray-700">{rfq.date}</td>
                        <td className="px-3 py-2.5 text-gray-700 text-right">{rfq.items.length}</td>
                        <td className="px-3 py-2.5 text-gray-700 text-right">
                          {rfq.suppliers.length}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 text-right">
                          {rfq.responses?.length || 0}
                        </td>
                        <td className="px-3 py-2.5 text-center">{getStatusBadge(rfq.status)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="text-[var(--ds-action-primary)] hover:text-[var(--ds-action-primary-hover)] transition-colors p-1"
                              title="Edit"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingRfq(rfq);
                                setRfqForm({
                                  rfqNo: rfq.rfqNo,
                                  date: rfq.date,
                                  requiredByDate: rfq.requiredByDate,
                                  suppliers: rfq.suppliers,
                                  items: rfq.items,
                                });
                                setShowRfqForm(true);
                              }}
                            >
                              <Edit size={14} />
                            </button>
                            {rfq.status !== "converted" && (
                              <button
                                className="text-green-600 hover:text-green-700 transition-colors p-1"
                                title="Convert to PO"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  convertRfqToPo(rfq);
                                }}
                              >
                                <CheckSquare size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {expandedRfq === rfq.id && (
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <td colSpan={7} className="p-4">
                            <h4 className="text-[12px] font-semibold text-gray-800 mb-3">
                              Comparative Statement
                            </h4>
                            <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
                              <table className="w-full min-w-max border-collapse">
                                <thead>
                                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                                      Item
                                    </th>
                                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                                      Qty
                                    </th>
                                    {rfq.suppliers.map((supplierId: string) => {
                                      const supplier = suppliers.find((s) => s.id === supplierId);
                                      return (
                                        <th
                                          key={supplierId}
                                          className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                                        >
                                          {supplier?.name || "Supplier"}
                                        </th>
                                      );
                                    })}
                                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                                      Lowest Rate
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-48">
                                      Selected Supplier
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rfq.items.map((item: any, idx: number) => (
                                    <tr key={idx} className="border-b border-gray-100">
                                      <td className="px-3 py-2 text-[12px] text-gray-700">
                                        {item.description}
                                      </td>
                                      <td className="px-3 py-2 text-[12px] text-gray-700 text-right">
                                        {item.quantity}
                                      </td>
                                      {rfq.suppliers.map((supplierId: string) => {
                                        return (
                                          <td key={supplierId} className="px-3 py-2 align-top">
                                            <input
                                              type="number"
                                              step="0.01"
                                              placeholder="Quote"
                                              className="h-7 px-2 text-[11px] border border-gray-300 rounded bg-white text-right focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)] w-full"
                                            />
                                          </td>
                                        );
                                      })}
                                      <td className="px-3 py-2 text-[12px] text-gray-700 text-right">
                                        —
                                      </td>
                                      <td className="px-3 py-2 align-top">
                                        <select className="h-7 px-2 text-[11px] border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)] w-full">
                                          <option value="">Select</option>
                                          {rfq.suppliers.map((supplierId: string) => {
                                            const supplier = suppliers.find(
                                              (s) => s.id === supplierId,
                                            );
                                            return (
                                              <option key={supplierId} value={supplierId}>
                                                {supplier?.name}
                                              </option>
                                            );
                                          })}
                                        </select>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {scopedRfqs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No RFQs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-semibold text-gray-800">Purchase Requisitions</h2>
              <button
                className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
                onClick={() => {
                  setEditingReq(null);
                  setReqForm({
                    requesterName: "",
                    department: "",
                    dateRequired: "",
                    items: [{ id: generateId(), itemId: "", quantity: 0, purpose: "" }],
                    status: "draft",
                  });
                  setShowReqForm(true);
                }}
              >
                <Plus size={14} />
                New Requisition
              </button>
            </div>

            {showReqForm && (
              <div className="mb-6 bg-white border border-gray-200 shadow-sm rounded-md p-4">
                <h3 className="text-[14px] font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                  {editingReq ? "Edit Requisition" : "Create New Requisition"}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Requester Name
                    </label>
                    <input
                      type="text"
                      value={reqForm.requesterName}
                      onChange={(e) => handleReqFormChange("requesterName", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={reqForm.department}
                      onChange={(e) => handleReqFormChange("department", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Date Required
                    </label>
                    <input
                      type="date"
                      value={reqForm.dateRequired}
                      onChange={(e) => handleReqFormChange("dateRequired", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[12px] font-semibold text-gray-800">Items</label>
                    <button
                      type="button"
                      className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded hover:bg-gray-50 transition-colors shadow-sm"
                      onClick={addReqItemRow}
                    >
                      Add Item
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <table className="w-full min-w-max border-collapse">
                      <thead>
                        <tr className="bg-[#f5f6fa] border-b border-gray-200">
                          <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                            Item
                          </th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                            Quantity
                          </th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                            Purpose
                          </th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-12">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {reqForm.items.map((item, index) => (
                          <tr key={item.id} className="bg-white border-b border-gray-100">
                            <td className="px-3 py-2 align-top">
                              <select
                                value={item.itemId}
                                onChange={(e) =>
                                  handleReqItemChange(index, "itemId", e.target.value)
                                }
                                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                              >
                                <option value="">Select Item</option>
                                {itemOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.code} - {opt.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <input
                                type="number"
                                value={item.quantity || ""}
                                onChange={(e) =>
                                  handleReqItemChange(
                                    index,
                                    "quantity",
                                    Number(e.target.value) || 0,
                                  )
                                }
                                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white text-right focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <input
                                type="text"
                                value={item.purpose}
                                onChange={(e) =>
                                  handleReqItemChange(index, "purpose", e.target.value)
                                }
                                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                              />
                            </td>
                            <td className="px-3 py-2 align-top text-center">
                              <button
                                type="button"
                                className="h-8 w-8 inline-flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                onClick={() => removeReqItemRow(index)}
                                disabled={reqForm.items.length <= 1}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button
                    className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
                    onClick={() => setShowReqForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="h-8 px-4 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md transition-colors shadow-sm"
                    onClick={saveRequisition}
                  >
                    Save Requisition
                  </button>
                </div>
              </div>
            )}

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Req No
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Date
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Department
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Requester
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Items
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requisitions.map((req) => (
                    <tr
                      key={req.id}
                      className="bg-white hover:bg-gray-50 border-b border-gray-100 text-[12px] transition-colors"
                    >
                      <td className="px-3 py-2.5 text-gray-800 font-medium">
                        {req.id.substring(0, 8)}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">
                        {req.createdAt ? new Date(req.createdAt).toISOString().split("T")[0] : ""}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">{req.department}</td>
                      <td className="px-3 py-2.5 text-gray-700">{req.requesterName}</td>
                      <td className="px-3 py-2.5 text-gray-700 text-right">{req.items.length}</td>
                      <td className="px-3 py-2.5 text-center">{getStatusBadge(req.status)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="text-[var(--ds-action-primary)] hover:text-[var(--ds-action-primary-hover)] transition-colors p-1"
                            title="Edit"
                            onClick={() => {
                              setEditingReq(req);
                              setReqForm({
                                requesterName: req.requesterName,
                                department: req.department,
                                dateRequired: req.dateRequired,
                                items: req.items,
                                status: req.status,
                              });
                              setShowReqForm(true);
                            }}
                          >
                            <Edit size={14} />
                          </button>
                          {(req.status === "draft" || req.status === "submitted") && (
                            <button
                              className="text-green-600 hover:text-green-700 transition-colors p-1"
                              title="Approve"
                              onClick={() => approveRequisition(req.id)}
                            >
                              <CheckCircle size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {requisitions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No requisitions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <h2 className="text-[14px] font-semibold text-gray-800 mb-4">Three-Way Matching</h2>

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Invoice No
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Supplier
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Date
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Invoice Amt
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      PO No
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      PO Amt
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      GRN No
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {threeWayMatches.map((match) => {
                    const supplier = parties.find((p) => p.id === match.invoice.partyId);
                    return (
                      <React.Fragment key={match.invoice.id}>
                        <tr
                          className="bg-white hover:bg-gray-50 border-b border-gray-100 text-[12px] cursor-pointer transition-colors"
                          onClick={() =>
                            setExpandedInvoice(
                              expandedInvoice === match.invoice.id ? null : match.invoice.id,
                            )
                          }
                        >
                          <td className="px-3 py-2.5 text-gray-800 font-medium">
                            {match.invoice.voucherNo}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700">
                            {supplier?.name || "Unknown"}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700">{match.invoice.date}</td>
                          <td className="px-3 py-2.5 text-gray-700 text-right">
                            {money(match.invoice.totalAmount || match.invoice.grandTotal || 0)}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700">{match.po?.poNo || "N/A"}</td>
                          <td className="px-3 py-2.5 text-gray-700 text-right">
                            {match.po ? money(match.po.totalAmount) : "N/A"}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700">
                            {match.grn?.voucherNo || "N/A"}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {getStatusBadge(match.status)}
                          </td>
                        </tr>

                        {expandedInvoice === match.invoice.id && (
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <td colSpan={8} className="p-4">
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="border border-gray-200 rounded-md bg-white p-3">
                                  <h4 className="text-[12px] font-semibold text-gray-800 mb-3 border-b border-gray-100 pb-2">
                                    Purchase Order (PO)
                                  </h4>
                                  {match.po ? (
                                    <table className="w-full min-w-max border-collapse">
                                      <thead>
                                        <tr className="bg-[#f5f6fa] border-b border-gray-200">
                                          <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 uppercase">
                                            Item
                                          </th>
                                          <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase">
                                            Qty
                                          </th>
                                          <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase">
                                            Rate
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {match.po.items?.map((item: any, idx: number) => (
                                          <tr key={idx} className="border-b border-gray-100">
                                            <td className="px-2 py-1.5 text-[11px] text-gray-700">
                                              {item.name || item.description}
                                            </td>
                                            <td className="px-2 py-1.5 text-[11px] text-gray-700 text-right">
                                              {item.quantity}
                                            </td>
                                            <td className="px-2 py-1.5 text-[11px] text-gray-700 text-right">
                                              {money(item.rate)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <div className="text-[12px] text-gray-500 p-2 text-center">
                                      No PO data
                                    </div>
                                  )}
                                </div>

                                <div className="border border-gray-200 rounded-md bg-white p-3">
                                  <h4 className="text-[12px] font-semibold text-gray-800 mb-3 border-b border-gray-100 pb-2">
                                    Goods Receipt (GRN)
                                  </h4>
                                  {match.grn ? (
                                    <table className="w-full min-w-max border-collapse">
                                      <thead>
                                        <tr className="bg-[#f5f6fa] border-b border-gray-200">
                                          <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 uppercase">
                                            Item
                                          </th>
                                          <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase">
                                            Qty Received
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {match.grn.lines
                                          ?.filter((l) => l.itemId)
                                          .map((line: any, idx: number) => (
                                            <tr key={idx} className="border-b border-gray-100">
                                              <td className="px-2 py-1.5 text-[11px] text-gray-700">
                                                {line.itemName || "Item"}
                                              </td>
                                              <td className="px-2 py-1.5 text-[11px] text-gray-700 text-right">
                                                {line.quantity || line.debit || 0}
                                              </td>
                                            </tr>
                                          ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <div className="text-[12px] text-gray-500 p-2 text-center">
                                      No GRN data
                                    </div>
                                  )}
                                </div>

                                <div className="border border-gray-200 rounded-md bg-white p-3">
                                  <h4 className="text-[12px] font-semibold text-gray-800 mb-3 border-b border-gray-100 pb-2">
                                    Purchase Invoice
                                  </h4>
                                  <table className="w-full min-w-max border-collapse">
                                    <thead>
                                      <tr className="bg-[#f5f6fa] border-b border-gray-200">
                                        <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 uppercase">
                                          Item
                                        </th>
                                        <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase">
                                          Qty Billed
                                        </th>
                                        <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase">
                                          Rate Billed
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {match.invoice.lines
                                        ?.filter((l) => l.itemId)
                                        .map((line: any, idx: number) => (
                                          <tr key={idx} className="border-b border-gray-100">
                                            <td className="px-2 py-1.5 text-[11px] text-gray-700">
                                              {line.itemName || "Item"}
                                            </td>
                                            <td className="px-2 py-1.5 text-[11px] text-gray-700 text-right">
                                              {line.quantity || 0}
                                            </td>
                                            <td className="px-2 py-1.5 text-[11px] text-gray-700 text-right">
                                              {money(line.rate || 0)}
                                            </td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {threeWayMatches.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No purchase invoices to match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 3 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <h2 className="text-[14px] font-semibold text-gray-800 mb-4">Vendor Scorecard</h2>
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Vendor Name
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Total Orders
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      On-Time Delivery (%)
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Quality Score
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Price Competitiveness
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Overall Score
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">
                      Rating
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vendorScores.map((score) => (
                    <tr
                      key={score.supplier.id}
                      className="bg-white hover:bg-gray-50 border-b border-gray-100 text-[12px]"
                    >
                      <td className="px-3 py-2.5 text-gray-800 font-medium">
                        {score.supplier.name}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 text-right">{score.totalOrders}</td>
                      <td className="px-3 py-2.5 text-gray-700 text-right">
                        {score.onTimeDelivery.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 text-right">
                        {score.qualityScore.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 text-right">
                        {score.priceCompetitiveness.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--ds-action-primary)] font-semibold text-right">
                        {score.overallScore.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={12}
                              className={
                                star <= Math.round(score.overallScore / 20)
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-gray-200 fill-gray-100"
                              }
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {vendorScores.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No vendor data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseManagement;
