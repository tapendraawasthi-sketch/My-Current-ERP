// src/pages/MiscMasters.tsx
import React, { useState, useEffect, useMemo } from "react";
import toast from "@/lib/appToast";
import { Plus, MapPin, Layers, DollarSign, Search, X, Save } from "lucide-react";
import { getDB } from "../lib/db";
import { ReportEmptyState } from "../components/ReportEmptyState";
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

interface MaterialCentre {
  id: string;
  code: string;
  name: string;
  address?: string;
  isDefault: boolean;
  isActive: boolean;
  branchId?: string;
}

interface BOMItem {
  id: string;
  name: string;
  finishedItemName: string;
  finishedQty: number;
  finishedUnit: string;
  components: { itemName: string; quantity: number; unit: string }[];
  isActive: boolean;
}

interface PriceListItem {
  id: string;
  name: string;
  category: string;
  description: string;
  isActive: boolean;
  branchId?: string;
}

type ActiveTab = "material-centres" | "bom" | "price-lists";
type FormMode = "mc" | "pl" | null;

const btnPrimary =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-200 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

const emptyMCForm = (): Omit<MaterialCentre, "id"> => ({
  code: "",
  name: "",
  address: "",
  isDefault: false,
  isActive: true,
});

const emptyPLForm = (): Omit<PriceListItem, "id"> => ({
  name: "",
  category: "A",
  description: "",
  isActive: true,
});

export default function MiscMasters() {
  const { branchFilter, matchBranch } = useBranchFilter();
  const route = useAppRoute();
  const { openEntity, clearEntity } = useNavigateApp();
  const pageId = "misc-masters";

  const [activeTab, setActiveTab] = useState<ActiveTab>("material-centres");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState<FormMode>(null);
  const [loading, setLoading] = useState(true);
  const [materialCentres, setMaterialCentres] = useState<MaterialCentre[]>([]);
  const [bomItems] = useState<BOMItem[]>([]);
  const [priceLists, setPriceLists] = useState<PriceListItem[]>([]);

  const [editMC, setEditMC] = useState<MaterialCentre | null>(null);
  const [mcForm, setMCForm] = useState<Omit<MaterialCentre, "id">>(emptyMCForm());

  const [editPL, setEditPL] = useState<PriceListItem | null>(null);
  const [plForm, setPLForm] = useState<Omit<PriceListItem, "id">>(emptyPLForm());

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const db = getDB();
      if (db.warehouses) {
        const wh = await db.warehouses.toArray();
        setMaterialCentres(
          wh.length > 0
            ? (wh as MaterialCentre[])
            : [
                {
                  id: "mc-1",
                  code: "WH-MAIN",
                  name: "Main Warehouse",
                  isDefault: true,
                  isActive: true,
                },
                {
                  id: "mc-2",
                  code: "WH-BRANCH",
                  name: "Branch Store",
                  isDefault: false,
                  isActive: true,
                },
              ],
        );
      }
    } catch {
      setMaterialCentres([
        { id: "mc-1", code: "WH-MAIN", name: "Main Warehouse", isDefault: true, isActive: true },
      ]);
    }

    try {
      setPriceLists([
        {
          id: "pl-1",
          name: "Price List A",
          category: "A",
          description: "Standard retail price",
          isActive: true,
        },
        {
          id: "pl-2",
          name: "Price List B",
          category: "B",
          description: "Wholesale price",
          isActive: true,
        },
        {
          id: "pl-3",
          name: "Price List C",
          category: "C",
          description: "Distributor price",
          isActive: true,
        },
      ]);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  };

  const filteredMC = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materialCentres.filter((mc) => {
      if (!matchBranch(mc.branchId)) return false;
      if (!q) return true;
      return (
        mc.code.toLowerCase().includes(q) ||
        mc.name.toLowerCase().includes(q) ||
        (mc.address || "").toLowerCase().includes(q)
      );
    });
  }, [materialCentres, search, matchBranch, branchFilter]);

  const filteredPL = useMemo(() => {
    const q = search.trim().toLowerCase();
    return priceLists.filter((pl) => {
      if (!matchBranch(pl.branchId)) return false;
      if (!q) return true;
      return (
        pl.name.toLowerCase().includes(q) ||
        pl.category.toLowerCase().includes(q) ||
        pl.description.toLowerCase().includes(q)
      );
    });
  }, [priceLists, search, matchBranch, branchFilter]);

  const mcColumns = useMemo<EnterpriseColumnDef<MaterialCentre>[]>(
    () => [
      {
        id: "code",
        header: "Code",
        cell: (mc) => (
          <span className="font-mono text-[12px] text-[var(--ds-text-default)]">{mc.code}</span>
        ),
      },
      {
        id: "name",
        header: "Name",
        cell: (mc) => (
          <span className="font-medium text-[12px] text-[var(--ds-text-default)]">{mc.name}</span>
        ),
      },
      {
        id: "address",
        header: "Address",
        cell: (mc) => (
          <span className="text-[12px] text-gray-500">{mc.address || "—"}</span>
        ),
      },
      {
        id: "default",
        header: "Default",
        align: "center",
        cell: (mc) =>
          mc.isDefault ? (
            <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-green-100 text-green-700">
              Default
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          ),
      },
      {
        id: "status",
        header: "Status",
        align: "center",
        cell: (mc) => (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
              mc.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
            }`}
          >
            {mc.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [],
  );

  const plColumns = useMemo<EnterpriseColumnDef<PriceListItem>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (pl) => (
          <span className="font-medium text-[12px] text-[var(--ds-text-default)]">{pl.name}</span>
        ),
      },
      {
        id: "category",
        header: "Category",
        cell: (pl) => (
          <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-blue-100 text-blue-700">
            Category {pl.category}
          </span>
        ),
      },
      {
        id: "description",
        header: "Description",
        cell: (pl) => (
          <span className="text-[12px] text-gray-500">{pl.description}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        align: "center",
        cell: (pl) => (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
              pl.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
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
    setShowForm(null);
    setEditMC(null);
    setEditPL(null);
    setMCForm(emptyMCForm());
    setPLForm(emptyPLForm());
    clearEntity(pageId);
  };

  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSearch("");
    resetForm();
  };

  const openAddMC = () => {
    setEditMC(null);
    setMCForm(emptyMCForm());
    setShowForm("mc");
    openEntity(pageId, "new");
  };

  const openEditMC = (mc: MaterialCentre) => {
    setEditMC(mc);
    const { id, ...rest } = mc;
    setMCForm(rest);
    setShowForm("mc");
    openEntity(pageId, mc.id);
  };

  const openAddPL = () => {
    setEditPL(null);
    setPLForm(emptyPLForm());
    setShowForm("pl");
    openEntity(pageId, "new");
  };

  const openEditPL = (pl: PriceListItem) => {
    setEditPL(pl);
    const { id, ...rest } = pl;
    setPLForm(rest);
    setShowForm("pl");
    openEntity(pageId, pl.id);
  };

  // Deep link: /app/misc-masters/:id | /app/misc-masters/new
  useEffect(() => {
    if (route.pageId !== pageId) return;
    if (route.entityId === "new") {
      if (activeTab === "price-lists") {
        setEditPL(null);
        setPLForm(emptyPLForm());
        setShowForm("pl");
      } else {
        setEditMC(null);
        setMCForm(emptyMCForm());
        setShowForm("mc");
      }
      return;
    }
    if (route.entityId) {
      const mc = materialCentres.find((m) => m.id === route.entityId);
      if (mc) {
        setActiveTab("material-centres");
        setEditMC(mc);
        const { id, ...rest } = mc;
        setMCForm(rest);
        setShowForm("mc");
        return;
      }
      const pl = priceLists.find((p) => p.id === route.entityId);
      if (pl) {
        setActiveTab("price-lists");
        setEditPL(pl);
        const { id, ...rest } = pl;
        setPLForm(rest);
        setShowForm("pl");
      }
      return;
    }
    if (showForm) setShowForm(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.pageId, route.entityId, materialCentres, priceLists]);

  const saveMC = async () => {
    if (!mcForm.name.trim()) {
      toast.error("Name required");
      return;
    }
    try {
      const db = getDB();
      if (editMC) {
        const updated = {
          ...editMC,
          ...mcForm,
          branchId: editMC.branchId || readActiveBranchId() || undefined,
        };
        if (db.warehouses) await db.warehouses.put(updated);
        setMaterialCentres((prev) => prev.map((m) => (m.id === editMC.id ? updated : m)));
        toast.success("Material Centre updated");
      } else {
        const newItem: MaterialCentre = {
          ...mcForm,
          id: `mc-${Date.now()}`,
          branchId: readActiveBranchId() || undefined,
        };
        if (db.warehouses) await db.warehouses.put(newItem);
        setMaterialCentres((prev) => [...prev, newItem]);
        toast.success("Material Centre added");
      }
      resetForm();
    } catch {
      toast.error("Failed");
    }
  };

  const deleteMC = async (mc: MaterialCentre) => {
    const snapshot = { ...mc };
    try {
      const db = getDB();
      if (db.warehouses) await db.warehouses.delete(mc.id);
      setMaterialCentres((prev) => prev.filter((m) => m.id !== mc.id));
      if (editMC?.id === mc.id) resetForm();
      toast.undo(`"${mc.name}" deleted`, async () => {
        try {
          if (db.warehouses) await db.warehouses.put(snapshot);
          setMaterialCentres((prev) => [...prev, snapshot]);
        } catch {
          toast.error("Failed to restore material centre.");
        }
      });
    } catch {
      toast.error("Failed");
    }
  };

  const savePL = async () => {
    if (!plForm.name.trim()) {
      toast.error("Name required");
      return;
    }
    const branchId = editPL?.branchId || readActiveBranchId() || undefined;
    const newItem: PriceListItem = { ...plForm, id: `pl-${Date.now()}`, branchId };
    setPriceLists((prev) =>
      editPL
        ? prev.map((p) => (p.id === editPL.id ? { ...editPL, ...plForm, branchId } : p))
        : [...prev, newItem],
    );
    toast.success(editPL ? "Price List updated" : "Price List added");
    resetForm();
  };

  const deletePL = (pl: PriceListItem) => {
    const snapshot = { ...pl };
    setPriceLists((prev) => prev.filter((p) => p.id !== pl.id));
    if (editPL?.id === pl.id) resetForm();
    toast.undo(`"${pl.name}" deleted`, () => {
      setPriceLists((prev) => [...prev, snapshot]);
    });
  };

  const tabs: { key: ActiveTab; label: string; icon: typeof MapPin; count: number }[] = [
    {
      key: "material-centres",
      label: "Material centres",
      icon: MapPin,
      count: materialCentres.length,
    },
    { key: "bom", label: "Bill of materials", icon: Layers, count: bomItems.length },
    { key: "price-lists", label: "Price lists", icon: DollarSign, count: priceLists.length },
  ];

  const tabAddLabel =
    activeTab === "material-centres"
      ? "Add material centre"
      : activeTab === "price-lists"
        ? "Add price list"
        : null;

  const handleTabAdd = () => {
    if (activeTab === "material-centres") openAddMC();
    else if (activeTab === "price-lists") openAddPL();
  };

  const pageMeta =
    activeTab === "material-centres"
      ? `${filteredMC.length} of ${materialCentres.length} material centres`
      : activeTab === "price-lists"
        ? `${filteredPL.length} of ${priceLists.length} price lists`
        : `${bomItems.length} bill of materials`;

  return (
    <div className="flex h-full min-h-0 bg-gray-50">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0 flex flex-col gap-3">
          <PageHeader
            title="Misc Masters"
            description="Material centres (warehouses), bill of materials, price lists"
            meta={<PageMeta>{pageMeta}</PageMeta>}
            primaryAction={
              tabAddLabel ? (
                <Button
                  variant="primary"
                  size="small"
                  onClick={handleTabAdd}
                  startIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  {tabAddLabel}
                </Button>
              ) : undefined
            }
          />

          <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => switchTab(tab.key)}
                className={`flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-md transition-colors ${
                  activeTab === tab.key
                    ? "bg-[var(--ds-action-primary)] text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    activeTab === tab.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {activeTab !== "bom" && (
            <div className="relative max-w-xs">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                placeholder={
                  activeTab === "material-centres"
                    ? "Search material centres..."
                    : "Search price lists..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputCls} pl-8`}
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
          {activeTab === "material-centres" && (
            <EnterpriseDataTable
              columns={mcColumns}
              rows={filteredMC}
              getRowId={(mc) => mc.id}
              loading={loading}
              emptyTitle={
                search ? "No material centres match your search" : "No material centres found"
              }
              emptyDescription={
                search
                  ? "Try a different search term."
                  : 'Click "Add material centre" to create your first warehouse/location.'
              }
              emptyAction={
                !search ? (
                  <Button
                    variant="primary"
                    size="small"
                    onClick={openAddMC}
                    startIcon={<Plus className="h-3.5 w-3.5" />}
                  >
                    Add material centre
                  </Button>
                ) : undefined
              }
              onRowClick={openEditMC}
              rowActions={(mc) => [
                { label: "Edit", onSelect: () => openEditMC(mc) },
                { label: "Delete", destructive: true, onSelect: () => deleteMC(mc) },
              ]}
              caption="Material centres"
            />
          )}

          {activeTab === "bom" && (
            <div className="bg-white border border-gray-200 rounded-lg">
              <ReportEmptyState
                message="No bill of materials configured"
                hint="Define finished product recipes — what raw materials are consumed during production. Enable Manufacturing Feature in Configuration → Features/Options to use BOM + Production Vouchers."
              />
              <div className="pb-6 flex justify-center">
                <button type="button" className={btnPrimary}>
                  <Plus className="h-3.5 w-3.5" />
                  Add BOM
                </button>
              </div>
            </div>
          )}

          {activeTab === "price-lists" && (
            <EnterpriseDataTable
              columns={plColumns}
              rows={filteredPL}
              getRowId={(pl) => pl.id}
              loading={loading}
              emptyTitle={search ? "No price lists match your search" : "No price lists found"}
              emptyDescription={
                search
                  ? "Try a different search term."
                  : 'Click "Add price list" to create your first price list category.'
              }
              emptyAction={
                !search ? (
                  <Button
                    variant="primary"
                    size="small"
                    onClick={openAddPL}
                    startIcon={<Plus className="h-3.5 w-3.5" />}
                  >
                    Add price list
                  </Button>
                ) : undefined
              }
              onRowClick={openEditPL}
              rowActions={(pl) => [
                { label: "Edit", onSelect: () => openEditPL(pl) },
                { label: "Delete", destructive: true, onSelect: () => deletePL(pl) },
              ]}
              caption="Price lists"
            />
          )}
        </div>
      </div>

      {showForm === "mc" && (
        <div className="w-[400px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-700">
              {editMC ? "Edit material centre" : "Add material centre"}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Code</label>
                <input
                  value={mcForm.code}
                  onChange={(e) => setMCForm((p) => ({ ...p, code: e.target.value }))}
                  className={`${inputCls} font-mono`}
                  placeholder="e.g. WH-MAIN"
                />
              </div>
              <div>
                <label className={labelCls}>Name *</label>
                <input
                  value={mcForm.name}
                  onChange={(e) => setMCForm((p) => ({ ...p, name: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. Main Warehouse"
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input
                value={mcForm.address || ""}
                onChange={(e) => setMCForm((p) => ({ ...p, address: e.target.value }))}
                className={inputCls}
                placeholder="Optional address"
              />
            </div>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  checked={mcForm.isDefault}
                  onChange={(e) => setMCForm((p) => ({ ...p, isDefault: e.target.checked }))}
                  className="rounded border-gray-200 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                />
                Set as default
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  checked={mcForm.isActive}
                  onChange={(e) => setMCForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="rounded border-gray-200 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                />
                Active
              </label>
            </div>
          </div>

          <div className="flex gap-2 p-4 border-t border-gray-200">
            <button type="button" className={btnPrimary} onClick={saveMC}>
              <Save className="h-3.5 w-3.5" />
              {editMC ? "Update" : "Save"}
            </button>
            <button type="button" className={btnOutline} onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showForm === "pl" && (
        <div className="w-[400px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-700">
              {editPL ? "Edit price list" : "Add price list"}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div>
              <label className={labelCls}>Name *</label>
              <input
                value={plForm.name}
                onChange={(e) => setPLForm((p) => ({ ...p, name: e.target.value }))}
                className={inputCls}
                placeholder="e.g. Wholesale Price List"
              />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select
                value={plForm.category}
                onChange={(e) => setPLForm((p) => ({ ...p, category: e.target.value }))}
                className={inputCls}
              >
                <option value="A">A — Standard/Retail</option>
                <option value="B">B — Wholesale</option>
                <option value="C">C — Distributor</option>
                <option value="D">D — Custom</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <input
                value={plForm.description}
                onChange={(e) => setPLForm((p) => ({ ...p, description: e.target.value }))}
                className={inputCls}
                placeholder="Optional description"
              />
            </div>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  checked={plForm.isActive}
                  onChange={(e) => setPLForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="rounded border-gray-200 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                />
                Active
              </label>
            </div>
          </div>

          <div className="flex gap-2 p-4 border-t border-gray-200">
            <button type="button" className={btnPrimary} onClick={savePL}>
              <Save className="h-3.5 w-3.5" />
              {editPL ? "Update" : "Save"}
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
