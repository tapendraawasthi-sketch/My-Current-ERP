import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import toast from "@/lib/appToast";
import { Plus, Search, X, Save } from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";
import { useAppRoute, useNavigateApp } from "../routing/useAppRoute";
import {
  Button,
  PageHeader,
  PageMeta,
  EnterpriseDataTable,
  type EnterpriseColumnDef,
} from "@/design-system";

const DEFAULT_FORM = {
  name: "",
  alias: "",
  isPrimary: false,
  underGroupId: "",
  stockAccountId: "",
  salesAccountId: "",
  purchaseAccountId: "",
  hsnCode: "",
  taxCategoryId: "",
};

const btnPrimary =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-200 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

export default function ItemGroupMaster() {
  const {
    itemGroups,
    taxCategories,
    accounts,
    addItemGroup,
    updateItemGroup,
    deleteItemGroup,
    initLifecycle,
  } = useStore();
  const { branchFilter, matchBranch } = useBranchFilter();
  const route = useAppRoute();
  const { openEntity, clearEntity } = useNavigateApp();
  const pageId = route.pageId === "item-group-master" ? "item-group-master" : "item-groups";

  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);

  const filtered = useMemo(
    () =>
      (itemGroups || []).filter(
        (g: any) =>
          matchBranch(g.branchId) && g.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [itemGroups, search, matchBranch, branchFilter],
  );

  const ledgerAccounts = useMemo(() => (accounts || []).filter((a: any) => !a.isGroup), [accounts]);

  const parentName = (underGroupId: string) => {
    if (!underGroupId) return "—";
    return (itemGroups || []).find((p: any) => p.id === underGroupId)?.name || underGroupId;
  };

  const columns = useMemo<EnterpriseColumnDef<any>[]>(
    () => [
      {
        id: "name",
        header: "Group name",
        cell: (g) => (
          <span className="font-medium text-[12px] text-[var(--ds-text-default)]">{g.name}</span>
        ),
      },
      {
        id: "alias",
        header: "Alias",
        cell: (g) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">{g.alias || "—"}</span>
        ),
      },
      {
        id: "primary",
        header: "Primary",
        align: "center",
        cell: (g) => (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
              g.isPrimary ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
            }`}
          >
            {g.isPrimary ? "Yes" : "No"}
          </span>
        ),
      },
      {
        id: "parent",
        header: "Parent group",
        cell: (g) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">
            {parentName(g.underGroupId)}
          </span>
        ),
      },
      {
        id: "hsn",
        header: "HSN code",
        cell: (g) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">{g.hsnCode || "—"}</span>
        ),
      },
    ],
    [itemGroups],
  );

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setSelected(null);
    setShowForm(false);
    clearEntity(pageId);
  };

  const handleOpenCreate = () => {
    setForm(DEFAULT_FORM);
    setSelected(null);
    setShowForm(true);
    openEntity(pageId, "new");
  };

  const handleEdit = (g: any) => {
    setSelected(g);
    setForm({
      name: g.name || "",
      alias: g.alias || "",
      isPrimary: g.isPrimary || false,
      underGroupId: g.underGroupId || "",
      stockAccountId: g.stockAccountId || "",
      salesAccountId: g.salesAccountId || "",
      purchaseAccountId: g.purchaseAccountId || "",
      hsnCode: g.hsnCode || "",
      taxCategoryId: g.taxCategoryId || "",
    });
    setShowForm(true);
    openEntity(pageId, g.id);
  };

  // Deep link: /app/item-groups/:id | /app/item-groups/new
  useEffect(() => {
    if (route.pageId !== "item-groups" && route.pageId !== "item-group-master") return;
    if (route.entityId === "new") {
      setSelected(null);
      setForm(DEFAULT_FORM);
      setShowForm(true);
      return;
    }
    if (route.entityId) {
      const group = (itemGroups || []).find((g: any) => g.id === route.entityId);
      if (group) {
        setSelected(group);
        setForm({
          name: group.name || "",
          alias: group.alias || "",
          isPrimary: group.isPrimary || false,
          underGroupId: group.underGroupId || "",
          stockAccountId: group.stockAccountId || "",
          salesAccountId: group.salesAccountId || "",
          purchaseAccountId: group.purchaseAccountId || "",
          hsnCode: group.hsnCode || "",
          taxCategoryId: group.taxCategoryId || "",
        });
        setShowForm(true);
      }
      return;
    }
    if (showForm) setShowForm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.pageId, route.entityId, itemGroups]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Group name is required.");
      return;
    }
    const payload = {
      ...form,
      branchId: selected?.branchId || readActiveBranchId() || undefined,
    };
    try {
      if (selected) {
        await updateItemGroup(selected.id, payload);
        toast.success("Item group updated.");
      } else {
        await addItemGroup(payload);
        toast.success("Item group saved.");
      }
      resetForm();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save item group.");
    }
  };

  const handleDelete = async (g: any) => {
    const snapshot = { ...g };
    try {
      await deleteItemGroup(g.id);
      if (selected?.id === g.id) resetForm();
      toast.undo(`"${g.name}" deleted`, async () => {
        try {
          const { id, ...rest } = snapshot;
          await addItemGroup({ ...rest, id });
        } catch (err: any) {
          toast.error(err?.message || "Failed to restore item group.");
        }
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete item group.");
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-gray-50">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0 flex flex-col gap-3">
          <PageHeader
            title="Item Groups"
            description="Group stock items for reporting, defaults, and tax mapping"
            meta={
              <PageMeta>
                {filtered.length} of {(itemGroups || []).length} groups
              </PageMeta>
            }
            primaryAction={
              <Button
                variant="primary"
                size="small"
                onClick={handleOpenCreate}
                startIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Add group
              </Button>
            }
          />

          <div className="relative max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              placeholder="Search groups..."
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
            getRowId={(g) => g.id}
            loading={itemGroups == null || initLifecycle === "loading"}
            emptyTitle={search ? "No item groups match your search" : "No item groups found"}
            emptyDescription={
              search
                ? "Try a different search term."
                : 'Click "Add group" to create your first item group.'
            }
            emptyAction={
              !search ? (
                <Button
                  variant="primary"
                  size="small"
                  onClick={handleOpenCreate}
                  startIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  Add group
                </Button>
              ) : undefined
            }
            onRowClick={handleEdit}
            rowActions={(g) => [
              { label: "Edit", onSelect: () => handleEdit(g) },
              { label: "Delete", destructive: true, onSelect: () => handleDelete(g) },
            ]}
            caption="Item groups"
          />
        </div>
      </div>

      {showForm && (
        <div className="w-[360px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-700">
              {selected ? "Edit item group" : "Add item group"}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {[
              { label: "Group name", key: "name", required: true },
              { label: "Alias", key: "alias" },
              { label: "HSN code", key: "hsnCode" },
            ].map(({ label, key, required }) => (
              <div key={key}>
                <label className={labelCls}>
                  {label}
                  {required ? " *" : ""}
                </label>
                <input
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className={inputCls}
                />
              </div>
            ))}

            <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={(e) =>
                  setForm({ ...form, isPrimary: e.target.checked, underGroupId: "" })
                }
                className="rounded border-[var(--ds-border-default)]"
              />
              Primary group (top-level)
            </label>

            {!form.isPrimary && (
              <div>
                <label className={labelCls}>Under group</label>
                <select
                  value={form.underGroupId}
                  onChange={(e) => setForm({ ...form, underGroupId: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Select parent</option>
                  {(itemGroups || [])
                    .filter((g: any) => g.id !== selected?.id)
                    .map((g: any) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {[
              { label: "Stock account", key: "stockAccountId" },
              { label: "Sales account", key: "salesAccountId" },
              { label: "Purchase account", key: "purchaseAccountId" },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className={labelCls}>{label}</label>
                <select
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className={inputCls}
                >
                  <option value="">None</option>
                  {ledgerAccounts.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            <div>
              <label className={labelCls}>Tax category</label>
              <select
                value={form.taxCategoryId}
                onChange={(e) => setForm({ ...form, taxCategoryId: e.target.value })}
                className={inputCls}
              >
                <option value="">None</option>
                {(taxCategories || []).map((tc: any) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 p-4 border-t border-gray-200">
            <button type="button" className={btnPrimary} onClick={handleSubmit}>
              <Save className="h-3.5 w-3.5" />
              {selected ? "Update" : "Save"}
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
