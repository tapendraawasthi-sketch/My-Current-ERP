import { useMemo } from "react";
import { useStore } from "@/store/useStore";

export interface TopMenuContext {
  label: string;
  exportEndpoint: string;
  printType: string;
}

const contextMap: Record<string, TopMenuContext> = {
  dashboard: {
    label: "Dashboard",
    exportEndpoint: "/api/export/generic",
    printType: "generic",
  },
  ledger: {
    label: "Ledger Report",
    exportEndpoint: "/api/reports/ledger/export",
    printType: "report",
  },
  "trial-balance": {
    label: "Trial Balance",
    exportEndpoint: "/api/reports/trial-balance/export",
    printType: "report",
  },
  "profit-loss": {
    label: "Profit & Loss",
    exportEndpoint: "/api/reports/profit-loss/export",
    printType: "report",
  },
  "balance-sheet": {
    label: "Balance Sheet",
    exportEndpoint: "/api/reports/balance-sheet/export",
    printType: "report",
  },
  "cash-flow": {
    label: "Cash Flow Statement",
    exportEndpoint: "/api/reports/cash-flow/export",
    printType: "report",
  },
  "sales-register": {
    label: "Sales Register",
    exportEndpoint: "/api/reports/sales-register/export",
    printType: "register",
  },
  "purchase-register": {
    label: "Purchase Register",
    exportEndpoint: "/api/reports/purchase-register/export",
    printType: "register",
  },
  items: {
    label: "Stock Book",
    exportEndpoint: "/api/reports/stock-book/export",
    printType: "report",
  },
  "stock-summary": {
    label: "Stock Summary",
    exportEndpoint: "/api/reports/stock-summary/export",
    printType: "report",
  },
  "vat-reports": {
    label: "VAT Report",
    exportEndpoint: "/api/reports/vat/export",
    printType: "tax-report",
  },
  billing: {
    label: "Billing",
    exportEndpoint: "/api/reports/billing/export",
    printType: "voucher",
  },
  vouchers: {
    label: "Vouchers Register",
    exportEndpoint: "/api/reports/vouchers/export",
    printType: "voucher",
  },
  parties: {
    label: "Parties Directory",
    exportEndpoint: "/api/export/masters",
    printType: "master",
  },
  accounts: {
    label: "Chart of Accounts",
    exportEndpoint: "/api/export/masters",
    printType: "master",
  },
};

export function useTopMenuContext() {
  const currentPage = useStore((state) => state.currentPage);

  return useMemo(() => {
    const context =
      contextMap[currentPage] ?? {
        label: "Current Screen",
        exportEndpoint: "/api/export/generic",
        printType: "generic",
      };

    return {
      context,
      pathname: currentPage,
    };
  }, [currentPage]);
}
