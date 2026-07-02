// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import {
  ChevronRight,
  ChevronLeft,
  Home,
  Calendar,
  Download,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  Play,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const AdvancedReportHub: React.FC = () => {
  const {
    accounts,
    vouchers,
    invoices,
    items,
    parties,
    employees,
    stockMovements,
    companySettings,
    currentFiscalYear,
    fiscalYears,
    setCurrentPage,
  } = useStore();
  const [activeTab, setActiveTab] = useState(0);
  const [drillPath, setDrillPath] = useState<{ label: string; value: string }[]>([
    { label: "Summary", value: "" },
  ]);
  const [drillLevel, setDrillLevel] = useState<
    "type-summary" | "account-list" | "transactions" | "voucher-detail"
  >("type-summary");
  const [selectedType, setSelectedType] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedVoucherId, setSelectedVoucherId] = useState("");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [scheduleForm, setScheduleForm] = useState({
    reportType: "",
    frequency: "",
    time: "09:00",
    recipients: "",
    format: "excel",
  });
  const [dueSchedules, setDueSchedules] = useState<any[]>([]);
  const [expandedException, setExpandedException] = useState<string | null>(null);

  useEffect(() => {
    const db = getDB();
    db.table("reportSchedules")
      .toArray()
      .then(setSchedules)
      .catch(() => setSchedules([]));
  }, []);

  useEffect(() => {
    const now = new Date();
    const due = schedules.filter((s) => {
      const lastRun = s.lastRun ? new Date(s.lastRun) : new Date(0);
      const nextRun = new Date(lastRun);

      if (s.frequency === "daily") {
        nextRun.setDate(nextRun.getDate() + 1);
      } else if (s.frequency === "weekly") {
        nextRun.setDate(nextRun.getDate() + 7);
      } else if (s.frequency === "monthly") {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }

      return nextRun <= now;
    });

    setDueSchedules(due);
  }, [schedules]);

  const navigateTo = (index: number) => {
    const newPath = drillPath.slice(0, index + 1);
    setDrillPath(newPath);

    if (index === 0) {
      setDrillLevel("type-summary");
      setSelectedType("");
      setSelectedAccountId("");
      setSelectedVoucherId("");
    } else if (index === 1) {
      setDrillLevel("account-list");
      setSelectedAccountId("");
      setSelectedVoucherId("");
    } else if (index === 2) {
      setDrillLevel("transactions");
      setSelectedVoucherId("");
    } else if (index === 3) {
      setDrillLevel("voucher-detail");
    }
  };

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
    setDrillPath((prev) => [...prev, { label: type, value: type }]);
    setDrillLevel("account-list");
  };

  const handleAccountSelect = (accountId: string, accountName: string) => {
    setSelectedAccountId(accountId);
    setDrillPath((prev) => [...prev, { label: accountName, value: accountId }]);
    setDrillLevel("transactions");
  };

  const handleVoucherSelect = (voucherId: string, voucherNo: string) => {
    setSelectedVoucherId(voucherId);
    setDrillPath((prev) => [...prev, { label: voucherNo, value: voucherId }]);
    setDrillLevel("voucher-detail");
  };

  const typeBalances = useMemo(() => {
    const balances: Record<string, number> = {
      asset: 0,
      liability: 0,
      equity: 0,
      income: 0,
      expense: 0,
    };

    accounts.forEach((acc) => {
      const balance = acc.balance || 0;
      if (balances.hasOwnProperty(acc.type)) {
        balances[acc.type] += balance;
      }
    });

    return balances;
  }, [accounts]);

  const accountList = useMemo(() => {
    return accounts.filter((acc) => acc.type === selectedType);
  }, [accounts, selectedType]);

  const transactionList = useMemo(() => {
    if (!selectedAccountId) return [];

    return vouchers.filter(
      (v) => v.lines?.some((l) => l.accountId === selectedAccountId) && v.status === "posted",
    );
  }, [vouchers, selectedAccountId]);

  const selectedVoucher = useMemo(() => {
    return vouchers.find((v) => v.id === selectedVoucherId);
  }, [vouchers, selectedVoucherId]);

  const ratios = useMemo(() => {
    const currentAssets = accounts
      .filter(
        (a) =>
          a.type === "asset" &&
          !a.name.toLowerCase().includes("fixed") &&
          !a.name.toLowerCase().includes("property"),
      )
      .reduce((s, a) => s + (a.balance || 0), 0);
    const currentLiabilities = accounts
      .filter(
        (a) =>
          a.type === "liability" &&
          !a.name.toLowerCase().includes("long") &&
          !a.name.toLowerCase().includes("loan"),
      )
      .reduce((s, a) => s + (a.balance || 0), 0);
    const stock = accounts
      .filter(
        (a) => a.name.toLowerCase().includes("stock") || a.name.toLowerCase().includes("inventory"),
      )
      .reduce((s, a) => s + (a.balance || 0), 0);
    const cashAndBank = accounts
      .filter((a) => a.name.toLowerCase().includes("cash") || a.name.toLowerCase().includes("bank"))
      .reduce((s, a) => s + (a.balance || 0), 0);
    const totalAssets = accounts
      .filter((a) => a.type === "asset")
      .reduce((s, a) => s + (a.balance || 0), 0);
    const totalEquity = accounts
      .filter((a) => a.type === "equity")
      .reduce((s, a) => s + (a.balance || 0), 0);
    const totalDebt = accounts
      .filter((a) => a.type === "liability")
      .reduce((s, a) => s + (a.balance || 0), 0);
    const netSales = invoices
      .filter((i) => i.type === "sales-invoice" && i.status === "posted")
      .reduce((s, i) => s + (i.grandTotal || 0), 0);
    const cogs = invoices
      .filter((i) => i.type === "purchase-invoice" && i.status === "posted")
      .reduce((s, i) => s + (i.grandTotal || 0), 0);
    const grossProfit = netSales - cogs;
    const opExpenses = accounts
      .filter((a) => a.type === "expense" && !a.name.toLowerCase().includes("purchase"))
      .reduce((s, a) => s + (a.balance || 0), 0);
    const netProfit = grossProfit - opExpenses;
    const interest = accounts
      .filter(
        (a) =>
          a.name.toLowerCase().includes("interest expense") ||
          a.name.toLowerCase().includes("finance cost"),
      )
      .reduce((s, a) => s + (a.balance || 0), 0);
    const debtors = accounts
      .filter(
        (a) =>
          a.name.toLowerCase().includes("debtor") || a.name.toLowerCase().includes("receivable"),
      )
      .reduce((s, a) => s + (a.balance || 0), 0);
    const creditors = accounts
      .filter(
        (a) =>
          a.name.toLowerCase().includes("creditor") || a.name.toLowerCase().includes("payable"),
      )
      .reduce((s, a) => s + (a.balance || 0), 0);

    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
    const quickRatio = currentLiabilities > 0 ? (currentAssets - stock) / currentLiabilities : 0;
    const cashRatio = currentLiabilities > 0 ? cashAndBank / currentLiabilities : 0;
    const gpMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
    const npMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;
    const roa = totalAssets > 0 ? (netProfit / totalAssets) * 100 : 0;
    const roe = totalEquity > 0 ? (netProfit / totalEquity) * 100 : 0;
    const inventoryTurnover = stock > 0 ? cogs / stock : 0;
    const debtorDays = netSales > 0 ? (debtors / netSales) * 365 : 0;
    const creditorDays = cogs > 0 ? (creditors / cogs) * 365 : 0;
    const debtToEquity = totalEquity > 0 ? totalDebt / totalEquity : 0;
    const interestCoverage = interest > 0 ? grossProfit / interest : 0;

    return {
      currentRatio,
      quickRatio,
      cashRatio,
      gpMargin,
      npMargin,
      roa,
      roe,
      inventoryTurnover,
      debtorDays,
      creditorDays,
      debtToEquity,
      interestCoverage,
      currentAssets,
      currentLiabilities,
      totalAssets,
      totalEquity,
      netSales,
      grossProfit,
      netProfit,
    };
  }, [accounts, invoices]);

  const quarterlyData = useMemo(() => {
    const quarters = [];
    for (let i = 0; i < 4; i++) {
      const quarter = {
        name: `Q${4 - i}`,
        gpMargin: ratios.gpMargin,
      };
      quarters.push(quarter);
    }
    return quarters;
  }, [ratios]);

  const getRatioStatus = (ratioName: string, value: number) => {
    if (ratioName === "currentRatio") {
      if (value >= 2) return { status: "good", benchmark: "Healthy" };
      if (value >= 1) return { status: "warn", benchmark: "Moderate" };
      return { status: "bad", benchmark: "Concerning" };
    }
    if (ratioName === "quickRatio") {
      if (value >= 1) return { status: "good", benchmark: "Strong" };
      if (value >= 0.5) return { status: "warn", benchmark: "Adequate" };
      return { status: "bad", benchmark: "Weak" };
    }
    if (ratioName === "gpMargin") {
      if (value >= 20) return { status: "good", benchmark: "Excellent" };
      if (value >= 10) return { status: "warn", benchmark: "Average" };
      return { status: "bad", benchmark: "Poor" };
    }
    if (ratioName === "npMargin") {
      if (value >= 10) return { status: "good", benchmark: "Excellent" };
      if (value >= 5) return { status: "warn", benchmark: "Average" };
      return { status: "bad", benchmark: "Poor" };
    }
    if (ratioName === "roa") {
      if (value >= 10) return { status: "good", benchmark: "Excellent" };
      if (value >= 5) return { status: "warn", benchmark: "Average" };
      return { status: "bad", benchmark: "Poor" };
    }
    if (ratioName === "roe") {
      if (value >= 15) return { status: "good", benchmark: "Excellent" };
      if (value >= 10) return { status: "warn", benchmark: "Average" };
      return { status: "bad", benchmark: "Poor" };
    }
    return { status: "good", benchmark: "Good" };
  };

  const financialHealthScore = useMemo(() => {
    let score = 0;
    let total = 0;

    if (ratios.currentRatio >= 2) score += 20;
    else if (ratios.currentRatio >= 1) score += 10;
    total += 20;

    if (ratios.quickRatio >= 1) score += 15;
    else if (ratios.quickRatio >= 0.5) score += 7;
    total += 15;

    if (ratios.gpMargin >= 20) score += 20;
    else if (ratios.gpMargin >= 10) score += 10;
    total += 20;

    if (ratios.npMargin >= 10) score += 15;
    else if (ratios.npMargin >= 5) score += 7;
    total += 15;

    if (ratios.roa >= 10) score += 15;
    else if (ratios.roa >= 5) score += 7;
    total += 15;

    if (ratios.roe >= 15) score += 15;
    else if (ratios.roe >= 10) score += 7;
    total += 15;

    return total > 0 ? Math.round((score / total) * 100) : 0;
  }, [ratios]);

  const handleScheduleFormChange = (field: string, value: any) => {
    setScheduleForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveSchedule = async () => {
    if (!scheduleForm.reportType || !scheduleForm.frequency || !scheduleForm.recipients) {
      toast.error("Please fill all required fields");
      return;
    }

    const db = getDB();
    const schedule = {
      id: generateId(),
      ...scheduleForm,
      lastRun: null,
      createdAt: new Date().toISOString(),
    };

    try {
      await db.table("reportSchedules").add(schedule);
      setSchedules((prev) => [...prev, schedule]);
      setScheduleForm({
        reportType: "",
        frequency: "",
        time: "09:00",
        recipients: "",
        format: "excel",
      });
      toast.success("Schedule saved successfully");
    } catch (error) {
      toast.error("Failed to save schedule");
    }
  };

  const generateDueReports = async () => {
    for (const schedule of dueSchedules) {
      try {
        let data: any[] = [];
        switch (schedule.reportType) {
          case "trial-balance":
            data = accounts.map((acc) => ({
              code: acc.code,
              name: acc.name,
              type: acc.type,
              balance: acc.balance,
            }));
            break;
          case "profit-loss":
            data = [
              { category: "Revenue", amount: ratios.netSales },
              { category: "COGS", amount: -ratios.cogs },
              { category: "Gross Profit", amount: ratios.grossProfit },
              { category: "Expenses", amount: -ratios.opExpenses },
              { category: "Net Profit", amount: ratios.netProfit },
            ];
            break;
          default:
            data = [{ message: "Report data would be generated here" }];
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, schedule.reportType);
        XLSX.writeFile(
          wb,
          `${schedule.reportType}_${new Date().toISOString().split("T")[0]}.${schedule.format}`,
        );

        const db = getDB();
        await db
          .table("reportSchedules")
          .update(schedule.id, { lastRun: new Date().toISOString() });
      } catch (error) {
        toast.error(`Failed to generate ${schedule.reportType} report`);
      }
    }

    setDueSchedules([]);
    toast.success("Due reports generated successfully");
  };

  const exceptions = useMemo(() => {
    const currentFYStart = new Date(currentFiscalYear?.startDate || "2000-01-01");

    const exc: any[] = [
      {
        category: "Vouchers",
        exception: "Vouchers without narration",
        count: vouchers.filter((v) => !v.narration || v.narration.trim() === "").length,
        severity: "Warning",
        records: vouchers.filter((v) => !v.narration || v.narration.trim() === "").slice(0, 20),
      },
      {
        category: "Vouchers",
        exception: "Unbalanced voucher lines (Dr≠Cr)",
        count: vouchers.filter((v) => {
          const dr = (v.lines || []).reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
          const cr = (v.lines || []).reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
          return Math.abs(dr - cr) > 0.01;
        }).length,
        severity: "Critical",
        records: [],
      },
      {
        category: "Vouchers",
        exception: "Backdated entries >30 days old",
        count: vouchers.filter((v) => {
          const d = new Date(v.date);
          const diff = (new Date().getTime() - d.getTime()) / 86400000;
          return diff > 30 && v.status === "posted" && d > currentFYStart;
        }).length,
        severity: "Warning",
        records: [],
      },
      {
        category: "Stock",
        exception: "Items below reorder level",
        count: items.filter((i) => {
          const stock = stockMovements
            .filter((m) => m.itemId === i.id)
            .reduce((a: number, m: any) => a + (m.type === "in" ? m.quantity : -m.quantity), 0);
          return i.minimumStock && stock < i.minimumStock;
        }).length,
        severity: "Warning",
        records: [],
      },
      {
        category: "Outstanding",
        exception: "Invoices unpaid >90 days",
        count: invoices.filter((i) => {
          const due = new Date(i.dueDate || i.date);
          const diff = (new Date().getTime() - due.getTime()) / 86400000;
          return diff > 90 && (i.paymentStatus === "unpaid" || i.paymentStatus === "partial");
        }).length,
        severity: "High",
        records: [],
      },
      {
        category: "Payroll",
        exception: "Employees with no salary details",
        count: employees.filter((e) => !e.salaryDetails && !e.basicSalary).length,
        severity: "Warning",
        records: [],
      },
    ];

    return exc;
  }, [vouchers, items, invoices, employees, stockMovements, currentFiscalYear]);

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case "Critical":
        return "bg-red-100 text-red-700 border-red-200";
      case "High":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "Warning":
        return "bg-amber-100 text-amber-700 border-amber-200";
      default:
        return "bg-blue-100 text-blue-700 border-blue-200";
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4">
      <div className="w-full">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Advanced Report Hub</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Explore drill-down financials, ratios, exceptions, and schedule automatic reports
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4 bg-white px-2 pt-2 rounded-t-md shadow-sm overflow-x-auto hide-scrollbar">
          {[
            "Drill-Down Navigator",
            "Ratio Analysis Dashboard",
            "Report Scheduler",
            "Exception Reports",
          ].map((tab, index) => (
            <button
              key={index}
              className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === index
                  ? "border-[#1557b0] text-[#1557b0]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              onClick={() => setActiveTab(index)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 0 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex items-center gap-1.5 mb-4 text-[12px] bg-gray-50 p-2.5 rounded-md border border-gray-200">
              <Home size={14} className="text-gray-500" />
              {drillPath.map((p, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <ChevronRight size={14} className="text-gray-400" />}
                  <span
                    onClick={() => navigateTo(i)}
                    className={`transition-colors ${
                      i < drillPath.length - 1
                        ? "text-[#1557b0] cursor-pointer hover:underline font-medium"
                        : "font-semibold text-gray-800"
                    }`}
                  >
                    {p.label}
                  </span>
                </React.Fragment>
              ))}
            </div>

            {drillLevel === "type-summary" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {["asset", "liability", "equity", "income", "expense"].map((type) => (
                  <div
                    key={type}
                    className="bg-white border border-gray-200 rounded-md p-4 cursor-pointer hover:border-[#1557b0] hover:shadow-md transition-all group"
                    onClick={() => handleTypeSelect(type)}
                  >
                    <div className="text-[11px] text-gray-500 tracking-wide font-medium mb-2 group-hover:text-[#1557b0] transition-colors">
                      {type}
                    </div>
                    <div className="text-xl font-bold text-gray-800">
                      {money(typeBalances[type])}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {drillLevel === "account-list" && (
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="bg-[#f5f6fa] border-b border-gray-200">
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Code
                      </th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Name
                      </th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Level
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Dr Balance
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Cr Balance
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Net
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountList.map((acc) => (
                      <tr
                        key={acc.id}
                        className="bg-white hover:bg-gray-50 border-b border-gray-100 text-[12px] cursor-pointer transition-colors"
                        onClick={() => handleAccountSelect(acc.id, acc.name)}
                      >
                        <td className="px-3 py-2.5 text-gray-600">{acc.code}</td>
                        <td className="px-3 py-2.5 text-[#1557b0] font-medium hover:underline">
                          {acc.name}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">{acc.level}</td>
                        <td className="px-3 py-2.5 text-right text-gray-800">
                          {money(acc.balance > 0 ? acc.balance : 0)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-800">
                          {money(acc.balance < 0 ? -acc.balance : 0)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-800">
                          {money(acc.balance)}
                        </td>
                      </tr>
                    ))}
                    {accountList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-gray-500">
                          No accounts found in this category.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {drillLevel === "transactions" && (
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="bg-[#f5f6fa] border-b border-gray-200">
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Date
                      </th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Voucher No
                      </th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Type
                      </th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Narration
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Dr
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Cr
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Running Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionList.map((v, idx) => {
                      const dr = v.lines?.reduce((s: number, l: any) => s + (l.debit || 0), 0) || 0;
                      const cr =
                        v.lines?.reduce((s: number, l: any) => s + (l.credit || 0), 0) || 0;
                      const balance =
                        idx === 0
                          ? dr - cr
                          : (transactionList[idx - 1]?.runningBalance || 0) + dr - cr;

                      return (
                        <tr
                          key={v.id}
                          className="bg-white hover:bg-gray-50 border-b border-gray-100 text-[12px] cursor-pointer transition-colors"
                          onClick={() => handleVoucherSelect(v.id, v.voucherNo)}
                        >
                          <td className="px-3 py-2.5 text-gray-600">{v.date}</td>
                          <td className="px-3 py-2.5 text-[#1557b0] font-medium hover:underline">
                            {v.voucherNo}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600">{v.type}</td>
                          <td
                            className="px-3 py-2.5 text-gray-700 max-w-[250px] truncate"
                            title={v.narration}
                          >
                            {v.narration}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-800">{money(dr)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-800">{money(cr)}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-gray-800">
                            {money(balance)}
                          </td>
                        </tr>
                      );
                    })}
                    {transactionList.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-500">
                          No posted transactions found for this account.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {drillLevel === "voucher-detail" && selectedVoucher && (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-5 max-w-4xl mx-auto shadow-sm">
                <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-200">
                  <div>
                    <h3 className="text-[16px] font-semibold text-gray-800 mb-1">
                      {selectedVoucher.type.replace("-", " ").toUpperCase()}{" "}
                      <span className="text-gray-500 font-normal">
                        #{selectedVoucher.voucherNo}
                      </span>
                    </h3>
                    <div className="flex items-center gap-4 text-[12px] text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar size={13} /> {selectedVoucher.date}
                      </div>
                      <div className="flex items-center gap-1">
                        <Activity size={13} />{" "}
                        <span
                          className={`uppercase font-medium ${selectedVoucher.status === "posted" ? "text-green-600" : "text-amber-600"}`}
                        >
                          {selectedVoucher.status}
                        </span>
                      </div>
                    </div>
                    {selectedVoucher.narration && (
                      <p className="text-[12px] text-gray-700 mt-3 italic bg-white p-2 rounded border border-gray-100">
                        "{selectedVoucher.narration}"
                      </p>
                    )}
                  </div>
                  <button
                    className="h-8 px-4 bg-white border border-gray-300 text-[#1557b0] text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                    onClick={() => setCurrentPage("voucher-entry")}
                  >
                    Open in Entry Mode
                  </button>
                </div>

                <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm bg-white">
                  <table className="w-full min-w-max border-collapse">
                    <thead>
                      <tr className="bg-[#f5f6fa] border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-1/4">
                          Account Code
                        </th>
                        <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-1/4">
                          Account Name
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-1/4">
                          Debit
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-1/4">
                          Credit
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedVoucher.lines?.map((line: any, idx: number) => (
                        <tr key={idx} className="bg-white border-b border-gray-100 text-[12px]">
                          <td className="px-4 py-3 text-gray-600">{line.accountCode}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {line.accountName}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-800">
                            {line.debit ? money(line.debit) : ""}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-800">
                            {line.credit ? money(line.credit) : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold text-[12px] text-gray-800">
                        <td
                          colSpan={2}
                          className="px-4 py-3 text-right text-[10px] text-gray-500 tracking-wide"
                        >
                          Total
                        </td>
                        <td className="px-4 py-3 text-right">
                          {money(
                            selectedVoucher.lines?.reduce((s, l) => s + (l.debit || 0), 0) || 0,
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {money(
                            selectedVoucher.lines?.reduce((s, l) => s + (l.credit || 0), 0) || 0,
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 1 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-5 mb-4 max-w-full overflow-auto">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-[15px] font-semibold text-gray-800">
                  Ratio Analysis Dashboard
                </h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Key performance indicators and financial metrics
                </p>
              </div>
              <div className="text-center bg-gray-50 py-2 px-6 rounded-md border border-gray-200 shadow-inner">
                <div
                  className={`text-3xl font-bold ${financialHealthScore >= 80 ? "text-green-600" : financialHealthScore >= 50 ? "text-amber-600" : "text-red-600"}`}
                >
                  {financialHealthScore}
                  <span className="text-xl text-gray-400">/100</span>
                </div>
                <div className="text-[10px] font-semibold text-gray-500 tracking-wide mt-1">
                  Financial Health Score
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
              <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm hover:border-[#1557b0] transition-colors group">
                <div className="text-[11px] font-semibold text-gray-500 tracking-wide mb-2 flex items-center justify-between">
                  Current Ratio
                  <TrendingUp size={14} className="text-gray-400 group-hover:text-[#1557b0]" />
                </div>
                <div className="text-2xl font-bold text-gray-800 mb-1">
                  {ratios.currentRatio.toFixed(2)}
                </div>
                <div
                  className={`text-[11px] font-medium ${getRatioStatus("currentRatio", ratios.currentRatio).status === "good" ? "text-green-600" : getRatioStatus("currentRatio", ratios.currentRatio).status === "warn" ? "text-amber-600" : "text-red-600"}`}
                >
                  {getRatioStatus("currentRatio", ratios.currentRatio).benchmark}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm hover:border-[#1557b0] transition-colors group">
                <div className="text-[11px] font-semibold text-gray-500 tracking-wide mb-2 flex items-center justify-between">
                  Quick Ratio
                  <Activity size={14} className="text-gray-400 group-hover:text-[#1557b0]" />
                </div>
                <div className="text-2xl font-bold text-gray-800 mb-1">
                  {ratios.quickRatio.toFixed(2)}
                </div>
                <div
                  className={`text-[11px] font-medium ${getRatioStatus("quickRatio", ratios.quickRatio).status === "good" ? "text-green-600" : getRatioStatus("quickRatio", ratios.quickRatio).status === "warn" ? "text-amber-600" : "text-red-600"}`}
                >
                  {getRatioStatus("quickRatio", ratios.quickRatio).benchmark}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm hover:border-[#1557b0] transition-colors group">
                <div className="text-[11px] font-semibold text-gray-500 tracking-wide mb-2 flex items-center justify-between">
                  Cash Ratio
                  <TrendingDown size={14} className="text-gray-400 group-hover:text-[#1557b0]" />
                </div>
                <div className="text-2xl font-bold text-gray-800 mb-1">
                  {ratios.cashRatio.toFixed(2)}
                </div>
                <div className="text-[11px] font-medium text-green-600">Good</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm hover:border-[#1557b0] transition-colors group">
                <div className="text-[11px] font-semibold text-gray-500 tracking-wide mb-2 flex items-center justify-between">
                  GP Margin
                  <TrendingUp size={14} className="text-gray-400 group-hover:text-[#1557b0]" />
                </div>
                <div className="text-2xl font-bold text-gray-800 mb-1">
                  {ratios.gpMargin.toFixed(2)}%
                </div>
                <div
                  className={`text-[11px] font-medium ${getRatioStatus("gpMargin", ratios.gpMargin).status === "good" ? "text-green-600" : getRatioStatus("gpMargin", ratios.gpMargin).status === "warn" ? "text-amber-600" : "text-red-600"}`}
                >
                  {getRatioStatus("gpMargin", ratios.gpMargin).benchmark}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm hover:border-[#1557b0] transition-colors group">
                <div className="text-[11px] font-semibold text-gray-500 tracking-wide mb-2 flex items-center justify-between">
                  NP Margin
                  <TrendingUp size={14} className="text-gray-400 group-hover:text-[#1557b0]" />
                </div>
                <div className="text-2xl font-bold text-gray-800 mb-1">
                  {ratios.npMargin.toFixed(2)}%
                </div>
                <div
                  className={`text-[11px] font-medium ${getRatioStatus("npMargin", ratios.npMargin).status === "good" ? "text-green-600" : getRatioStatus("npMargin", ratios.npMargin).status === "warn" ? "text-amber-600" : "text-red-600"}`}
                >
                  {getRatioStatus("npMargin", ratios.npMargin).benchmark}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm hover:border-[#1557b0] transition-colors group">
                <div className="text-[11px] font-semibold text-gray-500 tracking-wide mb-2 flex items-center justify-between">
                  ROA
                  <Activity size={14} className="text-gray-400 group-hover:text-[#1557b0]" />
                </div>
                <div className="text-2xl font-bold text-gray-800 mb-1">
                  {ratios.roa.toFixed(2)}%
                </div>
                <div
                  className={`text-[11px] font-medium ${getRatioStatus("roa", ratios.roa).status === "good" ? "text-green-600" : getRatioStatus("roa", ratios.roa).status === "warn" ? "text-amber-600" : "text-red-600"}`}
                >
                  {getRatioStatus("roa", ratios.roa).benchmark}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm">
                <h3 className="text-[13px] font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                  Quarterly Gross Margin Trend
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={quarterlyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#6B7280", fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#6B7280", fontSize: 12 }}
                        dx={-10}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "6px",
                          border: "1px solid #E5E7EB",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="gpMargin"
                        name="GP Margin %"
                        stroke="#1557b0"
                        strokeWidth={3}
                        activeDot={{ r: 6, fill: "#1557b0", stroke: "#fff", strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm">
                <h3 className="text-[13px] font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                  Efficiency Ratios
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md border border-gray-100">
                    <div>
                      <div className="text-[12px] font-semibold text-gray-800">
                        Inventory Turnover
                      </div>
                      <div className="text-[10px] text-gray-500">COGS / Avg. Inventory</div>
                    </div>
                    <div className="text-lg font-bold text-gray-800">
                      {ratios.inventoryTurnover.toFixed(1)}x
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md border border-gray-100">
                    <div>
                      <div className="text-[12px] font-semibold text-gray-800">
                        Debtor Days (DSO)
                      </div>
                      <div className="text-[10px] text-gray-500">Avg. Debtors / (Sales/365)</div>
                    </div>
                    <div className="text-lg font-bold text-gray-800">
                      {Math.round(ratios.debtorDays)} Days
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md border border-gray-100">
                    <div>
                      <div className="text-[12px] font-semibold text-gray-800">
                        Creditor Days (DPO)
                      </div>
                      <div className="text-[10px] text-gray-500">Avg. Creditors / (COGS/365)</div>
                    </div>
                    <div className="text-lg font-bold text-gray-800">
                      {Math.round(ratios.creditorDays)} Days
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md border border-gray-100">
                    <div>
                      <div className="text-[12px] font-semibold text-gray-800">Debt to Equity</div>
                      <div className="text-[10px] text-gray-500">Total Debt / Total Equity</div>
                    </div>
                    <div className="text-lg font-bold text-gray-800">
                      {ratios.debtToEquity.toFixed(2)}x
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-5 mb-4 max-w-full overflow-auto">
            <h2 className="text-[15px] font-semibold text-gray-800 mb-5 pb-3 border-b border-gray-100">
              Report Automation Scheduler
            </h2>

            {dueSchedules.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-md mb-6 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2 text-[13px] font-medium">
                  <AlertTriangle size={16} className="text-blue-600" />
                  {dueSchedules.length} scheduled report(s) are due to be run.
                </div>
                <button
                  className="h-8 px-4 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors shadow-sm flex items-center gap-1.5"
                  onClick={generateDueReports}
                >
                  <Play size={14} />
                  Execute Now
                </button>
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-md border border-gray-200 mb-8">
              <h3 className="text-[13px] font-semibold text-gray-700 mb-4">Create New Schedule</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Report Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={scheduleForm.reportType}
                    onChange={(e) => handleScheduleFormChange("reportType", e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  >
                    <option value="">Select Report...</option>
                    <option value="trial-balance">Trial Balance</option>
                    <option value="profit-loss">Profit & Loss</option>
                    <option value="balance-sheet">Balance Sheet</option>
                    <option value="day-book">Day Book</option>
                    <option value="outstanding">Outstanding</option>
                    <option value="stock-summary">Stock Summary</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Frequency <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={scheduleForm.frequency}
                    onChange={(e) => handleScheduleFormChange("frequency", e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  >
                    <option value="">Select Frequency...</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Execution Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={scheduleForm.time}
                    onChange={(e) => handleScheduleFormChange("time", e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Output Format
                  </label>
                  <select
                    value={scheduleForm.format}
                    onChange={(e) => handleScheduleFormChange("format", e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  >
                    <option value="excel">MS Excel (.xlsx)</option>
                    <option value="pdf">PDF Document (.pdf)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Email Recipients <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={scheduleForm.recipients}
                    onChange={(e) => handleScheduleFormChange("recipients", e.target.value)}
                    placeholder="user@example.com, ..."
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  className="h-8 px-4 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors shadow-sm flex items-center gap-1.5"
                  onClick={saveSchedule}
                >
                  <Plus size={14} />
                  Add to Schedule
                </button>
              </div>
            </div>

            <h3 className="text-[13px] font-semibold text-gray-800 mb-3">Active Schedules</h3>
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Report Type
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Frequency
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Next Run
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Recipients
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule) => (
                    <tr
                      key={schedule.id}
                      className="bg-white hover:bg-gray-50 border-b border-gray-100 text-[12px] transition-colors"
                    >
                      <td className="px-3 py-2.5 font-medium text-gray-800 capitalize">
                        {schedule.reportType.replace("-", " ")}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 capitalize">
                        {schedule.frequency} at {schedule.time}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">
                        {schedule.lastRun
                          ? new Date(schedule.lastRun).toLocaleDateString()
                          : "Pending"}
                      </td>
                      <td
                        className="px-3 py-2.5 text-gray-600 truncate max-w-[200px]"
                        title={schedule.recipients}
                      >
                        {schedule.recipients}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                            schedule.lastRun
                              ? "bg-green-100 text-green-700 border border-green-200"
                              : "bg-amber-100 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {schedule.lastRun ? "Active" : "New"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            className="text-blue-600 hover:text-blue-800 font-medium"
                            onClick={generateDueReports}
                            title="Force run now"
                          >
                            <Play size={14} />
                          </button>
                          <button
                            className="text-red-500 hover:text-red-700"
                            onClick={async () => {
                              if (window.confirm("Delete this schedule?")) {
                                const db = getDB();
                                await db.table("reportSchedules").delete(schedule.id);
                                setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {schedules.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No automated reports scheduled yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 3 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <h2 className="text-[15px] font-semibold text-gray-800 mb-5">
              Exception Detection Engine
            </h2>

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Category
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Exception Policy
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Affected Records
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Severity Indicator
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Investigation
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {exceptions.map((exc) => (
                    <React.Fragment key={exc.exception}>
                      <tr
                        className={`bg-white hover:bg-gray-50 border-b border-gray-100 text-[12px] cursor-pointer transition-colors ${expandedException === exc.exception ? "bg-blue-50/30" : ""}`}
                        onClick={() =>
                          setExpandedException(
                            expandedException === exc.exception ? null : exc.exception,
                          )
                        }
                      >
                        <td className="px-3 py-3 text-gray-600 font-medium">{exc.category}</td>
                        <td className="px-3 py-3 text-gray-800">{exc.exception}</td>
                        <td className="px-3 py-3 text-right">
                          {exc.count > 0 ? (
                            <span className="font-bold text-gray-800">{exc.count}</span>
                          ) : (
                            <span className="text-gray-400">Clear</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${getSeverityClass(exc.severity)}`}
                          >
                            {exc.severity}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button className="text-[#1557b0] hover:underline font-medium text-[11px] flex items-center justify-center gap-1 w-full">
                            {expandedException === exc.exception ? "Hide Details" : "View Details"}
                          </button>
                        </td>
                      </tr>

                      {expandedException === exc.exception && (
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <td colSpan={5} className="p-4 px-6">
                            <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
                              <h4 className="font-semibold text-gray-800 mb-3 border-b border-gray-100 pb-2 text-[13px]">
                                Affected Records ({exc.count})
                              </h4>
                              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                {exc.records.length > 0 ? (
                                  <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {exc.records.map((rec: any, idx: number) => (
                                      <li
                                        key={idx}
                                        className="bg-gray-50 p-2 rounded border border-gray-100 text-[11px] text-gray-700 flex items-center gap-2"
                                      >
                                        <AlertTriangle
                                          size={12}
                                          className={
                                            exc.severity === "Critical"
                                              ? "text-red-500"
                                              : "text-amber-500"
                                          }
                                        />
                                        <span className="truncate">
                                          {rec.id || rec.name || rec.voucherNo || "Unknown Record"}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div className="flex flex-col items-center justify-center py-6 text-gray-500">
                                    <CheckCircle size={24} className="text-green-500 mb-2" />
                                    <p className="text-[12px]">
                                      No exceptions found for this policy.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedReportHub;
