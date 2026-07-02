// src/pages/FixedAssets.tsx
// @ts-nocheck
// NEW PAGE — Fixed Assets Register with Depreciation
// Nepal IT Act depreciation rates:
//   Furniture & Fixtures: 25% WDV
//   Computers & Software: 40% WDV
//   Vehicles: 20% WDV
//   Machinery & Plant: 15% WDV
//   Buildings: 5% SLM (straight line)

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import {
  Plus,
  Download,
  Edit2,
  Trash2,
  Calculator,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Nepal IT Act WDV Rates ───────────────────────────────────────────────────
const NEPAL_DEPRECIATION_RATES: Record<string, { method: "slm" | "wdv"; rate: number }> = {
  "Building":              { method: "slm", rate: 5 },
  "Furniture & Fixtures":  { method: "wdv", rate: 25 },
  "Computers & Software":  { method: "wdv", rate: 40 },
  "Vehicles":              { method: "wdv", rate: 20 },
  "Plant & Machinery":     { method: "wdv", rate: 15 },
  "Office Equipment":      { method: "wdv", rate: 25 },
  "Intangibles":           { method: "slm", rate: 10 },
  "Other Assets":          { method: "wdv", rate: 15 },
};

const CATEGORIES = Object.keys(NEPAL_DEPRECIATION_RATES);

// ─── Depreciation computation helpers ────────────────────────────────────────
const computeSLM = (cost: number, residual: number, lifeYears: number): number => {
  if (lifeYears <= 0) return 0;
  return (cost - residual) / lifeYears;
};

const computeWDV = (openingNBV: number, rate: number): number => {
  return (openingNBV * rate) / 100;
};

const computeDepreciation = (
  asset: any,
  openingNBV: number
): number => {
  if (asset.depreciationMethod === "slm") {
    return computeSLM(
      asset.purchaseCost,
      asset.residualValue || 0,
      asset.usefulLifeYears || 1
    );
  }
  return computeWDV(openingNBV, asset.wdvRate || 15);
};

// Calculate NBV at a given date considering all depreciation entries
const computeNBV = (
  asset: any,
  depreciationEntries: any[],
  asOfDate: string
): number => {
  const assetEntries = depreciationEntries
    .filter((e) => e.assetId === asset.id && e.date <= asOfDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  let nbv = asset.purchaseCost;
  for (const entry of assetEntries) {
    nbv -= entry.depreciationAmount;
  }
  return Math.max(asset.residualValue || 0, nbv);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const inputCls =
  "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full";
const labelCls =
  "text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1";
const thCls =
  "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200 whitespace-nowrap";
const tdCls =
  "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const amtCls = `${tdCls} font-mono text-right`;

// ─── Empty form state ─────────────────────────────────────────────────────────
const emptyAsset = () => ({
  name: "",
  code: "",
  category: "Furniture & Fixtures",
  purchaseDate: new Date().toISOString().split("T")[0],
  purchaseCost: 0,
  residualValue: 0,
  usefulLifeYears: 5,
  depreciationMethod: "wdv" as "slm" | "wdv",
  wdvRate: 25,
  location: "",
  serialNo: "",
  supplier: "",
  isActive: true,
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function FixedAssets() {
  const store = useStore() as any;
  const fixedAssets: any[]         = store.fixedAssets || [];
  const depreciationLedger: any[]  = store.depreciationLedger || [];
  const currentFiscalYear          = store.currentFiscalYear;
  const companySettings            = store.companySettings;

  const [showModal,    setShowModal]    = useState(false);
  const [showDeprModal, setShowDeprModal] = useState(false);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [form,         setForm]         = useState(emptyAsset());
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [activeTab,    setActiveTab]    = useState<"register" | "schedule" | "disposal">("register");
  const [filterCat,    setFilterCat]    = useState("ALL");

  const fyEnd = currentFiscalYear?.endDate || new Date().toISOString().split("T")[0];

  // Load assets on mount
  useEffect(() => {
    if (store.loadFixedAssets) store.loadFixedAssets();
  }, []);

  // ── When category changes, auto-fill depreciation method and rate ─────────
  const handleCategoryChange = (cat: string) => {
    const defaults = NEPAL_DEPRECIATION_RATES[cat];
    if (defaults) {
      setForm((f) => ({
        ...f,
        category: cat,
        depreciationMethod: defaults.method,
        wdvRate: defaults.rate,
        usefulLifeYears:
          defaults.method === "slm"
            ? Math.round(100 / defaults.rate)
            : f.usefulLifeYears,
      }));
    } else {
      setForm((f) => ({ ...f, category: cat }));
    }
  };

  // ── Save asset ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Asset name is required");
      return;
    }
    if (!form.purchaseCost || form.purchaseCost <= 0) {
      toast.error("Purchase cost must be greater than zero");
      return;
    }
    try {
      if (editingId) {
        await store.updateFixedAsset(editingId, form);
        toast.success("Asset updated");
      } else {
        await store.addFixedAsset(form);
        toast.success("Asset added");
      }
      setShowModal(false);
      setEditingId(null);
      setForm(emptyAsset());
    } catch {
      toast.error("Failed to save asset");
    }
  };

  // ── Open edit modal ────────────────────────────────────────────────────────
  const handleEdit = (asset: any) => {
    setForm({ ...asset });
    setEditingId(asset.id);
    setShowModal(true);
  };

  // ── Delete asset ───────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this asset? This cannot be undone.")) return;
    await store.deleteFixedAsset(id);
    toast.success("Asset deleted");
  };

  // ── Compute depreciation for a single asset for current FY ────────────────
  const computeAndPostDepr = async (asset: any) => {
    const nbv = computeNBV(asset, depreciationLedger, fyEnd);
    const deprAmt = computeDepreciation(asset, nbv);

    if (deprAmt <= 0) {
      toast.error("Depreciation amount is zero — asset may be fully depreciated");
      return;
    }

    const fyName = currentFiscalYear?.name || fyEnd.slice(0, 4);

    // Check if depreciation already posted for this FY
    const alreadyPosted = depreciationLedger.some(
      (e) => e.assetId === asset.id && e.fiscalYear === fyName
    );
    if (alreadyPosted) {
      toast.error(`Depreciation already posted for ${asset.name} in FY ${fyName}`);
      return;
    }

    await store.saveDepreciationEntry({
      assetId: asset.id,
      assetName: asset.name,
      date: fyEnd,
      fiscalYear: fyName,
      method: asset.depreciationMethod,
      openingNBV: nbv,
      depreciationAmount: deprAmt,
      closingNBV: Math.max(asset.residualValue || 0, nbv - deprAmt),
    });

    toast.success(
      `Depreciation posted: Rs. ${fmt(deprAmt)} for ${asset.name}`
    );
  };

  // ── Post depreciation for ALL active assets ───────────────────────────────
  const postAllDepreciation = async () => {
    if (
      !confirm(
        `Post depreciation for ALL active assets for FY ending ${fyEnd}?`
      )
    )
      return;

    let count = 0;
    for (const asset of fixedAssets.filter((a) => a.isActive && !a.disposalDate)) {
      const nbv = computeNBV(asset, depreciationLedger, fyEnd);
      const deprAmt = computeDepreciation(asset, nbv);
      const fyName  = currentFiscalYear?.name || fyEnd.slice(0, 4);
      const already = depreciationLedger.some(
        (e) => e.assetId === asset.id && e.fiscalYear === fyName
      );
      if (!already && deprAmt > 0) {
        await store.saveDepreciationEntry({
          assetId: asset.id,
          assetName: asset.name,
          date: fyEnd,
          fiscalYear: fyName,
          method: asset.depreciationMethod,
          openingNBV: nbv,
          depreciationAmount: deprAmt,
          closingNBV: Math.max(asset.residualValue || 0, nbv - deprAmt),
        });
        count++;
      }
    }
    toast.success(`Depreciation posted for ${count} assets`);
  };

  // ── Filtered assets ────────────────────────────────────────────────────────
  const filtered = useMemo(
    () =>
      fixedAssets.filter(
        (a) => filterCat === "ALL" || a.category === filterCat
      ),
    [fixedAssets, filterCat]
  );

  // ── Asset schedule (with computed values) ─────────────────────────────────
  const scheduleRows = useMemo(() => {
    return filtered.map((asset) => {
      const nbv       = computeNBV(asset, depreciationLedger, fyEnd);
      const deprAmt   = computeDepreciation(asset, nbv);
      const fyName    = currentFiscalYear?.name || fyEnd.slice(0, 4);

      const totalDeprSoFar = depreciationLedger
        .filter((e) => e.assetId === asset.id)
        .reduce((s, e) => s + e.depreciationAmount, 0);

      return {
        ...asset,
        openingGrossBlock:   asset.purchaseCost,
        openingNBV:          nbv,
        depreciationForYear: deprAmt,
        closingNBV:          Math.max(asset.residualValue || 0, nbv - deprAmt),
        accumulatedDepr:     totalDeprSoFar,
        netBookValue:        nbv,
        isFullyDepreciated:  nbv <= (asset.residualValue || 0),
      };
    });
  }, [filtered, depreciationLedger, fyEnd, currentFiscalYear]);

  // ── Summary totals ─────────────────────────────────────────────────────────
  const totals = {
    grossBlock:     scheduleRows.reduce((s, r) => s + r.purchaseCost, 0),
    accumDepr:      scheduleRows.reduce((s, r) => s + r.accumulatedDepr, 0),
    netBlock:       scheduleRows.reduce((s, r) => s + r.netBookValue, 0),
    deprThisYear:   scheduleRows.reduce((s, r) => s + r.depreciationForYear, 0),
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportSchedule = () => {
    const data = scheduleRows.map((r) => ({
      "Asset Name":           r.name,
      "Code":                 r.code || "",
      "Category":             r.category,
      "Purchase Date":        r.purchaseDate,
      "Gross Block (Cost)":   r.purchaseCost,
      "Method":               r.depreciationMethod.toUpperCase(),
      "Rate %":               r.depreciationMethod === "wdv" ? r.wdvRate : Math.round(100 / r.usefulLifeYears),
      "Accum. Depreciation":  r.accumulatedDepr,
      "Opening NBV":          r.openingNBV,
      "Depr This Year":       r.depreciationForYear,
      "Closing NBV":          r.closingNBV,
      "Residual Value":       r.residualValue,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data),
      "Fixed Asset Schedule"
    );
    XLSX.writeFile(wb, `FixedAssets_${fyEnd}.xlsx`);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 bg-[#f5f6fa] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">
            Fixed Assets Register
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {companySettings?.name || "Company"} — Nepal IT Act
            Depreciation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportSchedule}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Export Schedule
          </button>
          <button
            onClick={postAllDepreciation}
            className="h-8 px-3 bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
          >
            <Calculator className="h-3.5 w-3.5" /> Post All Depreciation
          </button>
          <button
            onClick={() => {
              setForm(emptyAsset());
              setEditingId(null);
              setShowModal(true);
            }}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Add Asset
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {(["register", "schedule", "disposal"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`h-8 px-4 text-[12px] font-medium rounded-md capitalize transition-colors ${
              activeTab === tab
                ? "bg-[#1557b0] text-white"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {tab === "register"
              ? "Asset Register"
              : tab === "schedule"
              ? "Depreciation Schedule"
              : "Disposal Register"}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-wrap gap-2 items-center no-print">
        <label className={labelCls + " mb-0"}>Category:</label>
        {["ALL", ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`h-7 px-3 text-[11px] font-medium rounded-md transition-colors ${
              filterCat === cat
                ? "bg-[#1557b0] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-gray-500">
          {filtered.length} assets • Gross Block: Rs.{" "}
          {fmt(totals.grossBlock)} • Net Block: Rs.{" "}
          {fmt(totals.netBlock)}
        </span>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Gross Block",        value: totals.grossBlock,    color: "text-gray-800" },
          { label: "Accum. Depreciation",value: totals.accumDepr,     color: "text-red-600" },
          { label: "Net Block (NBV)",     value: totals.netBlock,      color: "text-[#1557b0]" },
          { label: "Depr. This Year",     value: totals.deprThisYear,  color: "text-amber-700" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white border border-gray-200 rounded-lg p-3"
          >
            <p className="text-[10px] font-semibold text-gray-500 tracking-wide">
              {kpi.label}
            </p>
            <p className={`text-[15px] font-bold font-mono mt-1 ${kpi.color}`}>
              Rs. {fmt(kpi.value)}
            </p>
          </div>
        ))}
      </div>

      {/* ── REGISTER TAB ──────────────────────────────────────────────────── */}
      {activeTab === "register" && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <th className={thCls}>Asset Name</th>
                  <th className={thCls}>Category</th>
                  <th className={thCls}>Purchase Date</th>
                  <th className={`${thCls} text-right`}>Cost</th>
                  <th className={thCls}>Method</th>
                  <th className={`${thCls} text-right`}>Rate %</th>
                  <th className={`${thCls} text-right`}>NBV</th>
                  <th className={`${thCls} text-right`}>Depr/Year</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-10 text-center text-[12px] text-gray-400"
                    >
                      No assets added yet. Click "Add Asset" to begin.
                    </td>
                  </tr>
                )}
                {scheduleRows.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-gray-50 ${!row.isActive ? "opacity-50" : ""}`}
                  >
                    <td className={tdCls}>
                      <div className="font-medium text-gray-800">
                        {row.name}
                      </div>
                      {row.code && (
                        <div className="text-[10px] text-gray-400">
                          {row.code}
                        </div>
                      )}
                      {row.serialNo && (
                        <div className="text-[10px] text-gray-400">
                          S/N: {row.serialNo}
                        </div>
                      )}
                    </td>
                    <td className={tdCls}>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded">
                        {row.category}
                      </span>
                    </td>
                    <td className={tdCls}>{row.purchaseDate}</td>
                    <td className={amtCls}>{fmt(row.purchaseCost)}</td>
                    <td className={tdCls}>
                      <span className="font-semibold text-[11px]">
                        {row.depreciationMethod}
                      </span>
                    </td>
                    <td className={amtCls}>
                      {row.depreciationMethod === "wdv"
                        ? row.wdvRate + "%"
                        : Math.round(100 / row.usefulLifeYears) + "%"}
                    </td>
                    <td className={`${amtCls} font-semibold text-[#1557b0]`}>
                      {fmt(row.netBookValue)}
                    </td>
                    <td className={`${amtCls} text-amber-700`}>
                      {row.isFullyDepreciated ? (
                        <span className="text-[10px] text-gray-400">
                          Fully depr.
                        </span>
                      ) : (
                        fmt(row.depreciationForYear)
                      )}
                    </td>
                    <td className={tdCls}>
                      {row.disposalDate ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-semibold rounded">
                          Disposed
                        </span>
                      ) : row.isFullyDepreciated ? (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">
                          Fully Depr.
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded">
                          Active
                        </span>
                      )}
                    </td>
                    <td className={tdCls}>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(row)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => computeAndPostDepr(row)}
                          className="p-1.5 rounded hover:bg-amber-50 text-amber-600"
                          title="Post Depreciation"
                        >
                          <Calculator className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DEPRECIATION SCHEDULE TAB ─────────────────────────────────────── */}
      {activeTab === "schedule" && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-[#f5f6fa] border-b border-gray-200 text-[11px] text-gray-600">
            Fixed Asset Schedule as per Nepal IT Act — FY ending{" "}
            {fyEnd}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 1100 }}>
              <thead>
                <tr>
                  <th className={thCls}>Asset</th>
                  <th className={thCls}>Category</th>
                  <th className={thCls}>Method</th>
                  <th className={`${thCls} text-right`}>Gross Block</th>
                  <th className={`${thCls} text-right`}>Accum. Depr.</th>
                  <th className={`${thCls} text-right`}>Opening NBV</th>
                  <th className={`${thCls} text-right`}>Depr. FY</th>
                  <th className={`${thCls} text-right`}>Closing NBV</th>
                  <th className={`${thCls} text-right`}>Residual Value</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className={`${tdCls} font-medium text-gray-800`}>
                      {row.name}
                    </td>
                    <td className={tdCls}>{row.category}</td>
                    <td className={tdCls}>
                      <span className="font-semibold text-[11px]">
                        {row.depreciationMethod}
                        {row.depreciationMethod === "wdv"
                          ? ` @ ${row.wdvRate}%`
                          : ` @ ${Math.round(100 / row.usefulLifeYears)}%`}
                      </span>
                    </td>
                    <td className={amtCls}>{fmt(row.purchaseCost)}</td>
                    <td className="px-3 py-2.5 text-[12px] font-mono text-right border-b border-gray-100 text-red-600">
                      {fmt(row.accumulatedDepr)}
                    </td>
                    <td className={amtCls}>{fmt(row.openingNBV)}</td>
                    <td className="px-3 py-2.5 text-[12px] font-mono text-right border-b border-gray-100 text-amber-700">
                      {row.isFullyDepreciated
                        ? "—"
                        : fmt(row.depreciationForYear)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-mono text-right border-b border-gray-100 font-semibold text-[#1557b0]">
                      {fmt(row.closingNBV)}
                    </td>
                    <td className={amtCls}>{fmt(row.residualValue)}</td>
                  </tr>
                ))}

                {scheduleRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-[12px] text-gray-400"
                    >
                      No assets found.
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Totals row */}
              {scheduleRows.length > 0 && (
                <tfoot>
                  <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold">
                    <td
                      colSpan={3}
                      className="px-3 py-2.5 text-[12px] font-bold text-gray-800"
                    >
                      TOTAL
                    </td>
                    <td className={amtCls}>
                      {fmt(totals.grossBlock)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-right border-b border-gray-100 text-red-600">
                      {fmt(totals.accumDepr)}
                    </td>
                    <td className={amtCls}>
                      {fmt(
                        scheduleRows.reduce((s, r) => s + r.openingNBV, 0)
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-right border-b border-gray-100 text-amber-700">
                      {fmt(totals.deprThisYear)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-right border-b border-gray-100 text-[#1557b0]">
                      {fmt(totals.netBlock)}
                    </td>
                    <td className={amtCls}>
                      {fmt(
                        scheduleRows.reduce(
                          (s, r) => s + (r.residualValue || 0),
                          0
                        )
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── DISPOSAL TAB ──────────────────────────────────────────────────── */}
      {activeTab === "disposal" && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr>
                  <th className={thCls}>Asset</th>
                  <th className={thCls}>Category</th>
                  <th className={`${thCls} text-right`}>Cost</th>
                  <th className={`${thCls} text-right`}>Accum. Depr.</th>
                  <th className={`${thCls} text-right`}>NBV at Disposal</th>
                  <th className={`${thCls} text-right`}>Sale Proceeds</th>
                  <th className={`${thCls} text-right`}>Gain / (Loss)</th>
                  <th className={thCls}>Disposal Date</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRows.filter((r) => !!r.disposalDate).length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-[12px] text-gray-400"
                    >
                      No disposed assets found. Edit an asset and set a
                      disposal date to record disposal.
                    </td>
                  </tr>
                )}
                {scheduleRows
                  .filter((r) => !!r.disposalDate)
                  .map((row) => {
                    const gainLoss =
                      (row.disposalAmount || 0) - row.netBookValue;
                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className={`${tdCls} font-medium`}>
                          {row.name}
                        </td>
                        <td className={tdCls}>{row.category}</td>
                        <td className={amtCls}>{fmt(row.purchaseCost)}</td>
                        <td className="px-3 py-2.5 text-[12px] font-mono text-right border-b border-gray-100 text-red-600">
                          {fmt(row.accumulatedDepr)}
                        </td>
                        <td className={amtCls}>{fmt(row.netBookValue)}</td>
                        <td className={amtCls}>
                          {fmt(row.disposalAmount || 0)}
                        </td>
                        <td
                          className={`${amtCls} font-semibold ${gainLoss >= 0 ? "text-green-700" : "text-red-600"}`}
                        >
                          {gainLoss < 0 ? "(" : ""}
                          {fmt(gainLoss)}
                          {gainLoss < 0 ? ")" : ""}
                        </td>
                        <td className={tdCls}>{row.disposalDate}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Depreciation History section ──────────────────────────────────── */}
      {depreciationLedger.length > 0 && (
        <div className="mt-4 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-[#f5f6fa] border-b border-gray-200 text-[11px] font-semibold text-gray-700 tracking-wide">
            Depreciation Ledger — Posted Entries
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr>
                  <th className={thCls}>Asset</th>
                  <th className={thCls}>FY</th>
                  <th className={thCls}>Date</th>
                  <th className={thCls}>Method</th>
                  <th className={`${thCls} text-right`}>Opening NBV</th>
                  <th className={`${thCls} text-right`}>Depreciation</th>
                  <th className={`${thCls} text-right`}>Closing NBV</th>
                </tr>
              </thead>
              <tbody>
                {[...depreciationLedger]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 50)
                  .map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className={`${tdCls} font-medium`}>
                        {entry.assetName}
                      </td>
                      <td className={tdCls}>{entry.fiscalYear}</td>
                      <td className={tdCls}>{entry.date}</td>
                      <td className={tdCls}>
                        <span className="font-semibold text-[11px]">
                          {entry.method}
                        </span>
                      </td>
                      <td className={amtCls}>{fmt(entry.openingNBV)}</td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-right border-b border-gray-100 text-red-600 font-semibold">
                        {fmt(entry.depreciationAmount)}
                      </td>
                      <td className={`${amtCls} text-[#1557b0] font-semibold`}>
                        {fmt(entry.closingNBV)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ───────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-[#f5f6fa] border-b border-gray-200">
              <h3 className="text-[14px] font-semibold text-gray-800">
                {editingId ? "Edit Fixed Asset" : "Add Fixed Asset"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded hover:bg-gray-200 text-gray-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Asset Name *</label>
                  <input
                    className={inputCls}
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="e.g. Office Computer - HP"
                  />
                </div>
                <div>
                  <label className={labelCls}>Asset Code</label>
                  <input
                    className={inputCls}
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, code: e.target.value }))
                    }
                    placeholder="e.g. FA-001"
                  />
                </div>
                <div>
                  <label className={labelCls}>Category *</label>
                  <select
                    className={inputCls}
                    value={form.category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Purchase details */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Purchase Date *</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.purchaseDate}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        purchaseDate: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Purchase Cost (Rs.) *</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={form.purchaseCost || ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        purchaseCost: Number(e.target.value) || 0,
                      }))
                    }
                    placeholder="0.00"
                    min={0}
                  />
                </div>
                <div>
                  <label className={labelCls}>Residual / Scrap Value</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={form.residualValue || ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        residualValue: Number(e.target.value) || 0,
                      }))
                    }
                    placeholder="0.00"
                    min={0}
                  />
                </div>
              </div>

              {/* Depreciation */}
              <div className="border border-gray-200 rounded-lg p-3 space-y-3">
                <p className="text-[11px] font-semibold text-gray-600 tracking-wide">
                  Depreciation Settings (Nepal IT Act)
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Method</label>
                    <select
                      className={inputCls}
                      value={form.depreciationMethod}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          depreciationMethod: e.target.value as "slm" | "wdv",
                        }))
                      }
                    >
                      <option value="wdv">WDV (Written Down Value)</option>
                      <option value="slm">SLM (Straight Line)</option>
                    </select>
                  </div>
                  {form.depreciationMethod === "wdv" ? (
                    <div>
                      <label className={labelCls}>WDV Rate %</label>
                      <input
                        type="number"
                        className={inputCls}
                        value={form.wdvRate || ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            wdvRate: Number(e.target.value) || 0,
                          }))
                        }
                        placeholder="e.g. 25"
                        min={0}
                        max={100}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className={labelCls}>Useful Life (Years)</label>
                      <input
                        type="number"
                        className={inputCls}
                        value={form.usefulLifeYears || ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            usefulLifeYears: Number(e.target.value) || 1,
                          }))
                        }
                        placeholder="e.g. 5"
                        min={1}
                      />
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Depreciation Preview</label>
                    <div className="h-8 px-2.5 flex items-center text-[12px] font-mono font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md">
                      Rs.{" "}
                      {fmt(
                        form.depreciationMethod === "slm"
                          ? computeSLM(
                              form.purchaseCost,
                              form.residualValue,
                              form.usefulLifeYears
                            )
                          : computeWDV(
                              form.purchaseCost - (form.residualValue || 0),
                              form.wdvRate || 0
                            )
                      )}{" "}
                      / yr
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional info */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Location</label>
                  <input
                    className={inputCls}
                    value={form.location}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, location: e.target.value }))
                    }
                    placeholder="e.g. Head Office"
                  />
                </div>
                <div>
                  <label className={labelCls}>Serial Number</label>
                  <input
                    className={inputCls}
                    value={form.serialNo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, serialNo: e.target.value }))
                    }
                    placeholder="Serial / Asset Tag"
                  />
                </div>
                <div>
                  <label className={labelCls}>Supplier</label>
                  <input
                    className={inputCls}
                    value={form.supplier}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, supplier: e.target.value }))
                    }
                    placeholder="Supplier name"
                  />
                </div>
              </div>

              {/* Disposal fields */}
              <div className="border border-gray-200 rounded-lg p-3 space-y-3">
                <p className="text-[11px] font-semibold text-gray-600 tracking-wide">
                  Disposal (leave blank if not disposed)
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Disposal Date</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={form.disposalDate || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          disposalDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Sale Proceeds (Rs.)</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={form.disposalAmount || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          disposalAmount: Number(e.target.value) || 0,
                        }))
                      }
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Disposal Reason</label>
                    <input
                      className={inputCls}
                      value={form.disposalReason || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          disposalReason: e.target.value,
                        }))
                      }
                      placeholder="e.g. Sold, Scrapped"
                    />
                  </div>
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                  className="h-4 w-4 accent-[#1557b0]"
                />
                <span className="text-[12px] text-gray-700 font-medium">
                  Asset is Active
                </span>
              </label>
            </div>

            {/* Modal footer */}
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md"
              >
                {editingId ? "Update Asset" : "Add Asset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
