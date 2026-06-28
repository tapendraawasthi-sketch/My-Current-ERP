// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { Package, AlertTriangle, Calendar, Search, Plus, Edit, Trash2, Eye, CheckCircle, XCircle } from "lucide-react";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const BatchManagement: React.FC = () => {
  const { items, batches, warehouses, parties, vouchers, addBatch, updateBatch } = useStore();
  const [activeTab, setActiveTab] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [threshold, setThreshold] = useState(30);
  const [searchBatch, setSearchBatch] = useState("");
  const [serials, setSerials] = useState([]);
  
  // Form state
  const [form, setForm] = useState({
    itemId: "",
    itemName: "",
    batchNo: "",
    mfgDate: "",
    expiryDate: "",
    mrp: 0,
    purchaseRate: 0,
    saleRate: 0,
    openingQty: 0,
    unit: "",
    warehouseId: "",
    supplierId: "",
    purchaseInvoiceNo: "",
    purchaseDate: new Date().toISOString().split('T')[0]
  });

  // Load serial numbers
  useEffect(() => {
    const db = getDB();
    db.serialNumbers.toArray()
      .catch(() => [])
      .then(setSerials);
  }, []);

  // Calculate days to expiry
  const calculateDaysToExpiry = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Filter batches based on search and status
  const filteredBatches = useMemo(() => {
    return batches.filter(batch => {
      const matchesSearch = batch.batchNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           batch.itemName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || batch.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [batches, searchTerm, statusFilter]);

  // Near expiry batches
  const nearExpiryBatches = useMemo(() => {
    return batches.filter(batch => {
      const daysToExpiry = calculateDaysToExpiry(batch.expiryDate);
      return daysToExpiry <= threshold && daysToExpiry > 0;
    });
  }, [batches, threshold]);

  // Expired batches
  const expiredBatches = useMemo(() => {
    return batches.filter(batch => {
      const daysToExpiry = calculateDaysToExpiry(batch.expiryDate);
      return daysToExpiry <= 0;
    });
  }, [batches]);

  // Lot traceability results
  const lotTraceResults = useMemo(() => {
    if (!searchBatch) return { forward: [], backward: null };
    
    const matchingBatch = batches.find(b => b.batchNo === searchBatch);
    if (!matchingBatch) return { forward: [], backward: null };
    
    // Forward trace - find sales invoices with this batch
    const forwardTrace = vouchers
      .filter(v => v.type === "sales-invoice" && v.status !== "cancelled")
      .flatMap(v => 
        (v.lines || [])
          .filter(l => l.batchId === matchingBatch.id)
          .map(l => ({
            date: v.date,
            invoiceNo: v.invoiceNo,
            customerName: v.partyName,
            qty: l.quantity,
            rate: l.rate
          }))
      );
    
    return { forward: forwardTrace, backward: matchingBatch };
  }, [vouchers, batches, searchBatch]);

  // Handle form changes
  const handleFormChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    
    // Auto-fill unit when item is selected
    if (field === 'itemId' && value) {
      const item = items.find(i => i.id === value);
      if (item) {
        setForm(prev => ({ ...prev, unit: item.unit || "Pcs", itemName: item.name }));
      }
    }
    
    // Auto-fill supplier name when supplier is selected
    if (field === 'supplierId' && value) {
      const party = parties.find(p => p.id === value);
      if (party) {
        setForm(prev => ({ ...prev, supplierName: party.name }));
      }
    }
  };

  // Handle save batch
  const handleSaveBatch = async () => {
    if (!form.batchNo.trim() || !form.itemId || !form.expiryDate) {
      toast.error("Batch No, Item, and Expiry Date are required");
      return;
    }
    
    const db = getDB();
    const batchRecord = {
      ...form,
      id: selectedBatch?.id || generateId(),
      currentQty: form.openingQty,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    
    try {
      if (selectedBatch) {
        await updateBatch(selectedBatch.id, batchRecord);
        toast.success("Batch updated successfully");
      } else {
        await addBatch(batchRecord);
        toast.success("Batch created successfully");
      }
      setShowForm(false);
      setForm({
        itemId: "",
        itemName: "",
        batchNo: "",
        mfgDate: "",
        expiryDate: "",
        mrp: 0,
        purchaseRate: 0,
        saleRate: 0,
        openingQty: 0,
        unit: "",
        warehouseId: "",
        supplierId: "",
        purchaseInvoiceNo: "",
        purchaseDate: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      toast.error("Failed to save batch");
    }
  };

  // Handle edit batch
  const handleEdit = (batch: any) => {
    setSelectedBatch(batch);
    setForm({
      itemId: batch.itemId,
      itemName: batch.itemName,
      batchNo: batch.batchNo,
      mfgDate: batch.mfgDate,
      expiryDate: batch.expiryDate,
      mrp: batch.mrp,
      purchaseRate: batch.purchaseRate,
      saleRate: batch.saleRate,
      openingQty: batch.openingQty,
      unit: batch.unit,
      warehouseId: batch.warehouseId,
      supplierId: batch.supplierId,
      purchaseInvoiceNo: batch.purchaseInvoiceNo,
      purchaseDate: batch.purchaseDate
    });
    setShowForm(true);
  };

  // Handle delete batch
  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this batch?")) {
      try {
        const db = getDB();
        await db.batches.update(id, { isActive: false });
        toast.success("Batch deleted successfully");
      } catch (error) {
        toast.error("Failed to delete batch");
      }
    }
  };

  // Handle write off expired batch
  const handleWriteOff = async (batch: any) => {
    if (window.confirm(`Write off expired batch ${batch.batchNo}? This will create a stock journal.`)) {
      try {
        const db = getDB();
        const journalVoucher = {
          id: generateId(),
          type: "stock-journal",
          date: new Date().toISOString().split('T')[0],
          status: "posted",
          narration: `Write-off expired batch ${batch.batchNo}`,
          lines: [
            {
              itemId: batch.itemId,
              batchId: batch.id,
              warehouseId: batch.warehouseId,
              quantity: batch.currentQty,
              rate: batch.purchaseRate,
              type: "out"
            }
          ],
          createdAt: new Date().toISOString()
        };
        
        await db.vouchers.add(journalVoucher);
        await db.batches.update(batch.id, { currentQty: 0 });
        toast.success(`Batch ${batch.batchNo} written off successfully`);
      } catch (error) {
        toast.error("Failed to write off batch");
      }
    }
  };

  // Calculate status for a batch
  const getStatusInfo = (batch: any) => {
    const daysToExpiry = calculateDaysToExpiry(batch.expiryDate);
    
    if (daysToExpiry <= 0) {
      return { status: "Expired", class: "bg-red-100 text-red-700", days: daysToExpiry };
    } else if (daysToExpiry <= 30) {
      return { status: "Near Expiry", class: "bg-amber-100 text-amber-700", days: daysToExpiry };
    } else {
      return { status: "Good", class: "bg-green-100 text-green-700", days: daysToExpiry };
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    const headers = ["Batch No", "Item Name", "Qty Available", "Expiry Date", "Status", "Warehouse"];
    const rows = filteredBatches.map(batch => [
      batch.batchNo,
      batch.itemName,
      batch.currentQty,
      batch.expiryDate,
      getStatusInfo(batch).status,
      warehouses.find(w => w.id === batch.warehouseId)?.name || "N/A"
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Batches");
    XLSX.writeFile(wb, "Batch_Management_Report.xlsx");
    toast.success("Batch report exported to Excel");
  };

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4">
      <div className="w-full">
        {/* Standard Page Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Batch Management</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Manage batch details, lot traceability, and expiry tracking</p>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4 bg-white px-2 pt-2 rounded-t-md shadow-sm">
          {["Batch Master", "Near Expiry Alert", "Expired Stock", "Lot Traceability", "Serial Number Register"].map((tab, index) => (
            <button
              key={index}
              className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors ${
                activeTab === index 
                  ? 'border-[#1557b0] text-[#1557b0]' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab(index)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 0 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-3 mb-4 max-w-full overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search batches..."
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-48"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                >
                  <option value="">All Statuses</option>
                  <option value="Expired">Expired</option>
                  <option value="Near Expiry">Near Expiry</option>
                  <option value="Good">Good</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
                  onClick={() => {
                    setSelectedBatch(null);
                    setForm({
                      itemId: "",
                      itemName: "",
                      batchNo: "",
                      mfgDate: "",
                      expiryDate: "",
                      mrp: 0,
                      purchaseRate: 0,
                      saleRate: 0,
                      openingQty: 0,
                      unit: "",
                      warehouseId: "",
                      supplierId: "",
                      purchaseInvoiceNo: "",
                      purchaseDate: new Date().toISOString().split('T')[0]
                    });
                    setShowForm(true);
                  }}
                >
                  <Plus size={14} />
                  Add Batch
                </button>
                <button
                  className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
                  onClick={exportToExcel}
                >
                  <Search size={14} />
                  Export to Excel
                </button>
              </div>
            </div>
            
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Batch No</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Item Name</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Qty Available</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Expiry Date</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">MFG Date</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Days to Expiry</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Warehouse</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map(batch => {
                    const statusInfo = getStatusInfo(batch);
                    return (
                      <tr key={batch.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">{batch.batchNo}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">{batch.itemName}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">{batch.currentQty}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{batch.expiryDate}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{batch.mfgDate}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`${statusInfo.class} px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide`}>
                            {statusInfo.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">{statusInfo.days}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {warehouses.find(w => w.id === batch.warehouseId)?.name || "N/A"}
                        </td>
                        <td className="px-3 py-2.5 text-center flex items-center justify-center gap-3">
                          <button 
                            className="text-[#1557b0] hover:text-[#0f4a96]"
                            onClick={() => handleEdit(batch)}
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(batch.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredBatches.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-[12px] text-gray-500 text-center">
                        No batches found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-3 mb-4 max-w-full overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-medium text-gray-600">Days Threshold:</label>
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-24"
                />
              </div>
            </div>
            
            {nearExpiryBatches.length > 0 && (
              <div className="bg-amber-50 text-amber-800 p-3 rounded-md border border-amber-200 mb-4 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <span className="text-[12px] font-medium">
                  {nearExpiryBatches.length} batches expiring within {threshold} days — Total value: NPR {money(nearExpiryBatches.reduce((sum, b) => sum + (b.currentQty * b.saleRate), 0))}
                </span>
              </div>
            )}
            
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Batch No</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Expiry Date</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Days Remaining</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Value</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {nearExpiryBatches.map(batch => {
                    const daysToExpiry = calculateDaysToExpiry(batch.expiryDate);
                    return (
                      <tr key={batch.id} className="border-b border-gray-100 hover:bg-gray-50 bg-amber-50/20">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">{batch.batchNo}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">{batch.itemName}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">{batch.currentQty}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{batch.expiryDate}</td>
                        <td className="px-3 py-2.5 text-[12px] text-amber-700 font-medium text-right">{daysToExpiry}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right font-mono">{money(batch.currentQty * batch.saleRate)}</td>
                        <td className="px-3 py-2.5 text-center flex items-center justify-center gap-2">
                          <button 
                            className="h-6 px-2 bg-[#1557b0] text-white text-[10px] font-medium rounded-md hover:bg-[#0f4a96]"
                            onClick={() => navigator.clipboard.writeText(batch.itemName)}
                          >
                            Sell First
                          </button>
                          <button 
                            className="h-6 px-2 bg-red-600 text-white text-[10px] font-medium rounded-md hover:bg-red-700"
                            onClick={() => toast.info("Return to supplier functionality would go here")}
                          >
                            Return
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {nearExpiryBatches.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-[12px] text-gray-500 text-center">
                        No batches expiring within {threshold} days.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-3 mb-4 max-w-full overflow-auto">
            <div className="bg-red-50 text-red-800 p-4 rounded-md border border-red-200 mb-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-600" />
                <span className="text-[13px] font-medium">
                  Expired Stock Alert
                </span>
              </div>
              <span className="text-[14px] font-bold">
                Total Value: NPR {money(expiredBatches.reduce((sum, b) => sum + (b.currentQty * b.purchaseRate), 0))}
              </span>
            </div>
            
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Batch No</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Expiry Date</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Value</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {expiredBatches.map(batch => {
                    return (
                      <tr key={batch.id} className="border-b border-gray-100 hover:bg-gray-50 bg-red-50/30">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">{batch.batchNo}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">{batch.itemName}</td>
                        <td className="px-3 py-2.5 text-[12px] text-red-700 font-medium text-right">{batch.currentQty}</td>
                        <td className="px-3 py-2.5 text-[12px] text-red-700 font-medium">{batch.expiryDate}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right font-mono">{money(batch.currentQty * batch.purchaseRate)}</td>
                        <td className="px-3 py-2.5 text-center flex items-center justify-center">
                          <button 
                            className="h-7 px-3 bg-red-600 text-white text-[11px] font-medium rounded-md hover:bg-red-700"
                            onClick={() => handleWriteOff(batch)}
                          >
                            Write Off
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {expiredBatches.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-[12px] text-gray-500 text-center">
                        No expired batches found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 3 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={searchBatch}
                onChange={(e) => setSearchBatch(e.target.value)}
                placeholder="Enter Batch Number to trace..."
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-64"
              />
              <button
                className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
                onClick={() => {}}
              >
                Trace Lot
              </button>
            </div>
            
            {lotTraceResults.forward.length > 0 && (
              <div className="mb-6 border border-gray-200 rounded-md overflow-hidden">
                <div className="bg-[#f5f6fa] border-b border-gray-200 p-3">
                  <h3 className="text-[13px] font-semibold text-gray-800">Forward Trace (Sales)</h3>
                </div>
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Invoice No</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Customer Name</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotTraceResults.forward.map((sale, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 text-[12px] text-gray-700">{sale.date}</td>
                        <td className="px-3 py-2 text-[12px] text-gray-700 font-mono">{sale.invoiceNo}</td>
                        <td className="px-3 py-2 text-[12px] text-gray-700">{sale.customerName}</td>
                        <td className="px-3 py-2 text-[12px] text-gray-700 text-right">{sale.qty}</td>
                        <td className="px-3 py-2 text-[12px] text-gray-700 text-right font-mono">{money(sale.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {lotTraceResults.backward && (
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <div className="bg-[#f5f6fa] border-b border-gray-200 p-3">
                  <h3 className="text-[13px] font-semibold text-gray-800">Backward Trace (Purchases)</h3>
                </div>
                <div className="p-4 bg-white">
                  <div className="flex items-start">
                    <div className="flex flex-col items-center mr-4 mt-1">
                      <div className="w-3 h-3 bg-[#1557b0] rounded-full"></div>
                      <div className="w-0.5 h-16 bg-gray-200 my-1"></div>
                      <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-gray-800 mb-1">Receipt from Supplier</div>
                      <div className="text-[12px] text-gray-600 mb-0.5">
                        <span className="font-medium mr-1">Supplier:</span> 
                        {parties.find(p => p.id === lotTraceResults.backward.supplierId)?.name || "N/A"}
                      </div>
                      <div className="text-[12px] text-gray-600 mb-0.5">
                        <span className="font-medium mr-1">Invoice No:</span> 
                        <span className="font-mono">{lotTraceResults.backward.purchaseInvoiceNo || "N/A"}</span>
                      </div>
                      <div className="text-[12px] text-gray-600">
                        <span className="font-medium mr-1">Date:</span> 
                        {lotTraceResults.backward.purchaseDate || "N/A"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {searchBatch && lotTraceResults.forward.length === 0 && !lotTraceResults.backward && (
              <div className="text-center p-8 text-[13px] text-gray-500">
                No trace data found for batch "{searchBatch}"
              </div>
            )}
            
            {!searchBatch && (
              <div className="text-center p-8 text-[13px] text-gray-400 border-2 border-dashed border-gray-200 rounded-md mt-4">
                Enter a batch number above to see its full trace history
              </div>
            )}
          </div>
        )}

        {activeTab === 4 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-3 mb-4 max-w-full overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[14px] font-semibold text-gray-800">Serial Number Register</h3>
            </div>
            
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Serial No</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Purchase Date</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Sale Date</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Warranty Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {serials.map(serial => (
                    <tr key={serial.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono font-medium">{serial.serialNo}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{serial.itemName}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`${serial.status === "in-stock" ? "bg-green-100 text-green-700" : serial.status === "sold" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"} px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide`}>
                          {serial.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{serial.purchaseDate}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{serial.customerName || "N/A"}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{serial.saleDate || "N/A"}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{serial.warrantyExpiry}</td>
                    </tr>
                  ))}
                  {serials.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-[12px] text-gray-500 text-center">
                        No serial numbers recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Batch Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md shadow-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-[#f5f6fa]">
              <h2 className="text-[15px] font-semibold text-gray-800">
                {selectedBatch ? "Edit Batch" : "Add New Batch"}
              </h2>
              <button 
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Item <span className="text-red-500">*</span></label>
                  <select
                    value={form.itemId}
                    onChange={(e) => handleFormChange('itemId', e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  >
                    <option value="">Select Item</option>
                    {items.map(item => (
                      <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Batch Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.batchNo}
                    onChange={(e) => handleFormChange('batchNo', e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Manufacturing Date</label>
                  <input
                    type="date"
                    value={form.mfgDate}
                    onChange={(e) => handleFormChange('mfgDate', e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Expiry Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => handleFormChange('expiryDate', e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">MRP</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.mrp}
                    onChange={(e) => handleFormChange('mrp', parseFloat(e.target.value) || 0)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Purchase Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.purchaseRate}
                    onChange={(e) => handleFormChange('purchaseRate', parseFloat(e.target.value) || 0)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Sale Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.saleRate}
                    onChange={(e) => handleFormChange('saleRate', parseFloat(e.target.value) || 0)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Opening Quantity <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="1"
                    value={form.openingQty}
                    onChange={(e) => handleFormChange('openingQty', parseInt(e.target.value) || 0)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Unit</label>
                  <input
                    type="text"
                    value={form.unit}
                    readOnly
                    className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-md bg-gray-50 text-gray-500 w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Warehouse</label>
                  <select
                    value={form.warehouseId}
                    onChange={(e) => handleFormChange('warehouseId', e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  >
                    <option value="">Select Warehouse</option>
                    {warehouses.map(warehouse => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Supplier</label>
                  <select
                    value={form.supplierId}
                    onChange={(e) => handleFormChange('supplierId', e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  >
                    <option value="">Select Supplier</option>
                    {parties.filter(p => p.type?.toLowerCase().includes("supplier")).map(party => (
                      <option key={party.id} value={party.id}>{party.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Purchase Invoice No</label>
                  <input
                    type="text"
                    value={form.purchaseInvoiceNo}
                    onChange={(e) => handleFormChange('purchaseInvoiceNo', e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={form.purchaseDate}
                    onChange={(e) => handleFormChange('purchaseDate', e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full md:w-1/2"
                  />
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <button
                className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button
                className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md transition-colors"
                onClick={handleSaveBatch}
              >
                {selectedBatch ? "Update" : "Save"} Batch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchManagement;
