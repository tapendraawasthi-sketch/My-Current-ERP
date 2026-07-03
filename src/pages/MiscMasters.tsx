// src/pages/MiscMasters.tsx
import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, Package, MapPin, Layers, DollarSign, Scale } from "lucide-react";
import { getDB } from "../lib/db";

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

export default function MiscMasters() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("material-centres");
  const [materialCentres, setMaterialCentres] = useState<MaterialCentre[]>([]);
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [priceLists, setPriceLists] = useState<PriceListItem[]>([]);

  // Material Centre Modal
  const [showMCModal, setShowMCModal] = useState(false);
  const [editMC, setEditMC] = useState<MaterialCentre | null>(null);
  const [mcForm, setMCForm] = useState<Omit<MaterialCentre, "id">>({ code: "", name: "", address: "", isDefault: false, isActive: true });

  // Price List Modal
  const [showPLModal, setShowPLModal] = useState(false);
  const [editPL, setEditPL] = useState<PriceListItem | null>(null);
  const [plForm, setPLForm] = useState<Omit<PriceListItem, "id">>({ name: "", category: "A", description: "", isActive: true });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const db = getDB();
      if (db.warehouses) {
        const wh = await db.warehouses.toArray();
        setMaterialCentres(wh.length > 0 ? (wh as any) : [
          { id: "mc-1", code: "WH-MAIN", name: "Main Warehouse", isDefault: true, isActive: true },
          { id: "mc-2", code: "WH-BRANCH", name: "Branch Store", isDefault: false, isActive: true },
        ]);
      }
    } catch {
      setMaterialCentres([{ id: "mc-1", code: "WH-MAIN", name: "Main Warehouse", isDefault: true, isActive: true }]);
    }

    try {
      setPriceLists([
        { id: "pl-1", name: "Price List A", category: "A", description: "Standard retail price", isActive: true },
        { id: "pl-2", name: "Price List B", category: "B", description: "Wholesale price", isActive: true },
        { id: "pl-3", name: "Price List C", category: "C", description: "Distributor price", isActive: true },
      ]);
    } catch {}
  };

  const saveMC = async () => {
    if (!mcForm.name.trim()) { toast.error("Name required"); return; }
    try {
      const db = getDB();
      if (editMC) {
        const updated = { ...editMC, ...mcForm };
        if (db.warehouses) await db.warehouses.put(updated);
        setMaterialCentres(prev => prev.map(m => m.id === editMC.id ? updated : m));
        toast.success("Material Centre updated");
      } else {
        const newItem: MaterialCentre = { ...mcForm, id: `mc-${Date.now()}` };
        if (db.warehouses) await db.warehouses.put(newItem);
        setMaterialCentres(prev => [...prev, newItem]);
        toast.success("Material Centre added");
      }
      setShowMCModal(false);
    } catch { toast.error("Failed"); }
  };

  const deleteMC = async (id: string) => {
    if (!confirm("Delete this material centre?")) return;
    try {
      const db = getDB();
      if (db.warehouses) await db.warehouses.delete(id);
      setMaterialCentres(prev => prev.filter(m => m.id !== id));
      toast.success("Deleted");
    } catch { toast.error("Failed"); }
  };

  const savePL = async () => {
    if (!plForm.name.trim()) { toast.error("Name required"); return; }
    const newItem: PriceListItem = { ...plForm, id: `pl-${Date.now()}` };
    setPriceLists(prev => editPL ? prev.map(p => p.id === editPL.id ? { ...editPL, ...plForm } : p) : [...prev, newItem]);
    toast.success(editPL ? "Price List updated" : "Price List added");
    setShowPLModal(false);
  };

  const inputCls = "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
  const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

  const tabs: { key: ActiveTab; label: string; icon: any; count: number }[] = [
    { key: "material-centres", label: "Material Centres", icon: MapPin, count: materialCentres.length },
    { key: "bom", label: "Bill of Materials", icon: Layers, count: bomItems.length },
    { key: "price-lists", label: "Price Lists", icon: DollarSign, count: priceLists.length },
  ];

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="mb-4">
        <h1 className="text-[15px] font-semibold text-gray-800">Misc Masters</h1>
        <p className="text-[11px] text-gray-500 mt-0.5">Material Centres (Warehouses), Bill of Materials, Price Lists</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white border border-gray-200 rounded-lg p-1 w-fit">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-md transition-colors ${activeTab === tab.key ? "bg-[#1557b0] text-white" : "text-gray-600 hover:bg-gray-50"}`}>
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${activeTab === tab.key ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Material Centres */}
      {activeTab === "material-centres" && (
        <>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-[13px] font-semibold text-gray-700">Material Centres / Warehouses / Locations</h2>
            <button onClick={() => { setEditMC(null); setMCForm({ code: "", name: "", address: "", isDefault: false, isActive: true }); setShowMCModal(true); }}
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Material Centre
            </button>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  {["Code", "Name", "Address", "Default", "Status", "Actions"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {materialCentres.map(mc => (
                  <tr key={mc.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-[12px] font-mono text-gray-600">{mc.code}</td>
                    <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800">{mc.name}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-500">{mc.address || "—"}</td>
                    <td className="px-3 py-2.5 text-[12px] text-center">{mc.isDefault ? <span className="text-green-600 font-bold">✓ Default</span> : "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${mc.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {mc.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditMC(mc); const { id, ...rest } = mc; setMCForm(rest); setShowMCModal(true); }} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => deleteMC(mc.id)} className="p-1.5 hover:bg-red-50 rounded text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* BOM */}
      {activeTab === "bom" && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <Layers className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-[13px] font-semibold text-gray-600">Bill of Materials</h3>
          <p className="text-[11px] text-gray-400 mt-1">Define finished product recipes — what raw materials are consumed during production</p>
          <p className="text-[11px] text-gray-400 mt-2">Enable Manufacturing Feature in Configuration → Features/Options to use BOM + Production Vouchers</p>
          <button className="mt-4 h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 mx-auto">
            <Plus className="h-3.5 w-3.5" /> Add BOM
          </button>
        </div>
      )}

      {/* Price Lists */}
      {activeTab === "price-lists" && (
        <>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-[13px] font-semibold text-gray-700">Price Lists (A/B/C Categories)</h2>
            <button onClick={() => { setEditPL(null); setPLForm({ name: "", category: "A", description: "", isActive: true }); setShowPLModal(true); }}
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Price List
            </button>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  {["Name", "Category", "Description", "Status", "Actions"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {priceLists.map(pl => (
                  <tr key={pl.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800">{pl.name}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">Category {pl.category}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-500">{pl.description}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${pl.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {pl.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditPL(pl); const { id, ...rest } = pl; setPLForm(rest); setShowPLModal(true); }} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setPriceLists(prev => prev.filter(p => p.id !== pl.id))} className="p-1.5 hover:bg-red-50 rounded text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MC Modal */}
      {showMCModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-gray-800">{editMC ? "Modify" : "Add"} Material Centre</h2>
              <button onClick={() => setShowMCModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Code</label>
                  <input value={mcForm.code} onChange={e => setMCForm(p => ({ ...p, code: e.target.value }))} className={`${inputCls} w-full`} placeholder="e.g. WH-MAIN" />
                </div>
                <div>
                  <label className={labelCls}>Name *</label>
                  <input value={mcForm.name} onChange={e => setMCForm(p => ({ ...p, name: e.target.value }))} className={`${inputCls} w-full`} placeholder="e.g. Main Warehouse" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <input value={mcForm.address || ""} onChange={e => setMCForm(p => ({ ...p, address: e.target.value }))} className={`${inputCls} w-full`} placeholder="Optional address" />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={mcForm.isDefault} onChange={e => setMCForm(p => ({ ...p, isDefault: e.target.checked }))} className="rounded" />
                  <span className="text-[12px] text-gray-700">Set as Default</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={mcForm.isActive} onChange={e => setMCForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
                  <span className="text-[12px] text-gray-700">Active</span>
                </label>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowMCModal(false)} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md">Cancel</button>
              <button onClick={saveMC} className="h-8 px-3 bg-[#1557b0] text-white text-[12px] rounded-md">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* PL Modal */}
      {showPLModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-gray-800">{editPL ? "Modify" : "Add"} Price List</h2>
              <button onClick={() => setShowPLModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className={labelCls}>Name *</label>
                <input value={plForm.name} onChange={e => setPLForm(p => ({ ...p, name: e.target.value }))} className={`${inputCls} w-full`} placeholder="e.g. Wholesale Price List" />
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select value={plForm.category} onChange={e => setPLForm(p => ({ ...p, category: e.target.value }))} className={`${inputCls} w-full`}>
                  <option value="A">A — Standard/Retail</option>
                  <option value="B">B — Wholesale</option>
                  <option value="C">C — Distributor</option>
                  <option value="D">D — Custom</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <input value={plForm.description} onChange={e => setPLForm(p => ({ ...p, description: e.target.value }))} className={`${inputCls} w-full`} placeholder="Optional description" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={plForm.isActive} onChange={e => setPLForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
                <span className="text-[12px] text-gray-700">Active</span>
              </label>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowPLModal(false)} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md">Cancel</button>
              <button onClick={savePL} className="h-8 px-3 bg-[#1557b0] text-white text-[12px] rounded-md">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
