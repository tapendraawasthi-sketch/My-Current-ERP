// src/pages/BillSundryMaster.tsx
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, Search, X, Save } from "lucide-react";
import { BillSundryType, BillSundryNature } from "../lib/busyTypes";
import { getDB } from "../lib/db";
import { ReportEmptyState } from "../components/ReportEmptyState";

interface BillSundry {
  id: string;
  name: string;
  type: BillSundryType;
  nature: BillSundryNature;
  affectCostInSale: boolean;
  affectCostInPurchase: boolean;
  accountingInSale?: string;
  accountingInPurchase?: string;
  affectAccountingInStockTransfer: boolean;
  gstApplicable: boolean;
  taxCategoryId?: string;
  isActive: boolean;
}

const DEFAULT_BILL_SUNDRIES: Omit<BillSundry, "id">[] = [
  {
    name: "Freight & Forwarding",
    type: BillSundryType.ADDITIVE,
    nature: BillSundryNature.FREIGHT,
    affectCostInSale: true,
    affectCostInPurchase: true,
    affectAccountingInStockTransfer: false,
    gstApplicable: false,
    isActive: true,
  },
  {
    name: "Packing Charges",
    type: BillSundryType.ADDITIVE,
    nature: BillSundryNature.PACKING,
    affectCostInSale: true,
    affectCostInPurchase: true,
    affectAccountingInStockTransfer: false,
    gstApplicable: false,
    isActive: true,
  },
  {
    name: "Trade Discount",
    type: BillSundryType.DEDUCTIVE,
    nature: BillSundryNature.DISCOUNT,
    affectCostInSale: false,
    affectCostInPurchase: false,
    affectAccountingInStockTransfer: false,
    gstApplicable: false,
    isActive: true,
  },
  {
    name: "Round Off +",
    type: BillSundryType.ADDITIVE,
    nature: BillSundryNature.ROUND_OFF,
    affectCostInSale: false,
    affectCostInPurchase: false,
    affectAccountingInStockTransfer: false,
    gstApplicable: false,
    isActive: true,
  },
  {
    name: "Round Off -",
    type: BillSundryType.DEDUCTIVE,
    nature: BillSundryNature.ROUND_OFF,
    affectCostInSale: false,
    affectCostInPurchase: false,
    affectAccountingInStockTransfer: false,
    gstApplicable: false,
    isActive: true,
  },
  {
    name: "Loading Charges",
    type: BillSundryType.ADDITIVE,
    nature: BillSundryNature.OTHER,
    affectCostInSale: true,
    affectCostInPurchase: true,
    affectAccountingInStockTransfer: false,
    gstApplicable: false,
    isActive: true,
  },
  {
    name: "Insurance",
    type: BillSundryType.ADDITIVE,
    nature: BillSundryNature.OTHER,
    affectCostInSale: true,
    affectCostInPurchase: true,
    affectAccountingInStockTransfer: false,
    gstApplicable: false,
    isActive: true,
  },
];

const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

const emptyForm = (): Omit<BillSundry, "id"> => ({
  name: "",
  type: BillSundryType.ADDITIVE,
  nature: BillSundryNature.OTHER,
  affectCostInSale: false,
  affectCostInPurchase: false,
  affectAccountingInStockTransfer: false,
  gstApplicable: false,
  isActive: true,
});

export default function BillSundryMaster() {
  const { accounts } = useStore();
  const [billSundries, setBillSundries] = useState<BillSundry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<BillSundry | null>(null);
  const [form, setForm] = useState<Omit<BillSundry, "id">>(emptyForm());

  useEffect(() => {
    loadBillSundries();
  }, []);

  const loadBillSundries = async () => {
    try {
      const db = getDB();
      let items: BillSundry[] = [];
      if (db.billSundries) {
        const data = await db.billSundries.toArray();
        if (data.length === 0) {
          const seeded = DEFAULT_BILL_SUNDRIES.map((d, i) => ({ ...d, id: `bs-${i}` }));
          await db.billSundries.bulkPut(seeded);
          items = seeded as any;
        } else items = data as any;
      } else {
        items = DEFAULT_BILL_SUNDRIES.map((d, i) => ({ ...d, id: `bs-default-${i + 1}` }));
      }
      setBillSundries(items);
    } catch {
      setBillSundries(DEFAULT_BILL_SUNDRIES.map((d, i) => ({ ...d, id: `bs-${i}` })));
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(
    () => billSundries.filter((b) => b.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [billSundries, searchTerm],
  );

  const resetForm = () => {
    setShowForm(false);
    setEditItem(null);
    setForm(emptyForm());
  };

  const openAdd = () => {
    setEditItem(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (item: BillSundry) => {
    setEditItem(item);
    const { id, ...rest } = item;
    setForm(rest);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      const db = getDB();
      if (editItem) {
        const updated = { ...editItem, ...form };
        if (db.billSundries) await db.billSundries.put(updated);
        setBillSundries((prev) => prev.map((b) => (b.id === editItem.id ? updated : b)));
        toast.success("Bill Sundry updated");
      } else {
        const newItem: BillSundry = { ...form, id: `bs-${Date.now()}` };
        if (db.billSundries) await db.billSundries.put(newItem);
        setBillSundries((prev) => [...prev, newItem]);
        toast.success("Bill Sundry added");
      }
      resetForm();
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Delete this bill sundry?")) return;
    try {
      const db = getDB();
      if (db.billSundries) await db.billSundries.delete(id);
      setBillSundries((prev) => prev.filter((b) => b.id !== id));
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const F = form;
  const setF = (k: keyof typeof form, v: any) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="flex h-full min-h-0 bg-[#f5f6fa]">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Bill Sundry Master</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Freight, discount, round off, packing and other charges
              </p>
            </div>
            <button type="button" className={btnPrimary} onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" />
              Add bill sundry
            </button>
          </div>

          <div className="relative mb-3 max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search bill sundries..."
              className={`${inputCls} pl-8`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="bg-white border border-gray-200 rounded-md px-4 py-8 text-center text-[12px] text-gray-500">
              Loading bill sundries...
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-md">
              <ReportEmptyState
                message={
                  searchTerm ? "No bill sundries match your search" : "No bill sundries found"
                }
                hint={
                  searchTerm
                    ? "Try a different search term."
                    : 'Click "Add bill sundry" to create a charge type.'
                }
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className={th}>Name</th>
                    <th className={th}>Type</th>
                    <th className={th}>Nature</th>
                    <th className={`${th} text-center`}>Cost (sale)</th>
                    <th className={`${th} text-center`}>Cost (purchase)</th>
                    <th className={`${th} text-center`}>GST</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]"
                      onClick={() => openEdit(item)}
                    >
                      <td className={`${td} font-medium text-gray-800`}>{item.name}</td>
                      <td className={td}>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            item.type === BillSundryType.ADDITIVE
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {item.type === BillSundryType.ADDITIVE ? "Additive" : "Deductive"}
                        </span>
                      </td>
                      <td className={`${td} capitalize`}>{item.nature.replace(/_/g, " ")}</td>
                      <td className={`${td} text-center`}>{item.affectCostInSale ? "✓" : "—"}</td>
                      <td className={`${td} text-center`}>
                        {item.affectCostInPurchase ? "✓" : "—"}
                      </td>
                      <td className={`${td} text-center`}>{item.gstApplicable ? "✓" : "—"}</td>
                      <td className={`${td} text-center`}>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            item.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className={`${td} text-right`}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(item);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-red-600 hover:bg-red-50"
                            onClick={(e) => handleDelete(item.id, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
                {filtered.length} bill sundr{filtered.length === 1 ? "y" : "ies"}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-[400px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-800">
              {editItem ? "Edit bill sundry" : "Add bill sundry"}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div>
              <label className={labelCls}>Name *</label>
              <input
                value={F.name}
                onChange={(e) => setF("name", e.target.value)}
                className={inputCls}
                placeholder="e.g. Freight, Discount, Round Off+"
              />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className={labelCls}>Bill sundry type</label>
                <select
                  value={F.type}
                  onChange={(e) => setF("type", e.target.value)}
                  className={inputCls}
                >
                  <option value={BillSundryType.ADDITIVE}>Additive (+) — increases bill</option>
                  <option value={BillSundryType.DEDUCTIVE}>Deductive (-) — decreases bill</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Nature</label>
                <select
                  value={F.nature}
                  onChange={(e) => setF("nature", e.target.value)}
                  className={inputCls}
                >
                  {Object.values(BillSundryNature).map((n) => (
                    <option key={n} value={n}>
                      {n.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Accounting in sale</label>
              <select
                value={F.accountingInSale || ""}
                onChange={(e) => setF("accountingInSale", e.target.value)}
                className={inputCls}
              >
                <option value="">Select account</option>
                {accounts
                  .filter((a) => !a.isGroup && a.isActive)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Accounting in purchase</label>
              <select
                value={F.accountingInPurchase || ""}
                onChange={(e) => setF("accountingInPurchase", e.target.value)}
                className={inputCls}
              >
                <option value="">Select account</option>
                {accounts
                  .filter((a) => !a.isGroup && a.isActive)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-2 border border-gray-200 rounded-md p-3 bg-gray-50">
              {[
                { key: "affectCostInSale", label: "Affect cost in sale" },
                { key: "affectCostInPurchase", label: "Affect cost in purchase" },
                { key: "affectAccountingInStockTransfer", label: "Affect in stock transfer" },
                { key: "gstApplicable", label: "GST applicable" },
                { key: "isActive", label: "Active" },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={!!(F as any)[key]}
                    onChange={(e) => setF(key as any, e.target.checked)}
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 p-4 border-t border-gray-200">
            <button type="button" className={btnPrimary} onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              {editItem ? "Update" : "Save"}
            </button>
            <button type="button" className={btnOutline} onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
