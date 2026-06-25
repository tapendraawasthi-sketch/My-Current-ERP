// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { exportToExcel } from "../lib/reporting";

const fmtNet = (dr: number, cr: number): string => {
  const net = dr - cr;
  if (Math.abs(net) < 0.005) return "—";
  return net > 0 ? formatNumber(Math.abs(net)) + " Dr" : formatNumber(Math.abs(net)) + " Cr";
};

const TrialBalance: React.FC = () => {
  const { accounts, vouchers, currentFiscalYear, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState({});
  const fiscalStart = currentFiscalYear?.startDate || "2026-07-16";
  const fiscalEnd = currentFiscalYear?.endDate || "2027-07-15";

  const tbData = useMemo(() => {
    const results: any[] = [];
    const posted = vouchers.filter(
      (v) => v.status === VoucherStatus.POSTED && v.date >= fiscalStart && v.date <= fiscalEnd
    );
    for (const acc of accounts) {
      if (acc.isGroup) continue;
      const opDr = acc.openingBalanceDr || 0;
      const opCr = acc.openingBalanceCr || 0;
      let periodDebit = 0;
      let periodCredit = 0;
      for (const v of posted) {
        for (const line of v.lines || []) {
          if (line.accountId === acc.id) {
            periodDebit += line.debit || 0;
            periodCredit += line.credit || 0;
          }
        }
      }
      const totalDr = opDr + periodDebit;
      const totalCr = opCr + periodCredit;
      let closingDr = 0, closingCr = 0;
      if (totalDr >= totalCr) closingDr = totalDr - totalCr;
      else closingCr = totalCr - totalDr;

      if (opDr > 0 || opCr > 0 || periodDebit > 0 || periodCredit > 0) {
        results.push({
          accountName: acc.name,
          opening: fmtNet(opDr, opCr),
          debit: periodDebit ? formatNumber(periodDebit) : "—",
          credit: periodCredit ? formatNumber(periodCredit) : "—",
          closing: fmtNet(closingDr, closingCr),
        });
      }
    }
    return results;
  }, [accounts, vouchers, fiscalStart, fiscalEnd]);

  const columns = [
    { key: "accountName", label: "Account/Group" },
    { key: "opening", label: "Opening", align: "right" },
    { key: "debit", label: "Debit", align: "right" },
    { key: "credit", label: "Credit", align: "right" },
    { key: "closing", label: "Closing", align: "right" },
  ];

  const handleExport = () => {
    exportToExcel("Trial Balance", columns.map(c => c.label), tbData.map(r => [r.accountName, r.opening, r.debit, r.credit, r.closing]));
  };

  return (
    <ReportShell
      title="Trial Balance"
      subtitle="Closing Trial"
      companyName={companySettings?.companyNameEn}
      periodText={`From ${fiscalStart} to ${fiscalEnd}`}
      onPrint={() => window.print()}
      onExport={handleExport}
      onOptions={() => setOptionsOpen(true)}
    >
      <ReportGrid columns={columns} data={tbData} />
      <ReportOptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} onApply={setOptions} initial={options} />
    </ReportShell>
  );
};

export default TrialBalance;
