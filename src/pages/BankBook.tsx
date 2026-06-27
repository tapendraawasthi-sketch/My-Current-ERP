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
    const bankIds = (accounts || []).filter(a => /bank/i.test(a.name)).map(a => a.id);

    return (vouchers || [])
      .filter(v => (v.lines || []).some(l => bankIds.includes(l.accountId)))
      .map(v => ({
        date: v.date || "",
        voucherNo: v.voucherNo || "",
        narration: v.narration || "—",
        debit: formatNumber((v.lines || []).reduce((s,l)=> s + (l.debit||0),0)),
        credit: formatNumber((v.lines || []).reduce((s,l)=> s + (l.credit||0),0)),
      }));
  }, [vouchers, accounts]);

  const columns = [
    { key: "date", label: "Date" },
    { key: "voucherNo", label: "Voucher No" },
    { key: "narration", label: "Narration" },
    { key: "debit", label: "Debit", align: "right" as const },
    { key: "credit", label: "Credit", align: "right" as const },
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
