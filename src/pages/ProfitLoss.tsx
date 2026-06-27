import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import ReportShell from "../components/reporting/ReportShell";
import NepalStatementTable from "../components/reports/NepalStatementTable";
import {
  buildProfitLossData,
  NepalStatementLine,
} from "../lib/nepalFinancialStatements";

function money(value: number): string {
  const abs = Math.abs(Number(value || 0));
  const text = abs.toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `(${text})` : text;
}

const ProfitLoss: React.FC = () => {
  const {
    accounts,
    vouchers,
    previousYearVouchers,
    companySettings,
    currentFiscalYear,
    currentUser,
    openingStock,
    closingStock,
    previousOpeningStock,
    previousClosingStock,
  } = useStore() as any;

  const currentYearLabel =
    currentFiscalYear?.fiscalYearBS ||
    currentFiscalYear?.name ||
    "Current Year";

  const previousYearLabel =
    currentFiscalYear?.previousFiscalYearBS ||
    "Previous Year";

  const periodLabel =
    `${currentFiscalYear?.startDateBS || "2081-04-01"} to ${currentFiscalYear?.endDateBS || "2082-03-31"}`;

  const data = useMemo(() => {
    return buildProfitLossData({
      accounts: accounts || [],
      currentVouchers: vouchers || [],
      previousVouchers: previousYearVouchers || [],
      fromDate: currentFiscalYear?.startDate,
      toDate: currentFiscalYear?.endDate,
      previousFromDate: currentFiscalYear?.previousStartDate,
      previousToDate: currentFiscalYear?.previousEndDate,
      openingStockCurrent: openingStock || 0,
      closingStockCurrent: closingStock || 0,
      openingStockPrevious: previousOpeningStock || 0,
      closingStockPrevious: previousClosingStock || 0,
    });
  }, [
    accounts,
    vouchers,
    previousYearVouchers,
    currentFiscalYear,
    openingStock,
    closingStock,
    previousOpeningStock,
    previousClosingStock,
  ]);

  const rows: NepalStatementLine[] = [
    {
      id: "heading-revenue",
      label: "I. Revenue from Operations",
      labelNepali: "१. सञ्चालन आम्दानी",
      currentYear: 0,
      previousYear: 0,
      isTotal: true,
    },
    ...data.revenue,
    {
      id: "net-sales",
      label: "NET SALES",
      labelNepali: "खुद बिक्री",
      currentYear: data.netSales,
      previousYear: data.revenue.reduce((s, r) => s + r.previousYear, 0),
      isTotal: true,
    },

    {
      id: "heading-other-income",
      label: "II. Other Income",
      labelNepali: "२. अन्य आम्दानी",
      currentYear: 0,
      previousYear: 0,
      isTotal: true,
    },
    ...data.otherIncome,
    {
      id: "total-other-income",
      label: "TOTAL OTHER INCOME",
      labelNepali: "कुल अन्य आम्दानी",
      currentYear: data.totalOtherIncome,
      previousYear: data.otherIncome.reduce((s, r) => s + r.previousYear, 0),
      isTotal: true,
    },

    {
      id: "total-income",
      label: "TOTAL INCOME (I + II)",
      labelNepali: "कुल आम्दानी",
      currentYear: data.totalIncome,
      previousYear:
        data.revenue.reduce((s, r) => s + r.previousYear, 0) +
        data.otherIncome.reduce((s, r) => s + r.previousYear, 0),
      isGrandTotal: true,
    },

    {
      id: "heading-expenses",
      label: "III. Expenses",
      labelNepali: "३. खर्च",
      currentYear: 0,
      previousYear: 0,
      isTotal: true,
    },
    ...data.cogs,
    {
      id: "cogs-total",
      label: "COST OF GOODS SOLD",
      labelNepali: "बिक्री भएको वस्तुको लागत",
      currentYear: data.costOfGoodsSold,
      previousYear: data.cogs.reduce((s, r) => s + r.previousYear, 0),
      isTotal: true,
    },

    ...data.indirectExpenses,
    {
      id: "total-expenses",
      label: "TOTAL EXPENSES",
      labelNepali: "कुल खर्च",
      currentYear: data.totalExpenses,
      previousYear:
        data.cogs.reduce((s, r) => s + r.previousYear, 0) +
        data.indirectExpenses.reduce((s, r) => s + r.previousYear, 0),
      isGrandTotal: true,
    },

    {
      id: "profit-before-tax",
      label: "PROFIT / (LOSS) BEFORE TAX",
      labelNepali: "कर अघिको नाफा / (नोक्सानी)",
      currentYear: data.profitBeforeTax,
      previousYear: 0,
      isGrandTotal: true,
    },

    {
      id: "income-tax-provision",
      label: "Less: Income Tax Provision",
      labelNepali: "घटाउनुहोस्: आयकर प्रावधान",
      currentYear: -data.incomeTaxProvision,
      previousYear: 0,
      isDeduction: true,
    },

    {
      id: "net-profit-after-tax",
      label: "NET PROFIT / (LOSS) AFTER TAX",
      labelNepali: "कर पछिको खुद नाफा / (नोक्सानी)",
      currentYear: data.netProfitAfterTax,
      previousYear: 0,
      isGrandTotal: true,
    },
  ];

  const printHeader = (
    <div className="print-only hidden text-center mb-4">
      <h1 className="text-[16px] font-bold">
        {companySettings?.companyNameEn || companySettings?.name || "Company Name"}
      </h1>
      <h2 className="text-[15px] font-semibold">
        {companySettings?.companyNameNp || companySettings?.nameNepali || "कम्पनीको नाम"}
      </h2>
      <div className="text-[11px] mt-2 leading-5">
        <div>PAN No.: {companySettings?.panNumber || companySettings?.pan || "—"}</div>
        <div>Profit & Loss Statement for the period {periodLabel}</div>
        <div>Prepared By: {currentUser?.name || "—"} | Approved By: __________________</div>
      </div>
      <div className="border border-gray-400 mt-3 p-2 text-left text-[11px]">
        Auditor's Note: ________________________________________________________________
      </div>
    </div>
  );

  return (
    <ReportShell
      title="Profit & Loss Statement"
      subtitle={`Nepal NAS vertical format for ${periodLabel}`}
      actions={
        <button
          type="button"
          onClick={() => window.print()}
          className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md no-print"
        >
          Print
        </button>
      }
    >
      {printHeader}

      <div className="space-y-4 bg-white border border-gray-200 rounded-md p-4">
        <NepalStatementTable
          rows={rows}
          currentYearLabel={currentYearLabel}
          previousYearLabel={previousYearLabel}
        />

        <div
          className={`border rounded-md p-3 text-[12px] ${
            data.netProfitAfterTax >= 0
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {data.netProfitAfterTax >= 0 ? "Net Profit" : "Net Loss"}: Rs.{" "}
          {money(data.netProfitAfterTax)}
        </div>
      </div>
    </ReportShell>
  );
};

export default ProfitLoss;

