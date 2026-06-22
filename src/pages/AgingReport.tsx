import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, Select, NepaliDatePicker, ActionToolbar, ConfirmDialog, Input } from "../components/ui";
import { computeAgingBuckets } from "../lib/accounting";
import { workbookFromArray, downloadWorkbook } from "../lib/exportUtils";
import { formatNumber, dateToAD } from "../lib/utils";
import { Invoice, VoucherType, VoucherStatus, PaymentStatus, Party } from "../lib/types";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { FileText, Download, Printer, Mail, Send, ChevronDown, ChevronUp, Edit3, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

// Default slabs configuration
const DEFAULT_SLABS = [
  { from: 0, to: 30, label: "0-30 days" },
  { from: 31, to: 60, label: "31-60 days" },
  { from: 61, to: 90, label: "61-90 days" },
  { from: 91, to: 180, label: "91-180 days" },
  { from: 181, to: null, label: ">180 days" },
];

const COLORS = ["#22c55e", "#eab308", "#f97316", "#ef4444", "#991b1b"];

export default function AgingReport() {
  const { invoices, parties, currentFiscalYear, companySettings } = useStore();
  const symbol = companySettings?.currencySymbol || "Rs.";

  // Tab State
  const [activeTab, setActiveTab] = useState<"partySummary" | "receivablesDetail" | "payablesDetail">("partySummary");

  // Filters state
  const [reportType, setReportType] = useState<"receivables" | "payables" | "both">("receivables");
  const [asOnDate, setAsOnDate] = useState(dateToAD(new Date()));
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [showZeroBalance, setShowZeroBalance] = useState(false);
  const [agingBasis, setAgingBasis] = useState<"billDate" | "dueDate">("dueDate");

  // Detail tab specific filters state
  const [detailFromDate, setDetailFromDate] = useState("");
  const [detailToDate, setDetailToDate] = useState("");
  const [detailStatus, setDetailStatus] = useState<"all" | "notDue" | "1-30" | "31-60" | "over60">("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [sortBy, setSortBy] = useState<"partyName" | "daysOverdue" | "balance">("daysOverdue");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Slab Config state
  const [slabs, setSlabs] = useState(DEFAULT_SLABS);
  const [isEditingSlabs, setIsEditingSlabs] = useState(false);
  const [tempSlabs, setTempSlabs] = useState(DEFAULT_SLABS);

  // Drilldown state
  const [expandedPartyId, setExpandedPartyId] = useState<string | null>(null);

  // Chart visibility
  const [showChart, setShowChart] = useState(true);

  // Reminder Modal state
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [selectedReminderParties, setSelectedReminderParties] = useState<Set<string>>(new Set());
  const [reminderTemplate, setReminderTemplate] = useState(
    "Dear {party_name},\n\nThis is a friendly reminder that you have an outstanding balance of Rs. {total_outstanding} as of today. Your oldest pending invoice dates back to {oldest_bill_date} ({days_overdue} days overdue).\n\nPlease make payments at your earliest convenience.\n\nThank you,\nSutra ERP Pvt. Ltd."
  );

  // Date difference helper
  const daysBetween = (date1: string, date2: string): number => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = d2.getTime() - d1.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Status Badge Helper
  const getStatusBadge = (days: number) => {
    if (days <= 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">
          Not Due
        </span>
      );
    }
    if (days <= 30) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
          1-30 Days
        </span>
      );
    }
    if (days <= 60) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
          31-60 Days
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
        &gt;60 Days Overdue
      </span>
    );
  };

  // Fetch unique groups
  const partyGroups = useMemo(() => {
    const groups = new Set<string>();
    parties.forEach((p) => {
      if ((p as any).group) groups.add((p as any).group);
    });
    return Array.from(groups);
  }, [parties]);

  // Filter parties based on group and type
  const filteredPartiesList = useMemo(() => {
    return parties.filter((p) => {
      if (selectedGroup && (p as any).group !== selectedGroup) return false;
      
      const currentReportType = activeTab === "receivablesDetail" 
        ? "receivables" 
        : activeTab === "payablesDetail" 
          ? "payables" 
          : reportType;

      if (currentReportType === "receivables" && p.type !== "customer" && p.type !== "both") return false;
      if (currentReportType === "payables" && p.type !== "supplier" && p.type !== "both") return false;
      return p.isActive;
    });
  }, [parties, selectedGroup, reportType, activeTab]);

  const partyOptions = useMemo(() => {
    return [
      { value: "", label: "All Parties" },
      ...filteredPartiesList.map((p) => ({ value: p.id, label: `${p.code ? p.code + " - " : ""}${p.name}` })),
    ];
  }, [filteredPartiesList]);

  // Generate BillWiseEntries
  const billWiseEntries = useMemo(() => {
    const unsettledInvoices = invoices.filter((inv) => {
      if (inv.status !== VoucherStatus.POSTED) return false;
      if (inv.paymentStatus === PaymentStatus.PAID) return false;

      // Filter by invoice type
      const currentReportType = activeTab === "receivablesDetail"
        ? "receivables"
        : activeTab === "payablesDetail"
          ? "payables"
          : reportType;

      if (currentReportType === "receivables") {
        if (inv.type !== VoucherType.SALES_INVOICE) return false;
      } else if (currentReportType === "payables") {
        if (inv.type !== VoucherType.PURCHASE_INVOICE) return false;
      } else {
        if (inv.type !== VoucherType.SALES_INVOICE && inv.type !== VoucherType.PURCHASE_INVOICE) return false;
      }

      // Filter by party
      if (selectedPartyId && inv.partyId !== selectedPartyId) return false;

      // Filter by group
      if (selectedGroup) {
        const partyObj = parties.find((p) => p.id === inv.partyId);
        if ((partyObj as any)?.group !== selectedGroup) return false;
      }

      return true;
    });

    return unsettledInvoices.map((inv) => {
      const balance = inv.grandTotal - (inv.paidAmount || 0);
      return {
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.date,
        invoiceDateNepali: inv.dateNepali || inv.date,
        dueDate: inv.dueDate || inv.date,
        dueDateNepali: (inv as any).dueDateNepali || inv.dueDate || inv.date,
        partyId: inv.partyId,
        partyName: inv.partyName,
        partyPan: inv.partyPan,
        originalAmount: inv.grandTotal,
        paidAmount: inv.paidAmount || 0,
        balance,
      };
    });
  }, [invoices, reportType, selectedPartyId, selectedGroup, parties, activeTab]);

  // Calculate Aging Buckets (Tab 1 Summary)
  const partyRows = useMemo(() => {
    const data = computeAgingBuckets(billWiseEntries, asOnDate, slabs);
    if (showZeroBalance) return data;
    return data.filter((row) => row.total > 0);
  }, [billWiseEntries, asOnDate, slabs, showZeroBalance]);

  // Calculate summary totals (Tab 1 Summary)
  const summaryTotals = useMemo(() => {
    const totals = slabs.map((s) => ({ label: s.label, amount: 0 }));
    let grandTotal = 0;

    partyRows.forEach((row) => {
      row.buckets.forEach((bucket, index) => {
        totals[index].amount = Math.round((totals[index].amount + bucket.amount) * 100) / 100;
      });
      grandTotal = Math.round((grandTotal + row.total) * 100) / 100;
    });

    return {
      buckets: totals,
      grandTotal,
    };
  }, [partyRows, slabs]);

  // Chart data (Tab 1 Summary)
  const chartData = useMemo(() => {
    return summaryTotals.buckets.map((b) => ({
      name: b.label,
      value: b.amount,
    })).filter((c) => c.value > 0);
  }, [summaryTotals]);

  // Bill-wise details for Tab 2 & 3
  const detailBills = useMemo(() => {
    if (activeTab === "partySummary") return [];

    const targetType = activeTab === "receivablesDetail" ? VoucherType.SALES_INVOICE : VoucherType.PURCHASE_INVOICE;

    const filtered = invoices.filter((inv) => {
      if (inv.status !== VoucherStatus.POSTED) return false;
      
      const balance = inv.grandTotal - (inv.paidAmount || 0);
      if (!showZeroBalance && balance <= 0) return false;

      if (inv.type !== targetType) return false;

      // Filter by party
      if (selectedPartyId && inv.partyId !== selectedPartyId) return false;

      // Filter by group
      if (selectedGroup) {
        const partyObj = parties.find((p) => p.id === inv.partyId);
        if ((partyObj as any)?.group !== selectedGroup) return false;
      }

      // Filter by invoice date range
      if (detailFromDate && inv.date < detailFromDate) return false;
      if (detailToDate && inv.date > detailToDate) return false;

      return true;
    });

    let bills = filtered.map((inv) => {
      const balance = inv.grandTotal - (inv.paidAmount || 0);
      const refDate = agingBasis === "dueDate" ? (inv.dueDate || inv.date) : inv.date;
      const daysOverdue = daysBetween(refDate, asOnDate);

      return {
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.date,
        invoiceDateNepali: inv.dateNepali || inv.date,
        dueDate: inv.dueDate || inv.date,
        dueDateNepali: (inv as any).dueDateNepali || inv.dueDate || inv.date,
        partyId: inv.partyId,
        partyName: inv.partyName,
        partyPan: inv.partyPan,
        originalAmount: inv.grandTotal,
        paidAmount: inv.paidAmount || 0,
        balance,
        daysOverdue,
      };
    });

    // Filter by status
    if (detailStatus !== "all") {
      bills = bills.filter((b) => {
        if (detailStatus === "notDue") return b.daysOverdue <= 0;
        if (detailStatus === "1-30") return b.daysOverdue > 0 && b.daysOverdue <= 30;
        if (detailStatus === "31-60") return b.daysOverdue > 30 && b.daysOverdue <= 60;
        if (detailStatus === "over60") return b.daysOverdue > 60;
        return true;
      });
    }

    // Filter by amount range
    if (minAmount !== "") {
      const min = parseFloat(minAmount);
      if (!isNaN(min)) {
        bills = bills.filter((b) => b.balance >= min);
      }
    }
    if (maxAmount !== "") {
      const max = parseFloat(maxAmount);
      if (!isNaN(max)) {
        bills = bills.filter((b) => b.balance <= max);
      }
    }

    // Sort
    bills.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "partyName") {
        comparison = a.partyName.localeCompare(b.partyName);
      } else if (sortBy === "daysOverdue") {
        comparison = a.daysOverdue - b.daysOverdue;
      } else if (sortBy === "balance") {
        comparison = a.balance - b.balance;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return bills;
  }, [
    invoices,
    activeTab,
    selectedPartyId,
    selectedGroup,
    detailFromDate,
    detailToDate,
    showZeroBalance,
    agingBasis,
    asOnDate,
    detailStatus,
    minAmount,
    maxAmount,
    sortBy,
    sortOrder,
    parties,
  ]);

  // Detail tab chart data
  const detailChartData = useMemo(() => {
    const buckets = [
      { name: "Not Due", value: 0 },
      { name: "1-30 Days", value: 0 },
      { name: "31-60 Days", value: 0 },
      { name: ">60 Days", value: 0 },
    ];

    detailBills.forEach((b) => {
      if (b.daysOverdue <= 0) {
        buckets[0].value += b.balance;
      } else if (b.daysOverdue <= 30) {
        buckets[1].value += b.balance;
      } else if (b.daysOverdue <= 60) {
        buckets[2].value += b.balance;
      } else {
        buckets[3].value += b.balance;
      }
    });

    buckets.forEach((b) => {
      b.value = Math.round(b.value * 100) / 100;
    });

    return buckets.filter((b) => b.value > 0);
  }, [detailBills]);

  // Detail tab summary totals
  const detailSummaryTotals = useMemo(() => {
    const totalBills = detailBills.length;
    const totalOriginal = detailBills.reduce((sum, b) => sum + b.originalAmount, 0);
    const totalPaid = detailBills.reduce((sum, b) => sum + b.paidAmount, 0);
    const totalBalance = detailBills.reduce((sum, b) => sum + b.balance, 0);

    const buckets = [
      { label: "Not Due", amount: 0 },
      { label: "1-30 Days", amount: 0 },
      { label: "31-60 Days", amount: 0 },
      { label: ">60 Days", amount: 0 },
    ];

    detailBills.forEach((b) => {
      if (b.daysOverdue <= 0) {
        buckets[0].amount += b.balance;
      } else if (b.daysOverdue <= 30) {
        buckets[1].amount += b.balance;
      } else if (b.daysOverdue <= 60) {
        buckets[2].amount += b.balance;
      } else {
        buckets[3].amount += b.balance;
      }
    });

    buckets.forEach((b) => {
      b.amount = Math.round(b.amount * 100) / 100;
    });

    return {
      totalBills,
      totalOriginal,
      totalPaid,
      totalBalance: Math.round(totalBalance * 100) / 100,
      buckets,
    };
  }, [detailBills]);

  // Reminder targets
  const partiesWithOutstanding = useMemo(() => {
    if (activeTab === "partySummary") {
      return partyRows.filter((p) => p.total > 0);
    } else {
      const pMap: { [partyId: string]: { partyId: string; partyName: string; total: number; bills: any[] } } = {};
      detailBills.forEach((b) => {
        if (!pMap[b.partyId]) {
          pMap[b.partyId] = { partyId: b.partyId, partyName: b.partyName, total: 0, bills: [] };
        }
        pMap[b.partyId].total += b.balance;
        pMap[b.partyId].bills.push(b);
      });
      return Object.values(pMap).filter((p) => p.total > 0);
    }
  }, [partyRows, detailBills, activeTab]);

  const toggleSelectReminderParty = (id: string) => {
    const updated = new Set(selectedReminderParties);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedReminderParties(updated);
  };

  const handleSelectAllReminderParties = () => {
    if (selectedReminderParties.size === partiesWithOutstanding.length) {
      setSelectedReminderParties(new Set());
    } else {
      setSelectedReminderParties(new Set(partiesWithOutstanding.map((p) => p.partyId)));
    }
  };

  const handleSendReminderNotifications = () => {
    if (selectedReminderParties.size === 0) {
      toast.error("Please select at least one party to notify.");
      return;
    }

    const list = Array.from(selectedReminderParties);
    toast.promise(
      new Promise<void>((resolve) => {
        let sentCount = 0;
        const interval = setInterval(() => {
          if (sentCount >= list.length) {
            clearInterval(interval);
            resolve();
          } else {
            const pId = list[sentCount];
            const pRow = partiesWithOutstanding.find((pr) => pr.partyId === pId);
            if (pRow) {
              const oldestBill = pRow.bills.reduce((oldest: any, current: any) => {
                return (!oldest || (current.daysOverdue || 0) > (oldest.daysOverdue || 0)) ? current : oldest;
              }, null);
              
              // Format template
              let msg = reminderTemplate
                .replace(/{party_name}/g, pRow.partyName)
                .replace(/{total_outstanding}/g, formatNumber(pRow.total))
                .replace(/{oldest_bill_date}/g, oldestBill ? oldestBill.invoiceDate : "N/A")
                .replace(/{days_overdue}/g, oldestBill ? String(oldestBill.daysOverdue) : "0");
              
              console.log(`Mock SMTP Sending to ${pRow.partyName}: ${msg}`);
            }
            sentCount++;
          }
        }, 300);
      }),
      {
        loading: "Sending outstanding reminders via SMTP...",
        success: `Successfully dispatched reminders to ${selectedReminderParties.size} parties.`,
        error: "Failed to send reminders.",
      }
    );

    setShowReminderModal(false);
  };

  // Slab Editing Handlers
  const handleSaveSlabs = () => {
    for (let i = 0; i < tempSlabs.length - 1; i++) {
      if (tempSlabs[i].to !== null && tempSlabs[i].to! >= tempSlabs[i + 1].from) {
        toast.error("Invalid Slabs: Intervals must be sequential and not overlap.");
        return;
      }
    }
    setSlabs(tempSlabs);
    setIsEditingSlabs(false);
    toast.success("Aging slabs configuration updated.");
  };

  const handleExportExcel = () => {
    try {
      if (activeTab === "partySummary") {
        const headers = ["Party Name", "PAN", ...slabs.map((s) => s.label), "Total Outstanding"];
        const rows = partyRows.map((row) => [
          row.partyName,
          row.partyPan || "N/A",
          ...row.buckets.map((b) => b.amount),
          row.total,
        ]);
        const workbook = workbookFromArray(headers, rows, "Outstanding Aging");
        downloadWorkbook(workbook, `Outstanding_Aging_Report_${asOnDate}.xlsx`);
      } else {
        const headers = [
          "Party Name",
          "Bill No",
          "Bill Date",
          "Due Date",
          "Bill Amount",
          "Paid Amount",
          "Balance Amount",
          "Days Overdue",
          "Status"
        ];
        const rows = detailBills.map((b) => [
          b.partyName,
          b.invoiceNo,
          b.invoiceDateNepali,
          b.dueDateNepali,
          b.originalAmount,
          b.paidAmount,
          b.balance,
          b.daysOverdue > 0 ? b.daysOverdue : 0,
          b.daysOverdue <= 0 ? "Not Due" : `${b.daysOverdue} Days Overdue`
        ]);
        const sheetName = activeTab === "receivablesDetail" ? "Receivables Detail" : "Payables Detail";
        const workbook = workbookFromArray(headers, rows, sheetName);
        downloadWorkbook(workbook, `${sheetName.replace(/\s+/g, "_")}_${asOnDate}.xlsx`);
      }
      toast.success("Excel exported successfully.");
    } catch (err) {
      toast.error("Failed to export Excel.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-4 page-wrapper">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Outstanding Aging Analysis</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            View aging of outstanding balances by party with configurable slabs and reminder dispatch.
          </p>
        </div>
        <div className="flex items-center gap-1.5 no-print">
          <Button onClick={() => setShowChart(!showChart)} variant="outline" size="sm">
            {showChart ? "Hide Chart" : "Show Chart"}
          </Button>
          <Button onClick={() => setShowReminderModal(true)} className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
            <Mail className="w-3.5 h-3.5 mr-1" /> Send Reminders
          </Button>
          <Button onClick={handleExportExcel} variant="outline" size="sm">
            <Download className="w-3.5 h-3.5 mr-1" /> Export Excel
          </Button>
          <Button onClick={handlePrint} variant="outline" size="sm">
            <Printer className="w-3.5 h-3.5 mr-1" /> Print Report
          </Button>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-2 no-print">
        <button
          onClick={() => {
            setActiveTab("partySummary");
            setSelectedPartyId("");
          }}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "partySummary"
              ? "border-blue-600 text-blue-600 dark:text-blue-400 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          Party Summary Aging
        </button>
        <button
          onClick={() => {
            setActiveTab("receivablesDetail");
            setSelectedPartyId("");
          }}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "receivablesDetail"
              ? "border-blue-600 text-blue-600 dark:text-blue-400 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          Bills Receivable (Detail)
        </button>
        <button
          onClick={() => {
            setActiveTab("payablesDetail");
            setSelectedPartyId("");
          }}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "payablesDetail"
              ? "border-blue-600 text-blue-600 dark:text-blue-400 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          Bills Payable (Detail)
        </button>
      </div>

      {/* Main Filter Section */}
      <Card border padding="md" className="no-print">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {activeTab === "partySummary" ? (
            <Select
              label="Type"
              options={[
                { value: "receivables", label: "Receivables (Customers)" },
                { value: "payables", label: "Payables (Suppliers)" },
                { value: "both", label: "Both" },
              ]}
              value={reportType}
              onChange={(v) => {
                setReportType(v as any);
                setSelectedPartyId("");
              }}
            />
          ) : (
            <NepaliDatePicker label="From Date" value={detailFromDate} onChange={setDetailFromDate} />
          )}

          {activeTab !== "partySummary" && (
            <NepaliDatePicker label="To Date" value={detailToDate} onChange={setDetailToDate} />
          )}

          <NepaliDatePicker label="As On Date" value={asOnDate} onChange={setAsOnDate} />

          <Select
            label="Party Group"
            options={[
              { value: "", label: "All Groups" },
              ...partyGroups.map((g) => ({ value: g, label: g })),
            ]}
            value={selectedGroup}
            onChange={(v) => {
              setSelectedGroup(v);
              setSelectedPartyId("");
            }}
          />

          <Select
            label="Party"
            options={partyOptions}
            value={selectedPartyId}
            onChange={setSelectedPartyId}
            searchable
          />

          {activeTab === "partySummary" && (
            <div className="flex flex-col gap-2 pt-5">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showZeroBalance"
                  checked={showZeroBalance}
                  onChange={(e) => setShowZeroBalance(e.target.checked)}
                  className="rounded border-gray-300 mr-2 h-4 w-4"
                />
                <label htmlFor="showZeroBalance" className="text-xs text-gray-700 font-medium">
                  Show Zero Balance
                </label>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 font-medium">Basis:</span>
                <label className="flex items-center text-xs">
                  <input
                    type="radio"
                    name="basis"
                    checked={agingBasis === "billDate"}
                    onChange={() => setAgingBasis("billDate")}
                    className="mr-1"
                  />
                  Bill Date
                </label>
                <label className="flex items-center text-xs">
                  <input
                    type="radio"
                    name="basis"
                    checked={agingBasis === "dueDate"}
                    onChange={() => setAgingBasis("dueDate")}
                    className="mr-1"
                  />
                  Due Date
                </label>
              </div>
            </div>
          )}
        </div>

        {activeTab !== "partySummary" && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4 pt-3 border-t border-gray-100">
            <Select
              label="Status"
              options={[
                { value: "all", label: "All Statuses" },
                { value: "notDue", label: "Not Due" },
                { value: "1-30", label: "1-30 Days" },
                { value: "31-60", label: "31-60 Days" },
                { value: "over60", label: ">60 Days" },
              ]}
              value={detailStatus}
              onChange={(v) => setDetailStatus(v as any)}
            />
            <Input
              label="Min Balance"
              type="number"
              placeholder="Min"
              value={minAmount}
              onChange={setMinAmount}
            />
            <Input
              label="Max Balance"
              type="number"
              placeholder="Max"
              value={maxAmount}
              onChange={setMaxAmount}
            />
            <Select
              label="Sort By"
              options={[
                { value: "partyName", label: "Party Name" },
                { value: "daysOverdue", label: "Days Overdue" },
                { value: "balance", label: "Balance" },
              ]}
              value={sortBy}
              onChange={(v) => setSortBy(v as any)}
            />
            <Select
              label="Sort Order"
              options={[
                { value: "asc", label: "Ascending" },
                { value: "desc", label: "Descending" },
              ]}
              value={sortOrder}
              onChange={(v) => setSortOrder(v as any)}
            />
          </div>
        )}

        <div className="mt-3 flex justify-between items-center pt-3 border-t border-gray-100">
          <button
            onClick={() => {
              setTempSlabs([...slabs]);
              setIsEditingSlabs(true);
            }}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit Aging Slabs Configuration
          </button>
          
          {activeTab !== "partySummary" && (
            <div className="flex items-center gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showZeroBalance"
                  checked={showZeroBalance}
                  onChange={(e) => setShowZeroBalance(e.target.checked)}
                  className="rounded border-gray-300 mr-2 h-4 w-4"
                />
                <label htmlFor="showZeroBalance" className="text-xs text-gray-700 font-medium">
                  Show Zero Balance
                </label>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 font-medium">Basis:</span>
                <label className="flex items-center text-xs">
                  <input
                    type="radio"
                    name="basisDetail"
                    checked={agingBasis === "billDate"}
                    onChange={() => setAgingBasis("billDate")}
                    className="mr-1"
                  />
                  Bill Date
                </label>
                <label className="flex items-center text-xs">
                  <input
                    type="radio"
                    name="basisDetail"
                    checked={agingBasis === "dueDate"}
                    onChange={() => setAgingBasis("dueDate")}
                    className="mr-1"
                  />
                  Due Date
                </label>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Slabs configuration panel inline */}
      {isEditingSlabs && (
        <Card border padding="md" className="no-print bg-slate-50 border-blue-200">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">Configure Slabs</h3>
          <div className="space-y-2">
            {tempSlabs.map((slab, idx) => (
              <div key={idx} className="flex gap-2 items-center text-xs">
                <input
                  type="text"
                  placeholder="Label (e.g. 0-30 days)"
                  value={slab.label}
                  onChange={(e) => {
                    const copy = [...tempSlabs];
                    copy[idx].label = e.target.value;
                    setTempSlabs(copy);
                  }}
                  className="input flex-1"
                />
                <input
                  type="number"
                  placeholder="From (days)"
                  value={slab.from}
                  onChange={(e) => {
                    const copy = [...tempSlabs];
                    copy[idx].from = parseInt(e.target.value, 10) || 0;
                    setTempSlabs(copy);
                  }}
                  className="input w-24"
                />
                <input
                  type="number"
                  placeholder="To (days or blank for infinity)"
                  value={slab.to === null ? "" : slab.to}
                  onChange={(e) => {
                    const copy = [...tempSlabs];
                    copy[idx].to = e.target.value === "" ? null : parseInt(e.target.value, 10);
                    setTempSlabs(copy);
                  }}
                  className="input w-24"
                />
                <button
                  type="button"
                  onClick={() => {
                    setTempSlabs(tempSlabs.filter((_, i) => i !== idx));
                  }}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2">
              <Button
                onClick={() => {
                  setTempSlabs([...tempSlabs, { from: 0, to: null, label: "New Slab" }]);
                }}
                variant="outline"
                size="sm"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Slab
              </Button>
              <div className="flex gap-1.5">
                <Button onClick={handleSaveSlabs} className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                  Save Slabs
                </Button>
                <Button onClick={() => setIsEditingSlabs(false)} variant="outline" size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Collapsible Chart and Slabs summary */}
      {showChart && (activeTab === "partySummary" ? chartData.length > 0 : detailChartData.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
          <Card border padding="sm" className="col-span-2">
            <h3 className="text-xs font-bold text-gray-700 mb-2 uppercase">Aging Slab Distribution</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activeTab === "partySummary" ? chartData : detailChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {(activeTab === "partySummary" ? chartData : detailChartData).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${symbol} ${formatNumber(v)}`} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card border padding="sm" className="flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-gray-700 mb-2 uppercase">Aging Summary</h3>
              <div className="space-y-1 text-xs">
                {(activeTab === "partySummary" ? summaryTotals.buckets : detailSummaryTotals.buckets).map((b, idx) => (
                  <div key={idx} className="flex justify-between py-1 border-b">
                    <span className="text-gray-500">{b.label}</span>
                    <span className="font-mono font-bold" style={{ color: COLORS[idx % COLORS.length] }}>
                      {symbol} {formatNumber(b.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between font-bold text-xs pt-2 border-t mt-2">
              <span>Grand Total</span>
              <span className="font-mono text-slate-800">
                {symbol} {formatNumber(activeTab === "partySummary" ? summaryTotals.grandTotal : detailSummaryTotals.totalBalance)}
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Main Aging Grid Table */}
      <Card border padding="none">
        <div className="overflow-x-auto">
          {activeTab === "partySummary" ? (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
                <tr>
                  <th className="px-4 py-2 font-bold text-[#4b5563]">Party Name</th>
                  <th className="px-4 py-2 font-bold text-[#4b5563]">PAN</th>
                  {slabs.map((s, idx) => (
                    <th key={idx} className="px-4 py-2 font-bold text-[#4b5563] text-right">
                      {s.label}
                    </th>
                  ))}
                  <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Total Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-250">
                {partyRows.map((row) => (
                  <React.Fragment key={row.partyId}>
                    <tr
                      onClick={() => setExpandedPartyId(expandedPartyId === row.partyId ? null : row.partyId)}
                      className="hover:bg-[#e8eeff] transition-colors cursor-pointer border-b"
                    >
                      <td className="px-4 py-2.5 font-bold text-slate-800 flex items-center gap-1 text-[12px]">
                        {expandedPartyId === row.partyId ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
                        {row.partyName}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 font-mono text-[12px]">{row.partyPan || "N/A"}</td>
                      {row.buckets.map((b, idx) => (
                        <td
                          key={idx}
                          className="px-4 py-2.5 text-right font-mono amt text-[12px]"
                          style={{
                            color: b.amount > 0 ? COLORS[idx % COLORS.length] : undefined,
                            fontWeight: b.amount > 0 ? "bold" : undefined,
                          }}
                        >
                          {b.amount > 0 ? formatNumber(b.amount) : "-"}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800 text-[12px]">
                        {formatNumber(row.total)}
                      </td>
                    </tr>

                    {/* Expanded individual bills sub-table */}
                    {expandedPartyId === row.partyId && (
                      <tr>
                        <td colSpan={slabs.length + 3} className="bg-slate-50 p-3 border-b">
                          <div className="border rounded bg-white overflow-hidden shadow-sm">
                            <div className="bg-slate-100 p-2 font-bold text-slate-700 text-[10px] uppercase border-b">
                              Pending Bills list for {row.partyName}
                            </div>
                            <table className="w-full text-[11px] text-left">
                              <thead className="bg-slate-50 border-b">
                                <tr>
                                  <th className="px-3 py-1.5 font-bold text-gray-600">Bill No</th>
                                  <th className="px-3 py-1.5 font-bold text-gray-600">Bill Date</th>
                                  <th className="px-3 py-1.5 font-bold text-gray-600">Due Date</th>
                                  <th className="px-3 py-1.5 font-bold text-gray-600 text-right">Original Amt</th>
                                  <th className="px-3 py-1.5 font-bold text-gray-600 text-right">Paid Amt</th>
                                  <th className="px-3 py-1.5 font-bold text-gray-600 text-right">Outstanding Balance</th>
                                  <th className="px-3 py-1.5 font-bold text-gray-600 text-center">Days Pending</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {row.bills.map((bill) => (
                                  <tr key={bill.invoiceId} className="hover:bg-slate-50">
                                    <td className="px-3 py-1 font-mono font-bold text-blue-600">{bill.invoiceNo}</td>
                                    <td className="px-3 py-1">{bill.invoiceDate}</td>
                                    <td className="px-3 py-1">{bill.dueDate}</td>
                                    <td className="px-3 py-1 text-right font-mono">{formatNumber(bill.originalAmount)}</td>
                                    <td className="px-3 py-1 text-right font-mono">{formatNumber(bill.paidAmount)}</td>
                                    <td className="px-3 py-1 text-right font-mono font-bold text-red-600">{formatNumber(bill.balance)}</td>
                                    <td className="px-3 py-1 text-center font-bold font-mono">
                                      <span className={bill.daysOverdue! > 90 ? "text-red-600" : bill.daysOverdue! > 30 ? "text-amber-500" : "text-green-600"}>
                                        {bill.daysOverdue}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800">
                <tr>
                  <td className="px-4 py-2">Total</td>
                  <td></td>
                  {summaryTotals.buckets.map((b, idx) => (
                    <td key={idx} className="px-4 py-2 text-right font-mono">
                      {formatNumber(b.amount)}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right font-mono font-bold">
                    {formatNumber(summaryTotals.grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
                <tr>
                  <th className="px-4 py-2 font-bold text-[#4b5563]">Party Name</th>
                  <th className="px-4 py-2 font-bold text-[#4b5563]">Bill No</th>
                  <th className="px-4 py-2 font-bold text-[#4b5563]">Bill Date (BS)</th>
                  <th className="px-4 py-2 font-bold text-[#4b5563]">Due Date (BS)</th>
                  <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Bill Amt</th>
                  <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Paid</th>
                  <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Balance</th>
                  <th className="px-4 py-2 font-bold text-[#4b5563] text-center">Days Overdue</th>
                  <th className="px-4 py-2 font-bold text-[#4b5563] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {detailBills.map((bill, index) => (
                  <tr key={`${bill.invoiceId}-${index}`} className="hover:bg-[#e8eeff] transition-colors border-b">
                    <td className="px-4 py-2.5 font-bold text-slate-800 text-[12px]">{bill.partyName}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-600 text-[12px]">{bill.invoiceNo}</td>
                    <td className="px-4 py-2.5 text-[12px]">{bill.invoiceDateNepali}</td>
                    <td className="px-4 py-2.5 text-[12px]">{bill.dueDateNepali}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px]">{formatNumber(bill.originalAmount)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-500 text-[12px]">{formatNumber(bill.paidAmount)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-red-600 text-[12px]">{formatNumber(bill.balance)}</td>
                    <td className="px-4 py-2.5 text-center font-mono font-bold text-[12px]">
                      {bill.daysOverdue > 0 ? (
                        <span className="text-red-600">{bill.daysOverdue}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center text-[12px]">{getStatusBadge(bill.daysOverdue)}</td>
                  </tr>
                ))}
                {detailBills.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-gray-400 text-[12px]">
                      No outstanding bills matching current filters.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800">
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-[12px]">
                    Total ({detailSummaryTotals.totalBills} Bills)
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-[12px]">
                    {formatNumber(detailSummaryTotals.totalOriginal)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-[12px]">
                    {formatNumber(detailSummaryTotals.totalPaid)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-bold text-red-600 text-[12px]">
                    {formatNumber(detailSummaryTotals.totalBalance)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </Card>

      {/* Reminder Notification Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full p-6 shadow-xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setShowReminderModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 font-bold"
            >
              ✕
            </button>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-2">Send Outstanding Reminders</h2>
            <p className="text-[11px] text-gray-500 mb-4">
              Select outstanding accounts and configure the reminder dispatch message.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Parties checklist */}
              <div className="border rounded p-3 bg-slate-50 flex flex-col max-h-[350px] overflow-hidden">
                <div className="flex justify-between items-center pb-2 border-b mb-2">
                  <span className="text-[10px] font-bold text-gray-600 uppercase">Parties Checklist</span>
                  <button
                    onClick={handleSelectAllReminderParties}
                    className="text-[10px] text-blue-600 font-bold hover:underline"
                  >
                    {selectedReminderParties.size === partiesWithOutstanding.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {partiesWithOutstanding.map((p) => (
                    <label key={p.partyId} className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-slate-100">
                      <input
                        type="checkbox"
                        checked={selectedReminderParties.has(p.partyId)}
                        onChange={() => toggleSelectReminderParty(p.partyId)}
                        className="rounded border-gray-300"
                      />
                      <div className="flex-1 flex justify-between min-w-0">
                        <span className="truncate font-medium">{p.partyName}</span>
                        <span className="font-mono text-red-600 font-bold text-[10px] shrink-0">
                          {symbol} {formatNumber(p.total)}
                        </span>
                      </div>
                    </label>
                  ))}
                  {partiesWithOutstanding.length === 0 && (
                    <div className="text-center py-10 text-gray-400 italic">No parties with outstanding balances.</div>
                  )}
                </div>
              </div>

              {/* Right Column: Template & Preview */}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Notification template
                  </label>
                  <textarea
                    value={reminderTemplate}
                    onChange={(e) => setReminderTemplate(e.target.value)}
                    rows={8}
                    className="input w-full font-mono text-[11px]"
                  />
                  <div className="text-[9px] text-gray-400 mt-1">
                    Placeholder parameters: <code>{`{party_name}`}</code>, <code>{`{total_outstanding}`}</code>, <code>{`{oldest_bill_date}`}</code>, <code>{`{days_overdue}`}</code>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-3 border-t">
              <Button
                onClick={handleSendReminderNotifications}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                disabled={selectedReminderParties.size === 0}
              >
                <Send className="w-3.5 h-3.5 mr-1" /> Send to {selectedReminderParties.size} Parties
              </Button>
              <Button onClick={() => setShowReminderModal(false)} variant="outline" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
