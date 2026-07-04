// src/pages/BillSundryMaster.tsx
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, Search, Tag } from "lucide-react";
import { BillSundryType, BillSundryNature } from "../lib/busyTypes";
import { getDB } from "../lib/db";

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

export default function BillSundryMaster() {
  const { accounts } = useStore();
  const [billSundries, setBillSundries] = useState<BillSundry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<BillSundry | null>(null);
  const [form, setForm] = useState<Omit<BillSundry, "id">>({
    name: "",
    type: BillSundryType.ADDITIVE,
    nature: BillSundryNature.OTHER,
    affectCostInSale: false,
    affectCostInPurchase: false,
    affectAccountingInStockTransfer: false,
    gstApplicable: false,
    isActive: true,
  });

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

  const openAdd = () => {
    setEditItem(null);
    setForm({
      name: "",
      type: BillSundryType.ADDITIVE,
      nature: BillSundryNature.OTHER,
      affectCostInSale: false,
      affectCostInPurchase: false,
      affectAccountingInStockTransfer: false,
      gstApplicable: false,
      isActive: true,
    });
    setShowModal(true);
  };

  const openEdit = (item: BillSundry) => {
    setEditItem(item);
    const { id, ...rest } = item;
    setForm(rest);
    setShowModal(true);
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
      setShowModal(false);
    } catch (e) {
      toast.error("Failed to save");
    }
  };

  const handleDelete = async (id: string) => {
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

  const inputCls =
    "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
  const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Bill Sundry Master</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Freight, Discount, Round Off, Packing and other charges
          </p>
        </div>
        <button
          onClick={openAdd}
          className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Add Bill Sundry
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-3 border-b border-gray-200 flex items-center gap-3">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search bill sundries..."
              className="h-8 pl-8 pr-3 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 w-56"
            />
          </div>
          <span className="text-[11px] text-gray-500">{filtered.length} records</span>
        </div>

        <table className="w-full">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              {[
                "Name",
                "Type",
                "Nature",
                "Affect Cost (Sale)",
                "Affect Cost (Purchase)",
                "GST",
                "Status",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800">{item.name}</td>
                <td className="px-3 py-2.5 text-[12px]">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${item.type === BillSundryType.ADDITIVE ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                  >
                    {item.type === BillSundryType.ADDITIVE ? "Additive (+)" : "Deductive (-)"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600 capitalize">
                  {item.nature.replace(/_/g, " ")}
                </td>
                <td className="px-3 py-2.5 text-[12px] text-center">
                  {item.affectCostInSale ? "✓" : "—"}
                </td>
                <td className="px-3 py-2.5 text-[12px] text-center">
                  {item.affectCostInPurchase ? "✓" : "—"}
                </td>
                <td className="px-3 py-2.5 text-[12px] text-center">
                  {item.gstApplicable ? "✓" : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${item.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                  >
                    {item.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(item)}
                      className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 hover:bg-red-50 rounded text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[12px] text-gray-500">
                  No bill sundries found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-gray-800">
                {editItem ? "Modify Bill Sundry" : "Add Bill Sundry"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className={labelCls}>Name *</label>
                <input
                  value={F.name}
                  onChange={(e) => setF("name", e.target.value)}
                  className={`${inputCls} w-full`}
                  placeholder="e.g. Freight, Discount, Round Off+"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Bill Sundry Type</label>
                  <select
                    value={F.type}
                    onChange={(e) => setF("type", e.target.value)}
                    className={`${inputCls} w-full`}
                  >
                    <option value={BillSundryType.ADDITIVE}>Additive (+) — Increases bill</option>
                    <option value={BillSundryType.DEDUCTIVE}>Deductive (-) — Decreases bill</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Nature</label>
                  <select
                    value={F.nature}
                    onChange={(e) => setF("nature", e.target.value)}
                    className={`${inputCls} w-full`}
                  >
                    {Object.values(BillSundryNature).map((n) => (
                      <option key={n} value={n}>
                        {n.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Accounting in Sale</label>
                  <select
                    value={F.accountingInSale || ""}
                    onChange={(e) => setF("accountingInSale", e.target.value)}
                    className={`${inputCls} w-full`}
                  >
                    <option value="">— Select Account —</option>
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
                  <label className={labelCls}>Accounting in Purchase</label>
                  <select
                    value={F.accountingInPurchase || ""}
                    onChange={(e) => setF("accountingInPurchase", e.target.value)}
                    className={`${inputCls} w-full`}
                  >
                    <option value="">— Select Account —</option>
                    {accounts
                      .filter((a) => !a.isGroup && a.isActive)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-1">
                {[
                  { key: "affectCostInSale", label: "Affect Cost in Sale" },
                  { key: "affectCostInPurchase", label: "Affect Cost in Purchase" },
                  { key: "affectAccountingInStockTransfer", label: "Affect in Stock Transfer" },
                  { key: "gstApplicable", label: "GST Applicable" },
                  { key: "isActive", label: "Active" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!(F as any)[key]}
                      onChange={(e) => setF(key as any, e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-[12px] text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="h-8 px-3 bg-[#1557b0] text-white text-[12px] rounded-md hover:bg-[#0f4a96]"
              >
                Save (F2)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
