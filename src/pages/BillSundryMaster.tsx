// src/pages/BillSundryMaster.tsx
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import toast from "@/lib/appToast";
import { Plus, Search, X, Save } from "lucide-react";
import { BillSundryType, BillSundryNature } from "../lib/busyTypes";
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
  branchId?: string;
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

const btnPrimary =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
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
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
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
    () =>
      billSundries.filter(
        (b) =>
          matchBranch(b.branchId) && b.name.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [billSundries, searchTerm, matchBranch, branchFilter],
  );

  const columns = useMemo<EnterpriseColumnDef<BillSundry>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (item) => (
          <span className="font-medium text-[12px] text-[var(--ds-text-default)]">{item.name}</span>
        ),
      },
      {
        id: "type",
        header: "Type",
        cell: (item) => (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
              item.type === BillSundryType.ADDITIVE
                ? "bg-[var(--ds-status-success-surface)] text-[var(--ds-status-success)]"
                : "bg-[var(--ds-status-danger-surface)] text-[var(--ds-status-danger)]"
            }`}
          >
            {item.type === BillSundryType.ADDITIVE ? "Additive" : "Deductive"}
          </span>
        ),
      },
      {
        id: "nature",
        header: "Nature",
        cell: (item) => (
          <span className="capitalize text-[12px] text-[var(--ds-text-default)]">
            {item.nature.replace(/_/g, " ")}
          </span>
        ),
      },
      {
        id: "costSale",
        header: "Cost (sale)",
        align: "center",
        cell: (item) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">
            {item.affectCostInSale ? "✓" : "—"}
          </span>
        ),
      },
      {
        id: "costPurchase",
        header: "Cost (purchase)",
        align: "center",
        cell: (item) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">
            {item.affectCostInPurchase ? "✓" : "—"}
          </span>
        ),
      },
      {
        id: "gst",
        header: "GST",
        align: "center",
        cell: (item) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">
            {item.gstApplicable ? "✓" : "—"}
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
        const updated = {
          ...editItem,
          ...form,
          branchId: editItem.branchId || readActiveBranchId() || undefined,
        };
        if (db.billSundries) await db.billSundries.put(updated);
        setBillSundries((prev) => prev.map((b) => (b.id === editItem.id ? updated : b)));
        toast.success("Bill Sundry updated");
      } else {
        const newItem: BillSundry = {
          ...form,
          id: `bs-${Date.now()}`,
          branchId: readActiveBranchId() || undefined,
        };
        if (db.billSundries) await db.billSundries.put(newItem);
        setBillSundries((prev) => [...prev, newItem]);
        toast.success("Bill Sundry added");
      }
      resetForm();
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleDelete = async (item: BillSundry) => {
    const snapshot = { ...item };
    try {
      const db = getDB();
      if (db.billSundries) await db.billSundries.delete(item.id);
      setBillSundries((prev) => prev.filter((b) => b.id !== item.id));
      toast.undo(`"${item.name}" deleted`, async () => {
        try {
          if (db.billSundries) await db.billSundries.put(snapshot);
          setBillSundries((prev) => [...prev, snapshot]);
        } catch {
          toast.error("Failed to restore bill sundry");
        }
      });
    } catch {
      toast.error("Failed to delete");
    }
  };

  const F = form;
  const setF = (k: keyof typeof form, v: any) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="flex h-full min-h-0 bg-gray-50">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0 flex flex-col gap-3">
          <PageHeader
            title="Bill Sundry Master"
            description="Freight, discount, round off, packing and other charges"
            meta={
              <PageMeta>
                {filtered.length} of {billSundries.length} bill sundries
              </PageMeta>
            }
            primaryAction={
              <Button
                variant="primary"
                size="small"
                onClick={openAdd}
                startIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Add bill sundry
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search bill sundries..."
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
            emptyTitle={searchTerm ? "No bill sundries match your search" : "No bill sundries found"}
            emptyDescription={
              searchTerm
                ? "Try a different search term."
                : 'Click "Add bill sundry" to create a charge type.'
            }
            emptyAction={
              !searchTerm ? (
                <Button
                  variant="primary"
                  size="small"
                  onClick={openAdd}
                  startIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  Add bill sundry
                </Button>
              ) : undefined
            }
            onRowClick={openEdit}
            rowActions={(item) => [
              { label: "Edit", onSelect: () => openEdit(item) },
              { label: "Delete", destructive: true, onSelect: () => handleDelete(item) },
            ]}
            caption="Bill sundries"
          />
        </div>
      </div>

      {showForm && (
        <div className="w-[400px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-700">
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
            <div className="grid grid-cols-1 gap-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
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
