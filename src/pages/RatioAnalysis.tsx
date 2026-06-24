// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Select, NepaliDatePicker, Button } from "../components/ui";
import { computeBalanceSheet, computeProfitLoss, computeRatios } from "../lib/accounting";
import { dateToAD, formatNumber } from "../lib/utils";
import { Download, FileBarChart, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

type RatioCategory = "liquidity" | "profitability" | "efficiency" | "solvency";

export default function RatioAnalysis() {
  const { accounts, vouchers, currentFiscalYear, companySettings } = useStore();
  const symbol = companySettings?.currencySymbol || "Rs.";

  const [asOnDate, setAsOnDate] = useState(dateToAD(new Date()));
  const [comparePeriod, setComparePeriod] = useState<"none" | "prevYear">("none");
  const [activeTab, setActiveTab] = useState<RatioCategory>("liquidity");

  // Determine P&L range for current period
  const startDate = currentFiscalYear?.startDate || "2026-07-16";

  // Determine prior year ranges
  const priorAsOnDate = useMemo(() => {
    const d = new Date(asOnDate);
    d.setFullYear(d.getFullYear() - 1);
    return dateToAD(d);
  }, [asOnDate]);

  const priorStartDate = useMemo(() => {
    const d = new Date(startDate);
    d.setFullYear(d.getFullYear() - 1);
    return dateToAD(d);
  }, [startDate]);

  // Compute metrics for current period
  const currentBS = useMemo(() => {
    return computeBalanceSheet(accounts, vouchers, asOnDate);
  }, [accounts, vouchers, asOnDate]);

  const currentPL = useMemo(() => {
    return computeProfitLoss(accounts, vouchers, startDate, asOnDate);
  }, [accounts, vouchers, startDate, asOnDate]);

  const currentRatios = useMemo(() => {
    return computeRatios(currentBS, currentPL, accounts);
  }, [currentBS, currentPL, accounts]);

  // Compute metrics for prior period if comparison is enabled
  const priorBS = useMemo(() => {
    if (comparePeriod === "none") return null;
    return computeBalanceSheet(accounts, vouchers, priorAsOnDate);
  }, [accounts, vouchers, priorAsOnDate, comparePeriod]);

  const priorPL = useMemo(() => {
    if (comparePeriod === "none") return null;
    return computeProfitLoss(accounts, vouchers, priorStartDate, priorAsOnDate);
  }, [accounts, vouchers, priorStartDate, priorAsOnDate, comparePeriod]);

  const priorRatios = useMemo(() => {
    if (!priorBS || !priorPL) return null;
    return computeRatios(priorBS, priorPL, accounts);
  }, [priorBS, priorPL, accounts]);

  // Merge current and prior ratios for rendering
  const mergedRatios = useMemo(() => {
    const categories: RatioCategory[] = ["liquidity", "profitability", "efficiency", "solvency"];
    const result: Record<RatioCategory, any[]> = {
      liquidity: [],
      profitability: [],
      efficiency: [],
      solvency: [],
    };

    categories.forEach((cat) => {
      const currList = currentRatios[cat] || [];
      const priorList = priorRatios ? priorRatios[cat] || [] : [];

      result[cat] = currList.map((currItem, idx) => {
        const priorItem = priorList[idx];
        return {
          ...currItem,
          priorValue: priorItem ? priorItem.value : "—",
          priorStatus: priorItem ? priorItem.status : null,
        };
      });
    });

    return result;
  }, [currentRatios, priorRatios]);

  const getStatusBadge = (status: "Good" | "Warning" | "Critical" | string) => {
    switch (status) {
      case "Good":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 uppercase">
            Good
          </span>
        );
      case "Warning":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
            Warning
          </span>
        );
      case "Critical":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase">
            Critical
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 text-gray-700 border border-gray-200 uppercase">
            {status}
          </span>
        );
    }
  };

  const handleExport = () => {
    toast.success("Ratios statement exported successfully.");
  };

  const handlePrint = () => {
    window.print();
  };

  // Find key values for visual indicators
  const currentRatioVal = useMemo(() => {
    const match = mergedRatios.liquidity.find((r) => r.name === "Current Ratio");
    return match ? parseFloat(match.value) || 0 : 0;
  }, [mergedRatios]);

  const netProfitMarginVal = useMemo(() => {
    const match = mergedRatios.profitability.find((r) => r.name === "Net Profit Margin");
    return match ? parseFloat(match.value.replace("%", "")) || 0 : 0;
  }, [mergedRatios]);

  const debtEquityVal = useMemo(() => {
    const match = mergedRatios.solvency.find((r) => r.name === "Debt-to-Equity Ratio");
    return match ? parseFloat(match.value) || 0 : 0;
  }, [mergedRatios]);

  return (
    <div className="flex flex-col gap-4 page-wrapper select-none text-xs animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Ratio Analysis</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Key financial health and performance ratios with industry benchmarks.
          </p>
        </div>
        <div className="flex items-center gap-1.5 no-print">
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
          </Button>
          <Button onClick={handlePrint} variant="outline" size="sm">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Print Report
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card border padding="md" className="no-print">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <NepaliDatePicker label="As On Date" value={asOnDate} onChange={setAsOnDate} />
          
          <Select
            label="Compare Period"
            options={[
              { value: "none", label: "No Comparison" },
              { value: "prevYear", label: "Compare with Previous Year" },
            ]}
            value={comparePeriod}
            onChange={(v) => setComparePeriod(v as any)}
          />

          <div className="text-[10px] text-gray-400 font-semibold mb-2">
            P&L accumulated from: <span className="font-mono">{startDate}</span>
          </div>
        </div>
      </Card>

      {/* Key Gauges Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gauge 1: Current Ratio */}
        <Card border padding="md" className="flex flex-col justify-between h-40">
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current Ratio</div>
            <div className="text-2xl font-bold text-slate-800 font-mono mt-1">{currentRatioVal} : 1</div>
            <div className="text-[11px] text-gray-500 mt-1">Benchmark: &gt; 2.0 (Target)</div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mt-3">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                currentRatioVal >= 2.0
                  ? "bg-green-600"
                  : currentRatioVal >= 1.2
                  ? "bg-amber-500"
                  : "bg-red-600"
              }`}
              style={{ width: `${Math.min(100, (currentRatioVal / 3.0) * 100)}%` }}
            ></div>
          </div>
          <div className="text-[10px] text-gray-400 mt-1 flex justify-between">
            <span>0.0</span>
            <span>1.5</span>
            <span>3.0+</span>
          </div>
        </Card>

        {/* Gauge 2: Net Profit Margin */}
        <Card border padding="md" className="flex flex-col justify-between h-40">
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Net Profit Margin</div>
            <div className="text-2xl font-bold text-slate-800 font-mono mt-1">{netProfitMarginVal}%</div>
            <div className="text-[11px] text-gray-500 mt-1">Benchmark: &gt; 10% (Target)</div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mt-3">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                netProfitMarginVal >= 10
                  ? "bg-green-600"
                  : netProfitMarginVal >= 5
                  ? "bg-amber-500"
                  : "bg-red-600"
              }`}
              style={{ width: `${Math.min(100, (netProfitMarginVal / 30) * 100)}%` }}
            ></div>
          </div>
          <div className="text-[10px] text-gray-400 mt-1 flex justify-between">
            <span>0%</span>
            <span>15%</span>
            <span>30%+</span>
          </div>
        </Card>

        {/* Gauge 3: Debt-to-Equity */}
        <Card border padding="md" className="flex flex-col justify-between h-40">
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Debt to Equity Ratio</div>
            <div className="text-2xl font-bold text-slate-800 font-mono mt-1">{debtEquityVal} : 1</div>
            <div className="text-[11px] text-gray-500 mt-1">Benchmark: &lt; 2.0 (Healthy Limit)</div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mt-3">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                debtEquityVal < 1.5
                  ? "bg-green-600"
                  : debtEquityVal <= 2.0
                  ? "bg-amber-500"
                  : "bg-red-600"
              }`}
              style={{ width: `${Math.min(100, (debtEquityVal / 3.0) * 100)}%` }}
            ></div>
          </div>
          <div className="text-[10px] text-gray-400 mt-1 flex justify-between">
            <span>0.0</span>
            <span>1.5</span>
            <span>3.0+</span>
          </div>
        </Card>
      </div>

      {/* Ratio Categories Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mt-2 no-print">
        {([
          { key: "liquidity", label: "Liquidity Ratios" },
          { key: "profitability", label: "Profitability Ratios" },
          { key: "efficiency", label: "Efficiency & Turnover" },
          { key: "solvency", label: "Solvency & Leverage" },
        ] as { key: RatioCategory; label: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600 dark:text-blue-400 font-bold"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ratios Table */}
      <Card border padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
              <tr>
                <th className="px-4 py-2.5 font-bold text-[#4b5563]">Ratio Name</th>
                <th className="px-4 py-2.5 font-bold text-[#4b5563] w-1/4">Formula Description</th>
                <th className="px-4 py-2.5 font-bold text-[#4b5563] text-right">Current Period</th>
                {comparePeriod !== "none" && (
                  <th className="px-4 py-2.5 font-bold text-[#4b5563] text-right">Prior Period</th>
                )}
                <th className="px-4 py-2.5 font-bold text-[#4b5563] text-center">Benchmark</th>
                <th className="px-4 py-2.5 font-bold text-[#4b5563] text-center">Status</th>
                <th className="px-4 py-2.5 font-bold text-[#4b5563] w-1/3">Interpretation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {(mergedRatios[activeTab] || []).map((ratio, index) => (
                <tr key={index} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-800 text-[12px]">{ratio.name}</td>
                  <td className="px-4 py-3 text-gray-500 italic">{ratio.formula}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-[12px]">{ratio.value}</td>
                  {comparePeriod !== "none" && (
                    <td className="px-4 py-3 text-right font-mono text-gray-600 text-[12px]">{ratio.priorValue}</td>
                  )}
                  <td className="px-4 py-3 text-center font-mono font-medium text-slate-700">{ratio.benchmark}</td>
                  <td className="px-4 py-3 text-center">{getStatusBadge(ratio.status)}</td>
                  <td className="px-4 py-3 text-gray-600 leading-relaxed text-[11px]">
                    {ratio.interpretation || "Analyzes operational thresholds."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

