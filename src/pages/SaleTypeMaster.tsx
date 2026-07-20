// src/pages/SaleTypeMaster.tsx
import React, { useState, useEffect, useMemo } from "react";
import toast from "@/lib/appToast";
import { Plus, Search, X, Save } from "lucide-react";
import { SaleType } from "../lib/busyTypes";
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

interface SaleTypeMasterItem {
  id: string;
  name: string;
  saleType: SaleType;
  defaultTaxRate: number;
  isDefault: boolean;
  isActive: boolean;
  branchId?: string;
}

const SALE_TYPE_OPTIONS = [
  { value: SaleType.LOCAL_GST_5, label: "L/GST-5% (Local CGST+SGST 5%)" },
  { value: SaleType.LOCAL_GST_12, label: "L/GST-12% (Local CGST+SGST 12%)" },
  { value: SaleType.LOCAL_GST_18, label: "L/GST-18% (Local CGST+SGST 18%)" },
  { value: SaleType.LOCAL_GST_28, label: "L/GST-28% (Local CGST+SGST 28%)" },
  { value: SaleType.CENTRAL_GST_5, label: "C/GST-5% (Interstate IGST 5%)" },
  { value: SaleType.CENTRAL_GST_12, label: "C/GST-12% (Interstate IGST 12%)" },
  { value: SaleType.CENTRAL_GST_18, label: "C/GST-18% (Interstate IGST 18%)" },
  { value: SaleType.CENTRAL_GST_28, label: "C/GST-28% (Interstate IGST 28%)" },
  { value: SaleType.EXPORT, label: "Export (Zero-rated)" },
  { value: SaleType.ITEMWISE, label: "Itemwise (Tax from item master)" },
  { value: SaleType.MULTIRATE, label: "Multirate (Multiple tax rates)" },
  { value: SaleType.SINGLE_RATE, label: "Single Rate (One rate for invoice)" },
  { value: SaleType.NIL_RATED, label: "Nil Rated" },
  { value: SaleType.EXEMPT, label: "Exempt" },
  { value: SaleType.NON_GST, label: "Non-GST" },
  { value: SaleType.CONSUMER, label: "Consumer (B2C)" },
];

const DEFAULTS: Omit<SaleTypeMasterItem, "id">[] = [
  {
    name: "Local Sale GST 13%",
    saleType: SaleType.LOCAL_GST_18,
    defaultTaxRate: 13,
    isDefault: true,
    isActive: true,
  },
  {
    name: "Export Sale",
    saleType: SaleType.EXPORT,
    defaultTaxRate: 0,
    isDefault: false,
    isActive: true,
  },
  {
    name: "Nil Rated Sale",
    saleType: SaleType.NIL_RATED,
    defaultTaxRate: 0,
    isDefault: false,
    isActive: true,
  },
  {
    name: "Exempt Sale",
    saleType: SaleType.EXEMPT,
    defaultTaxRate: 0,
    isDefault: false,
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

const emptyForm = (): Omit<SaleTypeMasterItem, "id"> => ({
  name: "",
  saleType: SaleType.LOCAL_GST_18,
  defaultTaxRate: 13,
  isDefault: false,
  isActive: true,
});

export default function SaleTypeMaster() {
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [items, setItems] = useState<SaleTypeMasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<SaleTypeMasterItem | null>(null);
  const [form, setForm] = useState<Omit<SaleTypeMasterItem, "id">>(emptyForm());

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const db = getDB();
      if (db.saleTypes) {
        const data = await db.saleTypes.toArray();
        if (data.length === 0) {
          const seeded = DEFAULTS.map((d, i) => ({ ...d, id: `st-${i}` }));
          await db.saleTypes.bulkPut(seeded);
          setItems(seeded);
        } else setItems(data);
      } else {
        setItems(DEFAULTS.map((d, i) => ({ ...d, id: `st-${i}` })));
      }
    } catch {
      setItems(DEFAULTS.map((d, i) => ({ ...d, id: `st-${i}` })));
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (!matchBranch(item.branchId)) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || item.saleType.toLowerCase().includes(q);
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

  const openEdit = (item: SaleTypeMasterItem) => {
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
        if (db.saleTypes) await db.saleTypes.put(updated);
        setItems((prev) => prev.map((i) => (i.id === editItem.id ? updated : i)));
        toast.success("Sale Type updated");
      } else {
        const newItem: SaleTypeMasterItem = {
          ...form,
          id: `st-${Date.now()}`,
          branchId: readActiveBranchId() || undefined,
        };
        if (db.saleTypes) await db.saleTypes.put(newItem);
        setItems((prev) => [...prev, newItem]);
        toast.success("Sale Type added");
      }
      resetForm();
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleDelete = async (item: SaleTypeMasterItem) => {
    const snapshot = { ...item };
    try {
      const db = getDB();
      if (db.saleTypes) await db.saleTypes.delete(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.undo(`"${item.name}" deleted`, async () => {
        try {
          if (db.saleTypes) await db.saleTypes.put(snapshot);
          setItems((prev) => [...prev, snapshot]);
        } catch {
          toast.error("Failed to restore sale type");
        }
      });
    } catch {
      toast.error("Failed to delete");
    }
  };

  const saleTypeLabel = (value: SaleType) =>
    SALE_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;

  const columns = useMemo<EnterpriseColumnDef<SaleTypeMasterItem>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (item) => (
          <span className="font-medium text-[12px] text-[var(--ds-text-default)]">{item.name}</span>
        ),
      },
      {
        id: "saleType",
        header: "Sale type",
        cell: (item) => (
          <span className="text-[11px] text-[var(--ds-text-muted)]">{saleTypeLabel(item.saleType)}</span>
        ),
      },
      {
        id: "defaultTaxRate",
        header: "Tax rate %",
        align: "right",
        financial: true,
        cell: (item) => (
          <span className="ds-financial-value">{item.defaultTaxRate}%</span>
        ),
      },
      {
        id: "isDefault",
        header: "Default",
        align: "center",
        cell: (item) =>
          item.isDefault ? (
            <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-[var(--ds-status-info-surface)] text-[var(--ds-status-info)]">
              Yes
            </span>
          ) : (
            <span className="text-[12px] text-[var(--ds-text-subtle)]">—</span>
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
            title="Sale Type Master"
            description="Configure sale types: local GST, central GST, export, itemwise, etc."
            meta={
              <PageMeta>
                {filtered.length} of {items.length} sale types
              </PageMeta>
            }
            primaryAction={
              <Button
                variant="primary"
                size="small"
                onClick={openAdd}
                startIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Add sale type
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
              placeholder="Search sale types..."
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
            emptyTitle={search ? "No sale types match your search" : "No sale types configured"}
            emptyDescription={
              search
                ? "Try a different search term."
                : 'Click "Add sale type" to create your first sale type.'
            }
            emptyAction={
              !search ? (
                <Button
                  variant="primary"
                  size="small"
                  onClick={openAdd}
                  startIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  Add sale type
                </Button>
              ) : undefined
            }
            onRowClick={openEdit}
            rowActions={(item) => [
              { label: "Edit", onSelect: () => openEdit(item) },
              { label: "Delete", destructive: true, onSelect: () => handleDelete(item) },
            ]}
            caption="Sale types"
          />
        </div>
      </div>

      {showForm && (
        <div className="w-[360px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-700">
              {editItem ? "Edit sale type" : "Add sale type"}
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
                placeholder="e.g. Local Sale GST 18%"
              />
            </div>
            <div>
              <label className={labelCls}>Sale type</label>
              <select
                value={form.saleType}
                onChange={(e) => setForm((p) => ({ ...p, saleType: e.target.value as SaleType }))}
                className={inputCls}
              >
                {SALE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Default tax rate (%)</label>
              <input
                type="number"
                value={form.defaultTaxRate}
                onChange={(e) => setForm((p) => ({ ...p, defaultTaxRate: +e.target.value }))}
                className={`${inputCls} font-mono`}
                min={0}
                max={100}
              />
            </div>
            <div className="flex flex-col gap-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
              {[
                { key: "isDefault", label: "Set as default" },
                { key: "isActive", label: "Active" },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={!!(form as any)[key]}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))}
                    className="rounded border-gray-300 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
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
