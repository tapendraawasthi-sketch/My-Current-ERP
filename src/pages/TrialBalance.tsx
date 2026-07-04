import React, { useState, useMemo, useCallback, useRef } from "react";
import { useStore } from "../store/useStore";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { ChevronRight, ChevronDown, ArrowLeft, Settings } from "lucide-react";
import ReportDateRangePicker from "../components/ui/ReportDateRangePicker";

type TBVariant = "closing-alphabetical" | "closing-groupwise" | "opening";

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

    // Determine if the selected fromDate is the very start of the fiscal year.
    // If so, account-level opening balances are the only source (no pre-period vouchers
    // within the same FY to accumulate). If fromDate is mid-period we derive opening
    // entirely from pre-period vouchers and do NOT add account OB to avoid double-count.
    const fyStart = currentFiscalYear?.startDate || "";
    const fromIsAtFYStart = !fyStart || options.fromDate <= fyStart;

    for (const acc of accounts) {
      balances[acc.id] = { dr: 0, cr: 0 };
      txn[acc.id] = { dr: 0, cr: 0 };
      opening[acc.id] = { dr: 0, cr: 0 };

      if (fromIsAtFYStart) {
        // Only seed from account field when the report starts at fiscal year beginning.
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
      // For mid-period fromDates the opening balance accumulates from pre-period
      // vouchers in the loop below — no account-field seeding needed.
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

      // Auto-journals created by postInvoiceJournal use the ID pattern "jnl-{invoiceId}".
      // Skip any invoice whose journal already appears in the vouchers loop above.
      const autoJournalId = `jnl-${inv.id}`;
      const hasLinkedVoucher = postedVouchers.some(
        (v) => v.id === autoJournalId || v.sourceId === inv.id || v.invoiceId === inv.id,
      );
      if (hasLinkedVoucher) continue;

      if (inv.partyId && (isBeforeFrom || isInRange)) {
        const partyAcc = accounts.find(
          (a) => a.id === inv.partyId || (a as any).partyId === inv.partyId,
        );
        if (partyAcc) {
          const total = Number(inv.grandTotal || 0);
          const isSales =
            inv.type === "sales-invoice" || inv.type === "sales" || inv.type === "SALES_INVOICE";
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
  }, [accounts, vouchers, invoices, options.fromDate, options.toDate, currentFiscalYear]);

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
            prevYearDebit:
              Number((la as any).prevYearBalance || 0) > 0 && isDebitNature(la.type)
                ? Number((la as any).prevYearBalance)
                : 0,
            prevYearCredit:
              Number((la as any).prevYearBalance || 0) > 0 && !isDebitNature(la.type)
                ? Number((la as any).prevYearBalance)
                : 0,
            children: [],
            hasChildren: false,
            accountType: la.type,
          };
        })
        .filter(
          (l) =>
            options.showZeroBalance ||
            l.debit !== 0 ||
            l.credit !== 0 ||
            l.openingDebit !== 0 ||
            l.openingCredit !== 0 ||
            l.txnDebit !== 0 ||
            l.txnCredit !== 0,
        );

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
        const matchSearch =
          !q || node.name.toLowerCase().includes(q) || node.code.toLowerCase().includes(q);

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
    let totalDr = 0,
      totalCr = 0;

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
      setDrillStack((prev) => [...prev, { type: "ledger", id: row.id, name: row.name, data: acc }]);
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
        rows.push([prefix + n.name, n.code, n.debit || "", n.credit || ""]);
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
  const Drawer = () => (
    <>
      {showOptions && (
        <div
          onClick={() => setShowOptions(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.15)",
            zIndex: 40,
          }}
        />
      )}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: 340,
          background: "#ffffff",
          borderLeft: "1px solid #e5e7eb",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
          zIndex: 50,
          transform: showOptions ? "translateX(0)" : "translateX(100%)",
          transition: "transform 220ms cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f5f6fa",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Report Options</span>
          <button
            onClick={() => setShowOptions(false)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#6b7280",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16 }} className="flex flex-col gap-4">
          <ReportDateRangePicker
            value={{ fromDate: options.fromDate, toDate: options.toDate }}
            onChange={(r) => {
              setOpt("fromDate", r.fromDate);
              setOpt("toDate", r.toDate);
            }}
            label=""
            compact
          />

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
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Select Group
              </label>
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

          <div className="flex flex-col gap-2 pt-1">
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
              Additional Options
            </label>
            <div className="flex flex-col gap-2">
              {[
                { key: "showZeroBalance", label: "Show Zero Balance" },
                { key: "showPercentage", label: "Show %" },
                { key: "showPrevYear", label: "Prev Year" },
                { key: "roundOff", label: "Round Off" },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-1.5 cursor-pointer text-[12px] text-gray-700"
                >
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

        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={() => setShowOptions(false)}
            style={{
              height: 32,
              padding: "0 14px",
              background: "#ffffff",
              border: "1px solid #d1d5db",
              borderRadius: 5,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            style={{
              height: 32,
              padding: "0 14px",
              background: "#1557b0",
              color: "#ffffff",
              border: "none",
              borderRadius: 5,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Generate Report
          </button>
        </div>
      </div>
    </>
  );

  const renderRow = (row: TBRow & { indent: number }, idx: number) => {
    const isPrimaryGroup = row.type === "primary-group";
    const isSubGroup = row.type === "sub-group";
    const indentPx = row.indent * 20;
    const isExpanded = expanded[row.id] !== false;
    const totalPct =
      totals.totalDr > 0 ? ((row.debit + row.credit) / (totals.totalDr + totals.totalCr)) * 100 : 0;

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
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </span>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <span
              className={`text-[12px] text-gray-800 ${isPrimaryGroup || isSubGroup ? "font-semibold" : ""}`}
            >
              {row.name}
            </span>
            {row.code && <span className="text-[10px] text-gray-500 font-mono">{row.code}</span>}
          </div>
        </td>

        {options.displayMode === "detailed" ? (
          <>
            <td className="px-3 py-2.5 border-r border-gray-200 num-cell text-gray-700">
              {row.openingDebit > 0 ? money(row.openingDebit, options.roundOff) : "—"}
            </td>
            <td className="px-3 py-2.5 border-r border-gray-200 num-cell text-gray-700">
              {row.openingCredit > 0 ? money(row.openingCredit, options.roundOff) : "—"}
            </td>
            <td className="px-3 py-2.5 border-r border-gray-200 num-cell text-gray-700">
              {row.txnDebit > 0 ? money(row.txnDebit, options.roundOff) : "—"}
            </td>
            <td className="px-3 py-2.5 border-r border-gray-200 num-cell text-gray-700">
              {row.txnCredit > 0 ? money(row.txnCredit, options.roundOff) : "—"}
            </td>
          </>
        ) : null}

        <td
          className={`px-3 py-2.5 border-r border-gray-200 num-cell text-gray-700 ${isPrimaryGroup || isSubGroup ? "font-semibold" : ""}`}
        >
          {row.debit > 0 ? money(row.debit, options.roundOff) : "—"}
        </td>
        <td
          className={`px-3 py-2.5 border-r border-gray-200 num-cell text-gray-700 ${isPrimaryGroup || isSubGroup ? "font-semibold" : ""}`}
        >
          {row.credit > 0 ? money(row.credit, options.roundOff) : "—"}
        </td>

        {options.showPercentage && (
          <td className="px-3 py-2.5 border-r border-gray-200 num-cell text-gray-600">
            {totalPct > 0 ? `${totalPct.toFixed(1)}%` : "—"}
          </td>
        )}

        {options.showPrevYear && (
          <>
            <td className="px-3 py-2.5 border-r border-gray-200 num-cell text-gray-500">
              {row.prevYearDebit > 0 ? money(row.prevYearDebit, options.roundOff) : "—"}
            </td>
            <td className="px-3 py-2.5 border-gray-200 num-cell text-gray-500">
              {row.prevYearCredit > 0 ? money(row.prevYearCredit, options.roundOff) : "—"}
            </td>
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
              <p className="text-[11px] text-gray-500">
                {options.fromDate} to {options.toDate}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Closing Balance</p>
            <p
              className={`text-[14px] font-mono font-bold ${closingBal >= 0 ? "text-[#1557b0]" : "text-[#dc2626]"}`}
            >
              {money(Math.abs(closingBal))} {closingBal >= 0 ? "Dr" : "Cr"}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="report-table w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2.5 text-left border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">
                  Date
                </th>
                <th className="px-3 py-2.5 text-left border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Particulars
                </th>
                <th className="px-3 py-2.5 text-center border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                  Type
                </th>
                <th className="px-3 py-2.5 text-center border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">
                  Vch No
                </th>
                <th className="px-3 py-2.5 text-right border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                  Debit
                </th>
                <th className="px-3 py-2.5 text-right border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                  Credit
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t, idx) => (
                <tr
                  key={t.id}
                  className={`border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${t.isOpening ? "bg-gray-50 font-medium" : "bg-white"}`}
                  onClick={() => !t.isOpening && t.voucher && drillIntoVoucher(t.voucher)}
                >
                  <td className="px-3 py-2.5 border-r border-gray-200 font-mono text-gray-600">
                    {t.date}
                  </td>
                  <td className="px-3 py-2.5 border-r border-gray-200 text-gray-800">
                    {t.particulars}
                  </td>
                  <td className="px-3 py-2.5 text-center border-r border-gray-200 text-[11px] text-gray-600 uppercase">
                    {t.voucherType}
                  </td>
                  <td className="px-3 py-2.5 text-center border-r border-gray-200 font-mono text-gray-600">
                    {t.voucherNo}
                  </td>
                  <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-gray-800">
                    {t.debit > 0 ? money(t.debit) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-gray-800">
                    {t.credit > 0 ? money(t.credit) : "—"}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-mono font-medium ${t.balance >= 0 ? "text-[#1557b0]" : "text-[#dc2626]"}`}
                  >
                    {money(Math.abs(t.balance))} {t.balance >= 0 ? "Dr" : "Cr"}
                  </td>
                </tr>
              ))}
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold">
                <td className="px-3 py-2.5 border-r border-gray-200 text-gray-800" colSpan={4}>
                  Closing Balance
                </td>
                <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-gray-800">
                  {money(accountTxn[acc.id]?.dr || 0)}
                </td>
                <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-gray-800">
                  {money(accountTxn[acc.id]?.cr || 0)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right font-mono ${closingBal >= 0 ? "text-[#1557b0]" : "text-[#dc2626]"}`}
                >
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
              <p className="text-[11px] text-gray-500">
                {v.date} · {v.type?.toUpperCase()} · {v.status?.toUpperCase()}
              </p>
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
          <table className="report-table w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2.5 text-left border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Account
                </th>
                <th className="px-3 py-2.5 text-right border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                  Debit
                </th>
                <th className="px-3 py-2.5 text-right border-r border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                  Credit
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Narration
                </th>
              </tr>
            </thead>
            <tbody>
              {(v.lines || []).map((line: any, idx: number) => {
                const acc = accounts.find((a) => a.id === line.accountId);
                return (
                  <tr key={idx} className="border-b border-gray-200 bg-white">
                    <td className="px-3 py-2.5 border-r border-gray-200 text-gray-800">
                      {acc?.name || line.accountName || line.accountId}
                    </td>
                    <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-gray-800">
                      {Number(line.debit || 0) > 0 ? money(Number(line.debit)) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-gray-800">
                      {Number(line.credit || 0) > 0 ? money(Number(line.credit)) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{line.narration || "—"}</td>
                  </tr>
                );
              })}
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold">
                <td className="px-3 py-2.5 border-r border-gray-200 text-gray-800">TOTAL</td>
                <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-gray-800">
                  {money(v.totalDebit || v.amount || 0)}
                </td>
                <td className="px-3 py-2.5 text-right border-r border-gray-200 font-mono text-gray-800">
                  {money(v.totalCredit || v.amount || 0)}
                </td>
                <td className="px-3 py-2.5"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const totalClosingDebit = useMemo(
    () => flatRows.reduce((s, r) => s + (r.debit || 0), 0),
    [flatRows],
  );
  const totalClosingCredit = useMemo(
    () => flatRows.reduce((s, r) => s + (r.credit || 0), 0),
    [flatRows],
  );
  const balanceDifference = Math.abs(totalClosingDebit - totalClosingCredit);
  const isBalanced = balanceDifference < 0.005;

  return (
    <div className="p-4 min-h-[calc(100vh-3rem)] bg-[#f5f6fa]">
      <div className="flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Trial Balance</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {currentDrill.type === "tb"
              ? `Period: ${options.fromDate} to ${options.toDate}`
              : currentDrill.type === "ledger"
                ? `Ledger: ${selectedAccount?.name}`
                : `Voucher: ${selectedVoucher?.voucherNo}`}
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

      <Drawer />

      {currentDrill.type === "tb" && generated && (
        <div
          className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm"
          ref={printRef}
        >
          <div
            style={{
              display: "flex",
              gap: 0,
              borderBottom: "2px solid #e5e7eb",
              background: "#ffffff",
              padding: "0 16px",
              marginBottom: 0,
            }}
            className="no-print"
          >
            {[
              { key: "closing-alphabetical", label: "Alphabetical" },
              { key: "closing-groupwise", label: "Group-wise" },
              { key: "opening", label: "Opening" },
              { key: "detailed", label: "Detailed" },
            ].map((v) => {
              const activeKey = options.displayMode === "detailed" ? "detailed" : options.variant;
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => {
                    if (v.key === "detailed") {
                      setOpt("variant", "closing-groupwise");
                      setOpt("displayMode", "detailed");
                    } else {
                      setOpt("variant", v.key as any);
                      setOpt("displayMode", "balance-only");
                    }
                  }}
                  style={{
                    height: 36,
                    padding: "0 16px",
                    background: "transparent",
                    border: "none",
                    borderBottom:
                      activeKey === v.key ? "2px solid #1557b0" : "2px solid transparent",
                    color: activeKey === v.key ? "#1557b0" : "#6b7280",
                    fontSize: 12,
                    fontWeight: activeKey === v.key ? 700 : 400,
                    cursor: "pointer",
                    marginBottom: -2,
                    transition: "all 150ms ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  {v.label}
                </button>
              );
            })}
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingBottom: 4,
              }}
            >
              <button
                onClick={() => setShowOptions(true)}
                style={{
                  height: 28,
                  padding: "0 10px",
                  background: "#f5f6fa",
                  border: "1px solid #e5e7eb",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#374151",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                ⚙ Options
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table
              className="report-table w-full border-collapse"
              style={{ tableLayout: "fixed", width: "100%" }}
            >
              <colgroup>
                {options.displayMode === "detailed" ? (
                  <>
                    <col style={{ width: "34%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                  </>
                ) : (
                  <>
                    <col style={{ width: "60%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "20%" }} />
                  </>
                )}
              </colgroup>
              {options.showPrevYear ? (
                <thead>
                  <tr>
                    <th
                      colSpan={1}
                      style={{ background: "#f5f6fa", borderBottom: "1px solid #e5e7eb" }}
                    />
                    <th
                      colSpan={2}
                      style={{
                        background: "#6b7280",
                        color: "#ffffff",
                        fontSize: 11,
                        fontWeight: 700,
                        textAlign: "center",
                        padding: "6px 8px",
                        borderRight: "2px solid #ffffff",
                      }}
                    >
                      Previous Year
                    </th>
                    <th
                      colSpan={options.displayMode === "detailed" ? 6 : 2}
                      style={{
                        background: "#1557b0",
                        color: "#ffffff",
                        fontSize: 11,
                        fontWeight: 700,
                        textAlign: "center",
                        padding: "6px 8px",
                      }}
                    >
                      Current Year
                    </th>
                    {options.showPercentage && (
                      <th style={{ background: "#f5f6fa", borderBottom: "1px solid #e5e7eb" }} />
                    )}
                  </tr>
                  <tr>
                    <th
                      style={{
                        background: "#f5f6fa",
                        color: "#374151",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        padding: "8px 10px",
                        textAlign: "left",
                        borderBottom: "2px solid #e5e7eb",
                        whiteSpace: "nowrap",
                        borderRight: "1px solid #e5e7eb",
                      }}
                    >
                      Account Name
                    </th>
                    <th
                      style={{
                        background: "#64748b",
                        color: "#ffffff",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        padding: "8px 10px",
                        textAlign: "right",
                        borderBottom: "2px solid #e5e7eb",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Prev Dr
                    </th>
                    <th
                      style={{
                        background: "#64748b",
                        color: "#ffffff",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        padding: "8px 10px",
                        textAlign: "right",
                        borderBottom: "2px solid #e5e7eb",
                        whiteSpace: "nowrap",
                        borderRight: "1px solid #e5e7eb",
                      }}
                    >
                      Prev Cr
                    </th>
                    {options.displayMode === "detailed" ? (
                      <>
                        <th
                          style={{
                            background: "#1e40af",
                            color: "#ffffff",
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            padding: "8px 10px",
                            textAlign: "right",
                            borderBottom: "2px solid #e5e7eb",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Op Dr
                        </th>
                        <th
                          style={{
                            background: "#1e40af",
                            color: "#ffffff",
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            padding: "8px 10px",
                            textAlign: "right",
                            borderBottom: "2px solid #e5e7eb",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Op Cr
                        </th>
                        <th
                          style={{
                            background: "#1e40af",
                            color: "#ffffff",
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            padding: "8px 10px",
                            textAlign: "right",
                            borderBottom: "2px solid #e5e7eb",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Txn Dr
                        </th>
                        <th
                          style={{
                            background: "#1e40af",
                            color: "#ffffff",
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            padding: "8px 10px",
                            textAlign: "right",
                            borderBottom: "2px solid #e5e7eb",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Txn Cr
                        </th>
                        <th
                          style={{
                            background: "#1e40af",
                            color: "#ffffff",
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            padding: "8px 10px",
                            textAlign: "right",
                            borderBottom: "2px solid #e5e7eb",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Cl Dr
                        </th>
                        <th
                          style={{
                            background: "#1e40af",
                            color: "#ffffff",
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            padding: "8px 10px",
                            textAlign: "right",
                            borderBottom: "2px solid #e5e7eb",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Cl Cr
                        </th>
                      </>
                    ) : (
                      <>
                        <th
                          style={{
                            background: "#1e40af",
                            color: "#ffffff",
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            padding: "8px 10px",
                            textAlign: "right",
                            borderBottom: "2px solid #e5e7eb",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Debit (Dr)
                        </th>
                        <th
                          style={{
                            background: "#1e40af",
                            color: "#ffffff",
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            padding: "8px 10px",
                            textAlign: "right",
                            borderBottom: "2px solid #e5e7eb",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Credit (Cr)
                        </th>
                      </>
                    )}
                    {options.showPercentage && (
                      <th
                        style={{
                          background: "#f5f6fa",
                          color: "#374151",
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          padding: "8px 10px",
                          textAlign: "right",
                          borderBottom: "2px solid #e5e7eb",
                          whiteSpace: "nowrap",
                        }}
                      >
                        %
                      </th>
                    )}
                  </tr>
                </thead>
              ) : (
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th
                      className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200"
                      rowSpan={options.displayMode === "detailed" ? 2 : 1}
                    >
                      Account Name
                    </th>
                    {options.displayMode === "detailed" ? (
                      <>
                        <th
                          className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 border-b border-gray-200"
                          colSpan={2}
                        >
                          Opening Balance
                        </th>
                        <th
                          className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 border-b border-gray-200"
                          colSpan={2}
                        >
                          Transactions
                        </th>
                        <th
                          className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 border-b border-gray-200"
                          colSpan={2}
                        >
                          Closing Balance
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 w-32">
                          Debit (Dr)
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 w-32">
                          Credit (Cr)
                        </th>
                      </>
                    )}
                    {options.showPercentage && (
                      <th
                        className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 w-20"
                        rowSpan={options.displayMode === "detailed" ? 2 : 1}
                      >
                        %
                      </th>
                    )}
                  </tr>
                  {options.displayMode === "detailed" && (
                    <tr className="bg-[#f5f6fa] border-b border-gray-200">
                      <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">
                        Dr
                      </th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">
                        Cr
                      </th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">
                        Dr
                      </th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">
                        Cr
                      </th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">
                        Dr
                      </th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">
                        Cr
                      </th>
                    </tr>
                  )}
                </thead>
              )}
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
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 border-r border-gray-200">
                      GRAND TOTAL
                    </td>
                    {options.displayMode === "detailed" ? (
                      <>
                        <td className="px-3 py-2.5 border-r border-gray-200" colSpan={4}></td>
                        <td className="px-3 py-2.5 border-r border-gray-200 num-cell-bold text-[#1557b0]">
                          {money(totals.totalDr, options.roundOff)}
                        </td>
                        <td className="px-3 py-2.5 border-r border-gray-200 num-cell-bold text-[#1557b0]">
                          {money(totals.totalCr, options.roundOff)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2.5 border-r border-gray-200 num-cell-bold text-[#1557b0]">
                          {money(totals.totalDr, options.roundOff)}
                        </td>
                        <td className="px-3 py-2.5 border-r border-gray-200 num-cell-bold text-[#1557b0]">
                          {money(totals.totalCr, options.roundOff)}
                        </td>
                      </>
                    )}
                    {options.showPercentage && (
                      <td className="px-3 py-2.5 border-r border-gray-200"></td>
                    )}
                  </tr>
                  {!isBalanced && (
                    <tr>
                      <td
                        colSpan={options.displayMode === "detailed" ? 5 : 1}
                        className="num-cell-bold"
                        style={{
                          color: "#dc2626",
                          textAlign: "left",
                          padding: "8px 10px",
                          background: "#fef2f2",
                          borderTop: "2px solid #fca5a5",
                        }}
                      >
                        Difference (should be zero)
                      </td>
                      <td
                        colSpan={2}
                        className="num-cell-bold"
                        style={{
                          color: "#dc2626",
                          background: "#fef2f2",
                          borderTop: "2px solid #fca5a5",
                        }}
                      >
                        {balanceDifference.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      {options.showPercentage && (
                        <td style={{ background: "#fef2f2", borderTop: "2px solid #fca5a5" }}></td>
                      )}
                    </tr>
                  )}
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
