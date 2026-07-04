// @ts-nocheck
import React, { createContext, useContext, useEffect, useState } from "react";
import { useStore } from "../store/useStore";

export type ScreenType =
  "gateway" | "voucher" | "report" | "master" | "inventory" | "tax" | "config" | "list";

export interface ScreenContextValue {
  screenType: ScreenType;
  setScreenType: (t: ScreenType) => void;
  voucherType: string | null;
  setVoucherType: (v: string | null) => void;
  reportType: string | null;
  setReportType: (r: string | null) => void;
}

const noop = () => {};

export const ScreenContext = createContext<ScreenContextValue>({
  screenType: "gateway",
  setScreenType: noop,
  voucherType: null,
  setVoucherType: noop,
  reportType: null,
  setReportType: noop,
});

const voucherPages = new Set(["journal", "payment", "receipt", "contra", "sales", "purchase"]);

const reportPages = new Set([
  "trial-balance",
  "balance-sheet",
  "profit-loss",
  "general-ledger",
  "ledger",
  "day-book",
  "vat-reports",
  "cash-book",
  "bank-book",
  "aging-report",
  "cost-center-report",
  "budget-vs-actual",
]);

const inventoryPages = new Set(["stock-summary", "inventory-report", "stock-book"]);

const masterPages = new Set([
  "master-control-centre",
  "accounts",
  "parties",
  "items",
  "ledgers",
  "account-groups",
  "item-groups",
  "stock-categories",
  "voucher-types",
  "scenarios",
  "cost-categories",
  "cost-centre-classes",
  "reorder-levels",
  "price-levels",
  "price-lists",
  "hs-codes",
  "batches",
  "vat-classifications",
  "tds-nature-of-payments",
  "employee-groups",
  "pay-heads",
  "salary-details",
  "payroll-units",
  "attendance-types",
  "cost-centers",
  "employees",
  "warehouses",
  "units",
]);

const configPages = new Set([
  "settings",
  "company-settings",
  "fiscal-year",
  "users",
  "configuration-hub",
  "configuration",
  "communication-hub",
  "communication",
  "holidays",
  "voucher-entry",
  "backup-restore",
  "backup",
]);

const reportAlias: Record<string, string> = {
  "general-ledger": "ledger",
  ledger: "ledger",
  "vat-reports": "vat",
  "stock-summary": "stock",
};

export const ScreenProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentPage = useStore((state) => state.currentPage);

  const [screenType, setScreenType] = useState<ScreenType>("gateway");
  const [voucherType, setVoucherType] = useState<string | null>(null);
  const [reportType, setReportType] = useState<string | null>(null);

  useEffect(() => {
    if (voucherPages.has(currentPage)) {
      setScreenType("voucher");
      setVoucherType(currentPage);
      setReportType(null);
      return;
    }

    if (currentPage === "billing" || currentPage === "sales-invoice") {
      setScreenType("voucher");
      setVoucherType("sales");
      setReportType(null);
      return;
    }

    if (currentPage === "purchase-invoice" || currentPage === "purchase") {
      setScreenType("voucher");
      setVoucherType("purchase");
      setReportType(null);
      return;
    }

    if (reportPages.has(currentPage)) {
      setScreenType("report");
      setVoucherType(null);
      setReportType(reportAlias[currentPage] || currentPage);
      return;
    }

    if (inventoryPages.has(currentPage)) {
      setScreenType("inventory");
      setVoucherType(null);
      setReportType(currentPage === "stock-summary" ? "stock" : currentPage);
      return;
    }

    if (masterPages.has(currentPage)) {
      setScreenType("master");
      setVoucherType(null);
      setReportType(null);
      return;
    }

    if (configPages.has(currentPage)) {
      setScreenType("config");
      setVoucherType(null);
      setReportType(null);
      return;
    }

    if (currentPage === "dashboard") {
      setScreenType("gateway");
      setVoucherType(null);
      setReportType(null);
      return;
    }

    setScreenType("list");
    setVoucherType(null);
    setReportType(null);
  }, [currentPage]);

  return (
    <ScreenContext.Provider
      value={{
        screenType,
        setScreenType,
        voucherType,
        setVoucherType,
        reportType,
        setReportType,
      }}
    >
      {children}
    </ScreenContext.Provider>
  );
};

export const useScreenContext = () => useContext(ScreenContext);

export default ScreenProvider;
