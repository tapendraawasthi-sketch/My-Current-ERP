import React, { useState, useMemo, useEffect } from "react";
import { Download, CheckSquare, Search } from "lucide-react";
import { useStore } from "../store/useStore";
import { computeDepreciation } from "../lib/accounting";
import { DepreciationEntry, VoucherType, VoucherStatus, JournalEntry } from "../lib/types";
import { generateId } from "../lib/db";
import { workbookFromArray, downloadWorkbook } from "../lib/exportUtils";

export default function DepreciationChart() {
  const { fixedAssets, depreciationBlocks, currentFiscalYear, addVoucher, updateAssetDepreciation, loadFixedAssets, loadDepreciationBlocks } = useStore();
  
  const [fyEndDate, setFyEndDate] = useState<string>("");
  const [fyStartDate, setFyStartDate] = useState<string>("");
  const [methodOverride, setMethodOverride] = useState<"All" | "SLM" | "WDV">("All");
  const [assetFilter, setAssetFilter] = useState("");
  const [blockFilter, setBlockFilter] = useState("All");
  const [showPostModal, setShowPostModal] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    loadFixedAssets();
    loadDepreciationBlocks();
  }, [loadFixedAssets, loadDepreciationBlocks]);

  useEffect(() => {
    if (currentFiscalYear) {
      setFyEndDate(currentFiscalYear.endDate);
      setFyStartDate(currentFiscalYear.startDate);
    } else {
      setFyEndDate(new Date().toISOString().split("T")[0]);
      setFyStartDate(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]);
    }
  }, [currentFiscalYear]);

  const activeAssets = useMemo(() => {
    return fixedAssets.filter(a => a.isActive && (assetFilter ? a.name.toLowerCase().includes(assetFilter.toLowerCase()) || a.code.toLowerCase().includes(assetFilter.toLowerCase()) : true))
    .filter(a => methodOverride === "All" ? true : a.method === methodOverride)
    .filter(a => blockFilter === "All" ? true : a.blockId === blockFilter);
  }, [fixedAssets, methodOverride, assetFilter, blockFilter]);

  const depreciationData = useMemo(() => {
    return activeAssets.map(asset => {
      const block = depreciationBlocks.find(b => b.id === asset.blockId);
      if (!block) return null;
      return {
        asset,
        block,
        ...computeDepreciation(asset, block, fyStartDate, fyEndDate)
      };
    }).filter(Boolean) as (DepreciationEntry & { asset: any, block: any })[];
  }, [activeAssets, depreciationBlocks, fyStartDate, fyEndDate]);

  const groupedByBlock = useMemo(() => {
    const groups: Record<string, typeof depreciationData> = {};
    for (const data of depreciationData) {
      if (!groups[data.block.id]) groups[data.block.id] = [];
      groups[data.block.id].push(data);
    }
    return groups;
  }, [depreciationData]);

  const handleExport = () => {
    const headers = ["Block", "Asset Name", "Method", "Opening WDV", "Rate %", "Depreciation", "Closing WDV", "Accumulated Dep."];
    const rows: any[][] = [];
    
    Object.keys(groupedByBlock).forEach(blockId => {
      const blockEntries = groupedByBlock[blockId];
      const block = blockEntries[0].block;
      rows.push([`${block.name} (${block.code})`, "", "", "", "", "", "", ""]);
      
      let blockDep = 0;
      let blockClosing = 0;
      
      blockEntries.forEach(entry => {
        rows.push([
          "",
          entry.asset.name,
          entry.asset.method,
          entry.openingWDV.toFixed(2),
          entry.asset.method === 'WDV' ? entry.block.rate + '%' : (entry.asset.slmRate ? entry.asset.slmRate + '%' : '-'),
          entry.depForYear.toFixed(2),
          entry.closingWDV.toFixed(2),
          entry.accumulatedDepreciation.toFixed(2)
        ]);
        blockDep += entry.depForYear;
        blockClosing += entry.closingWDV;
      });
      
      rows.push(["Subtotal", "", "", "", "", blockDep.toFixed(2), blockClosing.toFixed(2), ""]);
    });

    const wb = workbookFromArray(headers, rows, "Depreciation Chart");
    downloadWorkbook(wb, `Depreciation_Chart_${fyEndDate}.xlsx`);
  };

  const handlePostDepreciation = async () => {
    if (depreciationData.length === 0) return;
    setIsPosting(true);
    try {
      for (const entry of depreciationData) {
        if (entry.depForYear <= 0) continue;
        
        const voucher: Omit<JournalEntry, "id"> = {
          date: fyEndDate,
          voucherNo: `JV-DEP-${entry.asset.code}-${new Date().getTime()}`,
          type: VoucherType.JOURNAL,
          status: VoucherStatus.POSTED,
          lines: [
            { accountId: entry.asset.depreciationAccountId, debit: entry.depForYear, credit: 0 },
            { accountId: entry.asset.accDepAccountId, debit: 0, credit: entry.depForYear }
          ],
          narration: `Being depreciation on ${entry.asset.name} for FY ${currentFiscalYear?.name || fyEndDate} @ ${entry.asset.method === 'WDV' ? entry.block.rate + '%' : 'SLM'}`,
        };
        
        await addVoucher(voucher);
        await updateAssetDepreciation(entry.asset.id, entry.depForYear);
      }
      setShowPostModal(false);
      alert("Depreciation entries posted successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to post depreciation entries.");
    } finally {
      setIsPosting(false);
    }
  };

  let grandTotalDep = 0;
  let grandTotalClosing = 0;

  return (
    <div className="page-wrapper">
      <div className="page-toolbar">
        <div className="page-toolbar-left">
          <h1 className="page-title">Depreciation Chart</h1>
          <p className="page-subtitle">Calculate and post fixed asset depreciation</p>
        </div>
        <div className="page-toolbar-right">
          <button
            onClick={() => setShowPostModal(true)}
            disabled={depreciationData.length === 0}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-semibold rounded-md flex items-center gap-2 disabled:opacity-50"
          >
            <CheckSquare className="h-4 w-4" />
            Post Depreciation
          </button>
          <button onClick={handleExport} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-semibold rounded-md hover:bg-gray-50 flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="page-content-area flex flex-col gap-4">
        <div className="bg-white p-3 rounded-lg border border-[#dde1ea] flex flex-wrap gap-4 items-end shadow-sm">
          <div>
            <label className="text-[11px] font-semibold text-gray-700 block mb-1">FY End Date</label>
            <input
              type="date"
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              value={fyEndDate}
              onChange={(e) => setFyEndDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-700 block mb-1">Method</label>
            <select
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              value={methodOverride}
              onChange={(e) => setMethodOverride(e.target.value as any)}
            >
              <option value="All">All Methods</option>
              <option value="WDV">WDV</option>
              <option value="SLM">SLM</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-700 block mb-1">Block Filter</label>
            <select
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              value={blockFilter}
              onChange={(e) => setBlockFilter(e.target.value)}
            >
              <option value="All">All Blocks</option>
              {depreciationBlocks.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by asset name or code..."
              className="w-full h-8 pl-8 pr-2.5 text-[12px] border border-gray-300 rounded-md focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#dde1ea] shadow-sm overflow-hidden flex-1">
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="th-left">Asset Name</th>
                  <th className="th-left">Block</th>
                  <th className="th-center">Method</th>
                  <th className="th-right">Opening WDV</th>
                  <th className="th-right">Rate %</th>
                  <th className="th-right">Depreciation</th>
                  <th className="th-right">Closing WDV</th>
                  <th className="th-right">Accumulated Dep.</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(groupedByBlock).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">
                      No assets found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  Object.keys(groupedByBlock).map((blockId) => {
                    const blockEntries = groupedByBlock[blockId];
                    const block = blockEntries[0].block;
                    let blockDepTotal = 0;
                    let blockClosingTotal = 0;

                    return (
                      <React.Fragment key={blockId}>
                        <tr className="bg-[#f0f2f5]">
                          <td colSpan={8} className="font-bold py-2 text-[12px] text-gray-800">
                            {block.name} (Block {block.code})
                          </td>
                        </tr>
                        {blockEntries.map((entry) => {
                          blockDepTotal += entry.depForYear;
                          blockClosingTotal += entry.closingWDV;
                          grandTotalDep += entry.depForYear;
                          grandTotalClosing += entry.closingWDV;
                          
                          return (
                            <tr key={entry.assetId}>
                              <td className="pl-6">{entry.asset.name}</td>
                              <td>{block.code}</td>
                              <td className="text-center">{entry.asset.method}</td>
                              <td className="text-right amt">{entry.openingWDV.toFixed(2)}</td>
                              <td className="text-right">
                                {entry.asset.method === 'WDV' ? `${block.rate}%` : (entry.asset.slmRate ? `${entry.asset.slmRate}%` : '-')}
                              </td>
                              <td className="text-right amt text-red-600">{entry.depForYear.toFixed(2)}</td>
                              <td className="text-right amt font-medium">{entry.closingWDV.toFixed(2)}</td>
                              <td className="text-right amt">{entry.accumulatedDepreciation.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-[#eef1f8] font-bold border-t border-b border-[#c5cad8]">
                          <td colSpan={5} className="text-right text-[11px] text-[#4b5563]">Block {block.code} Subtotal:</td>
                          <td className="text-right amt">{blockDepTotal.toFixed(2)}</td>
                          <td className="text-right amt">{blockClosingTotal.toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              {Object.keys(groupedByBlock).length > 0 && (
                <tfoot>
                  <tr className="bg-[#eef1f8] font-bold text-[12px]">
                    <td colSpan={5} className="text-right py-3 uppercase text-[#4b5563]">Grand Total:</td>
                    <td className="text-right amt py-3 text-red-600">{grandTotalDep.toFixed(2)}</td>
                    <td className="text-right amt py-3">{grandTotalClosing.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {showPostModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[600px] max-w-full flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-gray-800">Confirm Depreciation Posting</h2>
              <button onClick={() => setShowPostModal(false)} className="text-gray-500 hover:text-gray-700">
                <Search className="h-5 w-5" /> {/* Use X icon normally, but not imported, so wait we imported X before, wait, I didn't import X in this file. I will use text instead or just close button. Let me import X later if needed. actually just use text */}
                Close
              </button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-[13px] text-gray-600 mb-4">
                The following journal entries will be generated to record depreciation for FY {currentFiscalYear?.name || fyEndDate}. This will update the accumulated depreciation and WDV of the assets.
              </p>
              
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-700">Asset</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">Accounts (Dr/Cr)</th>
                      <th className="px-3 py-2 font-semibold text-gray-700 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {depreciationData.filter(d => d.depForYear > 0).map((entry, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 font-medium text-gray-800">{entry.asset.name}</td>
                        <td className="px-3 py-2 text-gray-600">
                          Dr. {entry.asset.depreciationAccountId}<br/>
                          Cr. {entry.asset.accDepAccountId}
                        </td>
                        <td className="px-3 py-2 text-right amt text-red-600 font-medium">
                          {entry.depForYear.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
              <button 
                onClick={() => setShowPostModal(false)}
                className="h-8 px-4 border border-gray-300 text-gray-700 text-[12px] font-semibold rounded-md hover:bg-white"
                disabled={isPosting}
              >
                Cancel
              </button>
              <button 
                onClick={handlePostDepreciation}
                className="h-8 px-4 bg-[#1557b0] text-white text-[12px] font-semibold rounded-md hover:bg-[#0f4a96] flex items-center gap-2"
                disabled={isPosting}
              >
                {isPosting ? "Posting..." : "Confirm & Post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
