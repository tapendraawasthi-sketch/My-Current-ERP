// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useStore } from "../store";
import toast from "react-hot-toast";
import { DBPriceList, DBPriceListLine } from "../lib/db";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Search,
  Tag,
  Package,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  List,
  IndentIncrease,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const emptyLine = (): DBPriceListLine & { _id: string } => ({
  _id: crypto.randomUUID(),
  itemId: "",
  itemName: "",
  rate: 0,
  minQty: 1,
});

const emptyForm = (): Omit<DBPriceList, "id"> => ({
  name: "",
  code: "",
  description: "",
  currency: "INR",
  isActive: true,
  lines: [],
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function PriceLists() {
  const {
    priceLists,
    addPriceList,
    updatePriceList,
    deletePriceList,
    items, // stock items from store – shape: { id, name, code, ... }[]
  } = useStore();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Form state ───────────────────────────────────────────────────────────────
  type LineRow = DBPriceListLine & { _id: string };

  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCurrency, setFormCurrency] = useState("INR");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formLines, setFormLines] = useState<LineRow[]>([]);

  // ── Derived ──────────────────────────────────────────────────────────────────
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

  // Stock items list for the line-item dropdown
  const stockItems = useMemo(() => (items ?? []).filter((i: any) => i.isActive !== false), [items]);

  // ── Form open / close ────────────────────────────────────────────────────────

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
    // Attach local _id keys for React reconciliation
    setFormLines((pl.lines ?? []).map((l) => ({ ...l, _id: crypto.randomUUID() })));
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
    resetForm();
  };

  // ── Line-item handlers ───────────────────────────────────────────────────────

  const addLine = () => setFormLines((prev) => [...prev, emptyLine()]);

  const removeLine = (lid: string) => {
    if (formLines.length === 0) return;
    setFormLines((prev) => prev.filter((l) => l._id !== lid));
  };

  const updateLine = (lid: string, field: keyof LineRow, value: string | number) => {
    setFormLines((prev) =>
      prev.map((l) => {
        if (l._id !== lid) return l;
        // If selecting an item from the dropdown, auto-fill itemName
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

  // ── Validation ───────────────────────────────────────────────────────────────

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

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    // Strip local _id before persisting
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

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDeleteRequest = (id: string) => setDeleteTargetId(id);

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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 animate-fadeIn select-none pb-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Price Lists</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Define item-specific pricing for customers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Price List
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code or description..."
            className="w-64 h-8 pl-8 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
        </div>
      </div>

      {/* Table (Collapsible rows) */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-10"></th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Code
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Name
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Description
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Curr
              </th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
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
          <tbody className="divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-gray-500 text-[12px]">
                  <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  {search
                    ? "No results found."
                    : "No price lists yet. Create your first price list."}
                </td>
              </tr>
            ) : (
              filtered.map((pl) => {
                const isExpanded = expandedId === pl.id;
                return (
                  <React.Fragment key={pl.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : pl.id)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-gray-700">
                        {pl.code || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-medium text-gray-700">
                        {pl.name}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 truncate max-w-[200px]">
                        {pl.description || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">
                        {pl.currency ?? "INR"}
                      </td>
                      <td className="px-3 py-2.5 text-center text-[12px] text-gray-700">
                        {(pl.lines ?? []).length}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            pl.isActive
                              ? "bg-green-100 text-green-700 border border-green-200"
                              : "bg-red-100 text-red-700 border border-red-200"
                          }`}
                        >
                          {pl.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(pl)}
                            title="Edit"
                            className="text-gray-400 hover:text-[#1557b0] transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRequest(pl.id)}
                            title="Delete"
                            className="text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={8} className="p-0 border-t border-gray-100">
                          <div className="px-8 py-3">
                            {(pl.lines ?? []).length === 0 ? (
                              <p className="text-[11px] text-gray-400">
                                No line items defined for this price list.
                              </p>
                            ) : (
                              <table className="w-full text-left">
                                <thead>
                                  <tr>
                                    <th className="pb-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                                      Item
                                    </th>
                                    <th className="pb-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                                      Min. Qty
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
                                      <td className="py-2 text-right text-[12px] font-mono font-medium text-gray-900">
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
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between rounded-t-lg flex-shrink-0">
              <h2 className="text-[14px] font-semibold text-gray-800">
                {editingId ? "Edit Price List" : "New Price List"}
              </h2>
              <button
                type="button"
                onClick={handleCloseForm}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-4 flex flex-col gap-4"
            >
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">Price List Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Wholesale Pricing"
                    autoFocus
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">Code *</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. WHLSL"
                    maxLength={20}
                    className="h-8 px-2.5 text-[12px] font-mono border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">Currency</label>
                  <select
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value)}
                    className="h-8 px-2.5 text-[12px] font-mono border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  >
                    <option value="INR">INR — Indian Rupee</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — British Pound</option>
                    <option value="AED">AED — UAE Dirham</option>
                    <option value="NPR">NPR — Nepalese Rupee</option>
                  </select>
                </div>

                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">Description</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional description"
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  />
                </div>

                <div className="col-span-2 pt-1">
                  <label className="flex w-fit items-center gap-2 cursor-pointer border border-gray-200 rounded-md px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
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

              {/* Line Items */}
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <div className="bg-[#f5f6fa] border-b border-gray-200 px-3 py-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Line Items
                  </span>
                  <button
                    type="button"
                    onClick={addLine}
                    className="flex items-center gap-1 text-[11px] font-medium text-[#1557b0] hover:text-[#0f4a96] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Item
                  </button>
                </div>

                {formLines.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-[12px]">
                    <Package className="w-6 h-6 mx-auto mb-2 opacity-30" />
                    No items added yet. Click &ldquo;Add Item&rdquo; above.
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Item
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right w-24">
                          Min Qty
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right w-32">
                          Rate
                        </th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {formLines.map((line, idx) => (
                        <tr key={line._id} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5">
                            {stockItems.length > 0 ? (
                              <select
                                value={line.itemId}
                                onChange={(e) => updateLine(line._id, "itemId", e.target.value)}
                                className="w-full h-7 px-1.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]"
                              >
                                <option value="">— Select item —</option>
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
                              onChange={(e) =>
                                updateLine(line._id, "minQty", Number(e.target.value))
                              }
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
                              className="text-gray-400 hover:text-red-600 transition-colors"
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

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 flex-shrink-0 rounded-b-lg bg-gray-50">
              <button
                type="button"
                onClick={handleCloseForm}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving..." : editingId ? "Save Changes" : "Add Price List"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────────────────── */}
      {deleteTargetId && deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-sm shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <h2 className="text-[14px] font-semibold text-gray-800">Delete Price List</h2>
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
                  onClick={() => setDeleteTargetId(null)}
                  className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white text-[12px] font-medium rounded-md transition-colors"
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
