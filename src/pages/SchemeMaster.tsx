// src/pages/SchemeMaster.tsx
import React, { useState, useMemo } from "react";
import toast from "@/lib/appToast";
import { Plus, Search, X, Save } from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";
import {
  Button,
  PageHeader,
  PageMeta,
  EnterpriseDataTable,
  type EnterpriseColumnDef,
} from "@/design-system";

interface Scheme {
  id: string;
  name: string;
  type: "discount_percent" | "discount_amount" | "qty_bonus" | "flat_rate";
  discountPercent?: number;
  discountAmount?: number;
  minQty?: number;
  bonusQty?: number;
  applicableFrom: string;
  applicableTo: string;
  applicableItems: "all" | "specific";
  applicableParties: "all" | "specific";
  isActive: boolean;
  branchId?: string;
}

const DEFAULTS: Omit<Scheme, "id">[] = [
  {
    name: "10% Seasonal Discount",
    type: "discount_percent",
    discountPercent: 10,
    applicableFrom: "2024-01-01",
    applicableTo: "2024-03-31",
    applicableItems: "all",
    applicableParties: "all",
    isActive: true,
  },
  {
    name: "Buy 10 Get 1 Free",
    type: "qty_bonus",
    minQty: 10,
    bonusQty: 1,
    applicableFrom: "2024-01-01",
    applicableTo: "2024-12-31",
    applicableItems: "specific",
    applicableParties: "all",
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

const today = () => new Date().toISOString().split("T")[0];

const emptyForm = (): Omit<Scheme, "id"> => ({
  name: "",
  type: "discount_percent",
  discountPercent: 0,
  applicableFrom: today(),
  applicableTo: today(),
  applicableItems: "all",
  applicableParties: "all",
  isActive: true,
});

const typeLabel = (type: Scheme["type"]) =>
  type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const schemeValue = (scheme: Scheme) => {
  if (scheme.type === "discount_percent") return `${scheme.discountPercent ?? 0}%`;
  if (scheme.type === "discount_amount") return `₹${scheme.discountAmount ?? 0}`;
  if (scheme.type === "qty_bonus") return `Buy ${scheme.minQty ?? 0} Get ${scheme.bonusQty ?? 0}`;
  return "—";
};

export default function SchemeMaster() {
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [schemes, setSchemes] = useState<Scheme[]>(
    DEFAULTS.map((d, i) => ({ ...d, id: `sch-${i}` })),
  );
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Scheme | null>(null);
  const [form, setForm] = useState<Omit<Scheme, "id">>(emptyForm());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schemes.filter((scheme) => {
      if (!matchBranch(scheme.branchId)) return false;
      if (!q) return true;
      return (
        scheme.name.toLowerCase().includes(q) ||
        scheme.type.toLowerCase().includes(q) ||
        scheme.applicableItems.toLowerCase().includes(q) ||
        scheme.applicableParties.toLowerCase().includes(q)
      );
    });
  }, [schemes, search, matchBranch, branchFilter]);

  const columns = useMemo<EnterpriseColumnDef<Scheme>[]>(
    () => [
      {
        id: "name",
        header: "Scheme name",
        cell: (scheme) => (
          <span className="font-medium text-[12px] text-[var(--ds-text-default)]">{scheme.name}</span>
        ),
      },
      {
        id: "type",
        header: "Type",
        cell: (scheme) => (
          <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-[var(--ds-status-info-surface)] text-[var(--ds-status-info)]">
            {typeLabel(scheme.type)}
          </span>
        ),
      },
      {
        id: "value",
        header: "Value",
        align: "right",
        financial: true,
        cell: (scheme) => (
          <span className="font-mono text-[12px] text-[var(--ds-text-default)]">{schemeValue(scheme)}</span>
        ),
      },
      {
        id: "period",
        header: "Period",
        cell: (scheme) => (
          <span className="text-[11px] text-[var(--ds-text-muted)]">
            {scheme.applicableFrom} – {scheme.applicableTo}
          </span>
        ),
      },
      {
        id: "items",
        header: "Items",
        cell: (scheme) => <span className="capitalize text-[12px]">{scheme.applicableItems}</span>,
      },
      {
        id: "parties",
        header: "Parties",
        cell: (scheme) => <span className="capitalize text-[12px]">{scheme.applicableParties}</span>,
      },
      {
        id: "status",
        header: "Status",
        align: "center",
        cell: (scheme) => (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
              scheme.isActive
                ? "bg-[var(--ds-status-success-surface)] text-[var(--ds-status-success)]"
                : "bg-[var(--ds-status-neutral-surface)] text-[var(--ds-status-neutral)]"
            }`}
          >
            {scheme.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [],
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

  const openEdit = (item: Scheme) => {
    setEditItem(item);
    const { id, ...rest } = item;
    setForm(rest);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Name required");
      return;
    }
    if (editItem) {
      setSchemes((prev) =>
        prev.map((s) =>
          s.id === editItem.id
            ? {
                ...editItem,
                ...form,
                branchId: editItem.branchId || readActiveBranchId() || undefined,
              }
            : s,
        ),
      );
      toast.success("Scheme updated");
    } else {
      setSchemes((prev) => [
        ...prev,
        { ...form, id: `sch-${Date.now()}`, branchId: readActiveBranchId() || undefined },
      ]);
      toast.success("Scheme added");
    }
    resetForm();
  };

  const handleDelete = (item: Scheme) => {
    const snapshot = { ...item };
    setSchemes((prev) => prev.filter((s) => s.id !== item.id));
    toast.undo(`"${item.name}" deleted`, () => {
      setSchemes((prev) => [...prev, snapshot]);
    });
  };

  return (
    <div className="flex h-full min-h-0 bg-gray-50">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0 flex flex-col gap-3">
          <PageHeader
            title="Scheme / Offer Master"
            description="Configure promotional schemes, discounts, and offers for items and parties"
            meta={
              <PageMeta>
                {filtered.length} of {schemes.length} schemes
              </PageMeta>
            }
            primaryAction={
              <Button
                variant="primary"
                size="small"
                onClick={openAdd}
                startIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Add scheme
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
              placeholder="Search schemes..."
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
            getRowId={(scheme) => scheme.id}
            emptyTitle={search ? "No schemes match your search" : "No schemes configured"}
            emptyDescription={
              search
                ? "Try a different search term."
                : 'Click "Add scheme" to create your first promotional scheme.'
            }
            emptyAction={
              !search ? (
                <Button
                  variant="primary"
                  size="small"
                  onClick={openAdd}
                  startIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  Add scheme
                </Button>
              ) : undefined
            }
            onRowClick={openEdit}
            rowActions={(scheme) => [
              { label: "Edit", onSelect: () => openEdit(scheme) },
              { label: "Delete", destructive: true, onSelect: () => handleDelete(scheme) },
            ]}
            caption="Promotional schemes"
          />
        </div>
      </div>

      {showForm && (
        <div className="w-[400px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-700">
              {editItem ? "Edit scheme" : "Add scheme"}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div>
              <label className={labelCls}>Scheme name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className={inputCls}
                placeholder="e.g. Festival Discount 2024"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Scheme type</label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, type: e.target.value as Scheme["type"] }))
                  }
                  className={inputCls}
                >
                  <option value="discount_percent">Discount %</option>
                  <option value="discount_amount">Flat discount amount</option>
                  <option value="qty_bonus">Quantity bonus (free goods)</option>
                  <option value="flat_rate">Flat rate</option>
                </select>
              </div>
              {form.type === "discount_percent" && (
                <div>
                  <label className={labelCls}>Discount %</label>
                  <input
                    type="number"
                    value={form.discountPercent || 0}
                    onChange={(e) => setForm((p) => ({ ...p, discountPercent: +e.target.value }))}
                    className={`${inputCls} font-mono`}
                    min={0}
                    max={100}
                  />
                </div>
              )}
              {form.type === "discount_amount" && (
                <div>
                  <label className={labelCls}>Discount amount (₹)</label>
                  <input
                    type="number"
                    value={form.discountAmount || 0}
                    onChange={(e) => setForm((p) => ({ ...p, discountAmount: +e.target.value }))}
                    className={`${inputCls} font-mono`}
                    min={0}
                  />
                </div>
              )}
              {form.type === "qty_bonus" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Min qty</label>
                    <input
                      type="number"
                      value={form.minQty || 0}
                      onChange={(e) => setForm((p) => ({ ...p, minQty: +e.target.value }))}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Bonus qty</label>
                    <input
                      type="number"
                      value={form.bonusQty || 0}
                      onChange={(e) => setForm((p) => ({ ...p, bonusQty: +e.target.value }))}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>From date</label>
                <input
                  type="date"
                  value={form.applicableFrom}
                  onChange={(e) => setForm((p) => ({ ...p, applicableFrom: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>To date</label>
                <input
                  type="date"
                  value={form.applicableTo}
                  onChange={(e) => setForm((p) => ({ ...p, applicableTo: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Applicable items</label>
                <select
                  value={form.applicableItems}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      applicableItems: e.target.value as Scheme["applicableItems"],
                    }))
                  }
                  className={inputCls}
                >
                  <option value="all">All items</option>
                  <option value="specific">Specific items</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Applicable parties</label>
                <select
                  value={form.applicableParties}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      applicableParties: e.target.value as Scheme["applicableParties"],
                    }))
                  }
                  className={inputCls}
                >
                  <option value="all">All parties</option>
                  <option value="specific">Specific parties</option>
                </select>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
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
