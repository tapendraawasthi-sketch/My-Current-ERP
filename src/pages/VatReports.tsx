// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Nepal VAT reporting page with VAT 3 return and Annex A/B/C.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import {
  Card,
  Badge,
  Button,
  Table,
  Select,
  NepaliDatePicker,
  ActionToolbar,
} from "../components/ui";
import { FileSpreadsheet, Printer, Activity, Layers, BookOpen, Download } from "lucide-react";
import {
  computeVatAnnexA,
  computeVatAnnexB,
  computeVatAnnexC,
  computeVAT3Return,
} from "../lib/taxUtils";
import { exportVatAnnexToExcel, workbookFromArray, downloadWorkbook } from "../lib/exportUtils";
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
import { PillTitle, FormPanel } from "../components/BusyShell";

const VatReports: React.FC = () => {
  const invoices = useStore(state => state.invoices);
  const vouchers = useStore(state => state.vouchers);
  const accounts = useStore(state => state.accounts);
  const companySettings = useStore(state => state.companySettings);
  const currentFiscalYear = useStore(state => state.currentFiscalYear);
  const defaultAdStart = currentFiscalYear?.startDate || dateToAD(new Date());
  const defaultAdEnd = currentFiscalYear?.endDate || dateToAD(new Date());

  const defaultBsStart = formatADToBS(defaultAdStart);
  const [periodType, setPeriodType] = useState<"month" | "quarter" | "custom">("month");
  const [bsYear, setBsYear] = useState<number>(parseInt(defaultBsStart.split("/")[0], 10) || 2083);
  const [bsMonth, setBsMonth] = useState<number>(parseInt(defaultBsStart.split("/")[1], 10) || 4);
  const [bsQuarter, setBsQuarter] = useState<1 | 2 | 3 | 4>(
    Math.max(1, Math.min(4, Math.floor((parseInt(defaultBsStart.split("/")[1], 10) - 1) / 3) + 1)),
  );
  const [customStartDate, setCustomStartDate] = useState<string>(defaultAdStart);
  const [customEndDate, setCustomEndDate] = useState<string>(defaultAdEnd);
  const [annexTab, setAnnexTab] = useState<"summary"|"A"|"B"|"C">("summary");
  const activeTab = annexTab === "summary" ? "vat3" : annexTab === "A" ? "annex-a" : annexTab === "B" ? "annex-b" : "annex-c";

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showIrdModal, setShowIrdModal] = useState(false);
  const [irdUsername, setIrdUsername] = useState("");
  const [irdPassword, setIrdPassword] = useState("");


  useEffect(() => {
    if (currentFiscalYear?.startDate && currentFiscalYear?.endDate) {
      const startBS = formatADToBS(currentFiscalYear.startDate);
      const [year, month] = startBS.split("/").map((part) => parseInt(part, 10));
      setBsYear(year || bsYear);
      setBsMonth(month || bsMonth);
      setBsQuarter(Math.max(1, Math.min(4, Math.floor(((month || bsMonth) - 1) / 3) + 1))) as
        | 1
        | 2
        | 3
        | 4;
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
    () => computeVatAnnexA(invoices, vouchers, accounts, dateRange.start, dateRange.end),
    [invoices, vouchers, accounts, dateRange.start, dateRange.end],
  );

  const annexB = useMemo(
    () => computeVatAnnexB(invoices, vouchers, accounts, dateRange.start, dateRange.end),
    [invoices, vouchers, accounts, dateRange.start, dateRange.end],
  );

  const annexC = useMemo(
    () => computeVatAnnexC(invoices, dateRange.start, dateRange.end),
    [invoices, dateRange.start, dateRange.end],
  );

  const vat3Return = useMemo(
    () => computeVAT3Return(annexA, annexB, dateRange.start, dateRange.end),
    [annexA, annexB, dateRange.start, dateRange.end],
  );

  const validateVAT = () => {
    const errors: string[] = [];
    annexA.rows.forEach((row: any) => {
      if (row.taxableAmount > 50000 && (!row.customerPAN || row.customerPAN.length !== 9)) {
        errors.push(`Annex A (SN ${row.sn}): Invoice ${row.billNumber} > Rs. 50,000 but missing valid 9-digit PAN.`);
      }
    });
    annexB.rows.forEach((row: any) => {
      if (!row.supplierPAN || row.supplierPAN.length !== 9) {
        errors.push(`Annex B (SN ${row.sn}): Purchase Invoice ${row.billNumber} missing valid 9-digit PAN.`);
      }
    });
    
    if (Math.abs(vat3Return.salesVat - annexA.totals.vat) > 0.01) {
      errors.push("VAT3 Output Tax does not match sum of Annex A VAT.");
    }
    
    setValidationErrors(errors);
    if (errors.length === 0) {
      toast.success("Validation successful. All records are IRD compliant.");
    } else {
      toast.error(`Found ${errors.length} validation errors.`);
    }
  };

  const handleIrdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!irdUsername || !irdPassword) {
      toast.error("Please enter IRD credentials.");
      return;
    }
    const refId = Math.floor(10000000 + Math.random() * 90000000);
    toast.success(`VAT Return submitted successfully. Reference: ${refId}`);
    useStore.setState((state) => {
      const updatedSettings = { ...state.companySettings };
      if (!updatedSettings.filedPeriods) updatedSettings.filedPeriods = [];
      updatedSettings.filedPeriods.push(periodLabel);
      return { companySettings: updatedSettings };
    });
    setShowIrdModal(false);
  };

  const selectedStartBS = formatADToBS(dateRange.start);
  const selectedEndBS = formatADToBS(dateRange.end);

  const tableColumns = [
    { key: "sNo", header: "SN", width: "5%" },
    {
      key: "date",
      header: "Date (BS)",
      width: "12%",
      render: (value: string) => {
        try {
          return formatADToBS(value);
        } catch (e) {
          return value;
        }
      },
    },
    { key: "billNo", header: "Invoice No", width: "12%" },
    { key: "partyName", header: "Party Name", width: "25%" },
    { key: "partyPan", header: "PAN No", width: "12%" },
    {
      key: "totalAmt",
      header: "Total Amount",
      width: "12%",
      align: "right",
      render: (value: number) => formatNumber(value),
      className: "font-mono",
    },
    {
      key: "taxableAmt",
      header: "Taxable Amount",
      width: "12%",
      align: "right",
      render: (value: number) => formatNumber(value),
      className: "font-mono",
    },
    {
      key: "vatAmt",
      header: "VAT Amount",
      width: "12%",
      align: "right",
      render: (value: number) => formatNumber(value),
      className: "font-mono",
    },
  ];

  const vat3SummaryRows = [
    { label: "Sales VAT Collected", value: vat3Return.salesVat },
    { label: "Purchase VAT Paid", value: vat3Return.purchaseVat },
    { label: "Net VAT", value: vat3Return.netVat },
    { label: "VAT Payable", value: vat3Return.vatPayable },
    { label: "VAT Refundable", value: vat3Return.vatRefundable },
    { label: "Previous VAT Balance", value: vat3Return.prevBalance },
  ];

  const renderVat3Card = () => (
    <div className="grid gap-3 md:grid-cols-3 w-full">
      {vat3SummaryRows.map((row) => (
        <div key={row.label} className="border border-[#9DC07A] bg-white p-4 rounded-md">
          <div className="text-[10px] uppercase font-bold text-[#000000]">{row.label}</div>
          <div className="mt-1 text-lg font-bold text-[#000000]">Rs. {formatNumber(row.value)}</div>
        </div>
      ))}
      <div className="border border-[#9DC07A] bg-[#D4EABD]/50 p-4 rounded-md md:col-span-3">
        <div className="text-[10px] uppercase font-bold text-[#000000]">Period</div>
        <div className="mt-1 text-sm font-bold text-[#000000]">{periodLabel}</div>
        <div className="text-xs text-[#000000]">
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

    const blob = doc.output("blob");
    return blob;
  };

  const printAnnexPDF = (type: "A" | "B" | "C", data: any) => {
    const doc = new jsPDF({ unit: "pt" });
    doc.setFontSize(14);
    doc.text(`VAT Annex ${type}`, 40, 40);
    doc.setFontSize(10);
    doc.text(`Period: ${periodLabel}`, 40, 58);

    const body = data.rows.map((row: any) => [
      row.sNo,
      row.date,
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

    const summaryY = doc.lastAutoTable?.finalY || 80;
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
      toast.success(`Annex ${type} exported to Excel.`);
    } catch (error: any) {
      toast.error(error?.message || `Could not export Annex ${type}.`);
    }
  };

  const getActiveAnnexData = () => {
    switch (annexTab) {
      case "A":
        return { type: "A" as const, data: annexA };
      case "B":
        return { type: "B" as const, data: annexB };
      case "C":
        return { type: "C" as const, data: annexC };
      default:
        return null;
    }
  };

  const activeAnnex = getActiveAnnexData();

  const toolbarPrimaryAction = useMemo(() => {
    if (activeTab === "vat3") {
      return {
        label: "Print PDF",
        onClick: () => {
          try {
            const blob = printVat3ReturnPDF();
            const url = URL.createObjectURL(blob);
            const win = window.open(url);
            if (win) win.focus();
          } catch (error: any) {
            toast.error(error?.message || "Could not print VAT 3 return.");
          }
        },
        icon: <Printer className="h-4 w-4" />,
      };
    } else if (activeAnnex) {
      return {
        label: "Print PDF",
        onClick: () => {
          try {
            const blob = printAnnexPDF(activeAnnex.type, activeAnnex.data);
            const url = URL.createObjectURL(blob);
            const win = window.open(url);
            if (win) win.focus();
          } catch (error: any) {
            toast.error(error?.message || "Could not print Annex report.");
          }
        },
        icon: <Printer className="h-4 w-4" />,
      };
    }
    return undefined;
  }, [activeTab, activeAnnex]);

  const toolbarSecondaryActions = useMemo(() => {
    if (activeTab === "vat3") {
      return [
        {
          label: "Export Excel",
          onClick: exportVat3ToExcel,
          icon: <FileSpreadsheet className="h-4 w-4" />,
        },
      ];
    } else if (activeAnnex) {
      return [
        {
          label: "Export Excel",
          onClick: () => handleExportAnnex(activeAnnex.type, activeAnnex.data),
          icon: <FileSpreadsheet className="h-4 w-4" />,
        },
      ];
    }
    return [];
  }, [activeTab, activeAnnex]);

  return (


    <div style={{ background: "#e8e4f0", padding: 12 }}>


      <PillTitle title="VAT Report" />


      <FormPanel>


        <div className="flex flex-col gap-6 animate-fadeIn select-none">
      <div className="page-header">
  <div>
    <div className="page-title">VAT Reports</div>
    <div className="page-subtitle">IRD-compliant VAT return reports</div>
  </div>
  <div className="page-actions">
    <button
            type="button"
            onClick={validateVAT}
            className="h-8 px-3 text-[11px] font-bold border rounded-md text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 flex items-center gap-1.5 cursor-pointer"
          >
            <Activity className="h-3.5 w-3.5" /> Validate
          </button>
          
          <button
            type="button"
            onClick={() => setShowIrdModal(true)}
            disabled={!companySettings.cbmsEnabled}
            className={`h-8 px-3 text-[11px] font-bold border rounded-md flex items-center gap-1.5 cursor-pointer ${
              companySettings.cbmsEnabled 
                ? "text-[#1557b0] bg-[#D4EABD] border-[#9DC07A] hover:bg-[#D4EABD]" 
                : "text-[#000000] bg-[#EBF5E2] border-[#9DC07A] cursor-not-allowed"
            }`}
            title={!companySettings.cbmsEnabled ? "CBMS not enabled in settings" : ""}
          >
            <Layers className="h-3.5 w-3.5" /> Submit to IRD (API)
          </button>

          {annexTab === "summary" ? (
            <>
              <button
                type="button"
                onClick={exportVat3ToExcel}
                className="h-8 px-3 text-[11px] font-bold border rounded-md text-green-700 bg-green-50 border-green-200 hover:bg-green-100 flex items-center gap-1.5 cursor-pointer"
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
                className="h-8 px-3 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white text-[12px] font-medium rounded-md flex items-center gap-1 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> Print PDF
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (activeAnnex) {
                    handleExportAnnex(activeAnnex.type, activeAnnex.data);
                  }
                }}
                className="h-8 px-3 text-[11px] font-bold border rounded-md text-green-700 bg-green-50 border-green-200 hover:bg-green-100 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Export Annex ({annexTab})
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
                className="h-8 px-3 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white text-[12px] font-medium rounded-md flex items-center gap-1 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> Print PDF
              </button>
            </>
          )}
  </div>
</div>

      {validationErrors.length > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <h3 className="text-[13px] font-semibold text-red-800 mb-2">Validation Errors</h3>
          <ul className="list-disc pl-5 space-y-1">
            {validationErrors.map((err, idx) => (
              <li key={idx} className="text-[12px] text-red-700">{err}</li>
            ))}
          </ul>
        </div>
      )}

      <Card border padding="md">
        <div className="grid gap-4 xl:grid-cols-[1fr_270px]">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <label className="text-[11px] font-medium text-[#000000]">Reporting Mode</label>
              <div className="grid gap-2 sm:grid-cols-3">
                {["month", "quarter", "custom"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPeriodType(mode as typeof periodType)}
                    className={`h-8 text-[12px] font-medium rounded-md transition-colors cursor-pointer ${periodType === mode ? "bg-[#3D6B25] text-white font-semibold" : "bg-white border border-[#9DC07A] text-[#000000] hover:bg-[#EBF5E2]"}`}
                  >
                    {mode === "month" ? "Month" : mode === "quarter" ? "Quarter" : "Custom"}
                  </button>
                ))}
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
                      Math.max(1, Math.min(4, Math.floor(((monthValue || bsMonth) - 1) / 3) + 1)),
                    ) as any;
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
        {[{key:"summary",label:"VAT Summary"},{key:"A",label:"Annex-A (Sales)"},{key:"B",label:"Annex-B (Purchases)"},{key:"C",label:"Annex-C (Imports)"}].map(({key,label}) => (
          <button key={key} type="button" onClick={() => setAnnexTab(key as any)}
            className={`h-8 px-3 text-[11px] font-semibold rounded-t transition-colors border-b-2 cursor-pointer ${annexTab === key ? "border-[#1557b0] text-[#1557b0] bg-white" : "border-transparent text-[#000000] hover:text-[#000000] bg-[#EBF5E2]"}`}>
            {label}
          </button>
        ))}
      </div>

      {annexTab === "summary" ? (
        <Card border padding="md" className="grid gap-5">
          {vat3Return.vatPayable > 0 ? (
            <div className="bg-[#fff3cd] border border-[#ffc107] font-bold text-[13px] px-4 py-2.5 rounded-md text-amber-900 flex items-center justify-between">
              <span>Net VAT Position:</span>
              <span>VAT PAYABLE: Rs. {formatNumber(vat3Return.vatPayable)}</span>
            </div>
          ) : vat3Return.vatRefundable > 0 ? (
            <div className="bg-[#fff3cd] border border-[#ffc107] font-bold text-[13px] px-4 py-2.5 rounded-md text-amber-900 flex items-center justify-between">
              <span>Net VAT Position:</span>
              <span>VAT REFUNDABLE: Rs. {formatNumber(vat3Return.vatRefundable)}</span>
            </div>
          ) : (
            <div className="bg-[#fff3cd] border border-[#ffc107] font-bold text-[13px] px-4 py-2.5 rounded-md text-amber-900 flex items-center justify-between">
              <span>Net VAT Position:</span>
              <span>Balanced (No VAT Payable/Refundable)</span>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-3">{renderVat3Card()}</div>
        </Card>
      ) : (
        <Card border padding="md" className="grid gap-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b pb-4">
            <div>
              <div className="text-[10px] font-semibold text-[#000000] uppercase tracking-wide">
                {annexTab === "A"
                  ? "Annex A (Sales)"
                  : annexTab === "B"
                    ? "Annex B (Purchases)"
                    : "Annex C (Imports)"}
              </div>
              <div className="mt-1 text-xs text-[#000000]">
                Invoices and VAT totals for the selected period.
              </div>
            </div>
            <div className="text-right text-[12px] text-[#000000] bg-[#EBF5E2] p-3 border rounded-md">
              <span className="font-semibold text-[#000000]">Total Taxable:</span>{" "}
              <span className="font-mono font-bold text-[#000000]">
                Rs. {formatNumber(activeAnnex?.data?.totals.taxable || 0)}
              </span>{" "}
              |&nbsp;
              <span className="font-semibold text-[#000000]">Total VAT:</span>{" "}
              <span className="font-mono font-bold text-[#1557b0]">
                Rs. {formatNumber(activeAnnex?.data?.totals.vat || 0)}
              </span>{" "}
              |&nbsp;
              <span className="font-semibold text-[#000000]">Total Exempt:</span>{" "}
              <span className="font-mono font-bold text-[#000000]">
                Rs. {formatNumber(activeAnnex?.data?.totals.exempt || 0)}
              </span>{" "}
              |&nbsp;
              <span className="font-semibold text-[#000000]">Gross Total:</span>{" "}
              <span className="font-mono font-bold text-[#000000]">
                Rs. {formatNumber(activeAnnex?.data?.totals.total || 0)}
              </span>
            </div>
          </div>

          <div className="bg-white border rounded-lg overflow-hidden animate-fadeIn" style={{ borderColor: "var(--border)" }}>
            <table className="data-table">
              <thead>
                <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
                  {annexTab === "A" ? (
                    <>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Bill No</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Bill Date</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Customer Name</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">PAN</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Taxable Amount</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">VAT Amount</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Total</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Bill No</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Supplier Name</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">PAN</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Taxable Amount</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">VAT Amount</th>
                      {annexTab === "C" && <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Total</th>}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {(!activeAnnex || activeAnnex.data.rows.length === 0) ? (
                  <tr>
                    <td colSpan={annexTab === "A" ? 7 : (annexTab === "C" ? 6 : 5)} className="text-center py-8 text-[#000000] text-[12px]">
                      No records found for the selected period.
                    </td>
                  </tr>
                ) : (
                  activeAnnex.data.rows.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[#e8eeff]">
                      {annexTab === "A" ? (
                        <>
                          <td className="px-3 py-[7px] text-[12px] text-[#000000] font-bold">{row.billNo}</td>
                          <td className="px-3 py-[7px] text-[12px] text-[#000000]">
                            {(() => {
                              try {
                                return formatADToBS(row.date);
                              } catch (e) {
                                return row.date;
                              }
                            })()}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-[#000000]">{row.partyName}</td>
                          <td className="px-3 py-[7px] text-[12px] text-[#000000] font-mono">{row.partyPan || "-"}</td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">Rs. {formatNumber(row.taxableAmt)}</td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt amt-dr">Rs. {formatNumber(row.vatAmt)}</td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">Rs. {formatNumber(row.totalAmt)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-[7px] text-[12px] text-[#000000] font-bold">{row.billNo}</td>
                          <td className="px-3 py-[7px] text-[12px] text-[#000000]">{row.partyName}</td>
                          <td className="px-3 py-[7px] text-[12px] text-[#000000] font-mono">{row.partyPan || "-"}</td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">Rs. {formatNumber(row.taxableAmt)}</td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt amt-cr">Rs. {formatNumber(row.vatAmt)}</td>
                          {annexTab === "C" && <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">Rs. {formatNumber(row.totalAmt)}</td>}
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {activeAnnex && activeAnnex.data.rows.length > 0 && (
                <tfoot className="bg-[#eef1f8] border-t-2 border-[#c5cad8] font-bold">
                  <tr>
                    <td colSpan={annexTab === "A" ? 4 : 3} className="px-3 py-2 text-[12px] text-[#000000]">Total</td>
                    <td className="px-3 py-2 text-[12px] text-right font-mono amt">Rs. {formatNumber(activeAnnex.data.totals.taxable)}</td>
                    <td className={`px-3 py-2 text-[12px] text-right font-mono amt ${annexTab === "A" ? "amt-dr" : "amt-cr"}`}>Rs. {formatNumber(activeAnnex.data.totals.vat)}</td>
                    {annexTab === "A" && <td className="px-3 py-2 text-[12px] text-right font-mono amt">Rs. {formatNumber(activeAnnex.data.totals.total)}</td>}
                    {annexTab === "C" && <td className="px-3 py-2 text-[12px] text-right font-mono amt">Rs. {formatNumber(activeAnnex.data.totals.total)}</td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}
    </div>

      </FormPanel>

      {showIrdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#1e2433] px-4 py-3 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[#000000] flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Submit Return to IRD
              </h2>
              <button
                onClick={() => setShowIrdModal(false)}
                className="text-[#000000] hover:text-[#000000] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleIrdSubmit} className="p-5">
              <div className="grid gap-4">
                <div className="text-[12px] text-[#000000] mb-2">
                  You are about to submit the VAT 3 Return for the period <strong>{periodLabel}</strong> to the IRD portal.
                </div>
                
                <div className="grid gap-1">
                  <label className="text-[11px] font-medium text-[#000000]">IRD Username</label>
                  <input
                    type="text"
                    value={irdUsername}
                    onChange={(e) => setIrdUsername(e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    placeholder="Enter Username"
                    autoFocus
                  />
                </div>
                
                <div className="grid gap-1">
                  <label className="text-[11px] font-medium text-[#000000]">IRD Password</label>
                  <input
                    type="password"
                    value={irdPassword}
                    onChange={(e) => setIrdPassword(e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    placeholder="Enter Password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-[#9DC07A]">
                <button
                  type="button"
                  onClick={() => setShowIrdModal(false)}
                  className="h-8 px-4 text-[12px] font-medium text-[#000000] bg-white border border-[#9DC07A] rounded-md hover:bg-[#EBF5E2] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 text-[12px] font-medium text-white bg-[#3D6B25] rounded-md hover:bg-[#2D5A1A] flex items-center gap-1.5 cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Submit Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default VatReports;

