// src/pages/VatReports.tsx

import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { adToBS, formatBSDate } from "../lib/nepaliDate";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";

type VatInvoiceType =
  | "sales-invoice"
  | "purchase-invoice"
  | "sales-return"
  | "purchase-return";

interface VatInvoiceLine {
  itemName?: string;
  description?: string;
  taxableAmount?: number;
  exemptAmount?: number;
  vatAmount?: number;
  totalAmount?: number;
  isExport?: boolean;
  isZeroRated?: boolean;
}

interface VatInvoice {
  id?: string;
  invoiceNo: string;
  date: string;
  dateNepali?: string;
  type: VatInvoiceType;
  partyName: string;
  partyPan?: string;
  taxableAmount?: number;
  exemptAmount?: number;
  vatAmount?: number;
  grandTotal?: number;
  lines?: VatInvoiceLine[];
  cbmsIrn?: string;
  cbmsSubmitted?: boolean;

  // Optional fields if your app has them
  status?: "draft" | "posted" | "cancelled" | "void" | string;
  isCancelled?: boolean;
  isAmended?: boolean;
  isExport?: boolean;
  isZeroRated?: boolean;
  remarks?: string;
}

interface AnnexRow {
  sn: number;
  billDateBS: string;
  partyName: string;
  partyPan: string;
  billNo: string;
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
  remarks: string;
  raw: VatInvoice;
}

interface VatReturnRows {
  outputTaxableSales: number;
  outputVatOnSales: number;
  outputTaxableExports: number;
  exemptSales: number;
  salesReturnsTaxable: number;
  salesReturnsVat: number;
  netOutputTax: number;

  inputTaxablePurchases: number;
  inputVatOnPurchases: number;
  purchaseReturnsTaxable: number;
  purchaseReturnsVat: number;
  netInputTax: number;

  netVat: number;
  previousCredit: number;
  taxPayable: number;
  taxRefundable: number;
}

const VAT_CSV_HEADERS = [
  "S.N.",
  "Bill Date (BS)",
  "Customer/Supplier Name",
  "PAN No.",
  "Bill No.",
  "Taxable Amount (Rs.)",
  "VAT Amount (Rs.)",
  "Total Amount (Rs.)",
  "Remarks",
];

const ANNEX_1_HEADERS = [
  "S.N.",
  "Bill Date (BS)",
  "Customer Name",
  "PAN No.",
  "Bill No.",
  "Taxable Amount (Rs.)",
  "VAT Amount (Rs.)",
  "Total Amount (Rs.)",
  "Remarks",
];

const ANNEX_2_HEADERS = [
  "S.N.",
  "Bill Date (BS)",
  "Supplier Name",
  "PAN No.",
  "Bill No.",
  "Taxable Amount (Rs.)",
  "VAT Amount (Rs.)",
  "Total Amount (Rs.)",
  "Remarks",
];

const BS_MONTHS = {
  BAISAKH: 1,
  JESTHA: 2,
  ASHADH: 3,
  SHRAWAN: 4,
  BHADRA: 5,
  ASHWIN: 6,
  KARTIK: 7,
  MANGSIR: 8,
  POUSH: 9,
  MAGH: 10,
  FALGUN: 11,
  CHAITRA: 12,
};

type QuarterKey = "Q1" | "Q2" | "Q3" | "Q4";

interface BSQuarterPeriod {
  key: QuarterKey;
  label: string;
  startBS: string;
  endBS: string;
  dueBS: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseFiscalYearStartYear(fiscalYearLabel?: string): number {
  // Supports "2081/82", "2081-82", "FY 2081/82", etc.
  const match = fiscalYearLabel?.match(/20\d{2}/);
  if (match) return Number(match[0]);

  // Safe fallback
  const today = new Date();
  const approxBSYear = today.getFullYear() + 57;
  return approxBSYear;
}

function buildBSQuarters(fiscalYearStartBS: number): BSQuarterPeriod[] {
  const y = fiscalYearStartBS;
  const nextY = fiscalYearStartBS + 1;

  return [
    {
      key: "Q1",
      label: "Q1 — Shrawan to Ashwin",
      startBS: `${y}-04-01`,
      endBS: `${y}-06-32`,
      dueBS: `${y}-07-25`,
    },
    {
      key: "Q2",
      label: "Q2 — Kartik to Poush",
      startBS: `${y}-07-01`,
      endBS: `${y}-09-30`,
      dueBS: `${y}-10-25`,
    },
    {
      key: "Q3",
      label: "Q3 — Magh to Chaitra",
      startBS: `${y}-10-01`,
      endBS: `${y}-12-30`,
      dueBS: `${nextY}-01-25`,
    },
    {
      key: "Q4",
      label: "Q4 — Baisakh to Ashadh",
      startBS: `${nextY}-01-01`,
      endBS: `${nextY}-03-32`,
      dueBS: `${nextY}-04-25`,
    },
  ];
}

function normalizeBSDate(invoice: VatInvoice): string {
  if (invoice.dateNepali) return invoice.dateNepali;

  try {
    const converted = adToBS(invoice.date) as unknown;

    if (typeof converted === "string") {
      return converted;
    }

    return formatBSDate(converted as any);
  } catch {
    return invoice.date;
  }
}

function bsDateToNumber(bsDate: string): number {
  // "2081-04-15" => 20810415
  const [y, m, d] = bsDate.split("-").map(Number);
  return y * 10000 + m * 100 + d;
}

function isWithinBSPeriod(invoice: VatInvoice, period: BSQuarterPeriod): boolean {
  const bs = normalizeBSDate(invoice);
  const n = bsDateToNumber(bs);
  return n >= bsDateToNumber(period.startBS) && n <= bsDateToNumber(period.endBS);
}

function amount(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function isCancelledInvoice(invoice: VatInvoice): boolean {
  return (
    invoice.isCancelled === true ||
    invoice.status === "cancelled" ||
    invoice.status === "void"
  );
}

function isAmendedInvoice(invoice: VatInvoice): boolean {
  return invoice.isAmended === true || /amend/i.test(invoice.remarks || "");
}

function isExportOrZeroRated(invoice: VatInvoice): boolean {
  if (invoice.isExport || invoice.isZeroRated) return true;

  return Boolean(
    invoice.lines?.some(
      (line) =>
        line.isExport ||
        line.isZeroRated ||
        /export|zero.?rated/i.test(line.description || "") ||
        /export|zero.?rated/i.test(line.itemName || ""),
    ),
  );
}

function invoiceRemarks(invoice: VatInvoice): string {
  if (isCancelledInvoice(invoice)) return "Cancelled";
  if (isAmendedInvoice(invoice)) return "Amended";
  if (invoice.cbmsSubmitted && invoice.cbmsIrn) return "CBMS Submitted";
  if (invoice.remarks) return invoice.remarks;
  return "";
}

function buildAnnexRows(
  invoices: VatInvoice[],
  period: BSQuarterPeriod,
  type: "sales" | "purchase",
): { normalRows: AnnexRow[]; cancelledRows: AnnexRow[] } {
  const allowedTypes =
    type === "sales"
      ? new Set<VatInvoiceType>(["sales-invoice"])
      : new Set<VatInvoiceType>(["purchase-invoice"]);

  const periodInvoices = invoices
    .filter((invoice) => allowedTypes.has(invoice.type))
    .filter((invoice) => isWithinBSPeriod(invoice, period))
    .sort((a, b) => {
      const da = bsDateToNumber(normalizeBSDate(a));
      const db = bsDateToNumber(normalizeBSDate(b));
      if (da !== db) return da - db;
      return String(a.invoiceNo).localeCompare(String(b.invoiceNo));
    });

  const normal: VatInvoice[] = [];
  const cancelled: VatInvoice[] = [];

  for (const invoice of periodInvoices) {
    if (isCancelledInvoice(invoice)) cancelled.push(invoice);
    else normal.push(invoice);
  }

  const toRow = (invoice: VatInvoice, idx: number): AnnexRow => ({
    sn: idx + 1,
    billDateBS: normalizeBSDate(invoice),
    partyName: invoice.partyName || "",
    partyPan: invoice.partyPan || "",
    billNo: invoice.invoiceNo || "",
    taxableAmount: amount(invoice.taxableAmount),
    vatAmount: amount(invoice.vatAmount),
    totalAmount: amount(invoice.grandTotal),
    remarks: invoiceRemarks(invoice),
    raw: invoice,
  });

  return {
    normalRows: normal.map(toRow),
    cancelledRows: cancelled.map(toRow),
  };
}

function sumRows(rows: AnnexRow[]) {
  return rows.reduce(
    (sum, row) => {
      sum.taxableAmount += row.taxableAmount;
      sum.vatAmount += row.vatAmount;
      sum.totalAmount += row.totalAmount;
      return sum;
    },
    { taxableAmount: 0, vatAmount: 0, totalAmount: 0 },
  );
}

function computeVatReturn(
  invoices: VatInvoice[],
  period: BSQuarterPeriod,
  previousCredit: number,
): VatReturnRows {
  const periodInvoices = invoices.filter((invoice) => isWithinBSPeriod(invoice, period));

  const salesInvoices = periodInvoices.filter(
    (invoice) => invoice.type === "sales-invoice" && !isCancelledInvoice(invoice),
  );

  const salesReturns = periodInvoices.filter(
    (invoice) => invoice.type === "sales-return" && !isCancelledInvoice(invoice),
  );

  const purchaseInvoices = periodInvoices.filter(
    (invoice) => invoice.type === "purchase-invoice" && !isCancelledInvoice(invoice),
  );

  const purchaseReturns = periodInvoices.filter(
    (invoice) => invoice.type === "purchase-return" && !isCancelledInvoice(invoice),
  );

  const taxableSales = salesInvoices
    .filter((invoice) => !isExportOrZeroRated(invoice))
    .reduce((sum, invoice) => sum + amount(invoice.taxableAmount), 0);

  const vatOnSales = salesInvoices
    .filter((invoice) => !isExportOrZeroRated(invoice))
    .reduce((sum, invoice) => sum + amount(invoice.vatAmount), 0);

  const exportSales = salesInvoices
    .filter(isExportOrZeroRated)
    .reduce((sum, invoice) => sum + amount(invoice.taxableAmount), 0);

  const exemptSales = salesInvoices.reduce(
    (sum, invoice) => sum + amount(invoice.exemptAmount),
    0,
  );

  const salesReturnTaxable = salesReturns.reduce(
    (sum, invoice) => sum + amount(invoice.taxableAmount),
    0,
  );

  const salesReturnVat = salesReturns.reduce(
    (sum, invoice) => sum + amount(invoice.vatAmount),
    0,
  );

  const taxablePurchases = purchaseInvoices.reduce(
    (sum, invoice) => sum + amount(invoice.taxableAmount),
    0,
  );

  const vatOnPurchases = purchaseInvoices.reduce(
    (sum, invoice) => sum + amount(invoice.vatAmount),
    0,
  );

  const purchaseReturnTaxable = purchaseReturns.reduce(
    (sum, invoice) => sum + amount(invoice.taxableAmount),
    0,
  );

  const purchaseReturnVat = purchaseReturns.reduce(
    (sum, invoice) => sum + amount(invoice.vatAmount),
    0,
  );

  const netOutputTax = vatOnSales - salesReturnVat;
  const netInputTax = vatOnPurchases - purchaseReturnVat;
  const netVat = netOutputTax - netInputTax;
  const afterPreviousCredit = netVat - previousCredit;

  return {
    outputTaxableSales: taxableSales,
    outputVatOnSales: vatOnSales,
    outputTaxableExports: exportSales,
    exemptSales,
    salesReturnsTaxable: salesReturnTaxable,
    salesReturnsVat: salesReturnVat,
    netOutputTax,

    inputTaxablePurchases: taxablePurchases,
    inputVatOnPurchases: vatOnPurchases,
    purchaseReturnsTaxable: purchaseReturnTaxable,
    purchaseReturnsVat: purchaseReturnVat,
    netInputTax,

    netVat,
    previousCredit,
    taxPayable: afterPreviousCredit > 0 ? afterPreviousCredit : 0,
    taxRefundable: afterPreviousCredit < 0 ? Math.abs(afterPreviousCredit) : 0,
  };
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function csvEscape(value: unknown): string {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsv(filename: string, rows: unknown[][]): void {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");

  // BOM helps Excel display Devanagari/PAN text properly.
  const blob = new Blob(["\ufeff", csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAnnexCsv(
  annex: "annex1" | "annex2",
  normalRows: AnnexRow[],
  cancelledRows: AnnexRow[],
  period: BSQuarterPeriod,
): void {
  const headers = annex === "annex1" ? ANNEX_1_HEADERS : ANNEX_2_HEADERS;

  const body = normalRows.map((row) => [
    row.sn,
    row.billDateBS,
    row.partyName,
    row.partyPan,
    row.billNo,
    row.taxableAmount.toFixed(2),
    row.vatAmount.toFixed(2),
    row.totalAmount.toFixed(2),
    row.remarks,
  ]);

  const totals = sumRows(normalRows);

  const csvRows: unknown[][] = [
    headers,
    ...body,
    [
      "Total",
      "",
      "",
      "",
      "",
      totals.taxableAmount.toFixed(2),
      totals.vatAmount.toFixed(2),
      totals.totalAmount.toFixed(2),
      "",
    ],
  ];

  if (cancelledRows.length > 0) {
    csvRows.push([]);
    csvRows.push(["Cancelled Bills"]);
    csvRows.push(headers);

    cancelledRows.forEach((row, idx) => {
      csvRows.push([
        idx + 1,
        row.billDateBS,
        row.partyName,
        row.partyPan,
        row.billNo,
        row.taxableAmount.toFixed(2),
        row.vatAmount.toFixed(2),
        row.totalAmount.toFixed(2),
        row.remarks || "Cancelled",
      ]);
    });
  }

  const filePrefix = annex === "annex1" ? "IRD_VAT_Annex_1_Sales_Book" : "IRD_VAT_Annex_2_Purchase_Book";

  downloadCsv(
    `${filePrefix}_${period.key}_${period.startBS}_to_${period.endBS}.csv`,
    csvRows,
  );
}

const VatReports: React.FC = () => {
  const {
    invoices,
    companySettings,
    currentFiscalYear,
    currentUser,
  } = useStore() as any;

  const vatInvoices = (invoices || []) as VatInvoice[];

  const fiscalYearLabel =
    currentFiscalYear?.fiscalYearBS ||
    currentFiscalYear?.name ||
    currentFiscalYear?.label ||
    "2081/82";

  const fiscalYearStartBS = parseFiscalYearStartYear(fiscalYearLabel);
  const quarters = useMemo(
    () => buildBSQuarters(fiscalYearStartBS),
    [fiscalYearStartBS],
  );

  const [quarterKey, setQuarterKey] = useState<QuarterKey>("Q1");
  const [activeTab, setActiveTab] = useState<"annex1" | "annex2" | "vat10">("vat10");
  const [previousCredit, setPreviousCredit] = useState<number>(0);

  const selectedPeriod = useMemo(
    () => quarters.find((q) => q.key === quarterKey) || quarters[0],
    [quarters, quarterKey],
  );

  const annex1 = useMemo(
    () => buildAnnexRows(vatInvoices, selectedPeriod, "sales"),
    [vatInvoices, selectedPeriod],
  );

  const annex2 = useMemo(
    () => buildAnnexRows(vatInvoices, selectedPeriod, "purchase"),
    [vatInvoices, selectedPeriod],
  );

  const vat10 = useMemo(
    () => computeVatReturn(vatInvoices, selectedPeriod, previousCredit),
    [vatInvoices, selectedPeriod, previousCredit],
  );

  const companyNameEn =
    companySettings?.companyNameEn ||
    companySettings?.name ||
    "Company Name";

  const companyNameNp =
    companySettings?.companyNameNp ||
    companySettings?.nameNepali ||
    "कम्पनीको नाम";

  const companyPan =
    companySettings?.panNumber ||
    companySettings?.pan ||
    "";

  const vatNo =
    companySettings?.vatNumber ||
    companySettings?.taxRegistrationNumber ||
    companySettings?.tax_registration_number ||
    companyPan;

  const preparedBy =
    currentUser?.name ||
    currentUser?.username ||
    "Prepared User";

  const todayAD = new Date().toISOString().split("T")[0];

  const preparedDateBS = (() => {
    try {
      const converted = adToBS(todayAD) as any;
      return typeof converted === "string" ? converted : formatBSDate(converted);
    } catch {
      return todayAD;
    }
  })();

  const renderPrintHeader = () => (
    <div className="print-only hidden mb-4 text-center">
      <h1 className="text-[16px] font-bold">{companyNameEn}</h1>
      <h2 className="text-[15px] font-semibold">{companyNameNp}</h2>

      <div className="mt-2 text-[11px] leading-5">
        <div>PAN No.: {companyPan || "—"} | VAT Registration No.: {vatNo || "—"}</div>
        <div>Fiscal Year: {fiscalYearLabel}</div>
        <div>
          Return Period: {selectedPeriod.label} ({selectedPeriod.startBS} to{" "}
          {selectedPeriod.endBS})
        </div>
        <div>Prepared By: {preparedBy} | Date: {preparedDateBS}</div>
      </div>
    </div>
  );

  const annexColumns = [
    { key: "sn", header: "S.N.", align: "center" as const, width: "60px" },
    { key: "billDateBS", header: "Bill Date (BS)" },
    { key: "partyName", header: activeTab === "annex1" ? "Customer Name" : "Supplier Name" },
    { key: "partyPan", header: "PAN No." },
    { key: "billNo", header: "Bill No." },
    {
      key: "taxableAmount",
      header: "Taxable Amount (Rs.)",
      align: "right" as const,
      render: (value: number) => formatMoney(value),
    },
    {
      key: "vatAmount",
      header: "VAT Amount (Rs.)",
      align: "right" as const,
      render: (value: number) => formatMoney(value),
    },
    {
      key: "totalAmount",
      header: "Total Amount (Rs.)",
      align: "right" as const,
      render: (value: number) => formatMoney(value),
    },
    { key: "remarks", header: "Remarks" },
  ];

  const vat10Rows = [
    {
      part: "Part A",
      row: "1a",
      description: "Taxable Sales",
      baseAmount: vat10.outputTaxableSales,
      vatAmount: 0,
    },
    {
      part: "Part A",
      row: "1b",
      description: "VAT on Sales",
      baseAmount: 0,
      vatAmount: vat10.outputVatOnSales,
    },
    {
      part: "Part A",
      row: "1c",
      description: "Taxable Exports - Zero Rated",
      baseAmount: vat10.outputTaxableExports,
      vatAmount: 0,
    },
    {
      part: "Part A",
      row: "1d",
      description: "Exempt Sales",
      baseAmount: vat10.exemptSales,
      vatAmount: 0,
    },
    {
      part: "Part A",
      row: "2",
      description: "Sales Returns / Debit Notes",
      baseAmount: vat10.salesReturnsTaxable,
      vatAmount: vat10.salesReturnsVat,
    },
    {
      part: "Part A",
      row: "",
      description: "Net Output Tax",
      baseAmount: 0,
      vatAmount: vat10.netOutputTax,
      isTotal: true,
    },

    {
      part: "Part B",
      row: "3a",
      description: "Taxable Purchases",
      baseAmount: vat10.inputTaxablePurchases,
      vatAmount: 0,
    },
    {
      part: "Part B",
      row: "3b",
      description: "VAT on Purchases",
      baseAmount: 0,
      vatAmount: vat10.inputVatOnPurchases,
    },
    {
      part: "Part B",
      row: "4",
      description: "Purchase Returns",
      baseAmount: vat10.purchaseReturnsTaxable,
      vatAmount: vat10.purchaseReturnsVat,
    },
    {
      part: "Part B",
      row: "",
      description: "Net Input Tax",
      baseAmount: 0,
      vatAmount: vat10.netInputTax,
      isTotal: true,
    },

    {
      part: "Part C",
      row: "5",
      description: "Net VAT = Output Tax - Input Tax",
      baseAmount: 0,
      vatAmount: vat10.netVat,
    },
    {
      part: "Part C",
      row: "6",
      description: "Previous Credit",
      baseAmount: 0,
      vatAmount: vat10.previousCredit,
    },
    {
      part: "Part C",
      row: "7",
      description:
        vat10.taxPayable > 0
          ? "Tax Payable"
          : "Tax Refundable / Credit Carry Forward",
      baseAmount: 0,
      vatAmount: vat10.taxPayable > 0 ? vat10.taxPayable : vat10.taxRefundable,
      isGrandTotal: true,
    },
  ];

  const vat10Columns = [
    { key: "part", header: "Part", width: "90px" },
    { key: "row", header: "Row", width: "70px" },
    { key: "description", header: "Description" },
    {
      key: "baseAmount",
      header: "Taxable / Base Amount",
      align: "right" as const,
      render: (value: number) => (value ? formatMoney(value) : "—"),
    },
    {
      key: "vatAmount",
      header: "VAT Amount",
      align: "right" as const,
      render: (value: number) => formatMoney(value),
    },
  ];

  const activeAnnex = activeTab === "annex1" ? annex1 : annex2;
  const annexTitle = activeTab === "annex1" ? "ANNEX 1 — Sales Book" : "ANNEX 2 — Purchase Book";

  return (
    <ReportShell
      title="Nepal VAT Reports"
      subtitle={`IRD VAT Return — ${selectedPeriod.label}, FY ${fiscalYearLabel}`}
      actions={
        <div className="flex items-center gap-2 no-print">
          {activeTab === "annex1" && (
            <button
              type="button"
              onClick={() =>
                exportAnnexCsv(
                  "annex1",
                  annex1.normalRows,
                  annex1.cancelledRows,
                  selectedPeriod,
                )
              }
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md"
            >
              Export Annex 1 CSV
            </button>
          )}

          {activeTab === "annex2" && (
            <button
              type="button"
              onClick={() =>
                exportAnnexCsv(
                  "annex2",
                  annex2.normalRows,
                  annex2.cancelledRows,
                  selectedPeriod,
                )
              }
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md"
            >
              Export Annex 2 CSV
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
          >
            Print
          </button>
        </div>
      }
    >
      {renderPrintHeader()}

      <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("vat10")}
            className={`h-8 px-3 text-[12px] font-medium rounded-md border ${
              activeTab === "vat10"
                ? "bg-[#1557b0] text-white border-[#1557b0]"
                : "bg-white text-gray-700 border-gray-300"
            }`}
          >
            VAT 10 Return
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("annex1")}
            className={`h-8 px-3 text-[12px] font-medium rounded-md border ${
              activeTab === "annex1"
                ? "bg-[#1557b0] text-white border-[#1557b0]"
                : "bg-white text-gray-700 border-gray-300"
            }`}
          >
            Annex 1 Sales Book
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("annex2")}
            className={`h-8 px-3 text-[12px] font-medium rounded-md border ${
              activeTab === "annex2"
                ? "bg-[#1557b0] text-white border-[#1557b0]"
                : "bg-white text-gray-700 border-gray-300"
            }`}
          >
            Annex 2 Purchase Book
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[11px] font-medium text-gray-600">BS Quarter</label>
          <select
            value={quarterKey}
            onChange={(e) => setQuarterKey(e.target.value as QuarterKey)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
          >
            {quarters.map((q) => (
              <option key={q.key} value={q.key}>
                {q.label} ({q.startBS} to {q.endBS})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 bg-white border border-gray-200 rounded-md p-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[12px]">
          <div>
            <div className="text-[10px] uppercase font-semibold text-gray-500">Fiscal Year</div>
            <div className="font-semibold text-gray-800">{fiscalYearLabel}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold text-gray-500">Return Period</div>
            <div className="font-semibold text-gray-800">
              {selectedPeriod.startBS} to {selectedPeriod.endBS}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold text-gray-500">Due Date</div>
            <div className="font-semibold text-red-700">
              {selectedPeriod.dueBS}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold text-gray-500">Prepared Date</div>
            <div className="font-semibold text-gray-800">{preparedDateBS}</div>
          </div>
        </div>
      </div>

      {activeTab === "vat10" && (
        <div className="space-y-4">
          <div className="no-print bg-white border border-gray-200 rounded-md p-3 flex items-center gap-3">
            <label className="text-[11px] font-medium text-gray-600">
              Previous VAT Credit
            </label>
            <input
              type="number"
              value={previousCredit}
              onChange={(e) => setPreviousCredit(Number(e.target.value || 0))}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white text-right"
            />
          </div>

          <ReportGrid
            columns={vat10Columns}
            data={vat10Rows}
            rowClassName={(row: any) =>
              row.isGrandTotal
                ? "bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]"
                : row.isTotal
                  ? "bg-gray-50 font-semibold"
                  : ""
            }
          />

          <div
            className={`border rounded-md p-4 ${
              vat10.taxPayable > 0
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-green-50 text-green-700 border-green-200"
            }`}
          >
            <div className="text-[11px] uppercase font-semibold">
              Final VAT Position
            </div>
            <div className="text-[18px] font-bold font-mono mt-1">
              {vat10.taxPayable > 0
                ? `Tax Payable: Rs. ${formatMoney(vat10.taxPayable)}`
                : `Refundable / Credit Carry Forward: Rs. ${formatMoney(
                    vat10.taxRefundable,
                  )}`}
            </div>
            <div className="text-[12px] mt-1">
              Return due date: {selectedPeriod.dueBS}
            </div>
          </div>
        </div>
      )}

      {(activeTab === "annex1" || activeTab === "annex2") && (
        <div className="space-y-5">
          <div>
            <h2 className="text-[13px] font-semibold text-gray-800 mb-2">
              {annexTitle}
            </h2>

            <ReportGrid columns={annexColumns} data={activeAnnex.normalRows} />

            <div className="bg-[#eef2ff] border border-[#c7d2fe] rounded-md p-3 mt-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px] font-semibold">
                <div>
                  Total Taxable Amount: Rs.{" "}
                  {formatMoney(sumRows(activeAnnex.normalRows).taxableAmount)}
                </div>
                <div>
                  Total VAT Amount: Rs.{" "}
                  {formatMoney(sumRows(activeAnnex.normalRows).vatAmount)}
                </div>
                <div>
                  Total Amount: Rs.{" "}
                  {formatMoney(sumRows(activeAnnex.normalRows).totalAmount)}
                </div>
              </div>
            </div>
          </div>

          {activeAnnex.cancelledRows.length > 0 && (
            <div>
              <h3 className="text-[13px] font-semibold text-red-700 mb-2">
                Cancelled Bills
              </h3>
              <ReportGrid columns={annexColumns} data={activeAnnex.cancelledRows} />
            </div>
          )}
        </div>
      )}
    </ReportShell>
  );
};

export default VatReports;


