/**
 * Item Master — create / edit stock items (Wave D / Function 8).
 * Canonical for nav `items` / `item-master`. Stock ledger stays on `stock-book` / `stock-ledger`.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Package, Plus, Search } from "lucide-react";
import { useStore } from "../store/useStore";
import type { Item } from "../lib/types";
import ItemForm from "../components/item/ItemForm";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";
import { useAppRoute, useNavigateApp } from "../routing/useAppRoute";
import { formatCurrency } from "../lib/utils";
import {
  Button,
  PageHeader,
  PageMeta,
  EnterpriseDataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  type EnterpriseColumnDef,
} from "@/design-system";

export default function ItemMaster() {
  const { items, addItem, updateItem, initLifecycle } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const route = useAppRoute();
  const { openEntity, clearEntity } = useNavigateApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const pageId = route.pageId === "items" ? "items" : "item-master";

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
    openEntity(pageId, "new");
  };

  const openEdit = (item: Item) => {
    setEditingItem(item);
    setShowForm(true);
    openEntity(pageId, item.id);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    clearEntity(pageId);
  };

  // Deep link: /app/items/:id | /app/item-master/new
  useEffect(() => {
    if (route.pageId !== "items" && route.pageId !== "item-master") return;
    if (route.entityId === "new") {
      setEditingItem(null);
      setShowForm(true);
      return;
    }
    if (route.entityId) {
      const item = (items ?? []).find((i) => i.id === route.entityId);
      if (item) {
        setEditingItem(item);
        setShowForm(true);
      }
      return;
    }
    if (showForm) setShowForm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.pageId, route.entityId, items]);

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
      closeForm();
    } catch (err) {
      console.error(err);
    }
  };

  const columns = useMemo<EnterpriseColumnDef<Item>[]>(
    () => [
      {
        id: "code",
        header: "Code",
        cell: (item) => (
          <span className="text-[12px] font-mono text-[var(--ds-text-default)]">{item.code || "—"}</span>
        ),
      },
      {
        id: "name",
        header: "Name",
        cell: (item) => (
          <span className="font-medium text-[12px] text-[var(--ds-text-default)]">
            {item.name}
            {item.nameNepali ? (
              <span className="block text-[11px] font-normal text-[var(--ds-text-muted)]">
                {item.nameNepali}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "type",
        header: "Type",
        cell: (item) => (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
              item.type === "service"
                ? "bg-[var(--ds-status-info-surface)] text-[var(--ds-status-info)]"
                : "bg-[var(--ds-surface-muted)] text-[var(--ds-text-muted)]"
            }`}
          >
            {item.type === "service" ? "Service" : "Product"}
          </span>
        ),
      },
      {
        id: "hsn",
        header: "HSN / Barcode",
        cell: (item) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">
            {item.hsnCode || item.barcode || "—"}
          </span>
        ),
      },
      {
        id: "rate",
        header: "Sale rate",
        align: "right",
        financial: true,
        cell: (item) => (
          <span className="ds-financial-value">{formatCurrency(item.salesRate ?? 0)}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        align: "center",
        cell: (item) => (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
              item.isActive !== false
                ? "bg-[var(--ds-status-success-surface)] text-[var(--ds-status-success)]"
                : "bg-[var(--ds-status-neutral-surface)] text-[var(--ds-status-neutral)]"
            }`}
          >
            {item.isActive !== false ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-4 select-none pb-8">
      <PageHeader
        title="Item Master"
        description="Products and services you buy or sell."
        meta={
          <PageMeta>
            {filtered.length} of {(items ?? []).length} items
          </PageMeta>
        }
        primaryAction={
          <Button
            variant="primary"
            size="small"
            onClick={openCreate}
            startIcon={<Plus className="h-3.5 w-3.5" />}
          >
            New Item
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

      <div className="relative w-fit">
        <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-subtle)] pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, code, barcode, HSN…"
          className="h-8 pl-8 pr-3 text-[12px] border border-[var(--ds-border-default)] rounded-lg bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-72"
        />
      </div>

      <EnterpriseDataTable
        columns={columns}
        rows={filtered}
        getRowId={(item) => item.id}
        loading={items == null || initLifecycle === "loading"}
        emptyIcon={<Package className="h-4 w-4" aria-hidden />}
        emptyTitle={searchTerm ? "No items match your search" : "No stock items yet"}
        emptyDescription={
          searchTerm
            ? "Nothing matches that search. Clear it or try a different name or code."
            : "Create items so billing and stock reports have products to track."
        }
        emptyAction={
          searchTerm ? (
            <Button variant="secondary" size="small" onClick={() => setSearchTerm("")}>
              Clear search
            </Button>
          ) : (
            <Button
              variant="primary"
              size="small"
              onClick={openCreate}
              startIcon={<Plus className="h-3.5 w-3.5" />}
            >
              New item
            </Button>
          )
        }
        onRowClick={openEdit}
        rowActions={(item) => [{ label: "Edit", onSelect: () => openEdit(item) }]}
        caption="Stock items"
      />

      <Dialog open={showForm} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent size="extra-large" showClose>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "New Item"}</DialogTitle>
          </DialogHeader>
          <DialogBody className="p-0 px-0">
            <ItemForm
              item={editingItem ?? undefined}
              onSave={handleSave}
              onCancel={closeForm}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
