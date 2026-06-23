import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Select, NepaliDatePicker } from "../components/ui";
import { FileSpreadsheet, Printer, Download } from "lucide-react";
import {
  computeVatAnnexA,
  computeVatAnnexB,
  computeVatAnnexC,
  computeVAT3Return,
} from "../lib/taxUtils";
import { exportVatAnnexToExcel, workbookFromArray, downloadWorkbook, exportVatAnnexCSV } from "../lib/exportUtils";
import {
  getBSMonthRange,
  getQuarterRange,
  formatADToBS,
  formatBSToAD,
  formatBSDate,
} from "../lib/nepaliDate";
import { NEPALI_MONTHS_EN } from "../lib/constants";
import { formatNumber, dateToAD } from "../lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import toast from "react-hot-toast";

const VatReports: React.FC = () => {
  const { invoices, vouchers, accounts, companySettings, currentFiscalYear } = useStore();
  const defaultAdStart = currentFiscalYear?.startDate || dateToAD(new Date());
  const defaultAdEnd = currentFiscalYear?.endDate || dateToAD(new Date());

  const defaultBsStart = formatADToBS(defaultAdStart);

  // Calculate total turnover to auto-select filing mode
  const totalTurnover = useMemo(() => {
    return invoices
      .filter((inv) => inv.type === "sales-invoice" && inv.status === "posted")
      .reduce((sum, inv) => sum + inv.grandTotal, 0);
  }, [invoices]);

  const [filingMode, setFilingMode] = useState<"monthly" | "quarterly">("quarterly");
  const [periodType, setPeriodType] = useState<"month" | "quarter" | "custom">("quarter");
  const [bsYear, setBsYear] = useState<number>(parseInt(defaultBsStart.split("/")[0], 10) || 2083);
  const [bsMonth, setBsMonth] = useState<number>(parseInt(defaultBsStart.split("/")[1], 10) || 4);
  const [bsQuarter, setBsQuarter] = useState<1 | 2 | 3 | 4>(
    Math.max(
      1,
      Math.min(4, Math.floor((parseInt(defaultBsStart.split("/")[1], 10) - 1) / 3) + 1),
    ) as 1 | 2 | 3 | 4,
  );

  const [customStartDate, setCustomStartDate] = useState<string>(defaultAdStart);
  const [customEndDate, setCustomEndDate] = useState<string>(defaultAdEnd);

  // Tabs map directly to Annex 18 (Purchases), Annex 19 (Sales)
  const [annexTab, setAnnexTab] = useState<"summary" | "annex18" | "annex19" | "annexC" | "deposit">("summary");

  // Auto select filing mode on mount/turnover change
  useEffect(() => {
    if (totalTurnover > 10000000) {
      setFilingMode("monthly");
      setPeriodType("month");
    } else {
      setFilingMode("quarterly");
      setPeriodType("quarter");
    }
  }, [totalTurnover]);

  useEffect(() => {
    if (currentFiscalYear?.startDate && currentFiscalYear?.endDate) {
      const startBS = formatADToBS(currentFiscalYear.startDate);
      const [year, month] = startBS.split("/").map((part) => parseInt(part, 10));
      setBsYear(year || bsYear);
      setBsMonth(month || bsMonth);
      setBsQuarter(
        Math.max(1, Math.min(4, Math.floor(((month || bsMonth) - 1) / 3) + 1)) as 1 | 2 | 3 | 4,
      );
    }
  }, [currentFiscalYear]);

  const bsYearOptions = useMemo(() => {
    const yearStart = Math.max(2075, bsYear - 5);
    return Array.from({ length: 16 }, (_, idx) => yearStart + idx).map((year) => ({
      value: String(year),
      label: String(year),
    }));
  }, [bsYear]);

  const bsMonthOptions = useMemo(
    () => NEPALI_MONTHS_EN.map((label, index) => ({ value: String(index + 1), label })),
    [],
  );

  const bsQuarterOptions = useMemo(
    () => [1, 2, 3, 4].map((quarter) => ({ value: String(quarter), label: `Q${quarter}` })),
    [],
  );

  const bsRange = useMemo(() => {
    if (periodType === "month") {
      return getBSMonthRange(bsYear, bsMonth);
    }
    if (periodType === "quarter") {
      return getQuarterRange(bsYear, bsQuarter);
    }
    return {
      start: formatADToBS(customStartDate),
      end: formatADToBS(customEndDate),
    };
  }, [periodType, bsYear, bsMonth, bsQuarter, customStartDate, customEndDate]);

  const dateRange = useMemo(() => {
    if (periodType === "custom") {
      return {
        start: customStartDate,
        end: customEndDate,
      };
    }
    return {
      start: formatBSToAD(bsRange.start),
      end: formatBSToAD(bsRange.end),
    };
  }, [periodType, bsRange, customStartDate, customEndDate]);

  const periodLabel = useMemo(() => {
    if (periodType === "month") {
      return `${NEPALI_MONTHS_EN[bsMonth - 1]} ${bsYear}`;
    }
    if (periodType === "quarter") {
      return `Q${bsQuarter} ${bsYear}`;
    }
    return `${formatBSDate(formatADToBS(customStartDate))} to ${formatBSDate(formatADToBS(customEndDate))}`;
  }, [periodType, bsMonth, bsQuarter, bsYear, customStartDate, customEndDate]);

  const annexA = useMemo(
    () => computeVatAnnexA(invoices, dateRange.start, dateRange.end),
    [invoices, dateRange.start, dateRange.end],
  );

  const annexB = useMemo(
    () => computeVatAnnexB(invoices, dateRange.start, dateRange.end),
    [invoices, dateRange.start, dateRange.end],
  );

  const annexC = useMemo(
    () => computeVatAnnexC(invoices, dateRange.start, dateRange.end),
    [invoices, dateRange.start, dateRange.end],
  );

  const vat3Return = useMemo(
    () => computeVAT3Return(invoices, vouchers, accounts, dateRange.start, dateRange.end),
    [invoices, vouchers, accounts, dateRange.start, dateRange.end],
  );

  const selectedStartBS = formatADToBS(dateRange.start);
  const selectedEndBS = formatADToBS(dateRange.end);

  // Map annexTab to activeAnnex data & parameters for existing library functions
  const activeAnnex = useMemo(() => {
    switch (annexTab) {
      case "annex18": // Purchase Register (Annex-18 in Nepal VAT)
        return { type: "A" as const, data: annexA };
      case "annex19": // Sales Register (Annex-19 in Nepal VAT)
        return { type: "B" as const, data: annexB };
      case "annexC": // Imports
        return { type: "C" as const, data: annexC };
      default:
        return null;
    }
  }, [annexTab, annexA, annexB, annexC]);

  // Output VAT - Input VAT = Net VAT
  const outputVat = vat3Return.salesVat;
  const inputVat = vat3Return.purchaseVat;
  const netVat = outputVat - inputVat;

  const vat3SummaryRows = [
    { label: "Sales VAT Collected (Output VAT)", value: outputVat },
    { label: "Purchase VAT Paid (Input VAT)", value: inputVat },
    { label: "Net VAT", value: netVat },
    { label: "VAT Payable", value: vat3Return.vatPayable },
    { label: "VAT Refundable", value: vat3Return.vatRefundable },
    { label: "Previous VAT Balance", value: vat3Return.prevBalance },
  ];

  const handleExportIrdCsv = (type: "18" | "19", data: any) => {
    let headers: string[] = [];
    let rows: any[] = [];

    if (type === "19") {
      // VAT Sales Register Annex-19
      headers = [
        "S.No",
        "Customer Name",
        "PAN No",
        "Invoice No",
        "Invoice Date",
        "Taxable Sales",
        "Exempt Sales",
        "VAT Collected",
      ];
      rows = data.rows.map((row: any) => [
        row.sNo,
        `"${row.partyName.replace(/"/g, '""')}"`,
        row.partyPan || "",
        row.billNo,
        formatADToBS(row.date),
        row.taxableAmt.toFixed(2),
        row.exemptAmt.toFixed(2),
        row.vatAmt.toFixed(2),
      ]);
    } else {
      // VAT Purchase Register Annex-18
      headers = [
        "S.No",
        "Supplier Name",
        "PAN No",
        "Bill No",
        "Bill Date",
        "Taxable Amount",
        "VAT Amount",
        "Total Amount",
      ];
      rows = data.rows.map((row: any) => [
        row.sNo,
        `"${row.partyName.replace(/"/g, '""')}"`,
        row.partyPan || "",
        row.billNo,
        formatADToBS(row.date),
        row.taxableAmt.toFixed(2),
        row.vatAmt.toFixed(2),
        row.totalAmt.toFixed(2),
      ]);
    }

    const csvContent = [headers.join(";"), ...rows.map((row) => row.join(";"))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `IRD_Annex_${type === "19" ? "19_Sales" : "18_Purchases"}_${periodLabel.replace(/\s+/g, "_")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported Annex ${type === "19" ? "19 (Sales)" : "18 (Purchases)"} CSV for IRD.`);
  };

  const handleFilingModeChange = (mode: "monthly" | "quarterly") => {
    setFilingMode(mode);
    setPeriodType(mode === "monthly" ? "month" : "quarter");
  };

  const renderVat3Card = () => (
    <div className="grid gap-3 md:grid-cols-3 w-full">
      {vat3SummaryRows.map((row) => (
        <div key={row.label} className="border border-gray-200 bg-white p-4 rounded-md">
          <div className="text-[10px] uppercase font-bold text-gray-500">{row.label}</div>
          <div className="mt-1 text-lg font-bold text-gray-800">Rs. {formatNumber(row.value)}</div>
        </div>
      ))}
      <div className="border border-gray-200 bg-blue-50/50 p-4 rounded-md md:col-span-3">
        <div className="text-[10px] uppercase font-bold text-blue-700">Period</div>
        <div className="mt-1 text-sm font-bold text-gray-800">{periodLabel}</div>
        <div className="text-xs text-gray-500">
          From {selectedStartBS} to {selectedEndBS}
        </div>
      </div>
    </div>
  );

  const printVat3ReturnPDF = () => {
    const doc = new jsPDF({ unit: "pt" });
    doc.setFontSize(14);
    doc.text("VAT 3 Return", 40, 40);
    doc.setFontSize(10);
    doc.text(`Period: ${periodLabel}`, 40, 58);

    const body = vat3SummaryRows.map((row) => [row.label, formatNumber(row.value)]);
    autoTable(doc, {
      startY: 80,
      head: [["Description", "Amount (Rs.)"]],
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 58, 96], textColor: 255 },
    });

    return doc.output("blob");
  };

  const printAnnexPDF = (type: "A" | "B" | "C", data: any) => {
    const doc = new jsPDF({ unit: "pt" });
    doc.setFontSize(14);
    doc.text(
      `VAT Annex ${type === "A" ? "18 (Purchases)" : type === "B" ? "19 (Sales)" : "C (Imports)"}`,
      40,
      40,
    );
    doc.setFontSize(10);
    doc.text(`Period: ${periodLabel}`, 40, 58);

    const body = data.rows.map((row: any) => [
      row.sNo,
      formatADToBS(row.date),
      row.billNo,
      row.partyName,
      row.partyPan || "-",
      formatNumber(row.totalAmt),
      formatNumber(row.taxableAmt),
      formatNumber(row.vatAmt),
    ]);

    autoTable(doc, {
      startY: 80,
      head: [
        [
          "SN",
          "Date (BS)",
          "Invoice No",
          "Party Name",
          "PAN No",
          "Total Amount",
          "Taxable Amount",
          "VAT Amount",
        ],
      ],
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 96], textColor: 255 },
      columnStyles: {
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
      },
    });

    const summaryY = (doc as any).lastAutoTable?.finalY || 80;
    doc.setFontSize(10);
    doc.text(
      `Totals: Taxable Rs. ${formatNumber(data.totals.taxable)}, VAT Rs. ${formatNumber(data.totals.vat)}, Exempt Rs. ${formatNumber(data.totals.exempt)}, Gross Rs. ${formatNumber(data.totals.total)}`,
      40,
      summaryY + 20,
    );
    return doc.output("blob");
  };

  const exportVat3ToExcel = () => {
    const headers = ["Description", "Amount (Rs.)"];
    const rows = [
      ["Report Period", periodLabel],
      [],
      ...vat3SummaryRows.map((row) => [row.label, row.value]),
    ];
    const workbook = workbookFromArray(headers, rows, "VAT 3 Return");
    downloadWorkbook(workbook, `VAT_3_Return_${periodLabel.replace(/\s+/g, "_")}.xlsx`);
  };

  const handleExportAnnex = (type: "A" | "B" | "C", data: any) => {
    try {
      exportVatAnnexToExcel(type, data, periodLabel);
      toast.success(
        `Annex ${type === "A" ? "18 (Purchases)" : type === "B" ? "19 (Sales)" : "C"} exported to Excel.`,
      );
    } catch (error: any) {
      toast.error(error?.message || `Could not export Annex ${type}.`);
    }
  };

  const handleExportAnnexCsvNepali = (type: 'annex1' | 'annex2') => {
    const sourceData = type === 'annex1' ? annexA : annexB;
    const rows = (sourceData?.rows || []).map((r: any) => ({
      dateNepali: formatADToBS(r.date),
      invoiceNo: r.billNo || '',
      partyName: r.partyName || '',
      partyPan: r.partyPan || '',
      taxableAmount: r.taxableAmt || 0,
      vatAmount: r.vatAmt || 0,
      exemptAmount: r.exemptAmt || 0,
      grandTotal: r.totalAmt || 0,
    }));
    const periodStr = periodLabel.replace(/\s+/g, '_');
    exportVatAnnexCSV(type, rows, periodStr);
    toast.success(`Nepali Unicode ${type === 'annex1' ? 'Annex 1 (Purchase)' : 'Annex 2 (Sales)'} CSV exported.`);
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none page-wrapper">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">VAT Reports</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            IRD-compliant VAT return reports (Nepal)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {annexTab === "summary" ? (
            <>
              <button
                type="button"
                onClick={exportVat3ToExcel}
                className="h-8 px-3 text-[12px] font-semibold border rounded-md text-green-700 bg-green-50 border-green-200 hover:bg-green-100 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Export VAT 3 (Excel)
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    const blob = printVat3ReturnPDF();
                    const url = URL.createObjectURL(blob);
                    const win = window.open(url);
                    if (win) win.focus();
                  } catch (error: any) {
                    toast.error(error?.message || "Could not print VAT 3 return.");
                  }
                }}
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> Print PDF
              </button>
            </>
          ) : (
            <>
              {(annexTab === "annex18" || annexTab === "annex19") && (
                <button
                  type="button"
                  onClick={() =>
                    handleExportIrdCsv(annexTab === "annex18" ? "18" : "19", activeAnnex?.data)
                  }
                  className="h-8 px-3 text-[12px] font-bold border rounded-md text-[#1557b0] bg-blue-50 border-blue-200 hover:bg-blue-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Export for IRD (CSV)
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (activeAnnex) {
                    handleExportAnnex(activeAnnex.type, activeAnnex.data);
                  }
                }}
                className="h-8 px-3 text-[12px] font-semibold border rounded-md text-green-700 bg-green-50 border-green-200 hover:bg-green-100 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Export Annex (Excel)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeAnnex) {
                    try {
                      const blob = printAnnexPDF(activeAnnex.type, activeAnnex.data);
                      const url = URL.createObjectURL(blob);
                      const win = window.open(url);
                      if (win) win.focus();
                    } catch (error: any) {
                      toast.error(error?.message || "Could not print Annex report.");
                    }
                  }
                }}
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> Print PDF
              </button>
            </>
          )}
        </div>
      </div>

      <Card border padding="md">
        <div className="grid gap-4 xl:grid-cols-[1fr_270px]">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <label className="text-[11px] font-medium text-gray-600">
                Filing Mode (Nepal VAT)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleFilingModeChange("monthly")}
                  className={`h-8 px-4 text-[12px] font-medium rounded-md transition-colors cursor-pointer ${
                    filingMode === "monthly"
                      ? "bg-[#1557b0] text-white font-semibold"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => handleFilingModeChange("quarterly")}
                  className={`h-8 px-4 text-[12px] font-medium rounded-md transition-colors cursor-pointer ${
                    filingMode === "quarterly"
                      ? "bg-[#1557b0] text-white font-semibold"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Quarterly
                </button>
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                Turnover: Rs. {formatNumber(totalTurnover)} (
                {totalTurnover > 10000000 ? "Monthly > 1 Crore" : "Quarterly <= 1 Crore"})
              </div>
            </div>

            <div>
              <Select
                label="BS Year"
                value={String(bsYear)}
                onChange={(value) => setBsYear(parseInt(value, 10) || bsYear)}
                options={bsYearOptions}
              />
            </div>

            <div>
              <Select
                label={periodType === "month" ? "BS Month" : "BS Quarter"}
                value={periodType === "month" ? String(bsMonth) : String(bsQuarter)}
                onChange={(value) => {
                  if (periodType === "month") {
                    const monthValue = parseInt(value, 10);
                    setBsMonth(monthValue || bsMonth);
                    setBsQuarter(
                      Math.max(
                        1,
                        Math.min(4, Math.floor(((monthValue || bsMonth) - 1) / 3) + 1),
                      ) as any,
                    );
                  } else {
                    setBsQuarter(Math.max(1, Math.min(4, parseInt(value, 10))) as any);
                  }
                }}
                options={periodType === "month" ? bsMonthOptions : bsQuarterOptions}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <NepaliDatePicker
              label="From Date"
              value={dateRange.start}
              onChange={setCustomStartDate}
              disabled={periodType !== "custom"}
            />
            <NepaliDatePicker
              label="To Date"
              value={dateRange.end}
              onChange={setCustomEndDate}
              disabled={periodType !== "custom"}
            />
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-1 mb-3">
        {[
          { key: "summary", label: "VAT Summary" },
          { key: "annex18", label: "VAT Purchase Register (Annex-18)" },
          { key: "annex19", label: "VAT Sales Register (Annex-19)" },
          { key: "annexC", label: "Annex-C (Imports)" },
          { key: "deposit", label: "VAT Deposit Status" },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setAnnexTab(key as any)}
            className={`h-8 px-3 text-[11px] font-semibold rounded-t transition-colors border-b-2 cursor-pointer ${
              annexTab === key
                ? "border-[#1557b0] text-[#1557b0] bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700 bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {annexTab === "summary" ? (
        <Card border padding="md" className="grid gap-5">
          {/* VAT Payable summary output - input */}
          <div className="p-4 border rounded-md bg-white">
            <h3 className="text-[12px] font-bold text-gray-700 mb-2 uppercase tracking-wide">
              VAT Payable Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[12px]">
              <div>
                <span className="text-gray-500 block">Output VAT (Collected)</span>
                <span className="font-semibold text-gray-800 font-mono">
                  Rs. {formatNumber(outputVat)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Input VAT (Paid)</span>
                <span className="font-semibold text-gray-800 font-mono">
                  Rs. {formatNumber(inputVat)}
                </span>
              </div>
              <div className="border-l pl-4">
                <span className="text-gray-500 block">Net VAT Payable/Refundable</span>
                <span
                  className={`font-bold font-mono ${
                    netVat > 0 ? "text-[#dc2626]" : netVat < 0 ? "text-[#059669]" : "text-gray-600"
                  }`}
                >
                  Rs. {formatNumber(Math.abs(netVat))}{" "}
                  {netVat > 0 ? "(Payable)" : netVat < 0 ? "(Refundable)" : "(Nil)"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">{renderVat3Card()}</div>
        </Card>
      ) : annexTab === 'deposit' ? (
        <Card border padding="md" className="grid gap-5">
          <div>
            <h3 className="text-[12px] font-bold text-gray-700 mb-1">VAT Deposit Status</h3>
            <p className="text-[11px] text-gray-500 mb-4">Nepal IRD deadline: 25th of the following BS month. Sourced from payment vouchers matched to VAT Payable account.</p>
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => handleExportAnnexCsvNepali('annex1')}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-semibold rounded-md hover:bg-gray-50 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Export Annex 1 CSV (Nepali)
              </button>
              <button
                type="button"
                onClick={() => handleExportAnnexCsvNepali('annex2')}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-semibold rounded-md hover:bg-gray-50 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Export Annex 2 CSV (Nepali)
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table w-full text-left">
                <thead>
                  <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
                    <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em]">Month (BS)</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">VAT Collected (Output)</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">VAT Paid (Input)</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Net Payable</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em]">Deadline</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {((): React.ReactNode[] => {
                    // Generate last 12 months summary from vat3Return logic
                    const rows: React.ReactNode[] = [];
                    const today = new Date();
                    for (let i = 11; i >= 0; i--) {
                      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                      const mSalesVat = invoices
                        .filter(inv => inv.type === 'sales-invoice' && inv.status === 'posted' && inv.date.startsWith(prefix))
                        .reduce((s, inv) => s + ((inv as any).vatAmount || 0), 0);
                      const mPurchaseVat = invoices
                        .filter(inv => inv.type === 'purchase-invoice' && inv.status === 'posted' && inv.date.startsWith(prefix))
                        .reduce((s, inv) => s + ((inv as any).vatAmount || 0), 0);
                      const net = mSalesVat - mPurchaseVat;
                      let bsLabel = prefix;
                      try { bsLabel = formatADToBS(`${prefix}-15`).split('/').slice(0, 2).join('/'); } catch { /**/ }
                      // Deadline = 25th of following month
                      const deadline = new Date(d.getFullYear(), d.getMonth() + 1, 25);
                      const isLate = today > deadline;
                      const onTime = net <= 0 || !isLate;
                      rows.push(
                        <tr key={prefix} className="border-b border-gray-100 hover:bg-[#e8eeff]">
                          <td className="px-3 py-[7px] text-[12px] text-gray-700">{bsLabel}</td>
                          <td className="px-3 py-[7px] text-[12px] font-mono text-right">{formatNumber(mSalesVat)}</td>
                          <td className="px-3 py-[7px] text-[12px] font-mono text-right">{formatNumber(mPurchaseVat)}</td>
                          <td className={`px-3 py-[7px] text-[12px] font-mono text-right font-bold ${net > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatNumber(net)}</td>
                          <td className="px-3 py-[7px] text-[12px] text-gray-500">{deadline.toLocaleDateString()}</td>
                          <td className="px-3 py-[7px]">
                            {net <= 0
                              ? <span className="badge badge-active">No Tax Due</span>
                              : onTime
                              ? <span className="badge badge-posted">On Time</span>
                              : <span className="badge badge-cancelled">Late</span>
                            }
                          </td>
                        </tr>
                      );
                    }
                    return rows;
                  })()}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Note: Nepal VAT deadline is 25th of the following BS month (Ashadh Month extended). Deposit status is estimated from invoice data only.</p>
          </div>
        </Card>
      ) : (
        <Card border padding="md" className="grid gap-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b pb-4">
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                {annexTab === "annex18"
                  ? "VAT Purchase Register (Annex-18)"
                  : annexTab === "annex19"
                    ? "VAT Sales Register (Annex-19)"
                    : "Annex C (Imports)"}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Invoices and VAT totals for the selected period.
              </div>
            </div>
            <div className="text-right text-[12px] text-gray-700 bg-gray-50 p-3 border rounded-md">
              <span className="font-semibold text-gray-600">Total Taxable:</span>{" "}
              <span className="font-mono font-bold text-gray-800">
                Rs. {formatNumber(activeAnnex?.data?.totals.taxable || 0)}
              </span>{" "}
              |&nbsp;
              <span className="font-semibold text-gray-600">Total VAT:</span>{" "}
              <span className="font-mono font-bold text-[#1557b0]">
                Rs. {formatNumber(activeAnnex?.data?.totals.vat || 0)}
              </span>{" "}
              |&nbsp;
              <span className="font-semibold text-gray-600">Total Exempt:</span>{" "}
              <span className="font-mono font-bold text-gray-800">
                Rs. {formatNumber(activeAnnex?.data?.totals.exempt || 0)}
              </span>{" "}
              |&nbsp;
              <span className="font-semibold text-gray-600">Gross Total:</span>{" "}
              <span className="font-mono font-bold text-gray-800">
                Rs. {formatNumber(activeAnnex?.data?.totals.total || 0)}
              </span>
            </div>
          </div>

          <div
            className="bg-white border rounded-lg overflow-hidden animate-fadeIn"
            style={{ borderColor: "var(--border)" }}
          >
            <table className="data-table">
              <thead>
                <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
                  {annexTab === "annex19" ? (
                    // Sales Register (Annex-19)
                    <>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                        S.No
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                        Customer Name
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                        PAN No
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                        Invoice No
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                        Invoice Date
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                        Taxable Sales
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                        Exempt Sales
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                        VAT Collected
                      </th>
                    </>
                  ) : annexTab === "annex18" ? (
                    // Purchase Register (Annex-18)
                    <>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                        S.No
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                        Supplier Name
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                        PAN No
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                        Bill No
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                        Bill Date
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                        Taxable Amount
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                        VAT Amount
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                        Total Amount
                      </th>
                    </>
                  ) : (
                    // Imports (Annex C)
                    <>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                        Bill No
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                        Supplier Name
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                        PAN
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                        Taxable Amount
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                        VAT Amount
                      </th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                        Total
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {!activeAnnex || activeAnnex.data.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={annexTab === "annex19" ? 8 : annexTab === "annex18" ? 8 : 6}
                      className="text-center py-8 text-gray-500 text-[12px]"
                    >
                      No records found for the selected period.
                    </td>
                  </tr>
                ) : (
                  activeAnnex.data.rows.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[#e8eeff]">
                      {annexTab === "annex19" ? (
                        <>
                          <td className="px-3 py-[7px] text-[12px] text-gray-700">{row.sNo}</td>
                          <td className="px-3 py-[7px] text-[12px] text-gray-700 font-semibold">
                            {row.partyName}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-gray-700 font-mono">
                            {row.partyPan || "-"}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-gray-700 font-bold">
                            {row.billNo}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-gray-700">
                            {formatADToBS(row.date)}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">
                            Rs. {formatNumber(row.taxableAmt)}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">
                            Rs. {formatNumber(row.exemptAmt)}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt amt-dr">
                            Rs. {formatNumber(row.vatAmt)}
                          </td>
                        </>
                      ) : annexTab === "annex18" ? (
                        <>
                          <td className="px-3 py-[7px] text-[12px] text-gray-700">{row.sNo}</td>
                          <td className="px-3 py-[7px] text-[12px] text-gray-700 font-semibold">
                            {row.partyName}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-gray-700 font-mono">
                            {row.partyPan || "-"}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-gray-700 font-bold">
                            {row.billNo}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-gray-700">
                            {formatADToBS(row.date)}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">
                            Rs. {formatNumber(row.taxableAmt)}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt amt-cr">
                            Rs. {formatNumber(row.vatAmt)}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt font-semibold">
                            Rs. {formatNumber(row.totalAmt)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-[7px] text-[12px] text-gray-700 font-bold">
                            {row.billNo}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-gray-700">
                            {row.partyName}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-gray-700 font-mono">
                            {row.partyPan || "-"}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">
                            Rs. {formatNumber(row.taxableAmt)}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt amt-cr">
                            Rs. {formatNumber(row.vatAmt)}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">
                            Rs. {formatNumber(row.totalAmt)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {activeAnnex && activeAnnex.data.rows.length > 0 && (
                <tfoot className="bg-[#eef1f8] border-t-2 border-[#c5cad8] font-bold">
                  <tr>
                    <td
                      colSpan={annexTab === "annexC" ? 3 : 5}
                      className="px-3 py-2 text-[12px] text-gray-700"
                    >
                      Total
                    </td>
                    <td className="px-3 py-2 text-[12px] text-right font-mono amt">
                      Rs. {formatNumber(activeAnnex.data.totals.taxable)}
                    </td>
                    {annexTab === "annex19" && (
                      <>
                        <td className="px-3 py-2 text-[12px] text-right font-mono amt">
                          Rs. {formatNumber(activeAnnex.data.totals.exempt)}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-right font-mono amt amt-dr">
                          Rs. {formatNumber(activeAnnex.data.totals.vat)}
                        </td>
                      </>
                    )}
                    {annexTab === "annex18" && (
                      <>
                        <td className="px-3 py-2 text-[12px] text-right font-mono amt amt-cr">
                          Rs. {formatNumber(activeAnnex.data.totals.vat)}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-right font-mono amt">
                          Rs. {formatNumber(activeAnnex.data.totals.total)}
                        </td>
                      </>
                    )}
                    {annexTab === "annexC" && (
                      <>
                        <td className="px-3 py-2 text-[12px] text-right font-mono amt amt-cr">
                          Rs. {formatNumber(activeAnnex.data.totals.vat)}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-right font-mono amt">
                          Rs. {formatNumber(activeAnnex.data.totals.total)}
                        </td>
                      </>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default VatReports;
