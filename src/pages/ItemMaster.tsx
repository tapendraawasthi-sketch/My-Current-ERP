/**
 * Item Master — create / edit stock items (Wave D / Function 8).
 * Canonical for nav `items` / `item-master`. Stock ledger stays on `stock-book` / `stock-ledger`.
 */
import React, { useMemo, useState } from "react";
import { Edit2, Package, Plus, Search } from "lucide-react";
import { useStore } from "../store/useStore";
import type { Item } from "../lib/types";
import ItemForm from "../components/item/ItemForm";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

export default function ItemMaster() {
  const { items, addItem, updateItem } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const filtered = useMemo(() => {
    const list = items ?? [];
    const q = searchTerm.trim().toLowerCase();
    return list.filter((i) => {
      if (!matchBranch((i as { branchId?: string }).branchId)) return false;
      if (!q) return true;
      return (
        i.name?.toLowerCase().includes(q) ||
        i.code?.toLowerCase().includes(q) ||
        i.barcode?.toLowerCase().includes(q) ||
        i.hsnCode?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q)
      );
    });
  }, [items, searchTerm, matchBranch, branchFilter]);

  const openCreate = () => {
    setEditingItem(null);
    setShowForm(true);
  };

  const openEdit = (item: Item) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleSave = async (itemData: Item) => {
    try {
      const payload = {
        ...itemData,
        branchId:
          (itemData as { branchId?: string }).branchId ||
          (editingItem as { branchId?: string } | null)?.branchId ||
          readActiveBranchId() ||
          undefined,
      } as Item;
      if (editingItem?.id) {
        await updateItem({ ...payload, id: editingItem.id });
      } else {
        await addItem(payload);
      }
      setShowForm(false);
      setEditingItem(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-fadeIn select-none pb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--ds-text-default)]">Item Master</h1>
          <p className="text-[11px] text-[var(--ds-text-muted)] mt-0.5">
            Products and services you buy or sell.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <button
            type="button"
            onClick={openCreate}
            className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Item
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-subtle)] pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, code, barcode, HSN…"
            className="h-8 pl-8 pr-3 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-72"
          />
        </div>
        <span className="text-[12px] text-[var(--ds-text-muted)] font-medium">
          {filtered.length} of {(items ?? []).length} items
        </span>
      </div>

      <div className="rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface)] overflow-hidden">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>HSN / Barcode</th>
              <th className="th-right">Sale rate</th>
              <th className="th-center">Status</th>
              <th className="th-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <Package className="empty-state-icon h-8 w-8 mx-auto opacity-30" />
                    <p className="empty-state-title">
                      {searchTerm ? "No items match your search" : "No items found"}
                    </p>
                    <p className="empty-state-sub">
                      {searchTerm ? "Try a different search term." : "Create your first item."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id}>
                  <td className="text-[12px] font-mono text-[var(--ds-text-default)]">
                    {item.code || "—"}
                  </td>
                  <td className="font-medium text-[12px] text-[var(--ds-text-default)]">
                    {item.name}
                    {item.nameNepali ? (
                      <span className="block text-[11px] font-normal text-[var(--ds-text-muted)]">
                        {item.nameNepali}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        item.type === "service"
                          ? "bg-[var(--ds-status-info-surface)] text-[var(--ds-status-info)]"
                          : "bg-[var(--ds-surface-muted)] text-[var(--ds-text-muted)]"
                      }`}
                    >
                      {item.type === "service" ? "Service" : "Product"}
                    </span>
                  </td>
                  <td className="text-[12px] text-[var(--ds-text-default)]">
                    {item.hsnCode || item.barcode || "—"}
                  </td>
                  <td className="number-cell">
                    {Number(item.salesRate ?? 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        item.isActive !== false
                          ? "bg-[var(--ds-status-success-surface)] text-[var(--ds-status-success)]"
                          : "bg-[var(--ds-status-neutral-surface)] text-[var(--ds-status-neutral)]"
                      }`}
                    >
                      {item.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        title="Edit"
                        className="text-[var(--ds-text-subtle)] hover:text-[var(--ds-action-primary)] transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[var(--ds-z-modal)] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[var(--ds-surface)] rounded-lg border border-[var(--ds-border-default)] w-full max-w-4xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-[var(--ds-border-default)] flex items-center justify-between bg-[var(--ds-surface-muted)] rounded-t-lg sticky top-0 z-10">
              <h2 className="text-[14px] font-semibold text-[var(--ds-text-default)]">
                {editingItem ? "Edit Item" : "New Item"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingItem(null);
                }}
                className="text-[var(--ds-text-subtle)] hover:text-[var(--ds-text-default)] font-bold text-[16px] leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-0">
              <ItemForm
                item={editingItem ?? undefined}
                onSave={handleSave}
                onCancel={() => {
                  setShowForm(false);
                  setEditingItem(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
