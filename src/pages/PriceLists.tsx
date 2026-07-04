// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useStore } from "../store";
import toast from "react-hot-toast";
import { DBPriceList, DBPriceListLine } from "../lib/db";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Search,
  Package,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { ReportEmptyState } from "../components/ReportEmptyState";

const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5 disabled:opacity-60";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

const emptyLine = (): DBPriceListLine & { _id: string } => ({
  _id: crypto.randomUUID(),
  itemId: "",
  itemName: "",
  rate: 0,
  minQty: 1,
});

export default function PriceLists() {
  const { priceLists, addPriceList, updatePriceList, deletePriceList, items } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  type LineRow = DBPriceListLine & { _id: string };

  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCurrency, setFormCurrency] = useState("INR");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formLines, setFormLines] = useState<LineRow[]>([]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return priceLists;
    return priceLists.filter(
      (pl) =>
        pl.name.toLowerCase().includes(q) ||
        pl.code.toLowerCase().includes(q) ||
        (pl.description ?? "").toLowerCase().includes(q),
    );
  }, [priceLists, search]);

  const deleteTarget = useMemo(
    () => priceLists.find((pl) => pl.id === deleteTargetId) ?? null,
    [priceLists, deleteTargetId],
  );

  const stockItems = useMemo(() => (items ?? []).filter((i: any) => i.isActive !== false), [items]);

  const resetForm = () => {
    setFormName("");
    setFormCode("");
    setFormDescription("");
    setFormCurrency("INR");
    setFormIsActive(true);
    setFormLines([]);
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    resetForm();
    setShowForm(true);
  };

  const handleOpenEdit = (pl: DBPriceList) => {
    setEditingId(pl.id);
    setFormName(pl.name);
    setFormCode(pl.code);
    setFormDescription(pl.description ?? "");
    setFormCurrency(pl.currency ?? "INR");
    setFormIsActive(pl.isActive);
    setFormLines((pl.lines ?? []).map((l) => ({ ...l, _id: crypto.randomUUID() })));
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
    resetForm();
  };

  const addLine = () => setFormLines((prev) => [...prev, emptyLine()]);

  const removeLine = (lid: string) => {
    if (formLines.length === 0) return;
    setFormLines((prev) => prev.filter((l) => l._id !== lid));
  };

  const updateLine = (lid: string, field: keyof LineRow, value: string | number) => {
    setFormLines((prev) =>
      prev.map((l) => {
        if (l._id !== lid) return l;
        if (field === "itemId") {
          const found = stockItems.find((i: any) => i.id === value);
          return {
            ...l,
            itemId: String(value),
            itemName: found ? (found.name ?? "") : l.itemName,
          };
        }
        return { ...l, [field]: value };
      }),
    );
  };

  const validate = (): string | null => {
    if (!formName.trim()) return "Price list name is required.";
    if (!formCode.trim()) return "Code is required.";

    const dupCode = priceLists.find(
      (pl) => pl.code.toLowerCase() === formCode.trim().toLowerCase() && pl.id !== editingId,
    );
    if (dupCode) return `Code "${formCode.trim()}" is already in use.`;

    const dupName = priceLists.find(
      (pl) => pl.name.toLowerCase() === formName.trim().toLowerCase() && pl.id !== editingId,
    );
    if (dupName) return `Price list "${formName.trim()}" already exists.`;

    for (let i = 0; i < formLines.length; i++) {
      const l = formLines[i];
      if (!l.itemId && !l.itemName.trim()) {
        return `Line ${i + 1}: item must be selected or named.`;
      }
      if (l.rate < 0) {
        return `Line ${i + 1}: rate cannot be negative.`;
      }
      if ((l.minQty ?? 1) < 0) {
        return `Line ${i + 1}: minimum quantity cannot be negative.`;
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    const cleanLines: DBPriceListLine[] = formLines.map(({ _id, ...rest }) => rest);

    const payload: Omit<DBPriceList, "id"> = {
      name: formName.trim(),
      code: formCode.trim().toUpperCase(),
      description: formDescription.trim(),
      currency: formCurrency,
      isActive: formIsActive,
      lines: cleanLines,
    };

    setSaving(true);
    try {
      if (editingId) {
        await updatePriceList({ ...payload, id: editingId });
        toast.success("Price list updated successfully.");
      } else {
        await addPriceList(payload);
        toast.success("Price list created successfully.");
      }
      handleCloseForm();
    } catch {
      toast.error("Failed to save price list. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequest = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteTargetId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    try {
      await deletePriceList(deleteTargetId);
      toast.success("Price list deleted.");
    } catch {
      toast.error("Failed to delete price list.");
    } finally {
      setDeleteTargetId(null);
    }
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex h-full min-h-0 bg-[#f5f6fa] overflow-hidden">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Price Lists</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Define item-specific pricing for customers
              </p>
            </div>
            <button type="button" className={btnPrimary} onClick={handleOpenCreate}>
              <Plus className="h-3.5 w-3.5" />
              New price list
            </button>
          </div>

          <div className="relative mb-3 max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              placeholder="Search price lists..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputCls} pl-8`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
          {filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-md">
              <ReportEmptyState
                message={search ? "No price lists match your search" : "No price lists found"}
                hint={
                  search
                    ? "Try a different search term."
                    : 'Click "New price list" to create your first price list.'
                }
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className={`${th} w-10`} />
                    <th className={th}>Code</th>
                    <th className={th}>Name</th>
                    <th className={th}>Description</th>
                    <th className={th}>Curr</th>
                    <th className={`${th} text-center`}>Items</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((pl) => {
                    const isExpanded = expandedId === pl.id;
                    return (
                      <React.Fragment key={pl.id}>
                        <tr
                          className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]"
                          onClick={() => handleOpenEdit(pl)}
                        >
                          <td className={`${td} text-center`}>
                            <button
                              type="button"
                              onClick={(e) => toggleExpand(pl.id, e)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                          <td className={`${td} font-mono`}>{pl.code || "—"}</td>
                          <td className={`${td} font-medium text-gray-800`}>{pl.name}</td>
                          <td className={`${td} truncate max-w-[200px]`}>
                            {pl.description || "—"}
                          </td>
                          <td className={`${td} font-mono`}>{pl.currency ?? "INR"}</td>
                          <td className={`${td} text-center`}>{(pl.lines ?? []).length}</td>
                          <td className={`${td} text-center`}>
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                pl.isActive
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {pl.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className={`${td} text-right`}>
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEdit(pl);
                                }}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-red-600 hover:bg-red-50"
                                onClick={(e) => handleDeleteRequest(pl.id, e)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-[#f5f6fa]">
                            <td colSpan={8} className="p-0 border-b border-gray-200">
                              <div className="px-8 py-3">
                                {(pl.lines ?? []).length === 0 ? (
                                  <p className="text-[11px] text-gray-500">
                                    No line items defined for this price list.
                                  </p>
                                ) : (
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr>
                                        <th className="pb-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                                          Item
                                        </th>
                                        <th className="pb-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                                          Min. qty
                                        </th>
                                        <th className="pb-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                                          Rate
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(pl.lines ?? []).map((line, idx) => (
                                        <tr key={idx} className="border-t border-gray-200">
                                          <td className="py-2 text-[12px] text-gray-700">
                                            {line.itemName || line.itemId || "—"}
                                          </td>
                                          <td className="py-2 text-right text-[12px] font-mono text-gray-700">
                                            {line.minQty ?? 1}
                                          </td>
                                          <td className="py-2 text-right text-[12px] font-mono font-medium text-gray-800">
                                            {Number(line.rate).toLocaleString("en-IN", {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
                {filtered.length} price list{filtered.length === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-full lg:w-[560px] xl:w-[640px] shrink-0 flex flex-col bg-white border-l border-gray-200 min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-800">
              {editingId ? "Edit price list" : "New price list"}
            </span>
            <button
              type="button"
              className="text-gray-500 hover:text-gray-700"
              onClick={handleCloseForm}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Price list name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Wholesale Pricing"
                  autoFocus
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Code *</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="e.g. WHLSL"
                  maxLength={20}
                  className={`${inputCls} font-mono`}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Currency</label>
                <select
                  value={formCurrency}
                  onChange={(e) => setFormCurrency(e.target.value)}
                  className={`${inputCls} font-mono`}
                >
                  <option value="INR">INR — Indian Rupee</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="NPR">Rs. — Nepalese Rupee</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description"
                  className={inputCls}
                />
              </div>
              <div className="col-span-2">
                <label className="flex w-fit items-center gap-2 cursor-pointer border border-gray-200 rounded-md px-3 py-2 bg-gray-50 hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                  />
                  <span className="text-[12px] font-medium text-gray-700">Active</span>
                </label>
              </div>
            </div>

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <div className="bg-[#f5f6fa] border-b border-gray-200 px-3 py-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Line items
                </span>
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1557b0] hover:text-[#0f4a96]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add item
                </button>
              </div>

              {formLines.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-[12px]">
                  <Package className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  No items added yet. Click &ldquo;Add item&rdquo; above.
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-[#f5f6fa]">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Item
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">
                        Min qty
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                        Rate
                      </th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {formLines.map((line, idx) => (
                      <tr key={line._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-1.5">
                          {stockItems.length > 0 ? (
                            <select
                              value={line.itemId}
                              onChange={(e) => updateLine(line._id, "itemId", e.target.value)}
                              className="w-full h-7 px-1.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]"
                            >
                              <option value="">Select item</option>
                              {stockItems.map((i: any) => (
                                <option key={i.id} value={i.id}>
                                  {i.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={line.itemName}
                              onChange={(e) => updateLine(line._id, "itemName", e.target.value)}
                              placeholder={`Item ${idx + 1}`}
                              className="w-full h-7 px-1.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]"
                            />
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={line.minQty ?? 1}
                            onChange={(e) => updateLine(line._id, "minQty", Number(e.target.value))}
                            className="w-full h-7 px-1.5 text-right font-mono text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.rate}
                            onChange={(e) => updateLine(line._id, "rate", Number(e.target.value))}
                            className="w-full h-7 px-1.5 text-right font-mono text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(line._id)}
                            className="text-gray-400 hover:text-red-600"
                            title="Remove line"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </form>

          <div className="flex gap-2 p-4 border-t border-gray-200">
            <button type="button" className={btnPrimary} disabled={saving} onClick={handleSubmit}>
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving..." : editingId ? "Update" : "Save"}
            </button>
            <button type="button" className={btnOutline} onClick={handleCloseForm}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {deleteTargetId && deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-sm shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 bg-[#f5f6fa]">
              <h2 className="text-[13px] font-semibold text-gray-800">Delete price list</h2>
            </div>
            <div className="p-4">
              <p className="text-[12px] text-gray-700 mb-4">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-900">{deleteTarget.name}</span>? This will
                remove all {(deleteTarget.lines ?? []).length} line item
                {(deleteTarget.lines ?? []).length !== 1 ? "s" : ""} and cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={btnOutline}
                  onClick={() => setDeleteTargetId(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white text-[12px] font-medium rounded-md"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
