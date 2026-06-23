import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, Save, Search, Printer, CheckCircle2 } from "lucide-react";
import { useStore } from "../store/useStore";
import { PhysicalStockVoucher, PhysicalStockLine, VoucherType, VoucherStatus, JournalEntry } from "../lib/types";
import { generateVoucherNo } from "../lib/accounting";
import { computeAllStockPositions, postPhysicalStockAdjustment } from "../lib/stockUtils";

export default function PhysicalStockPage() {
  const {
    physicalStockVouchers, items, warehouses, currentFiscalYear, stockMovements,
    loadPhysicalStockVouchers, addPhysicalStockVoucher, updatePhysicalStockVoucher,
    addStockMovement, companySettings, updateCompanySettings, addVoucher
  } = useStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);

  const [formData, setFormData] = useState<Partial<PhysicalStockVoucher>>({
    voucherNo: "",
    date: new Date().toISOString().split("T")[0],
    dateNepali: "",
    warehouseId: "",
    narration: "",
    lines: [],
    status: "draft",
  });

  useEffect(() => {
    loadPhysicalStockVouchers();
  }, [loadPhysicalStockVouchers]);

  const filteredVouchers = physicalStockVouchers.filter((v) =>
    v.voucherNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.warehouseName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddNew = () => {
    setEditingId(null);
    const { voucherNo } = generateVoucherNo(VoucherType.JOURNAL, companySettings.voucherSeries, currentFiscalYear?.name || "2080/81");
    const physNo = voucherNo.replace("JV", "PHYS");
    
    setFormData({
      voucherNo: physNo,
      date: new Date().toISOString().split("T")[0],
      dateNepali: "",
      warehouseId: warehouses.find(w => w.isDefault)?.id || "",
      warehouseName: warehouses.find(w => w.isDefault)?.name || "",
      narration: "",
      lines: [],
      status: "draft",
    });
    setIsFormOpen(true);
  };

  const handleEdit = (voucher: PhysicalStockVoucher) => {
    setEditingId(voucher.id);
    setFormData({ ...voucher });
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    // Only allow delete if draft
    const voucher = physicalStockVouchers.find(v => v.id === id);
    if (voucher?.status === "adjusted") {
      alert("Cannot delete an adjusted physical stock voucher.");
      return;
    }
    // We don't have delete API in store, so we'll just alert for now or implement if needed
    alert("Delete not implemented for physical stock in store yet.");
  };

  const handleLoadItems = () => {
    if (!formData.warehouseId) {
      alert("Please select a warehouse first.");
      return;
    }
    if (formData.status !== 'draft') {
      alert("Can only load items for draft vouchers.");
      return;
    }

    const warehouse = warehouses.find(w => w.id === formData.warehouseId);
    if (!warehouse) return;

    // Check for duplicate draft
    const existingDraft = physicalStockVouchers.find(v => 
      v.status === 'draft' && 
      v.warehouseId === formData.warehouseId && 
      v.id !== editingId &&
      v.date === formData.date
    );

    if (existingDraft) {
      if (!window.confirm(`Warning: Another draft stock count exists for ${warehouse.name} on ${formData.date}. Load anyway?`)) {
        return;
      }
    }

    const stockPositions = computeAllStockPositions(stockMovements, items.filter(i => i.isActive), warehouses);
    
    const lines: PhysicalStockLine[] = [];
    stockPositions.forEach(pos => {
      // Find the warehouse position in the array
      const whPos = pos.warehouses.find(w => w.warehouseId === formData.warehouseId);
      const bookQty = whPos ? whPos.qty : 0;
      const rate = whPos ? whPos.avgRate : (items.find(i => i.id === pos.item.id)?.purchaseRate || 0);

      lines.push({
        itemId: pos.item.id,
        itemName: pos.item.name,
        itemCode: pos.item.code,
        unit: pos.item.unit,
        bookQty,
        physicalQty: bookQty, // default to book qty
        variance: 0,
        rate,
        varianceValue: 0,
      });
    });

    setFormData({ ...formData, lines, warehouseName: warehouse.name });
  };

  const updateLinePhysicalQty = (index: number, newQty: number) => {
    if (formData.status === 'adjusted') return;
    
    const newLines = [...(formData.lines || [])];
    const line = newLines[index];
    
    line.physicalQty = newQty;
    line.variance = newQty - line.bookQty;
    line.varianceValue = line.variance * line.rate;
    
    setFormData({ ...formData, lines: newLines });
  };

  const handlePrintCountSheet = () => {
    window.print();
  };

  const handleSaveDraft = async () => {
    if (!formData.voucherNo || !formData.date || !formData.warehouseId) {
      alert("Please fill required header fields.");
      return;
    }

    try {
      if (editingId) {
        await updatePhysicalStockVoucher(editingId, formData as Partial<PhysicalStockVoucher>);
      } else {
        await addPhysicalStockVoucher(formData as Omit<PhysicalStockVoucher, "id">);
        if (formData.voucherNo?.includes("PHYS")) {
          const { updatedSeries } = generateVoucherNo(VoucherType.JOURNAL, companySettings.voucherSeries, currentFiscalYear?.name || "2080/81");
          await updateCompanySettings({ voucherSeries: updatedSeries });
        }
      }
      setIsFormOpen(false);
      setEditingId(null);
    } catch (error) {
      console.error("Failed to save draft:", error);
      alert("Failed to save draft.");
    }
  };

  const handleFinalize = async () => {
    if (formData.status === 'adjusted') return;
    
    const varianceItems = (formData.lines || []).filter(l => l.variance !== 0);
    if (varianceItems.length === 0) {
      alert("No variances found. Nothing to adjust.");
      return;
    }

    if (!window.confirm(`This will post stock adjustment for ${varianceItems.length} items with variance. Proceed?`)) {
      return;
    }

    setIsAdjusting(true);
    try {
      let voucherId = editingId;
      
      if (!editingId) {
        const saved = await addPhysicalStockVoucher(formData as Omit<PhysicalStockVoucher, "id">);
        voucherId = saved.id;
        if (formData.voucherNo?.includes("PHYS")) {
          const { updatedSeries } = generateVoucherNo(VoucherType.JOURNAL, companySettings.voucherSeries, currentFiscalYear?.name || "2080/81");
          await updateCompanySettings({ voucherSeries: updatedSeries });
        }
      }

      if (voucherId) {
        // Create Stock Journal Voucher to record accounting effect if we had a stock adjustment account
        // For simplicity we just do stock movements
        for (const line of varianceItems) {
          await postPhysicalStockAdjustment(line, formData.date!, formData.warehouseId!, voucherId, addStockMovement as any);
        }

        await updatePhysicalStockVoucher(voucherId, { 
          status: 'adjusted', 
          lines: formData.lines 
        });

        setIsFormOpen(false);
        setEditingId(null);
        alert("Stock adjusted successfully.");
      }
    } catch (error) {
      console.error("Failed to adjust stock:", error);
      alert("Failed to adjust stock.");
    } finally {
      setIsAdjusting(false);
    }
  };

  const totalVarianceValue = (formData.lines || []).reduce((sum, l) => sum + l.varianceValue, 0);

  return (
    <div className="page-wrapper">
      <div className="page-toolbar no-print">
        <div className="page-toolbar-left">
          <h1 className="page-title">Physical Stock Adjustment</h1>
          <p className="page-subtitle">Record physical counts and adjust inventory</p>
        </div>
        <div className="page-toolbar-right">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search vouchers..."
              className="search-input pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={handleAddNew} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-semibold rounded-md flex items-center gap-1">
            <Plus className="h-4 w-4" />
            New Stock Count
          </button>
        </div>
      </div>

      <div className="page-content-area flex flex-col gap-4">
        {isFormOpen && (
          <div className="form-wrapper bg-white p-4 rounded-lg shadow-sm border border-[#dde1ea]">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2 no-print">
              <h3 className="text-[14px] font-semibold text-gray-800">
                {editingId ? "Edit Physical Stock Voucher" : "New Physical Stock Voucher"}
                <span className={`ml-3 badge ${formData.status === 'adjusted' ? 'badge-posted' : 'badge-draft'}`}>
                  {formData.status?.toUpperCase()}
                </span>
              </h3>
              <div className="flex items-center gap-2">
                {formData.status === 'draft' && formData.lines?.length! > 0 && (
                  <button onClick={handlePrintCountSheet} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-[12px] font-semibold rounded-md flex items-center gap-2">
                    <Printer className="h-4 w-4" />
                    Print Count Sheet
                  </button>
                )}
                <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="print-only hidden text-center mb-6">
              <h2 className="text-xl font-bold">{companySettings.name}</h2>
              <h3 className="text-lg font-semibold">Physical Stock Count Sheet</h3>
              <p className="text-sm">Warehouse: {formData.warehouseName} | Date: {new Date(formData.date!).toLocaleDateString()}</p>
            </div>

            <div className="form-grid-4 mb-6 no-print">
              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">Voucher No <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  disabled={formData.status === 'adjusted'}
                  className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] disabled:bg-gray-50"
                  value={formData.voucherNo || ""}
                  onChange={(e) => setFormData({ ...formData, voucherNo: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">Date (AD) <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  required
                  disabled={formData.status === 'adjusted'}
                  className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] disabled:bg-gray-50"
                  value={formData.date || ""}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">Warehouse <span className="text-red-500">*</span></label>
                <select
                  required
                  disabled={formData.status === 'adjusted' || (formData.lines?.length || 0) > 0}
                  className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] disabled:bg-gray-50"
                  value={formData.warehouseId || ""}
                  onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">Narration</label>
                <input
                  type="text"
                  disabled={formData.status === 'adjusted'}
                  className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] disabled:bg-gray-50"
                  value={formData.narration || ""}
                  onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
                />
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between no-print">
              <h4 className="text-[13px] font-semibold text-gray-800">Inventory Items</h4>
              {formData.status === 'draft' && (
                <button type="button" onClick={handleLoadItems} className="text-[#1557b0] text-[12px] hover:underline flex items-center gap-1 font-medium">
                  Load Stock Positions
                </button>
              )}
            </div>

            <div className="border border-gray-200 rounded-md overflow-hidden bg-white mb-6">
              <table className="line-table w-full">
                <thead className="bg-[#eef1f8] border-b border-[#c5cad8]">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-600 uppercase w-[30%]">Item Name</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-600 uppercase w-[10%]">Code</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-600 uppercase w-[10%]">Unit</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-600 uppercase w-[10%]">Book Qty</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold text-[#1557b0] uppercase w-[15%] border-x border-[#c5cad8]">Physical Qty</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-600 uppercase w-[10%] no-print">Variance</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-600 uppercase w-[15%] no-print">Variance Val</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {formData.lines?.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500 text-[12px]">
                        Click "Load Stock Positions" to pull current inventory.
                      </td>
                    </tr>
                  ) : (
                    formData.lines?.map((line, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 text-[11px] font-medium text-gray-800">{line.itemName}</td>
                        <td className="px-3 py-1.5 text-[11px] text-gray-600">{line.itemCode}</td>
                        <td className="px-3 py-1.5 text-[11px] text-gray-600">{line.unit}</td>
                        <td className="px-3 py-1.5 text-[11px] text-right font-medium text-gray-700">{line.bookQty}</td>
                        <td className="p-1 border-x border-gray-200">
                          {formData.status === 'draft' ? (
                            <input 
                              type="number" 
                              step="any"
                              value={line.physicalQty} 
                              onChange={(e) => updateLinePhysicalQty(idx, Number(e.target.value))} 
                              className="w-full h-7 px-2 text-right text-[12px] font-bold text-[#1557b0] border border-gray-300 rounded focus:border-[#1557b0] focus:ring-1 focus:ring-[#1557b0] no-print" 
                            />
                          ) : (
                            <div className="px-2 text-right text-[12px] font-bold text-[#1557b0]">{line.physicalQty}</div>
                          )}
                          <div className="print-only hidden w-full h-6 border-b border-black"></div>
                        </td>
                        <td className={`px-3 py-1.5 text-[11px] text-right font-bold no-print ${line.variance > 0 ? 'text-green-600' : line.variance < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {line.variance > 0 ? '+' : ''}{line.variance}
                        </td>
                        <td className={`px-3 py-1.5 text-[11px] text-right font-bold no-print amt ${line.varianceValue > 0 ? 'text-green-600' : line.varianceValue < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {line.varianceValue.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mb-4 no-print">
              <div className="totals-panel w-72">
                <div className="totals-row flex justify-between pt-1">
                  <span className="text-[12px] text-gray-800 font-bold uppercase">Net Variance Value:</span>
                  <span className={`text-[14px] font-bold amt ${totalVarianceValue > 0 ? 'text-green-600' : totalVarianceValue < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {totalVarianceValue.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {formData.status === 'draft' && (
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 no-print">
                <button type="button" onClick={() => setIsFormOpen(false)} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-semibold rounded-md hover:bg-gray-50">
                  Cancel
                </button>
                <button type="button" onClick={handleSaveDraft} disabled={isAdjusting} className="h-8 px-3 bg-white border border-[#1557b0] text-[#1557b0] text-[12px] font-semibold rounded-md hover:bg-[#eef2ff]">
                  Save Draft
                </button>
                <button type="button" onClick={handleFinalize} disabled={isAdjusting || (formData.lines?.length || 0) === 0} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-semibold rounded-md flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {isAdjusting ? 'Adjusting...' : 'Finalize & Adjust Stock'}
                </button>
              </div>
            )}
          </div>
        )}

        {!isFormOpen && (
          <div className="bg-white rounded-lg border border-[#dde1ea] shadow-sm overflow-hidden flex-1 no-print">
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="th-left">Voucher No</th>
                    <th className="th-left">Date</th>
                    <th className="th-left">Warehouse</th>
                    <th className="th-left">Narration</th>
                    <th className="th-center">Items</th>
                    <th className="th-center">Status</th>
                    <th className="th-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        No Physical Stock Vouchers found. Click 'New Stock Count' to create one.
                      </td>
                    </tr>
                  ) : (
                    filteredVouchers.map((voucher) => (
                      <tr key={voucher.id}>
                        <td className="font-medium text-[#1557b0]">{voucher.voucherNo}</td>
                        <td>{new Date(voucher.date).toLocaleDateString()}</td>
                        <td>{voucher.warehouseName}</td>
                        <td className="truncate max-w-[200px]">{voucher.narration}</td>
                        <td className="text-center">
                          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-[11px] font-medium border border-gray-200">
                            {voucher.lines.length} items
                          </span>
                        </td>
                        <td className="text-center">
                          <span className={`badge ${voucher.status === 'adjusted' ? 'badge-posted' : 'badge-draft'}`}>
                            {voucher.status}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(voucher)}
                              className="p-1 text-gray-500 hover:text-[#1557b0]"
                              title="View/Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            {voucher.status === 'draft' && (
                              <button
                                onClick={() => handleDelete(voucher.id)}
                                className="p-1 text-gray-500 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
