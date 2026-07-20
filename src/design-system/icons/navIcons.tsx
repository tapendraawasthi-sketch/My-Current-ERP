/**
 * Premium communicative nav icons for Orbix ERP shell.
 * Accounting metaphors (ledger, invoice, stock, bank, VAT) — not generic Lucide fillers.
 */
import * as React from "react";

export type NavIconProps = React.SVGProps<SVGSVGElement> & { title?: string };
export type NavIcon = React.FC<NavIconProps>;

function icon(props: NavIconProps, paths: React.ReactNode) {
  const { title, className, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {paths}
    </svg>
  );
}

/* ── Module roots (left bar) ─────────────────────────────────────────── */

export const NavHomeIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      {/* Home roof + door — not a dashboard grid */}
      <path d="M3 11L12 3l9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>,
  );

export const NavOrbixIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" />
      <path d="M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </>,
  );

export const NavSalesIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M7 3h7l3 3v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 15.5h4" />
      <path d="M16 18l2-2 1.5 1.5" />
    </>,
  );

export const NavPurchasesIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M3 6h2l2.2 9.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.75L20 8H7" />
      <circle cx="10" cy="20" r="1.2" />
      <circle cx="17" cy="20" r="1.2" />
      <path d="M14 4v5M11.5 6.5H16.5" />
    </>,
  );

export const NavBankingIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M3 10l9-6 9 6" />
      <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" />
      <path d="M4 18h16" />
      <path d="M3 21h18" />
    </>,
  );

export const NavInventoryIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M4 8l8-4 8 4-8 4-8-4z" />
      <path d="M4 8v8l8 4 8-4V8" />
      <path d="M12 12v8" />
      <path d="M8 10.2l8 4" />
    </>,
  );

export const NavAccountingIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M5 3h11a1 1 0 0 1 1 1v16l-3-1.5L11 20l-3-1.5L5 20V4a1 1 0 0 1 1-1z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </>,
  );

export const NavReportsIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M4 19h16" />
      <path d="M7 16V10" />
      <path d="M12 16V6" />
      <path d="M17 16v-4" />
      <path d="M5 8l5-3 4 2 5-3" />
    </>,
  );

export const NavComplianceIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M12 3l7 3v5c0 4.5-2.8 7.8-7 9-4.2-1.2-7-4.5-7-9V6l7-3z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </>,
  );

export const NavAdminIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21" />
      <path d="M5.8 5.8l1.6 1.6M16.6 16.6l1.6 1.6M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6" />
      <path d="M16.5 8.5h3.5v3" />
    </>,
  );

/* ── Sales / purchase documents ──────────────────────────────────────── */

export const NavSalesInvoiceIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M7 3h8l3 3v15H7V3z" />
      <path d="M15 3v4h4" />
      <path d="M9.5 11h5M9.5 14h3.5" />
      <path d="M15.5 17.5l2-2 .5 2.5-2-.5z" />
    </>,
  );

export const NavPurchaseInvoiceIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M7 3h8l3 3v15H7V3z" />
      <path d="M15 3v4h4" />
      <path d="M9.5 12h5" />
      <path d="M12 9.5v5M9.5 12H14.5" />
    </>,
  );

export const NavSalesReturnIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M7 3h8l3 3v7" />
      <path d="M15 3v4h4" />
      <path d="M9 10h4" />
      <path d="M16 20a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      <path d="M14.5 15.5H17v2.5" />
    </>,
  );

export const NavPurchaseReturnIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M7 3h8l3 3v6" />
      <path d="M15 3v4h4" />
      <path d="M9.5 11H14" />
      <path d="M16 20a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      <path d="M17.5 16.5H15V14" />
    </>,
  );

export const NavOrderIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M8 4h9l2 2v14H6V6l2-2z" />
      <path d="M9 9h7M9 12.5h7M9 16h4" />
      <path d="M8 4l1 3h8l1-3" />
    </>,
  );

export const NavDeliveryIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M3 14h11V8H3v6z" />
      <path d="M14 11h3.5l2.5 3v3H14v-6z" />
      <circle cx="7" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
      <path d="M3 11h11" />
    </>,
  );

export const NavGoodsReceiptIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M4 7l8-3 8 3v4l-8 3-8-3V7z" />
      <path d="M4 11v6l8 3 8-3v-6" />
      <path d="M12 10v7" />
      <path d="M9.5 13.5l2.5 2 3.5-3.5" />
    </>,
  );

export const NavRegisterIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      {/* Tabular register with row markers */}
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 8h18M3 12h18M3 16h18" />
      <path d="M8 4v16" />
      <circle cx="5.5" cy="10" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="14" r="0.7" fill="currentColor" stroke="none" />
    </>,
  );

export const NavPartiesIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <circle cx="9" cy="8" r="2.5" />
      <path d="M3.5 18c.4-2.8 2.4-4.5 5.5-4.5s5.1 1.7 5.5 4.5" />
      <circle cx="17" cy="9" r="2" />
      <path d="M14 18c.3-1.8 1.5-3 3-3 1.4 0 2.5 1 2.9 2.5" />
    </>,
  );

/* ── Banking ─────────────────────────────────────────────────────────── */

export const NavReceiveMoneyIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      {/* Inbound cash — wallet + arrow down into it */}
      <path d="M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9z" />
      <path d="M4 10V8.5A1.5 1.5 0 0 1 5.5 7H18" />
      <path d="M12 3v6" />
      <path d="M9 6.5L12 9.5 15 6.5" />
      <circle cx="15.5" cy="14.5" r="1.25" />
    </>,
  );

export const NavPayMoneyIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      {/* Outbound cash — wallet + arrow up out */}
      <path d="M4 5h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z" />
      <path d="M4 14v1.5A1.5 1.5 0 0 0 5.5 17H18" />
      <path d="M12 21v-6" />
      <path d="M9 17.5L12 14.5 15 17.5" />
      <circle cx="15.5" cy="9.5" r="1.25" />
    </>,
  );

export const NavContraIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M4 9h11" />
      <path d="M12 6l3 3-3 3" />
      <path d="M20 15H9" />
      <path d="M12 12l-3 3 3 3" />
      <rect x="3" y="7" width="4" height="4" rx="0.5" />
      <rect x="17" y="13" width="4" height="4" rx="0.5" />
    </>,
  );

export const NavBankRecoIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      {/* Book vs bank strip with match tick */}
      <path d="M3 6h8v12H3z" />
      <path d="M5 9h4M5 12h4M5 15h2.5" />
      <path d="M13 8h8v3H13z" />
      <path d="M13 13h8v3H13z" />
      <path d="M15 18.5l1.5 1.5 3-3" />
    </>,
  );

export const NavBankImportIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M12 3v10" />
      <path d="M8.5 9.5L12 13l3.5-3.5" />
      <path d="M5 15v4h14v-4" />
      <path d="M8 18h8" />
    </>,
  );

export const NavChequeIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
      <path d="M3 10h18" />
      <path d="M6 14h5M14 14h4" />
      <path d="M17 6V4.5" />
    </>,
  );

export const NavChequePrintIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M7 9V5h10v4" />
      <rect x="4" y="9" width="16" height="8" rx="1" />
      <path d="M7 17h10v3H7v-3z" />
      <path d="M8 12h4" />
    </>,
  );

export const NavPdcIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <rect x="3" y="7" width="18" height="11" rx="1.5" />
      <path d="M7 12h4M14 12h3" />
      <path d="M8 3v3M16 3v3" />
      <path d="M3 11h18" />
    </>,
  );

export const NavPosIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M8 7h8M8 10.5h8M8 14h5" />
      <path d="M9 18h6" />
    </>,
  );

/* ── Inventory leaves ────────────────────────────────────────────────── */

export const NavItemMasterIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M5 8l7-3 7 3-7 3-7-3z" />
      <path d="M5 8v7l7 3 7-3V8" />
      <path d="M9 14h2v2H9z" />
    </>,
  );

export const NavItemGroupsIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <rect x="3" y="4" width="7" height="7" rx="1" />
      <rect x="14" y="4" width="7" height="7" rx="1" />
      <rect x="3" y="13" width="7" height="7" rx="1" />
      <rect x="14" y="13" width="7" height="7" rx="1" />
    </>,
  );

export const NavStockSummaryIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M4 19h16" />
      <path d="M6 16V11" />
      <path d="M11 16V7" />
      <path d="M16 16v-3" />
      <path d="M19 16V9" />
      <path d="M4 8h3l2 3h4" />
    </>,
  );

export const NavStockLedgerIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M5 4h11v16H5z" />
      <path d="M16 7h3v13H8" />
      <path d="M8 9h5M8 12h5M8 15h3" />
    </>,
  );

export const NavStockTransferIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M3 8h10" />
      <path d="M10 5l3 3-3 3" />
      <path d="M21 16H11" />
      <path d="M14 13l-3 3 3 3" />
      <path d="M5 14l2 2-2 2" />
      <path d="M19 6l-2 2 2 2" />
    </>,
  );

export const NavStockJournalIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M6 3h9l3 3v15H6V3z" />
      <path d="M15 3v4h4" />
      <path d="M9 11h2.5M9 14.5h5" />
      <path d="M14 10v6" />
    </>,
  );

export const NavPhysicalStockIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M4 7h16v12H4z" />
      <path d="M8 7V5h8v2" />
      <path d="M8 12h3M8 15h6" />
      <path d="M15.5 11.5l1.5 1.5 2.5-2.5" />
    </>,
  );

export const NavJobWorkIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M3 18h18" />
      <path d="M5 18V10l4-3 3 2 4-3 3 3v9" />
      <path d="M9 18v-4h4v4" />
    </>,
  );

export const NavBatchIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <rect x="3" y="5" width="6" height="14" rx="1" />
      <rect x="11" y="5" width="6" height="14" rx="1" />
      <path d="M19 8v10" />
      <path d="M5 9h2M13 9h2M5 13h2M13 13h2" />
    </>,
  );

export const NavWarehouseIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M3 10l9-6 9 6v10H3V10z" />
      <path d="M9 20v-6h6v6" />
      <path d="M3 10h18" />
    </>,
  );

/* ── Accounting leaves ───────────────────────────────────────────────── */

export const NavJournalIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      {/* Two-column journal (Dr | Cr) */}
      <path d="M5 3h14v18H5z" />
      <path d="M12 3v18" />
      <path d="M7 8h3M7 12h3M7 16h2" />
      <path d="M14 8h3M14 12h3M14 16h2" />
    </>,
  );

export const NavVoucherIndexIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M6 4h9l3 3v13H6V4z" />
      <path d="M15 4v4h4" />
      <path d="M9 11h6M9 14h6M9 17h3" />
      <circle cx="17" cy="17" r="2.5" />
      <path d="M17 15.8v2.4" />
    </>,
  );

export const NavDebitNoteIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M7 3h8l3 3v15H7V3z" />
      <path d="M15 3v4h4" />
      <path d="M10 12h5" />
      <path d="M12.5 9.5v5" />
      <path d="M9 18h3" />
    </>,
  );

export const NavCreditNoteIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M7 3h8l3 3v15H7V3z" />
      <path d="M15 3v4h4" />
      <path d="M10 12.5h5" />
      <path d="M9 18h3" />
    </>,
  );

export const NavChartOfAccountsIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      {/* Hierarchy tree — account groups */}
      <path d="M12 4v4" />
      <rect x="8" y="2" width="8" height="3.5" rx="0.5" />
      <path d="M6 12h12" />
      <path d="M6 12V10M12 12V8M18 12V10" />
      <rect x="3" y="12" width="6" height="3.5" rx="0.5" />
      <rect x="9" y="12" width="6" height="3.5" rx="0.5" />
      <rect x="15" y="12" width="6" height="3.5" rx="0.5" />
      <path d="M6 18H4v-2.5M12 18H10v-2.5M18 18h-2v-2.5" />
    </>,
  );

export const NavDayBookIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      {/* Calendar-day ledger — dated daily book */}
      <rect x="3" y="5" width="18" height="15" rx="1.5" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
      <path d="M7 14h2v2H7z" fill="currentColor" stroke="none" />
      <path d="M11 14h5M11 17h3" />
    </>,
  );

export const NavGeneralLedgerIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M6 3h10v18H6z" />
      <path d="M16 6h2.5v15H9" />
      <path d="M9 8h4M9 11h4M9 14h2.5" />
      <path d="M9 17h5" />
    </>,
  );

export const NavCostCenterIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v3M12 17v3M4 12h3M17 12h3" />
    </>,
  );

export const NavNarrationIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M5 5h14v10H9l-4 3V5z" />
      <path d="M9 9h6M9 12h4" />
    </>,
  );

export const NavBillSundryIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M6 4h9l3 3v13H6V4z" />
      <path d="M15 4v4h4" />
      <path d="M9 12h6" />
      <path d="M9 15h3.5" />
      <path d="M14.5 15l2 2 2-3" />
    </>,
  );

export const NavUnitsIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M4 18h16" />
      <path d="M7 18V9l5-4 5 4v9" />
      <path d="M10 18v-5h4v5" />
      <path d="M9 11h6" />
    </>,
  );

export const NavPriceListIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M5 4h9l5 5v11H5V4z" />
      <path d="M14 4v5h5" />
      <path d="M9 12h2.5a2 2 0 1 1 0 4H9v2h4" />
      <path d="M9 12v6" />
    </>,
  );

export const NavBudgetIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <rect x="3" y="6" width="18" height="13" rx="1.5" />
      <path d="M3 11h18" />
      <path d="M8 3v4M16 3v4" />
      <path d="M8 15h3M13 15h3" />
    </>,
  );

export const NavFixedAssetsIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M4 20h16" />
      <path d="M6 20V9l6-5 6 5v11" />
      <path d="M10 20v-5h4v5" />
      <path d="M9 12h6" />
    </>,
  );

export const NavFiscalYearIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <rect x="3" y="5" width="18" height="15" rx="1.5" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
      <path d="M8 14h3M13 14h3M8 17h2" />
    </>,
  );

/* ── Reports ─────────────────────────────────────────────────────────── */

export const NavTrialBalanceIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      {/* Equal Dr/Cr columns — not justice scales */}
      <path d="M4 5h7v14H4z" />
      <path d="M13 5h7v14h-7z" />
      <path d="M6 9h3M6 12h3M6 15h2" />
      <path d="M15 9h3M15 12h3M15 15h2" />
      <path d="M11 12h2" />
    </>,
  );

export const NavProfitLossIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M4 18h16" />
      <path d="M5 14l4-5 3 3 5-7" />
      <path d="M14 5h4v4" />
    </>,
  );

export const NavBalanceSheetIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M4 19h16" />
      <path d="M6 19V9h5v10" />
      <path d="M13 19V6h5v13" />
      <path d="M6 12h5M13 10h5" />
    </>,
  );

export const NavCashFlowIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M4 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" />
      <path d="M4 17c2-4 4-4 6 0s4 4 6 0 4-4 6 0" />
      <path d="M12 4v3" />
    </>,
  );

export const NavPartyStatementIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M3.5 18c.5-2.5 2.2-4 4.5-4s4 1.5 4.5 4" />
      <path d="M14 7h6M14 11h6M14 15h4" />
    </>,
  );

export const NavReceivablesIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
      <path d="M16 5.5l2-1.5M18.5 7l1.5-1" />
    </>,
  );

export const NavPayablesIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
      <path d="M8 18.5l-2 1.5M5.5 17l-1.5 1" />
    </>,
  );

export const NavAgingIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <rect x="3" y="5" width="18" height="15" rx="1.5" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
      <path d="M7 14h2M11 14h2M15 14h2" />
      <path d="M7 17h2M11 17h2" />
    </>,
  );

export const NavBudgetVsActualIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M4 19h16" />
      <path d="M7 16V9" />
      <path d="M12 16V6" />
      <path d="M17 16v-4" />
      <path d="M6 9h2M11 6h2M16 12h2" opacity={0.5} strokeDasharray="2 2" />
    </>,
  );

export const NavBranchReportsIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M4 20h16" />
      <path d="M6 20V10h5v10" />
      <path d="M13 20V7h5v13" />
      <path d="M8 13h1M8 16h1M15 11h1M15 14h1M15 17h1" />
    </>,
  );

export const NavSalesAnalysisIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M4 19h16" />
      <path d="M5 15l4-4 3 2 5-6" />
      <circle cx="9" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </>,
  );

export const NavRatiosIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 8 8H12V4z" />
      <path d="M12 12l5.5 5.5" />
    </>,
  );

export const NavFinancialDashIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="5" rx="1" />
      <rect x="13" y="10" width="8" height="11" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
    </>,
  );

/* ── Compliance ──────────────────────────────────────────────────────── */

export const NavVatIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M6 4h9l3 3v13H6V4z" />
      <path d="M15 4v4h4" />
      <path d="M9 12h2l1.5 4L15 12h2" />
    </>,
  );

export const NavTdsIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M6 4h9l3 3v13H6V4z" />
      <path d="M15 4v4h4" />
      <path d="M9 12h6M12 12v5" />
      <path d="M9 17h6" />
    </>,
  );

export const NavStatutoryIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M12 3l7 3v5c0 4.2-2.6 7.4-7 8.8C7.6 18.4 5 15.2 5 11V6l7-3z" />
      <path d="M9 11h6M12 8v6" />
    </>,
  );

export const NavAuditLogIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M8 4h8v4H8z" />
      <path d="M6 8h12v12H6z" />
      <path d="M9 12h6M9 15h4" />
      <path d="M16 18l1.5-1.5" />
      <circle cx="15.5" cy="16" r="2" />
    </>,
  );

/* ── Administration ──────────────────────────────────────────────────── */

export const NavSettingsIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2" />
      <path d="M5.8 5.8l1.4 1.4M16.8 16.8l1.4 1.4M18.2 5.8l-1.4 1.4M7.2 16.8l-1.4 1.4" />
    </>,
  );

export const NavCompanyFeaturesIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 12h5M8 15h6" />
      <path d="M16 14l1.5 1.5L20 13" />
    </>,
  );

export const NavUsersIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <circle cx="9" cy="8" r="2.5" />
      <path d="M3.5 18c.4-2.6 2.3-4.2 5.5-4.2S14.1 15.4 14.5 18" />
      <circle cx="17" cy="9" r="2" />
      <path d="M15.5 14.5c1.3.3 2.3 1.2 2.7 2.5" />
      <path d="M17 12v2.5M15.5 13.5H18.5" />
    </>,
  );

export const NavBranchesIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M12 3v6" />
      <circle cx="12" cy="11" r="2" />
      <path d="M6 21V14l6-3 6 3v7" />
      <path d="M9 21v-4h6v4" />
    </>,
  );

export const NavPrintSettingsIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M7 8V4h10v4" />
      <rect x="4" y="8" width="16" height="8" rx="1" />
      <path d="M7 16h10v4H7v-4z" />
      <circle cx="17" cy="12" r="1" fill="currentColor" stroke="none" />
    </>,
  );

export const NavConfigHubIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <circle cx="17.5" cy="17.5" r="3" />
      <path d="M17.5 15.5v4M15.5 17.5h4" />
    </>,
  );

export const NavAccountsConfigIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M5 4h11v16H5z" />
      <path d="M9 9h4M9 12h4" />
      <circle cx="17" cy="16" r="3.5" />
      <path d="M17 14.2v3.6M15.2 16h3.6" />
    </>,
  );

export const NavInventoryConfigIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M4 8l8-3 8 3-8 3-8-3z" />
      <path d="M4 8v5l8 3 5-2" />
      <circle cx="17.5" cy="16.5" r="3.5" />
      <path d="M17.5 14.7v3.6M15.7 16.5h3.6" />
    </>,
  );

export const NavBackupIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M8 18H6a3 3 0 0 1 0-6h.5A5.5 5.5 0 0 1 17.5 9 3.5 3.5 0 0 1 18 16h-2" />
      <path d="M12 13v8" />
      <path d="M9 18l3 3 3-3" />
    </>,
  );

export const NavPayrollIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <circle cx="9" cy="8" r="2.5" />
      <path d="M4 18c.4-2.5 2.2-4 5-4s4.6 1.5 5 4" />
      <path d="M15 10h5M17.5 8v5" />
      <path d="M15 16h5" />
    </>,
  );

export const NavRecurringIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M4 12a8 8 0 0 1 13.5-5.5" />
      <path d="M17 4v3h-3" />
      <path d="M20 12a8 8 0 0 1-13.5 5.5" />
      <path d="M7 20v-3h3" />
      <path d="M9 12h3l1.5-2L15 14" />
    </>,
  );

export const NavMessagesIcon: NavIcon = (p) =>
  icon(
    p,
    <>
      <path d="M4 6h16v10H8l-4 3V6z" />
      <path d="M8 10h8M8 13h5" />
    </>,
  );
