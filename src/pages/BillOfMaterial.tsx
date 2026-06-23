import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, Save, Search, Calculator } from "lucide-react";
import { useStore } from "../store/useStore";
import { BillOfMaterial, BillOfMaterialLine } from "../lib/types";
import ItemSelect from "../components/ui/ItemSelect";

export default function BillOfMaterialPage() {
  const { billsOfMaterial, loadBillsOfMaterial, addBillOfMaterial, updateBillOfMaterial, deleteBillOfMaterial, items } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const [formData, setFormData] = useState<Partial<BillOfMaterial>>({
    name: "",
    finishedItemId: "",
    finishedItemName: "",
    qtyProduced: 1,
    finishedItemUnit: "",
    overheadPercent: 0,
    components: [],
    byproducts: [],
    isActive: true,
  });

  useEffect(() => {
    loadBillsOfMaterial();
  }, [loadBillsOfMaterial]);

  const filteredBoMs = billsOfMaterial.filter((bom) =>
    bom.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bom.finishedItemName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddNew = () => {
    setEditingId(null);
    setFormData({
      name: "",
      finishedItemId: "",
      finishedItemName: "",
      qtyProduced: 1,
      finishedItemUnit: "",
      overheadPercent: 0,
      components: [],
      byproducts: [],
      isActive: true,
    });
    setIsFormOpen(true);
  };

  const handleEdit = (bom: BillOfMaterial) => {
    setEditingId(bom.id);
    setFormData({ ...bom });
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this Bill of Material?")) {
      await deleteBillOfMaterial(id);
    }
  };

  const addComponent = () => {
    setFormData(prev => ({
      ...prev,
      components: [...(prev.components || []), { itemId: "", itemName: "", qty: 1, unit: "", standardRate: 0, amount: 0 }]
    }));
  };

  const updateComponent = (index: number, updates: Partial<BillOfMaterialLine>) => {
    const newComponents = [...(formData.components || [])];
    const item = items.find(i => i.id === updates.itemId) || items.find(i => i.id === newComponents[index].itemId);
    
    newComponents[index] = {
      ...newComponents[index],
      ...updates,
    };
    
    if (updates.itemId && item) {
      newComponents[index].itemName = item.name;
      newComponents[index].unit = item.unit;
      newComponents[index].standardRate = item.purchaseRate || 0;
    }
    
    newComponents[index].amount = newComponents[index].qty * newComponents[index].standardRate;
    
    setFormData({ ...formData, components: newComponents });
  };

  const removeComponent = (index: number) => {
    const newComponents = [...(formData.components || [])];
    newComponents.splice(index, 1);
    setFormData({ ...formData, components: newComponents });
  };

  const addByproduct = () => {
    setFormData(prev => ({
      ...prev,
      byproducts: [...(prev.byproducts || []), { itemId: "", itemName: "", qty: 1, unit: "", standardRate: 0, amount: 0 }]
    }));
  };

  const updateByproduct = (index: number, updates: Partial<BillOfMaterialLine>) => {
    const newByproducts = [...(formData.byproducts || [])];
    const item = items.find(i => i.id === updates.itemId) || items.find(i => i.id === newByproducts[index].itemId);
    
    newByproducts[index] = {
      ...newByproducts[index],
      ...updates,
    };
    
    if (updates.itemId && item) {
      newByproducts[index].itemName = item.name;
      newByproducts[index].unit = item.unit;
      newByproducts[index].standardRate = item.salesRate || 0;
    }
    
    newByproducts[index].amount = newByproducts[index].qty * newByproducts[index].standardRate;
    
    setFormData({ ...formData, byproducts: newByproducts });
  };

  const removeByproduct = (index: number) => {
    const newByproducts = [...(formData.byproducts || [])];
    newByproducts.splice(index, 1);
    setFormData({ ...formData, byproducts: newByproducts });
  };

  const totalComponentCost = (formData.components || []).reduce((sum, c) => sum + c.amount, 0);
  const overheadAmount = totalComponentCost * ((formData.overheadPercent || 0) / 100);
  const totalCost = totalComponentCost + overheadAmount;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.finishedItemId || !formData.qtyProduced) {
      alert("Please fill required header fields.");
      return;
    }
    if (!formData.components?.length) {
      alert("Please add at least one component.");
      return;
    }

    try {
      if (editingId) {
        await updateBillOfMaterial(editingId, formData as Partial<BillOfMaterial>);
      } else {
        await addBillOfMaterial({
          ...(formData as Omit<BillOfMaterial, "id">),
          createdAt: new Date().toISOString(),
        });
      }
      setIsFormOpen(false);
      setEditingId(null);
    } catch (error) {
      console.error("Failed to save BoM:", error);
      alert("Failed to save BoM. Please try again.");
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-toolbar">
        <div className="page-toolbar-left">
          <h1 className="page-title">Bill of Materials</h1>
          <p className="page-subtitle">Manage manufacturing formulas and recipes</p>
        </div>
        <div className="page-toolbar-right">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search BoMs..."
              className="search-input pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={handleAddNew} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-semibold rounded-md flex items-center gap-1">
            <Plus className="h-4 w-4" />
            New BoM
          </button>
        </div>
      </div>

      <div className="page-content-area flex flex-col gap-4">
        {isFormOpen && (
          <div className="form-wrapper bg-white p-4 rounded-lg shadow-sm border border-[#dde1ea]">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
              <h3 className="text-[14px] font-semibold text-gray-800">
                {editingId ? "Edit Bill of Material" : "New Bill of Material"}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-grid-4 mb-6">
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">BoM Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">Finished Item <span className="text-red-500">*</span></label>
                  <div className="w-full h-8 text-[12px]">
                    <ItemSelect
                      value={formData.finishedItemId || ""}
                      onChange={(val) => {
                        const item = items.find(i => i.id === val);
                        if (item) {
                          setFormData({ 
                            ...formData, 
                            finishedItemId: val,
                            finishedItemName: item.name,
                            finishedItemUnit: item.unit
                          });
                        }
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">Qty Produced <span className="text-red-500">*</span></label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      required
                      className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                      value={formData.qtyProduced || ""}
                      onChange={(e) => setFormData({ ...formData, qtyProduced: Number(e.target.value) })}
                    />
                    <span className="text-[12px] text-gray-500 font-medium whitespace-nowrap">
                      {formData.finishedItemUnit || "-"}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">Overhead %</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    value={formData.overheadPercent || ""}
                    onChange={(e) => setFormData({ ...formData, overheadPercent: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-center pt-6 col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive !== false}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                    />
                    <span className="text-[12px] font-medium text-gray-700">Active BoM</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[13px] font-semibold text-gray-800">Components (Raw Materials)</h4>
                    <button type="button" onClick={addComponent} className="text-[#1557b0] text-[12px] hover:underline flex items-center gap-1 font-medium">
                      <Plus className="h-3 w-3" /> Add Row
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
                    <table className="line-table w-full">
                      <thead className="bg-[#eef1f8] border-b border-[#c5cad8]">
                        <tr>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-600 uppercase w-[40%]">Item</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-gray-600 uppercase w-[15%]">Qty</th>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-600 uppercase w-[15%]">Unit</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-gray-600 uppercase w-[15%]">Rate</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-gray-600 uppercase w-[10%]">Amt</th>
                          <th className="w-[5%]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.components?.map((c, idx) => (
                          <tr key={idx} className="border-b border-gray-100 last:border-0">
                            <td className="p-1">
                              <div className="w-full h-7 text-[11px]">
                                <ItemSelect
                                  value={c.itemId}
                                  onChange={(val) => updateComponent(idx, { itemId: val })}
                                />
                              </div>
                            </td>
                            <td className="p-1">
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                value={c.qty || ""}
                                onChange={(e) => updateComponent(idx, { qty: Number(e.target.value) })}
                                className="w-full h-7 px-1 text-right text-[11px] border border-gray-200 rounded focus:border-[#1557b0] focus:ring-1 focus:ring-[#1557b0]"
                              />
                            </td>
                            <td className="p-1 text-[11px] text-gray-600 px-2">{c.unit}</td>
                            <td className="p-1 text-right amt text-[11px] px-2">{c.standardRate?.toFixed(2)}</td>
                            <td className="p-1 text-right amt text-[11px] px-2 font-medium">{c.amount?.toFixed(2)}</td>
                            <td className="p-1 text-center">
                              <button type="button" onClick={() => removeComponent(idx)} className="text-gray-400 hover:text-red-500">
                                <X className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[13px] font-semibold text-gray-800">Byproducts (Optional)</h4>
                    <button type="button" onClick={addByproduct} className="text-[#1557b0] text-[12px] hover:underline flex items-center gap-1 font-medium">
                      <Plus className="h-3 w-3" /> Add Row
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
                    <table className="line-table w-full">
                      <thead className="bg-[#eef1f8] border-b border-[#c5cad8]">
                        <tr>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-600 uppercase w-[40%]">Item</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-gray-600 uppercase w-[15%]">Qty</th>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-600 uppercase w-[15%]">Unit</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-gray-600 uppercase w-[15%]">Rate</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-gray-600 uppercase w-[10%]">Amt</th>
                          <th className="w-[5%]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.byproducts?.map((c, idx) => (
                          <tr key={idx} className="border-b border-gray-100 last:border-0">
                            <td className="p-1">
                              <div className="w-full h-7 text-[11px]">
                                <ItemSelect
                                  value={c.itemId}
                                  onChange={(val) => updateByproduct(idx, { itemId: val })}
                                />
                              </div>
                            </td>
                            <td className="p-1">
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                value={c.qty || ""}
                                onChange={(e) => updateByproduct(idx, { qty: Number(e.target.value) })}
                                className="w-full h-7 px-1 text-right text-[11px] border border-gray-200 rounded focus:border-[#1557b0] focus:ring-1 focus:ring-[#1557b0]"
                              />
                            </td>
                            <td className="p-1 text-[11px] text-gray-600 px-2">{c.unit}</td>
                            <td className="p-1 text-right amt text-[11px] px-2">{c.standardRate?.toFixed(2)}</td>
                            <td className="p-1 text-right amt text-[11px] px-2 font-medium">{c.amount?.toFixed(2)}</td>
                            <td className="p-1 text-center">
                              <button type="button" onClick={() => removeByproduct(idx)} className="text-gray-400 hover:text-red-500">
                                <X className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mb-4">
                <div className="totals-panel w-72">
                  <div className="totals-row border-b border-gray-100 pb-2 mb-2 flex justify-between">
                    <span className="text-[11px] text-gray-600 font-medium">Component Cost:</span>
                    <span className="text-[12px] font-bold text-gray-800 amt">{totalComponentCost.toFixed(2)}</span>
                  </div>
                  <div className="totals-row border-b border-gray-100 pb-2 mb-2 flex justify-between">
                    <span className="text-[11px] text-gray-600 font-medium">Overhead ({formData.overheadPercent}%):</span>
                    <span className="text-[12px] font-bold text-gray-800 amt">{overheadAmount.toFixed(2)}</span>
                  </div>
                  <div className="totals-row flex justify-between pt-1">
                    <span className="text-[12px] text-gray-800 font-bold uppercase">Total Cost:</span>
                    <span className="text-[14px] font-bold text-[#1557b0] amt">{totalCost.toFixed(2)}</span>
                  </div>
                  <div className="totals-row flex justify-between pt-1 mt-1 border-t border-gray-200">
                    <span className="text-[11px] text-gray-600 font-medium">Est. Unit Cost:</span>
                    <span className="text-[12px] font-bold text-gray-700 amt">
                      {formData.qtyProduced ? (totalCost / formData.qtyProduced).toFixed(2) : "0.00"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-semibold rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-semibold rounded-md flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save BoM
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg border border-[#dde1ea] shadow-sm overflow-hidden flex-1">
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="th-left">BoM Name</th>
                  <th className="th-left">Finished Item</th>
                  <th className="th-right">Qty Produced</th>
                  <th className="th-center">Components</th>
                  <th className="th-center">Status</th>
                  <th className="th-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBoMs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      No Bills of Material found. Click 'New BoM' to create one.
                    </td>
                  </tr>
                ) : (
                  filteredBoMs.map((bom) => (
                    <tr key={bom.id}>
                      <td className="font-medium text-gray-800">{bom.name}</td>
                      <td>{bom.finishedItemName}</td>
                      <td className="text-right font-medium">
                        {bom.qtyProduced} <span className="text-gray-500 text-[10px]">{bom.finishedItemUnit}</span>
                      </td>
                      <td className="text-center">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-[11px] font-medium border border-gray-200">
                          {bom.components.length} items
                        </span>
                      </td>
                      <td className="text-center">
                        <span className={`badge ${bom.isActive ? 'badge-active' : 'badge-inactive'}`}>
                          {bom.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(bom)}
                            className="p-1 text-gray-500 hover:text-[#1557b0]"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(bom.id)}
                            className="p-1 text-gray-500 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
