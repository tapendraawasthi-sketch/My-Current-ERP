import React, { useMemo, useState } from "react";
import { useScreenF12 } from "../hooks/useF12Config";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";

const DayBook: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("day-book");

  const { vouchers, companySettings, currentFiscalYear } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState({});
  const from = currentFiscalYear?.startDate;
  const to = currentFiscalYear?.endDate;

  const data = useMemo(() => (vouchers || [])
    .filter(v => !from || (v.date && v.date >= from))
    .filter(v => !to || (v.date && v.date <= to))
    .map(v => ({
      date: v.date || "",
      type: v.type || "",
      voucherNo: v.voucherNo || "",
      narration: v.narration || "—",
      amount: formatNumber(v.totalDebit || v.totalCredit || 0),
    })), [vouchers, from, to]);

  const columns = [
    { key: "date", label: "Date" },
    { key: "voucherNo", label: "Voucher No" },
    { key: "type", label: "Type" },
    { key: "narration", label: "Narration" },
    { key: "amount", label: "Amount", align: "right" as const },
  ];

  return (
    <ReportShell 
      title="Day Book" 
      subtitle="All vouchers by date" 
      companyName={companySettings?.companyNameEn || companySettings?.name || "Company"} 
      periodText={`From ${from || "Start"} to ${to || "End"}`} 
      onPrint={() => window.print()} 
      onOptions={() => setOptionsOpen(true)}
    >
      <ReportGrid columns={columns} data={data} />
      <ReportOptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} onApply={setOptions} initial={options} />
    </ReportShell>
  );
};

export default DayBook;
