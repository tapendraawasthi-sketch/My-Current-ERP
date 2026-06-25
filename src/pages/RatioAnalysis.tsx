// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";

const RatioAnalysis: React.FC = () => {
  const { accounts, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState({});

  const data = useMemo(() => {
    const assets = accounts.filter(a => a.type === "asset" && !a.isGroup).reduce((s,a)=> s + (a.balance||0),0);
    const liabilities = accounts.filter(a => a.type === "liability" && !a.isGroup).reduce((s,a)=> s + (a.balance||0),0);
    const equity = accounts.filter(a => a.type === "equity" && !a.isGroup).reduce((s,a)=> s + (a.balance||0),0);

    return [
      { ratio: "Debt to Equity", value: equity ? formatNumber(liabilities / equity) : "—" },
      { ratio: "Current Ratio", value: liabilities ? formatNumber(assets / liabilities) : "—" },
      { ratio: "Asset Coverage", value: assets ? formatNumber(assets / (liabilities + equity)) : "—" },
    ];
  }, [accounts]);

  const columns = [
    { key: "ratio", label: "Ratio" },
    { key: "value", label: "Value", align: "right" },
  ];

  return (
    <ReportShell title="Ratio Analysis" subtitle="Key financial ratios" companyName={companySettings?.companyNameEn} onPrint={() => window.print()} onOptions={() => setOptionsOpen(true)}>
      <ReportGrid columns={columns} data={data} />
      <ReportOptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} onApply={setOptions} initial={options} />
    </ReportShell>
  );
};

export default RatioAnalysis;
