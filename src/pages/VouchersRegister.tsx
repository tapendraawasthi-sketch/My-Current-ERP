// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";

const VouchersRegister: React.FC = () => {
  const { vouchers, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState({});

  const data = useMemo(() => vouchers.map(v => ({
    date: v.date,
    voucherNo: v.voucherNo,
    type: v.type,
    narration: v.narration || "—",
    amount: formatNumber(v.totalDebit || v.totalCredit || 0),
  })), [vouchers]);

  const columns = [
    { key: "date", label: "Date" },
    { key: "voucherNo", label: "Voucher No" },
    { key: "type", label: "Type" },
    { key: "narration", label: "Narration" },
    { key: "amount", label: "Amount", align: "right" },
  ];

  return (
    <ReportShell title="Vouchers Register" subtitle="All vouchers" companyName={companySettings?.companyNameEn} onPrint={() => window.print()} onOptions={() => setOptionsOpen(true)}>
      <ReportGrid columns={columns} data={data} />
      <ReportOptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} onApply={setOptions} initial={options} />
    </ReportShell>
  );
};

export default VouchersRegister;
