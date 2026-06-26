// @ts-nocheck
// src/components/tally/TallySalesVoucher.tsx
/**
 * Sales Voucher (F8) — Tally Prime PDF §3
 *
 * Three modes:
 *   Item Invoice     — item grid (Name|Godown|Qty|Unit|Rate|Per|Amount) + tax ledgers
 *   Accounting Inv   — ledger-only particulars grid (service sales)
 *   As Voucher       — standard By/Dr To/Cr double-entry grid
 *
 * Toggle:  Alt+I → Item ↔ Accounting
 *          Ctrl+V → Invoice ↔ Voucher mode
 *
 * Saves through the REAL store.addInvoice (item mode) or store.addVoucher (voucher mode).
 */

import React, { useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  X, Save, Trash2, Plus, Banknote, FileText, Landmark,
  ShoppingCart, Settings, ChevronDown
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { ADToBSString } from '@/lib/nepaliDate';
import { formatMoney, parseMoney, amountInWords } from '@/lib/tallyFormat';
import {
  cryptoRandomId, todayAD, round2, blankItemLine,
  TRANSACTION_TYPES, DENOMINATIONS,
  type F12VoucherConfig, DEFAULT_F12_CONFIG,
  type InvoiceItemLine, type BillWiseAllocation,
} from '@/lib/tallyVoucher';
import TallyVoucherConfig from './TallyVoucherConfig';
import { VoucherClassStrip } from './TallyVoucherClass';

type InvoiceMode = 'item' | 'accounting' | 'voucher';

// ─── Inline ledger select ─────────────────────────────────────────────────────
const LedgerSelect: React.FC<{
  value: string;
  accounts: any[];
  onChange: (id: string, name: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}> = ({ value, accounts, onChange, placeholder, autoFocus }) => {
  const ledgers = useMemo(() => accounts.filter((a) => !a.isGroup), [accounts]);
  const current = ledgers.find((a) => a.id === value);
  const [text, setText] = useState(current?.name || '');
  const listId = useMemo(() => `ls-${cryptoRandomId()}`, []);

  React.useEffect(() => {
    setText(ledgers.find((a) => a.id === value)?.name || '');
  }, [value, ledgers]);

  const commit = (raw: string) => {
    const hit = ledgers.find((a) => a.name.toLowerCase() === raw.trim().toLowerCase());
    if (hit) onChange(hit.id, hit.name);
    else onChange('', raw);
  };

  return (
    <>
      <input
        className="tally-input"
        list={listId}
        value={text}
        autoFocus={autoFocus}
        placeholder={placeholder || 'Select ledger…'}
        onChange={(e) => { setText(e.target.value); commit(e.target.value); }}
      />
      <datalist id={listId}>
        {ledgers.map((a) => <option key={a.id} value={a.name}>{a.type}</option>)}
      </datalist>
    </>
  );
};

// ─── Inline item select ───────────────────────────────────────────────────────
const ItemSelect: React.FC<{
  value: string;
  items: any[];
  onChange: (id: string, name: string, rate: number, unit: string) => void;
  placeholder?: string;
}> = ({ value, items, onChange, placeholder }) => {
  const listId = useMemo(() => `is-${cryptoRandomId()}`, []);
  const current = items.find((i) => i.id === value);
  const [text, setText] = useState(current?.name || '');

  React.useEffect(() => {
    setText(items.find((i) => i.id === value)?.name || '');
  }, [value, items]);

  const commit = (raw: string) => {
    const hit = items.find((i) => i.name.toLowerCase() === raw.trim().toLowerCase());
    if (hit) onChange(hit.id, hit.name, hit.sellingPrice || hit.rate || 0, hit.unit || 'PCS');
    else onChange('', raw, 0, 'PCS');
  };

  return (
    <>
      <input
        className="tally-input"
        list={listId}
        value={text}
        placeholder={placeholder || 'Select item…'}
        onChange={(e) => { setText(e.target.value); commit(e.target.value); }}
      />
      <datalist id={listId}>
        {items.map((i) => <option key={i.id} value={i.name}>{i.unit || 'PCS'}</option>)}
      </datalist>
    </>
  );
};

// ─── Bill-wise modal ──────────────────────────────────────────────────────────
const BillWiseModal: React.FC<{
  initial?: BillWiseAllocation[];
  amount: number;
  partyId: string;
  invoices: any[];
  onSave: (rows: BillWiseAllocation[]) => void;
  onClose: () => void;
}> = ({ initial, amount, partyId, invoices, onSave, onClose }) => {
  const partyInvoices = (invoices || []).filter(
    (i) => (i.partyId === partyId || i.accountId === partyId) &&
            (i.balanceDue ?? i.grandTotal ?? 0) !== 0,
  );
  const [rows, setRows] = useState(() =>
    initial?.length
      ? initial
      : [{ id: cryptoRandomId(), method: 'New Reference', refNo: '', refDate: todayAD(), amount }],
  );
  const set = (i: number, k: string, v: any) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const diff = round2(amount - total);

  return (
    <div className="tally-modal-overlay" onClick={onClose}>
      <div className="tally-modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="tally-modal-head">
          <span><FileText size={14} className="inline mr-1" /> Bill-wise Details</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="tally-modal-body">
          <table>
            <thead>
              <tr><th>Method</th><th>Reference</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td>
                    <select className="tally-input" value={r.method} onChange={(e) => set(i, 'method', e.target.value)}>
                      <option>New Reference</option>
                      <option>Against Reference</option>
                      <option>Advance</option>
                      <option>On Account</option>
                    </select>
                  </td>
                  <td>
                    {r.method === 'Against Reference' && partyInvoices.length ? (
                      <select className="tally-input" value={r.refNo} onChange={(e) => set(i, 'refNo', e.target.value)}>
                        <option value="">Select bill…</option>
                        {partyInvoices.map((iv) => (
                          <option key={iv.id} value={iv.invoiceNo}>{iv.invoiceNo}</option>
                        ))}
                      </select>
                    ) : (
                      <input className="tally-input" value={r.refNo} onChange={(e) => set(i, 'refNo', e.target.value)} />
                    )}
                  </td>
                  <td><input type="date" className="tally-input" value={r.refDate} onChange={(e) => set(i, 'refDate', e.target.value)} /></td>
                  <td><input type="number" className="tally-input text-right" value={r.amount} onChange={(e) => set(i, 'amount', parseMoney(e.target.value))} /></td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="tally-btn py-0.5 px-1" onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between mt-2">
            <button className="tally-btn" onClick={() => setRows((p) => [...p, { id: cryptoRandomId(), method: 'New Reference', refNo: '', refDate: todayAD(), amount: diff > 0 ? diff : 0 }])}>
              <Plus size={12} className="inline mr-1" />Add Bill
            </button>
            <span className={`tally-total-box ${Math.abs(diff) > 0.001 ? 'tally-cr' : 'tally-dr'}`}>
              Allocated {formatMoney(total)} · Diff {formatMoney(diff)}
            </span>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-3 no-print">
          <button className="tally-btn" onClick={onClose}>Cancel</button>
          <button className="tally-btn tally-btn-primary" onClick={() => { onSave(rows); onClose(); }}>
            <Save size={13} className="inline mr-1" />Accept
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  onSwitchType?: (t: string) => void;
}

const TallySalesVoucher: React.FC<Props> = ({ onSwitchType }) => {
  const store = useStore() as any;
  const { accounts = [], items = [], invoices = [], warehouses = [], companySettings } = store;
  const symbol = companySettings?.currencySymbol || 'Rs.';

  // ── Modes ──
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>('item');
  const [f12Config, setF12Config] = useState<F12VoucherConfig>({
    ...DEFAULT_F12_CONFIG,
    invoiceMode: 'item',
    showGST: true,
    showDispatchDetails: false,
    showOrderDetails: false,
    showBillWise: true,
  });
  const [showF12, setShowF12] = useState(false);

  // ── Post-dated / optional flags ──
  const [isPostDated, setIsPostDated] = useState(false);
  const [isOptional, setIsOptional] = useState(false);

  // ── Header ──
  const [date, setDate] = useState(todayAD());
  const [reference, setReference] = useState('');
  const [narration, setNarration] = useState('');
  const [partyId, setPartyId] = useState('');
  const [partyName, setPartyName] = useState('');

  // ── Dispatch / Order details ──
  const [dispatchDetails, setDispatchDetails] = useState({ transporter: '', vehicleNo: '', lrNo: '' });
  const [orderDetails, setOrderDetails] = useState({ orderNo: '', orderDate: '' });

  // ── GST ──
  const [placeOfSupply, setPlaceOfSupply] = useState('');

  // ── Item lines (Item Invoice mode) ──
  const [itemLines, setItemLines] = useState<InvoiceItemLine[]>([blankItemLine()]);
  const [salesLedger, setSalesLedger] = useState({ id: '', name: '' });
  const [taxLines, setTaxLines] = useState<Array<{ id: string; accountId: string; accountName: string; rate: number; amount: number }>>([]);

  // ── Accounting Invoice mode ──
  const [acctLines, setAcctLines] = useState([{ id: cryptoRandomId(), accountId: '', accountName: '', amount: 0, narration: '' }]);

  // ── Voucher mode (By/Dr To/Cr grid) ──
  const [drCrNotation, setDrCrNotation] = useState(false);
  const [vLines, setVLines] = useState([
    { id: cryptoRandomId(), drcr: 'dr', accountId: '', accountName: '', amount: 0 },
    { id: cryptoRandomId(), drcr: 'cr', accountId: '', accountName: '', amount: 0 },
  ]);

  // ── Bill-wise popup ──
  const [billWisePartyId, setBillWisePartyId] = useState<string | null>(null);
  const [billWiseAmount, setBillWiseAmount] = useState(0);
  const [billWiseData, setBillWiseData] = useState<BillWiseAllocation[]>([]);

  // ── Voucher classes ──
  const voucherClasses = useMemo(
    () => (store.voucherClasses || []).filter((c: any) => c.voucherType === 'sales'),
    [store.voucherClasses],
  );
  const [activeClassId, setActiveClassId] = useState<string | null>(null);

  // ── Derived totals ──
  const itemSubTotal = useMemo(() =>
    itemLines.reduce((s, l) => s + (l.amount || 0), 0), [itemLines]);
  const taxTotal = useMemo(() =>
    taxLines.reduce((s, t) => s + (t.amount || 0), 0), [taxLines]);
  const grandTotal = round2(itemSubTotal + taxTotal);

  const acctTotal = useMemo(() =>
    acctLines.reduce((s, l) => s + (l.amount || 0), 0), [acctLines]);

  // ── Item line helpers ──
  const updateItemLine = (i: number, patch: Partial<InvoiceItemLine>) =>
    setItemLines((p) => p.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, ...patch };
      updated.amount = round2((updated.qty || 0) * (updated.rate || 0));
      return updated;
    }));

  const removeItemLine = (i: number) =>
    setItemLines((p) => p.length > 1 ? p.filter((_, idx) => idx !== i) : p);

  // ── Accept ──
  const handleAccept = useCallback(async () => {
    if (!date) { toast.error('Date is required.'); return; }

    if (invoiceMode === 'item') {
      if (!partyId) { toast.error('Select party / customer.'); return; }
      if (grandTotal <= 0) { toast.error('Grand total must be > 0.'); return; }
      const validItems = itemLines.filter((l) => l.itemName && l.qty > 0 && l.rate > 0);
      if (!validItems.length) { toast.error('Add at least one item with qty and rate.'); return; }
      try {
        await store.addInvoice({
          type: 'sales-invoice',
          date,
          dateNepali: (() => { try { return ADToBSString(date); } catch { return ''; } })(),
          referenceNo: reference,
          partyId,
          partyName,
          narration,
          lines: validItems.map((l) => ({
            itemId: l.itemId, itemName: l.itemName,
            qty: l.qty, unit: l.unit, rate: l.rate, amount: l.amount,
            warehouseId: l.godownId,
          })),
          taxableAmount: itemSubTotal,
          vatAmount: taxTotal,
          grandTotal,
          status: 'posted',
          isPostDated,
          isOptional,
          placeOfSupply,
          billWise: billWiseData,
        });
        toast.success('Sales invoice saved.');
        resetForm();
      } catch (e: any) {
        toast.error(e?.message || 'Failed to save invoice.');
      }
    } else if (invoiceMode === 'accounting') {
      if (!partyId) { toast.error('Select party / customer.'); return; }
      if (acctTotal <= 0) { toast.error('Total must be > 0.'); return; }
      try {
        await store.addInvoice({
          type: 'sales-invoice',
          date,
          dateNepali: (() => { try { return ADToBSString(date); } catch { return ''; } })(),
          referenceNo: reference,
          partyId, partyName,
          narration,
          lines: acctLines.filter((l) => l.accountId && l.amount > 0).map((l) => ({
            accountId: l.accountId, accountName: l.accountName, amount: l.amount,
          })),
          taxableAmount: acctTotal,
          grandTotal: acctTotal,
          status: 'posted',
          isPostDated, isOptional, placeOfSupply,
          billWise: billWiseData,
        });
        toast.success('Sales invoice (accounting) saved.');
        resetForm();
      } catch (e: any) {
        toast.error(e?.message || 'Failed to save.');
      }
    } else {
      // voucher mode
      const totalDr = vLines.filter((l) => l.drcr === 'dr').reduce((s, l) => s + l.amount, 0);
      const totalCr = vLines.filter((l) => l.drcr === 'cr').reduce((s, l) => s + l.amount, 0);
      if (Math.abs(totalDr - totalCr) > 0.001) { toast.error('Debits must equal Credits.'); return; }
      try {
        await store.addVoucher({
          type: 'journal',
          date,
          dateNepali: (() => { try { return ADToBSString(date); } catch { return ''; } })(),
          referenceNo: reference,
          narration,
          lines: vLines.filter((l) => l.accountId && l.amount > 0).map((l) => ({
            accountId: l.accountId, accountName: l.accountName,
            debit: l.drcr === 'dr' ? l.amount : 0,
            credit: l.drcr === 'cr' ? l.amount : 0,
          })),
          status: 'posted',
          isPostDated, isOptional,
        });
        toast.success('Sales voucher saved.');
        resetForm();
      } catch (e: any) {
        toast.error(e?.message || 'Failed to save.');
      }
    }
  }, [invoiceMode, date, partyId, partyName, reference, narration, itemLines, acctLines,
      vLines, grandTotal, acctTotal, itemSubTotal, taxTotal, isPostDated, isOptional,
      placeOfSupply, billWiseData, store]);

  const resetForm = () => {
    setDate(todayAD());
    setReference(''); setNarration('');
    setPartyId(''); setPartyName('');
    setItemLines([blankItemLine()]);
    setSalesLedger({ id: '', name: '' });
    setTaxLines([]);
    setAcctLines([{ id: cryptoRandomId(), accountId: '', accountName: '', amount: 0, narration: '' }]);
    setVLines([
      { id: cryptoRandomId(), drcr: 'dr', accountId: '', accountName: '', amount: 0 },
      { id: cryptoRandomId(), drcr: 'cr', accountId: '', accountName: '', amount: 0 },
    ]);
    setBillWiseData([]); setIsPostDated(false); setIsOptional(false);
    setActiveClassId(null);
  };

  // ── Keyboard ──
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const alt = e.altKey;
      if (e.key === 'F8') { e.preventDefault(); /* already here */ }
      else if (e.key === 'F7') { e.preventDefault(); onSwitchType?.('journal'); }
      else if (e.key === 'F5') { e.preventDefault(); onSwitchType?.('payment'); }
      else if (e.key === 'F6') { e.preventDefault(); onSwitchType?.('receipt'); }
      else if (e.key === 'F9') { e.preventDefault(); onSwitchType?.('purchase'); }
      else if (e.key === 'F4') { e.preventDefault(); onSwitchType?.('contra'); }
      else if (e.key === 'F12') { e.preventDefault(); setShowF12((v) => !v); }
      else if (alt && e.key.toLowerCase() === 'i') { e.preventDefault(); setInvoiceMode((m) => m === 'item' ? 'accounting' : 'item'); }
      else if (ctrl && e.key.toLowerCase() === 'v') { e.preventDefault(); setInvoiceMode((m) => m === 'voucher' ? 'item' : 'voucher'); }
      else if (ctrl && e.key.toLowerCase() === 't') { e.preventDefault(); setIsPostDated((v) => !v); }
      else if (ctrl && e.key.toLowerCase() === 'l') { e.preventDefault(); setIsOptional((v) => !v); }
      else if (ctrl && (e.key.toLowerCase() === 'a' || e.key === 'Enter')) { e.preventDefault(); handleAccept(); }
      else if (e.key === 'Escape') { e.preventDefault(); resetForm(); }
      else if (alt && e.key.toLowerCase() === 'd') { e.preventDefault(); toast('Delete not available for new vouchers.'); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [handleAccept, onSwitchType]);

  const drLabel = drCrNotation ? 'Dr' : 'By';
  const crLabel = drCrNotation ? 'Cr' : 'To';

  const godownOptions = warehouses.map((w: any) => ({ id: w.id, name: w.name }));

  // ── Render ──
  return (
    <div className="tally-shell flex flex-col h-full w-full overflow-hidden">
      {/* Title bar */}
      <div className="tally-titlebar flex items-center justify-between px-4 py-1.5">
        <span className="text-sm font-bold tracking-wide flex items-center gap-2">
          <ShoppingCart size={15} />
          Sales Voucher · F8
          {isPostDated && <span className="tally-badge-post-dated ml-2">Post-Dated</span>}
          {isOptional && <span className="tally-badge-optional ml-1">Optional</span>}
        </span>
        <span className="text-xs">{companySettings?.companyNameEn || 'My Company'}</span>
      </div>

      {/* Hotkey strip */}
      <div className="tally-header flex flex-wrap items-center gap-2 px-3 py-1">
        {[['F4','Contra'],['F5','Payment'],['F6','Receipt'],['F7','Journal'],['F8','Sales'],['F9','Purchase']].map(([k,l]) => (
          <button key={k} className={`tally-hint ${l === 'Sales' ? 'tally-btn-primary' : ''}`}
            onClick={() => l !== 'Sales' && onSwitchType?.(l.toLowerCase())}>
            {k}: {l}
          </button>
        ))}
        <button className="tally-hint" onClick={() => setInvoiceMode((m) => m === 'item' ? 'accounting' : 'item')}>
          Alt+I: {invoiceMode === 'item' ? 'Item→Acctg' : 'Acctg→Item'}
        </button>
        <button className="tally-hint" onClick={() => setInvoiceMode((m) => m === 'voucher' ? 'item' : 'voucher')}>
          Ctrl+V: {invoiceMode === 'voucher' ? 'Invoice' : 'Voucher'}
        </button>
        <button className="tally-hint" onClick={() => setShowF12(true)}>F12: Config</button>
      </div>

      {/* Mode tabs */}
      <div className="tally-mode-tabs">
        <button className={`tally-mode-tab ${invoiceMode === 'item' ? 'active' : ''}`} onClick={() => setInvoiceMode('item')}>
          Item Invoice (Alt+I)
        </button>
        <button className={`tally-mode-tab ${invoiceMode === 'accounting' ? 'active' : ''}`} onClick={() => setInvoiceMode('accounting')}>
          Accounting Invoice
        </button>
        <button className={`tally-mode-tab ${invoiceMode === 'voucher' ? 'active' : ''}`} onClick={() => setInvoiceMode('voucher')}>
          As Voucher (Ctrl+V)
        </button>
      </div>

      {/* Voucher class strip */}
      <VoucherClassStrip
        classes={voucherClasses}
        activeId={activeClassId}
        onSelect={(cls) => {
          setActiveClassId(cls.id);
          setSalesLedger({ id: cls.defaultAccountId, name: cls.defaultAccountName });
        }}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Meta strip */}
          <div className="tally-meta grid grid-cols-2 md:grid-cols-4 gap-3 px-3 py-2">
            <label className="flex flex-col gap-0.5">
              <span className="tally-label">Voucher No</span>
              <input className="tally-input" value="(auto)" readOnly tabIndex={-1} />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="tally-label">Date (AD)</span>
              <input type="date" className="tally-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="tally-label">Date (BS)</span>
              <input className="tally-input" value={(() => { try { return ADToBSString(date); } catch { return ''; } })()} readOnly tabIndex={-1} />
            </label>
            {f12Config.showReference && (
              <label className="flex flex-col gap-0.5">
                <span className="tally-label">Reference</span>
                <input className="tally-input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Invoice / PO ref" />
              </label>
            )}
          </div>

          {/* Party field (Item & Accounting modes) */}
          {invoiceMode !== 'voucher' && (
            <div className="tally-meta px-3 py-2 border-t border-[var(--t-line-soft)]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="flex flex-col gap-0.5">
                  <span className="tally-label tally-required">Party A/c Name *</span>
                  <LedgerSelect
                    value={partyId}
                    accounts={accounts}
                    onChange={(id, name) => { setPartyId(id); setPartyName(name); }}
                    placeholder="Customer ledger…"
                  />
                </label>
                {f12Config.showGST && (
                  <label className="flex flex-col gap-0.5">
                    <span className="tally-label">Place of Supply</span>
                    <input className="tally-input" value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} placeholder="State / UT" />
                  </label>
                )}
              </div>
              {/* Dispatch details */}
              {f12Config.showDispatchDetails && (
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <label className="flex flex-col gap-0.5">
                    <span className="tally-label">Transporter</span>
                    <input className="tally-input" value={dispatchDetails.transporter} onChange={(e) => setDispatchDetails((p) => ({ ...p, transporter: e.target.value }))} />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="tally-label">Vehicle No</span>
                    <input className="tally-input" value={dispatchDetails.vehicleNo} onChange={(e) => setDispatchDetails((p) => ({ ...p, vehicleNo: e.target.value }))} />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="tally-label">LR Number</span>
                    <input className="tally-input" value={dispatchDetails.lrNo} onChange={(e) => setDispatchDetails((p) => ({ ...p, lrNo: e.target.value }))} />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* ── ITEM INVOICE MODE ── */}
          {invoiceMode === 'item' && (
            <div className="flex-1 overflow-auto px-3 py-2">
              <table className="tally-grid tally-item-grid">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>#</th>
                    <th>Name of Item</th>
                    <th style={{ width: 120 }}>Godown</th>
                    <th className="col-qty" style={{ width: 72 }}>Qty</th>
                    <th style={{ width: 64 }}>Unit</th>
                    <th className="col-rate" style={{ width: 100 }}>Rate</th>
                    <th style={{ width: 56 }}>Per</th>
                    <th className="col-amount" style={{ width: 110 }}>Amount</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {itemLines.map((l, i) => (
                    <tr key={l.id}>
                      <td className="text-center text-[11px]">{i + 1}</td>
                      <td>
                        <ItemSelect
                          value={l.itemId || ''}
                          items={items}
                          onChange={(id, name, rate, unit) => updateItemLine(i, { itemId: id, itemName: name, rate, unit, perUnit: unit })}
                        />
                      </td>
                      <td>
                        <select className="tally-input" value={l.godownId || ''} onChange={(e) => {
                          const g = godownOptions.find((w: any) => w.id === e.target.value);
                          updateItemLine(i, { godownId: e.target.value, godownName: g?.name || '' });
                        }}>
                          <option value="">Main</option>
                          {godownOptions.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </td>
                      <td><input type="number" className="tally-input text-right" value={l.qty || ''} onChange={(e) => updateItemLine(i, { qty: parseMoney(e.target.value) })} /></td>
                      <td>
                        <input className="tally-input" value={l.unit} onChange={(e) => updateItemLine(i, { unit: e.target.value })} style={{ width: 56 }} />
                      </td>
                      <td><input type="number" className="tally-input text-right" value={l.rate || ''} onChange={(e) => updateItemLine(i, { rate: parseMoney(e.target.value) })} /></td>
                      <td><input className="tally-input" value={l.perUnit} onChange={(e) => updateItemLine(i, { perUnit: e.target.value })} style={{ width: 48 }} /></td>
                      <td className="cell-dr"><input type="number" className="tally-input text-right" value={l.amount || ''} readOnly /></td>
                      <td className="text-center">
                        {itemLines.length > 1 && (
                          <button className="tally-btn py-0.5 px-1" onClick={() => removeItemLine(i)}>
                            <Trash2 size={11} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="tally-btn text-xs mt-2" onClick={() => setItemLines((p) => [...p, blankItemLine()])}>
                <Plus size={11} className="inline mr-1" />Add Item
              </button>

              {/* Sales ledger + tax rows */}
              <div className="mt-3 border-t border-[var(--t-line-soft)] pt-2">
                <div className="flex gap-3 items-end">
                  <label className="flex flex-col gap-0.5 w-64">
                    <span className="tally-label">Sales Ledger</span>
                    <LedgerSelect
                      value={salesLedger.id}
                      accounts={accounts}
                      onChange={(id, name) => setSalesLedger({ id, name })}
                      placeholder="Sales account…"
                    />
                  </label>
                  <span className="tally-dr font-bold text-sm">{formatMoney(itemSubTotal)}</span>
                </div>
                {/* Tax rows */}
                {taxLines.map((t, i) => (
                  <div key={t.id} className="flex gap-3 items-end mt-1">
                    <label className="flex flex-col gap-0.5 w-48">
                      <span className="tally-label">Tax Ledger</span>
                      <LedgerSelect value={t.accountId} accounts={accounts} onChange={(id, name) => setTaxLines((p) => p.map((r, idx) => idx === i ? { ...r, accountId: id, accountName: name } : r))} />
                    </label>
                    <label className="flex flex-col gap-0.5 w-20">
                      <span className="tally-label">Rate %</span>
                      <input type="number" className="tally-input text-right" value={t.rate} onChange={(e) => setTaxLines((p) => p.map((r, idx) => idx === i ? { ...r, rate: parseMoney(e.target.value), amount: round2(itemSubTotal * parseMoney(e.target.value) / 100) } : r))} />
                    </label>
                    <span className="tally-dr font-bold text-sm">{formatMoney(t.amount)}</span>
                    <button className="tally-btn py-0.5 px-1" onClick={() => setTaxLines((p) => p.filter((_, idx) => idx !== i))}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
                <button className="tally-btn text-xs mt-1" onClick={() => setTaxLines((p) => [...p, { id: cryptoRandomId(), accountId: '', accountName: '', rate: 13, amount: round2(itemSubTotal * 0.13) }])}>
                  + Add Tax Row
                </button>
              </div>

              {/* Totals panel */}
              <div className="flex justify-end mt-3">
                <div className="tally-totals-panel">
                  <div className="row"><span>Sub Total</span><span className="tally-dr">{formatMoney(itemSubTotal)}</span></div>
                  <div className="row"><span>Tax Amount</span><span className="tally-dr">{formatMoney(taxTotal)}</span></div>
                  <div className="row grand"><span>Grand Total</span><span className="tally-dr">{formatMoney(grandTotal)}</span></div>
                </div>
              </div>

              {/* Bill-wise */}
              {f12Config.showBillWise && partyId && grandTotal > 0 && (
                <div className="mt-2">
                  <button className="tally-btn text-xs" onClick={() => { setBillWisePartyId(partyId); setBillWiseAmount(grandTotal); }}>
                    <FileText size={11} className="inline mr-1" />Bill-wise Details
                    {billWiseData.length > 0 && <span className="ml-1 tally-badge-post-dated">{billWiseData.length} bills</span>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── ACCOUNTING INVOICE MODE ── */}
          {invoiceMode === 'accounting' && (
            <div className="flex-1 overflow-auto px-3 py-2">
              <table className="tally-grid">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Particulars (Service Ledger)</th>
                    <th style={{ width: 140, textAlign: 'right' }}>Amount</th>
                    <th style={{ width: 180 }}>Narration</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {acctLines.map((l, i) => (
                    <tr key={l.id}>
                      <td className="text-center text-[11px]">{i + 1}</td>
                      <td>
                        <LedgerSelect value={l.accountId} accounts={accounts} onChange={(id, name) => setAcctLines((p) => p.map((r, idx) => idx === i ? { ...r, accountId: id, accountName: name } : r))} />
                      </td>
                      <td className="cell-cr">
                        <input type="number" className="tally-input text-right" value={l.amount || ''} onChange={(e) => setAcctLines((p) => p.map((r, idx) => idx === i ? { ...r, amount: parseMoney(e.target.value) } : r))} />
                      </td>
                      <td>
                        {f12Config.showNarrationPerEntry && (
                          <input className="tally-input" value={l.narration || ''} onChange={(e) => setAcctLines((p) => p.map((r, idx) => idx === i ? { ...r, narration: e.target.value } : r))} placeholder="Line narration…" />
                        )}
                      </td>
                      <td className="text-center">
                        {acctLines.length > 1 && (
                          <button className="tally-btn py-0.5 px-1" onClick={() => setAcctLines((p) => p.filter((_, idx) => idx !== i))}>
                            <Trash2 size={11} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="tally-btn text-xs mt-2" onClick={() => setAcctLines((p) => [...p, { id: cryptoRandomId(), accountId: '', accountName: '', amount: 0, narration: '' }])}>
                <Plus size={11} className="inline mr-1" />Add Row
              </button>
              <div className="flex justify-end mt-3">
                <div className="tally-totals-panel">
                  <div className="row grand"><span>Total</span><span className="tally-dr">{formatMoney(acctTotal)}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* ── AS VOUCHER MODE ── */}
          {invoiceMode === 'voucher' && (
            <div className="flex-1 overflow-auto px-3 py-2">
              <table className="tally-grid">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th style={{ width: 64 }}>{drLabel}/{crLabel}</th>
                    <th>Particulars</th>
                    <th style={{ width: 150, textAlign: 'right' }}>Amount</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {vLines.map((l, i) => (
                    <tr key={l.id}>
                      <td className="text-center">{i + 1}</td>
                      <td>
                        <select className="tally-input" value={l.drcr} onChange={(e) => setVLines((p) => p.map((r, idx) => idx === i ? { ...r, drcr: e.target.value } : r))}>
                          <option value="dr">{drLabel}</option>
                          <option value="cr">{crLabel}</option>
                        </select>
                      </td>
                      <td>
                        <LedgerSelect value={l.accountId} accounts={accounts} onChange={(id, name) => setVLines((p) => p.map((r, idx) => idx === i ? { ...r, accountId: id, accountName: name } : r))} />
                      </td>
                      <td className={l.drcr === 'dr' ? 'cell-dr' : 'cell-cr'}>
                        <input type="number" className="tally-input text-right" value={l.amount || ''} onChange={(e) => setVLines((p) => p.map((r, idx) => idx === i ? { ...r, amount: parseMoney(e.target.value) } : r))} />
                      </td>
                      <td className="text-center">
                        {vLines.length > 1 && (
                          <button className="tally-btn py-0.5 px-1" onClick={() => setVLines((p) => p.filter((_, idx) => idx !== i))}>
                            <Trash2 size={11} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="tally-btn text-xs mt-2" onClick={() => setVLines((p) => [...p, { id: cryptoRandomId(), drcr: 'dr', accountId: '', accountName: '', amount: 0 }])}>
                <Plus size={11} className="inline mr-1" />Add Row
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="tally-footer px-3 py-2 flex items-center justify-between no-print">
            <label className="flex flex-col gap-0.5 w-1/2">
              <span className="tally-label">Narration</span>
              <input className="tally-input" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Being…" />
            </label>
            <div className="flex gap-3 text-sm">
              <div className="flex flex-col items-end">
                <span className="tally-label text-[10px]">Total Dr</span>
                <span className="tally-dr">{formatMoney(invoiceMode === 'item' ? grandTotal : invoiceMode === 'accounting' ? acctTotal : vLines.filter((l) => l.drcr === 'dr').reduce((s, l) => s + l.amount, 0))}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="tally-label text-[10px]">Total Cr</span>
                <span className="tally-cr">{formatMoney(invoiceMode === 'item' ? grandTotal : invoiceMode === 'accounting' ? acctTotal : vLines.filter((l) => l.drcr === 'cr').reduce((s, l) => s + l.amount, 0))}</span>
              </div>
            </div>
          </div>
          <div className="tally-amount-words">
            {amountInWords(invoiceMode === 'item' ? grandTotal : invoiceMode === 'accounting' ? acctTotal : vLines.filter((l) => l.drcr === 'dr').reduce((s, l) => s + l.amount, 0))}
          </div>
        </div>

        {/* Right bar */}
        <div className="tally-right-bar w-[130px] p-2 flex flex-col gap-2 no-print">
          <button className="tally-btn tally-btn-primary" onClick={handleAccept}><Save size={12} /> Ctrl+A: Save</button>
          <button className="tally-btn" onClick={() => setShowF12(true)}><Settings size={12} /> F12: Config</button>
          <button className={`tally-btn ${isPostDated ? 'tally-btn-primary' : ''}`} onClick={() => setIsPostDated((v) => !v)}>Ctrl+T: Post-Date</button>
          <button className={`tally-btn ${isOptional ? 'tally-btn-primary' : ''}`} onClick={() => setIsOptional((v) => !v)}>Ctrl+L: Optional</button>
          <button className="tally-btn" onClick={resetForm}>Esc: Clear</button>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="tally-bottom-bar px-3 py-1 flex flex-wrap items-center gap-2 no-print">
        <span className="tally-hint">Ctrl+A: Accept</span>
        <span className="tally-hint">Esc: Clear</span>
        <span className="tally-hint">F12: Configure</span>
        <span className="tally-hint">Alt+I: Toggle Mode</span>
        <span className="tally-hint">Ctrl+V: As Voucher</span>
        <span className="tally-hint">Ctrl+T: Post-Date</span>
        <span className="tally-hint">Ctrl+L: Optional</span>
      </div>

      {/* F12 config modal */}
      {showF12 && (
        <TallyVoucherConfig
          voucherType="sales"
          config={f12Config}
          onChange={(cfg) => { setF12Config(cfg); setInvoiceMode(cfg.invoiceMode as InvoiceMode); }}
          onClose={() => setShowF12(false)}
        />
      )}

      {/* Bill-wise modal */}
      {billWisePartyId && (
        <BillWiseModal
          initial={billWiseData}
          partyId={billWisePartyId}
          amount={billWiseAmount}
          invoices={invoices}
          onSave={(rows) => { setBillWiseData(rows); setBillWisePartyId(null); }}
          onClose={() => setBillWisePartyId(null)}
        />
      )}
    </div>
  );
};

export default TallySalesVoucher;
