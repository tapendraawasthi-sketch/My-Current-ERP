// @ts-nocheck
/**
 * TallyVoucherEntry — Tally Prime–style voucher entry for the lite-green ERP.
 *
 * One component drives all four accounting vouchers exactly like Tally Prime:
 *   F4 Contra · F5 Payment · F6 Receipt · F7 Journal
 *
 * Faithful to the PDF "Tally Prime Voucher Entry Interface" spec:
 *   • Title bar + voucher-type band + hot-key strip (top)
 *   • Meta strip: Voucher No, Date (AD), Date (BS), Reference
 *   • Single Entry  ⇄  Double Entry toggle (Ctrl+H)         [Payment/Receipt/Contra]
 *   • By/Dr · To/Cr notation toggle (F12)                    [Journal]
 *   • Entry grid with live Dr/Cr totals + amount in words
 *   • Bank Allocation popup (Cheque/NEFT/RTGS/IMPS/UPI…)
 *   • Bill-wise Details popup (against-ref / advance / on-account)
 *   • Cash Denomination popup (₹2000…₹1) with difference tracker
 *   • Right button bar + bottom hot-key bar
 *
 * It persists through the REAL store action `addVoucher`, so saved vouchers
 * appear in every existing register/report. No new dependencies.
 */
 
import React, { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { X, Save, Trash2, Plus, Banknote, FileText, Landmark, Calculator } from "lucide-react";
import { useStore } from "@/store/useStore";
import { ADToBSString } from "@/lib/nepaliDate";
import { formatMoney, parseMoney, amountInWords } from "@/lib/tallyFormat";
 
/* ────────────────────────────────────────────────────────────────────────── */
/* Config per voucher type                                                     */
/* ────────────────────────────────────────────────────────────────────────── */
 
type TallyType = "journal" | "payment" | "receipt" | "contra";
 
const TYPE_META: Record<
  TallyType,
  { label: string; hot: string; primaryLabel: string; supportsSingle: boolean }
> = {
  contra:  { label: "Contra Voucher",  hot: "F4", primaryLabel: "Account (Cash/Bank)",  supportsSingle: true },
  payment: { label: "Payment Voucher", hot: "F5", primaryLabel: "Account (paid from)",  supportsSingle: true },
  receipt: { label: "Receipt Voucher", hot: "F6", primaryLabel: "Account (received in)", supportsSingle: true },
  journal: { label: "Journal Voucher", hot: "F7", primaryLabel: "",                       supportsSingle: false },
};
 
const TRANSACTION_TYPES = [
  "Cheque", "e-Fund Transfer", "NEFT", "RTGS", "ECS", "IMPS", "UPI", "Debit Card", "Credit Card",
];
 
const DENOMINATIONS = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
 
const todayAD = () => new Date().toISOString().slice(0, 10);
const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
 
interface Line {
  id: string;
  accountId: string;
  accountName: string;
  drcr: "dr" | "cr";
  amount: number;
  narration?: string;
  bankAllocation?: any;
  billWise?: any[];
  denominations?: { denom: number; count: number }[];
}
 
const blankLine = (drcr: "dr" | "cr" = "dr"): Line => ({
  id: uid(), accountId: "", accountName: "", drcr, amount: 0, narration: "",
});
 
/* ────────────────────────────────────────────────────────────────────────── */
/* Account select (datalist — native, zero-dep, keyboard friendly)            */
/* ────────────────────────────────────────────────────────────────────────── */
 
const LedgerSelect: React.FC<{
  value: string;
  accounts: any[];
  onChange: (id: string, name: string) => void;
  onFocus?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}> = ({ value, accounts, onChange, onFocus, autoFocus, placeholder }) => {
  const ledgers = useMemo(() => accounts.filter((a) => !a.isGroup), [accounts]);
  const current = ledgers.find((a) => a.id === value);
  const [text, setText] = useState(current?.name || "");
 
  React.useEffect(() => {
    const c = ledgers.find((a) => a.id === value);
    setText(c?.name || "");
  }, [value, ledgers]);
 
  const listId = useMemo(() => `ledgers-${uid()}`, []);
  const commit = (name: string) => {
    const hit = ledgers.find((a) => a.name.toLowerCase() === name.trim().toLowerCase());
    if (hit) onChange(hit.id, hit.name);
    else onChange("", name);
  };
 
  return (
    <>
      <input
        className="tally-input"
        list={listId}
        value={text}
        autoFocus={autoFocus}
        placeholder={placeholder || "Select ledger…"}
        onFocus={onFocus}
        onChange={(e) => { setText(e.target.value); commit(e.target.value); }}
      />
      <datalist id={listId}>
        {ledgers.map((a) => (
          <option key={a.id} value={a.name}>{a.code ? `${a.code} · ${a.type}` : a.type}</option>
        ))}
      </datalist>
    </>
  );
};
 
/* ────────────────────────────────────────────────────────────────────────── */
/* Popup: Bank Allocation                                                      */
/* ────────────────────────────────────────────────────────────────────────── */
 
const BankAllocationModal: React.FC<{
  initial?: any; amount: number; onSave: (a: any) => void; onClose: () => void;
}> = ({ initial, amount, onSave, onClose }) => {
  const [a, setA] = useState(() => ({
    transactionType: initial?.transactionType || "Cheque",
    instrumentNumber: initial?.instrumentNumber || "",
    instrumentDate: initial?.instrumentDate || todayAD(),
    favouring: initial?.favouring || "",
    bankDate: initial?.bankDate || "",
    status: initial?.status || "Not Reconciled",
    remarks: initial?.remarks || "",
    amount: initial?.amount ?? amount,
  }));
  const set = (k: string, v: any) => setA((p) => ({ ...p, [k]: v }));
  return (
    <div className="tally-modal-overlay" onClick={onClose}>
      <div className="tally-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tally-modal-head"><span><Landmark size={14} className="inline mr-1" /> Bank Allocation</span><button onClick={onClose}><X size={16} /></button></div>
        <div className="tally-modal-body grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1"><span className="tally-label">Transaction Type</span>
            <select className="tally-input" value={a.transactionType} onChange={(e) => set("transactionType", e.target.value)}>
              {TRANSACTION_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select></label>
          <label className="flex flex-col gap-1"><span className="tally-label">Instrument No.</span>
            <input className="tally-input" value={a.instrumentNumber} onChange={(e) => set("instrumentNumber", e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className="tally-label">Instrument Date</span>
            <input type="date" className="tally-input" value={a.instrumentDate} onChange={(e) => set("instrumentDate", e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className="tally-label">Favouring Name</span>
            <input className="tally-input" value={a.favouring} onChange={(e) => set("favouring", e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className="tally-label">Bank Date</span>
            <input type="date" className="tally-input" value={a.bankDate} onChange={(e) => set("bankDate", e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className="tally-label">Bank Status</span>
            <select className="tally-input" value={a.status} onChange={(e) => set("status", e.target.value)}>
              <option>Not Reconciled</option><option>Reconciled</option>
            </select></label>
          <label className="flex flex-col gap-1"><span className="tally-label">Amount</span>
            <input type="number" className="tally-input text-right" value={a.amount} onChange={(e) => set("amount", parseMoney(e.target.value))} /></label>
          <label className="flex flex-col gap-1 col-span-2"><span className="tally-label">Remarks</span>
            <input className="tally-input" value={a.remarks} onChange={(e) => set("remarks", e.target.value)} /></label>
        </div>
        <div className="flex justify-end gap-2 p-3 no-print">
          <button className="tally-btn" onClick={onClose}>Cancel</button>
          <button className="tally-btn tally-btn-primary" onClick={() => { onSave(a); onClose(); }}><Save size={13} className="inline mr-1" />Accept</button>
        </div>
      </div>
    </div>
  );
};
 
/* ────────────────────────────────────────────────────────────────────────── */
/* Popup: Bill-wise Details                                                    */
/* ────────────────────────────────────────────────────────────────────────── */
 
const BillWiseModal: React.FC<{
  initial?: any[]; partyId: string; amount: number; invoices: any[];
  onSave: (rows: any[]) => void; onClose: () => void;
}> = ({ initial, partyId, amount, invoices, onSave, onClose }) => {
  const partyInvoices = useMemo(
    () => (invoices || []).filter((i) => (i.partyId === partyId || i.accountId === partyId) && (i.balanceDue ?? i.grandTotal ?? 0) !== 0),
    [invoices, partyId],
  );
  const [rows, setRows] = useState<any[]>(() =>
    initial && initial.length
      ? initial
      : [{ id: uid(), method: "New Reference", refNo: "", refDate: todayAD(), amount }],
  );
  const set = (i: number, k: string, v: any) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const diff = round2(amount - total);
  return (
    <div className="tally-modal-overlay" onClick={onClose}>
      <div className="tally-modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="tally-modal-head"><span><FileText size={14} className="inline mr-1" /> Bill-wise Details</span><button onClick={onClose}><X size={16} /></button></div>
        <div className="tally-modal-body">
          <table>
            <thead><tr><th>Method</th><th>Reference</th><th>Date</th><th style={{ textAlign: "right" }}>Amount</th><th></th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td>
                    <select className="tally-input" value={r.method} onChange={(e) => set(i, "method", e.target.value)}>
                      <option>New Reference</option><option>Against Reference</option><option>Advance</option><option>On Account</option>
                    </select>
                  </td>
                  <td>
                    {r.method === "Against Reference" && partyInvoices.length ? (
                      <select className="tally-input" value={r.refNo} onChange={(e) => set(i, "refNo", e.target.value)}>
                        <option value="">Select bill…</option>
                        {partyInvoices.map((iv) => <option key={iv.id} value={iv.invoiceNo || iv.voucherNo}>{iv.invoiceNo || iv.voucherNo}</option>)}
                      </select>
                    ) : (
                      <input className="tally-input" value={r.refNo} onChange={(e) => set(i, "refNo", e.target.value)} />
                    )}
                  </td>
                  <td><input type="date" className="tally-input" value={r.refDate} onChange={(e) => set(i, "refDate", e.target.value)} /></td>
                  <td><input type="number" className="tally-input text-right" value={r.amount} onChange={(e) => set(i, "amount", parseMoney(e.target.value))} /></td>
                  <td style={{ textAlign: "center" }}>
                    <button className="tally-btn" onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between mt-2">
            <button className="tally-btn" onClick={() => setRows((p) => [...p, { id: uid(), method: "New Reference", refNo: "", refDate: todayAD(), amount: diff > 0 ? diff : 0 }])}><Plus size={12} className="inline mr-1" />Add Bill</button>
            <span className={`tally-total-box ${Math.abs(diff) > 0.001 ? "tally-cr" : "tally-dr"}`}>Allocated {formatMoney(total)} · Diff {formatMoney(diff)}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-3 no-print">
          <button className="tally-btn" onClick={onClose}>Cancel</button>
          <button className="tally-btn tally-btn-primary" onClick={() => { onSave(rows); onClose(); }}><Save size={13} className="inline mr-1" />Accept</button>
        </div>
      </div>
    </div>
  );
};
 
/* ────────────────────────────────────────────────────────────────────────── */
/* Popup: Cash Denomination                                                    */
/* ────────────────────────────────────────────────────────────────────────── */
 
const DenominationModal: React.FC<{
  initial?: any[]; amount: number; onSave: (rows: any[]) => void; onClose: () => void;
}> = ({ initial, amount, onSave, onClose }) => {
  const [counts, setCounts] = useState<Record<number, number>>(() => {
    const m: Record<number, number> = {};
    (initial || []).forEach((r) => (m[r.denom] = r.count));
    return m;
  });
  const total = DENOMINATIONS.reduce((s, d) => s + d * (counts[d] || 0), 0);
  const diff = round2(amount - total);
  return (
    <div className="tally-modal-overlay" onClick={onClose}>
      <div className="tally-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tally-modal-head"><span><Calculator size={14} className="inline mr-1" /> Cash Denomination</span><button onClick={onClose}><X size={16} /></button></div>
        <div className="tally-modal-body">
          <table>
            <thead><tr><th>Denomination</th><th style={{ textAlign: "center" }}>No. of Notes</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
            <tbody>
              {DENOMINATIONS.map((d) => (
                <tr key={d}>
                  <td>Rs. {d}</td>
                  <td style={{ textAlign: "center" }}>
                    <input type="number" min={0} className="tally-input text-right" style={{ width: 90, margin: "0 auto" }}
                      value={counts[d] || ""} onChange={(e) => setCounts((p) => ({ ...p, [d]: Math.max(0, parseInt(e.target.value || "0", 10)) }))} />
                  </td>
                  <td style={{ textAlign: "right" }}>{formatMoney(d * (counts[d] || 0))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th>Total</th><th></th><th style={{ textAlign: "right" }}>{formatMoney(total)}</th></tr>
              <tr><th className={Math.abs(diff) > 0.001 ? "tally-cr" : "tally-dr"}>Difference</th><th></th><th style={{ textAlign: "right" }}>{formatMoney(diff)}</th></tr>
            </tfoot>
          </table>
        </div>
        <div className="flex justify-end gap-2 p-3 no-print">
          <button className="tally-btn" onClick={onClose}>Cancel</button>
          <button className="tally-btn tally-btn-primary"
            onClick={() => { onSave(DENOMINATIONS.map((d) => ({ denom: d, count: counts[d] || 0 })).filter((r) => r.count > 0)); onClose(); }}>
            <Save size={13} className="inline mr-1" />Accept
          </button>
        </div>
      </div>
    </div>
  );
};
 
/* ────────────────────────────────────────────────────────────────────────── */
/* Main component                                                              */
/* ────────────────────────────────────────────────────────────────────────── */
 
interface Props {
  type: TallyType;
  /** optional: let the page switch type when F4/F5/F6/F7 is pressed */
  onSwitchType?: (t: TallyType) => void;
}
 
const TallyVoucherEntry: React.FC<Props> = ({ type, onSwitchType }) => {
  const store = useStore();
  const { accounts = [], parties = [], invoices = [], companySettings } = store as any;
  const symbol = companySettings?.currencySymbol || "Rs.";
  const meta = TYPE_META[type];
 
  const [singleEntry, setSingleEntry] = useState(meta.supportsSingle);
  const [drCrNotation, setDrCrNotation] = useState(false); // false → By/To, true → Dr/Cr
  const [date, setDate] = useState(todayAD());
  const [reference, setReference] = useState("");
  const [narration, setNarration] = useState("");
  const [primaryAccount, setPrimaryAccount] = useState({ id: "", name: "" }); // single-entry header
  const [lines, setLines] = useState<Line[]>([blankLine("dr"), blankLine("cr")]);
  const [activeCell, setActiveCell] = useState<{ row: number; col: string }>({ row: 0, col: "account" });

  const [isOptional, setIsOptional] = useState(false);
  const [isPostDated, setIsPostDated] = useState(false);
  const { currentPage, setCurrentPage } = store as any;

  const resolved =
    currentPage === "payment"
      ? "payment"
      : currentPage === "receipt"
        ? "receipt"
        : currentPage === "contra"
          ? "contra"
          : "journal";
 
  // popups
  const [bankIdx, setBankIdx] = useState<number | null>(null);
  const [billIdx, setBillIdx] = useState<number | null>(null);
  const [denomIdx, setDenomIdx] = useState<number | null>(null);
 
  /* ── derived totals ── */
  const totalDr = useMemo(() => {
    if (singleEntry) {
      const body = lines.reduce((s, l) => s + (l.amount || 0), 0);
      return type === "payment" || type === "contra" ? body : body; // primary is opposite side
    }
    return lines.filter((l) => l.drcr === "dr").reduce((s, l) => s + (l.amount || 0), 0);
  }, [lines, singleEntry, type]);
 
  const totalCr = useMemo(() => {
    if (singleEntry) {
      const body = lines.reduce((s, l) => s + (l.amount || 0), 0);
      return body;
    }
    return lines.filter((l) => l.drcr === "cr").reduce((s, l) => s + (l.amount || 0), 0);
  }, [lines, singleEntry]);
 
  const bodyTotal = useMemo(() => lines.reduce((s, l) => s + (l.amount || 0), 0), [lines]);
  const balanced = singleEntry ? bodyTotal > 0 : Math.abs(totalDr - totalCr) < 0.001 && totalDr > 0;
 
  const drLabel = drCrNotation ? "Dr" : "By";
  const crLabel = drCrNotation ? "Cr" : "To";
 
  /* ── line helpers ── */
  const updateLine = useCallback((i: number, patch: Partial<Line>) =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l))), []);
  const addLine = useCallback((drcr: "dr" | "cr" = "dr") => setLines((p) => [...p, blankLine(drcr)]), []);
  const removeLine = useCallback((i: number) =>
    setLines((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p)), []);
 
  const reset = useCallback(() => {
    setLines([blankLine("dr"), blankLine("cr")]);
    setPrimaryAccount({ id: "", name: "" });
    setReference(""); setNarration(""); setDate(todayAD());
    setActiveCell({ row: 0, col: "account" });
  }, []);
 
  /* ── build & persist (maps to the REAL store contract) ── */
  const handleAccept = useCallback(async () => {
    let storeLines: any[] = [];
 
    if (singleEntry) {
      if (!primaryAccount.id) { toast.error(`Select ${meta.primaryLabel}.`); return; }
      if (bodyTotal <= 0) { toast.error("Enter at least one amount."); return; }
      // Primary side: Payment/Contra credit the source; Receipt debits the destination.
      const primaryIsDebit = type === "receipt";
      const body = lines.filter((l) => l.accountId && l.amount > 0);
      if (!body.length) { toast.error("Add at least one particular ledger."); return; }
      storeLines = [
        ...body.map((l) => ({
          accountId: l.accountId, accountName: l.accountName,
          debit: primaryIsDebit ? 0 : round2(l.amount),
          credit: primaryIsDebit ? round2(l.amount) : 0,
          narration: l.narration, bankAllocation: l.bankAllocation, billWise: l.billWise, denominations: l.denominations,
        })),
        {
          accountId: primaryAccount.id, accountName: primaryAccount.name,
          debit: primaryIsDebit ? round2(bodyTotal) : 0,
          credit: primaryIsDebit ? 0 : round2(bodyTotal),
        },
      ];
    } else {
      if (!balanced) { toast.error("Debit and Credit totals must match."); return; }
      const body = lines.filter((l) => l.accountId && l.amount > 0);
      if (body.length < 2) { toast.error("Add at least one Dr and one Cr ledger."); return; }
      storeLines = body.map((l) => ({
        accountId: l.accountId, accountName: l.accountName,
        debit: l.drcr === "dr" ? round2(l.amount) : 0,
        credit: l.drcr === "cr" ? round2(l.amount) : 0,
        narration: l.narration, bankAllocation: l.bankAllocation, billWise: l.billWise, denominations: l.denominations,
      }));
    }
 
    const partyLine = storeLines.find((l) => /debtor|creditor|party|sundry/i.test(l.accountName || ""));
    try {
      await store.addVoucher({
        type,                          // "journal" | "payment" | "receipt" | "contra"
        date,
        dateNepali: (() => { try { return ADToBSString(date); } catch { return ""; } })(),
        referenceNo: reference,
        narration,
        partyName: partyLine?.accountName || primaryAccount.name || "",
        status: "posted",
        entryMode: singleEntry ? "single" : "double",
        lines: storeLines,
      });
      toast.success(`${meta.label} saved.`);
      reset();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save voucher.");
    }
  }, [singleEntry, primaryAccount, lines, bodyTotal, balanced, type, date, reference, narration, meta, store, reset]);
 
  /* ── global keyboard (Tally hot keys) ── */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      if (k === "F4") { e.preventDefault(); onSwitchType?.("contra"); }
      else if (k === "F5") { e.preventDefault(); onSwitchType?.("payment"); }
      else if (k === "F6") { e.preventDefault(); onSwitchType?.("receipt"); }
      else if (k === "F7") { e.preventDefault(); onSwitchType?.("journal"); }
      else if (k === "F12") { e.preventDefault(); setDrCrNotation((v) => !v); }
      else if (ctrl && k.toLowerCase() === "h") { e.preventDefault(); if (meta.supportsSingle) setSingleEntry((v) => !v); }
      else if (ctrl && (k.toLowerCase() === "a" || k === "Enter")) { e.preventDefault(); handleAccept(); }
      else if (k === "Escape") { e.preventDefault(); reset(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [handleAccept, reset, onSwitchType, meta.supportsSingle]);
 
  const isBankLedger = (name: string) => /bank/i.test(name);
  const isCashLedger = (name: string) => /cash/i.test(name);
  const isPartyLedger = (name: string) => /debtor|creditor|party|sundry/i.test(name);
 
  /* ────────────────────────────────────────────────────────────────── */
  return (
    <div className="tally-shell flex flex-col h-full w-full overflow-hidden">
      {/* Title bar */}
      <div className="tally-titlebar flex items-center justify-between px-4 py-1.5">
        <span className="text-sm font-bold tracking-wide">{meta.label}  ·  {meta.hot}</span>
        <span className="text-xs">{companySettings?.companyNameEn || companySettings?.name || "My Company"}</span>
      </div>
 
      {/* Hot-key strip */}
      <div className="tally-header flex flex-wrap items-center gap-2 px-3 py-1">
        {[["F4", "Contra"], ["F5", "Payment"], ["F6", "Receipt"], ["F7", "Journal"]].map(([k, l]) => (
          <button key={k} className={`tally-hint ${type === l.toLowerCase() ? "tally-btn-primary" : ""}`}
            onClick={() => onSwitchType?.(l.toLowerCase() as TallyType)}>{k}: {l}</button>
        ))}
        {meta.supportsSingle && (
          <button className="tally-hint" onClick={() => setSingleEntry((v) => !v)}>
            Ctrl+H: {singleEntry ? "As Voucher (Double)" : "Single Entry"}
          </button>
        )}
        <button className="tally-hint" onClick={() => setDrCrNotation((v) => !v)}>F12: {drCrNotation ? "Dr/Cr" : "By/To"}</button>
      </div>
 
      <div className="flex flex-1 overflow-hidden">
        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Meta strip */}
          <div className="tally-meta grid grid-cols-2 md:grid-cols-4 gap-3 px-3 py-2">
            <label className="flex flex-col gap-0.5"><span className="tally-label">Voucher No</span>
              <input className="tally-input" value="(auto)" readOnly tabIndex={-1} /></label>
            <label className="flex flex-col gap-0.5"><span className="tally-label">Date (AD)</span>
              <input type="date" className="tally-input" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label className="flex flex-col gap-0.5"><span className="tally-label">Date (BS)</span>
              <input className="tally-input" value={(() => { try { return ADToBSString(date); } catch { return ""; } })()} readOnly tabIndex={-1} /></label>
            <label className="flex flex-col gap-0.5"><span className="tally-label">Reference</span>
              <input className="tally-input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ref / Cheque No" /></label>
          </div>
 
          {/* Single-entry primary account */}
          {singleEntry && (
            <div className="tally-meta px-3 py-2 border-t border-[var(--t-line-soft)]">
              <label className="flex flex-col gap-0.5 max-w-md">
                <span className="tally-label">{meta.primaryLabel}</span>
                <LedgerSelect value={primaryAccount.id} accounts={accounts}
                  onChange={(id, name) => setPrimaryAccount({ id, name })} placeholder="Cash / Bank ledger…" />
              </label>
            </div>
          )}
 
          {/* Entry grid */}
          <div className="flex-1 overflow-auto px-3 py-2">
            <table className="tally-grid">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  {!singleEntry && <th style={{ width: 56 }}>{drLabel}/{crLabel}</th>}
                  <th>Particulars (Ledger)</th>
                  <th style={{ width: 150, textAlign: "right" }}>Amount</th>
                  <th style={{ width: 100, textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.id} className={activeCell.row === i ? "selected" : ""}>
                    <td className="text-center">{i + 1}</td>
                    {!singleEntry && (
                      <td className={activeCell.row === i && activeCell.col === "drcr" ? "active" : ""}>
                        <select className="tally-input" value={l.drcr}
                                onChange={(e) => updateLine(i, { drcr: e.target.value as any })}>
                          <option value="dr">{drLabel}</option>
                          <option value="cr">{crLabel}</option>
                        </select>
                      </td>
                    )}
                    <td className={activeCell.row === i && activeCell.col === "account" ? "active" : ""}>
                      <LedgerSelect value={l.accountId} accounts={accounts}
                        onChange={(id, name) => updateLine(i, { accountId: id, accountName: name })} />
                    </td>
                    <td className={activeCell.row === i && activeCell.col === "amount" ? "active" : ""}>
                      <input type="number" className="tally-input text-right" value={l.amount || ""}
                             onChange={(e) => updateLine(i, { amount: parseMoney(e.target.value) })} />
                    </td>
                    <td className="text-center">
                      {isBankLedger(l.accountName) && (
                        <button className="tally-btn py-0.5 px-2 text-xs" onClick={() => setBankIdx(i)}>Bank</button>
                      )}
                      {isCashLedger(l.accountName) && l.amount > 0 && (
                        <button className="tally-btn py-0.5 px-2 text-xs" onClick={() => setDenomIdx(i)}>Cash</button>
                      )}
                      {isPartyLedger(l.accountName) && l.amount > 0 && (
                        <button className="tally-btn py-0.5 px-2 text-xs" onClick={() => setBillIdx(i)}>Bill</button>
                      )}
                      {lines.length > 1 && (
                        <button className="tally-btn py-0.5 px-2 text-xs ml-1" onClick={() => removeLine(i)}><Trash2 size={12}/></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2">
              <button className="tally-btn text-xs" onClick={() => addLine()}>+ Add Row</button>
            </div>
          </div>

          {/* Footer (Totals & Narration) */}
          <div className="tally-footer px-3 py-2 flex items-center justify-between">
            <label className="flex flex-col gap-0.5 w-1/2">
              <span className="tally-label">Narration</span>
              <input className="tally-input" value={narration} onChange={(e) => setNarration(e.target.value)} />
            </label>
            <div className="flex gap-4 text-sm">
              <div className="flex flex-col items-end">
                <span className="tally-label text-[10px]">Total Dr</span>
                <span className="tally-dr">{formatMoney(totalDr)}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="tally-label text-[10px]">Total Cr</span>
                <span className="tally-cr">{formatMoney(totalCr)}</span>
              </div>
            </div>
          </div>
          <div className="px-3 py-1 bg-[var(--t-muted)] text-[10px] text-gray-700 italic border-t border-[var(--t-line-soft)]">
            {amountInWords(totalDr || totalCr)}
          </div>
        </div>

        {/* Right side panel (Actions) */}
        <div className="tally-right-bar w-[120px] p-2 flex flex-col gap-1 no-print">
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textAlign: "center",
              background: "#C9DEB5",
              border: "1px solid #000000",
              padding: "2px 4px",
              color: "#000000",
            }}
          >
            Voucher Type
          </div>

          {[
            { key: "F4", label: "Contra", page: "contra" },
            { key: "F5", label: "Payment", page: "payment" },
            { key: "F6", label: "Receipt", page: "receipt" },
            { key: "F7", label: "Journal", page: "journal" },
          ].map((item) => (
            <button
              key={item.page}
              type="button"
              className="tally-btn flex justify-between items-center"
              onClick={() => setCurrentPage(item.page)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                padding: "2px 4px",
                height: 20,
                fontWeight: resolved === item.page ? 700 : 500,
                background: resolved === item.page ? "#B8D89A" : undefined,
              }}
            >
              <span>{item.key}</span>
              <span>{item.label}</span>
            </button>
          ))}

          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textAlign: "center",
              background: "#C9DEB5",
              border: "1px solid #000000",
              padding: "2px 4px",
              color: "#000000",
              marginTop: 4,
            }}
          >
            Tools
          </div>

          <button
            type="button"
            className="tally-btn flex justify-between items-center"
            onClick={() => toast.success("Change mode: Single ↔ Double entry")}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              padding: "2px 4px",
              height: 20,
            }}
          >
            <span>Ctrl+H</span>
            <span>Mode</span>
          </button>

          <button
            type="button"
            className="tally-btn flex justify-between items-center"
            onClick={() => setIsOptional((prev) => !prev)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              padding: "2px 4px",
              height: 20,
              background: isOptional ? "#B8D89A" : undefined,
              fontWeight: isOptional ? 700 : 500,
            }}
          >
            <span>Ctrl+L</span>
            <span>Optional {isOptional ? "[ON]" : ""}</span>
          </button>

          <button
            type="button"
            className="tally-btn flex justify-between items-center"
            onClick={() => setIsPostDated((prev) => !prev)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              padding: "2px 4px",
              height: 20,
              background: isPostDated ? "#B8D89A" : undefined,
              fontWeight: isPostDated ? 700 : 500,
            }}
          >
            <span>Ctrl+T</span>
            <span>PostDated {isPostDated ? "[ON]" : ""}</span>
          </button>

          <button
            type="button"
            className="tally-btn flex justify-between items-center"
            onClick={() => setDrCrNotation(!drCrNotation)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              padding: "2px 4px",
              height: 20,
            }}
          >
            <span>F12</span>
            <span>Configure</span>
          </button>

          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textAlign: "center",
              background: "#C9DEB5",
              border: "1px solid #000000",
              padding: "2px 4px",
              color: "#000000",
              marginTop: 4,
            }}
          >
            Actions
          </div>

          <button
            type="button"
            className="tally-btn tally-btn-primary flex justify-between items-center"
            onClick={handleAccept}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              padding: "2px 4px",
              height: 20,
            }}
          >
            <span>F2</span>
            <span>Save</span>
          </button>

          <button
            type="button"
            className="tally-btn flex justify-between items-center"
            onClick={() => addLine()}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              padding: "2px 4px",
              height: 20,
            }}
          >
            <span>Ctrl+A</span>
            <span>Add Row</span>
          </button>

          <button
            type="button"
            className="tally-btn flex justify-between items-center"
            onClick={() => reset()}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              padding: "2px 4px",
              height: 20,
            }}
          >
            <span>Esc</span>
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="tally-bottom-bar px-3 py-1 flex items-center gap-3">
        <span className="text-[11px] font-semibold">Tally Prime Edition</span>
      </div>

      {/* Popups */}
      {bankIdx !== null && (
        <BankAllocationModal
          initial={lines[bankIdx].bankAllocation}
          amount={lines[bankIdx].amount}
          onSave={(a) => { updateLine(bankIdx, { bankAllocation: a }); setBankIdx(null); }}
          onClose={() => setBankIdx(null)}
        />
      )}

      {billIdx !== null && (
        <BillWiseModal
          initial={lines[billIdx].billWise}
          partyId={lines[billIdx].accountId}
          amount={lines[billIdx].amount}
          invoices={invoices}
          onSave={(w) => { updateLine(billIdx, { billWise: w }); setBillIdx(null); }}
          onClose={() => setBillIdx(null)}
        />
      )}

      {denomIdx !== null && (
        <DenominationModal
          initial={lines[denomIdx].denominations}
          amount={lines[denomIdx].amount}
          onSave={(d) => { updateLine(denomIdx, { denominations: d }); setDenomIdx(null); }}
          onClose={() => setDenomIdx(null)}
        />
      )}
    </div>
  );
};

export default TallyVoucherEntry;
