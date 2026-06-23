/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Inventory report page — 7 tabs: Stock Valuation, Batch Tracking, Reorder Report,
 * Daily Balances, Monthly Summary, Unmoved Items, Critical Stock.
 */

import React, { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { formatNumber } from '../lib/utils';
import { formatADToBS } from '../lib/nepaliDate';
import {
  computeAllStockPositions,
  getLowStockItems,
  getStockValuationSummary,
  computeDailyBalances,
  computeUnmovedItems,
  computeCriticalStock,
} from '../lib/stockUtils';
import { StockValuationMethod } from '../lib/types';
import type { DailyStockBalance } from '../lib/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Download, AlertTriangle, TrendingDown, Package } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── helpers ────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

// Last 12 months as "YYYY-MM" strings
function last12Months(): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    result.push(`${d.getFullYear()}-${m}`);
  }
  return result;
}

// ─── tab config ─────────────────────────────────────────────────────────────

type TabId = 'valuation' | 'batch' | 'reorder' | 'daily' | 'monthly' | 'unmoved' | 'critical';

const TABS: { id: TabId; label: string }[] = [
  { id: 'valuation', label: 'Stock Valuation' },
  { id: 'batch',     label: 'Batch Tracking'  },
  { id: 'reorder',   label: 'Reorder Report'  },
  { id: 'daily',     label: 'Daily Balances'  },
  { id: 'monthly',   label: 'Monthly Summary' },
  { id: 'unmoved',   label: 'Unmoved Items'   },
  { id: 'critical',  label: 'Critical Stock'  },
];

// ─── shared class constants ──────────────────────────────────────────────────

const TH = 'px-3 py-2 text-left text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em]';
const TH_R = 'px-3 py-2 text-right text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em]';
const TD = 'px-3 py-[7px] text-[12px] text-gray-700';
const TD_R = 'px-3 py-[7px] text-[12px] text-gray-700 text-right font-mono';
const THEAD = 'bg-[#eef1f8] border-b-2 border-[#c5cad8]';
const BTN_PRIMARY = 'h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-semibold rounded-md transition-colors';
const BTN_OUTLINE = 'h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-semibold rounded-md hover:bg-gray-50 transition-colors';
const INPUT_CLS = 'h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]';

// ─── component ───────────────────────────────────────────────────────────────

const InventoryReport: React.FC = () => {
  const { items, stockMovements, warehouses, currentFiscalYear } = useStore();

  // ── shared state
  const [activeTab, setActiveTab] = useState<TabId>('valuation');
  const [asOfDate, setAsOfDate] = useState(
    currentFiscalYear?.endDate || todayStr(),
  );
  const [valuationMethod, setValuationMethod] = useState<StockValuationMethod>(
    StockValuationMethod.WEIGHTED_AVERAGE,
  );

  // ── daily tab state
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [dailyStartDate, setDailyStartDate] = useState(daysAgoStr(30));
  const [dailyEndDate, setDailyEndDate] = useState(todayStr());
  const [dailyData, setDailyData] = useState<DailyStockBalance[]>([]);

  // ── unmoved tab state
  const [unmoveDays, setUnmoveDays] = useState(30);
  const [selectedUnmovedItems, setSelectedUnmovedItems] = useState<string[]>([]);

  // ── memos ──────────────────────────────────────────────────────────────────

  // VALUATION
  const valuationRows = useMemo(() => {
    if (activeTab !== 'valuation') return [];
    return getStockValuationSummary(
      stockMovements,
      items,
      warehouses,
      valuationMethod,
      asOfDate,
    );
  }, [activeTab, stockMovements, items, warehouses, valuationMethod, asOfDate]);

  const valuationTotal = useMemo(
    () => valuationRows.reduce((s, r) => s + r.value, 0),
    [valuationRows],
  );

  // REORDER
  const reorderRows = useMemo(
    () =>
      getLowStockItems(stockMovements, items, warehouses).map((item) => ({
        ...item,
        reorderLevel: item.reorderLevel || 0,
        minStock: item.minimumStock || 0,
        shortage: Math.max(0, (item.minimumStock || 0) - item.currentStock),
      })),
    [stockMovements, items, warehouses],
  );

  // STOCK POSITIONS (for valuation tab extra columns)
  const stockPositions = useMemo(() => {
    if (activeTab !== 'valuation') return [];
    return computeAllStockPositions(stockMovements, items, warehouses, asOfDate);
  }, [activeTab, stockMovements, items, warehouses, asOfDate]);

  // MONTHLY
  const monthlyRows = useMemo(() => {
    const months = last12Months();
    return months.map((ym) => {
      let inQty = 0;
      let outQty = 0;
      for (const m of stockMovements) {
        if (!m.date || !m.date.startsWith(ym)) continue;
        if (m.qty > 0) inQty += m.qty;
        else outQty += Math.abs(m.qty);
      }
      return { month: ym, inQty, outQty, netChange: inQty - outQty };
    });
  }, [stockMovements]);

  // UNMOVED
  const unmovedRows = useMemo(
    () => computeUnmovedItems(stockMovements, items, todayStr(), unmoveDays),
    [stockMovements, items, unmoveDays],
  );

  // CRITICAL
  const criticalData = useMemo(
    () => computeCriticalStock(items, stockMovements),
    [items, stockMovements],
  );
  const criticalItems  = criticalData.filter((r) => r.status === 'critical');
  const reorderItems   = criticalData.filter((r) => r.status === 'reorder');
  const overstockedItems = criticalData.filter((r) => r.status === 'overstocked');

  // ── unmoved helpers ────────────────────────────────────────────────────────

  const toggleUnmovedAll = () => {
    if (selectedUnmovedItems.length === unmovedRows.length) {
      setSelectedUnmovedItems([]);
    } else {
      setSelectedUnmovedItems(unmovedRows.map((r) => r.itemId));
    }
  };

  const toggleUnmovedItem = (id: string) => {
    setSelectedUnmovedItems((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page-wrapper">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Inventory Report</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Stock valuation, movements, and analysis across all warehouses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={BTN_OUTLINE}
            onClick={() => toast('Export not yet implemented.')}
          >
            <Download size={13} className="inline mr-1.5 -mt-px" />
            Export
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-gray-200 mb-4 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-4 py-2.5 text-[12px] font-medium cursor-pointer whitespace-nowrap transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-[#1557b0] text-[#1557b0]'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          TAB: VALUATION
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'valuation' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-600">As of Date</label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-600">Valuation Method</label>
              <select
                value={valuationMethod}
                onChange={(e) => setValuationMethod(e.target.value as StockValuationMethod)}
                className={INPUT_CLS}
              >
                <option value={StockValuationMethod.WEIGHTED_AVERAGE}>Weighted Average</option>
                <option value={StockValuationMethod.FIFO}>FIFO</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className={THEAD}>
                  <th className={TH}>Item</th>
                  <th className={TH}>Code</th>
                  <th className={TH}>Warehouse</th>
                  <th className={TH_R}>Qty</th>
                  <th className={TH_R}>Avg Rate</th>
                  <th className={TH_R}>Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {valuationRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-gray-400">
                      No valuation data available for the selected date and method.
                    </td>
                  </tr>
                ) : (
                  valuationRows.map((row) => {
                    const item = items.find((i) => i.id === row.itemId);
                    const pos = stockPositions.find((p) => p.itemId === row.itemId);
                    return (
                      <tr key={row.itemId} className="hover:bg-[#f7f9fc]">
                        <td className={TD}>{row.itemName}</td>
                        <td className={TD + ' text-gray-500'}>{item?.code || '—'}</td>
                        <td className={TD + ' text-gray-500'}>All Warehouses</td>
                        <td className={TD_R}>{formatNumber(row.qty)}</td>
                        <td className={TD_R}>{formatNumber(row.rate)}</td>
                        <td className={TD_R + ' text-[#1557b0]'}>{formatNumber(row.value)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {valuationRows.length > 0 && (
                <tfoot>
                  <tr className="bg-[#eef1f8] border-t-2 border-[#c5cad8]">
                    <td colSpan={5} className="px-3 py-2.5 text-[12px] font-bold text-gray-800">
                      Total Stock Value
                    </td>
                    <td className={TD_R + ' font-bold text-[#1557b0]'}>
                      {formatNumber(valuationTotal)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: BATCH
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'batch' && (
        <div className="bg-white border border-gray-200 rounded-lg px-6 py-12 text-center">
          <Package size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-[13px] font-medium text-gray-500">
            Batch tracking requires batch-enabled items.
          </p>
          <p className="text-[12px] text-gray-400 mt-1">
            Enable batch tracking in System Settings.
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: REORDER
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'reorder' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className={THEAD}>
                <th className={TH}>Item</th>
                <th className={TH}>Code</th>
                <th className={TH}>Warehouse</th>
                <th className={TH_R}>Min Stock</th>
                <th className={TH_R}>Current Stock</th>
                <th className={TH_R}>Shortage</th>
                <th className={TH_R}>Reorder Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reorderRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-400">
                    No items below reorder level.
                  </td>
                </tr>
              ) : (
                reorderRows.map((row) => (
                  <tr key={`${row.id}-${row.warehouseId}`} className="hover:bg-[#f7f9fc]">
                    <td className={TD}>{row.name}</td>
                    <td className={TD + ' text-gray-500'}>{row.code}</td>
                    <td className={TD + ' text-gray-500'}>{row.warehouseName}</td>
                    <td className={TD_R}>{formatNumber(row.minStock)}</td>
                    <td className={TD_R}>
                      <span className={row.currentStock === 0 ? 'text-red-600 font-bold' : 'text-amber-600'}>
                        {formatNumber(row.currentStock)}
                      </span>
                    </td>
                    <td className={TD_R + ' text-red-600'}>{formatNumber(row.shortage)}</td>
                    <td className={TD_R}>{formatNumber(row.reorderLevel)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: DAILY BALANCES
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-600">Item *</label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className={INPUT_CLS + ' min-w-[180px]'}
              >
                <option value="">Select item...</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-600">Warehouse</label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className={INPUT_CLS + ' min-w-[160px]'}
              >
                <option value="">All Warehouses</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-600">Start Date</label>
              <input
                type="date"
                value={dailyStartDate}
                onChange={(e) => setDailyStartDate(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-600">End Date</label>
              <input
                type="date"
                value={dailyEndDate}
                onChange={(e) => setDailyEndDate(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() => {
                if (!selectedItemId) {
                  toast.error('Please select an item first.');
                  return;
                }
                setDailyData(
                  computeDailyBalances(
                    stockMovements,
                    selectedItemId,
                    selectedWarehouseId || null,
                    dailyStartDate,
                    dailyEndDate,
                  ),
                );
              }}
            >
              Load
            </button>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className={THEAD}>
                  <th className={TH}>Date (BS)</th>
                  <th className={TH_R}>Opening Qty</th>
                  <th className={TH_R}>In Qty</th>
                  <th className={TH_R}>Out Qty</th>
                  <th className={TH_R}>Closing Qty</th>
                  <th className={TH_R}>Rate</th>
                  <th className={TH_R}>Closing Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dailyData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-400">
                      {selectedItemId
                        ? 'Click "Load" to fetch daily balance data.'
                        : 'Select an item and click "Load" to view daily balances.'}
                    </td>
                  </tr>
                ) : (
                  dailyData.map((row) => (
                    <tr key={row.date} className="hover:bg-[#f7f9fc]">
                      <td className={TD}>{row.dateNepali || row.date}</td>
                      <td className={TD_R}>{formatNumber(row.openingQty)}</td>
                      <td className={TD_R + ' text-green-700'}>{formatNumber(row.inQty)}</td>
                      <td className={TD_R + ' text-red-600'}>{formatNumber(row.outQty)}</td>
                      <td className={TD_R + ' font-bold'}>{formatNumber(row.closingQty)}</td>
                      <td className={TD_R}>{formatNumber(row.rate)}</td>
                      <td className={TD_R + ' text-[#1557b0]'}>{formatNumber(row.closingValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Chart */}
          {dailyData.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-[11px] font-medium text-gray-500 mb-3">Closing Qty — Daily Trend</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="dateNepali"
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="closingQty"
                    stroke="#1557b0"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: MONTHLY SUMMARY
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'monthly' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className={THEAD}>
                <th className={TH}>Month</th>
                <th className={TH_R}>Total In</th>
                <th className={TH_R}>Total Out</th>
                <th className={TH_R}>Net Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {monthlyRows.map((row) => (
                <tr key={row.month} className="hover:bg-[#f7f9fc]">
                  <td className={TD}>{row.month}</td>
                  <td className={TD_R + ' text-green-700'}>{formatNumber(row.inQty)}</td>
                  <td className={TD_R + ' text-red-600'}>{formatNumber(row.outQty)}</td>
                  <td
                    className={
                      TD_R +
                      (row.netChange >= 0 ? ' text-green-700' : ' text-red-600') +
                      ' font-bold'
                    }
                  >
                    {row.netChange >= 0 ? '+' : ''}
                    {formatNumber(row.netChange)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#eef1f8] border-t-2 border-[#c5cad8]">
                <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800">Total (12 months)</td>
                <td className={TD_R + ' font-bold text-green-700'}>
                  {formatNumber(monthlyRows.reduce((s, r) => s + r.inQty, 0))}
                </td>
                <td className={TD_R + ' font-bold text-red-600'}>
                  {formatNumber(monthlyRows.reduce((s, r) => s + r.outQty, 0))}
                </td>
                <td className={TD_R + ' font-bold'}>
                  {formatNumber(monthlyRows.reduce((s, r) => s + r.netChange, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: UNMOVED ITEMS
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'unmoved' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-end justify-between gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-gray-600">Unmoved Since (days)</label>
                <select
                  value={unmoveDays}
                  onChange={(e) => {
                    setUnmoveDays(Number(e.target.value));
                    setSelectedUnmovedItems([]);
                  }}
                  className={INPUT_CLS}
                >
                  {[30, 60, 90, 180].map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={BTN_OUTLINE}
                onClick={() => toast('Export not yet implemented.')}
              >
                <Download size={13} className="inline mr-1.5 -mt-px" />
                Export
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={selectedUnmovedItems.length === 0}
                onClick={() =>
                  toast(
                    `Write-off: ${selectedUnmovedItems.length} items selected. Implement via StockJournal.`,
                  )
                }
              >
                <TrendingDown size={13} className="inline mr-1.5 -mt-px" />
                Write Off Selected
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className={THEAD}>
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={
                        unmovedRows.length > 0 &&
                        selectedUnmovedItems.length === unmovedRows.length
                      }
                      onChange={toggleUnmovedAll}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className={TH}>Item</th>
                  <th className={TH}>Code</th>
                  <th className={TH}>Last Movement Date</th>
                  <th className={TH}>Last Type</th>
                  <th className={TH_R}>Days Unmoved</th>
                  <th className={TH_R}>Current Stock</th>
                  <th className={TH_R}>Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {unmovedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[12px] text-gray-400">
                      No items unmoved for {unmoveDays}+ days.
                    </td>
                  </tr>
                ) : (
                  unmovedRows.map((row) => (
                    <tr key={row.itemId} className="hover:bg-[#f7f9fc]">
                      <td className="px-3 py-[7px] w-8">
                        <input
                          type="checkbox"
                          checked={selectedUnmovedItems.includes(row.itemId)}
                          onChange={() => toggleUnmovedItem(row.itemId)}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className={TD}>{row.itemName}</td>
                      <td className={TD + ' text-gray-500'}>{row.itemCode}</td>
                      <td className={TD}>{row.lastMovementDate}</td>
                      <td className={TD + ' text-gray-500 capitalize'}>{row.lastMovementType}</td>
                      <td className={TD_R}>
                        <span
                          className={[
                            'px-2 py-0.5 rounded text-[10px] font-semibold uppercase',
                            row.daysUnmoved > 90
                              ? 'bg-red-100 text-red-700'
                              : row.daysUnmoved > 30
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-700',
                          ].join(' ')}
                        >
                          {row.daysUnmoved}d
                        </span>
                      </td>
                      <td className={TD_R}>{formatNumber(row.currentStock)}</td>
                      <td className={TD_R}>{formatNumber(row.currentValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: CRITICAL STOCK
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'critical' && (
        <div className="space-y-5">
          {/* Section 1 — Critical (below min stock) */}
          <div className="border border-red-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-red-50 px-4 py-2.5 border-b border-red-200">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-red-600" />
                <span className="text-[12px] font-semibold text-red-700">
                  Critical — Below Minimum Stock
                </span>
                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">
                  {criticalItems.length}
                </span>
              </div>
              <button
                type="button"
                className="h-7 px-3 bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold rounded-md transition-colors"
                onClick={() => toast('Draft PO — feature in next sprint.')}
              >
                Generate PO
              </button>
            </div>
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-red-50 border-b border-red-100">
                  <th className={TH}>Item</th>
                  <th className={TH}>Code</th>
                  <th className={TH_R}>Min Stock</th>
                  <th className={TH_R}>Current Stock</th>
                  <th className={TH_R}>Shortage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50">
                {criticalItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[12px] text-gray-400">
                      No items in critical state.
                    </td>
                  </tr>
                ) : (
                  criticalItems.map((row) => (
                    <tr key={row.itemId} className="hover:bg-red-50">
                      <td className={TD}>{row.itemName}</td>
                      <td className={TD + ' text-gray-500'}>{row.itemCode}</td>
                      <td className={TD_R}>{formatNumber(row.minimumStock)}</td>
                      <td className={TD_R + ' text-red-600 font-bold'}>
                        {formatNumber(row.currentStock)}
                      </td>
                      <td className={TD_R + ' text-red-700 font-bold'}>
                        {formatNumber(row.minimumStock - row.currentStock)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Section 2 — Reorder (below reorder level) */}
          <div className="border border-amber-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-amber-50 px-4 py-2.5 border-b border-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-600" />
                <span className="text-[12px] font-semibold text-amber-700">
                  Reorder — Below Reorder Level
                </span>
                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">
                  {reorderItems.length}
                </span>
              </div>
              <button
                type="button"
                className="h-7 px-3 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold rounded-md transition-colors"
                onClick={() => toast('Draft PO — feature in next sprint.')}
              >
                Generate PO
              </button>
            </div>
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-amber-50 border-b border-amber-100">
                  <th className={TH}>Item</th>
                  <th className={TH}>Code</th>
                  <th className={TH_R}>Reorder Level</th>
                  <th className={TH_R}>Current Stock</th>
                  <th className={TH_R}>Deficit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {reorderItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[12px] text-gray-400">
                      No items below reorder level.
                    </td>
                  </tr>
                ) : (
                  reorderItems.map((row) => (
                    <tr key={row.itemId} className="hover:bg-amber-50">
                      <td className={TD}>{row.itemName}</td>
                      <td className={TD + ' text-gray-500'}>{row.itemCode}</td>
                      <td className={TD_R}>{formatNumber(row.reorderLevel)}</td>
                      <td className={TD_R + ' text-amber-600 font-bold'}>
                        {formatNumber(row.currentStock)}
                      </td>
                      <td className={TD_R + ' text-amber-700 font-bold'}>
                        {formatNumber(row.reorderLevel - row.currentStock)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Section 3 — Overstocked */}
          <div className="border border-blue-200 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2.5 border-b border-blue-200">
              <Package size={15} className="text-blue-600" />
              <span className="text-[12px] font-semibold text-blue-700">
                Overstocked — Exceeds Maximum Stock
              </span>
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">
                {overstockedItems.length}
              </span>
            </div>
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-blue-50 border-b border-blue-100">
                  <th className={TH}>Item</th>
                  <th className={TH}>Code</th>
                  <th className={TH_R}>Max Stock</th>
                  <th className={TH_R}>Current Stock</th>
                  <th className={TH_R}>Excess</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {overstockedItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[12px] text-gray-400">
                      No overstocked items.
                    </td>
                  </tr>
                ) : (
                  overstockedItems.map((row) => (
                    <tr key={row.itemId} className="hover:bg-blue-50">
                      <td className={TD}>{row.itemName}</td>
                      <td className={TD + ' text-gray-500'}>{row.itemCode}</td>
                      <td className={TD_R}>{formatNumber(row.maximumStock)}</td>
                      <td className={TD_R + ' text-blue-600 font-bold'}>
                        {formatNumber(row.currentStock)}
                      </td>
                      <td className={TD_R + ' text-blue-700 font-bold'}>
                        {formatNumber(row.currentStock - row.maximumStock)}
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
  );
};

export default InventoryReport;
