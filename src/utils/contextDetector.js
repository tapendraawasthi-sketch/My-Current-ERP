/**
 * Given the current screen name and document object from AppContext,
 * returns a context descriptor used by Export, Print, Share menus.
 */
export function detectCurrentContext(currentScreen, currentDocument) {
  const ctx = {
    screenName: currentScreen || 'dashboard',
    label: 'Current Screen',
    documentType: null,   // 'voucher' | 'report' | 'master' | null
    documentId: null,
    documentName: null,
    exportDefaultFormat: 'pdf',
    printable: false,
    shareable: false,
    exportable: false,
  };

  if (!currentScreen) return ctx;

  const screen = currentScreen.toLowerCase();

  // Voucher screens
  const voucherScreens = ['salesvoucher', 'purchasevoucher', 'paymentvoucher',
    'receiptvoucher', 'journalvoucher', 'contravoucher', 'debitnote', 'creditnote',
    'stockjournal', 'payrollvoucher'];

  // Report screens
  const reportScreens = ['balancesheet', 'profitloss', 'trialbalance', 'daybook',
    'cashbook', 'bankbook', 'ledger', 'salesregister', 'purchaseregister',
    'stocksummary', 'gstreport', 'vatreport', 'payrollreport', 'cashflow', 'fundflow'];

  if (voucherScreens.includes(screen)) {
    ctx.documentType = 'voucher';
    ctx.label = currentDocument?.name || 'Current Voucher';
    ctx.documentId = currentDocument?.id;
    ctx.documentName = currentDocument?.name;
    ctx.exportDefaultFormat = 'pdf';
    ctx.printable = true;
    ctx.shareable = true;
    ctx.exportable = true;
  } else if (reportScreens.includes(screen)) {
    ctx.documentType = 'report';
    ctx.label = SCREEN_LABELS[screen] || currentScreen;
    ctx.documentId = currentDocument?.id;
    ctx.documentName = SCREEN_LABELS[screen] || currentScreen;
    ctx.exportDefaultFormat = 'xlsx';
    ctx.printable = true;
    ctx.shareable = true;
    ctx.exportable = true;
  }

  return ctx;
}

const SCREEN_LABELS = {
  balancesheet: 'Balance Sheet',
  profitloss: 'Profit & Loss',
  trialbalance: 'Trial Balance',
  daybook: 'Day Book',
  cashbook: 'Cash Book',
  bankbook: 'Bank Book',
  ledger: 'Ledger',
  salesregister: 'Sales Register',
  purchaseregister: 'Purchase Register',
  stocksummary: 'Stock Summary',
  gstreport: 'GST Report',
  vatreport: 'VAT Report',
  payrollreport: 'Payroll Report',
  cashflow: 'Cash Flow',
  fundflow: 'Fund Flow',
};

export function getScreenLabel(screenName) {
  return SCREEN_LABELS[screenName?.toLowerCase()] || screenName || 'Dashboard';
}
