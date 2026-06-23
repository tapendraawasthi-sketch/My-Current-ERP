import React, { useState, useEffect, useMemo } from "react";
import { Plus, Edit2, Trash2, X, Save, Search, CheckSquare, Factory, RefreshCw, AlertTriangle } from "lucide-react";
import { useStore } from "../store/useStore";
import { ProductionVoucher, ProductionVoucherLine, BillOfMaterial, VoucherStatus, VoucherType, JournalEntry } from "../lib/types";
import { generateVoucherNo } from "../lib/accounting";
import { postProductionMovement, computeStockPosition } from "../lib/stockUtils";
import ItemSelect from "../components/ui/ItemSelect";

export default function ProductionVoucherPage() {
  const { 
    productionVouchers, billsOfMaterial, items, warehouses, currentFiscalYear, stockMovements, 
    loadProductionVouchers, loadBillsOfMaterial, addProductionVoucher, updateProductionVoucher,
    addStockMovement, addVoucher, companySettings, updateCompanySettings
  } = useStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showBomModal, setShowBomModal] = useState(false);
  const [selectedBomId, setSelectedBomId] = useState<string>("");
  const [qtyToProduce, setQtyToProduce] = useState<number>(1);
  const [isPosting, setIsPosting] = useState(false);

  const [formData, setFormData] = useState<Partial<ProductionVoucher>>({
    voucherNo: "",
    date: new Date().toISOString().split("T")[0],
    dateNepali: "",
    warehouseId: warehouses.find(w => w.isDefault)?.id || "",
    narration: "",
    itemsGenerated: [],
    itemsConsumed: [],
    status: VoucherStatus.DRAFT,
  });

  useEffect(() => {
    loadProductionVouchers();
    loadBillsOfMaterial();
  }, [loadProductionVouchers, loadBillsOfMaterial]);

  const filteredVouchers = productionVouchers.filter((v) =>
    v.voucherNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.narration.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddNew = () => {
    setEditingId(null);
    const { voucherNo } = generateVoucherNo(VoucherType.JOURNAL, companySettings.voucherSeries, currentFiscalYear?.name || "2080/81");
    // We prefix with PROD to differentiate
    const prodNo = voucherNo.replace("JV", "PROD");
    setFormData({
      voucherNo: prodNo,
      date: new Date().toISOString().split("T")[0],
      dateNepali: "",
      warehouseId: warehouses.find(w => w.isDefault)?.id || "",
      narration: "",
      itemsGenerated: [],
      itemsConsumed: [],
      status: VoucherStatus.DRAFT,
    });
    setIsFormOpen(true);
  };

  const handleEdit = (voucher: ProductionVoucher) => {
    if (voucher.status === VoucherStatus.POSTED) {
      alert("Cannot edit a posted production voucher.");
      return;
    }
    setEditingId(voucher.id);
    setFormData({ ...voucher });
    setIsFormOpen(true);
  };

  const handleLoadFromBom = () => {
    if (!selectedBomId || qtyToProduce <= 0) return;
    
    const bom = billsOfMaterial.find(b => b.id === selectedBomId);
    if (!bom) return;

    const ratio = qtyToProduce / bom.qtyProduced;

    // Generated
    const generated: ProductionVoucherLine[] = [
      {
        itemId: bom.finishedItemId,
        itemName: bom.finishedItemName,
        qty: qtyToProduce,
        unit: bom.finishedItemUnit,
        rate: 0, // Will be calculated based on cost
        amount: 0
      }
    ];

    if (bom.byproducts) {
      bom.byproducts.forEach(bp => {
        generated.push({
          itemId: bp.itemId,
          itemName: bp.itemName,
          qty: bp.qty * ratio,
          unit: bp.unit,
          rate: bp.standardRate,
          amount: (bp.qty * ratio) * bp.standardRate
        });
      });
    }

    // Consumed
    const consumed: ProductionVoucherLine[] = bom.components.map(c => ({
      itemId: c.itemId,
      itemName: c.itemName,
      qty: c.qty * ratio,
      unit: c.unit,
      rate: c.standardRate,
      amount: (c.qty * ratio) * c.standardRate
    }));

    // Auto-calculate rates for generated item based on consumed cost
    const totalConsumedAmt = consumed.reduce((sum, c) => sum + c.amount, 0);
    const overheadAmt = totalConsumedAmt * ((bom.overheadPercent || 0) / 100);
    const totalCost = totalConsumedAmt + overheadAmt;
    
    const byproductsAmt = bom.byproducts ? generated.slice(1).reduce((sum, bp) => sum + bp.amount, 0) : 0;
    const netCostForFinished = totalCost - byproductsAmt;

    generated[0].amount = netCostForFinished;
    generated[0].rate = netCostForFinished / qtyToProduce;

    setFormData({
      ...formData,
      bomId: bom.id,
      itemsGenerated: generated,
      itemsConsumed: consumed,
    });

    setShowBomModal(false);
  };

  const updateLine = (listType: 'itemsGenerated' | 'itemsConsumed', index: number, updates: Partial<ProductionVoucherLine>) => {
    const newList = [...(formData[listType] || [])];
    const item = items.find(i => i.id === updates.itemId) || items.find(i => i.id === newList[index].itemId);
    
    newList[index] = { ...newList[index], ...updates };
    
    if (updates.itemId && item) {
      newList[index].itemName = item.name;
      newList[index].unit = item.unit;
      newList[index].rate = listType === 'itemsGenerated' ? (item.salesRate || 0) : (item.purchaseRate || 0);
    }
    
    newList[index].amount = newList[index].qty * newList[index].rate;
    setFormData({ ...formData, [listType]: newList });
  };

  const addLine = (listType: 'itemsGenerated' | 'itemsConsumed') => {
    const newList = [...(formData[listType] || [])];
    newList.push({ itemId: "", itemName: "", qty: 1, unit: "", rate: 0, amount: 0 });
    setFormData({ ...formData, [listType]: newList });
  };

  const removeLine = (listType: 'itemsGenerated' | 'itemsConsumed', index: number) => {
    const newList = [...(formData[listType] || [])];
    newList.splice(index, 1);
    setFormData({ ...formData, [listType]: newList });
  };

  const totalConsumed = (formData.itemsConsumed || []).reduce((sum, c) => sum + c.amount, 0);
  const totalGenerated = (formData.itemsGenerated || []).reduce((sum, c) => sum + c.amount, 0);
  const bomUsed = billsOfMaterial.find(b => b.id === formData.bomId);
  const overhead = bomUsed ? totalConsumed * ((bomUsed.overheadPercent || 0) / 100) : 0;
  const variance = totalGenerated - totalConsumed - overhead;

  const handleSave = async (e: React.FormEvent, post: boolean = false) => {
    e.preventDefault();
    if (!formData.voucherNo || !formData.date || !formData.warehouseId) {
      alert("Please fill required header fields.");
      return;
    }

    // Check negative stock
    if (post && !companySettings.allowNegativeStock) {
      for (const c of (formData.itemsConsumed || [])) {
        const pos = computeStockPosition(stockMovements, c.itemId, formData.warehouseId!);
        if (c.qty > pos.qty) {
          alert(`Insufficient stock for ${c.itemName}. Required: ${c.qty}, Available: ${pos.qty}`);
          return;
        }
      }
    }

    setIsPosting(true);
    try {
      const voucherData = {
        ...(formData as Omit<ProductionVoucher, "id">),
        totalCost: totalGenerated,
        variance,
      };

      let savedId = editingId;
      if (editingId) {
        await updateProductionVoucher(editingId, voucherData);
      } else {
        const saved = await addProductionVoucher(voucherData);
        savedId = saved.id;
        
        // Update series if auto-generated
        if (formData.voucherNo?.includes("PROD")) {
          const { updatedSeries } = generateVoucherNo(VoucherType.JOURNAL, companySettings.voucherSeries, currentFiscalYear?.name || "2080/81");
          await updateCompanySettings({ voucherSeries: updatedSeries });
        }
      }

      if (post && savedId) {
        // Generate Stock Movements
        for (const line of (formData.itemsConsumed || [])) {
          await postProductionMovement(line, "production-out" as any, formData.date!, formData.warehouseId!, savedId, addStockMovement as any);
        }
        for (const line of (formData.itemsGenerated || [])) {
          await postProductionMovement(line, "production-in" as any, formData.date!, formData.warehouseId!, savedId, addStockMovement as any);
        }

        // We would ideally generate a JV here for accounting
        // For simplicity we'll just update status
        await updateProductionVoucher(savedId, { status: VoucherStatus.POSTED });
      }

      setIsFormOpen(false);
      setEditingId(null);
    } catch (error) {
      console.error("Failed to save Production Voucher:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-toolbar">
        <div className="page-toolbar-left">
          <h1 className="page-title">Production Vouchers</h1>
          <p className="page-subtitle">Record manufacturing and conversion of materials</p>
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
            New Production
          </button>
        </div>
      </div>

      <div className="page-content-area flex flex-col gap-4">
        {isFormOpen && (
          <div className="form-wrapper bg-white p-4 rounded-lg shadow-sm border border-[#dde1ea]">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
              <h3 className="text-[14px] font-semibold text-gray-800">
                {editingId ? "Edit Production Voucher" : "New Production Voucher"}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBomModal(true)}
                  className="h-8 px-3 bg-[#eef2ff] text-[#1557b0] hover:bg-[#e0e7ff] text-[12px] font-semibold rounded-md flex items-center gap-2"
                >
                  <Factory className="h-4 w-4" />
                  Load from BoM
                </button>
                <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <form onSubmit={(e) => handleSave(e, false)}>
              <div className="form-grid-4 mb-6">
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">Voucher No <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    value={formData.voucherNo || ""}
                    onChange={(e) => setFormData({ ...formData, voucherNo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">Date (AD) <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    value={formData.date || ""}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">Warehouse <span className="text-red-500">*</span></label>
                  <select
                    required
                    className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    value={formData.warehouseId || ""}
                    onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                  >
                    <option value="">Select Warehouse</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-4">
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">Narration</label>
                  <input
                    type="text"
                    className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    value={formData.narration || ""}
                    onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[13px] font-semibold text-green-700 flex items-center gap-1">
                      <Plus className="h-4 w-4" /> Items Generated (Output)
                    </h4>
                    <button type="button" onClick={() => addLine('itemsGenerated')} className="text-[#1557b0] text-[12px] hover:underline flex items-center gap-1 font-medium">
                      Add Row
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
                    <table className="line-table w-full">
                      <thead className="bg-[#f0fdf4] border-b border-green-200">
                        <tr>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-green-800 uppercase w-[40%]">Item</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-green-800 uppercase w-[15%]">Qty</th>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-green-800 uppercase w-[15%]">Unit</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-green-800 uppercase w-[15%]">Rate</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-green-800 uppercase w-[10%]">Amt</th>
                          <th className="w-[5%]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.itemsGenerated?.map((c, idx) => (
                          <tr key={idx} className="border-b border-gray-100 last:border-0">
                            <td className="p-1">
                              <div className="w-full h-7 text-[11px]">
                                <ItemSelect value={c.itemId} onChange={(val) => updateLine('itemsGenerated', idx, { itemId: val })} />
                              </div>
                            </td>
                            <td className="p-1">
                              <input type="number" min="0.001" step="any" value={c.qty || ""} onChange={(e) => updateLine('itemsGenerated', idx, { qty: Number(e.target.value) })} className="w-full h-7 px-1 text-right text-[11px] border border-gray-200 rounded focus:border-[#1557b0]" />
                            </td>
                            <td className="p-1 text-[11px] text-gray-600 px-2">{c.unit}</td>
                            <td className="p-1">
                              <input type="number" step="any" value={c.rate || ""} onChange={(e) => updateLine('itemsGenerated', idx, { rate: Number(e.target.value) })} className="w-full h-7 px-1 text-right text-[11px] border border-gray-200 rounded focus:border-[#1557b0]" />
                            </td>
                            <td className="p-1 text-right amt text-[11px] px-2 font-medium">{c.amount?.toFixed(2)}</td>
                            <td className="p-1 text-center">
                              <button type="button" onClick={() => removeLine('itemsGenerated', idx)} className="text-gray-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[13px] font-semibold text-red-700 flex items-center gap-1">
                      <RefreshCw className="h-4 w-4" /> Items Consumed (Input)
                    </h4>
                    <button type="button" onClick={() => addLine('itemsConsumed')} className="text-[#1557b0] text-[12px] hover:underline flex items-center gap-1 font-medium">
                      Add Row
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
                    <table className="line-table w-full">
                      <thead className="bg-[#fef2f2] border-b border-red-200">
                        <tr>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-red-800 uppercase w-[35%]">Item</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-red-800 uppercase w-[15%]">Qty</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-red-800 uppercase w-[15%]">Stock</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-red-800 uppercase w-[15%]">Rate</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-red-800 uppercase w-[15%]">Amt</th>
                          <th className="w-[5%]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.itemsConsumed?.map((c, idx) => {
                          const stockPos = c.itemId && formData.warehouseId ? computeStockPosition(stockMovements, c.itemId, formData.warehouseId) : { qty: 0 };
                          const insufficient = c.qty > stockPos.qty;
                          return (
                            <tr key={idx} className="border-b border-gray-100 last:border-0">
                              <td className="p-1 relative">
                                <div className="w-full h-7 text-[11px]">
                                  <ItemSelect value={c.itemId} onChange={(val) => updateLine('itemsConsumed', idx, { itemId: val })} />
                                </div>
                                {insufficient && <div title="Insufficient Stock" className="absolute right-8 top-3"><AlertTriangle className="h-3 w-3 text-red-500" /></div>}
                              </td>
                              <td className="p-1">
                                <input type="number" min="0.001" step="any" value={c.qty || ""} onChange={(e) => updateLine('itemsConsumed', idx, { qty: Number(e.target.value) })} className={`w-full h-7 px-1 text-right text-[11px] border rounded focus:border-[#1557b0] ${insufficient ? 'border-red-300 text-red-600 bg-red-50' : 'border-gray-200'}`} />
                              </td>
                              <td className="p-1 text-right text-[11px] text-gray-500 px-2">{stockPos.qty} {c.unit}</td>
                              <td className="p-1">
                                <input type="number" step="any" value={c.rate || ""} onChange={(e) => updateLine('itemsConsumed', idx, { rate: Number(e.target.value) })} className="w-full h-7 px-1 text-right text-[11px] border border-gray-200 rounded focus:border-[#1557b0]" />
                              </td>
                              <td className="p-1 text-right amt text-[11px] px-2 font-medium">{c.amount?.toFixed(2)}</td>
                              <td className="p-1 text-center">
                                <button type="button" onClick={() => removeLine('itemsConsumed', idx)} className="text-gray-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mb-4">
                <div className="totals-panel w-80">
                  <div className="totals-row border-b border-gray-100 pb-2 mb-2 flex justify-between">
                    <span className="text-[11px] text-gray-600 font-medium">Total Input Cost:</span>
                    <span className="text-[12px] font-bold text-gray-800 amt">{totalConsumed.toFixed(2)}</span>
                  </div>
                  <div className="totals-row border-b border-gray-100 pb-2 mb-2 flex justify-between">
                    <span className="text-[11px] text-gray-600 font-medium">Overhead:</span>
                    <span className="text-[12px] font-bold text-gray-800 amt">{overhead.toFixed(2)}</span>
                  </div>
                  <div className="totals-row border-b border-gray-100 pb-2 mb-2 flex justify-between">
                    <span className="text-[11px] text-gray-600 font-medium">Total Output Value:</span>
                    <span className="text-[12px] font-bold text-gray-800 amt">{totalGenerated.toFixed(2)}</span>
                  </div>
                  <div className="totals-row flex justify-between pt-1">
                    <span className="text-[12px] text-gray-800 font-bold uppercase">Variance:</span>
                    <span className={`text-[14px] font-bold amt ${variance > 0 ? 'text-green-600' : variance < 0 ? 'text-red-600' : 'text-gray-600'}`}>{variance.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button type="button" onClick={() => setIsFormOpen(false)} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-semibold rounded-md hover:bg-gray-50">
                  Cancel
                </button>
                <button type="button" onClick={(e) => handleSave(e, false)} disabled={isPosting} className="h-8 px-3 bg-white border border-[#1557b0] text-[#1557b0] text-[12px] font-semibold rounded-md hover:bg-[#eef2ff]">
                  Save Draft
                </button>
                <button type="button" onClick={(e) => handleSave(e, true)} disabled={isPosting} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-semibold rounded-md flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  {isPosting ? 'Posting...' : 'Post Production'}
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
                  <th className="th-left">Voucher No</th>
                  <th className="th-left">Date</th>
                  <th className="th-left">Narration</th>
                  <th className="th-right">Total Cost</th>
                  <th className="th-center">Status</th>
                  <th className="th-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      No Production Vouchers found. Click 'New Production' to create one.
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((voucher) => (
                    <tr key={voucher.id}>
                      <td className="font-medium text-[#1557b0]">{voucher.voucherNo}</td>
                      <td>{new Date(voucher.date).toLocaleDateString()}</td>
                      <td className="truncate max-w-[200px]">{voucher.narration}</td>
                      <td className="text-right amt font-medium">{voucher.totalCost.toFixed(2)}</td>
                      <td className="text-center">
                        <span className={`badge ${voucher.status === VoucherStatus.POSTED ? 'badge-posted' : 'badge-draft'}`}>
                          {voucher.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => handleEdit(voucher)}
                          className="p-1 text-gray-500 hover:text-[#1557b0]"
                          title="View/Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showBomModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[400px]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-gray-800">Load from BoM</h3>
              <button onClick={() => setShowBomModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">Select BoM</label>
                <select
                  className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0] focus:ring-1 focus:ring-[#1557b0]"
                  value={selectedBomId}
                  onChange={(e) => setSelectedBomId(e.target.value)}
                >
                  <option value="">-- Select BoM --</option>
                  {billsOfMaterial.filter(b => b.isActive).map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.finishedItemName})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">Qty to Produce</label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0] focus:ring-1 focus:ring-[#1557b0]"
                  value={qtyToProduce}
                  onChange={(e) => setQtyToProduce(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
              <button onClick={() => setShowBomModal(false)} className="h-8 px-3 border border-gray-300 rounded-md text-[12px] font-medium text-gray-700 hover:bg-white">
                Cancel
              </button>
              <button onClick={handleLoadFromBom} className="h-8 px-3 bg-[#1557b0] text-white rounded-md text-[12px] font-medium hover:bg-[#0f4a96]">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
