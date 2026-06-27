// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";

const CashBook: React.FC = () => {
  const { vouchers, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState({});

  const data = useMemo(() => {
    const cashAccount = (accounts || []).find(a => a.id === "acc-cash");
    let runningBalance = cashAccount ? (cashAccount.openingBalance || 0) : 0;
    if (cashAccount?.openingBalanceDr === false) runningBalance = -runningBalance;

    return (vouchers || [])
      .filter(v => (v.lines || []).some(l => l.accountId === "acc-cash"))
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(v => {
        const cashLines = (v.lines || []).filter(l => l.accountId === "acc-cash");
        const debit = cashLines.reduce((s,l) => s + (Number(l.debit)||0), 0);
        const credit = cashLines.reduce((s,l) => s + (Number(l.credit)||0), 0);
        
        runningBalance = Math.round((runningBalance + debit - credit) * 100) / 100;
        
        return {
          date: v.date || "",
          voucherNo: v.voucherNo || "",
          narration: v.narration || "—",
          debit: debit > 0 ? formatNumber(debit) : "-",
          credit: credit > 0 ? formatNumber(credit) : "-",
          balance: formatNumber(Math.abs(runningBalance)) + (runningBalance >= 0 ? " Dr" : " Cr")
        };
      });
  }, [vouchers, accounts]);

  const columns = [
    { key: "date", label: "Date" },
    { key: "voucherNo", label: "Voucher No" },
    { key: "narration", label: "Narration" },
    { key: "debit", label: "Debit", align: "right" as const },
    { key: "credit", label: "Credit", align: "right" as const },
    { key: "balance", label: "Balance", align: "right" as const },
  ];

  return (
    <ReportShell 
      title="Cash Book" 
      subtitle="Cash transactions" 
      companyName={companySettings?.companyNameEn || companySettings?.name || "Company"} 
      onPrint={() => window.print()} 
      onOptions={() => setOptionsOpen(true)}
    >
      <ReportGrid columns={columns} data={data} />
      <ReportOptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} onApply={setOptions} initial={options} />
    </ReportShell>
  );
};

export default CashBook;
