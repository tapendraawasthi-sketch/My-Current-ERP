// src/pages/MiscMasters.tsx
import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, MapPin, Layers, DollarSign, Search, X, Save } from "lucide-react";
import { getDB } from "../lib/db";
import { ReportEmptyState } from "../components/ReportEmptyState";

interface MaterialCentre {
  id: string;
  code: string;
  name: string;
  address?: string;
  isDefault: boolean;
  isActive: boolean;
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
}

type ActiveTab = "material-centres" | "bom" | "price-lists";
type FormMode = "mc" | "pl" | null;

const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
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
  const [activeTab, setActiveTab] = useState<ActiveTab>("material-centres");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState<FormMode>(null);
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
    }
  };

  const filteredMC = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return materialCentres;
    return materialCentres.filter(
      (mc) =>
        mc.code.toLowerCase().includes(q) ||
        mc.name.toLowerCase().includes(q) ||
        (mc.address || "").toLowerCase().includes(q),
    );
  }, [materialCentres, search]);

  const filteredPL = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return priceLists;
    return priceLists.filter(
      (pl) =>
        pl.name.toLowerCase().includes(q) ||
        pl.category.toLowerCase().includes(q) ||
        pl.description.toLowerCase().includes(q),
    );
  }, [priceLists, search]);

  const resetForm = () => {
    setShowForm(null);
    setEditMC(null);
    setEditPL(null);
    setMCForm(emptyMCForm());
    setPLForm(emptyPLForm());
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
  };

  const openEditMC = (mc: MaterialCentre) => {
    setEditMC(mc);
    const { id, ...rest } = mc;
    setMCForm(rest);
    setShowForm("mc");
  };

  const openAddPL = () => {
    setEditPL(null);
    setPLForm(emptyPLForm());
    setShowForm("pl");
  };

  const openEditPL = (pl: PriceListItem) => {
    setEditPL(pl);
    const { id, ...rest } = pl;
    setPLForm(rest);
    setShowForm("pl");
  };

  const saveMC = async () => {
    if (!mcForm.name.trim()) {
      toast.error("Name required");
      return;
    }
    try {
      const db = getDB();
      if (editMC) {
        const updated = { ...editMC, ...mcForm };
        if (db.warehouses) await db.warehouses.put(updated);
        setMaterialCentres((prev) => prev.map((m) => (m.id === editMC.id ? updated : m)));
        toast.success("Material Centre updated");
      } else {
        const newItem: MaterialCentre = { ...mcForm, id: `mc-${Date.now()}` };
        if (db.warehouses) await db.warehouses.put(newItem);
        setMaterialCentres((prev) => [...prev, newItem]);
        toast.success("Material Centre added");
      }
      resetForm();
    } catch {
      toast.error("Failed");
    }
  };

  const deleteMC = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Delete this material centre?")) return;
    try {
      const db = getDB();
      if (db.warehouses) await db.warehouses.delete(id);
      setMaterialCentres((prev) => prev.filter((m) => m.id !== id));
      toast.success("Deleted");
    } catch {
      toast.error("Failed");
    }
  };

  const savePL = async () => {
    if (!plForm.name.trim()) {
      toast.error("Name required");
      return;
    }
    const newItem: PriceListItem = { ...plForm, id: `pl-${Date.now()}` };
    setPriceLists((prev) =>
      editPL
        ? prev.map((p) => (p.id === editPL.id ? { ...editPL, ...plForm } : p))
        : [...prev, newItem],
    );
    toast.success(editPL ? "Price List updated" : "Price List added");
    resetForm();
  };

  const deletePL = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Delete this price list?")) return;
    setPriceLists((prev) => prev.filter((p) => p.id !== id));
    toast.success("Deleted");
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

  return (
    <div className="flex h-full min-h-0 bg-[#f5f6fa]">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Misc Masters</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Material centres (warehouses), bill of materials, price lists
              </p>
            </div>
            {tabAddLabel && (
              <button type="button" className={btnPrimary} onClick={handleTabAdd}>
                <Plus className="h-3.5 w-3.5" />
                {tabAddLabel}
              </button>
            )}
          </div>

          <div className="flex gap-1 mb-3 bg-white border border-gray-200 rounded-md p-1 w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => switchTab(tab.key)}
                className={`flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-md transition-colors ${
                  activeTab === tab.key
                    ? "bg-[#1557b0] text-white"
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
            <div className="relative mb-3 max-w-xs">
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

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {activeTab === "material-centres" && (
            <>
              {filteredMC.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-md">
                  <ReportEmptyState
                    message={
                      search ? "No material centres match your search" : "No material centres found"
                    }
                    hint={
                      search
                        ? "Try a different search term."
                        : 'Click "Add material centre" to create your first warehouse/location.'
                    }
                  />
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-[#f5f6fa] border-b border-gray-200">
                        <th className={th}>Code</th>
                        <th className={th}>Name</th>
                        <th className={th}>Address</th>
                        <th className={`${th} text-center`}>Default</th>
                        <th className={`${th} text-center`}>Status</th>
                        <th className={`${th} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMC.map((mc) => (
                        <tr
                          key={mc.id}
                          className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]"
                          onClick={() => openEditMC(mc)}
                        >
                          <td className={`${td} font-mono text-gray-600`}>{mc.code}</td>
                          <td className={`${td} font-medium text-gray-800`}>{mc.name}</td>
                          <td className={`${td} text-gray-500`}>{mc.address || "—"}</td>
                          <td className={`${td} text-center`}>
                            {mc.isDefault ? (
                              <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-green-100 text-green-700">
                                Default
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className={`${td} text-center`}>
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                mc.isActive
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {mc.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className={`${td} text-right`}>
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditMC(mc);
                                }}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-red-600 hover:bg-red-50"
                                onClick={(e) => deleteMC(mc.id, e)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
                    {filteredMC.length} material centre{filteredMC.length === 1 ? "" : "s"}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "bom" && (
            <div className="bg-white border border-gray-200 rounded-md">
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
            <>
              {filteredPL.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-md">
                  <ReportEmptyState
                    message={search ? "No price lists match your search" : "No price lists found"}
                    hint={
                      search
                        ? "Try a different search term."
                        : 'Click "Add price list" to create your first price list category.'
                    }
                  />
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-[#f5f6fa] border-b border-gray-200">
                        <th className={th}>Name</th>
                        <th className={th}>Category</th>
                        <th className={th}>Description</th>
                        <th className={`${th} text-center`}>Status</th>
                        <th className={`${th} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPL.map((pl) => (
                        <tr
                          key={pl.id}
                          className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]"
                          onClick={() => openEditPL(pl)}
                        >
                          <td className={`${td} font-medium text-gray-800`}>{pl.name}</td>
                          <td className={td}>
                            <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-blue-100 text-blue-700">
                              Category {pl.category}
                            </span>
                          </td>
                          <td className={`${td} text-gray-500`}>{pl.description}</td>
                          <td className={`${td} text-center`}>
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                pl.isActive
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {pl.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className={`${td} text-right`}>
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditPL(pl);
                                }}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-red-600 hover:bg-red-50"
                                onClick={(e) => deletePL(pl.id, e)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
                    {filteredPL.length} price list{filteredPL.length === 1 ? "" : "s"}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showForm === "mc" && (
        <div className="w-[400px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-800">
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
            <div className="border border-gray-200 rounded-md p-3 bg-gray-50 flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  checked={mcForm.isDefault}
                  onChange={(e) => setMCForm((p) => ({ ...p, isDefault: e.target.checked }))}
                  className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                />
                Set as default
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  checked={mcForm.isActive}
                  onChange={(e) => setMCForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
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
            <span className="text-[13px] font-semibold text-gray-800">
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
            <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  checked={plForm.isActive}
                  onChange={(e) => setPLForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
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
