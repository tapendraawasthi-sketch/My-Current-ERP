// src/pages/TaxCategoryMaster.tsx
import React, { useState, useEffect, useMemo } from "react";
import toast from "@/lib/appToast";
import { Plus, Search, X, Save } from "lucide-react";
import { ITCEligibility } from "../lib/busyTypes";
import { getDB } from "../lib/db";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";
import {
  Button,
  PageHeader,
  PageMeta,
  EnterpriseDataTable,
  type EnterpriseColumnDef,
} from "@/design-system";

interface TaxCategory {
  id: string;
  name: string;
  taxRate: number;
  type: "local" | "central" | "igst";
  changeTaxRateOnBasisOfPrice: boolean;
  hsnSacCode?: string;
  itcEligibility: ITCEligibility;
  isActive: boolean;
  branchId?: string;
}

const DEFAULTS: Omit<TaxCategory, "id">[] = [
  {
    name: "GST 5%",
    taxRate: 5,
    type: "local",
    changeTaxRateOnBasisOfPrice: false,
    itcEligibility: ITCEligibility.INPUT_GOODS,
    isActive: true,
  },
  {
    name: "GST 12%",
    taxRate: 12,
    type: "local",
    changeTaxRateOnBasisOfPrice: false,
    itcEligibility: ITCEligibility.INPUT_GOODS,
    isActive: true,
  },
  {
    name: "GST 18%",
    taxRate: 18,
    type: "local",
    changeTaxRateOnBasisOfPrice: false,
    itcEligibility: ITCEligibility.INPUT_GOODS,
    isActive: true,
  },
  {
    name: "GST 28%",
    taxRate: 28,
    type: "local",
    changeTaxRateOnBasisOfPrice: false,
    itcEligibility: ITCEligibility.INPUT_GOODS,
    isActive: true,
  },
  {
    name: "VAT 13%",
    taxRate: 13,
    type: "local",
    changeTaxRateOnBasisOfPrice: false,
    itcEligibility: ITCEligibility.INPUT_GOODS,
    isActive: true,
  },
  {
    name: "NIL Rated",
    taxRate: 0,
    type: "local",
    changeTaxRateOnBasisOfPrice: false,
    itcEligibility: ITCEligibility.NONE,
    isActive: true,
  },
  {
    name: "Exempt",
    taxRate: 0,
    type: "local",
    changeTaxRateOnBasisOfPrice: false,
    itcEligibility: ITCEligibility.NONE,
    isActive: true,
  },
];

const btnPrimary =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

const emptyForm = (): Omit<TaxCategory, "id"> => ({
  name: "",
  taxRate: 18,
  type: "local",
  changeTaxRateOnBasisOfPrice: false,
  hsnSacCode: "",
  itcEligibility: ITCEligibility.INPUT_GOODS,
  isActive: true,
});

export default function TaxCategoryMaster() {
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [items, setItems] = useState<TaxCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<TaxCategory | null>(null);
  const [form, setForm] = useState<Omit<TaxCategory, "id">>(emptyForm());

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const db = getDB();
      if (db.taxCategories) {
        const data = await db.taxCategories.toArray();
        if (data.length === 0) {
          const seeded = DEFAULTS.map((d, i) => ({ ...d, id: `tc-${i}` }));
          await db.taxCategories.bulkPut(seeded);
          setItems(seeded);
        } else setItems(data);
      } else {
        setItems(DEFAULTS.map((d, i) => ({ ...d, id: `tc-${i}` })));
      }
    } catch {
      setItems(DEFAULTS.map((d, i) => ({ ...d, id: `tc-${i}` })));
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (!matchBranch(item.branchId)) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        (item.hsnSacCode || "").toLowerCase().includes(q)
      );
    });
  }, [items, search, matchBranch, branchFilter]);

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

  const openEdit = (item: TaxCategory) => {
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
        const updated = {
          ...editItem,
          ...form,
          branchId: editItem.branchId || readActiveBranchId() || undefined,
        };
        if (db.taxCategories) await db.taxCategories.put(updated);
        setItems((prev) => prev.map((i) => (i.id === editItem.id ? updated : i)));
        toast.success("Tax Category updated");
      } else {
        const newItem: TaxCategory = {
          ...form,
          id: `tc-${Date.now()}`,
          branchId: readActiveBranchId() || undefined,
        };
        if (db.taxCategories) await db.taxCategories.put(newItem);
        setItems((prev) => [...prev, newItem]);
        toast.success("Tax Category added");
      }
      resetForm();
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleDelete = async (item: TaxCategory) => {
    const snapshot = { ...item };
    try {
      const db = getDB();
      if (db.taxCategories) await db.taxCategories.delete(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.undo(`"${item.name}" deleted`, async () => {
        try {
          if (db.taxCategories) await db.taxCategories.put(snapshot);
          setItems((prev) => [...prev, snapshot]);
        } catch {
          toast.error("Failed to restore tax category");
        }
      });
    } catch {
      toast.error("Failed to delete");
    }
  };

  const columns = useMemo<EnterpriseColumnDef<TaxCategory>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (item) => (
          <span className="font-medium text-[12px] text-[var(--ds-text-default)]">{item.name}</span>
        ),
      },
      {
        id: "taxRate",
        header: "Rate %",
        align: "right",
        financial: true,
        cell: (item) => <span className="ds-financial-value">{item.taxRate}%</span>,
      },
      {
        id: "type",
        header: "Type",
        cell: (item) => (
          <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-[var(--ds-surface-muted)] text-[var(--ds-text-muted)] capitalize">
            {item.type}
          </span>
        ),
      },
      {
        id: "hsnSacCode",
        header: "HSN/SAC",
        cell: (item) => (
          <span className="font-mono text-[12px] text-[var(--ds-text-muted)]">
            {item.hsnSacCode || "—"}
          </span>
        ),
      },
      {
        id: "itcEligibility",
        header: "ITC eligibility",
        cell: (item) => (
          <span className="capitalize text-[12px] text-[var(--ds-text-default)]">
            {item.itcEligibility.replace(/_/g, " ")}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        align: "center",
        cell: (item) => (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
              item.isActive
                ? "bg-[var(--ds-status-success-surface)] text-[var(--ds-status-success)]"
                : "bg-[var(--ds-status-danger-surface)] text-[var(--ds-status-danger)]"
            }`}
          >
            {item.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex h-full min-h-0 bg-gray-50">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0 flex flex-col gap-3">
          <PageHeader
            title="Tax Category Master"
            description="GST 5%, 12%, 18%, 28%, VAT 13%, NIL, exempt tax categories"
            meta={
              <PageMeta>
                {filtered.length} of {items.length} tax categories
              </PageMeta>
            }
            primaryAction={
              <Button
                variant="primary"
                size="small"
                onClick={openAdd}
                startIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Add tax category
              </Button>
            }
            secondaryActions={[
              ...(branchOptions.length > 0
                ? [
                    <select
                      key="branch"
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-lg bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                      aria-label="Branch"
                    >
                      <option value="all">All branches</option>
                      {branchOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name || b.code || b.id}
                        </option>
                      ))}
                    </select>,
                  ]
                : []),
            ]}
          />

          <div className="relative max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-subtle)] pointer-events-none" />
            <input
              placeholder="Search tax categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputCls} pl-8`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
          <EnterpriseDataTable
            columns={columns}
            rows={filtered}
            getRowId={(item) => item.id}
            loading={loading}
            emptyTitle={search ? "No tax categories match your search" : "No tax categories found"}
            emptyDescription={
              search
                ? "Try a different search term."
                : 'Click "Add tax category" to create your first tax category.'
            }
            emptyAction={
              !search ? (
                <Button
                  variant="primary"
                  size="small"
                  onClick={openAdd}
                  startIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  Add tax category
                </Button>
              ) : undefined
            }
            onRowClick={openEdit}
            rowActions={(item) => [
              { label: "Edit", onSelect: () => openEdit(item) },
              { label: "Delete", destructive: true, onSelect: () => handleDelete(item) },
            ]}
            caption="Tax categories"
          />
        </div>
      </div>

      {showForm && (
        <div className="w-[400px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-700">
              {editItem ? "Edit tax category" : "Add tax category"}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div>
              <label className={labelCls}>Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className={inputCls}
                placeholder="e.g. GST 18%, VAT 13%"
              />
            </div>
            <div>
              <label className={labelCls}>Tax rate (%)</label>
              <input
                type="number"
                value={form.taxRate}
                onChange={(e) => setForm((p) => ({ ...p, taxRate: +e.target.value }))}
                className={`${inputCls} font-mono`}
                min={0}
                max={100}
                step={0.01}
              />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((p) => ({ ...p, type: e.target.value as TaxCategory["type"] }))
                }
                className={inputCls}
              >
                <option value="local">Local (CGST+SGST)</option>
                <option value="central">Central (IGST)</option>
                <option value="igst">IGST</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>HSN/SAC code (optional)</label>
              <input
                value={form.hsnSacCode || ""}
                onChange={(e) => setForm((p) => ({ ...p, hsnSacCode: e.target.value }))}
                className={`${inputCls} font-mono`}
                placeholder="e.g. 9954, 3004"
              />
            </div>
            <div>
              <label className={labelCls}>ITC eligibility</label>
              <select
                value={form.itcEligibility}
                onChange={(e) =>
                  setForm((p) => ({ ...p, itcEligibility: e.target.value as ITCEligibility }))
                }
                className={inputCls}
              >
                <option value={ITCEligibility.INPUT_GOODS}>Input goods</option>
                <option value={ITCEligibility.INPUT_SERVICES}>Input services</option>
                <option value={ITCEligibility.CAPITAL_GOODS}>Capital goods</option>
                <option value={ITCEligibility.NONE}>None</option>
                <option value={ITCEligibility.INELIGIBLE}>Ineligible</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  checked={form.changeTaxRateOnBasisOfPrice}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, changeTaxRateOnBasisOfPrice: e.target.checked }))
                  }
                  className="rounded border-gray-300 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                />
                Change tax rate on basis of price (slab)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="rounded border-gray-300 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                />
                Active
              </label>
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
