// ============================================================
// src/lib/printUtils.ts  –  Nepal ERP Complete Print System
// ============================================================
// Strategy: open a browser popup with self-contained HTML+CSS,
// then call window.print(). No React hydration, no PDF library.
// QR codes are generated as data-URLs via the `qrcode` npm pkg.
// Legacy jsPDF exports kept at the bottom for backward-compat.
// ============================================================

import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatNumber } from "./utils";
import {
  DEFAULT_SYSTEM_CONFIGURATION,
  mergeSystemConfiguration,
  type PrintConfig,
} from "./systemConfiguration";
import { loadPrintPrefs } from "./printPrefs";

// ─────────────────────────────────────────────────────────────
// 1.  TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────

export interface InvoiceLine {
  itemName: string;
  hsnCode?: string;
  unit?: string;
  qty: number;
  rate: number;
  discountPct?: number;
  taxableAmount: number;
  vatRate?: number;
  vatAmount: number;
  totalAmount: number;
}

export interface CompanySettings {
  name: string;
  nameNepali?: string;
  address?: string;
  panNumber?: string;
  vatNumber?: string;
  phone?: string;
  email?: string;
  logo?: string; // base64 or URL
}

export interface DBInvoice {
  invoiceNo: string;
  date: string; // AD date string
  dateNepali?: string; // BS date string
  partyName?: string;
  partyPan?: string;
  partyAddress?: string;
  partyVatNo?: string;
  lines: InvoiceLine[];
  subTotal?: number;
  discountAmount?: number;
  taxableAmount: number;
  exemptAmount?: number;
  vatAmount: number;
  grandTotal: number;
  cbmsIrn?: string;
  qrCode?: string; // pre-generated QR data URL (optional)
  cbmsSubmitted?: boolean;
  status?: "ACTIVE" | "CANCELLED" | "DRAFT";
  companySettings?: CompanySettings;
}

export interface DeliveryChallan {
  dcNo: string;
  date: string;
  dateNepali?: string;
  partyName?: string;
  partyAddress?: string;
  fromGodown?: string;
  vehicleNo?: string;
  remarks?: string;
  lines: { itemName: string; hsnCode?: string; unit?: string; qty: number; remarks?: string }[];
  companySettings?: CompanySettings;
}

export interface AccountingVoucher {
  voucherNo: string;
  type: string;
  date: string;
  dateNepali?: string;
  narration?: string;
  totalDebit?: number;
  totalCredit?: number;
  lines: { accountName: string; narration?: string; debit: number; credit: number }[];
  companySettings?: CompanySettings;
}

export interface PrintOptions {
  copies?: number;
  showWatermark?: boolean;
  watermarkText?: string;
  emailAsPdf?: boolean;
  printConfig?: PrintConfig;
}

function resolvePrintConfig(
  options: PrintOptions,
  kind: "invoice" | "voucher" = "invoice",
): PrintConfig {
  if (options.printConfig) return options.printConfig;
  const prefs = loadPrintPrefs();
  const base =
    kind === "voucher"
      ? DEFAULT_SYSTEM_CONFIGURATION.voucherPrint
      : DEFAULT_SYSTEM_CONFIGURATION.invoicePrint;
  return {
    ...base,
    showLogo: prefs.showLogo,
  };
}

function buildPageCss(config: PrintConfig): string {
  const prefs = loadPrintPrefs();
  const size = prefs.pageSize || "A4";
  const orient = (prefs.orientation || "Portrait").toLowerCase();
  return `
  @page { size: ${size} ${orient}; margin: ${config.marginTopMm}mm ${config.marginRightMm}mm ${config.marginBottomMm}mm ${config.marginLeftMm}mm; }
  body { font-size: ${config.fontSize}pt; }`;
}

function printBannerHtml(config: PrintConfig, position: "header" | "footer"): string {
  const text = position === "header" ? config.headerText : config.footerText;
  if (!text?.trim()) return "";
  return `<div class="print-banner print-banner-${position}">${text}</div>`;
}

export type PrintDocumentType =
  | "tax-invoice"
  | "simplified-invoice"
  | "purchase-voucher"
  | "delivery-challan"
  | "thermal-receipt"
  | "voucher"
  | "payslip";

// ─────────────────────────────────────────────────────────────
// 2.  NEPAL-SPECIFIC UTILITIES
// ─────────────────────────────────────────────────────────────

/** Format number in Nepal lakh-crore system: 1,00,000 not 100,000 */
export function fmtNPR(amount: number, decimals = 2): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "0.00";
  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  const fixed = abs.toFixed(decimals);
  const [intStr, decStr] = fixed.split(".");

  let result: string;
  if (intStr.length <= 3) {
    result = intStr;
  } else {
    const last3 = intStr.slice(-3);
    const rest = intStr.slice(0, -3);
    let groups = "";
    for (let i = rest.length; i > 0; i -= 2) {
      const start = Math.max(0, i - 2);
      const seg = rest.slice(start, i);
      groups = seg + (groups ? "," + groups : "");
    }
    result = groups + "," + last3;
  }

  const full = isNeg ? "-" + result : result;
  return decimals > 0 ? full + "." + decStr : full;
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function numToWords(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  if (n < 1000)
    return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + numToWords(n % 100) : "");
  if (n < 100000)
    return (
      numToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + numToWords(n % 1000) : "")
    );
  if (n < 10000000)
    return (
      numToWords(Math.floor(n / 100000)) +
      " Lakh" +
      (n % 100000 ? " " + numToWords(n % 100000) : "")
    );
  return (
    numToWords(Math.floor(n / 10000000)) +
    " Crore" +
    (n % 10000000 ? " " + numToWords(n % 10000000) : "")
  );
}

export function amountInWords(amount: number): string {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const intPart = Math.floor(rounded);
  const paise = Math.round((rounded - intPart) * 100);
  const words = numToWords(intPart) || "Zero";
  let result = `Rupees ${words}`;
  if (paise > 0) result += ` and ${numToWords(paise)} Paisa`;
  return result + " Only";
}

async function buildQR(text?: string, size = 96): Promise<string> {
  if (!text) return "";
  try {
    return await QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: "M" });
  } catch {
    return "";
  }
}

function watermarkCSS(text: string, color: string): string {
  return `
  .watermark::before {
    content: "${text}";
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 72pt;
    font-weight: 900;
    color: ${color};
    opacity: 0.12;
    z-index: 9999;
    pointer-events: none;
    white-space: nowrap;
    letter-spacing: 8px;
  }`;
}

function resolveWatermark(invoice: DBInvoice, opts: PrintOptions): { css: string; cls: string } {
  const forced = opts.showWatermark && opts.watermarkText;
  if (forced) return { css: watermarkCSS(opts.watermarkText!, "#a00"), cls: "watermark" };
  if (invoice.status === "CANCELLED")
    return { css: watermarkCSS("CANCELLED", "#cc0000"), cls: "watermark" };
  if (invoice.status === "DRAFT") return { css: watermarkCSS("DRAFT", "#888"), cls: "watermark" };
  if (!invoice.cbmsSubmitted && invoice.cbmsIrn)
    return { css: watermarkCSS("CBMS PENDING", "#b8860b"), cls: "watermark" };
  return { css: "", cls: "" };
}

// ─────────────────────────────────────────────────────────────
// 3.  SHARED A4 PAGE CSS
// ─────────────────────────────────────────────────────────────

const A4_BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    color: #111;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .print-banner {
    text-align: center;
    font-size: 8pt;
    color: #444;
    padding: 2pt 0;
    border-bottom: 0.5px solid #ccc;
  }
  .print-banner-footer {
    border-bottom: none;
    border-top: 0.5px solid #ccc;
    margin-top: 8pt;
  }
  @media print {
    body { background: #fff; }
    .no-print { display: none !important; }
    .page-break { page-break-after: always; }
  }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #888; padding: 3pt 5pt; vertical-align: top; }
  th { background: #1e5c1e; color: #fff; text-align: center; font-size: 8pt; }
  td { font-size: 8.5pt; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .mono { font-family: 'Courier New', Courier, monospace; }
  .bold { font-weight: bold; }
  .divider { border-top: 1.5px solid #333; margin: 4pt 0; }
  .thin-divider { border-top: 0.5px solid #aaa; margin: 3pt 0; }
  .header-grid {
    display: grid;
    grid-template-columns: 80pt 1fr 80pt;
    align-items: center;
    gap: 8pt;
    margin-bottom: 6pt;
  }
  .company-center { text-align: center; }
  .company-name-np { font-size: 16pt; font-weight: 900; line-height: 1.1; }
  .company-name-en { font-size: 11pt; font-weight: bold; }
  .invoice-title {
    font-size: 13pt;
    font-weight: 900;
    text-align: center;
    letter-spacing: 1px;
    margin: 5pt 0 3pt;
    text-transform: uppercase;
    border: 2px solid #333;
    padding: 3pt 8pt;
    display: inline-block;
  }
  .bill-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6pt;
    margin: 6pt 0;
  }
  .bill-box {
    border: 1px solid #555;
    padding: 5pt;
    border-radius: 2pt;
    font-size: 8.5pt;
    line-height: 1.5;
  }
  .bill-box-title {
    font-weight: bold;
    font-size: 8pt;
    text-transform: uppercase;
    color: #1e5c1e;
    margin-bottom: 2pt;
    border-bottom: 1px solid #ccc;
    padding-bottom: 2pt;
  }
  .summary-box {
    width: 46%;
    margin-left: auto;
    margin-top: 6pt;
    border: 1px solid #555;
    border-radius: 2pt;
    overflow: hidden;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 2.5pt 7pt;
    font-size: 8.5pt;
    border-bottom: 0.5px solid #ddd;
  }
  .summary-row:last-child { border-bottom: none; }
  .summary-grand {
    background: #1e5c1e;
    color: #fff;
    font-weight: bold;
    font-size: 10pt;
    padding: 4pt 7pt;
  }
  .amount-words {
    margin-top: 5pt;
    padding: 4pt 7pt;
    background: #f5f5f5;
    border: 1px solid #ccc;
    font-size: 8.5pt;
    font-style: italic;
    border-radius: 2pt;
  }
  .sig-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20pt;
    margin-top: 20pt;
  }
  .sig-box {
    text-align: center;
    font-size: 8pt;
  }
  .sig-line {
    border-top: 1px solid #333;
    margin-bottom: 3pt;
  }
  .irn-footer {
    margin-top: 8pt;
    padding: 4pt 7pt;
    background: #f9f9f9;
    border: 1px solid #ccc;
    font-size: 7.5pt;
    text-align: center;
    border-radius: 2pt;
  }
  .terms {
    font-size: 7.5pt;
    color: #555;
    margin-top: 5pt;
  }
  .logo-img { max-height: 55pt; max-width: 75pt; object-fit: contain; }
  .qr-img { width: 70pt; height: 70pt; object-fit: contain; }
  .qr-sm { width: 45pt; height: 45pt; }
  .pan-vat-line { font-size: 8pt; margin-top: 2pt; }
`;

// ─────────────────────────────────────────────────────────────
// 4.  TAX INVOICE TEMPLATE  (IRD A4 format)
// ─────────────────────────────────────────────────────────────

async function taxInvoiceHTML(
  invoice: DBInvoice,
  opts: PrintOptions,
  simplified = false,
): Promise<string> {
  const printConfig = resolvePrintConfig(opts, "invoice");
  const cs = invoice.companySettings || ({} as CompanySettings);
  const qrSrc = invoice.qrCode || (await buildQR(invoice.cbmsIrn || invoice.invoiceNo, 120));
  const { css: wmCss, cls: wmCls } = resolveWatermark(invoice, opts);

  const title = simplified ? "SIMPLIFIED TAX INVOICE / सरलीकृत कर चलान" : "TAX INVOICE / कर चलान";

  const logoHtml =
    printConfig.showLogo && cs.logo
      ? `<img src="${cs.logo}" class="logo-img" alt="Logo" />`
      : '<div style="width:75pt;height:55pt;"></div>';

  const qrHtml = qrSrc
    ? `<img src="${qrSrc}" class="qr-img" alt="QR" />`
    : '<div style="width:70pt;height:70pt;border:1px solid #ccc;"></div>';

  const linesHTML = (invoice.lines || [])
    .map(
      (l, i) => `
    <tr>
      <td class="text-center">${i + 1}</td>
      <td>${l.itemName || ""}</td>
      <td class="text-center">${l.hsnCode || ""}</td>
      <td class="text-center">${l.unit || "Pcs"}</td>
      <td class="text-right mono">${l.qty}</td>
      <td class="text-right mono">${fmtNPR(l.rate)}</td>
      <td class="text-right mono">${l.discountPct ? l.discountPct + "%" : "-"}</td>
      <td class="text-right mono">${fmtNPR(l.taxableAmount)}</td>
      <td class="text-center">${l.vatRate !== undefined ? l.vatRate + "%" : "13%"}</td>
      <td class="text-right mono">${fmtNPR(l.vatAmount)}</td>
      <td class="text-right mono bold">${fmtNPR(l.totalAmount)}</td>
    </tr>`,
    )
    .join("");

  const grandTotal = invoice.grandTotal || 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${simplified ? "Simplified Tax Invoice" : "Tax Invoice"} - ${invoice.invoiceNo}</title>
<style>
${A4_BASE_CSS}
${buildPageCss(printConfig)}
${wmCss}
${simplified ? ".invoice-title { border-color: #444; }" : ""}
.items-table { margin: 5pt 0; }
.items-table th:nth-child(1) { width: 24pt; }
.items-table th:nth-child(3) { width: 40pt; }
.items-table th:nth-child(4) { width: 26pt; }
.items-table th:nth-child(5) { width: 26pt; }
.items-table th:nth-child(6) { width: 44pt; }
.items-table th:nth-child(7) { width: 34pt; }
.items-table th:nth-child(8) { width: 44pt; }
.items-table th:nth-child(9) { width: 26pt; }
.items-table th:nth-child(10) { width: 40pt; }
.items-table th:nth-child(11) { width: 44pt; }
</style>
</head>
<body class="${wmCls}">
${printBannerHtml(printConfig, "header")}
<!-- HEADER -->
<div class="header-grid">
  <div>${logoHtml}</div>
  <div class="company-center">
    ${cs.nameNepali ? `<div class="company-name-np">${cs.nameNepali}</div>` : ""}
    <div class="company-name-en">${cs.name || ""}</div>
    <div class="pan-vat-line">
      PAN No.: <strong>${cs.panNumber || "—"}</strong>
      &nbsp;|&nbsp; VAT Reg. No.: <strong>${cs.vatNumber || "—"}</strong>
    </div>
    <div style="font-size:8pt; margin-top:2pt;">
      ${cs.address || ""}
      ${cs.phone ? " | Ph: " + cs.phone : ""}
      ${cs.email ? " | " + cs.email : ""}
    </div>
    <div style="margin-top:5pt;">
      <span class="invoice-title">${title}</span>
    </div>
  </div>
  <div style="text-align:right">${qrHtml}</div>
</div>

<div class="divider"></div>

<!-- BILL TO / INVOICE DETAILS -->
<div class="bill-grid">
  <div class="bill-box">
    <div class="bill-box-title">Bill To / खरिदकर्ताको विवरण</div>
    <div><strong>${invoice.partyName || ""}</strong></div>
    ${invoice.partyAddress ? `<div>${invoice.partyAddress}</div>` : ""}
    ${!simplified && invoice.partyPan ? `<div>PAN: <strong>${invoice.partyPan}</strong></div>` : ""}
    ${invoice.partyVatNo ? `<div>VAT No.: ${invoice.partyVatNo}</div>` : ""}
  </div>
  <div class="bill-box">
    <div class="bill-box-title">Invoice Details / बिल विवरण</div>
    <div>Invoice No.: <strong>${invoice.invoiceNo}</strong></div>
    <div>Date (BS): <strong>${invoice.dateNepali || "—"}</strong></div>
    <div>Date (AD): ${invoice.date || ""}</div>
    ${invoice.cbmsIrn ? `<div>IRN: <strong>${invoice.cbmsIrn}</strong></div>` : ""}
  </div>
</div>

<!-- LINE ITEMS TABLE -->
<table class="items-table">
  <thead>
    <tr>
      <th>S.N.</th>
      <th>Description / विवरण</th>
      <th>H.S. Code</th>
      <th>Unit</th>
      <th>Qty</th>
      <th>Rate (Rs.)</th>
      <th>Disc.%</th>
      <th>Taxable Amount</th>
      <th>VAT %</th>
      <th>VAT (Rs.)</th>
      <th>Total (Rs.)</th>
    </tr>
  </thead>
  <tbody>
    ${linesHTML}
  </tbody>
</table>

<!-- SUMMARY -->
<div class="summary-box">
  <div class="summary-row"><span>Sub Total:</span><span class="mono">Rs. ${fmtNPR(invoice.subTotal || 0)}</span></div>
  ${
    (invoice.discountAmount || 0) > 0
      ? `<div class="summary-row"><span>Discount:</span><span class="mono">Rs. ${fmtNPR(invoice.discountAmount || 0)}</span></div>`
      : ""
  }
  <div class="summary-row"><span>Taxable Amount:</span><span class="mono">Rs. ${fmtNPR(invoice.taxableAmount)}</span></div>
  ${
    (invoice.exemptAmount || 0) > 0
      ? `<div class="summary-row"><span>Exempt Amount:</span><span class="mono">Rs. ${fmtNPR(invoice.exemptAmount || 0)}</span></div>`
      : ""
  }
  <div class="summary-row"><span>VAT @ 13%:</span><span class="mono">Rs. ${fmtNPR(invoice.vatAmount)}</span></div>
  <div class="summary-row summary-grand">
    <span>GRAND TOTAL:</span>
    <span class="mono">Rs. ${fmtNPR(grandTotal)}</span>
  </div>
</div>

<!-- AMOUNT IN WORDS -->
<div class="amount-words">
  <strong>Amount in Words:</strong> ${amountInWords(grandTotal)}
</div>

<!-- TERMS -->
<div class="terms" style="margin-top:6pt;">
  Goods once sold will not be taken back. E&amp;OE. All disputes subject to local jurisdiction.
</div>

<!-- SIGNATURE BOXES -->
<div class="sig-row">
  <div class="sig-box">
    <div class="sig-line" style="margin-top:28pt;"></div>
    Prepared By: _______________
  </div>
  <div class="sig-box">
    <div class="sig-line" style="margin-top:28pt;"></div>
    Received By: _______________
  </div>
</div>

<!-- IRN + QR FOOTER -->
${
  invoice.cbmsIrn
    ? `
<div class="irn-footer" style="margin-top:10pt;">
  <table border="0" style="border:none; width:100%;">
    <tr>
      <td style="border:none; text-align:left; vertical-align:middle; padding:0;">
        <div style="font-size:8pt; font-weight:bold;">IRN: ${invoice.cbmsIrn}</div>
        <div style="font-size:7pt; margin-top:2pt;">Verified at <strong>cbms.ird.gov.np</strong></div>
      </td>
      <td style="border:none; text-align:right; vertical-align:middle; padding:0;">
        ${qrSrc ? `<img src="${qrSrc}" class="qr-sm" alt="QR" />` : ""}
      </td>
    </tr>
  </table>
</div>`
    : ""
}

${printBannerHtml(printConfig, "footer")}

<script>
  window.onload = function() {
    setTimeout(function() { window.print(); }, 300);
  };
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// 5.  DELIVERY CHALLAN TEMPLATE
// ─────────────────────────────────────────────────────────────

async function deliveryChallanHTML(dc: DeliveryChallan, _opts: PrintOptions): Promise<string> {
  const cs = dc.companySettings || ({} as CompanySettings);

  const linesHTML = (dc.lines || [])
    .map(
      (l, i) => `
    <tr>
      <td class="text-center">${i + 1}</td>
      <td>${l.itemName || ""}</td>
      <td class="text-center">${l.hsnCode || ""}</td>
      <td class="text-center">${l.unit || ""}</td>
      <td class="text-right">${l.qty}</td>
      <td>${l.remarks || ""}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Delivery Challan - ${dc.dcNo}</title>
<style>
${A4_BASE_CSS}
</style>
</head>
<body>
<div class="header-grid" style="grid-template-columns: 80pt 1fr 80pt;">
  <div>${cs.logo ? `<img src="${cs.logo}" class="logo-img" alt="Logo" />` : ""}</div>
  <div class="company-center">
    ${cs.nameNepali ? `<div class="company-name-np">${cs.nameNepali}</div>` : ""}
    <div class="company-name-en">${cs.name || ""}</div>
    <div class="pan-vat-line">PAN: ${cs.panNumber || "—"}</div>
    <div style="font-size:8pt;">${cs.address || ""}${cs.phone ? " | Ph: " + cs.phone : ""}</div>
    <div style="margin-top:5pt;">
      <span class="invoice-title">DELIVERY CHALLAN / डेलिभरी चलान</span>
    </div>
  </div>
  <div></div>
</div>

<div class="divider"></div>

<div class="bill-grid">
  <div class="bill-box">
    <div class="bill-box-title">Deliver To</div>
    <div><strong>${dc.partyName || ""}</strong></div>
    ${dc.partyAddress ? `<div>${dc.partyAddress}</div>` : ""}
  </div>
  <div class="bill-box">
    <div class="bill-box-title">Challan Details</div>
    <div>DC No.: <strong>${dc.dcNo}</strong></div>
    <div>Date (BS): <strong>${dc.dateNepali || "—"}</strong></div>
    <div>Date (AD): ${dc.date || ""}</div>
    ${dc.vehicleNo ? `<div>Vehicle No.: ${dc.vehicleNo}</div>` : ""}
    ${dc.fromGodown ? `<div>From Godown: ${dc.fromGodown}</div>` : ""}
  </div>
</div>

<table style="margin-top:8pt;">
  <thead>
    <tr>
      <th style="width:24pt;">S.N.</th>
      <th>Item / Description</th>
      <th style="width:50pt;">H.S. Code</th>
      <th style="width:36pt;">Unit</th>
      <th style="width:36pt;">Quantity</th>
      <th>Remarks</th>
    </tr>
  </thead>
  <tbody>
    ${linesHTML}
    <!-- Blank rows for hand-writing -->
    ${Array.from({ length: Math.max(0, 5 - (dc.lines?.length || 0)) })
      .map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>`)
      .join("")}
  </tbody>
</table>

${dc.remarks ? `<div style="margin-top:6pt; font-size:8.5pt;"><strong>Remarks:</strong> ${dc.remarks}</div>` : ""}

<div class="sig-row" style="grid-template-columns: 1fr 1fr 1fr 1fr; gap:10pt; margin-top:30pt;">
  <div class="sig-box">
    <div class="sig-line"></div>
    <div>Delivered By</div>
  </div>
  <div class="sig-box">
    <div class="sig-line"></div>
    <div>Received By</div>
  </div>
  <div class="sig-box">
    <div class="sig-line"></div>
    <div>Vehicle No.<br/>${dc.vehicleNo || "____________"}</div>
  </div>
  <div class="sig-box">
    <div class="sig-line"></div>
    <div>Date / Stamp</div>
  </div>
</div>

<div class="terms" style="margin-top:10pt; text-align:center;">
  <em>This is a delivery challan only. No monetary value indicated. Quantities subject to verification.</em>
</div>

<script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// 6.  ACCOUNTING VOUCHER TEMPLATE  (Payment / Receipt / Journal)
// ─────────────────────────────────────────────────────────────

async function voucherHTML(voucher: AccountingVoucher, opts: PrintOptions): Promise<string> {
  const printConfig = resolvePrintConfig(opts, "voucher");
  const cs = voucher.companySettings || ({} as CompanySettings);
  const vType = (voucher.type || "Journal").toUpperCase();

  const linesHTML = (voucher.lines || [])
    .map(
      (l, i) => `
    <tr>
      <td class="text-center">${i + 1}</td>
      <td>${l.accountName || ""}</td>
      <td>${l.narration || ""}</td>
      <td class="text-right mono">${l.debit > 0 ? "Rs. " + fmtNPR(l.debit) : "—"}</td>
      <td class="text-right mono">${l.credit > 0 ? "Rs. " + fmtNPR(l.credit) : "—"}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${vType} VOUCHER - ${voucher.voucherNo}</title>
<style>
${A4_BASE_CSS}
${buildPageCss(printConfig)}
tfoot td { background: #e8f5e9; font-weight: bold; }
</style>
</head>
<body>
${printBannerHtml(printConfig, "header")}
<div class="company-center" style="margin-bottom:8pt;">
  ${cs.nameNepali ? `<div class="company-name-np">${cs.nameNepali}</div>` : ""}
  <div class="company-name-en">${cs.name || ""}</div>
  <div style="font-size:8pt;">${cs.address || ""}${cs.phone ? " | Ph: " + cs.phone : ""}</div>
  <div style="margin-top:5pt;"><span class="invoice-title">${vType} VOUCHER</span></div>
</div>

<div class="divider"></div>

<div style="display:grid; grid-template-columns:1fr 1fr; gap:6pt; margin:6pt 0;">
  <div>
    <div>Voucher No.: <strong>${voucher.voucherNo}</strong></div>
    <div>Date (BS): <strong>${voucher.dateNepali || "—"}</strong></div>
    <div>Date (AD): ${voucher.date || ""}</div>
  </div>
  <div>
    <div>PAN: ${cs.panNumber || "—"}</div>
  </div>
</div>

<table style="margin-top:8pt;">
  <thead>
    <tr>
      <th style="width:24pt;">#</th>
      <th>Account Name</th>
      <th>Narration</th>
      <th style="width:70pt;">Debit (Rs.)</th>
      <th style="width:70pt;">Credit (Rs.)</th>
    </tr>
  </thead>
  <tbody>${linesHTML}</tbody>
  <tfoot>
    <tr>
      <td></td>
      <td colspan="2" class="text-right bold">TOTAL</td>
      <td class="text-right mono bold">Rs. ${fmtNPR(voucher.totalDebit || 0)}</td>
      <td class="text-right mono bold">Rs. ${fmtNPR(voucher.totalCredit || 0)}</td>
    </tr>
  </tfoot>
</table>

${
  voucher.narration
    ? `
<div style="margin-top:8pt; padding:5pt; border:1px solid #ccc; border-radius:2pt; font-size:8.5pt;">
  <strong>Narration:</strong> ${voucher.narration}
</div>`
    : ""
}

<div class="sig-row" style="margin-top:30pt;">
  <div class="sig-box"><div class="sig-line"></div>Prepared By</div>
  <div class="sig-box"><div class="sig-line"></div>Approved By</div>
</div>

${printBannerHtml(printConfig, "footer")}

<script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// 7.  THERMAL POS RECEIPT  (80mm)
// ─────────────────────────────────────────────────────────────

async function thermalReceiptHTML(invoice: DBInvoice, _opts: PrintOptions): Promise<string> {
  const cs = invoice.companySettings || ({} as CompanySettings);
  const qrSrc = invoice.qrCode || (await buildQR(invoice.cbmsIrn || invoice.invoiceNo, 80));

  const SEP1 = "================================";
  const SEP2 = "--------------------------------";

  const linesHTML = (invoice.lines || [])
    .map((l) => {
      const name = l.itemName || "";
      const qty = String(l.qty);
      const rate = fmtNPR(l.rate, 0);
      const total = fmtNPR(l.totalAmount, 0);
      return `<tr>
      <td style="padding:1pt 2pt;">${name}</td>
      <td style="text-align:center;padding:1pt 2pt;">${qty}</td>
      <td style="text-align:right;padding:1pt 2pt;">${rate}</td>
      <td style="text-align:right;padding:1pt 2pt;">${total}</td>
    </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt - ${invoice.invoiceNo}</title>
<style>
  @page { size: 80mm auto; margin: 2mm 2mm 4mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 8pt;
    color: #000;
    width: 76mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @media print {
    body { width: 76mm; }
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .sep { font-size: 7pt; letter-spacing: -0.5px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1pt 2pt; vertical-align: top; }
  .col-item { width: 44%; }
  .col-qty { width: 12%; }
  .col-rate { width: 22%; }
  .col-total { width: 22%; }
  .total-row { display: flex; justify-content: space-between; padding: 1pt 0; font-size: 8pt; }
  .grand-row { display: flex; justify-content: space-between; padding: 2pt 0; font-weight: bold; font-size: 9.5pt; border-top: 1px solid #000; border-bottom: 1px solid #000; margin: 2pt 0; }
  .qr-center { text-align: center; margin: 4pt 0; }
  .thankyou { text-align: center; font-size: 9pt; font-weight: bold; margin: 4pt 0; }
</style>
</head>
<body>
<div class="center bold" style="font-size:11pt;">${cs.name || "Company"}</div>
${cs.nameNepali ? `<div class="center" style="font-size:9pt;">${cs.nameNepali}</div>` : ""}
<div class="center" style="font-size:7.5pt;">${cs.address || ""}</div>
${cs.phone ? `<div class="center" style="font-size:7.5pt;">Ph: ${cs.phone}</div>` : ""}
<div class="center" style="font-size:7.5pt;">PAN: ${cs.panNumber || "—"} | VAT: ${cs.vatNumber || "—"}</div>

<div class="center sep">${SEP1}</div>

<div style="font-size:7.5pt;">Date (BS): ${invoice.dateNepali || "—"} | ${invoice.date || ""}</div>
<div style="font-size:7.5pt;">Receipt No.: <strong>${invoice.invoiceNo}</strong></div>
${invoice.partyName ? `<div style="font-size:7.5pt;">Customer: ${invoice.partyName}</div>` : ""}

<div class="center sep">${SEP2}</div>

<table>
  <thead>
    <tr>
      <td class="col-item bold">Item</td>
      <td class="col-qty bold" style="text-align:center;">Qty</td>
      <td class="col-rate bold" style="text-align:right;">Rate</td>
      <td class="col-total bold" style="text-align:right;">Total</td>
    </tr>
  </thead>
  <tbody>${linesHTML}</tbody>
</table>

<div class="center sep">${SEP2}</div>

<div class="total-row"><span>Taxable:</span><span>Rs. ${fmtNPR(invoice.taxableAmount)}</span></div>
${
  (invoice.exemptAmount || 0) > 0
    ? `<div class="total-row"><span>Exempt:</span><span>Rs. ${fmtNPR(invoice.exemptAmount || 0)}</span></div>`
    : ""
}
<div class="total-row"><span>VAT 13%:</span><span>Rs. ${fmtNPR(invoice.vatAmount)}</span></div>
<div class="grand-row"><span>GRAND TOTAL:</span><span>Rs. ${fmtNPR(invoice.grandTotal)}</span></div>

<div style="font-size:7.5pt; font-style:italic; margin:3pt 0;">
  ${amountInWords(invoice.grandTotal)}
</div>

<div class="center sep">${SEP1}</div>

${qrSrc ? `<div class="qr-center"><img src="${qrSrc}" style="width:60pt;height:60pt;" alt="QR" /></div>` : ""}

${
  invoice.cbmsIrn
    ? `<div class="center" style="font-size:7pt; word-break:break-all;">IRN: ${invoice.cbmsIrn}</div>
<div class="center" style="font-size:7pt;">cbms.ird.gov.np</div>`
    : ""
}

<div class="center sep">${SEP1}</div>
<div class="thankyou">Thank you! Come again.</div>
<div class="center" style="font-size:7pt; margin-top:3pt;">Goods once sold will not be taken back.</div>

<script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// 8.  PURCHASE INVOICE / VOUCHER (A4)
// ─────────────────────────────────────────────────────────────

async function purchaseVoucherHTML(invoice: DBInvoice, opts: PrintOptions): Promise<string> {
  // Re-uses tax invoice template but with "PURCHASE INVOICE" title
  const modified = {
    ...invoice,
    companySettings: invoice.companySettings,
    status: invoice.status,
  };
  const html = await taxInvoiceHTML(modified, opts, false);
  return html
    .replace("TAX INVOICE / कर चलान", "PURCHASE INVOICE / खरिद बिल")
    .replace("<title>Tax Invoice", "<title>Purchase Invoice");
}

// ─────────────────────────────────────────────────────────────
// 9.  MAIN  printDocument()  ENTRY POINT
// ─────────────────────────────────────────────────────────────

export async function printDocument(
  type: PrintDocumentType,
  data: DBInvoice | DeliveryChallan | AccountingVoucher,
  options: PrintOptions = {},
): Promise<void> {
  let html = "";

  switch (type) {
    case "tax-invoice":
      html = await taxInvoiceHTML(data as DBInvoice, options, false);
      break;
    case "simplified-invoice":
      html = await taxInvoiceHTML(data as DBInvoice, options, true);
      break;
    case "purchase-voucher":
      html = await purchaseVoucherHTML(data as DBInvoice, options);
      break;
    case "delivery-challan":
      html = await deliveryChallanHTML(data as DeliveryChallan, options);
      break;
    case "thermal-receipt":
      html = await thermalReceiptHTML(data as DBInvoice, options);
      break;
    case "voucher":
      html = await voucherHTML(data as AccountingVoucher, options);
      break;
    case "payslip":
      // Stub – extend with payslip template as needed
      html = await voucherHTML(data as AccountingVoucher, options);
      break;
    default:
      console.warn("printDocument: unknown type", type);
      return;
  }

  const copies = options.copies || 1;

  if (options.emailAsPdf) {
    // Hint to browser: use "Save as PDF" destination
    // Just open the window — user can choose Print → PDF
  }

  for (let c = 0; c < copies; c++) {
    const popup = window.open(
      "",
      "_blank",
      "width=960,height=720,scrollbars=yes,menubar=no,toolbar=no",
    );
    if (!popup) {
      alert("Please allow popups for this page to enable printing.");
      return;
    }
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }
}

// ─────────────────────────────────────────────────────────────
// 10.  BACKWARD-COMPAT  jsPDF LEGACY EXPORTS
//      (existing callers import these — keep signatures intact)
// ─────────────────────────────────────────────────────────────

export async function generateInvoicePDF(
  invoice: any,
  companySettings: any,
  party: any,
  _items?: any[],
): Promise<Blob> {
  // Delegate to new HTML print system and return a dummy blob so
  // callers that do URL.createObjectURL() still get something,
  // while also opening the proper print dialog.
  const inv: DBInvoice = {
    invoiceNo: invoice.invoiceNo || "",
    date: invoice.date || "",
    dateNepali: invoice.dateNepali || "",
    partyName: party?.name || invoice.partyName || "",
    partyPan: party?.pan || invoice.partyPan || "",
    partyAddress: party?.address || invoice.partyAddress || "",
    partyVatNo: party?.vatNo || invoice.partyVatNo || "",
    lines: (invoice.lines || []).map((l: any) => ({
      itemName: l.itemName || "",
      hsnCode: l.hsnCode || "",
      unit: l.unit || "Pcs",
      qty: Number(l.qty) || 0,
      rate: Number(l.rate) || 0,
      discountPct: Number(l.discountPercent || l.discountPct) || 0,
      taxableAmount: Number(l.taxableAmount || l.netAmount) || 0,
      vatRate: Number(l.vatRate) || 13,
      vatAmount: Number(l.vatAmount) || 0,
      totalAmount: Number(l.totalAmount || l.netAmount) || 0,
    })),
    subTotal: Number(invoice.subTotal) || 0,
    discountAmount: Number(invoice.discountAmount) || 0,
    taxableAmount: Number(invoice.taxableAmount) || 0,
    exemptAmount: Number(invoice.exemptAmount) || 0,
    vatAmount: Number(invoice.vatAmount) || 0,
    grandTotal: Number(invoice.grandTotal) || 0,
    cbmsIrn: invoice.cbmsIrn || "",
    status: invoice.status || "ACTIVE",
    companySettings: {
      name: companySettings?.companyNameEn || companySettings?.name || "",
      nameNepali: companySettings?.companyNameNp || companySettings?.nameNepali || "",
      address: companySettings?.address || "",
      panNumber: companySettings?.panNumber || "",
      vatNumber: companySettings?.vatNumber || "",
      phone: companySettings?.phone || "",
      email: companySettings?.email || "",
      logo: companySettings?.logo || "",
    },
  };
  await printDocument("tax-invoice", inv, {
    printConfig: mergeSystemConfiguration(companySettings?.systemConfiguration).invoicePrint,
  });
  // Return a minimal valid Blob so existing code doesn't crash
  return new Blob([""], { type: "application/pdf" });
}

export function generateVoucherPDF(voucher: any, companySettings: any, _accounts?: any[]): Blob {
  const v: AccountingVoucher = {
    voucherNo: voucher.voucherNo || "",
    type: voucher.type || "Journal",
    date: voucher.date || "",
    dateNepali: voucher.dateNepali || "",
    narration: voucher.narration || "",
    totalDebit: Number(voucher.totalDebit) || 0,
    totalCredit: Number(voucher.totalCredit) || 0,
    lines: (voucher.lines || []).map((l: any) => ({
      accountName: l.accountName || "",
      narration: l.narration || "",
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
    })),
    companySettings: {
      name: companySettings?.companyNameEn || companySettings?.name || "",
      nameNepali: companySettings?.nameNepali || "",
      address: companySettings?.address || "",
      panNumber: companySettings?.panNumber || "",
    },
  };
  // Fire-and-forget (can't await in sync function)
  printDocument("voucher", v, {
    printConfig: mergeSystemConfiguration(companySettings?.systemConfiguration).voucherPrint,
  }).catch(console.error);
  return new Blob([""], { type: "application/pdf" });
}

export function generatePartyStatementPDF(
  party: any,
  statement: any,
  companySettings: any,
  options?: { startDate?: string; endDate?: string },
): Blob {
  // Build a synthetic voucher-style document for the statement
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const companyName = companySettings?.companyNameEn || companySettings?.name || "Company";
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, pageW / 2, 15, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(companySettings?.address || "", pageW / 2, 21, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("PARTY LEDGER STATEMENT", pageW / 2, 30, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Party: ${party?.name || ""}`, 14, 40);
  if (options?.startDate) {
    doc.text(`Period: ${options.startDate} to ${options.endDate || ""}`, 14, 46);
  }

  const rows = (statement?.rows || []).map((r: any) => [
    r.date || "",
    r.voucherNo || "",
    r.narration || "",
    r.debit > 0 ? "Rs. " + formatNumber(r.debit) : "—",
    r.credit > 0 ? "Rs. " + formatNumber(r.credit) : "—",
    "Rs. " + formatNumber(r.balance),
  ]);

  autoTable(doc, {
    startY: 52,
    head: [["Date", "Voucher No", "Narration", "Debit", "Credit", "Balance"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [30, 92, 30], textColor: 255, fontSize: 7 },
    bodyStyles: { fontSize: 7 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Closing Balance: Rs. ${formatNumber(statement?.closingBalance || 0)}`, 14, finalY + 8);

  return doc.output("blob");
}
