// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { Calculator, Trash2, Edit, Plus, AlertTriangle, CheckCircle, X, MapPin, FileText, Building2, Download } from "lucide-react";

function money(v) {
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
  depreciationMethod: string;
  accumulatedDepreciation: number;
  netBookValue: number;
  isActive: boolean;
}

interface PropertyAsset {
  id: string;
  assetId: string;           // Links to FixedAsset if property is also in asset register
  propertyName: string;      // e.g., "Head Office Building", "Pokhara Godown"
  propertyType: "Land" | "Building" | "Land & Building";
  
  // Nepal Land Revenue identifiers
  kittaNo: string;           // Kitta Number — e.g., "123"
  sheetNo: string;           // Sheet Number (Napi Sheet) — e.g., "45"
  district: string;          // District — e.g., "Kathmandu"
  municipality: string;      // Municipality/VDC
  wardNo: string;            // Ward Number
  
  // Area measurement
  areaUnit: "Ropani-Aana" | "Square Meter" | "Dhur";
  areaRopani: number;        // Used if Ropani-Aana selected
  areaAana: number;
  areaPaisa: number;
  areaDam: number;
  areaSqMeter: number;       // Used if Square Meter selected
  areaDhur: number;          // Used if Dhur selected
  areaKattha: number;        // Used if Dhur selected
  areaBigha: number;         // Used if Dhur selected
  
  // Valuation
  governmentValuation: number;     // As per Malpot (Land Revenue) valuation
  marketValuation: number;         // Estimated market value
  purchaseValue: number;           // Actual purchase price
  purchaseDate: string;
  
  // Legal documents
  lalPurjaNo: string;             // Land ownership certificate number
  lalPurjaDate: string;           // Date of Lal Purja
  registeredOwnerName: string;    // Name as on Lal Purja
  
  // Bank/loan details
  mortgaged: boolean;
  mortgagedToBank: string;
  mortgageAmount: number;
  mortgageExpiry: string;
  
  // Notes
  notes: string;
  isActive: boolean;
}

export default function FixedAssetRegister() {
  const { addVoucher, companySettings } = useStore();
  const [activeTab, setActiveTab] = useState("assets");
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [properties, setProperties] = useState<PropertyAsset[]>([]);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [editingProperty, setEditingProperty] = useState<PropertyAsset | null>(null);
  const [form, setForm] = useState({
    assetCode: "",
    assetName: "",
    category: "Pool A",
    purchaseDate: new Date().toISOString().split('T')[0],
    originalCost: 0,
    salvageValue: 0,
    usefulLifeYears: 5,
    depreciationMethod: "Straight Line",
    accumulatedDepreciation: 0,
    netBookValue: 0,
    isActive: true
  });
  
  const [propertyForm, setPropertyForm] = useState<PropertyAsset>({
    id: "",
    assetId: "",
    propertyName: "",
    propertyType: "Land",
    kittaNo: "",
    sheetNo: "",
    district: "",
    municipality: "",
    wardNo: "",
    areaUnit: "Ropani-Aana",
    areaRopani: 0,
    areaAana: 0,
    areaPaisa: 0,
    areaDam: 0,
    areaSqMeter: 0,
    areaDhur: 0,
    areaKattha: 0,
    areaBigha: 0,
    governmentValuation: 0,
    marketValuation: 0,
    purchaseValue: 0,
    purchaseDate: new Date().toISOString().split('T')[0],
    lalPurjaNo: "",
    lalPurjaDate: "",
    registeredOwnerName: "",
    mortgaged: false,
    mortgagedToBank: "",
    mortgageAmount: 0,
    mortgageExpiry: "",
    notes: "",
    isActive: true
  });

  // Load assets from localStorage (or IndexedDB if available)
  useEffect(() => {
    const savedAssets = JSON.parse(localStorage.getItem("erp_fixed_assets") || "[]");
    setAssets(savedAssets);
  }, []);

  // Load properties from localStorage
  useEffect(() => {
    const savedProperties = JSON.parse(localStorage.getItem("erp_properties") || "[]");
    setProperties(savedProperties);
  }, []);

  const saveAsset = (asset) => {
    const existing = JSON.parse(localStorage.getItem("erp_fixed_assets") || "[]");
    const idx = existing.findIndex(a => a.id === asset.id);
    if (idx >= 0) existing[idx] = asset;
    else existing.push({ ...asset, id: generateId(), createdAt: new Date().toISOString() });
    localStorage.setItem("erp_fixed_assets", JSON.stringify(existing));
    toast.success("Asset saved");
    setAssets(existing);
  };

  const saveProperty = (prop) => {
    const existing = JSON.parse(localStorage.getItem("erp_properties") || "[]");
    const idx = existing.findIndex(p => p.id === prop.id);
    if (idx >= 0) existing[idx] = prop;
    else existing.push({ ...prop, id: generateId(), createdAt: new Date().toISOString() });
    localStorage.setItem("erp_properties", JSON.stringify(existing));
    toast.success("Property saved");
    setProperties(existing);
  };

  const loadProperties = () => {
    setProperties(JSON.parse(localStorage.getItem("erp_properties") || "[]"));
  };

  const handleSaveAsset = () => {
    if (!form.assetName.trim()) {
      toast.error("Asset name is required");
      return;
    }
    
    const asset: FixedAsset = {
      id: editingAsset?.id || generateId(),
      assetCode: form.assetCode || `FA-${Date.now()}`,
      assetName: form.assetName,
      category: form.category,
      purchaseDate: form.purchaseDate,
      originalCost: form.originalCost,
      salvageValue: form.salvageValue,
      usefulLifeYears: form.usefulLifeYears,
      depreciationMethod: form.depreciationMethod,
      accumulatedDepreciation: form.accumulatedDepreciation,
      netBookValue: form.netBookValue,
      isActive: form.isActive
    };
    
    saveAsset(asset);
    resetForm();
  };

  const handleSaveProperty = () => {
    if (!propertyForm.propertyName.trim()) {
      toast.error("Property name is required");
      return;
    }
    
    if (!propertyForm.kittaNo.trim()) {
      toast.error("Kitta No is required");
      return;
    }
    
    saveProperty(propertyForm);
    resetPropertyForm();
  };

  const resetForm = () => {
    setForm({
      assetCode: "",
      assetName: "",
      category: "Pool A",
      purchaseDate: new Date().toISOString().split('T')[0],
      originalCost: 0,
      salvageValue: 0,
      usefulLifeYears: 5,
      depreciationMethod: "Straight Line",
      accumulatedDepreciation: 0,
      netBookValue: 0,
      isActive: true
    });
    setEditingAsset(null);
  };

  const resetPropertyForm = () => {
    setPropertyForm({
      id: "",
      assetId: "",
      propertyName: "",
      propertyType: "Land",
      kittaNo: "",
      sheetNo: "",
      district: "",
      municipality: "",
      wardNo: "",
      areaUnit: "Ropani-Aana",
      areaRopani: 0,
      areaAana: 0,
      areaPaisa: 0,
      areaDam: 0,
      areaSqMeter: 0,
      areaDhur: 0,
      areaKattha: 0,
      areaBigha: 0,
      governmentValuation: 0,
      marketValuation: 0,
      purchaseValue: 0,
      purchaseDate: new Date().toISOString().split('T')[0],
      lalPurjaNo: "",
      lalPurjaDate: "",
      registeredOwnerName: "",
      mortgaged: false,
      mortgagedToBank: "",
      mortgageAmount: 0,
      mortgageExpiry: "",
      notes: "",
      isActive: true
    });
    setEditingProperty(null);
  };

  const handleEditAsset = (asset: FixedAsset) => {
    setEditingAsset(asset);
    setForm({
      assetCode: asset.assetCode,
      assetName: asset.assetName,
      category: asset.category,
      purchaseDate: asset.purchaseDate,
      originalCost: asset.originalCost,
      salvageValue: asset.salvageValue,
      usefulLifeYears: asset.usefulLifeYears,
      depreciationMethod: asset.depreciationMethod,
      accumulatedDepreciation: asset.accumulatedDepreciation,
      netBookValue: asset.netBookValue,
      isActive: asset.isActive
    });
    setActiveTab("assets");
  };

  const handleEditProperty = (prop: PropertyAsset) => {
    setEditingProperty(prop);
    setPropertyForm({ ...prop });
    setActiveTab("property");
  };

  const handleDeleteAsset = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this asset?")) return;
    
    const existing = JSON.parse(localStorage.getItem("erp_fixed_assets") || "[]");
    const updated = existing.filter(a => a.id !== id);
    localStorage.setItem("erp_fixed_assets", JSON.stringify(updated));
    setAssets(updated);
    toast.success("Asset deleted");
  };

  const handleDeleteProperty = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this property?")) return;
    
    const existing = JSON.parse(localStorage.getItem("erp_properties") || "[]");
    const updated = existing.filter(p => p.id !== id);
    localStorage.setItem("erp_properties", JSON.stringify(updated));
    setProperties(updated);
    toast.success("Property deleted");
  };

  const exportPropertiesToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(properties.map(p => ({
      'Property Name': p.propertyName,
      'Type': p.propertyType,
      'Kitta No': p.kittaNo,
      'Sheet No': p.sheetNo,
      'District': p.district,
      'Municipality': p.municipality,
      'Ward': p.wardNo,
      'Lal Purja No': p.lalPurjaNo,
      'Area (sq.m)': calculateTotalAreaSqM(p),
      'Govt Valuation': p.governmentValuation,
      'Market Value': p.marketValuation,
      'Purchase Value': p.purchaseValue,
      'Mortgaged': p.mortgaged ? 'Yes' : 'No'
    })));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Property Register");
    XLSX.writeFile(wb, "Property_Register.xlsx");
    toast.success("Exported to Excel");
  };

  const calculateTotalAreaSqM = (prop: PropertyAsset): number => {
    if (prop.areaUnit === "Square Meter") {
      return prop.areaSqMeter;
    } else if (prop.areaUnit === "Ropani-Aana") {
      // 1 Ropani = 508.72 sq.m, 1 Aana = 31.80 sq.m
      return (prop.areaRopani * 508.72) + (prop.areaAana * 31.80) + (prop.areaPaisa * 7.95) + (prop.areaDam * 1.99);
    } else if (prop.areaUnit === "Dhur") {
      // 1 Bigha = 20 Kattha = 1256.36 sq.m, so 1 Kattha = 62.818 sq.m, 1 Dhur = 18.5316 sq.m
      return (prop.areaBigha * 1256.36) + (prop.areaKattha * 62.818) + (prop.areaDhur * 18.5316);
    }
    return 0;
  };

  const renderAssetsTab = () => (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Fixed Assets</h2>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset Code</label>
              <input
                type="text"
                value={form.assetCode}
                onChange={(e) => setForm({...form, assetCode: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset Name *</label>
              <input
                type="text"
                value={form.assetName}
                onChange={(e) => setForm({...form, assetName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({...form, category: e.target.value as any})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="Pool A">Pool A</option>
                <option value="Pool B">Pool B</option>
                <option value="Pool C">Pool C</option>
                <option value="Pool D">Pool D</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
              <input
                type="date"
                value={form.purchaseDate}
                onChange={(e) => setForm({...form, purchaseDate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Original Cost</label>
              <input
                type="number"
                value={form.originalCost}
                onChange={(e) => setForm({...form, originalCost: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salvage Value</label>
              <input
                type="number"
                value={form.salvageValue}
                onChange={(e) => setForm({...form, salvageValue: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Useful Life (Years)</label>
              <input
                type="number"
                value={form.usefulLifeYears}
                onChange={(e) => setForm({...form, usefulLifeYears: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Depreciation Method</label>
              <select
                value={form.depreciationMethod}
                onChange={(e) => setForm({...form, depreciationMethod: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="Straight Line">Straight Line</option>
                <option value="Reducing Balance">Reducing Balance</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Accumulated Depreciation</label>
              <input
                type="number"
                value={form.accumulatedDepreciation}
                onChange={(e) => setForm({...form, accumulatedDepreciation: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Net Book Value</label>
              <input
                type="number"
                value={form.netBookValue}
                onChange={(e) => setForm({...form, netBookValue: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({...form, isActive: e.target.checked})}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">Active</span>
              </label>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleSaveAsset}
              className="h-9 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-sm font-medium rounded-md flex items-center gap-1.5 transition-colors"
            >
              <Plus size={16} />
              {editingAsset ? 'Update Asset' : 'Add Asset'}
            </button>
            {editingAsset && (
              <button
                onClick={resetForm}
                className="h-9 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
        
        <div className="border-t border-gray-200">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-md font-semibold text-gray-800">Asset List</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Book Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assets.map(asset => (
                  <tr key={asset.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{asset.assetCode}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{asset.assetName}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{asset.category}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{money(asset.originalCost)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{money(asset.netBookValue)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditAsset(asset)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPropertyRegisterTab = () => (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-[#D4EABD] border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">🏘️ Property Register</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  resetPropertyForm();
                  setEditingProperty(null);
                }}
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors"
              >
                <Plus size={14} />
                Add Property
              </button>
              <button
                onClick={exportPropertiesToExcel}
                className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors"
              >
                <Download size={14} />
                Export Excel
              </button>
              <button
                onClick={() => {}}
                className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors"
              >
                <FileText size={14} />
                Print Register
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex">
          {/* Left Panel - Property List */}
          <div className="w-64 border-r border-gray-200 bg-gray-50 p-4">
            <h3 className="font-medium text-gray-700 mb-3">Properties</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {properties.map(prop => (
                <div
                  key={prop.id}
                  onClick={() => handleEditProperty(prop)}
                  className={`p-3 border rounded cursor-pointer ${
                    editingProperty?.id === prop.id ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="font-medium text-sm text-gray-800 truncate">{prop.propertyName}</div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {prop.propertyType}
                    </span>
                    <span className="text-xs text-gray-500">Kitta: {prop.kittaNo}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Right Panel - Property Form */}
          <div className="flex-1 p-6">
            <h3 className="text-lg font-medium text-gray-800 mb-4">
              {editingProperty ? 'Edit Property' : 'Add New Property'}
            </h3>
            
            <div className="space-y-6">
              {/* Section 1 - Identification */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-3">Identification</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Property Name *</label>
                    <input
                      type="text"
                      value={propertyForm.propertyName}
                      onChange={(e) => setPropertyForm({...propertyForm, propertyName: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Property Type *</label>
                    <select
                      value={propertyForm.propertyType}
                      onChange={(e) => setPropertyForm({...propertyForm, propertyType: e.target.value as any})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="Land">Land</option>
                      <option value="Building">Building</option>
                      <option value="Land & Building">Land & Building</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Link to Asset Register</label>
                    <select
                      value={propertyForm.assetId}
                      onChange={(e) => setPropertyForm({...propertyForm, assetId: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Select Asset (Optional)</option>
                      {assets.map(asset => (
                        <option key={asset.id} value={asset.id}>{asset.assetName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              {/* Section 2 - Nepal Land Revenue Details */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-3">लाल पुर्जा विवरण (Land Revenue Details)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kitta No *</label>
                    <input
                      type="text"
                      value={propertyForm.kittaNo}
                      onChange={(e) => setPropertyForm({...propertyForm, kittaNo: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sheet No (Napi Sheet) *</label>
                    <input
                      type="text"
                      value={propertyForm.sheetNo}
                      onChange={(e) => setPropertyForm({...propertyForm, sheetNo: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">District *</label>
                    <input
                      type="text"
                      value={propertyForm.district}
                      onChange={(e) => setPropertyForm({...propertyForm, district: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Municipality/VDC *</label>
                    <input
                      type="text"
                      value={propertyForm.municipality}
                      onChange={(e) => setPropertyForm({...propertyForm, municipality: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ward No</label>
                    <input
                      type="text"
                      value={propertyForm.wardNo}
                      onChange={(e) => setPropertyForm({...propertyForm, wardNo: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                    <select
                      value={""}
                      onChange={() => {}}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Select Province</option>
                      <option value="Koshi">Koshi</option>
                      <option value="Madhesh">Madhesh</option>
                      <option value="Bagmati">Bagmati</option>
                      <option value="Gandaki">Gandaki</option>
                      <option value="Lumbini">Lumbini</option>
                      <option value="Karnali">Karnali</option>
                      <option value="Sudurpashchim">Sudurpashchim</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lal Purja No</label>
                    <input
                      type="text"
                      value={propertyForm.lalPurjaNo}
                      onChange={(e) => setPropertyForm({...propertyForm, lalPurjaNo: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lal Purja Date</label>
                    <input
                      type="date"
                      value={propertyForm.lalPurjaDate}
                      onChange={(e) => setPropertyForm({...propertyForm, lalPurjaDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Registered Owner Name (as on Lal Purja)</label>
                    <input
                      type="text"
                      value={propertyForm.registeredOwnerName}
                      onChange={(e) => setPropertyForm({...propertyForm, registeredOwnerName: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>
              </div>
              
              {/* Section 3 - Area */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-3">Area Measurement</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Area Unit</label>
                    <div className="flex flex-wrap gap-4">
                      {(['Ropani-Aana', 'Square Meter', 'Dhur'] as const).map(unit => (
                        <label key={unit} className="flex items-center">
                          <input
                            type="radio"
                            name="areaUnit"
                            checked={propertyForm.areaUnit === unit}
                            onChange={() => setPropertyForm({...propertyForm, areaUnit: unit})}
                            className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{unit}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  {propertyForm.areaUnit === 'Ropani-Aana' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ropani</label>
                        <input
                          type="number"
                          value={propertyForm.areaRopani}
                          onChange={(e) => setPropertyForm({...propertyForm, areaRopani: Number(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Aana</label>
                        <input
                          type="number"
                          value={propertyForm.areaAana}
                          onChange={(e) => setPropertyForm({...propertyForm, areaAana: Number(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Paisa</label>
                        <input
                          type="number"
                          value={propertyForm.areaPaisa}
                          onChange={(e) => setPropertyForm({...propertyForm, areaPaisa: Number(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dam</label>
                        <input
                          type="number"
                          value={propertyForm.areaDam}
                          onChange={(e) => setPropertyForm({...propertyForm, areaDam: Number(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                    </div>
                  )}
                  
                  {propertyForm.areaUnit === 'Square Meter' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Area (Square Meters)</label>
                      <input
                        type="number"
                        value={propertyForm.areaSqMeter}
                        onChange={(e) => setPropertyForm({...propertyForm, areaSqMeter: Number(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                  )}
                  
                  {propertyForm.areaUnit === 'Dhur' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dhur</label>
                        <input
                          type="number"
                          value={propertyForm.areaDhur}
                          onChange={(e) => setPropertyForm({...propertyForm, areaDhur: Number(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kattha</label>
                        <input
                          type="number"
                          value={propertyForm.areaKattha}
                          onChange={(e) => setPropertyForm({...propertyForm, areaKattha: Number(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bigha</label>
                        <input
                          type="number"
                          value={propertyForm.areaBigha}
                          onChange={(e) => setPropertyForm({...propertyForm, areaBigha: Number(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500 mt-2">
                    <div>Conversion: 1 Ropani = 16 Aana = 508.72 sq.m | 1 Aana = 4 Paisa = 31.80 sq.m</div>
                    <div>Total area: {calculateTotalAreaSqM(propertyForm).toFixed(2)} sq.m</div>
                  </div>
                </div>
              </div>
              
              {/* Section 4 - Valuation */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-3">Valuation (Rs.)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Government Valuation (Malpot)</label>
                    <input
                      type="number"
                      value={propertyForm.governmentValuation}
                      onChange={(e) => setPropertyForm({...propertyForm, governmentValuation: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Market Valuation</label>
                    <input
                      type="number"
                      value={propertyForm.marketValuation}
                      onChange={(e) => setPropertyForm({...propertyForm, marketValuation: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price</label>
                    <input
                      type="number"
                      value={propertyForm.purchaseValue}
                      onChange={(e) => setPropertyForm({...propertyForm, purchaseValue: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                    <input
                      type="date"
                      value={propertyForm.purchaseDate}
                      onChange={(e) => setPropertyForm({...propertyForm, purchaseDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>
              </div>
              
              {/* Section 5 - Mortgage/Encumbrance */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-3">Mortgage / Encumbrance</h4>
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    checked={propertyForm.mortgaged}
                    onChange={(e) => setPropertyForm({...propertyForm, mortgaged: e.target.checked})}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">Is Mortgaged?</label>
                </div>
                
                {propertyForm.mortgaged && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={propertyForm.mortgagedToBank}
                        onChange={(e) => setPropertyForm({...propertyForm, mortgagedToBank: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mortgage Amount</label>
                      <input
                        type="number"
                        value={propertyForm.mortgageAmount}
                        onChange={(e) => setPropertyForm({...propertyForm, mortgageAmount: Number(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mortgage Expiry Date</label>
                      <input
                        type="date"
                        value={propertyForm.mortgageExpiry}
                        onChange={(e) => setPropertyForm({...propertyForm, mortgageExpiry: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Section 6 - Notes */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-3">Notes</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes/Description</label>
                  <textarea
                    value={propertyForm.notes}
                    onChange={(e) => setPropertyForm({...propertyForm, notes: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
              
              {/* Form Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleSaveProperty}
                  className="h-9 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-sm font-medium rounded-md flex items-center gap-1.5 transition-colors"
                >
                  <Plus size={16} />
                  {editingProperty ? 'Update Property' : 'Save Property'}
                </button>
                {editingProperty && (
                  <button
                    onClick={resetPropertyForm}
                    className="h-9 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Property Report Table */}
        <div className="border-t border-gray-200">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-md font-semibold text-gray-800">Property Register Report</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kitta No</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sheet No</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">District</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Municipality</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ward</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lal Purja No</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Area (sq.m)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Govt Valuation</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Market Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mortgaged?</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {properties.map(prop => (
                  <tr key={prop.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{prop.propertyName}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{prop.propertyType}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{prop.kittaNo}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{prop.sheetNo}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{prop.district}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{prop.municipality}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{prop.wardNo}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{prop.lalPurjaNo}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{calculateTotalAreaSqM(prop).toFixed(2)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{money(prop.governmentValuation)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{money(prop.marketValuation)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{money(prop.purchaseValue)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{prop.mortgaged ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditProperty(prop)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteProperty(prop.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {[
            { id: "assets", label: "Fixed Assets", icon: Calculator },
            { id: "depreciation", label: "Depreciation", icon: Calculator },
            { id: "disposal", label: "Disposal", icon: Trash2 },
            { id: "pool-analysis", label: "Pool Analysis", icon: AlertTriangle },
            { id: "property", label: "🏘️ Property Register", icon: MapPin },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? "text-[#1557b0] border-b-2 border-[#1557b0]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "assets" && renderAssetsTab()}
      {activeTab === "depreciation" && <div className="p-6">Depreciation content...</div>}
      {activeTab === "disposal" && <div className="p-6">Disposal content...</div>}
      {activeTab === "pool-analysis" && <div className="p-6">Pool Analysis content...</div>}
      {activeTab === "property" && renderPropertyRegisterTab()}
    </div>
  );
}
