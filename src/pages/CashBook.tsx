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
    return vouchers
      .filter(v => (v.lines || []).some(l => l.accountId === "acc-cash"))
      .map(v => ({
        date: v.date,
        voucherNo: v.voucherNo,
        narration: v.narration || "—",
        debit: formatNumber((v.lines || []).reduce((s,l)=> s + (l.debit||0),0)),
        credit: formatNumber((v.lines || []).reduce((s,l)=> s + (l.credit||0),0)),
      }));
  }, [vouchers]);

  const columns = [
    { key: "date", label: "Date" },
    { key: "voucherNo", label: "Voucher No" },
    { key: "narration", label: "Narration" },
    { key: "debit", label: "Debit", align: "right" },
    { key: "credit", label: "Credit", align: "right" },
  ];

  return (
    <ReportShell title="Cash Book" subtitle="Cash transactions" companyName={companySettings?.companyNameEn} onPrint={() => window.print()} onOptions={() => setOptionsOpen(true)}>
      <ReportGrid columns={columns} data={data} />
      <ReportOptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} onApply={setOptions} initial={options} />
    </ReportShell>
  );
};

export default CashBook;
