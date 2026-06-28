// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "react-hot-toast";
import { Calculator, Trash2, Edit, Plus, AlertTriangle, CheckCircle, X } from "lucide-react";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

interface FixedAsset {
  id: string;
  assetCode: string;
  assetName: string;
  category: "Pool A" | "Pool B" | "Pool C" | "Pool D";
  purchaseDate: string;
  originalCost: number;
  salvageValue: number;
  usefulLifeYears: number;
  depreciationMethodBook: "SLM" | "WDV";
  depreciationRateBook: number;
  depreciationRateTax: number;
  location: string;
  department: string;
  responsiblePerson: string;
  serialNumber?: string;
  insurancePolicyNo?: string;
  insuranceCompany?: string;
  insuranceExpiry?: string;
  insuranceValue?: number;
  currentWDV: number;
  accumulatedDepreciation: number;
  disposalDate?: string;
  disposalAmount?: number;
  disposalStatus: "active" | "disposed" | "scrapped";
  linkedLedgerId?: string;
}

const POOL_RATES = { "Pool A": 0.05, "Pool B": 0.25, "Pool C": 0.15, "Pool D": 0.20 };

const FixedAssetRegister: React.FC = () => {
  const { accounts, addVoucher, currentFiscalYear } = useStore();
  const [activeTab, setActiveTab] = useState(0);
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [depreciationTab, setDepreciationTab] = useState<"book" | "tax">("book");
  const [disposalForm, setDisposalForm] = useState({
    assetId: "",
    disposalDate: new Date().toISOString().split('T')[0],
    method: "sale",
    saleProceeds: 0
  });
  const [computedDepreciation, setComputedDepreciation] = useState<any>(null);
  const [filters, setFilters] = useState({
    pool: "",
    location: "",
    status: "active",
    search: ""
  });

  useEffect(() => {
    const db = getDB();
    db.table("fixedAssets").toArray()
      .catch(() => {
        const s = localStorage.getItem("fixedAssets");
        return s ? JSON.parse(s) : [];
      })
      .then(data => {
        if (data.length === 0) {
          const s = localStorage.getItem("fixedAssets");
          setAssets(s ? JSON.parse(s) : []);
        } else {
          setAssets(data);
        }
      });
  }, []);

  const saveAsset = async (asset: FixedAsset) => {
    const db = getDB();
    await db.table("fixedAssets").put(asset).catch(async () => {
      const stored = JSON.parse(localStorage.getItem("fixedAssets") || "[]");
      const idx = stored.findIndex((a: any) => a.id === asset.id);
      if (idx >= 0) stored[idx] = asset;
      else stored.push(asset);
      localStorage.setItem("fixedAssets", JSON.stringify(stored));
    });
    
    setAssets(prev => {
      const idx = prev.findIndex(a => a.id === asset.id);
      if (idx >= 0) {
        const n = [...prev];
        n[idx] = asset;
        return n;
      }
      return [...prev, asset];
    });
  };

  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchesPool = !filters.pool || asset.category === filters.pool;
      const matchesLocation = !filters.location || asset.location.toLowerCase().includes(filters.location.toLowerCase());
      const matchesStatus = !filters.status || asset.disposalStatus === filters.status;
      const matchesSearch = !filters.search || asset.assetName.toLowerCase().includes(filters.search.toLowerCase());
      return matchesPool && matchesLocation && matchesStatus && matchesSearch;
    });
  }, [assets, filters]);

  const generateAssetCode = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const sequence = assets.length + 1;
    return `FA-${year}-${sequence.toString().padStart(3, '0')}`;
  };

  const handleAssetFormChange = (field: string, value: any) => {
    if (editingAsset) {
      setEditingAsset(prev => ({ ...prev!, [field]: value }));
    }
  };

  const saveAssetForm = async () => {
    if (!editingAsset) return;
    
    try {
      await saveAsset(editingAsset);
      setShowAssetForm(false);
      setEditingAsset(null);
      toast.success("Asset saved successfully");
    } catch (error) {
      toast.error("Failed to save asset");
    }
  };

  const computeBookDepreciation = () => {
    const fiscalStart = new Date(currentFiscalYear?.startDate || new Date().toISOString());
    const fiscalEnd = new Date(currentFiscalYear?.endDate || new Date().toISOString());
    
    return assets
      .filter(a => a.disposalStatus === "active")
      .map(asset => {
        const purchaseDate = new Date(asset.purchaseDate);
        const yearsElapsed = Math.max(0, (fiscalEnd.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
        
        let annualDepr = 0;
        if (asset.depreciationMethodBook === "SLM") {
          annualDepr = (asset.originalCost - asset.salvageValue) / Math.max(asset.usefulLifeYears, 1);
        } else {
          annualDepr = asset.currentWDV * (asset.depreciationRateBook || 0.1);
        }
        
        const monthlyDepr = annualDepr / 12;
        const accDeprToDate = Math.min(annualDepr * yearsElapsed, asset.originalCost - asset.salvageValue);
        const currentWDV = Math.max(0, asset.originalCost - accDeprToDate);
        
        return {
          ...asset,
          annualDepr,
          monthlyDepr,
          accDeprToDate,
          currentWDV
        };
      });
  };

  const computeTaxDepreciation = () => {
    const pools = ["Pool A", "Pool B", "Pool C", "Pool D"];
    return pools.map(pool => {
      const poolAssets = assets.filter(a => a.category === pool && a.disposalStatus === "active");
      const openingWDV = poolAssets.reduce((sum, a) => sum + a.currentWDV, 0);
      
      const additions = poolAssets.filter(a => new Date(a.purchaseDate).getFullYear() === new Date().getFullYear())
        .reduce((sum, a) => sum + a.originalCost, 0);
      
      const disposals = assets.filter(a => a.category === pool && a.disposalStatus === "disposed" && 
        new Date(a.disposalDate!).getFullYear() === new Date().getFullYear())
        .reduce((sum, a) => sum + (a.disposalAmount || 0), 0);
      
      const adjustedWDV = Math.max(0, openingWDV + additions - disposals);
      const depreciation = adjustedWDV * POOL_RATES[pool as keyof typeof POOL_RATES];
      const closingWDV = adjustedWDV - depreciation;
      
      return {
        pool,
        rate: POOL_RATES[pool as keyof typeof POOL_RATES],
        openingWDV,
        additions,
        disposals,
        adjustedWDV,
        depreciation,
        closingWDV
      };
    });
  };

  const handleComputeDepreciation = () => {
    if (depreciationTab === "book") {
      setComputedDepreciation(computeBookDepreciation());
    } else {
      setComputedDepreciation(computeTaxDepreciation());
    }
    toast.success("Depreciation computed successfully");
  };

  const handlePostDepreciation = async () => {
    if (!computedDepreciation || depreciationTab !== "book") return;
    
    try {
      const depExpenseAccount = accounts.find(a => a.name.toLowerCase().includes("depreciation") && a.type === "expense");
      const accDepAccount = accounts.find(a => a.name.toLowerCase().includes("accumulated depreciation") && a.type === "asset");
      
      if (!depExpenseAccount || !accDepAccount) {
        toast.error("Required accounts not found. Please create 'Depreciation' expense and 'Accumulated Depreciation' asset accounts.");
        return;
      }
      
      const totalDepr = computedDepreciation.reduce((sum: number, a: any) => sum + a.annualDepr, 0);
      
      await addVoucher({
        id: generateId(),
        type: "journal",
        status: "posted",
        date: new Date().toISOString().split('T')[0],
        narration: "Annual Depreciation Posting",
        lines: [
          {
            accountId: depExpenseAccount.id,
            accountName: depExpenseAccount.name,
            debit: totalDepr,
            credit: 0
          },
          {
            accountId: accDepAccount.id,
            accountName: accDepAccount.name,
            debit: 0,
            credit: totalDepr
          }
        ],
        totalDebit: totalDepr,
        totalCredit: totalDepr
      });
      
      for (const asset of computedDepreciation) {
        const updatedAsset = {
          ...asset,
          accumulatedDepreciation: asset.accDeprToDate,
          currentWDV: asset.currentWDV
        };
        await saveAsset(updatedAsset);
      }
      
      toast.success("Depreciation journal posted successfully");
      setComputedDepreciation(null);
    } catch (error) {
      toast.error("Failed to post depreciation journal");
    }
  };

  const handleDisposalFormChange = (field: string, value: any) => {
    setDisposalForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePostDisposal = async () => {
    if (!disposalForm.assetId || !disposalForm.disposalDate) {
      toast.error("Please select asset and disposal date");
      return;
    }
    
    try {
      const asset = assets.find(a => a.id === disposalForm.assetId);
      if (!asset) return;
      
      const accDeprAtDisposal = asset.accumulatedDepreciation;
      const wdvAtDisposal = asset.currentWDV;
      const gainLoss = disposalForm.saleProceeds - wdvAtDisposal;
      const isGain = gainLoss >= 0;
      
      const cashAccount = accounts.find(a => a.name.toLowerCase().includes("cash") || a.name.toLowerCase().includes("bank"));
      const assetAccount = accounts.find(a => a.name === asset.assetName) || accounts.find(a => a.name.toLowerCase().includes("fixed asset"));
      const accDepAccount = accounts.find(a => a.name.toLowerCase().includes("accumulated depreciation"));
      const gainAccount = accounts.find(a => a.name.toLowerCase().includes("gain on disposal"));
      const lossAccount = accounts.find(a => a.name.toLowerCase().includes("loss on disposal"));
      
      if (!cashAccount || !assetAccount || !accDepAccount) {
        toast.error("Required accounts not found. Need Cash/Bank, Fixed Asset, and Accumulated Depreciation accounts.");
        return;
      }
      
      const lines = [
        {
          accountId: cashAccount.id,
          accountName: cashAccount.name,
          debit: disposalForm.saleProceeds,
          credit: 0
        },
        {
          accountId: accDepAccount.id,
          accountName: accDepAccount.name,
          debit: accDeprAtDisposal,
          credit: 0
        }
      ];
      
      if (isGain) {
        lines.push({
          accountId: assetAccount.id,
          accountName: assetAccount.name,
          debit: 0,
          credit: asset.originalCost
        });
        if (gainAccount && gainLoss > 0) {
          lines.push({
            accountId: gainAccount.id,
            accountName: gainAccount.name,
            debit: 0,
            credit: gainLoss
          });
        } else if (gainLoss > 0) {
          toast.error("Gain on Disposal account not found");
          return;
        }
      } else {
        lines.push({
          accountId: assetAccount.id,
          accountName: assetAccount.name,
          debit: 0,
          credit: asset.originalCost
        });
        if (lossAccount) {
          lines.push({
            accountId: lossAccount.id,
            accountName: lossAccount.name,
            debit: Math.abs(gainLoss),
            credit: 0
          });
        } else {
          toast.error("Loss on Disposal account not found");
          return;
        }
      }
      
      const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
      
      await addVoucher({
        id: generateId(),
        type: "journal",
        status: "posted",
        date: disposalForm.disposalDate,
        narration: `Disposal of asset ${asset.assetName}`,
        lines,
        totalDebit: totalDebits,
        totalCredit: totalDebits
      });
      
      const updatedAsset = {
        ...asset,
        disposalStatus: "disposed",
        disposalDate: disposalForm.disposalDate,
        disposalAmount: disposalForm.saleProceeds,
        currentWDV: 0
      };
      
      await saveAsset(updatedAsset);
      toast.success("Asset disposal posted successfully");
      setDisposalForm({ assetId: "", disposalDate: new Date().toISOString().split('T')[0], method: "sale", saleProceeds: 0 });
    } catch (error) {
      toast.error("Failed to post disposal");
    }
  };

  const summaryData = useMemo(() => {
    const activeAssets = assets.filter(a => a.disposalStatus === "active");
    const totalGrossBlock = activeAssets.reduce((sum, a) => sum + a.originalCost, 0);
    const totalAccDepreciation = activeAssets.reduce((sum, a) => sum + a.accumulatedDepreciation, 0);
    const netWDV = activeAssets.reduce((sum, a) => sum + a.currentWDV, 0);
    const taxDepreciation = computeTaxDepreciation();
    const taxDepClaimable = taxDepreciation.reduce((sum, p) => sum + p.depreciation, 0);
    
    return {
      totalGrossBlock,
      totalAccDepreciation,
      netWDV,
      taxDepClaimable
    };
  }, [assets]);

  const poolData = useMemo(() => computeTaxDepreciation(), [assets]);

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4">
      <div className="w-full">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Fixed Asset Register</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Manage fixed assets, calculate depreciation, and process disposals</p>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4 bg-white px-2 pt-2 rounded-t-md shadow-sm overflow-x-auto hide-scrollbar">
          {["Asset Register", "Depreciation Schedule", "Asset Disposal", "Insurance Register", "Summary"].map((tab, index) => (
            <button
              key={index}
              className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap ${
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
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex flex-wrap items-end gap-3 mb-4 bg-gray-50 p-3 rounded-md border border-gray-200">
              <div className="w-32">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Pool</label>
                <select
                  value={filters.pool}
                  onChange={(e) => setFilters(prev => ({ ...prev, pool: e.target.value }))}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                >
                  <option value="">All Pools</option>
                  <option value="Pool A">Pool A</option>
                  <option value="Pool B">Pool B</option>
                  <option value="Pool C">Pool C</option>
                  <option value="Pool D">Pool D</option>
                </select>
              </div>
              <div className="w-40">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Location</label>
                <input
                  type="text"
                  value={filters.location}
                  onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Search location..."
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                />
              </div>
              <div className="w-32">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                >
                  <option value="active">Active</option>
                  <option value="disposed">Disposed</option>
                  <option value="scrapped">Scrapped</option>
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Search</label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  placeholder="Search asset name..."
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                />
              </div>
              <button
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-sm ml-auto"
                onClick={() => {
                  setEditingAsset({
                    id: generateId(),
                    assetCode: generateAssetCode(),
                    assetName: "",
                    category: "Pool A",
                    purchaseDate: new Date().toISOString().split('T')[0],
                    originalCost: 0,
                    salvageValue: 0,
                    usefulLifeYears: 0,
                    depreciationMethodBook: "SLM",
                    depreciationRateBook: 0,
                    depreciationRateTax: 0,
                    location: "",
                    department: "",
                    responsiblePerson: "",
                    currentWDV: 0,
                    accumulatedDepreciation: 0,
                    disposalStatus: "active"
                  });
                  setShowAssetForm(true);
                }}
              >
                <Plus size={14} />
                Add Asset
              </button>
            </div>
            
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Pool/Category</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Purchase Date</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Cost</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Acc Dep</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">WDV</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Location</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map(asset => (
                    <React.Fragment key={asset.id}>
                      <tr 
                        className="bg-white hover:bg-gray-50 border-b border-gray-100 text-[12px] cursor-pointer transition-colors"
                        onClick={() => setExpandedAsset(expandedAsset === asset.id ? null : asset.id)}
                      >
                        <td className="px-3 py-2.5 text-gray-800 font-medium">{asset.assetCode}</td>
                        <td className="px-3 py-2.5 text-gray-700 font-medium">{asset.assetName}</td>
                        <td className="px-3 py-2.5 text-gray-600">{asset.category}</td>
                        <td className="px-3 py-2.5 text-gray-600">{asset.purchaseDate}</td>
                        <td className="px-3 py-2.5 text-gray-800 text-right">{money(asset.originalCost)}</td>
                        <td className="px-3 py-2.5 text-amber-600 text-right">{money(asset.accumulatedDepreciation)}</td>
                        <td className="px-3 py-2.5 text-green-700 font-medium text-right">{money(asset.currentWDV)}</td>
                        <td className="px-3 py-2.5 text-gray-600">{asset.location || '-'}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                            asset.disposalStatus === "active" ? "bg-green-100 text-green-700" : 
                            asset.disposalStatus === "disposed" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                          }`}>
                            {asset.disposalStatus}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-3">
                            <button 
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingAsset(asset);
                                setShowAssetForm(true);
                              }}
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              className="text-red-500 hover:text-red-700 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm("Are you sure you want to delete this asset?")) {
                                  const db = getDB();
                                  db.table("fixedAssets").delete(asset.id).catch(() => {
                                    const stored = JSON.parse(localStorage.getItem("fixedAssets") || "[]");
                                    const updated = stored.filter((a: any) => a.id !== asset.id);
                                    localStorage.setItem("fixedAssets", JSON.stringify(updated));
                                  });
                                  setAssets(prev => prev.filter(a => a.id !== asset.id));
                                }
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {expandedAsset === asset.id && (
                        <tr className="bg-blue-50/30 border-b border-blue-100">
                          <td colSpan={10} className="p-4">
                            <div className="bg-white border border-blue-100 rounded-md p-4 grid grid-cols-1 md:grid-cols-2 gap-6 shadow-sm">
                              <div>
                                <h4 className="font-semibold text-gray-800 mb-3 border-b border-gray-100 pb-2">Asset Details</h4>
                                <div className="space-y-2 text-[12px]">
                                  <div className="flex justify-between"><span className="text-gray-500">Department:</span> <span className="font-medium text-gray-800">{asset.department || "-"}</span></div>
                                  <div className="flex justify-between"><span className="text-gray-500">Responsible Person:</span> <span className="font-medium text-gray-800">{asset.responsiblePerson || "-"}</span></div>
                                  <div className="flex justify-between"><span className="text-gray-500">Serial Number:</span> <span className="font-medium text-gray-800">{asset.serialNumber || "-"}</span></div>
                                  <div className="flex justify-between"><span className="text-gray-500">Useful Life:</span> <span className="font-medium text-gray-800">{asset.usefulLifeYears} years</span></div>
                                  <div className="flex justify-between"><span className="text-gray-500">Depreciation Method:</span> <span className="font-medium text-gray-800">{asset.depreciationMethodBook}</span></div>
                                </div>
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-800 mb-3 border-b border-gray-100 pb-2">Financial Details</h4>
                                <div className="space-y-2 text-[12px]">
                                  <div className="flex justify-between"><span className="text-gray-500">Salvage Value:</span> <span className="font-medium text-gray-800">{money(asset.salvageValue)}</span></div>
                                  <div className="flex justify-between"><span className="text-gray-500">Accumulated Depreciation:</span> <span className="font-medium text-gray-800">{money(asset.accumulatedDepreciation)}</span></div>
                                  <div className="flex justify-between"><span className="text-gray-500">Current WDV:</span> <span className="font-medium text-green-700">{money(asset.currentWDV)}</span></div>
                                  <div className="flex justify-between"><span className="text-gray-500">Disposal Status:</span> <span className="font-medium text-gray-800">{asset.disposalStatus}</span></div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {filteredAssets.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No assets found matching the criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
              <div className="flex gap-2 bg-gray-100 p-1 rounded-md">
                <button
                  className={`px-4 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                    depreciationTab === "book" 
                      ? 'bg-white text-gray-800 shadow-sm border border-gray-200' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  onClick={() => setDepreciationTab("book")}
                >
                  Book Depreciation (SLM)
                </button>
                <button
                  className={`px-4 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                    depreciationTab === "tax" 
                      ? 'bg-white text-gray-800 shadow-sm border border-gray-200' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  onClick={() => setDepreciationTab("tax")}
                >
                  Tax Depreciation (Pool WDV)
                </button>
              </div>
              
              <div className="flex gap-2">
                <button
                  className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors shadow-sm"
                  onClick={handleComputeDepreciation}
                >
                  <Calculator size={14} />
                  Compute Depreciation
                </button>
                <button
                  className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handlePostDepreciation}
                  disabled={!computedDepreciation || depreciationTab !== "book"}
                >
                  <CheckCircle size={14} />
                  Post Journal
                </button>
              </div>
            </div>
            
            {depreciationTab === "book" && (
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="bg-[#f5f6fa] border-b border-gray-200">
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Asset Name</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Original Cost</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Salvage Value</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Life Years</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Annual Depr</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Monthly Depr</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Acc Dep to Date</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">WDV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedDepreciation && computedDepreciation.map((asset: any) => (
                      <tr key={asset.id} className="bg-white hover:bg-gray-50 border-b border-gray-100 text-[12px] transition-colors">
                        <td className="px-3 py-2.5 text-gray-800">{asset.assetName}</td>
                        <td className="px-3 py-2.5 text-gray-700 text-right">{money(asset.originalCost)}</td>
                        <td className="px-3 py-2.5 text-gray-700 text-right">{money(asset.salvageValue)}</td>
                        <td className="px-3 py-2.5 text-gray-700 text-right">{asset.usefulLifeYears}</td>
                        <td className="px-3 py-2.5 text-amber-600 font-medium text-right">{money(asset.annualDepr)}</td>
                        <td className="px-3 py-2.5 text-gray-700 text-right">{money(asset.monthlyDepr)}</td>
                        <td className="px-3 py-2.5 text-amber-700 font-medium text-right">{money(asset.accDeprToDate)}</td>
                        <td className="px-3 py-2.5 text-green-700 font-medium text-right">{money(asset.currentWDV)}</td>
                      </tr>
                    ))}
                    {!computedDepreciation && (
                      <tr>
                        <td colSpan={8} className="px-3 py-12 text-center text-[13px] text-gray-500">
                          Click "Compute Depreciation" to view schedule
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            
            {depreciationTab === "tax" && (
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="bg-[#f5f6fa] border-b border-gray-200">
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Pool</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Pool Rate</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Opening WDV</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Additions</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Disposals</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Adj WDV</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Depreciation</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Closing WDV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedDepreciation && computedDepreciation.map((pool: any) => (
                      <tr key={pool.pool} className="bg-white hover:bg-gray-50 border-b border-gray-100 text-[12px] transition-colors">
                        <td className="px-3 py-2.5 text-gray-800 font-medium">{pool.pool}</td>
                        <td className="px-3 py-2.5 text-gray-700 text-right">{(pool.rate * 100).toFixed(2)}%</td>
                        <td className="px-3 py-2.5 text-gray-700 text-right">{money(pool.openingWDV)}</td>
                        <td className="px-3 py-2.5 text-green-600 text-right">{money(pool.additions)}</td>
                        <td className="px-3 py-2.5 text-red-600 text-right">{money(pool.disposals)}</td>
                        <td className="px-3 py-2.5 text-gray-800 font-medium text-right">{money(pool.adjustedWDV)}</td>
                        <td className="px-3 py-2.5 text-amber-600 font-medium text-right">{money(pool.depreciation)}</td>
                        <td className="px-3 py-2.5 text-green-700 font-medium text-right">{money(pool.closingWDV)}</td>
                      </tr>
                    ))}
                    {!computedDepreciation && (
                      <tr>
                        <td colSpan={8} className="px-3 py-12 text-center text-[13px] text-gray-500">
                          Click "Compute Depreciation" to view schedule
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 2 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-6 mb-4 max-w-3xl mx-auto">
            <h2 className="text-[15px] font-semibold text-gray-800 mb-6 pb-3 border-b border-gray-100">Process Asset Disposal</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Select Asset <span className="text-red-500">*</span></label>
                <select
                  value={disposalForm.assetId}
                  onChange={(e) => handleDisposalFormChange('assetId', e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                >
                  <option value="">Select Asset to Dispose</option>
                  {assets.filter(a => a.disposalStatus === "active").map(asset => (
                    <option key={asset.id} value={asset.id}>{asset.assetCode} - {asset.assetName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Disposal Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={disposalForm.disposalDate}
                  onChange={(e) => handleDisposalFormChange('disposalDate', e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Method <span className="text-red-500">*</span></label>
                <select
                  value={disposalForm.method}
                  onChange={(e) => handleDisposalFormChange('method', e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                >
                  <option value="sale">Sale</option>
                  <option value="scrap">Scrap</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Sale Proceeds (if Sale)</label>
                <input
                  type="number"
                  step="0.01"
                  value={disposalForm.saleProceeds || ""}
                  onChange={(e) => handleDisposalFormChange('saleProceeds', Number(e.target.value))}
                  disabled={disposalForm.method === 'scrap'}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
            </div>
            
            {disposalForm.assetId && (
              <div className="mb-6 bg-blue-50/50 border border-blue-100 rounded-md p-4 shadow-sm">
                <h3 className="text-[13px] font-semibold text-blue-800 mb-3 flex items-center gap-1.5"><Calculator size={14} /> Computation Preview</h3>
                {(() => {
                  const asset = assets.find(a => a.id === disposalForm.assetId);
                  if (!asset) return null;
                  
                  const accDeprAtDisposal = asset.accumulatedDepreciation;
                  const wdvAtDisposal = asset.currentWDV;
                  const proceeds = disposalForm.method === 'scrap' ? 0 : disposalForm.saleProceeds;
                  const gainLoss = proceeds - wdvAtDisposal;
                  const isGain = gainLoss >= 0;
                  
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-[12px]">
                      <div className="flex justify-between border-b border-blue-100/50 pb-1">
                        <span className="text-gray-600">Asset:</span> 
                        <span className="font-medium text-gray-800">{asset.assetName}</span>
                      </div>
                      <div className="flex justify-between border-b border-blue-100/50 pb-1">
                        <span className="text-gray-600">Sale Proceeds:</span> 
                        <span className="font-medium text-gray-800">{money(proceeds)}</span>
                      </div>
                      <div className="flex justify-between border-b border-blue-100/50 pb-1">
                        <span className="text-gray-600">Original Cost:</span> 
                        <span className="font-medium text-gray-800">{money(asset.originalCost)}</span>
                      </div>
                      <div className="flex justify-between border-b border-blue-100/50 pb-1">
                        <span className="text-gray-600">WDV at Disposal:</span> 
                        <span className="font-medium text-gray-800">{money(wdvAtDisposal)}</span>
                      </div>
                      <div className="flex justify-between border-b border-blue-100/50 pb-1">
                        <span className="text-gray-600">Accumulated Depr:</span> 
                        <span className="font-medium text-amber-700">{money(accDeprAtDisposal)}</span>
                      </div>
                      <div className="flex justify-between border-b border-blue-100/50 pb-1">
                        <span className="font-semibold text-gray-800">{isGain ? "Profit" : "Loss"} on Disposal:</span> 
                        <span className={`font-bold ${isGain ? "text-green-600" : "text-red-600"}`}>{money(Math.abs(gainLoss))}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            
            <div className="flex justify-end border-t border-gray-100 pt-4">
              <button
                className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                onClick={handlePostDisposal}
                disabled={!disposalForm.assetId}
              >
                <CheckCircle size={14} />
                Post Disposal Journal
              </button>
            </div>
          </div>
        )}

        {activeTab === 3 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-gray-800">Insurance Policy Register</h2>
            </div>
            
            {assets.some(a => a.insuranceExpiry && new Date(a.insuranceExpiry) < new Date()) && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md border border-red-200 mb-4 flex items-center gap-2 text-[13px] font-medium">
                <AlertTriangle size={16} className="text-red-500" />
                <span>Action Required: Some asset insurance policies have expired!</span>
              </div>
            )}
            
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Asset Name</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Policy No</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Provider</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Sum Insured</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Expiry Date</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Days Left</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.filter(a => a.insurancePolicyNo).map(asset => {
                    const today = new Date();
                    const expiry = asset.insuranceExpiry ? new Date(asset.insuranceExpiry) : null;
                    const daysToRenewal = expiry ? Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                    
                    return (
                      <tr key={asset.id} className="bg-white hover:bg-gray-50 border-b border-gray-100 text-[12px] transition-colors">
                        <td className="px-3 py-2.5 text-gray-800 font-medium">{asset.assetName}</td>
                        <td className="px-3 py-2.5 text-gray-700">{asset.insurancePolicyNo}</td>
                        <td className="px-3 py-2.5 text-gray-700">{asset.insuranceCompany}</td>
                        <td className="px-3 py-2.5 text-gray-800 text-right">{money(asset.insuranceValue || 0)}</td>
                        <td className="px-3 py-2.5 text-gray-700">{asset.insuranceExpiry || "N/A"}</td>
                        <td className="px-3 py-2.5 text-gray-700 text-right font-medium">{daysToRenewal}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                            daysToRenewal <= 0 ? "bg-red-100 text-red-700" : 
                            daysToRenewal <= 30 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                          }`}>
                            {daysToRenewal <= 0 ? "Expired" : daysToRenewal <= 30 ? "Expiring Soon" : "Active"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button 
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            onClick={() => {
                              setEditingAsset(asset);
                              setShowAssetForm(true);
                            }}
                          >
                            <Edit size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {assets.filter(a => a.insurancePolicyNo).length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No insured assets found in the register.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 4 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-6 mb-4 max-w-full overflow-auto">
            <h2 className="text-[15px] font-semibold text-gray-800 mb-6">Asset Dashboard Summary</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 shadow-sm">
                <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Gross Block Value</div>
                <div className="text-xl font-bold text-gray-800">NPR {money(summaryData.totalGrossBlock)}</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 shadow-sm">
                <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Accumulated Depr.</div>
                <div className="text-xl font-bold text-amber-600">NPR {money(summaryData.totalAccDepreciation)}</div>
              </div>
              <div className="bg-blue-50/50 border border-blue-100 rounded-md p-4 shadow-sm">
                <div className="text-[11px] font-medium text-blue-600 uppercase tracking-wide mb-1">Net WDV (Book)</div>
                <div className="text-xl font-bold text-[#1557b0]">NPR {money(summaryData.netWDV)}</div>
              </div>
              <div className="bg-green-50/50 border border-green-100 rounded-md p-4 shadow-sm">
                <div className="text-[11px] font-medium text-green-600 uppercase tracking-wide mb-1">Est. Tax Depr. Claim</div>
                <div className="text-xl font-bold text-green-700">NPR {money(summaryData.taxDepClaimable)}</div>
              </div>
            </div>
            
            <div className="border border-gray-200 rounded-md p-5 bg-white shadow-sm">
              <h3 className="text-[13px] font-semibold text-gray-800 mb-5 border-b border-gray-100 pb-2">Pool-wise Tax Depreciation Overview</h3>
              <div className="space-y-4">
                {poolData.map(pool => {
                  const closePct = pool.openingWDV > 0 ? (pool.closingWDV / pool.openingWDV) * 100 : 0;
                  const depPct = pool.openingWDV > 0 ? (pool.depreciation / pool.openingWDV) * 100 : 0;
                  
                  return (
                    <div key={pool.pool} className="flex flex-col mb-3">
                      <div className="flex justify-between text-[12px] font-medium text-gray-700 mb-1.5">
                        <span className="flex items-center gap-2"><span className="w-16 font-semibold">Pool {pool.pool.charAt(5)}</span> <span className="text-gray-400 text-[10px]">({pool.rate*100}%)</span></span>
                        <span>Closing: NPR {money(pool.closingWDV)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 relative overflow-hidden border border-gray-200">
                        <div 
                          style={{ width: `${closePct}%` }} 
                          className="h-full bg-[#1557b0] rounded-r-none absolute left-0 top-0 transition-all duration-500"
                        ></div>
                        <div 
                          style={{ width: `${depPct}%`, left: `${closePct}%` }} 
                          className="h-full bg-amber-400 absolute top-0 transition-all duration-500"
                          title={`Depreciation: ${money(pool.depreciation)}`}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                        <span>Opening: NPR {money(pool.openingWDV)}</span>
                        <span>Depreciation: NPR {money(pool.depreciation)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Asset Form Modal */}
      {showAssetForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-[15px] font-semibold text-gray-800">
                {editingAsset?.assetName ? "Edit Asset" : "Add New Fixed Asset"}
              </h2>
              <button onClick={() => { setShowAssetForm(false); setEditingAsset(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
              <div className="mb-6">
                <h3 className="text-[13px] font-semibold text-gray-700 mb-3 border-b border-gray-100 pb-1">Primary Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Asset Code</label>
                    <input
                      type="text"
                      value={editingAsset?.assetCode || ""}
                      readOnly
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-gray-50 text-gray-500 w-full outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Asset Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editingAsset?.assetName || ""}
                      onChange={(e) => handleAssetFormChange('assetName', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Category (Pool) <span className="text-red-500">*</span></label>
                    <select
                      value={editingAsset?.category || "Pool A"}
                      onChange={(e) => handleAssetFormChange('category', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    >
                      <option value="Pool A">Pool A (5%) - Buildings</option>
                      <option value="Pool B">Pool B (25%) - Computers</option>
                      <option value="Pool C">Pool C (15%) - Vehicles</option>
                      <option value="Pool D">Pool D (20%) - Machinery/Equip</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Purchase Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={editingAsset?.purchaseDate || ""}
                      onChange={(e) => handleAssetFormChange('purchaseDate', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-[13px] font-semibold text-gray-700 mb-3 border-b border-gray-100 pb-1">Financial & Depreciation</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Original Cost <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingAsset?.originalCost || ""}
                      onChange={(e) => handleAssetFormChange('originalCost', Number(e.target.value))}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Salvage Value</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingAsset?.salvageValue || ""}
                      onChange={(e) => handleAssetFormChange('salvageValue', Number(e.target.value))}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Useful Life (Years)</label>
                    <input
                      type="number"
                      step="1"
                      value={editingAsset?.usefulLifeYears || ""}
                      onChange={(e) => handleAssetFormChange('usefulLifeYears', Number(e.target.value))}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Book Depr. Method</label>
                    <select
                      value={editingAsset?.depreciationMethodBook || "SLM"}
                      onChange={(e) => handleAssetFormChange('depreciationMethodBook', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    >
                      <option value="SLM">Straight Line (SLM)</option>
                      <option value="WDV">Written Down Value (WDV)</option>
                    </select>
                  </div>
                  {editingAsset?.depreciationMethodBook === 'WDV' && (
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">Book Depr. Rate (e.g. 0.1 for 10%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingAsset?.depreciationRateBook || ""}
                        onChange={(e) => handleAssetFormChange('depreciationRateBook', Number(e.target.value))}
                        className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Accumulated Depr. (Opening)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingAsset?.accumulatedDepreciation || 0}
                      onChange={(e) => handleAssetFormChange('accumulatedDepreciation', Number(e.target.value))}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-[13px] font-semibold text-gray-700 mb-3 border-b border-gray-100 pb-1">Tracking & Insurance</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Location</label>
                    <input
                      type="text"
                      value={editingAsset?.location || ""}
                      onChange={(e) => handleAssetFormChange('location', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Department</label>
                    <input
                      type="text"
                      value={editingAsset?.department || ""}
                      onChange={(e) => handleAssetFormChange('department', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Responsible Person</label>
                    <input
                      type="text"
                      value={editingAsset?.responsiblePerson || ""}
                      onChange={(e) => handleAssetFormChange('responsiblePerson', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Serial Number / VIN</label>
                    <input
                      type="text"
                      value={editingAsset?.serialNumber || ""}
                      onChange={(e) => handleAssetFormChange('serialNumber', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Insurance Provider</label>
                    <input
                      type="text"
                      value={editingAsset?.insuranceCompany || ""}
                      onChange={(e) => handleAssetFormChange('insuranceCompany', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Policy Number</label>
                    <input
                      type="text"
                      value={editingAsset?.insurancePolicyNo || ""}
                      onChange={(e) => handleAssetFormChange('insurancePolicyNo', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Insurance Expiry Date</label>
                    <input
                      type="date"
                      value={editingAsset?.insuranceExpiry || ""}
                      onChange={(e) => handleAssetFormChange('insuranceExpiry', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Sum Insured (Value)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingAsset?.insuranceValue || ""}
                      onChange={(e) => handleAssetFormChange('insuranceValue', Number(e.target.value))}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <button
                className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                onClick={() => { setShowAssetForm(false); setEditingAsset(null); }}
              >
                Cancel
              </button>
              <button
                className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md transition-colors shadow-sm"
                onClick={saveAssetForm}
              >
                Save Asset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FixedAssetRegister;
