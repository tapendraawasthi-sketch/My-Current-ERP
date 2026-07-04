import React from "react";

export const FS_NAVY = "#002D56";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getOrdinal(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatAsAtDate(dateStr: string): string {
  const d = parseDate(dateStr);
  if (!d) return dateStr ? `As at ${dateStr}` : "";
  return `As at ${getOrdinal(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatPeriodRange(fromDate: string, toDate: string): string {
  const from = parseDate(fromDate);
  const to = parseDate(toDate);
  if (!from || !to) return `For the period ${fromDate} to ${toDate}`;
  return `For the period ${getOrdinal(from.getDate())} ${MONTHS[from.getMonth()]} ${from.getFullYear()} to ${getOrdinal(to.getDate())} ${MONTHS[to.getMonth()]} ${to.getFullYear()}`;
}

interface FinancialStatementHeaderProps {
  companyName: string;
  companyNameNepali?: string;
  address?: string;
  pan?: string;
  reportTitle: string;
  reportSubtitle?: string;
  asAt?: string;
  period?: string;
  /** Show on screen as well as print (default: always visible) */
  screenMode?: "always" | "print-only";
}

export function FinancialStatementHeader({
  companyName,
  companyNameNepali,
  address,
  pan,
  reportTitle,
  reportSubtitle,
  asAt,
  period,
  screenMode = "always",
}: FinancialStatementHeaderProps) {
  const visibility = screenMode === "print-only" ? "print-only hidden" : "";

  return (
    <div className={`fs-report-header ${visibility}`}>
      <div className="fs-report-header__currency">(Amount in ₹)</div>
      <div className="fs-report-header__company">{companyName}</div>
      {companyNameNepali && companyNameNepali !== companyName && (
        <div className="fs-report-header__company-ne">{companyNameNepali}</div>
      )}
      {address && <div className="fs-report-header__address">{address}</div>}
      {pan && (
        <div className="fs-report-header__meta">
          <span>PAN/VAT: {pan}</span>
        </div>
      )}
      <div className="fs-report-header__title">{reportTitle}</div>
      {reportSubtitle && <div className="fs-report-header__subtitle">{reportSubtitle}</div>}
      {(asAt || period) && <div className="fs-report-header__period">{asAt || period}</div>}
    </div>
  );
}

interface FinancialStatementFooterProps {
  screenMode?: "always" | "print-only";
  showSignatures?: boolean;
  showPolicyNote?: boolean;
}

export function FinancialStatementFooter({
  screenMode = "print-only",
  showSignatures = true,
  showPolicyNote = true,
}: FinancialStatementFooterProps) {
  const visibility = screenMode === "print-only" ? "print-only hidden" : "";

  return (
    <div className={`fs-report-footer ${visibility}`}>
      {showPolicyNote && (
        <div className="fs-report-footer__policy">
          <p>
            Summary of Significant Accounting Policies and Notes to the Financial Statements form an
            integral part of these financial statements.
          </p>
          <p className="fs-report-footer__disclaimer">
            The accompanying notes are an integral part of the financial statements.
          </p>
        </div>
      )}

      {showSignatures && (
        <div className="fs-report-footer__signatures">
          <div className="fs-signature-block">
            <div className="fs-signature-block__title">For and on behalf of the Board</div>
            <div className="fs-signature-line" />
            <div className="fs-signature-label">Director</div>
            <div className="fs-signature-line" />
            <div className="fs-signature-label">Director</div>
            <div className="fs-signature-line" />
            <div className="fs-signature-label">Company Secretary</div>
            <div className="fs-signature-meta">
              <span>Place: _______________</span>
              <span>Date: _______________</span>
            </div>
          </div>
          <div className="fs-signature-block">
            <div className="fs-signature-block__title">Auditor&apos;s Report</div>
            <div className="fs-signature-line" />
            <div className="fs-signature-label">Chartered Accountant</div>
            <div className="fs-signature-meta">
              <span>Firm Reg. No.: _______________</span>
              <span>Membership No.: _______________</span>
            </div>
            <div className="fs-signature-meta">
              <span>Place: _______________</span>
              <span>Date: _______________</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface FinancialStatementShellProps {
  children: React.ReactNode;
  className?: string;
}

export function FinancialStatementShell({
  children,
  className = "",
}: FinancialStatementShellProps) {
  return <div className={`fs-report ${className}`.trim()}>{children}</div>;
}

/** Shared class names for statutory table styling */
export const fsClasses = {
  table: "fs-table",
  thead: "fs-thead",
  theadCell: "fs-thead-cell",
  cell: "fs-cell",
  cellParticulars: "fs-cell-particulars",
  cellNote: "fs-cell-note",
  cellAmount: "fs-cell-amount",
  sectionHead: "fs-section-head",
  subtotalRow: "fs-subtotal-row",
  grandTotalRow: "fs-grand-total-row",
  rowHover: "fs-row-hover",
  rowGroup: "fs-row-group",
  rowLedger: "fs-row-ledger",
  tformatGrid: "fs-tformat-grid",
  tformatCol: "fs-tformat-col",
  unifiedThead: "fs-unified-thead",
} as const;
