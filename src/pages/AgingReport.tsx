// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";

const AgingReport: React.FC = () => {
  const { parties, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState({});

  const data = useMemo(() => parties.map(p => ({
    party: p.name,
    balance: formatNumber(p.balance || 0),
    bucket: (p.balance || 0) > 0 ? "Receivable" : "Payable",
  })), [parties]);

  const columns = [
    { key: "party", label: "Party" },
    { key: "bucket", label: "Bucket" },
    { key: "balance", label: "Balance", align: "right" },
  ];

  return (
    <ReportShell title="Aging Report" subtitle="Outstanding analysis" companyName={companySettings?.companyNameEn} onPrint={() => window.print()} onOptions={() => setOptionsOpen(true)}>
      <ReportGrid columns={columns} data={data} />
      <ReportOptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} onApply={setOptions} initial={options} />
    </ReportShell>
  );
};

export default AgingReport;
