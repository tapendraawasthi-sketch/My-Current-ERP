import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, Save, Search } from "lucide-react";
import { useStore } from "../store/useStore";
import { FixedAsset } from "../lib/types";
import { generateId } from "../lib/db";
import AccountSelect from "../components/ui/AccountSelect";

export default function FixedAssets() {
  const { fixedAssets, depreciationBlocks, loadFixedAssets, loadDepreciationBlocks, addFixedAsset, updateFixedAsset, deleteFixedAsset } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<FixedAsset>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    loadFixedAssets();
    loadDepreciationBlocks();
  }, [loadFixedAssets, loadDepreciationBlocks]);

  const filteredAssets = fixedAssets.filter((a) =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddNew = () => {
    setEditingId(null);
    setFormData({
      code: "",
      name: "",
      nameNepali: "",
      blockId: "",
      method: "WDV",
      purchaseDate: new Date().toISOString().split("T")[0],
      purchaseDateNepali: "",
      purchaseCost: 0,
      accumulatedDepreciation: 0,
      wdv: 0,
      isActive: true,
      assetAccountId: "",
      depreciationAccountId: "",
      accDepAccountId: "",
    });
    setIsFormOpen(true);
  };

  const handleEdit = (asset: FixedAsset) => {
    setEditingId(asset.id);
    setFormData({ ...asset });
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this Fixed Asset?")) {
      await deleteFixedAsset(id);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name || !formData.blockId || !formData.assetAccountId || !formData.depreciationAccountId || !formData.accDepAccountId) {
      alert("Please fill all required fields.");
      return;
    }

    try {
      if (editingId) {
        await updateFixedAsset(editingId, formData as Partial<FixedAsset>);
      } else {
        await addFixedAsset({
          ...(formData as Omit<FixedAsset, "id">),
          wdv: formData.purchaseCost || 0, // Initial WDV is purchase cost
          createdAt: new Date().toISOString(),
        });
      }
      setIsFormOpen(false);
      setEditingId(null);
    } catch (error) {
      console.error("Failed to save fixed asset:", error);
      alert("Failed to save fixed asset. Please try again.");
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-toolbar">
        <div className="page-toolbar-left">
          <h1 className="page-title">Fixed Assets</h1>
          <p className="page-subtitle">Manage fixed assets and depreciation blocks</p>
        </div>
        <div className="page-toolbar-right">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search assets..."
              className="search-input pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={handleAddNew} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-semibold rounded-md flex items-center gap-1">
            <Plus className="h-4 w-4" />
            New Asset
          </button>
        </div>
      </div>

      <div className="page-content-area flex flex-col gap-4">
        {isFormOpen && (
          <div className="form-wrapper bg-white p-4 rounded-lg shadow-sm border border-[#dde1ea]">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
              <h3 className="text-[14px] font-semibold text-gray-800">
                {editingId ? "Edit Fixed Asset" : "New Fixed Asset"}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-grid-2">
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">Asset Code <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    value={formData.code || ""}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">Asset Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">Depreciation Block <span className="text-red-500">*</span></label>
                  <select
                    required
                    className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    value={formData.blockId || ""}
                    onChange={(e) => {
                      const block = depreciationBlocks.find(b => b.id === e.target.value);
                      setFormData({ 
                        ...formData, 
                        blockId: e.target.value,
                        method: block ? block.method : formData.method
                      });
                    }}
                  >
                    <option value="">Select Block</option>
                    {depreciationBlocks.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code}) - {b.rate}% {b.method}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">Depreciation Method</label>
                  <select
                    className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    value={formData.method || "WDV"}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value as 'WDV'|'SLM' })}
                    disabled
                  >
                    <option value="WDV">Written Down Value (WDV)</option>
                    <option value="SLM">Straight Line Method (SLM)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">Purchase Date (AD) <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    value={formData.purchaseDate || ""}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">Purchase Cost <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    value={formData.purchaseCost || ""}
                    onChange={(e) => setFormData({ ...formData, purchaseCost: Number(e.target.value) })}
                    disabled={!!editingId}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">Asset Ledger Account <span className="text-red-500">*</span></label>
                  <AccountSelect
                    value={formData.assetAccountId || ""}
                    onChange={(val) => setFormData({ ...formData, assetAccountId: val })}
                    className="w-full h-8 text-[12px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">Depreciation Expense Account <span className="text-red-500">*</span></label>
                  <AccountSelect
                    value={formData.depreciationAccountId || ""}
                    onChange={(val) => setFormData({ ...formData, depreciationAccountId: val })}
                    className="w-full h-8 text-[12px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">Accumulated Dep. Account <span className="text-red-500">*</span></label>
                  <AccountSelect
                    value={formData.accDepAccountId || ""}
                    onChange={(val) => setFormData({ ...formData, accDepAccountId: val })}
                    className="w-full h-8 text-[12px]"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive !== false}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                    />
                    <span className="text-[12px] font-medium text-gray-700">Active Asset</span>
                  </label>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-4">
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
                  Save Asset
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
                  <th className="th-left">Code</th>
                  <th className="th-left">Asset Name</th>
                  <th className="th-left">Block</th>
                  <th className="th-center">Method</th>
                  <th className="th-left">Purchase Date</th>
                  <th className="th-right">Cost (Rs)</th>
                  <th className="th-right">WDV (Rs)</th>
                  <th className="th-center">Status</th>
                  <th className="th-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-gray-500">
                      No assets found. Click 'New Asset' to add one.
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => {
                    const block = depreciationBlocks.find(b => b.id === asset.blockId);
                    return (
                      <tr key={asset.id}>
                        <td className="font-medium">{asset.code}</td>
                        <td>{asset.name}</td>
                        <td>{block ? `${block.name} (${block.code})` : '-'}</td>
                        <td className="text-center">{asset.method}</td>
                        <td>{new Date(asset.purchaseDate).toLocaleDateString()}</td>
                        <td className="text-right amt">{asset.purchaseCost.toFixed(2)}</td>
                        <td className="text-right amt">{asset.wdv.toFixed(2)}</td>
                        <td className="text-center">
                          <span className={`badge ${asset.isActive ? 'badge-active' : 'badge-inactive'}`}>
                            {asset.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(asset)}
                              className="p-1 text-gray-500 hover:text-[#1557b0]"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(asset.id)}
                              className="p-1 text-gray-500 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
