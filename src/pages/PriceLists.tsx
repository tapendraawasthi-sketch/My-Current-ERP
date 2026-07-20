// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store";
import toast from "@/lib/appToast";
import { DBPriceList, DBPriceListLine } from "../lib/db";
import { Plus, X, Save, Search, Package, Trash2 } from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";
import { useAppRoute, useNavigateApp } from "../routing/useAppRoute";
import { formatCurrency } from "../lib/utils";
import {
  Button,
  PageHeader,
  PageMeta,
  EnterpriseDataTable,
  type EnterpriseColumnDef,
} from "@/design-system";

const btnPrimary =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5 disabled:opacity-60";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-200 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

const emptyLine = (): DBPriceListLine & { _id: string } => ({
  _id: crypto.randomUUID(),
  itemId: "",
  itemName: "",
  rate: 0,
  minQty: 1,
});

export default function PriceLists() {
  const { priceLists, addPriceList, updatePriceList, deletePriceList, items, initLifecycle } =
    useStore();
  const { branchFilter, matchBranch } = useBranchFilter();
  const route = useAppRoute();
  const { openEntity, clearEntity } = useNavigateApp();
  const pageId = route.pageId === "price-list-master" ? "price-list-master" : "price-lists";

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
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
    return priceLists.filter((pl) => {
      if (!matchBranch((pl as { branchId?: string }).branchId)) return false;
      if (!q) return true;
      return (
        pl.name.toLowerCase().includes(q) ||
        pl.code.toLowerCase().includes(q) ||
        (pl.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [priceLists, search, matchBranch, branchFilter]);

  const stockItems = useMemo(() => (items ?? []).filter((i: any) => i.isActive !== false), [items]);

  const columns = useMemo<EnterpriseColumnDef<DBPriceList>[]>(
    () => [
      {
        id: "code",
        header: "Code",
        cell: (pl) => (
          <span className="font-mono text-[12px] text-[var(--ds-text-default)]">{pl.code || "—"}</span>
        ),
      },
      {
        id: "name",
        header: "Name",
        cell: (pl) => (
          <span className="font-medium text-[12px] text-[var(--ds-text-default)]">{pl.name}</span>
        ),
      },
      {
        id: "description",
        header: "Description",
        cell: (pl) => (
          <span className="text-[12px] text-[var(--ds-text-default)] truncate max-w-[200px] block">
            {pl.description || "—"}
          </span>
        ),
      },
      {
        id: "currency",
        header: "Curr",
        cell: (pl) => (
          <span className="font-mono text-[12px] text-[var(--ds-text-default)]">
            {pl.currency ?? "INR"}
          </span>
        ),
      },
      {
        id: "items",
        header: "Items",
        align: "center",
        cell: (pl) => (
          <span className="font-mono text-[12px] text-[var(--ds-text-default)]">
            {(pl.lines ?? []).length}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        align: "center",
        cell: (pl) => (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
              pl.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {pl.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [],
  );

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
    openEntity(pageId, "new");
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
    openEntity(pageId, pl.id);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
    resetForm();
    clearEntity(pageId);
  };

  // Deep link: /app/price-lists/:id | /app/price-lists/new
  useEffect(() => {
    if (route.pageId !== "price-lists" && route.pageId !== "price-list-master") return;
    if (route.entityId === "new") {
      setEditingId(null);
      resetForm();
      setShowForm(true);
      return;
    }
    if (route.entityId) {
      const pl = priceLists.find((p) => p.id === route.entityId);
      if (pl) {
        setEditingId(pl.id);
        setFormName(pl.name);
        setFormCode(pl.code);
        setFormDescription(pl.description ?? "");
        setFormCurrency(pl.currency ?? "INR");
        setFormIsActive(pl.isActive);
        setFormLines((pl.lines ?? []).map((l) => ({ ...l, _id: crypto.randomUUID() })));
        setShowForm(true);
      }
      return;
    }
    if (showForm) setShowForm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.pageId, route.entityId, priceLists]);

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
      branchId: readActiveBranchId() || undefined,
    } as Omit<DBPriceList, "id">;

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

  const handleDelete = async (pl: DBPriceList) => {
    const snapshot = { ...pl };
    try {
      await deletePriceList(pl.id);
      if (editingId === pl.id) handleCloseForm();
      toast.undo(`"${pl.name}" deleted`, async () => {
        try {
          const { id, ...rest } = snapshot;
          await addPriceList({ ...rest, id } as any);
        } catch {
          toast.error("Failed to restore price list.");
        }
      });
    } catch {
      toast.error("Failed to delete price list.");
    }
  };

  const renderExpanded = (pl: DBPriceList) => (
    <div className="px-4 py-3 bg-[var(--ds-surface-muted)]">
      {(pl.lines ?? []).length === 0 ? (
        <p className="text-[11px] text-[var(--ds-text-muted)]">
          No line items defined for this price list.
        </p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="pb-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                Item
              </th>
              <th className="pb-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-28">
                Min. qty
              </th>
              <th className="pb-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-28">
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
                <td className="py-2 text-right">
                  <span className="ds-financial-value">{formatCurrency(Number(line.rate))}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 bg-gray-50 overflow-hidden">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0 flex flex-col gap-3">
          <PageHeader
            title="Price Lists"
            description="Define item-specific pricing for customers"
            meta={
              <PageMeta>
                {filtered.length} of {priceLists.length} price lists
              </PageMeta>
            }
            primaryAction={
              <Button
                variant="primary"
                size="small"
                onClick={handleOpenCreate}
                startIcon={<Plus className="h-3.5 w-3.5" />}
              >
                New price list
              </Button>
            }
          />

          <div className="relative max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              placeholder="Search price lists..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputCls} pl-8`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3 min-h-0">
          <EnterpriseDataTable
            columns={columns}
            rows={filtered}
            getRowId={(pl) => pl.id}
            loading={priceLists == null || initLifecycle === "loading"}
            emptyTitle={search ? "No price lists match your search" : "No price lists found"}
            emptyDescription={
              search
                ? "Try a different search term."
                : 'Click "New price list" to create your first price list.'
            }
            emptyAction={
              !search ? (
                <Button
                  variant="primary"
                  size="small"
                  onClick={handleOpenCreate}
                  startIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  New price list
                </Button>
              ) : undefined
            }
            onRowClick={handleOpenEdit}
            rowActions={(pl) => [
              { label: "Edit", onSelect: () => handleOpenEdit(pl) },
              { label: "Delete", destructive: true, onSelect: () => handleDelete(pl) },
            ]}
            expandedIds={expandedIds}
            onExpandedChange={setExpandedIds}
            renderExpanded={renderExpanded}
            caption="Price lists"
          />
        </div>
      </div>

      {showForm && (
        <div className="w-full lg:w-[560px] xl:w-[640px] shrink-0 flex flex-col bg-white border-l border-gray-200 min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-700">
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
                <label className="flex w-fit items-center gap-2 cursor-pointer border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded border-[var(--ds-border-default)] text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                  />
                  <span className="text-[12px] font-medium text-gray-700">Active</span>
                </label>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
                <span className="text-[11px] font-medium text-gray-500">
                  Line items
                </span>
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--ds-action-primary)] hover:text-[var(--ds-action-primary-hover)]"
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
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        Item
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-24">
                        Min qty
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-32">
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
                              className="w-full h-7 px-1.5 text-[12px] border border-[var(--ds-border-default)] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)] focus:border-[var(--ds-action-primary)]"
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
                              className="w-full h-7 px-1.5 text-[12px] border border-[var(--ds-border-default)] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)] focus:border-[var(--ds-action-primary)]"
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
                            className="w-full h-7 px-1.5 text-right font-mono text-[12px] border border-[var(--ds-border-default)] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)] focus:border-[var(--ds-action-primary)]"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.rate}
                            onChange={(e) => updateLine(line._id, "rate", Number(e.target.value))}
                            className="w-full h-7 px-1.5 text-right font-mono text-[12px] border border-[var(--ds-border-default)] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)] focus:border-[var(--ds-action-primary)]"
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
    </div>
  );
}
