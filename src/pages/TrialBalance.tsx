import React, { useState, useMemo, useCallback, useRef } from "react";
import { useStore } from "../store/useStore";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import {
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Settings,
} from "lucide-react";

type TBVariant =
  | "closing-alphabetical"
  | "closing-groupwise"
  | "opening";

type DisplayMode = "balance-only" | "detailed";
type GroupFilter = "all" | "specific";

interface TBOptions {
  variant: TBVariant;
  fromDate: string;
  toDate: string;
  displayMode: DisplayMode;
  groupFilter: GroupFilter;
  selectedGroupId: string;
  showZeroBalance: boolean;
  showPercentage: boolean;
  showPrevYear: boolean;
  roundOff: boolean;
}

interface TBRow {
  id: string;
  name: string;
  code: string;
  type: "primary-group" | "sub-group" | "ledger";
  level: number;
  parentId?: string;
  debit: number;
  credit: number;
  openingDebit: number;
  openingCredit: number;
  txnDebit: number;
  txnCredit: number;
  prevYearDebit: number;
  prevYearCredit: number;
  children: TBRow[];
  hasChildren: boolean;
  accountType?: string;
}

interface DrillLevel {
  type: "tb" | "ledger" | "voucher";
  id?: string;
  name?: string;
  data?: any;
}

const today = () => new Date().toISOString().split("T")[0];

const isDebitNature = (type: string): boolean => {
  const t = (type || "").toLowerCase();
  return t === "asset" || t === "expense";
};

const money = (n: number, round = false) => {
  if (n === 0 || !n) return "—";
  const val = round ? Math.round(Math.abs(n)) : Math.abs(n);
  return val.toLocaleString("en-IN", {
    minimumFractionDigits: round ? 0 : 2,
    maximumFractionDigits: round ? 0 : 2,
  });
};

export default function TrialBalance() {
  const { accounts, vouchers, invoices, currentFiscalYear } = useStore();

  const [showOptions, setShowOptions] = useState(true);
  const [options, setOptions] = useState<TBOptions>({
    variant: "closing-groupwise",
    fromDate: currentFiscalYear?.startDate || today(),
    toDate: currentFiscalYear?.endDate || today(),
    displayMode: "balance-only",
    groupFilter: "all",
    selectedGroupId: "",
    showZeroBalance: true,
    showPercentage: false,
    showPrevYear: false,
    roundOff: false,
  });

  const [drillStack, setDrillStack] = useState<DrillLevel[]>([{ type: "tb" }]);
  const currentDrill = drillStack[drillStack.length - 1];

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [generated, setGenerated] = useState(false);

  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);

  const printRef = useRef<HTMLDivElement>(null);

  const setOpt = (key: keyof TBOptions, val: any) =>
    setOptions((prev) => ({ ...prev, [key]: val }));

  // ─── Compute voucher-based balances ────────────────────────────────────────
  const { accountBalances, accountTxn, accountOpening } = useMemo(() => {
    const balances: Record<string, { dr: number; cr: number }> = {};
    const txn: Record<string, { dr: number; cr: number }> = {};
    const opening: Record<string, { dr: number; cr: number }> = {};

    const fromD = new Date(options.fromDate);
    const toD = new Date(options.toDate);

    for (const acc of accounts) {
      balances[acc.id] = { dr: 0, cr: 0 };
      txn[acc.id] = { dr: 0, cr: 0 };
      opening[acc.id] = { dr: 0, cr: 0 };

      const ob = Number(acc.openingBalance || 0);
      const obDr = Number(acc.openingBalanceDr || 0);
      const obCr = Number(acc.openingBalanceCr || 0);
      
      if (obDr > 0) {
        opening[acc.id].dr += obDr;
        balances[acc.id].dr += obDr;
      } else if (obCr > 0) {
        opening[acc.id].cr += obCr;
        balances[acc.id].cr += obCr;
      } else if (ob > 0 && isDebitNature(acc.type)) {
        opening[acc.id].dr += ob;
        balances[acc.id].dr += ob;
      } else if (ob > 0) {
        opening[acc.id].cr += ob;
        balances[acc.id].cr += ob;
      }
    }

    const postedVouchers = vouchers.filter((v) => v.status === "posted");

    for (const v of postedVouchers) {
      const vDate = new Date(v.date);
      const isBeforeFrom = vDate < fromD;
      const isInRange = vDate >= fromD && vDate <= toD;

      for (const line of v.lines || []) {
        const accId = line.accountId;
        if (!accId) continue;
        if (!balances[accId]) {
          balances[accId] = { dr: 0, cr: 0 };
          txn[accId] = { dr: 0, cr: 0 };
          opening[accId] = { dr: 0, cr: 0 };
        }

        const dr = Number(line.debit || 0);
        const cr = Number(line.credit || 0);

        if (isBeforeFrom) {
          opening[accId].dr += dr;
          opening[accId].cr += cr;
          balances[accId].dr += dr;
          balances[accId].cr += cr;
        } else if (isInRange) {
          txn[accId].dr += dr;
          txn[accId].cr += cr;
          balances[accId].dr += dr;
          balances[accId].cr += cr;
        }
      }
    }

    const postedInvoices = (invoices || []).filter((i: any) => i.status === "posted");
    for (const inv of postedInvoices) {
      const iDate = new Date(inv.date);
      const isBeforeFrom = iDate < fromD;
      const isInRange = iDate >= fromD && iDate <= toD;

      const hasLinkedVoucher = postedVouchers.some(
        (v) => v.sourceId === inv.id || v.invoiceId === inv.id,
      );
      if (hasLinkedVoucher) continue;

      if (inv.partyId && (isBeforeFrom || isInRange)) {
        const partyAcc = accounts.find((a) => a.id === inv.partyId || (a as any).partyId === inv.partyId);
        if (partyAcc) {
          const total = Number(inv.grandTotal || 0);
          const isSales = inv.type === "sales-invoice" || inv.type === "sales" || inv.type === "SALES_INVOICE";
          const buckets = isBeforeFrom ? opening : txn;
          const bals = balances;
          if (!buckets[partyAcc.id]) {
            buckets[partyAcc.id] = { dr: 0, cr: 0 };
            bals[partyAcc.id] = { dr: 0, cr: 0 };
          }
          if (isSales) {
            buckets[partyAcc.id].dr += total;
            bals[partyAcc.id].dr += total;
          } else {
            buckets[partyAcc.id].cr += total;
            bals[partyAcc.id].cr += total;
          }
        }
      }
    }

    return { accountBalances: balances, accountTxn: txn, accountOpening: opening };
  }, [accounts, vouchers, invoices, options.fromDate, options.toDate]);

  // ─── Build the TB tree ─────────────────────────────────────────────────────
  const buildTree = useCallback((): TBRow[] => {
    const accMap = new Map<string, any>();
    for (const a of accounts) accMap.set(a.id, a);

    const getBalance = (id: string) => accountBalances[id] || { dr: 0, cr: 0 };
    const getOpening = (id: string) => accountOpening[id] || { dr: 0, cr: 0 };
    const getTxn = (id: string) => accountTxn[id] || { dr: 0, cr: 0 };

    const buildNode = (acc: any, level: number): TBRow => {
      const children = accounts
        .filter((a) => a.parentId === acc.id && !a.isGroup === false)
        .map((child) => buildNode(child, level + 1))
        .filter((child) => options.showZeroBalance || child.debit !== 0 || child.credit !== 0);

      const ledgerChildren = accounts
        .filter((a) => a.parentId === acc.id && !a.isGroup)
        .map((la): TBRow => {
          const bal = getBalance(la.id);
          const op = getOpening(la.id);
          const tx = getTxn(la.id);
          
          let debit = 0;
          let credit = 0;
          
          if (options.variant === "opening") {
            debit = Math.max(0, op.dr - op.cr);
            credit = Math.max(0, op.cr - op.dr);
          } else {
            debit = Math.max(0, bal.dr - bal.cr);
            credit = Math.max(0, bal.cr - bal.dr);
          }

          return {
            id: la.id,
            name: la.name,
            code: la.code || "",
            type: "ledger",
            level,
            parentId: acc.id,
            debit,
            credit,
            openingDebit: Math.max(0, op.dr - op.cr),
            openingCredit: Math.max(0, op.cr - op.dr),
            txnDebit: tx.dr,
            txnCredit: tx.cr,
            prevYearDebit: Number((la as any).prevYearBalance || 0) > 0 && isDebitNature(la.type) ? Number((la as any).prevYearBalance) : 0,
            prevYearCredit: Number((la as any).prevYearBalance || 0) > 0 && !isDebitNature(la.type) ? Number((la as any).prevYearBalance) : 0,
            children: [],
            hasChildren: false,
            accountType: la.type,
          };
        })
        .filter((l) => options.showZeroBalance || l.debit !== 0 || l.credit !== 0 || l.openingDebit !== 0 || l.openingCredit !== 0 || l.txnDebit !== 0 || l.txnCredit !== 0);

      const allChildren = [...children, ...ledgerChildren];

      const rollup = allChildren.reduce(
        (s, c) => ({
          dr: s.dr + c.debit,
          cr: s.cr + c.credit,
          opDr: s.opDr + c.openingDebit,
          opCr: s.opCr + c.openingCredit,
          txDr: s.txDr + c.txnDebit,
          txCr: s.txCr + c.txnCredit,
        }),
        { dr: 0, cr: 0, opDr: 0, opCr: 0, txDr: 0, txCr: 0 },
      );

      const ownBal = getBalance(acc.id);
      const ownOp = getOpening(acc.id);
      const ownTxn = getTxn(acc.id);

      let totalDr = 0;
      let totalCr = 0;
      
      if (options.variant === "opening") {
        totalDr = rollup.opDr + Math.max(0, ownOp.dr - ownOp.cr);
        totalCr = rollup.opCr + Math.max(0, ownOp.cr - ownOp.dr);
      } else {
        totalDr = rollup.dr + Math.max(0, ownBal.dr - ownBal.cr);
        totalCr = rollup.cr + Math.max(0, ownBal.cr - ownBal.dr);
      }

      return {
        id: acc.id,
        name: acc.name,
        code: acc.code || "",
        type: acc.parentId ? "sub-group" : "primary-group",
        level,
        parentId: acc.parentId,
        debit: totalDr,
        credit: totalCr,
        openingDebit: rollup.opDr + Math.max(0, ownOp.dr - ownOp.cr),
        openingCredit: rollup.opCr + Math.max(0, ownOp.cr - ownOp.dr),
        txnDebit: rollup.txDr + ownTxn.dr,
        txnCredit: rollup.txCr + ownTxn.cr,
        prevYearDebit: 0,
        prevYearCredit: 0,
        children: allChildren,
        hasChildren: allChildren.length > 0,
        accountType: acc.type,
      };
    };

    const typeOrder = ["asset", "liability", "equity", "income", "expense"];
    const roots = accounts
      .filter((a) => !a.parentId && a.isGroup !== false)
      .sort((a, b) => {
        const ai = typeOrder.indexOf((a.type || "").toLowerCase());
        const bi = typeOrder.indexOf((b.type || "").toLowerCase());
        if (ai !== bi) return ai - bi;
        return (a.name || "").localeCompare(b.name || "");
      })
      .map((a) => buildNode(a, 0))
      .filter((child) => options.showZeroBalance || child.debit !== 0 || child.credit !== 0);

    if (options.groupFilter === "specific" && options.selectedGroupId) {
      const findGroup = (rows: TBRow[], id: string): TBRow | null => {
        for (const r of rows) {
          if (r.id === id) return r;
          const found = findGroup(r.children, id);
          if (found) return found;
        }
        return null;
      };
      const g = findGroup(roots, options.selectedGroupId);
      return g ? [g] : [];
    }

    return roots;
  }, [accounts, accountBalances, accountOpening, accountTxn, options]);

  const tbTree = useMemo(() => {
    if (!generated) return [];
    return buildTree();
  }, [generated, buildTree]);

  // ─── Flatten tree for display ──────────────────────────────────────────────
  const flatRows = useMemo(() => {
    const rows: (TBRow & { indent: number; visible: boolean })[] = [];

    const traverse = (nodes: TBRow[], indent: number) => {
      for (const node of nodes) {
        const isExp = expanded[node.id] !== false;
        const q = searchQuery.toLowerCase().trim();
        const matchSearch = !q || node.name.toLowerCase().includes(q) || node.code.toLowerCase().includes(q);

        if (options.variant === "closing-alphabetical") {
          if (node.type === "ledger" && matchSearch) {
            rows.push({ ...node, indent: 0, visible: true });
          }
          traverse(node.children, indent);
        } else {
          if (matchSearch || !q) {
            rows.push({ ...node, indent, visible: true });
          }
          if (isExp && node.hasChildren) {
            traverse(node.children, indent + 1);
          }
        }
      }
    };

    if (options.variant === "closing-alphabetical") {
      const allLedgers: TBRow[] = [];
      const collectLedgers = (nodes: TBRow[]) => {
        for (const n of nodes) {
          if (n.type === "ledger") allLedgers.push(n);
          collectLedgers(n.children);
        }
      };
      collectLedgers(tbTree);
      allLedgers
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((l) => {
          const q = searchQuery.toLowerCase().trim();
          return !q || l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q);
        })
        .forEach((l) => rows.push({ ...l, indent: 0, visible: true }));
    } else {
      traverse(tbTree, 0);
    }

    return rows;
  }, [tbTree, expanded, searchQuery, options.variant]);

  // ─── Totals ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let totalDr = 0, totalCr = 0;
    
    if (options.variant === "closing-groupwise" || options.variant === "opening") {
      for (const r of tbTree) {
        totalDr += r.debit;
        totalCr += r.credit;
      }
    } else {
      for (const r of flatRows) {
        totalDr += r.debit;
        totalCr += r.credit;
      }
    }
    
    const diff = Math.abs(totalDr - totalCr);
    const balanced = diff < 0.01;
    return { totalDr, totalCr, diff, balanced };
  }, [flatRows, tbTree, options.variant]);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const toggleExpand = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !(prev[id] !== false) }));

  const handleGenerate = () => {
    setGenerated(true);
    setShowOptions(false);
    setExpanded({});
    setDrillStack([{ type: "tb" }]);
    setTimeout(() => {
      const firstLevel: Record<string, boolean> = {};
      for (const acc of accounts.filter((a) => !a.parentId)) {
        firstLevel[acc.id] = true;
      }
      setExpanded(firstLevel);
    }, 50);
  };

  const drillIntoRow = (row: TBRow) => {
    if (row.type === "ledger") {
      const acc = accounts.find((a) => a.id === row.id);
      setSelectedAccount(acc);
      setDrillStack((prev) => [
        ...prev,
        { type: "ledger", id: row.id, name: row.name, data: acc },
      ]);
    } else {
      toggleExpand(row.id);
    }
  };

  const drillIntoVoucher = (txn: any) => {
    setSelectedVoucher(txn);
    setDrillStack((prev) => [
      ...prev,
      { type: "voucher", id: txn.id, name: txn.voucherNo || txn.invoiceNo, data: txn },
    ]);
  };

  const drillBack = () => {
    if (drillStack.length <= 1) return;
    const newStack = drillStack.slice(0, -1);
    setDrillStack(newStack);
    const prev = newStack[newStack.length - 1];
    if (prev.type === "tb") {
      setSelectedAccount(null);
      setSelectedVoucher(null);
    } else if (prev.type === "ledger") {
      setSelectedVoucher(null);
    }
  };

  // ─── Ledger transactions for drill-down ────────────────────────────────────
  const ledgerTransactions = useMemo(() => {
    if (!selectedAccount) return [];
    const accId = selectedAccount.id;
    const fromD = new Date(options.fromDate);
    const toD = new Date(options.toDate);

    const txns: any[] = [];
    let runningBal = (accountOpening[accId]?.dr || 0) - (accountOpening[accId]?.cr || 0);

    const opBal = accountOpening[accId] || { dr: 0, cr: 0 };
    const netOp = opBal.dr - opBal.cr;
    txns.push({
      id: "opening",
      date: options.fromDate,
      particulars: "Opening Balance",
      voucherType: "—",
      voucherNo: "—",
      debit: netOp > 0 ? netOp : 0,
      credit: netOp < 0 ? Math.abs(netOp) : 0,
      balance: netOp,
      isOpening: true,
    });

    const postedVouchers = vouchers
      .filter((v) => {
        if (v.status !== "posted") return false;
        const d = new Date(v.date);
        return d >= fromD && d <= toD;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const v of postedVouchers) {
      for (const line of v.lines || []) {
        if (line.accountId !== accId) continue;
        const dr = Number(line.debit || 0);
        const cr = Number(line.credit || 0);
        runningBal += dr - cr;
        txns.push({
          id: `${v.id}-${line.accountId}`,
          date: v.date,
          particulars: line.narration || v.narration || "—",
          voucherType: v.type,
          voucherNo: v.voucherNo,
          debit: dr,
          credit: cr,
          balance: runningBal,
          voucher: v,
        });
      }
    }

    return txns;
  }, [selectedAccount, vouchers, accountOpening, options.fromDate, options.toDate]);

  // ─── Export ────────────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const rows: any[] = [];
    rows.push(["Account Name", "Code", "Debit", "Credit"]);

    const addRows = (nodes: TBRow[], indent: number) => {
      for (const n of nodes) {
        const prefix = "  ".repeat(indent);
        rows.push([
          prefix + n.name,
          n.code,
          n.debit || "",
          n.credit || "",
        ]);
        if (n.hasChildren && expanded[n.id] !== false) {
          addRows(n.children, indent + 1);
        }
      }
    };
    addRows(tbTree, 0);
    rows.push([]);
    rows.push(["TOTAL", "", totals.totalDr, totals.totalCr]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
    XLSX.writeFile(wb, `Trial_Balance_${options.toDate}.xlsx`);
    toast.success("Trial Balance exported to Excel");
  };

  const handlePrint = () => {
    window.print();
  };

  // ─── Views ─────────────────────────────────────────────────────────────────
  const OptionsPanel = () => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm no-print">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold text-gray-800">Trial Balance Options</h3>
        {generated && (
          <button
            onClick={() => setShowOptions(false)}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
          >
            Hide Options
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Report Type</label>
          <select
            value={options.variant}
            onChange={(e) => setOpt("variant", e.target.value)}
            className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          >
            <option value="closing-alphabetical">Closing Trial — Alphabetical</option>
            <option value="closing-groupwise">Closing Trial — Group Wise</option>
            <option value="opening">Opening Trial Balance</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">From Date</label>
          <input
            type="date"
            value={options.fromDate}
            onChange={(e) => setOpt("fromDate", e.target.value)}
            className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">To Date</label>
          <input
            type="date"
            value={options.toDate}
            onChange={(e) => setOpt("toDate", e.target.value)}
            className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Display Mode</label>
          <div className="flex gap-4 h-8 items-center">
            <label className="flex items-center gap-1.5 cursor-pointer text-[12px] text-gray-700">
              <input
                type="radio"
                name="displayMode"
                value="balance-only"
                checked={options.displayMode === "balance-only"}
                onChange={() => setOpt("displayMode", "balance-only")}
                className="accent-[#1557b0]"
              />
              Balance Only
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[12px] text-gray-700">
              <input
                type="radio"
                name="displayMode"
                value="detailed"
                checked={options.displayMode === "detailed"}
                onChange={() => setOpt("displayMode", "detailed")}
                className="accent-[#1557b0]"
              />
              Detailed
            </label>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Group Filter</label>
          <div className="flex gap-4 h-8 items-center">
            <label className="flex items-center gap-1.5 cursor-pointer text-[12px] text-gray-700">
              <input
                type="radio"
                name="groupFilter"
                value="all"
                checked={options.groupFilter === "all"}
                onChange={() => setOpt("groupFilter", "all")}
                className="accent-[#1557b0]"
              />
              All
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[12px] text-gray-700">
              <input
                type="radio"
                name="groupFilter"
                value="specific"
                checked={options.groupFilter === "specific"}
                onChange={() => setOpt("groupFilter", "specific")}
                className="accent-[#1557b0]"
              />
              Specific
            </label>
          </div>
        </div>

        {options.groupFilter === "specific" && (
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Select Group</label>
            <select
              value={options.selectedGroupId}
              onChange={(e) => setOpt("selectedGroupId", e.target.value)}
              className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="">— All Groups —</option>
              {accounts
                .filter((a) => a.isGroup)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1 md:col-span-2">
          <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Additional Options</label>
          <div className="flex flex-wrap gap-4">
            {[
              { key: "showZeroBalance", label: "Show Zero Balance" },
              { key: "showPercentage", label: "Show %" },
              { key: "showPrevYear", label: "Prev Year" },
              { key: "roundOff", label: "Round Off" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  checked={options[key as keyof TBOptions] as boolean}
                  onChange={(e) => setOpt(key as keyof TBOptions, e.target.checked)}
                  className="accent-[#1557b0]"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={handleGenerate}
          className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md transition-colors"
        >
          Generate Report
        </button>
      </div>
    </div>
  );

  const renderRow = (row: TBRow & { indent: number }, idx: number) => {
    const isPrimaryGroup = row.type === "primary-group";
    const isSubGroup = row.type === "sub-group";
    const indentPx = row.indent * 20;
    const isExpanded = expanded[row.id] !== false;
    const totalPct = totals.totalDr > 0 ? ((row.debit + row.credit) / (totals.totalDr + totals.totalCr)) * 100 : 0;

    return (
      <tr
        key={`${row.id}-${idx}`}
        className={`border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors
          ${isPrimaryGroup ? "bg-gray-100" : isSubGroup ? "bg-gray-50" : "bg-white"}`}
        onClick={() => drillIntoRow(row)}
      >
        <td className="px-3 py-2.5 border-r border-gray-200">
          <div className="flex items-center gap-1.5" style={{ paddingLeft: `${indentPx}px` }}>
            {row.hasChildren && options.variant !== "closing-alphabetical" ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(row.id);
                }}
                className="inline-flex items-center justify-center w-4 h-4 shrink-0 text-gray-500 hover:text-gray-700"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </span>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <span className={`text-[12px] text-gray-800 ${isPrimaryGroup || isSubGroup ? "font-semibold" : ""}`}>
              {row.name}
            </span>
            {row.code && <span className="text-[10px] text-gray-500 font-mono">{row.code}</span>}
          </div>
        </td>

        {options.displayMode === "detailed" ? (
          <>
            <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-[12px] text-gray-700">{row.openingDebit > 0 ? money(row.openingDebit, options.roundOff) : "—"}</td>
            <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-[12px] text-gray-700">{row.openingCredit > 0 ? money(row.openingCredit, options.roundOff) : "—"}</td>
            <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-[12px] text-gray-700">{row.txnDebit > 0 ? money(row.txnDebit, options.roundOff) : "—"}</td>
            <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-[12px] text-gray-700">{row.txnCredit > 0 ? money(row.txnCredit, options.roundOff) : "—"}</td>
          </>
        ) : null}

        <td className={`px-3 py-2.5 text-right border-r border-gray-200 font-mono text-[12px] text-gray-700 ${isPrimaryGroup || isSubGroup ? "font-semibold" : ""}`}>
          {row.debit > 0 ? money(row.debit, options.roundOff) : "—"}
        </td>
        <td className={`px-3 py-2.5 text-right border-r border-gray-200 font-mono text-[12px] text-gray-700 ${isPrimaryGroup || isSubGroup ? "font-semibold" : ""}`}>
          {row.credit > 0 ? money(row.credit, options.roundOff) : "—"}
        </td>

        {options.showPercentage && (
          <td className="px-3 py-2.5 text-right border-r border-gray-200 text-[11px] font-mono text-gray-600">
            {totalPct > 0 ? `${totalPct.toFixed(1)}%` : "—"}
          </td>
        )}

        {options.showPrevYear && (
          <>
            <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-[12px] text-gray-500">{row.prevYearDebit > 0 ? money(row.prevYearDebit, options.roundOff) : "—"}</td>
            <td className="px-3 py-2.5 text-right border-gray-200 font-mono text-[12px] text-gray-500">{row.prevYearCredit > 0 ? money(row.prevYearCredit, options.roundOff) : "—"}</td>
          </>
        )}
      </tr>
    );
  };

  const LedgerView = () => {
    if (!selectedAccount) return null;
    const acc = selectedAccount;
    const txns = ledgerTransactions;
    const closingBal = (accountBalances[acc.id]?.dr || 0) - (accountBalances[acc.id]?.cr || 0);

    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 bg-[#f5f6fa] border-b border-gray-200 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={drillBack}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <div>
              <h3 className="text-[14px] font-semibold text-gray-800">Ledger: {acc.name}</h3>
              <p className="text-[11px] text-gray-500">{options.fromDate} to {options.toDate}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Closing Balance</p>
            <p className={`text-[14px] font-mono font-bold ${closingBal >= 0 ? "text-[#1557b0]" : "text-[#dc2626]"}`}>
              {money(Math.abs(closingBal))} {closingBal >= 0 ? "Dr" : "Cr"}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2.5 text-left border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">Date</th>
                <th className="px-3 py-2.5 text-left border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Particulars</th>
                <th className="px-3 py-2.5 text-center border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">Type</th>
                <th className="px-3 py-2.5 text-center border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">Vch No</th>
                <th className="px-3 py-2.5 text-right border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">Debit</th>
                <th className="px-3 py-2.5 text-right border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">Credit</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">Balance</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t, idx) => (
                <tr
                  key={t.id}
                  className={`border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${t.isOpening ? "bg-gray-50 font-medium" : "bg-white"}`}
                  onClick={() => !t.isOpening && t.voucher && drillIntoVoucher(t.voucher)}
                >
                  <td className="px-3 py-2.5 border-r border-gray-200 font-mono text-gray-600">{t.date}</td>
                  <td className="px-3 py-2.5 border-r border-gray-200 text-gray-800">{t.particulars}</td>
                  <td className="px-3 py-2.5 text-center border-r border-gray-200 text-[11px] text-gray-600 uppercase">{t.voucherType}</td>
                  <td className="px-3 py-2.5 text-center border-r border-gray-200 font-mono text-gray-600">{t.voucherNo}</td>
                  <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-gray-800">{t.debit > 0 ? money(t.debit) : "—"}</td>
                  <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-gray-800">{t.credit > 0 ? money(t.credit) : "—"}</td>
                  <td className={`px-3 py-2.5 text-right font-mono font-medium ${t.balance >= 0 ? "text-[#1557b0]" : "text-[#dc2626]"}`}>
                    {money(Math.abs(t.balance))} {t.balance >= 0 ? "Dr" : "Cr"}
                  </td>
                </tr>
              ))}
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold">
                <td className="px-3 py-2.5 border-r border-gray-200 text-gray-800" colSpan={4}>Closing Balance</td>
                <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-gray-800">{money(accountTxn[acc.id]?.dr || 0)}</td>
                <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-gray-800">{money(accountTxn[acc.id]?.cr || 0)}</td>
                <td className={`px-3 py-2.5 text-right font-mono ${closingBal >= 0 ? "text-[#1557b0]" : "text-[#dc2626]"}`}>
                  {money(Math.abs(closingBal))} {closingBal >= 0 ? "Dr" : "Cr"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const VoucherView = () => {
    if (!selectedVoucher) return null;
    const v = selectedVoucher;
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 bg-[#f5f6fa] border-b border-gray-200 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={drillBack}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <div>
              <h3 className="text-[14px] font-semibold text-gray-800">Voucher: {v.voucherNo}</h3>
              <p className="text-[11px] text-gray-500">{v.date} · {v.type?.toUpperCase()} · {v.status?.toUpperCase()}</p>
            </div>
          </div>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-200 bg-gray-50">
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Voucher No</p>
            <p className="text-[12px] font-mono text-gray-800 mt-0.5">{v.voucherNo}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Date</p>
            <p className="text-[12px] font-mono text-gray-800 mt-0.5">{v.date}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Type</p>
            <p className="text-[12px] text-gray-800 uppercase mt-0.5">{v.type}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Narration</p>
            <p className="text-[12px] text-gray-800 mt-0.5 truncate">{v.narration || "—"}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2.5 text-left border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Account</th>
                <th className="px-3 py-2.5 text-right border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">Debit</th>
                <th className="px-3 py-2.5 text-right border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">Credit</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Narration</th>
              </tr>
            </thead>
            <tbody>
              {(v.lines || []).map((line: any, idx: number) => {
                const acc = accounts.find((a) => a.id === line.accountId);
                return (
                  <tr key={idx} className="border-b border-gray-200 bg-white">
                    <td className="px-3 py-2.5 border-r border-gray-200 text-gray-800">{acc?.name || line.accountName || line.accountId}</td>
                    <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-gray-800">{Number(line.debit || 0) > 0 ? money(Number(line.debit)) : "—"}</td>
                    <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-gray-800">{Number(line.credit || 0) > 0 ? money(Number(line.credit)) : "—"}</td>
                    <td className="px-3 py-2.5 text-gray-600">{line.narration || "—"}</td>
                  </tr>
                );
              })}
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold">
                <td className="px-3 py-2.5 border-r border-gray-200 text-gray-800">TOTAL</td>
                <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-gray-800">{money(v.totalDebit || v.amount || 0)}</td>
                <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-gray-800">{money(v.totalCredit || v.amount || 0)}</td>
                <td className="px-3 py-2.5"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 min-h-[calc(100vh-3rem)] bg-[#f5f6fa]">
      <div className="flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Trial Balance</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {currentDrill.type === "tb" ? `Period: ${options.fromDate} to ${options.toDate}` :
             currentDrill.type === "ledger" ? `Ledger: ${selectedAccount?.name}` :
             `Voucher: ${selectedVoucher?.voucherNo}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentDrill.type === "tb" && !showOptions && (
            <button
              onClick={() => setShowOptions(true)}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" /> Options
            </button>
          )}
          {currentDrill.type === "tb" && generated && (
            <>
              <button
                onClick={handlePrint}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
              >
                Print
              </button>
              <button
                onClick={handleExportExcel}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
              >
                Export Excel
              </button>
            </>
          )}
        </div>
      </div>

      {showOptions && currentDrill.type === "tb" && <OptionsPanel />}

      {currentDrill.type === "tb" && generated && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm" ref={printRef}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200" rowSpan={options.displayMode === "detailed" ? 2 : 1}>
                    Account Name
                  </th>
                  {options.displayMode === "detailed" ? (
                    <>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 border-b border-gray-200" colSpan={2}>Opening Balance</th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 border-b border-gray-200" colSpan={2}>Transactions</th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 border-b border-gray-200" colSpan={2}>Closing Balance</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 w-32">Debit (Dr)</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 w-32">Credit (Cr)</th>
                    </>
                  )}
                  {options.showPercentage && (
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 w-20" rowSpan={options.displayMode === "detailed" ? 2 : 1}>%</th>
                  )}
                  {options.showPrevYear && (
                    <>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 w-32" rowSpan={options.displayMode === "detailed" ? 2 : 1}>Prev Yr Dr</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32" rowSpan={options.displayMode === "detailed" ? 2 : 1}>Prev Yr Cr</th>
                    </>
                  )}
                </tr>
                {options.displayMode === "detailed" && (
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">Dr</th>
                    <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">Cr</th>
                    <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">Dr</th>
                    <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">Cr</th>
                    <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">Dr</th>
                    <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">Cr</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {flatRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-[12px] text-gray-500">
                      No data available for selected period.
                    </td>
                  </tr>
                ) : (
                  flatRows.map((row, idx) => renderRow(row, idx))
                )}
              </tbody>
              {flatRows.length > 0 && (
                <tfoot>
                  <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 border-r border-gray-200">GRAND TOTAL</td>
                    {options.displayMode === "detailed" ? (
                      <>
                        <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-800 border-r border-gray-200" colSpan={4}></td>
                        <td className="px-3 py-2.5 text-right font-mono text-[12px] text-[#1557b0] border-r border-gray-200">{money(totals.totalDr, options.roundOff)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-[12px] text-[#1557b0] border-r border-gray-200">{money(totals.totalCr, options.roundOff)}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2.5 text-right font-mono text-[12px] text-[#1557b0] border-r border-gray-200">{money(totals.totalDr, options.roundOff)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-[12px] text-[#1557b0] border-r border-gray-200">{money(totals.totalCr, options.roundOff)}</td>
                      </>
                    )}
                    {options.showPercentage && <td className="px-3 py-2.5 border-r border-gray-200"></td>}
                    {options.showPrevYear && <td className="px-3 py-2.5" colSpan={2}></td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {currentDrill.type === "ledger" && <LedgerView />}
      {currentDrill.type === "voucher" && <VoucherView />}
    </div>
  );
}
