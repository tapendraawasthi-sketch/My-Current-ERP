import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import ReportShell from "../components/reporting/ReportShell";
import NepalStatementTable from "../components/reports/NepalStatementTable";
import {
  buildBalanceSheetData,
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

const BalanceSheet: React.FC = () => {
  const {
    accounts,
    vouchers,
    previousYearVouchers,
    companySettings,
    currentFiscalYear,
    currentUser,
  } = useStore() as any;

  const asAtBS =
    currentFiscalYear?.endDateBS ||
    currentFiscalYear?.endDateNepali ||
    "2082-03-31";

  const currentYearLabel =
    currentFiscalYear?.fiscalYearBS ||
    currentFiscalYear?.name ||
    "Current Year";

  const previousYearLabel =
    currentFiscalYear?.previousFiscalYearBS ||
    "Previous Year";

  const data = useMemo(() => {
    return buildBalanceSheetData({
      accounts: accounts || [],
      currentVouchers: vouchers || [],
      previousVouchers: previousYearVouchers || [],
      asAtDate: currentFiscalYear?.endDate,
      previousAsAtDate: currentFiscalYear?.previousEndDate,
    });
  }, [accounts, vouchers, previousYearVouchers, currentFiscalYear]);

  const equityRows: NepalStatementLine[] = [
    {
      id: "heading-equity",
      label: "A. Shareholders' Equity / Proprietor's Capital",
      labelNepali: "क. शेयरधनीको पूँजी / स्वामित्व पूँजी",
      currentYear: 0,
      previousYear: 0,
      isTotal: true,
    },
    ...data.equity,
    {
      id: "total-equity",
      label: "TOTAL EQUITY",
      labelNepali: "कुल पूँजी",
      currentYear: data.totalEquity,
      previousYear: data.equity.reduce((s, r) => s + r.previousYear, 0),
      isTotal: true,
    },
  ];

  const liabilityRows: NepalStatementLine[] = [
    {
      id: "heading-ncl",
      label: "B. Non-Current Liabilities",
      labelNepali: "ख. दीर्घकालीन दायित्व",
      currentYear: 0,
      previousYear: 0,
      isTotal: true,
    },
    ...data.nonCurrentLiabilities,
    {
      id: "total-ncl",
      label: "TOTAL NON-CURRENT LIABILITIES",
      labelNepali: "कुल दीर्घकालीन दायित्व",
      currentYear: data.totalNonCurrentLiabilities,
      previousYear: data.nonCurrentLiabilities.reduce((s, r) => s + r.previousYear, 0),
      isTotal: true,
    },

    {
      id: "heading-cl",
      label: "C. Current Liabilities",
      labelNepali: "ग. चालू दायित्व",
      currentYear: 0,
      previousYear: 0,
      isTotal: true,
    },
    ...data.currentLiabilities,
    {
      id: "total-cl",
      label: "TOTAL CURRENT LIABILITIES",
      labelNepali: "कुल चालू दायित्व",
      currentYear: data.totalCurrentLiabilities,
      previousYear: data.currentLiabilities.reduce((s, r) => s + r.previousYear, 0),
      isTotal: true,
    },

    {
      id: "total-eq-liab",
      label: "TOTAL EQUITY AND LIABILITIES",
      labelNepali: "कुल पूँजी तथा दायित्व",
      currentYear: data.totalEquityAndLiabilities,
      previousYear:
        data.equity.reduce((s, r) => s + r.previousYear, 0) +
        data.nonCurrentLiabilities.reduce((s, r) => s + r.previousYear, 0) +
        data.currentLiabilities.reduce((s, r) => s + r.previousYear, 0),
      isGrandTotal: true,
    },
  ];

  const assetRows: NepalStatementLine[] = [
    {
      id: "heading-nca",
      label: "A. Non-Current Assets",
      labelNepali: "क. दीर्घकालीन सम्पत्ति",
      currentYear: 0,
      previousYear: 0,
      isTotal: true,
    },
    {
      id: "fixed-assets-caption",
      label: "Fixed Assets at Cost Less Accumulated Depreciation",
      labelNepali: "लागतबाट सञ्चित ह्रासकट्टी घटाई स्थायी सम्पत्ति",
      currentYear: 0,
      previousYear: 0,
      indent: 1,
    },
    ...data.fixedAssets,
    ...data.nonCurrentAssets,
    {
      id: "total-nca",
      label: "TOTAL NON-CURRENT ASSETS",
      labelNepali: "कुल दीर्घकालीन सम्पत्ति",
      currentYear: data.totalFixedAssets + data.totalNonCurrentAssets,
      previousYear:
        data.fixedAssets.reduce((s, r) => s + r.previousYear, 0) +
        data.nonCurrentAssets.reduce((s, r) => s + r.previousYear, 0),
      isTotal: true,
    },

    {
      id: "heading-ca",
      label: "B. Current Assets",
      labelNepali: "ख. चालू सम्पत्ति",
      currentYear: 0,
      previousYear: 0,
      isTotal: true,
    },
    ...data.currentAssets,
    {
      id: "total-ca",
      label: "TOTAL CURRENT ASSETS",
      labelNepali: "कुल चालू सम्पत्ति",
      currentYear: data.totalCurrentAssets,
      previousYear: data.currentAssets.reduce((s, r) => s + r.previousYear, 0),
      isTotal: true,
    },

    {
      id: "total-assets",
      label: "TOTAL ASSETS",
      labelNepali: "कुल सम्पत्ति",
      currentYear: data.totalAssets,
      previousYear:
        data.fixedAssets.reduce((s, r) => s + r.previousYear, 0) +
        data.nonCurrentAssets.reduce((s, r) => s + r.previousYear, 0) +
        data.currentAssets.reduce((s, r) => s + r.previousYear, 0),
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
        <div>Balance Sheet as at {asAtBS}</div>
        <div>Prepared By: {currentUser?.name || "—"} | Approved By: __________________</div>
      </div>
      <div className="border border-gray-400 mt-3 p-2 text-left text-[11px]">
        Auditor's Note: ________________________________________________________________
      </div>
    </div>
  );

  return (
    <ReportShell
      title="Balance Sheet"
      subtitle={`Nepal Companies Act / NAS vertical format as at ${asAtBS}`}
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

      <div className="space-y-6 bg-white border border-gray-200 rounded-md p-4">
        <section>
          <h2 className="text-[13px] font-bold text-gray-800 mb-2 uppercase">
            Equity and Liabilities
          </h2>
          <NepalStatementTable
            rows={[...equityRows, ...liabilityRows]}
            currentYearLabel={currentYearLabel}
            previousYearLabel={previousYearLabel}
          />
        </section>

        <section>
          <h2 className="text-[13px] font-bold text-gray-800 mb-2 uppercase">
            Assets
          </h2>
          <NepalStatementTable
            rows={assetRows}
            currentYearLabel={currentYearLabel}
            previousYearLabel={previousYearLabel}
          />
        </section>

        {Math.abs(data.difference) > 0.01 && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-md p-3 text-[12px]">
            Balance Sheet difference: Rs. {money(data.difference)}. Please check opening balances,
            retained earnings, or unposted vouchers.
          </div>
        )}
      </div>
    </ReportShell>
  );
};

export default BalanceSheet;

