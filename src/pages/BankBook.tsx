// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";

const BankBook: React.FC = () => {
  const { vouchers, accounts, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState({});

  const data = useMemo(() => {
    const bankAccounts = (accounts || []).filter(a => /bank/i.test(a.name));
    const bankIds = bankAccounts.map(a => a.id);
    let runningBalance = 0;
    bankAccounts.forEach(a => {
      let b = a.openingBalance || 0;
      if (a.openingBalanceDr === false) b = -b;
      runningBalance += b;
    });

    return (vouchers || [])
      .filter(v => (v.lines || []).some(l => bankIds.includes(l.accountId)))
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(v => {
        const bankLines = (v.lines || []).filter(l => bankIds.includes(l.accountId));
        const debit = bankLines.reduce((s,l) => s + (Number(l.debit)||0), 0);
        const credit = bankLines.reduce((s,l) => s + (Number(l.credit)||0), 0);
        
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
      title="Bank Book" 
      subtitle="Bank transactions" 
      companyName={companySettings?.companyNameEn || companySettings?.name || "Company"} 
      onPrint={() => window.print()} 
      onOptions={() => setOptionsOpen(true)}
    >
      <ReportGrid columns={columns} data={data} />
      <ReportOptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} onApply={setOptions} initial={options} />
    </ReportShell>
  );
};

export default BankBook;
