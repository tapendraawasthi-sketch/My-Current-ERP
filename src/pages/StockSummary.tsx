// @ts-nocheck
// src/pages/StockSummary.tsx
// Stock Summary with proper WA / FIFO valuation, group accordion, grand total, Excel export
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronRight, Download, TrendingUp } from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatNumber } from '../lib/utils';
import { computeAllItemSummaries, type ValuationMethod, type StockSummaryRow } from '../lib/inventoryValuation';

// ─────────────────────────────────────────────────────────────────────────────
const AmtCell = ({ v }: { v: number }) => (
  <td className="px-3 py-1.5 text-right font-mono text-[12px]">
    {v !== 0 ? formatNumber(v) : <span className="text-gray-300">-</span>}
  </td>
);
const QtyCell = ({ v }: { v: number }) => (
  <td className="px-3 py-1.5 text-right font-mono text-[12px]">
    {v !== 0 ? formatNumber(v) : <span className="text-gray-300">-</span>}
  </td>
);

// ─────────────────────────────────────────────────────────────────────────────
const StockSummary: React.FC = () => {
  const { items, stockMovements, currentFiscalYear, itemGroups, warehouses, companySettings } = useStore();

  const [method,          setMethod]          = useState<ValuationMethod>('weighted-average');
  const [fromDate,        setFromDate]        = useState(currentFiscalYear?.startDate ?? '');
  const [toDate,          setToDate]          = useState(currentFiscalYear?.endDate   ?? '');
  const [groupFilter,     setGroupFilter]     = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [showZeroStock,   setShowZeroStock]   = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // ── Build summary rows ───────────────────────────────────────────────────
  const summaryRows: StockSummaryRow[] = useMemo(() => {
    if (!items?.length) return [];
    const allItems = groupFilter
      ? items.filter((i) => i.groupId === groupFilter)
      : items;
    const productItems = allItems.filter((i) => i.type !== 'service');
    return computeAllItemSummaries(
      method,
      stockMovements ?? [],
      productItems,
      itemGroups ?? [],
      fromDate,
      toDate,
      warehouseFilter || null
    ).filter((r) => showZeroStock || r.closingQty !== 0 || r.inQty !== 0 || r.outQty !== 0);
  }, [items, stockMovements, itemGroups, method, fromDate, toDate, groupFilter, warehouseFilter, showZeroStock]);

  // ── Group by item group ──────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; rows: StockSummaryRow[] }>();
    for (const r of summaryRows) {
      if (!map.has(r.groupId)) map.set(r.groupId, { name: r.groupName, rows: [] });
      map.get(r.groupId)!.rows.push(r);
    }
    return map;
  }, [summaryRows]);

  // ── Grand totals ─────────────────────────────────────────────────────────
  const grand = useMemo(() => ({
    openingQty:   summaryRows.reduce((s, r) => s + r.openingQty,   0),
    openingValue: summaryRows.reduce((s, r) => s + r.openingValue, 0),
    inQty:        summaryRows.reduce((s, r) => s + r.inQty,        0),
    inValue:      summaryRows.reduce((s, r) => s + r.inValue,      0),
    outQty:       summaryRows.reduce((s, r) => s + r.outQty,       0),
    outValue:     summaryRows.reduce((s, r) => s + r.outValue,     0),
    closingQty:   summaryRows.reduce((s, r) => s + r.closingQty,   0),
    closingValue: summaryRows.reduce((s, r) => s + r.closingValue, 0),
  }), [summaryRows]);

  // ── Toggle group collapse ────────────────────────────────────────────────
  const toggleGroup = (gid: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(gid) ? next.delete(gid) : next.add(gid);
      return next;
    });
  };

  // ── Export ───────────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = summaryRows.map((r) => ({
      'Item Group':      r.groupName,
      'Item Name':       r.itemName,
      'Unit':            r.unit,
      'Opening Qty':     r.openingQty,
      'Opening Value':   r.openingValue,
      'Inward Qty':      r.inQty,
      'Inward Value':    r.inValue,
      'Outward Qty':     r.outQty,
      'Outward Value':   r.outValue,
      'Closing Qty':     r.closingQty,
      'Closing Rate':    r.closingRate,
      'Closing Value':   r.closingValue,
    }));
    // Append grand total
    rows.push({
      'Item Group':      'GRAND TOTAL',
      'Item Name':       '',
      'Unit':            '',
      'Opening Qty':     grand.openingQty,
      'Opening Value':   grand.openingValue,
      'Inward Qty':      grand.inQty,
      'Inward Value':    grand.inValue,
      'Outward Qty':     grand.outQty,
      'Outward Value':   grand.outValue,
      'Closing Qty':     grand.closingQty,
      'Closing Rate':    0,
      'Closing Value':   grand.closingValue,
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Summary');
    XLSX.writeFile(wb, `stock-summary-${fromDate}-to-${toDate}.xlsx`);
    toast.success('Exported to Excel');
  };

  const methodLabel = method === 'fifo' ? 'FIFO' : 'Weighted Average';

  return (
    <div className="page-wrapper">
      {/* ── Toolbar ── */}
      <div className="page-toolbar">
        <div className="page-toolbar-left">
          <TrendingUp className="h-4 w-4" />
          <span className="page-title">STOCK SUMMARY</span>
          <span className="badge badge-info" style={{ fontSize: 10 }}>
            {methodLabel}
          </span>
        </div>
        <div className="page-toolbar-right">
          <button
            className={`px-3 py-1 text-[11px] font-bold uppercase border border-black rounded ${method === 'weighted-average' ? 'bg-[#C9DEB5]' : 'bg-[#EBF5E2] hover:bg-[#D4EABD]'}`}
            onClick={() => setMethod('weighted-average')}
          >
            Weighted Avg
          </button>
          <button
            className={`px-3 py-1 text-[11px] font-bold uppercase border border-black rounded ${method === 'fifo' ? 'bg-[#C9DEB5]' : 'bg-[#EBF5E2] hover:bg-[#D4EABD]'}`}
            onClick={() => setMethod('fifo')}
          >
            FIFO
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-3 py-1 text-[11px] border border-black rounded bg-[#EBF5E2] hover:bg-[#D4EABD]"
          >
            <Download className="h-3.5 w-3.5" /> Export Excel
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-[#EBF5E2] border-b border-black">
        <label className="flex items-center gap-1.5 text-[11px]">
          From:
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="h-8 px-2 text-[12px] border border-black rounded bg-[#EBF5E2]" />
        </label>
        <label className="flex items-center gap-1.5 text-[11px]">
          To:
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="h-8 px-2 text-[12px] border border-black rounded bg-[#EBF5E2]" />
        </label>
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}
          className="h-8 px-2 text-[12px] border border-black rounded bg-[#EBF5E2] min-w-[160px]">
          <option value="">All Item Groups</option>
          {(itemGroups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}
          className="h-8 px-2 text-[12px] border border-black rounded bg-[#EBF5E2] min-w-[140px]">
          <option value="">All Warehouses</option>
          {(warehouses ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
          <input type="checkbox" checked={showZeroStock} onChange={(e) => setShowZeroStock(e.target.checked)} />
          Show zero stock
        </label>
        <div className="ml-auto text-[11px] text-gray-600">
          {summaryRows.length} items
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-4 gap-px bg-black border-b border-black">
        {[
          { label: 'Opening Value',   val: grand.openingValue  },
          { label: 'Inward Value',    val: grand.inValue       },
          { label: 'Outward Value',   val: grand.outValue      },
          { label: 'Closing Value',   val: grand.closingValue  },
        ].map((k) => (
          <div key={k.label} className="bg-[#EBF5E2] px-4 py-2">
            <div className="text-[9px] font-bold uppercase tracking-wide text-gray-600">{k.label}</div>
            <div className="text-[15px] font-bold font-mono">Rs. {formatNumber(k.val)}</div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="page-content-area overflow-auto">
        {summaryRows.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">
            No stock movements found for the selected period.
          </div>
        ) : (
          <table className="data-table w-full" style={{ minWidth: 1050 }}>
            <thead>
              <tr>
                <th className="px-3 py-2 text-left" style={{ width: 220 }}>Item</th>
                <th className="px-3 py-2 text-center" style={{ width: 50 }}>Unit</th>
                {/* Opening */}
                <th className="px-3 py-2 text-right bg-[#EBF5E2]">Op. Qty</th>
                <th className="px-3 py-2 text-right bg-[#EBF5E2]">Op. Value</th>
                {/* Inward */}
                <th className="px-3 py-2 text-right bg-[#d1fae5]">In Qty</th>
                <th className="px-3 py-2 text-right bg-[#d1fae5]">In Value</th>
                {/* Outward */}
                <th className="px-3 py-2 text-right bg-[#fef3c7]">Out Qty</th>
                <th className="px-3 py-2 text-right bg-[#fef3c7]">Out Value</th>
                {/* Closing */}
                <th className="px-3 py-2 text-right bg-[#D4EABD]">Cl. Qty</th>
                <th className="px-3 py-2 text-right bg-[#D4EABD]">Cl. Rate</th>
                <th className="px-3 py-2 text-right bg-[#D4EABD]">Cl. Value</th>
              </tr>
            </thead>
            <tbody>
              {[...grouped.entries()].map(([groupId, { name, rows }]) => {
                const isCollapsed = collapsedGroups.has(groupId);
                // Group subtotal
                const sub = rows.reduce(
                  (acc, r) => ({
                    openingQty: acc.openingQty + r.openingQty,
                    openingValue: acc.openingValue + r.openingValue,
                    inQty: acc.inQty + r.inQty,
                    inValue: acc.inValue + r.inValue,
                    outQty: acc.outQty + r.outQty,
                    outValue: acc.outValue + r.outValue,
                    closingQty: acc.closingQty + r.closingQty,
                    closingValue: acc.closingValue + r.closingValue,
                  }),
                  { openingQty: 0, openingValue: 0, inQty: 0, inValue: 0, outQty: 0, outValue: 0, closingQty: 0, closingValue: 0 }
                );
                return (
                  <React.Fragment key={groupId}>
                    {/* Group header row */}
                    <tr
                      className="cursor-pointer bg-[#C9DEB5] border-t border-black hover:bg-[#B8D4A0]"
                      onClick={() => toggleGroup(groupId)}
                    >
                      <td className="px-3 py-1.5" colSpan={2}>
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide">
                          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          {name} <span className="font-normal text-gray-600 ml-1">({rows.length} items)</span>
                        </div>
                      </td>
                      <QtyCell v={sub.openingQty} />
                      <AmtCell v={sub.openingValue} />
                      <QtyCell v={sub.inQty} />
                      <AmtCell v={sub.inValue} />
                      <QtyCell v={sub.outQty} />
                      <AmtCell v={sub.outValue} />
                      <QtyCell v={sub.closingQty} />
                      <td />
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-[12px]">
                        {formatNumber(sub.closingValue)}
                      </td>
                    </tr>
                    {/* Item rows */}
                    {!isCollapsed && rows.map((r, i) => (
                      <tr key={r.itemId} className={i % 2 === 0 ? 'bg-white' : 'bg-[#EBF5E2]'}>
                        <td className="px-3 py-1.5 pl-8 text-[12px]">{r.itemName}</td>
                        <td className="px-3 py-1.5 text-center text-[11px] text-gray-500">{r.unit}</td>
                        <QtyCell v={r.openingQty} />
                        <AmtCell v={r.openingValue} />
                        <QtyCell v={r.inQty} />
                        <AmtCell v={r.inValue} />
                        <QtyCell v={r.outQty} />
                        <AmtCell v={r.outValue} />
                        <td className={`px-3 py-1.5 text-right font-mono text-[12px] font-bold ${r.closingQty < 0 ? 'text-red-700' : ''}`}>
                          {formatNumber(r.closingQty)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-[11px]">
                          {formatNumber(r.closingRate)}
                        </td>
                        <td className={`px-3 py-1.5 text-right font-mono text-[12px] font-semibold ${r.closingQty < 0 ? 'text-red-700' : ''}`}>
                          {formatNumber(r.closingValue)}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
            {/* Grand total footer */}
            <tfoot>
              <tr className="border-t-2 border-black bg-[#C9DEB5] font-bold">
                <td colSpan={2} className="px-3 py-2 text-[12px] uppercase">Grand Total</td>
                <td className="px-3 py-2 text-right font-mono">{formatNumber(grand.openingQty)}</td>
                <td className="px-3 py-2 text-right font-mono">Rs. {formatNumber(grand.openingValue)}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700">{formatNumber(grand.inQty)}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700">Rs. {formatNumber(grand.inValue)}</td>
                <td className="px-3 py-2 text-right font-mono text-red-700">{formatNumber(grand.outQty)}</td>
                <td className="px-3 py-2 text-right font-mono text-red-700">Rs. {formatNumber(grand.outValue)}</td>
                <td className="px-3 py-2 text-right font-mono text-[14px]">{formatNumber(grand.closingQty)}</td>
                <td />
                <td className="px-3 py-2 text-right font-mono text-[14px] text-[#1557b0]">
                  Rs. {formatNumber(grand.closingValue)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
};

export default StockSummary;
