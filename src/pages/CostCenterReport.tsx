// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "@/lib/appToast";
import {
  Download,
  Printer,
  Plus,
  Save,
  Trash2,
  Building,
  ArrowRightLeft,
  PieChart,
  FileText,
} from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const cardClass = "bg-white border border-gray-200 rounded-md p-4";
const tableHeadClass =
  "bg-[#f5f6fa] border-b border-gray-200 px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const tableCellClass = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";

const primaryBtn =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors";
const outlineBtn =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5";
const inputClass =
  "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] transition-shadow";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function monthStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

function accountForLine(line: any, accounts: any[]) {
  return (
    accounts.find((a) => a.id === line.accountId) ||
    accounts.find((a) => a.name === line.accountName) ||
    {}
  );
}

function Modal({ open, title, children, onClose, wide = false }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white border border-gray-200 shadow-xl rounded-lg w-full flex flex-col max-h-[90vh] ${wide ? "max-w-5xl" : "max-w-2xl"}`}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <h2 className="text-[15px] font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function computeCCPL(
  vouchers: any[],
  accounts: any[],
  ccId: string,
  fromDate: string,
  toDate: string,
) {
  const result: Record<string, any> = {};

  (vouchers || [])
    .filter((v) => v.status === "posted" && v.date >= fromDate && v.date <= toDate)
    .forEach((v) => {
      (v.lines || []).forEach((line) => {
        if (ccId !== "all" && line.costCenterId !== ccId) return;

        const acc = accountForLine(line, accounts);
        if (!["income", "expense"].includes(acc.type)) return;

        const key = acc.id || acc.name || line.accountName;
        if (!result[key]) {
          result[key] = {
            accountId: acc.id || "",
            accountName: acc.name || line.accountName || "Unknown",
            type: acc.type,
            amount: 0,
          };
        }

        if (acc.type === "income") {
          result[key].amount += Number(line.credit || 0) - Number(line.debit || 0);
        } else if (acc.type === "expense") {
          result[key].amount += Number(line.debit || 0) - Number(line.credit || 0);
        }
      });
    });

  const rows = Object.values(result);
  const income = rows.filter((r: any) => r.type === "income");
  const expenses = rows.filter((r: any) => r.type === "expense");
  const totalIncome = income.reduce((s: number, r: any) => s + r.amount, 0);
  const totalExpenses = expenses.reduce((s: number, r: any) => s + r.amount, 0);

  return { income, expenses, totalIncome, totalExpenses, net: totalIncome - totalExpenses };
}

function computeAccountCCMatrix(
  vouchers: any[],
  accounts: any[],
  costCenters: any[],
  fromDate: string,
  toDate: string,
) {
  const rowsMap: Record<string, any> = {};

  (accounts || [])
    .filter((a) => ["income", "expense"].includes(a.type))
    .forEach((a) => {
      rowsMap[a.id || a.name] = {
        accountId: a.id,
        accountName: a.name,
        type: a.type,
        values: {},
        total: 0,
      };
      costCenters.forEach((cc) => {
        rowsMap[a.id || a.name].values[cc.id] = 0;
      });
    });

  (vouchers || [])
    .filter((v) => v.status === "posted" && v.date >= fromDate && v.date <= toDate)
    .forEach((v) => {
      (v.lines || []).forEach((line) => {
        const acc = accountForLine(line, accounts);
        if (!["income", "expense"].includes(acc.type)) return;
        const key = acc.id || acc.name;
        if (!rowsMap[key]) return;

        const amount =
          acc.type === "income"
            ? Number(line.credit || 0) - Number(line.debit || 0)
            : Number(line.debit || 0) - Number(line.credit || 0);

        const ccId = line.costCenterId || "unassigned";
        if (rowsMap[key].values[ccId] === undefined) rowsMap[key].values[ccId] = 0;
        rowsMap[key].values[ccId] += amount;
        rowsMap[key].total += amount;
      });
    });

  return Object.values(rowsMap).filter((r: any) => Math.abs(r.total) > 0.01);
}

export default function CostCenterReport() {
  const {
    accounts = [],
    vouchers = [],
    costCenters = [],
    currentFiscalYear = {},
    currentUser = {},
    addVoucher,
    employees = [],
  } = useStore();
  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();

  const [activeTab, setActiveTab] = useState("Cost Center P&L");
  const [fromDate, setFromDate] = useState(currentFiscalYear?.startDate || monthStartISO());
  const [toDate, setToDate] = useState(todayISO());
  const [selectedCC, setSelectedCC] = useState("all");

  const [rules, setRules] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [ruleModal, setRuleModal] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    expenseAccountId: "",
    method: "Fixed %",
    effectiveFrom: monthStartISO(),
    effectiveTo: "",
    allocations: [],
  });

  const [allocationPeriod, setAllocationPeriod] = useState(monthStartISO());
  const [allocationPreview, setAllocationPreview] = useState(null);

  const [transferForm, setTransferForm] = useState({
    fromCostCenterId: "",
    expenseAccountId: "",
    period: monthStartISO().slice(0, 7),
    totalAmount: "",
    narration: "",
    receivers: [],
  });
  const [transferHistory, setTransferHistory] = useState([]);

  const [budgetCC, setBudgetCC] = useState("");
  const [selectedBudgetFY, setSelectedBudgetFY] = useState(currentFiscalYear?.name || "");

  const scopedVouchers = useMemo(
    () => (vouchers || []).filter((v) => matchBranch(v.branchId)),
    [vouchers, matchBranch, branchFilter],
  );

  const visibleCostCenters = useMemo(() => {
    if (currentUser?.costCenterId && currentUser.role !== "admin") {
      return costCenters.filter((c) => c.id === currentUser.costCenterId);
    }
    return costCenters;
  }, [costCenters, currentUser]);

  useEffect(() => {
    if (currentUser?.costCenterId && currentUser.role !== "admin") {
      setSelectedCC(currentUser.costCenterId);
      setBudgetCC(currentUser.costCenterId);
    }
  }, [currentUser]);

  useEffect(() => {
    const db = getDB();
    db.table("costAllocationRules")
      .toArray()
      .catch(() => [])
      .then(setRules);
    db.table("budgets")
      .toArray()
      .catch(() => [])
      .then(setBudgets);
    db.table("interDepartmentTransfers")
      .toArray()
      .catch(() => [])
      .then(setTransferHistory);
  }, []);

  const selectedPL = useMemo(() => {
    if (selectedCC === "all") return null;
    return computeCCPL(scopedVouchers, accounts, selectedCC, fromDate, toDate);
  }, [scopedVouchers, accounts, selectedCC, fromDate, toDate]);

  const matrix = useMemo(() => {
    return computeAccountCCMatrix(scopedVouchers, accounts, visibleCostCenters, fromDate, toDate);
  }, [scopedVouchers, accounts, visibleCostCenters, fromDate, toDate]);

  const matrixTotals = useMemo(() => {
    const totals: any = {};
    visibleCostCenters.forEach((cc) => {
      const income = matrix
        .filter((r: any) => r.type === "income")
        .reduce((s: number, r: any) => s + Number(r.values[cc.id] || 0), 0);
      const expense = matrix
        .filter((r: any) => r.type === "expense")
        .reduce((s: number, r: any) => s + Number(r.values[cc.id] || 0), 0);
      totals[cc.id] = { income, expense, net: income - expense };
    });

    totals.total = {
      income: Object.values(totals).reduce((s: number, x: any) => s + Number(x.income || 0), 0),
      expense: Object.values(totals).reduce((s: number, x: any) => s + Number(x.expense || 0), 0),
    };
    totals.total.net = totals.total.income - totals.total.expense;
    return totals;
  }, [matrix, visibleCostCenters]);

  function openRuleModal() {
    setRuleForm({
      expenseAccountId: "",
      method: "Fixed %",
      effectiveFrom: monthStartISO(),
      effectiveTo: "",
      allocations: [{ costCenterId: visibleCostCenters[0]?.id || "", percentage: 100 }],
    });
    setRuleModal(true);
  }

  function updateRuleAllocation(index: number, changes: any) {
    setRuleForm((f) => {
      const rows = [...(f.allocations || [])];
      rows[index] = { ...rows[index], ...changes };
      return { ...f, allocations: rows };
    });
  }

  function addRuleAllocation() {
    setRuleForm((f) => ({
      ...f,
      allocations: [...(f.allocations || []), { costCenterId: "", percentage: 0 }],
    }));
  }

  function removeRuleAllocation(index: number) {
    setRuleForm((f) => ({
      ...f,
      allocations: (f.allocations || []).filter((_, i) => i !== index),
    }));
  }

  async function saveRule() {
    if (!ruleForm.expenseAccountId) return toast.error("Select expense account");

    if (ruleForm.method === "Fixed %") {
      const totalPct = ruleForm.allocations.reduce((s, a) => s + Number(a.percentage || 0), 0);
      if (Math.abs(totalPct - 100) > 0.01) return toast.error("Fixed percentages must total 100%");
    }

    const row = {
      id: generateId(),
      ...ruleForm,
      createdAt: new Date().toISOString(),
    };

    await getDB()
      .table("costAllocationRules")
      .put(row)
      .catch(() => {});
    setRules((r) => [...r, row]);
    setRuleModal(false);
    toast.success("Allocation rule saved");
  }

  async function deleteRule(id: string) {
    if (!confirm("Delete allocation rule?")) return;
    await getDB()
      .table("costAllocationRules")
      .delete(id)
      .catch(() => {});
    setRules((r) => r.filter((x) => x.id !== id));
    toast.success("Rule deleted");
  }

  function buildAllocationPreview(rule: any) {
    const account = accounts.find((a) => a.id === rule.expenseAccountId);
    const month = allocationPeriod.slice(0, 7);
    const periodStart = month + "-01";
    const periodEnd = month + "-31";

    const amount = (scopedVouchers || [])
      .filter((v) => v.status === "posted" && v.date >= periodStart && v.date <= periodEnd)
      .flatMap((v) => v.lines || [])
      .filter((l) => l.accountId === rule.expenseAccountId || l.accountName === account?.name)
      .reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0);

    let allocations = [];

    if (rule.method === "Fixed %") {
      allocations = (rule.allocations || []).map((a) => ({
        costCenterId: a.costCenterId,
        amount: (amount * Number(a.percentage || 0)) / 100,
        percentage: Number(a.percentage || 0),
      }));
    } else if (rule.method === "Headcount") {
      const counts: any = {};
      visibleCostCenters.forEach((cc) => (counts[cc.id] = 0));
      employees.forEach((e) => {
        if (counts[e.costCenterId] !== undefined) counts[e.costCenterId] += 1;
      });
      const total = Object.values(counts).reduce((s: number, v: any) => s + Number(v || 0), 0) || 1;
      allocations = visibleCostCenters.map((cc) => ({
        costCenterId: cc.id,
        amount: (amount * counts[cc.id]) / total,
        percentage: (counts[cc.id] / total) * 100,
      }));
    } else {
      const revenueByCC: any = {};
      visibleCostCenters.forEach((cc) => {
        revenueByCC[cc.id] = computeCCPL(
          scopedVouchers,
          accounts,
          cc.id,
          periodStart,
          periodEnd,
        ).totalIncome;
      });
      const totalRev =
        Object.values(revenueByCC).reduce((s: number, v: any) => s + Number(v || 0), 0) || 1;
      allocations = visibleCostCenters.map((cc) => ({
        costCenterId: cc.id,
        amount: (amount * revenueByCC[cc.id]) / totalRev,
        percentage: (revenueByCC[cc.id] / totalRev) * 100,
      }));
    }

    setAllocationPreview({
      rule,
      account,
      totalAmount: amount,
      allocations,
      periodStart,
      periodEnd,
    });
  }

  async function postAllocationJournal() {
    const p = allocationPreview;
    if (!p) return;

    const voucher = {
      id: generateId(),
      type: "journal",
      status: "posted",
      date: p.periodEnd,
      narration: `Cost allocation for ${p.account?.name || "expense"} ${p.periodStart} to ${p.periodEnd}`,
      lines: p.allocations.map((a) => ({
        id: generateId(),
        accountId: p.account?.id,
        accountName: p.account?.name,
        costCenterId: a.costCenterId,
        debit: Number(a.amount || 0),
        credit: 0,
      })),
      totalDebit: p.totalAmount,
      totalCredit: p.totalAmount,
    };

    if (addVoucher) await addVoucher(voucher);
    else
      await getDB()
        .table("vouchers")
        .put(voucher)
        .catch(() => {});

    toast.success("Allocation journal posted");
    setAllocationPreview(null);
  }

  function addReceiver() {
    setTransferForm((f) => ({
      ...f,
      receivers: [...(f.receivers || []), { costCenterId: "", percentage: 100, amount: "" }],
    }));
  }

  function updateReceiver(index: number, changes: any) {
    setTransferForm((f) => {
      const rows = [...(f.receivers || [])];
      rows[index] = { ...rows[index], ...changes };
      return { ...f, receivers: rows };
    });
  }

  function removeReceiver(index: number) {
    setTransferForm((f) => ({
      ...f,
      receivers: (f.receivers || []).filter((_, i) => i !== index),
    }));
  }

  const transferPreview = useMemo(() => {
    const total = Number(transferForm.totalAmount || 0);
    const account = accounts.find((a) => a.id === transferForm.expenseAccountId);
    const fromCC = costCenters.find((c) => c.id === transferForm.fromCostCenterId);

    const receivers = (transferForm.receivers || []).map((r) => {
      const amount =
        r.amount !== "" ? Number(r.amount || 0) : (total * Number(r.percentage || 0)) / 100;
      return {
        ...r,
        amount,
        costCenter: costCenters.find((c) => c.id === r.costCenterId),
      };
    });

    const receiverTotal = receivers.reduce((s, r) => s + Number(r.amount || 0), 0);

    return { total, account, fromCC, receivers, receiverTotal };
  }, [transferForm, accounts, costCenters]);

  async function postTransfer() {
    if (!transferForm.fromCostCenterId) return toast.error("Select from cost center");
    if (!transferForm.expenseAccountId) return toast.error("Select expense account");
    if (!transferPreview.receivers.length) return toast.error("Add receiving cost centers");
    if (Math.abs(transferPreview.receiverTotal - transferPreview.total) > 1) {
      return toast.error("Receiver amount total must equal total amount");
    }

    const date = transferForm.period + "-28";
    const voucher = {
      id: generateId(),
      type: "journal",
      status: "posted",
      date,
      narration: transferForm.narration || `Inter-department transfer ${transferForm.period}`,
      lines: [
        ...transferPreview.receivers.map((r) => ({
          id: generateId(),
          accountId: transferPreview.account?.id,
          accountName: transferPreview.account?.name,
          costCenterId: r.costCenterId,
          debit: r.amount,
          credit: 0,
        })),
        {
          id: generateId(),
          accountId: transferPreview.account?.id,
          accountName: transferPreview.account?.name,
          costCenterId: transferForm.fromCostCenterId,
          debit: 0,
          credit: transferPreview.receiverTotal,
        },
      ],
      totalDebit: transferPreview.receiverTotal,
      totalCredit: transferPreview.receiverTotal,
    };

    if (addVoucher) await addVoucher(voucher);
    else
      await getDB()
        .table("vouchers")
        .put(voucher)
        .catch(() => {});

    const historyRow = {
      id: generateId(),
      date,
      fromCostCenterId: transferForm.fromCostCenterId,
      toCostCenters: transferPreview.receivers.map((r) => r.costCenterId),
      expenseAccountId: transferForm.expenseAccountId,
      amount: transferPreview.receiverTotal,
      voucherNo: voucher.id,
      narration: voucher.narration,
    };

    await getDB()
      .table("interDepartmentTransfers")
      .put(historyRow)
      .catch(() => {});
    setTransferHistory((h) => [...h, historyRow]);
    toast.success("Inter-department transfer posted");

    // Reset Form
    setTransferForm({
      fromCostCenterId: "",
      expenseAccountId: "",
      period: monthStartISO().slice(0, 7),
      totalAmount: "",
      narration: "",
      receivers: [],
    });
  }

  const budgetRows = useMemo(() => {
    const ccId = budgetCC || visibleCostCenters[0]?.id;
    if (!ccId) return [];

    const fyStart = currentFiscalYear?.startDate || monthStartISO();
    const fyEnd = todayISO();
    const fyTotalDays = Math.max(
      1,
      Math.floor(
        (new Date(currentFiscalYear?.endDate || todayISO()).getTime() -
          new Date(fyStart).getTime()) /
          86400000,
      ),
    );
    const elapsedDays = Math.max(
      1,
      Math.floor((new Date(fyEnd).getTime() - new Date(fyStart).getTime()) / 86400000),
    );
    const prorate = elapsedDays / fyTotalDays;

    const ccBudget = budgets.filter(
      (b) =>
        b.costCenterId === ccId ||
        (b.type === "Department Budget" && b.departmentId === ccId) ||
        (b.type === "Department Budget" && b.costCenter === ccId),
    );

    const actual = computeCCPL(scopedVouchers, accounts, ccId, fyStart, fyEnd);
    const actualMap: any = {};
    [...actual.income, ...actual.expenses].forEach((r: any) => {
      actualMap[r.accountId || r.accountName] = r.amount;
    });

    const budgetLines = ccBudget.flatMap((b) => b.lines || b.accounts || []);

    return budgetLines.map((line) => {
      const account =
        accounts.find((a) => a.id === line.accountId) ||
        accounts.find((a) => a.name === line.accountName) ||
        {};
      const annualBudget = Number(line.amount || line.budgetAmount || line.annualBudget || 0);
      const budgetYTD = annualBudget * prorate;
      const actualYTD = Number(actualMap[account.id] || actualMap[account.name] || 0);
      const variance = budgetYTD - actualYTD;
      const pctVariance = budgetYTD ? (variance / budgetYTD) * 100 : 0;
      const status =
        Math.abs(pctVariance) <= 10 ? "On Track" : variance < 0 ? "Over Budget" : "Under Budget";
      return { account, annualBudget, budgetYTD, actualYTD, variance, pctVariance, status };
    });
  }, [budgetCC, budgets, visibleCostCenters, currentFiscalYear, scopedVouchers, accounts]);

  const maxBudgetActual = useMemo(() => {
    return Math.max(...budgetRows.map((r) => Math.max(r.annualBudget, r.actualYTD)), 1);
  }, [budgetRows]);

  function exportCostCenterPL() {
    const wb = XLSX.utils.book_new();

    if (selectedCC !== "all") {
      const data = [
        ...selectedPL.income.map((r) => ({
          Section: "Income",
          Account: r.accountName,
          Amount: r.amount,
        })),
        { Section: "Income Total", Account: "", Amount: selectedPL.totalIncome },
        ...selectedPL.expenses.map((r) => ({
          Section: "Expenses",
          Account: r.accountName,
          Amount: r.amount,
        })),
        { Section: "Expense Total", Account: "", Amount: selectedPL.totalExpenses },
        { Section: "Net", Account: "", Amount: selectedPL.net },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Cost Center PL");
    } else {
      const data = matrix.map((r: any) => {
        const row: any = { Account: r.accountName, Type: r.type };
        visibleCostCenters.forEach((cc) => (row[cc.name] = r.values[cc.id] || 0));
        row.Total = r.total;
        return row;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Cost Center Matrix");
    }

    XLSX.writeFile(wb, "Cost_Center_Report.xlsx");
  }

  function printPage() {
    window.print();
  }

  if (!costCenters || costCenters.length === 0) {
    return (
      <div className="min-h-screen bg-[#f5f6fa] p-4 text-gray-800">
        <div className={cardClass}>
          <h1 className="text-[15px] font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Building size={18} className="text-[var(--ds-action-primary)]" /> Cost Center Report
          </h1>
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-4 text-[12px]">
            <div className="font-semibold mb-1">No cost centers configured.</div>
            <div>
              Create cost centers in Masters to use department-wise reports, allocations, and
              budgets.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalRulePct = ruleForm.allocations.reduce((s, a) => s + Number(a.percentage || 0), 0);

  const tabs = [
    { id: "Cost Center P&L", label: "Cost Center P&L", icon: <FileText size={14} /> },
    { id: "Allocation Setup", label: "Allocation Setup", icon: <PieChart size={14} /> },
    { id: "Inter-Department Transfer", label: "Transfers", icon: <ArrowRightLeft size={14} /> },
    { id: "Cost Center Budget", label: "Cost Center Budget", icon: <Building size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4 text-gray-800">
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
          }
        `}
      </style>

      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Building size={18} className="text-[var(--ds-action-primary)]" /> Cost Center Report
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Department-wise profit and loss, allocation, transfers and budgets.
          </p>
        </div>

        <div className="flex gap-2">
          <button className={outlineBtn} onClick={exportCostCenterPL}>
            <Download size={14} /> Export
          </button>
          <button className={primaryBtn} onClick={printPage}>
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200 no-print overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t.id
                ? "border-[var(--ds-action-primary)] text-[var(--ds-action-primary)]"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "Cost Center P&L" && (
        <div className="space-y-6">
          <div className={`${cardClass} no-print`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Cost Center
                </label>
                <select
                  className={inputClass}
                  value={selectedCC}
                  onChange={(e) => setSelectedCC(e.target.value)}
                >
                  {!currentUser?.costCenterId || currentUser.role === "admin" ? (
                    <option value="all">All Cost Centers (Matrix)</option>
                  ) : null}
                  {visibleCostCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  From Date
                </label>
                <input
                  className={inputClass}
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">To Date</label>
                <input
                  className={inputClass}
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>

              {branchOptions.length > 0 && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Branch</label>
                  <select
                    className={inputClass}
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    aria-label="Branch"
                  >
                    <option value="all">All branches</option>
                    {branchOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name || b.code || b.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {selectedCC !== "all" && selectedPL && (
            <div className={cardClass}>
              <h2 className="text-[14px] font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                P&L for{" "}
                <span className="text-[var(--ds-action-primary)]">
                  {costCenters.find((c) => c.id === selectedCC)?.name}
                </span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-[12px] font-semibold bg-gray-50 border border-gray-200 px-3 py-2 rounded-t-md text-gray-700 uppercase tracking-wide">
                    Income
                  </h3>
                  <div className="border border-t-0 border-gray-200 rounded-b-md overflow-hidden">
                    <table className="w-full border-collapse">
                      <tbody className="divide-y divide-gray-100">
                        {selectedPL.income.map((r) => (
                          <tr key={r.accountId || r.accountName} className="hover:bg-gray-50">
                            <td className={tableCellClass}>{r.accountName}</td>
                            <td className={`${tableCellClass} text-right font-medium`}>
                              {money(r.amount)}
                            </td>
                          </tr>
                        ))}
                        {selectedPL.income.length === 0 && (
                          <tr>
                            <td
                              colSpan={2}
                              className={`${tableCellClass} text-center text-gray-400 italic`}
                            >
                              No income data
                            </td>
                          </tr>
                        )}
                        <tr className="bg-gray-50/80">
                          <td
                            className={`${tableCellClass} font-bold text-gray-800 uppercase tracking-wide`}
                          >
                            Total Income
                          </td>
                          <td className={`${tableCellClass} text-right font-bold text-gray-900`}>
                            {money(selectedPL.totalIncome)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-[12px] font-semibold bg-gray-50 border border-gray-200 px-3 py-2 rounded-t-md text-gray-700 uppercase tracking-wide">
                    Expenses
                  </h3>
                  <div className="border border-t-0 border-gray-200 rounded-b-md overflow-hidden">
                    <table className="w-full border-collapse">
                      <tbody className="divide-y divide-gray-100">
                        {selectedPL.expenses.map((r) => (
                          <tr key={r.accountId || r.accountName} className="hover:bg-gray-50">
                            <td className={tableCellClass}>{r.accountName}</td>
                            <td className={`${tableCellClass} text-right font-medium`}>
                              {money(r.amount)}
                            </td>
                          </tr>
                        ))}
                        {selectedPL.expenses.length === 0 && (
                          <tr>
                            <td
                              colSpan={2}
                              className={`${tableCellClass} text-center text-gray-400 italic`}
                            >
                              No expense data
                            </td>
                          </tr>
                        )}
                        <tr className="bg-gray-50/80">
                          <td
                            className={`${tableCellClass} font-bold text-gray-800 uppercase tracking-wide`}
                          >
                            Total Expenses
                          </td>
                          <td className={`${tableCellClass} text-right font-bold text-gray-900`}>
                            {money(selectedPL.totalExpenses)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div
                className={`p-4 rounded-md border flex items-center justify-between ${selectedPL.net >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
              >
                <div
                  className={`text-[14px] font-bold uppercase tracking-wide ${selectedPL.net >= 0 ? "text-green-800" : "text-red-800"}`}
                >
                  Net Profit / (Loss)
                </div>
                <div
                  className={`text-[20px] font-bold ${selectedPL.net >= 0 ? "text-green-700" : "text-red-700"}`}
                >
                  Rs. {money(selectedPL.net)}
                </div>
              </div>
            </div>
          )}

          {selectedCC === "all" && (
            <div className={cardClass}>
              <h2 className="text-[14px] font-semibold text-gray-800 mb-4">
                Cost Center Comparison Matrix
              </h2>
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={tableHeadClass}>Account Name</th>
                      {visibleCostCenters.map((cc) => (
                        <th key={cc.id} className={`${tableHeadClass} text-right`}>
                          {cc.name}
                        </th>
                      ))}
                      <th className={`${tableHeadClass} text-right bg-gray-100`}>Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {matrix.map((r: any) => (
                      <tr key={r.accountId || r.accountName} className="hover:bg-gray-50">
                        <td className={`${tableCellClass} font-medium`}>{r.accountName}</td>
                        {visibleCostCenters.map((cc) => (
                          <td key={cc.id} className={`${tableCellClass} text-right`}>
                            {money(r.values[cc.id] || 0)}
                          </td>
                        ))}
                        <td className={`${tableCellClass} text-right font-bold bg-gray-50/50`}>
                          {money(r.total)}
                        </td>
                      </tr>
                    ))}

                    {matrix.length === 0 && (
                      <tr>
                        <td
                          colSpan={visibleCostCenters.length + 2}
                          className="p-8 text-center text-gray-500 text-[12px]"
                        >
                          No data found for selected period
                        </td>
                      </tr>
                    )}

                    {matrix.length > 0 && (
                      <>
                        <tr className="bg-gray-50/80 border-t-2 border-gray-200">
                          <td
                            className={`${tableCellClass} font-bold text-gray-800 uppercase tracking-wide`}
                          >
                            Income Total
                          </td>
                          {visibleCostCenters.map((cc) => (
                            <td key={cc.id} className={`${tableCellClass} text-right font-bold`}>
                              {money(matrixTotals[cc.id]?.income || 0)}
                            </td>
                          ))}
                          <td className={`${tableCellClass} text-right font-bold bg-gray-100`}>
                            {money(matrixTotals.total?.income || 0)}
                          </td>
                        </tr>

                        <tr className="bg-gray-50/80">
                          <td
                            className={`${tableCellClass} font-bold text-gray-800 uppercase tracking-wide`}
                          >
                            Expense Total
                          </td>
                          {visibleCostCenters.map((cc) => (
                            <td key={cc.id} className={`${tableCellClass} text-right font-bold`}>
                              {money(matrixTotals[cc.id]?.expense || 0)}
                            </td>
                          ))}
                          <td className={`${tableCellClass} text-right font-bold bg-gray-100`}>
                            {money(matrixTotals.total?.expense || 0)}
                          </td>
                        </tr>

                        <tr className="bg-blue-50/50 border-t-2 border-[#c7d2fe]">
                          <td
                            className={`${tableCellClass} font-bold text-[var(--ds-action-primary)] uppercase tracking-wide`}
                          >
                            Net Profit
                          </td>
                          {visibleCostCenters.map((cc) => (
                            <td
                              key={cc.id}
                              className={`${tableCellClass} text-right font-bold ${
                                matrixTotals[cc.id]?.net >= 0 ? "text-green-700" : "text-red-700"
                              }`}
                            >
                              {money(matrixTotals[cc.id]?.net || 0)}
                            </td>
                          ))}
                          <td
                            className={`${tableCellClass} text-right font-bold bg-[#eef2ff] ${matrixTotals.total?.net >= 0 ? "text-green-700" : "text-red-700"}`}
                          >
                            {money(matrixTotals.total?.net || 0)}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "Allocation Setup" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`${cardClass} lg:col-span-2`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-semibold text-gray-800">Allocation Rules</h2>
              <button className={primaryBtn} onClick={openRuleModal}>
                <Plus size={14} /> Create Rule
              </button>
            </div>

            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {[
                      "Expense Account",
                      "Method",
                      "Cost Centers",
                      "Ratios",
                      "Period",
                      "Actions",
                    ].map((h) => (
                      <th key={h} className={tableHeadClass}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rules.map((r) => (
                    <tr key={r.id} className="bg-white hover:bg-gray-50">
                      <td className={`${tableCellClass} font-medium`}>
                        {accounts.find((a) => a.id === r.expenseAccountId)?.name}
                      </td>
                      <td className={tableCellClass}>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 rounded text-[10px] font-medium">
                          {r.method}
                        </span>
                      </td>
                      <td className={tableCellClass}>
                        <div className="max-w-[150px] truncate text-gray-600">
                          {(r.allocations || [])
                            .map((a) => costCenters.find((c) => c.id === a.costCenterId)?.name)
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      </td>
                      <td className={`${tableCellClass} text-gray-600 font-mono`}>
                        {(r.allocations || []).map((a) => `${a.percentage || 0}%`).join(", ")}
                      </td>
                      <td className={`${tableCellClass} text-gray-600`}>
                        {r.effectiveFrom} to {r.effectiveTo || "Open"}
                      </td>
                      <td className={tableCellClass}>
                        <div className="flex items-center gap-2">
                          <button
                            className="text-[11px] font-medium text-[var(--ds-action-primary)] hover:underline"
                            onClick={() => buildAllocationPreview(r)}
                          >
                            Apply
                          </button>
                          <button
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            onClick={() => deleteRule(r.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!rules.length && (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center text-[12px] p-8 text-gray-500 bg-gray-50/50"
                      >
                        No allocation rules configured. Click "Create Rule" to start allocating
                        expenses automatically.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${cardClass} lg:col-span-1`}>
            <h2 className="text-[14px] font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
              Apply Allocations
            </h2>

            <label className="block text-[11px] font-medium text-gray-600 mb-1">
              Select Period (Month)
            </label>
            <input
              className={`${inputClass} w-full mb-4`}
              type="month"
              value={allocationPeriod.slice(0, 7)}
              onChange={(e) => setAllocationPeriod(e.target.value + "-01")}
            />

            {allocationPreview ? (
              <div className="border border-[#c7d2fe] rounded-md p-4 bg-[#eef2ff]">
                <div className="font-semibold text-[13px] text-[var(--ds-action-primary)] mb-1">
                  {allocationPreview.account?.name}
                </div>
                <div className="text-[12px] text-gray-600 mb-3 pb-3 border-b border-[#c7d2fe]">
                  Total Amount:{" "}
                  <span className="font-bold">Rs. {money(allocationPreview.totalAmount)}</span>
                </div>

                <table className="w-full border-collapse mb-4">
                  <thead>
                    <tr>
                      <th className="text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide py-1">
                        Cost Center
                      </th>
                      <th className="text-right text-[10px] font-semibold text-gray-700 uppercase tracking-wide py-1">
                        %
                      </th>
                      <th className="text-right text-[10px] font-semibold text-gray-700 uppercase tracking-wide py-1">
                        Allocated
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allocationPreview.allocations.map((a) => (
                      <tr key={a.costCenterId}>
                        <td className="py-1.5 text-[11px] text-[var(--ds-action-primary)]">
                          {costCenters.find((c) => c.id === a.costCenterId)?.name}
                        </td>
                        <td className="py-1.5 text-[11px] text-gray-700 text-right">
                          {money(a.percentage)}%
                        </td>
                        <td className="py-1.5 text-[11px] text-[var(--ds-action-primary)] font-medium text-right">
                          Rs. {money(a.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button
                  className="w-full h-8 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md transition-colors"
                  onClick={postAllocationJournal}
                >
                  Confirm & Post Journal
                </button>
              </div>
            ) : (
              <div className="border border-dashed border-gray-300 rounded-md p-6 text-center text-gray-500 text-[11px]">
                Select an allocation rule from the table and click "Apply" to generate a preview for
                the selected month.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "Inter-Department Transfer" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={cardClass}>
            <h2 className="text-[14px] font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
              New Transfer
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  From Cost Center (Credit)
                </label>
                <select
                  className={inputClass}
                  value={transferForm.fromCostCenterId}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, fromCostCenterId: e.target.value })
                  }
                >
                  <option value="">Select Origin...</option>
                  {visibleCostCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Expense Account
                </label>
                <select
                  className={inputClass}
                  value={transferForm.expenseAccountId}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, expenseAccountId: e.target.value })
                  }
                >
                  <option value="">Select Account...</option>
                  {accounts
                    .filter((a) => a.type === "expense")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Period (Month)
                </label>
                <input
                  className={inputClass}
                  type="month"
                  value={transferForm.period}
                  onChange={(e) => setTransferForm({ ...transferForm, period: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Total Amount (NPR)
                </label>
                <input
                  className={inputClass}
                  type="number"
                  placeholder="0.00"
                  value={transferForm.totalAmount}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, totalAmount: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Narration</label>
              <textarea
                className={`${inputClass} h-auto py-2`}
                rows={2}
                placeholder="Reason for transfer..."
                value={transferForm.narration}
                onChange={(e) => setTransferForm({ ...transferForm, narration: e.target.value })}
              />
            </div>

            <div className="border border-gray-200 rounded-md p-3 bg-gray-50/50 mb-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[12px] font-semibold text-gray-700">
                  Receiving Cost Centers (Debit)
                </h3>
                <button
                  className="text-[11px] font-medium text-[var(--ds-action-primary)] hover:underline flex items-center gap-1"
                  onClick={addReceiver}
                >
                  <Plus size={12} /> Add Receiver
                </button>
              </div>

              {(transferForm.receivers || []).map((r, idx) => (
                <div key={idx} className="flex gap-2 items-center mb-2">
                  <select
                    className={`${inputClass} flex-1`}
                    value={r.costCenterId}
                    onChange={(e) => updateReceiver(idx, { costCenterId: e.target.value })}
                  >
                    <option value="">Cost Center...</option>
                    {visibleCostCenters.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className={`${inputClass} w-20`}
                    type="number"
                    placeholder="%"
                    value={r.percentage}
                    onChange={(e) =>
                      updateReceiver(idx, { percentage: Number(e.target.value), amount: "" })
                    }
                  />
                  <input
                    className={`${inputClass} w-28`}
                    type="number"
                    placeholder="Amt"
                    value={r.amount}
                    onChange={(e) => updateReceiver(idx, { amount: e.target.value })}
                  />
                  <button
                    className="text-gray-400 hover:text-red-600 p-1"
                    onClick={() => removeReceiver(idx)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {!transferForm.receivers?.length && (
                <div className="text-[11px] text-gray-500 italic text-center py-2">
                  No receivers added. Click "Add Receiver" to allocate the amount.
                </div>
              )}
            </div>

            {transferForm.receivers?.length > 0 &&
              transferForm.fromCostCenterId &&
              transferForm.expenseAccountId && (
                <div className="mt-4 border border-[#c7d2fe] rounded-md p-4 bg-[#eef2ff]">
                  <div className="font-semibold text-[13px] text-[var(--ds-action-primary)] mb-2">
                    Journal Preview
                  </div>
                  <table className="w-full border-collapse mt-2 text-[11px]">
                    <tbody className="divide-y divide-gray-100">
                      {transferPreview.receivers.map((r, idx) => (
                        <tr key={idx}>
                          <td className="py-1 text-[var(--ds-action-primary)]">
                            Dr {r.costCenter?.name} ({transferPreview.account?.name})
                          </td>
                          <td className="py-1 text-right font-medium text-[var(--ds-action-primary)]">
                            Rs. {money(r.amount)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-[#eef2ff]">
                        <td className="py-1 text-[var(--ds-action-primary)]">
                          Cr {transferPreview.fromCC?.name} ({transferPreview.account?.name})
                        </td>
                        <td className="py-1 text-right font-bold text-[var(--ds-action-primary)]">
                          Rs. {money(transferPreview.receiverTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <button className={`${primaryBtn} w-full mt-4`} onClick={postTransfer}>
                    Post Transfer Journal
                  </button>
                </div>
              )}
          </div>

          <div className={cardClass}>
            <h2 className="text-[14px] font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
              Recent Transfers
            </h2>
            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["Date", "From", "To", "Amount"].map((h) => (
                      <th key={h} className={tableHeadClass}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transferHistory
                    .slice()
                    .reverse()
                    .map((h) => (
                      <tr key={h.id} className="bg-white hover:bg-gray-50">
                        <td className={tableCellClass}>{h.date}</td>
                        <td className={tableCellClass}>
                          <div className="font-medium">
                            {costCenters.find((c) => c.id === h.fromCostCenterId)?.name}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {accounts.find((a) => a.id === h.expenseAccountId)?.name}
                          </div>
                        </td>
                        <td className={tableCellClass}>
                          <div className="text-[10px] max-w-[120px] truncate text-gray-600">
                            {(h.toCostCenters || [])
                              .map((id) => costCenters.find((c) => c.id === id)?.name)
                              .join(", ")}
                          </div>
                        </td>
                        <td className={`${tableCellClass} font-medium text-gray-900 text-right`}>
                          {money(h.amount)}
                        </td>
                      </tr>
                    ))}
                  {!transferHistory.length && (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center text-[12px] text-gray-500 p-6 bg-gray-50/50"
                      >
                        No transfer history.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Cost Center Budget" && (
        <div className={cardClass}>
          <div className="flex gap-3 mb-6 no-print">
            <div className="w-64">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Cost Center
              </label>
              <select
                className={inputClass}
                value={budgetCC}
                onChange={(e) => setBudgetCC(e.target.value)}
              >
                <option value="">Select Cost Center...</option>
                {visibleCostCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-48">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Fiscal Year
              </label>
              <input
                className={inputClass}
                value={selectedBudgetFY}
                onChange={(e) => setSelectedBudgetFY(e.target.value)}
                placeholder="e.g. 2080/81"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {[
                    "Account",
                    "Annual Budget",
                    "Budget YTD",
                    "Actual YTD",
                    "Variance (NPR)",
                    "% Variance",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className={h === "Account" ? tableHeadClass : `${tableHeadClass} text-right`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {budgetRows.map((r, idx) => (
                  <tr key={idx} className="bg-white hover:bg-gray-50">
                    <td className={`${tableCellClass} font-medium`}>
                      {r.account?.name || r.account?.accountName || "Account"}
                    </td>
                    <td className={`${tableCellClass} text-right`}>{money(r.annualBudget)}</td>
                    <td className={tableCellClass}>
                      <div className="text-right">{money(r.budgetYTD)}</div>
                      <div className="w-full bg-gray-100 rounded-full h-1 mt-1.5 overflow-hidden">
                        <div
                          style={{
                            width: Math.min(100, (r.budgetYTD / maxBudgetActual) * 100) + "%",
                          }}
                          className="h-full bg-blue-400 rounded-full"
                        />
                      </div>
                    </td>
                    <td className={tableCellClass}>
                      <div className="text-right font-medium">{money(r.actualYTD)}</div>
                      <div className="w-full bg-gray-100 rounded-full h-1 mt-1.5 overflow-hidden">
                        <div
                          style={{
                            width: Math.min(100, (r.actualYTD / maxBudgetActual) * 100) + "%",
                          }}
                          className={`h-full rounded-full ${r.actualYTD > r.budgetYTD ? "bg-red-500" : "bg-[var(--ds-action-primary)]"}`}
                        />
                      </div>
                    </td>
                    <td
                      className={`${tableCellClass} text-right font-bold ${r.variance >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {money(r.variance)}
                    </td>
                    <td className={`${tableCellClass} text-right`}>
                      {r.variance >= 0 ? (
                        <span className="text-green-600">{money(Math.abs(r.pctVariance))}%</span>
                      ) : (
                        <span className="text-red-600">({money(Math.abs(r.pctVariance))}%)</span>
                      )}
                    </td>
                    <td className={`${tableCellClass} text-right`}>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${
                          r.status === "On Track"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : r.status === "Over Budget"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {!budgetRows.length && (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center p-10 text-gray-500 text-[12px] bg-gray-50/50"
                    >
                      <div className="font-medium text-gray-600 mb-1">No budget data available</div>
                      <div>Select a cost center with an active budget for this fiscal year.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={ruleModal}
        title="Create Cost Allocation Rule"
        onClose={() => setRuleModal(false)}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Expense Account
              </label>
              <select
                className={inputClass}
                value={ruleForm.expenseAccountId}
                onChange={(e) => setRuleForm({ ...ruleForm, expenseAccountId: e.target.value })}
              >
                <option value="">Select Account...</option>
                {accounts
                  .filter((a) => a.type === "expense")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Allocation Method
              </label>
              <select
                className={inputClass}
                value={ruleForm.method}
                onChange={(e) => setRuleForm({ ...ruleForm, method: e.target.value })}
              >
                <option>Fixed %</option>
                <option>Headcount</option>
                <option>Revenue Share</option>
              </select>
            </div>
          </div>

          <div className="bg-amber-50/50 border border-amber-100 rounded p-2 text-[11px] text-amber-800">
            {ruleForm.method === "Fixed %" &&
              "Specify manual percentages for each receiving cost center."}
            {ruleForm.method === "Headcount" &&
              "Will allocate proportionally to employee count per cost center automatically."}
            {ruleForm.method === "Revenue Share" &&
              "Will allocate proportionally to each cost center's revenue in the period automatically."}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Effective From
              </label>
              <input
                className={inputClass}
                type="date"
                value={ruleForm.effectiveFrom}
                onChange={(e) => setRuleForm({ ...ruleForm, effectiveFrom: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Effective To (Optional)
              </label>
              <input
                className={inputClass}
                type="date"
                value={ruleForm.effectiveTo}
                onChange={(e) => setRuleForm({ ...ruleForm, effectiveTo: e.target.value })}
              />
            </div>
          </div>

          {ruleForm.method === "Fixed %" && (
            <div className="mt-2 border-t border-gray-100 pt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[12px] font-semibold text-gray-800">Cost Center Targets</h3>
                <div
                  className={`text-[12px] font-bold px-2 py-1 rounded border ${Math.abs(totalRulePct - 100) < 0.01 ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}
                >
                  Total Allocated: {money(totalRulePct)}%
                </div>
              </div>

              {(ruleForm.allocations || []).map((a, idx) => (
                <div key={idx} className="flex gap-2 items-center mb-2">
                  <select
                    className={`${inputClass} flex-1`}
                    value={a.costCenterId}
                    onChange={(e) => updateRuleAllocation(idx, { costCenterId: e.target.value })}
                  >
                    <option value="">Cost Center...</option>
                    {visibleCostCenters.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.name}
                      </option>
                    ))}
                  </select>

                  <div className="relative">
                    <input
                      className={`${inputClass} w-24 pr-6`}
                      type="number"
                      value={a.percentage}
                      onChange={(e) =>
                        updateRuleAllocation(idx, { percentage: Number(e.target.value) })
                      }
                    />
                    <span className="absolute right-2 top-2 text-[12px] text-gray-400">%</span>
                  </div>

                  <button
                    className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                    onClick={() => removeRuleAllocation(idx)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <button
                className="text-[11px] font-medium text-[var(--ds-action-primary)] hover:underline flex items-center gap-1 mt-2"
                onClick={addRuleAllocation}
              >
                <Plus size={12} /> Add Cost Center
              </button>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
            <button className={outlineBtn} onClick={() => setRuleModal(false)}>
              Cancel
            </button>
            <button className={primaryBtn} onClick={saveRule}>
              <Save size={14} /> Save Rule
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
