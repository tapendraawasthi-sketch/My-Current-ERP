import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { computeAllStockPositions } from "../lib/stockUtils";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  PlusCircle,
  TrendingUp,
  Wallet,
  ArrowRightLeft,
  FileText,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
} from "lucide-react";
import { VoucherType, VoucherStatus, PaymentStatus, PartyType } from "../lib/types";

const COLORS = ["#4f46e5", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0284c7"];

const Dashboard: React.FC = () => {
  const {
    accounts,
    vouchers,
    invoices,
    items,
    parties,
    warehouses,
    stockMovements,
    billAllocations,
    companySettings,
    currentFiscalYear,
    setCurrentPage,
    setEditingVoucherId,
  } = useStore();

  const symbol = companySettings?.currencySymbol || "Rs.";

  // Date constants
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }, []);

  const currentMonthPrefix = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const lastMonthPrefix = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  // 1. Today's Sales
  const todaySales = useMemo(() => {
    return invoices
      .filter(
        (i) =>
          i.type === VoucherType.SALES_INVOICE &&
          i.status === VoucherStatus.POSTED &&
          i.date === todayStr,
      )
      .reduce((sum, i) => sum + (i.grandTotal || 0), 0);
  }, [invoices, todayStr]);

  const yesterdaySales = useMemo(() => {
    return invoices
      .filter(
        (i) =>
          i.type === VoucherType.SALES_INVOICE &&
          i.status === VoucherStatus.POSTED &&
          i.date === yesterdayStr,
      )
      .reduce((sum, i) => sum + (i.grandTotal || 0), 0);
  }, [invoices, yesterdayStr]);

  // 2. Today's Collections (Receipt Vouchers)
  const todayCollections = useMemo(() => {
    return vouchers
      .filter(
        (v) =>
          v.type === VoucherType.RECEIPT &&
          v.status === VoucherStatus.POSTED &&
          v.date === todayStr,
      )
      .reduce((sum, v) => sum + (v.totalDebit || 0), 0);
  }, [vouchers, todayStr]);

  const yesterdayCollections = useMemo(() => {
    return vouchers
      .filter(
        (v) =>
          v.type === VoucherType.RECEIPT &&
          v.status === VoucherStatus.POSTED &&
          v.date === yesterdayStr,
      )
      .reduce((sum, v) => sum + (v.totalDebit || 0), 0);
  }, [vouchers, yesterdayStr]);

  // 3. Today's Payments (Payment Vouchers)
  const todayPayments = useMemo(() => {
    return vouchers
      .filter(
        (v) =>
          v.type === VoucherType.PAYMENT &&
          v.status === VoucherStatus.POSTED &&
          v.date === todayStr,
      )
      .reduce((sum, v) => sum + (v.totalDebit || 0), 0);
  }, [vouchers, todayStr]);

  const yesterdayPayments = useMemo(() => {
    return vouchers
      .filter(
        (v) =>
          v.type === VoucherType.PAYMENT &&
          v.status === VoucherStatus.POSTED &&
          v.date === yesterdayStr,
      )
      .reduce((sum, v) => sum + (v.totalDebit || 0), 0);
  }, [vouchers, yesterdayStr]);

  // 4. Cash & Bank Balance
  const cashBankBalance = useMemo(() => {
    return accounts
      .filter(
        (a) =>
          !a.isGroup &&
          (a.id === "acc-cash" ||
            a.group?.toLowerCase().includes("cash") ||
            a.group?.toLowerCase().includes("bank") ||
            a.name.toLowerCase().includes("bank") ||
            a.name.toLowerCase().includes("cash")),
      )
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts]);

  const yesterdayCashBankBalance = useMemo(() => {
    // Sum of opening balance + entries before today
    let bal = 0;
    accounts
      .filter(
        (a) =>
          !a.isGroup &&
          (a.id === "acc-cash" ||
            a.group?.toLowerCase().includes("cash") ||
            a.group?.toLowerCase().includes("bank") ||
            a.name.toLowerCase().includes("bank") ||
            a.name.toLowerCase().includes("cash")),
      )
      .forEach((a) => {
        const openingDr = a.openingBalanceDr || 0;
        const openingCr = a.openingBalanceCr || 0;
        let initial = openingDr - openingCr;

        // Add posted journal entries before today
        vouchers
          .filter((v) => v.status === VoucherStatus.POSTED && v.date < todayStr)
          .forEach((v) => {
            v.lines
              .filter((line) => line.accountId === a.id)
              .forEach((line) => {
                initial += (line.debit || 0) - (line.credit || 0);
              });
          });
        bal += initial;
      });
    return bal;
  }, [accounts, vouchers, todayStr]);

  // 5. Receivables Outstanding
  const receivablesOutstanding = useMemo(() => {
    return invoices
      .filter(
        (i) =>
          i.type === VoucherType.SALES_INVOICE &&
          i.status === VoucherStatus.POSTED &&
          i.paymentStatus !== PaymentStatus.PAID,
      )
      .reduce((sum, i) => {
        const paid =
          billAllocations
            .filter((alloc) => alloc.invoiceId === i.id)
            .reduce((s, a) => s + a.allocatedAmount, 0) ||
          i.paidAmount ||
          0;
        return sum + (i.grandTotal - paid);
      }, 0);
  }, [invoices, billAllocations]);

  const yesterdayReceivablesOutstanding = useMemo(() => {
    return invoices
      .filter(
        (i) =>
          i.type === VoucherType.SALES_INVOICE &&
          i.status === VoucherStatus.POSTED &&
          i.date < todayStr &&
          i.paymentStatus !== PaymentStatus.PAID,
      )
      .reduce((sum, i) => {
        const paid =
          billAllocations
            .filter((alloc) => alloc.invoiceId === i.id && alloc.allocationDate < todayStr)
            .reduce((s, a) => s + a.allocatedAmount, 0) ||
          i.paidAmount ||
          0;
        return sum + (i.grandTotal - paid);
      }, 0);
  }, [invoices, billAllocations, todayStr]);

  // 6. Payables Outstanding
  const payablesOutstanding = useMemo(() => {
    return invoices
      .filter(
        (i) =>
          i.type === VoucherType.PURCHASE_INVOICE &&
          i.status === VoucherStatus.POSTED &&
          i.paymentStatus !== PaymentStatus.PAID,
      )
      .reduce((sum, i) => {
        const paid =
          billAllocations
            .filter((alloc) => alloc.invoiceId === i.id)
            .reduce((s, a) => s + a.allocatedAmount, 0) ||
          i.paidAmount ||
          0;
        return sum + (i.grandTotal - paid);
      }, 0);
  }, [invoices, billAllocations]);

  const yesterdayPayablesOutstanding = useMemo(() => {
    return invoices
      .filter(
        (i) =>
          i.type === VoucherType.PURCHASE_INVOICE &&
          i.status === VoucherStatus.POSTED &&
          i.date < todayStr &&
          i.paymentStatus !== PaymentStatus.PAID,
      )
      .reduce((sum, i) => {
        const paid =
          billAllocations
            .filter((alloc) => alloc.invoiceId === i.id && alloc.allocationDate < todayStr)
            .reduce((s, a) => s + a.allocatedAmount, 0) ||
          i.paidAmount ||
          0;
        return sum + (i.grandTotal - paid);
      }, 0);
  }, [invoices, billAllocations, todayStr]);

  // 7. Net Profit This Month
  const netProfitThisMonth = useMemo(() => {
    let income = 0;
    let expense = 0;

    vouchers.forEach((v) => {
      if (v.status !== VoucherStatus.POSTED) return;
      if (!v.date.startsWith(currentMonthPrefix)) return;
      v.lines.forEach((line) => {
        const acc = accounts.find((a) => a.id === line.accountId);
        if (!acc) return;
        if (acc.type === "income") {
          income += (line.credit || 0) - (line.debit || 0);
        } else if (acc.type === "expense") {
          expense += (line.debit || 0) - (line.credit || 0);
        }
      });
    });
    return income - expense;
  }, [vouchers, accounts, currentMonthPrefix]);

  const netProfitLastMonth = useMemo(() => {
    let income = 0;
    let expense = 0;

    vouchers.forEach((v) => {
      if (v.status !== VoucherStatus.POSTED) return;
      if (!v.date.startsWith(lastMonthPrefix)) return;
      v.lines.forEach((line) => {
        const acc = accounts.find((a) => a.id === line.accountId);
        if (!acc) return;
        if (acc.type === "income") {
          income += (line.credit || 0) - (line.debit || 0);
        } else if (acc.type === "expense") {
          expense += (line.debit || 0) - (line.credit || 0);
        }
      });
    });
    return income - expense;
  }, [vouchers, accounts, lastMonthPrefix]);

  // 8. Stock Value
  const stockValue = useMemo(() => {
    if (companySettings?.enableStock === false) return 0;
    const positions = computeAllStockPositions(stockMovements, items, warehouses);
    return positions.reduce((sum, pos) => sum + (pos.closingValue || 0), 0);
  }, [stockMovements, items, warehouses, companySettings]);

  const yesterdayStockValue = useMemo(() => {
    if (companySettings?.enableStock === false) return 0;
    const positions = computeAllStockPositions(stockMovements, items, warehouses, yesterdayStr);
    return positions.reduce((sum, pos) => sum + (pos.closingValue || 0), 0);
  }, [stockMovements, items, warehouses, companySettings, yesterdayStr]);

  // Chart 1: Revenue vs Expense (last 6 months)
  const revenueVsExpenseData = useMemo(() => {
    const data: { month: string; Revenue: number; Expense: number }[] = [];
    const months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      return { prefix: `${year}-${month}`, label };
    });

    months.forEach(({ prefix, label }) => {
      let monthlyRev = 0;
      let monthlyExp = 0;
      vouchers.forEach((v) => {
        if (v.status !== VoucherStatus.POSTED) return;
        if (!v.date.startsWith(prefix)) return;
        v.lines.forEach((line) => {
          const acc = accounts.find((a) => a.id === line.accountId);
          if (!acc) return;
          if (acc.type === "income") {
            monthlyRev += (line.credit || 0) - (line.debit || 0);
          } else if (acc.type === "expense") {
            monthlyExp += (line.debit || 0) - (line.credit || 0);
          }
        });
      });

      data.push({
        month: label,
        Revenue: Math.max(0, monthlyRev),
        Expense: Math.max(0, monthlyExp),
      });
    });

    return data;
  }, [vouchers, accounts]);

  // Chart 2: Cash Flow Trend (last 30 days)
  const cashFlowTrendData = useMemo(() => {
    const data: { date: string; NetMovement: number }[] = [];
    const days = Array.from({ length: 30 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().split("T")[0];
    });

    days.forEach((dayStr) => {
      let movement = 0;
      vouchers.forEach((v) => {
        if (v.status !== VoucherStatus.POSTED) return;
        if (v.date !== dayStr) return;
        v.lines.forEach((line) => {
          const acc = accounts.find((a) => a.id === line.accountId);
          if (!acc) return;
          if (
            acc.id === "acc-cash" ||
            acc.group?.toLowerCase().includes("cash") ||
            acc.group?.toLowerCase().includes("bank") ||
            acc.name.toLowerCase().includes("bank") ||
            acc.name.toLowerCase().includes("cash")
          ) {
            movement += (line.debit || 0) - (line.credit || 0);
          }
        });
      });

      data.push({
        date: dayStr.slice(5), // Show as MM-DD
        NetMovement: movement,
      });
    });

    return data;
  }, [vouchers, accounts]);

  // Chart 3: Top 5 Customers by Revenue (Current Fiscal Year)
  const topCustomersData = useMemo(() => {
    const customerSales: Record<string, number> = {};
    invoices.forEach((inv) => {
      if (inv.type !== VoucherType.SALES_INVOICE || inv.status !== VoucherStatus.POSTED) return;
      if (currentFiscalYear) {
        if (inv.date < currentFiscalYear.startDate || inv.date > currentFiscalYear.endDate) return;
      }
      customerSales[inv.partyName] = (customerSales[inv.partyName] || 0) + (inv.grandTotal || 0);
    });

    return Object.entries(customerSales)
      .map(([name, Revenue]) => ({ name, Revenue }))
      .sort((a, b) => b.Revenue - a.Revenue)
      .slice(0, 5);
  }, [invoices, currentFiscalYear]);

  // Chart 4: Receivable Aging Pie
  const receivableAgingPieData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let current = 0;
    let b1_30 = 0;
    let b31_90 = 0;
    let b90plus = 0;

    invoices.forEach((inv) => {
      if (inv.type !== VoucherType.SALES_INVOICE || inv.status !== VoucherStatus.POSTED) return;
      if (inv.paymentStatus === PaymentStatus.PAID) return;

      const paid =
        billAllocations
          .filter((alloc) => alloc.invoiceId === inv.id)
          .reduce((s, a) => s + a.allocatedAmount, 0) ||
        inv.paidAmount ||
        0;
      const outstanding = inv.grandTotal - paid;
      if (outstanding <= 0) return;

      let dueDateStr = inv.dueDate;
      if (!dueDateStr) {
        const d = new Date(inv.date);
        d.setDate(d.getDate() + 30);
        dueDateStr = d.toISOString().split("T")[0];
      }

      const refDate = new Date(dueDateStr);
      refDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - refDate.getTime();
      const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) {
        current += outstanding;
      } else if (daysOverdue <= 30) {
        b1_30 += outstanding;
      } else if (daysOverdue <= 90) {
        b31_90 += outstanding;
      } else {
        b90plus += outstanding;
      }
    });

    return [
      { name: "Current", value: current },
      { name: "1-30 Days", value: b1_30 },
      { name: "31-90 Days", value: b31_90 },
      { name: ">90 Days", value: b90plus },
    ].filter((d) => d.value > 0);
  }, [invoices, billAllocations]);

  // Last 10 posted vouchers
  const recentVouchers = useMemo(() => {
    return [...vouchers]
      .filter((v) => v.status === VoucherStatus.POSTED)
      .sort((a, b) => b.date.localeCompare(a.date) || b.voucherNo.localeCompare(a.voucherNo))
      .slice(0, 10);
  }, [vouchers]);

  const handleVoucherClick = (v: any) => {
    setEditingVoucherId(v.id);
    switch (v.type) {
      case VoucherType.RECEIPT:
        setCurrentPage("receipt");
        break;
      case VoucherType.PAYMENT:
        setCurrentPage("payment");
        break;
      case VoucherType.JOURNAL:
        setCurrentPage("journal");
        break;
      case VoucherType.CONTRA:
        setCurrentPage("contra");
        break;
      case VoucherType.SALES_INVOICE:
      case VoucherType.SALES_RETURN:
      case VoucherType.PURCHASE_INVOICE:
      case VoucherType.PURCHASE_RETURN:
        setCurrentPage("billing");
        break;
      case VoucherType.DEBIT_NOTE:
        setCurrentPage("debit-note");
        break;
      case VoucherType.CREDIT_NOTE:
        setCurrentPage("credit-note");
        break;
      default:
        setCurrentPage("journal");
        break;
    }
  };

  const getBalanceImpact = (v: any) => {
    if (
      v.type === VoucherType.RECEIPT ||
      v.type === VoucherType.SALES_INVOICE ||
      v.type === VoucherType.SALES_RETURN
    ) {
      return (
        <span className="text-[#059669] font-bold font-mono">
          +{formatNumber(v.totalDebit || v.totalCredit || 0)}
        </span>
      );
    }
    if (
      v.type === VoucherType.PAYMENT ||
      v.type === VoucherType.PURCHASE_INVOICE ||
      v.type === VoucherType.PURCHASE_RETURN
    ) {
      return (
        <span className="text-[#dc2626] font-bold font-mono">
          -{formatNumber(v.totalDebit || v.totalCredit || 0)}
        </span>
      );
    }
    return <span className="text-gray-400 font-mono">Balanced</span>;
  };

  const renderTrend = (current: number, previous: number, label = "vs yesterday") => {
    if (previous === 0) {
      if (current === 0) return <span className="text-gray-400 text-[10px]">▬ 0% {label}</span>;
      return (
        <span className="text-[#059669] font-semibold text-[10px] flex items-center gap-0.5">
          <ArrowUpRight className="h-3 w-3" /> +100% {label}
        </span>
      );
    }
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    if (pct > 0) {
      return (
        <span className="text-[#059669] font-semibold text-[10px] flex items-center gap-0.5">
          <ArrowUpRight className="h-3 w-3" /> +{pct.toFixed(0)}% {label}
        </span>
      );
    } else if (pct < 0) {
      return (
        <span className="text-[#dc2626] font-semibold text-[10px] flex items-center gap-0.5">
          <ArrowDownRight className="h-3 w-3" /> {pct.toFixed(0)}% {label}
        </span>
      );
    }
    return <span className="text-gray-400 text-[10px]">▬ 0% {label}</span>;
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-6 page-wrapper text-xs select-none">
      {/* Title */}
      <div>
        <h1 className="text-[15px] font-semibold text-gray-800">
          Accounting & Financial Dashboard
        </h1>
        <p className="text-[11px] text-gray-500 mt-0.5">
          Live overview for {companySettings?.name || "Sutra ERP"}
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1: Today's Sales */}
        <div
          className="kpi-card bg-white border border-gray-200 p-4 flex flex-col justify-between h-[100px]"
          style={{
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
            transition: "transform 0.15s, box-shadow 0.15s",
            ["--kpi-color" as any]: "#059669",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(79,70,229,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(15,23,42,0.06)";
          }}
        >
          <div>
            <div className="kpi-label text-[10.5px] font-bold text-gray-500 uppercase tracking-widest">Today's Sales</div>
            <div
              className="kpi-value mt-1"
              style={{
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum"',
                fontWeight: 800,
                fontSize: "24px",
                color: "#0f172a",
                lineHeight: 1,
              }}
            >
              {symbol} {formatNumber(todaySales)}
            </div>
          </div>
          <div className="kpi-meta mt-2 flex items-center justify-between">
            {renderTrend(todaySales, yesterdaySales)}
          </div>
        </div>

        {/* KPI 2: Today's Collections */}
        <div
          className="kpi-card bg-white border border-gray-200 p-4 flex flex-col justify-between h-[100px]"
          style={{
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
            transition: "transform 0.15s, box-shadow 0.15s",
            ["--kpi-color" as any]: "#4f46e5",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(79,70,229,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(15,23,42,0.06)";
          }}
        >
          <div>
            <div className="kpi-label text-[10.5px] font-bold text-gray-500 uppercase tracking-widest">
              Today's Collections
            </div>
            <div
              className="kpi-value mt-1"
              style={{
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum"',
                fontWeight: 800,
                fontSize: "24px",
                color: "#0f172a",
                lineHeight: 1,
              }}
            >
              {symbol} {formatNumber(todayCollections)}
            </div>
          </div>
          <div className="kpi-meta mt-2 flex items-center justify-between">
            {renderTrend(todayCollections, yesterdayCollections)}
          </div>
        </div>

        {/* KPI 3: Today's Payments */}
        <div
          className="kpi-card bg-white border border-gray-200 p-4 flex flex-col justify-between h-[100px]"
          style={{
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
            transition: "transform 0.15s, box-shadow 0.15s",
            ["--kpi-color" as any]: "#d97706",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(79,70,229,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(15,23,42,0.06)";
          }}
        >
          <div>
            <div className="kpi-label text-[10.5px] font-bold text-gray-500 uppercase tracking-widest">Today's Payments</div>
            <div
              className="kpi-value mt-1"
              style={{
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum"',
                fontWeight: 800,
                fontSize: "24px",
                color: "#0f172a",
                lineHeight: 1,
              }}
            >
              {symbol} {formatNumber(todayPayments)}
            </div>
          </div>
          <div className="kpi-meta mt-2 flex items-center justify-between">
            {renderTrend(todayPayments, yesterdayPayments)}
          </div>
        </div>

        {/* KPI 4: Cash & Bank Balance */}
        <div
          className="kpi-card bg-white border border-gray-200 p-4 flex flex-col justify-between h-[100px]"
          style={{
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
            transition: "transform 0.15s, box-shadow 0.15s",
            ["--kpi-color" as any]: "#0284c7",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(79,70,229,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(15,23,42,0.06)";
          }}
        >
          <div>
            <div className="kpi-label text-[10.5px] font-bold text-gray-500 uppercase tracking-widest">
              Cash & Bank Balance
            </div>
            <div
              className="kpi-value mt-1"
              style={{
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum"',
                fontWeight: 800,
                fontSize: "24px",
                color: "#0f172a",
                lineHeight: 1,
              }}
            >
              {symbol} {formatNumber(cashBankBalance)}
            </div>
          </div>
          <div className="kpi-meta mt-2 flex items-center justify-between">
            {renderTrend(cashBankBalance, yesterdayCashBankBalance)}
          </div>
        </div>

        {/* KPI 5: Receivables Outstanding */}
        <div
          className="kpi-card bg-white border border-gray-200 p-4 flex flex-col justify-between h-[100px]"
          style={{
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
            transition: "transform 0.15s, box-shadow 0.15s",
            ["--kpi-color" as any]: "#7c3aed",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(79,70,229,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(15,23,42,0.06)";
          }}
        >
          <div>
            <div className="kpi-label text-[10.5px] font-bold text-gray-500 uppercase tracking-widest">
              Receivables Outstanding
            </div>
            <div
              className="kpi-value mt-1"
              style={{
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum"',
                fontWeight: 800,
                fontSize: "24px",
                color: "#0f172a",
                lineHeight: 1,
              }}
            >
              {symbol} {formatNumber(receivablesOutstanding)}
            </div>
          </div>
          <div className="kpi-meta mt-2 flex items-center justify-between">
            {renderTrend(receivablesOutstanding, yesterdayReceivablesOutstanding)}
          </div>
        </div>

        {/* KPI 6: Payables Outstanding */}
        <div
          className="kpi-card bg-white border border-gray-200 p-4 flex flex-col justify-between h-[100px]"
          style={{
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
            transition: "transform 0.15s, box-shadow 0.15s",
            ["--kpi-color" as any]: "#dc2626",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(79,70,229,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(15,23,42,0.06)";
          }}
        >
          <div>
            <div className="kpi-label text-[10.5px] font-bold text-gray-500 uppercase tracking-widest">
              Payables Outstanding
            </div>
            <div
              className="kpi-value mt-1"
              style={{
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum"',
                fontWeight: 800,
                fontSize: "24px",
                color: "#0f172a",
                lineHeight: 1,
              }}
            >
              {symbol} {formatNumber(payablesOutstanding)}
            </div>
          </div>
          <div className="kpi-meta mt-2 flex items-center justify-between">
            {renderTrend(payablesOutstanding, yesterdayPayablesOutstanding)}
          </div>
        </div>

        {/* KPI 7: Net Profit This Month */}
        <div
          className="kpi-card bg-white border border-gray-200 p-4 flex flex-col justify-between h-[100px]"
          style={{
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
            transition: "transform 0.15s, box-shadow 0.15s",
            ["--kpi-color" as any]: "#059669",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(79,70,229,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(15,23,42,0.06)";
          }}
        >
          <div>
            <div className="kpi-label text-[10.5px] font-bold text-gray-500 uppercase tracking-widest">
              Net Profit This Month
            </div>
            <div
              className="kpi-value mt-1"
              style={{
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum"',
                fontWeight: 800,
                fontSize: "24px",
                color: "#0f172a",
                lineHeight: 1,
              }}
            >
              {symbol} {formatNumber(netProfitThisMonth)}
            </div>
          </div>
          <div className="kpi-meta mt-2 flex items-center justify-between">
            {renderTrend(netProfitThisMonth, netProfitLastMonth, "vs last month")}
          </div>
        </div>

        {/* KPI 8: Stock Value */}
        {companySettings?.enableStock && (
          <div
            className="kpi-card bg-white border border-gray-200 p-4 flex flex-col justify-between h-[100px]"
            style={{
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
              transition: "transform 0.15s, box-shadow 0.15s",
              ["--kpi-color" as any]: "#0284c7",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(79,70,229,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(15,23,42,0.06)";
            }}
          >
            <div>
              <div className="kpi-label text-[10.5px] font-bold text-gray-500 uppercase tracking-widest">Stock Value</div>
              <div
                className="kpi-value mt-1"
                style={{
                  fontVariantNumeric: "tabular-nums",
                  fontFeatureSettings: '"tnum"',
                  fontWeight: 800,
                  fontSize: "24px",
                  color: "#0f172a",
                  lineHeight: 1,
                }}
              >
                {symbol} {formatNumber(stockValue)}
              </div>
            </div>
            <div className="kpi-meta mt-2 flex items-center justify-between">
              {renderTrend(stockValue, yesterdayStockValue)}
            </div>
          </div>
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chart 1: Revenue vs Expense */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px", letterSpacing: "-0.01em" }} className="mb-4">
            Revenue vs Expense (Last 6 Months)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" className="rounded-xl overflow-hidden">
              <BarChart data={revenueVsExpenseData}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <RechartsTooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(15,23,42,0.1)', fontSize: '11px', fontFamily: 'Inter' }} formatter={(value) => [`Rs. ${formatNumber(value as number)}`]} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="Revenue" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expense" fill={COLORS[3]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Cash Flow Trend */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px", letterSpacing: "-0.01em" }} className="mb-4">
            Cash Flow Trend (Last 30 Days)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" className="rounded-xl overflow-hidden">
              <LineChart data={cashFlowTrendData}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <RechartsTooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(15,23,42,0.1)', fontSize: '11px', fontFamily: 'Inter' }} formatter={(value) => [`Rs. ${formatNumber(value as number)}`]} />
                <Line
                  type="monotone"
                  dataKey="NetMovement"
                  stroke={COLORS[1]}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Top 5 Customers */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px", letterSpacing: "-0.01em" }} className="mb-4">
            Top 5 Customers by Revenue
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" className="rounded-xl overflow-hidden">
              <BarChart data={topCustomersData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} width={80} />
                <RechartsTooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(15,23,42,0.1)', fontSize: '11px', fontFamily: 'Inter' }} formatter={(value) => [`Rs. ${formatNumber(value as number)}`]} />
                <Bar dataKey="Revenue" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Receivable Aging Pie */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px", letterSpacing: "-0.01em" }} className="mb-4">
            Receivable Aging Distribution
          </h3>
          <div className="h-64 flex items-center justify-center">
            {receivableAgingPieData.length === 0 ? (
              <span className="text-gray-400">No outstanding receivables to analyze</span>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6 w-full justify-around">
                <div className="w-40 h-40">
                  <ResponsiveContainer width="100%" height="100%" className="rounded-xl overflow-hidden">
                    <PieChart>
                      <Pie
                        data={receivableAgingPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {receivableAgingPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(15,23,42,0.1)', fontSize: '11px', fontFamily: 'Inter' }}
                        formatter={(value) => [`Rs. ${formatNumber(value as number)}`]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2">
                  {receivableAgingPieData.map((d, index) => (
                    <div key={d.name} className="flex items-center gap-2 text-[11px] text-gray-600">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></span>
                      <span className="font-medium">{d.name}:</span>
                      <span className="font-semibold font-mono text-[#0f172a]">
                        {symbol} {formatNumber(d.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <h3 style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px", letterSpacing: "-0.01em" }} className="mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            {
              label: "New Sales Invoice",
              icon: <PlusCircle className="w-4 h-4" />,
              page: "billing",
              iconClass: "bg-emerald-50 text-emerald-600 rounded-lg p-2",
            },
            {
              label: "New Receipt",
              icon: <Wallet className="w-4 h-4" />,
              page: "receipt",
              iconClass: "bg-indigo-50 text-indigo-600 rounded-lg p-2",
            },
            {
              label: "New Payment",
              icon: <TrendingDown className="w-4 h-4" />,
              page: "payment",
              iconClass: "bg-amber-50 text-amber-600 rounded-lg p-2",
            },
            {
              label: "New Journal",
              icon: <ArrowRightLeft className="w-4 h-4" />,
              page: "journal",
              iconClass: "bg-violet-50 text-violet-600 rounded-lg p-2",
            },
            {
              label: "View Ledger",
              icon: <BookOpen className="w-4 h-4" />,
              page: "ledger",
              iconClass: "bg-sky-50 text-sky-600 rounded-lg p-2",
            },
            {
              label: "Day Book",
              icon: <FileText className="w-4 h-4" />,
              page: "day-book",
              iconClass: "bg-slate-50 text-slate-600 rounded-lg p-2",
            },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => setCurrentPage(action.page)}
              className="bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30 rounded-xl p-3 flex flex-col items-center gap-2 transition-all duration-150 text-[11px] font-semibold text-slate-600 hover:text-indigo-700 shadow-sm h-auto"
            >
              <div className={action.iconClass}>{action.icon}</div>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div
        className="bg-white border border-slate-200 overflow-hidden"
        style={{
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
        }}
      >
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px", letterSpacing: "-0.01em" }}>
            Recent Transactions
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full border-collapse text-xs text-left">
            <thead>
              <tr className="bg-[#f8fafc] border-b-2 border-[#c5cad8]">
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em]">
                  Date
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em]">
                  Type
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em]">
                  Voucher No
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em]">
                  Party
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                  Amount
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                  Balance Impact
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150">
              {recentVouchers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-gray-400">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                recentVouchers.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => handleVoucherClick(v)}
                    className="hover:bg-[#e8eeff] cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5 text-gray-700">
                      {companySettings?.dateFormat === "BS" ? v.dateNepali : v.date}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="badge inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-150 text-gray-700 uppercase">
                        {v.type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-gray-800">{v.voucherNo}</td>
                    <td className="px-3 py-2.5 text-gray-700">{v.partyName || "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                      {symbol} {formatNumber(v.totalDebit || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{getBalanceImpact(v)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
