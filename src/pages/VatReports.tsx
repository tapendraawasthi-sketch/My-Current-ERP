// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";

const VatReports: React.FC = () => {
  const { vouchers, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState({});

  const data = useMemo(() => vouchers
    .filter(v => (v.lines || []).some(l => l.accountId === "acc-vat-payable"))
    .map(v => ({
      date: v.date,
      voucherNo: v.voucherNo,
      narration: v.narration || "—",
      vat: formatNumber((v.lines || []).filter(l => l.accountId === "acc-vat-payable").reduce((s,l)=> s + (l.credit || l.debit || 0),0)),
    })), [vouchers]);

  const columns = [
    { key: "date", label: "Date" },
    { key: "voucherNo", label: "Voucher No" },
    { key: "narration", label: "Narration" },
    { key: "vat", label: "VAT Amount", align: "right" },
  ];

  return (
    <ReportShell title="VAT Reports" subtitle="Tax registers" companyName={companySettings?.companyNameEn} onPrint={() => window.print()} onOptions={() => setOptionsOpen(true)}>
      <ReportGrid columns={columns} data={data} />
      <ReportOptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} onApply={setOptions} initial={options} />
    </ReportShell>
  );
};

export default VatReports;
