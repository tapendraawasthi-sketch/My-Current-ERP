import React, { useState, useMemo, useCallback, useRef } from "react";
import { useStore } from "../store/useStore";
import * as XLSX from "xlsx";
import toast from "@/lib/appToast";
import { ChevronRight, ChevronDown, ArrowLeft, Settings, Search } from "lucide-react";
import ReportDateRangePicker from "../components/ui/ReportDateRangePicker";
import { ReportEmptyState } from "../components/ReportEmptyState";
import ErpReportModal from "../components/reporting/ErpReportModal";
import { ReportWorkspace } from "@/features/reports";

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
  const { accounts, vouchers, invoices, currentFiscalYear, companySettings } = useStore();

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
  const OptionsModal = () => (
    <ErpReportModal
      open={showOptions}
      title="Trial Balance — Report Options"
      onClose={() => setShowOptions(false)}
      maxWidth="32rem"
      footer={
        <>
          <button
            onClick={() => setShowOptions(false)}
            className="h-8 px-3.5 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            className="h-8 px-3.5 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md"
          >
            Generate Report
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
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
          <label className="block text-[12px] font-medium text-gray-600 mb-1">Group Filter</label>
          <div className="flex gap-4 h-8 items-center">
            <label className="flex items-center gap-1.5 cursor-pointer text-[12px] text-gray-700">
              <input
                type="radio"
                name="groupFilter"
                value="all"
                checked={options.groupFilter === "all"}
                onChange={() => setOpt("groupFilter", "all")}
                className="accent-[var(--ds-action-primary)]"
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
                className="accent-[var(--ds-action-primary)]"
              />
              Specific
            </label>
          </div>
        </div>

        {options.groupFilter === "specific" && (
          <div>
            <label className="block text-[12px] font-medium text-gray-600 mb-1">Select Group</label>
            <select
              value={options.selectedGroupId}
              onChange={(e) => setOpt("selectedGroupId", e.target.value)}
              className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
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

        <div className="flex flex-col gap-2">
          <label className="block text-[12px] font-medium text-gray-600">Additional Options</label>
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
                  className="accent-[var(--ds-action-primary)]"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </ErpReportModal>
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
        className={`border-b border-gray-100 cursor-pointer transition-colors border-l-[3px] ${
          row.type === "ledger"
            ? "border-l-transparent hover:border-l-[var(--ds-action-primary)] hover:bg-gray-50"
            : "border-l-transparent"
        } ${isPrimaryGroup ? "bg-gray-100" : isSubGroup ? "bg-gray-50" : "bg-white"}`}
        onClick={() => drillIntoRow(row)}
      >
        <td className="px-3 py-2.5 border-r border-gray-200">
          <div className={`flex items-center gap-1.5 ${indentPx <= 0 ? "" : indentPx <= 12 ? "pl-3" : indentPx <= 24 ? "pl-6" : indentPx <= 36 ? "pl-9" : "pl-12"}`}>
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
            {row.code && <span className="text-[12px] text-gray-500 font-mono">{row.code}</span>}
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
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="p-4 bg-[var(--ds-surface-muted)] border-b border-gray-200 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={drillBack}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <div>
              <h3 className="text-[14px] font-semibold text-gray-800">Ledger: {acc.name}</h3>
              <p className="text-[12px] text-gray-500">
                {options.fromDate} to {options.toDate}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[12px] font-semibold text-gray-500 uppercase">Closing Balance</p>
            <p
              className={`text-[14px] font-mono font-bold ${closingBal >= 0 ? "text-[var(--ds-action-primary)]" : "text-[var(--ds-action-primary)]"}`}
            >
              {money(Math.abs(closingBal))} {closingBal >= 0 ? "Dr" : "Cr"}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="report-table w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-[var(--ds-surface-muted)] border-b border-gray-200">
                <th className="px-3 py-2.5 text-left border-r border-gray-200 text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-24">
                  Date
                </th>
                <th className="px-3 py-2.5 text-left border-r border-gray-200 text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                  Particulars
                </th>
                <th className="px-3 py-2.5 text-center border-r border-gray-200 text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                  Type
                </th>
                <th className="px-3 py-2.5 text-center border-r border-gray-200 text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-24">
                  Vch No
                </th>
                <th className="px-3 py-2.5 text-right border-r border-gray-200 text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                  Debit
                </th>
                <th className="px-3 py-2.5 text-right border-r border-gray-200 text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                  Credit
                </th>
                <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t, idx) => (
                <tr
                  key={t.id}
                  className={`group cursor-pointer border-b border-gray-100 border-l-[3px] border-l-transparent hover:border-l-[var(--ds-action-primary)] hover:bg-gray-50 ${t.isOpening ? "bg-gray-50 font-medium" : "bg-white"}`}
                  onClick={() => !t.isOpening && t.voucher && drillIntoVoucher(t.voucher)}
                >
                  <td className="px-3 py-2.5 border-r border-gray-200 font-mono text-gray-600">
                    {t.date}
                  </td>
                  <td className="px-3 py-2.5 border-r border-gray-200 text-gray-800">
                    {t.particulars}
                  </td>
                  <td className="px-3 py-2.5 text-center border-r border-gray-200 text-[12px] text-gray-600 uppercase">
                    {t.voucherType}
                  </td>
                  <td className="px-3 py-2.5 text-center border-r border-gray-200 font-mono text-gray-600">
                    {t.voucherNo}
                  </td>
                  <td className="px-3 py-2.5 text-right border-r border-gray-200 number-cell">
                    {t.debit > 0 ? money(t.debit) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right border-r border-gray-200 number-cell">
                    {t.credit > 0 ? money(t.credit) : "—"}
                  </td>
                  <td
                    className={`px-3 py-2.5 number-cell-bold ${t.balance >= 0 ? "text-[var(--ds-action-primary)]" : "text-[var(--ds-action-primary)]"}`}
                  >
                    {money(Math.abs(t.balance))} {t.balance >= 0 ? "Dr" : "Cr"}
                  </td>
                </tr>
              ))}
              <tr className="bg-[var(--ds-surface-muted)] border-t-2 border-[var(--ds-border-default)] font-bold">
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
                  className={`px-3 py-2.5 text-right font-mono ${closingBal >= 0 ? "text-[var(--ds-action-primary)]" : "text-[var(--ds-action-primary)]"}`}
                >
                  {money(Math.abs(closingBal))} {closingBal >= 0 ? "Dr" : "Cr"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 border-t border-gray-200 bg-[var(--ds-surface-muted)] text-[12px] text-gray-500">
          {txns.length} ledger entr{txns.length === 1 ? "y" : "ies"}
        </div>
      </div>
    );
  };

  const VoucherView = () => {
    if (!selectedVoucher) return null;
    const v = selectedVoucher;
    return (
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="p-4 bg-[var(--ds-surface-muted)] border-b border-gray-200 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={drillBack}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <div>
              <h3 className="text-[14px] font-semibold text-gray-800">Voucher: {v.voucherNo}</h3>
              <p className="text-[12px] text-gray-500">
                {v.date} · {v.type?.toUpperCase()} · {v.status?.toUpperCase()}
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-200 bg-gray-50">
          <div>
            <p className="text-[12px] font-semibold text-gray-500 uppercase">Voucher No</p>
            <p className="text-[12px] font-mono text-gray-800 mt-0.5">{v.voucherNo}</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-gray-500 uppercase">Date</p>
            <p className="text-[12px] font-mono text-gray-800 mt-0.5">{v.date}</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-gray-500 uppercase">Type</p>
            <p className="text-[12px] text-gray-800 uppercase mt-0.5">{v.type}</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-gray-500 uppercase">Narration</p>
            <p className="text-[12px] text-gray-800 mt-0.5 truncate">{v.narration || "—"}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="report-table w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-[var(--ds-surface-muted)] border-b border-gray-200">
                <th className="px-3 py-2.5 text-left border-r border-gray-200 text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                  Account
                </th>
                <th className="px-3 py-2.5 text-right border-r border-gray-200 text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                  Debit
                </th>
                <th className="px-3 py-2.5 text-right border-r border-gray-200 text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                  Credit
                </th>
                <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
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
                    <td className="px-3 py-2.5 text-right border-r border-gray-200 number-cell">
                      {Number(line.debit || 0) > 0 ? money(Number(line.debit)) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right border-r border-gray-200 number-cell">
                      {Number(line.credit || 0) > 0 ? money(Number(line.credit)) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{line.narration || "—"}</td>
                  </tr>
                );
              })}
              <tr className="bg-[var(--ds-surface-muted)] border-t-2 border-[var(--ds-border-default)] font-bold">
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

  const tbTab =
    options.displayMode === "detailed" ? "detailed" : options.variant;
  const companyName =
    companySettings?.companyNameEn || companySettings?.companyName || companySettings?.name || "Company";

  return (
    <ReportWorkspace
      title="Account totals check"
      description="Debits and credits should match."
      companyName={companyName}
      periodLabel={
        currentDrill.type === "tb"
          ? `${options.fromDate} to ${options.toDate}`
          : currentDrill.type === "ledger"
            ? `Ledger: ${selectedAccount?.name}`
            : `Voucher: ${selectedVoucher?.voucherNo}`
      }
      status={
        currentDrill.type === "tb" && generated
          ? isBalanced
            ? { tone: "success", label: "Accounts match" }
            : { tone: "danger", label: `Out by Rs. ${balanceDifference.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
          : undefined
      }
      onPrint={currentDrill.type === "tb" && generated ? handlePrint : undefined}
      onExportExcel={currentDrill.type === "tb" && generated ? handleExportExcel : undefined}
      onOptions={currentDrill.type === "tb" ? () => setShowOptions(true) : undefined}
      tabs={
        currentDrill.type === "tb" && generated
          ? [
              { key: "closing-alphabetical", label: "By name" },
              { key: "closing-groupwise", label: "By group" },
              { key: "opening", label: "Opening" },
              { key: "detailed", label: "Detailed" },
            ]
          : undefined
      }
      activeTab={currentDrill.type === "tb" && generated ? tbTab : undefined}
      onTabChange={
        currentDrill.type === "tb" && generated
          ? (key) => {
              if (key === "detailed") {
                setOpt("variant", "closing-groupwise");
                setOpt("displayMode", "detailed");
              } else {
                setOpt("variant", key as TBVariant);
                setOpt("displayMode", "balance-only");
              }
            }
          : undefined
      }
    >
      <OptionsModal />

      {currentDrill.type === "tb" && generated && (
        <div
          className="border border-gray-300 bg-white overflow-hidden"
          ref={printRef}
        >
          <div className="no-print px-4 py-2.5 border-b border-gray-200 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accounts…"
                className="h-8 pl-8 pr-3 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
              />
            </div>
            <span className="text-[12px] text-gray-500">
              {flatRows.length} account{flatRows.length === 1 ? "" : "s"}
            </span>
            {isBalanced ? (
              <span className="rounded px-2 py-0.5 text-[12px] font-semibold uppercase bg-green-50 text-green-700 border border-green-200">
                Balanced
              </span>
            ) : (
              <span className="rounded px-2 py-0.5 text-[12px] font-semibold uppercase bg-red-50 text-red-700 border border-red-200">
                Unbalanced
              </span>
            )}
          </div>

          {flatRows.length === 0 ? (
            <ReportEmptyState
              message="No accounts match the selected filters"
              hint="Adjust the date range, group filter, or search term."
            />
          ) : (
          <>
          <div className="overflow-x-auto">
            <table
              className="report-table w-full border-collapse"
              style={{ tableLayout: "fixed", width: "100%" }}
            >
              <colgroup>
                {options.displayMode === "detailed" ? (
                  <>
                    <col className="w-[34%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                  </>
                ) : (
                  <>
                    <col className="w-[60%]" />
                    <col className="w-[20%]" />
                    <col className="w-[20%]" />
                  </>
                )}
              </colgroup>
              {options.showPrevYear ? (
                <thead>
                  <tr className="bg-[var(--ds-surface-muted)] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200" />
                    <th className="px-3 py-2 text-center text-[12px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200" colSpan={2}>
                      Previous year
                    </th>
                    <th
                      className="px-3 py-2 text-center text-[12px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200"
                      colSpan={options.displayMode === "detailed" ? 6 : 2}
                    >
                      Current year
                    </th>
                    {options.showPercentage && (
                      <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide" />
                    )}
                  </tr>
                  <tr className="bg-[var(--ds-surface-muted)] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">
                      Account Name
                    </th>
                    <th className="px-3 py-1.5 text-right text-[12px] font-semibold text-gray-500 uppercase border-r border-gray-200">
                      Prev Dr
                    </th>
                    <th className="px-3 py-1.5 text-right text-[12px] font-semibold text-gray-500 uppercase border-r border-gray-200">
                      Prev Cr
                    </th>
                    {options.displayMode === "detailed" ? (
                      <>
                        <th className="px-3 py-1.5 text-right text-[12px] font-semibold text-gray-500 uppercase border-r border-gray-200">Op Dr</th>
                        <th className="px-3 py-1.5 text-right text-[12px] font-semibold text-gray-500 uppercase border-r border-gray-200">Op Cr</th>
                        <th className="px-3 py-1.5 text-right text-[12px] font-semibold text-gray-500 uppercase border-r border-gray-200">Txn Dr</th>
                        <th className="px-3 py-1.5 text-right text-[12px] font-semibold text-gray-500 uppercase border-r border-gray-200">Txn Cr</th>
                        <th className="px-3 py-1.5 text-right text-[12px] font-semibold text-gray-500 uppercase border-r border-gray-200">Cl Dr</th>
                        <th className="px-3 py-1.5 text-right text-[12px] font-semibold text-gray-500 uppercase border-r border-gray-200">Cl Cr</th>
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 w-32">Debit (Dr)</th>
                        <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 w-32">Credit (Cr)</th>
                      </>
                    )}
                    {options.showPercentage && (
                      <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-20">%</th>
                    )}
                  </tr>
                </thead>
              ) : (
                <thead>
                  <tr className="bg-[var(--ds-surface-muted)] border-b border-gray-200">
                    <th
                      className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200"
                      rowSpan={options.displayMode === "detailed" ? 2 : 1}
                    >
                      Account Name
                    </th>
                    {options.displayMode === "detailed" ? (
                      <>
                        <th
                          className="px-3 py-2.5 text-center text-[12px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 border-b border-gray-200"
                          colSpan={2}
                        >
                          Opening Balance
                        </th>
                        <th
                          className="px-3 py-2.5 text-center text-[12px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 border-b border-gray-200"
                          colSpan={2}
                        >
                          Transactions
                        </th>
                        <th
                          className="px-3 py-2.5 text-center text-[12px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 border-b border-gray-200"
                          colSpan={2}
                        >
                          Closing Balance
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 w-32">
                          Debit (Dr)
                        </th>
                        <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 w-32">
                          Credit (Cr)
                        </th>
                      </>
                    )}
                    {options.showPercentage && (
                      <th
                        className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 w-20"
                        rowSpan={options.displayMode === "detailed" ? 2 : 1}
                      >
                        %
                      </th>
                    )}
                  </tr>
                  {options.displayMode === "detailed" && (
                    <tr className="bg-[var(--ds-surface-muted)] border-b border-gray-200">
                      <th className="px-3 py-1.5 text-right text-[12px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">
                        Dr
                      </th>
                      <th className="px-3 py-1.5 text-right text-[12px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">
                        Cr
                      </th>
                      <th className="px-3 py-1.5 text-right text-[12px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">
                        Dr
                      </th>
                      <th className="px-3 py-1.5 text-right text-[12px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">
                        Cr
                      </th>
                      <th className="px-3 py-1.5 text-right text-[12px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">
                        Dr
                      </th>
                      <th className="px-3 py-1.5 text-right text-[12px] font-semibold text-gray-500 uppercase border-r border-gray-200 w-28">
                        Cr
                      </th>
                    </tr>
                  )}
                </thead>
              )}
              <tbody>
                {flatRows.map((row, idx) => renderRow(row, idx))}
              </tbody>
              <tfoot>
                  <tr className="bg-[var(--ds-surface-muted)] border-t-2 border-[var(--ds-border-default)] font-bold">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 border-r border-gray-200">
                      GRAND TOTAL
                    </td>
                    {options.displayMode === "detailed" ? (
                      <>
                        <td className="px-3 py-2.5 border-r border-gray-200" colSpan={4}></td>
                        <td className="px-3 py-2.5 border-r border-gray-200 num-cell-bold text-[var(--ds-action-primary)]">
                          {money(totals.totalDr, options.roundOff)}
                        </td>
                        <td className="px-3 py-2.5 border-r border-gray-200 num-cell-bold text-[var(--ds-action-primary)]">
                          {money(totals.totalCr, options.roundOff)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2.5 border-r border-gray-200 num-cell-bold text-[var(--ds-action-primary)]">
                          {money(totals.totalDr, options.roundOff)}
                        </td>
                        <td className="px-3 py-2.5 border-r border-gray-200 num-cell-bold text-[var(--ds-action-primary)]">
                          {money(totals.totalCr, options.roundOff)}
                        </td>
                      </>
                    )}
                    {options.showPercentage && (
                      <td className="px-3 py-2.5 border-r border-gray-200"></td>
                    )}
                  </tr>
                  {!isBalanced && (
                    <tr className="bg-red-50 border-t-2 border-red-200">
                      <td
                        colSpan={options.displayMode === "detailed" ? 5 : 1}
                        className="px-3 py-2 text-[12px] font-semibold text-red-700"
                      >
                        Difference (should be zero)
                      </td>
                      <td
                        colSpan={2}
                        className="px-3 py-2 text-right font-mono text-[12px] font-semibold text-red-700"
                      >
                        {balanceDifference.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      {options.showPercentage && <td className="bg-red-50" />}
                    </tr>
                  )}
                </tfoot>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-gray-200 bg-[var(--ds-surface-muted)] text-[12px] text-gray-500">
            {flatRows.length} trial balance row{flatRows.length === 1 ? "" : "s"}
          </div>
          </>
          )}
        </div>
      )}

      {currentDrill.type === "tb" && !generated && (
        <div className="bg-white border border-gray-200 rounded-md">
          <ReportEmptyState
            message="Trial balance not generated"
            hint='Open Options and click "Generate Report" to view balances.'
          />
        </div>
      )}

      {currentDrill.type === "ledger" && <LedgerView />}
      {currentDrill.type === "voucher" && <VoucherView />}
    </ReportWorkspace>
  );
}
