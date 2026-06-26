import React, { useMemo, useState } from "react";
import { useScreenF12 } from "../hooks/useF12Config";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";

const StockSummary: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("stock-summary");

  const { items, stockMovements, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState({});

  const data = useMemo(() => {
    return items.map((item) => {
      const movs = stockMovements.filter(m => m.itemId === item.id);
      const qty = movs.reduce((s, m) => s + (m.qty || 0), 0);
      const amount = movs.reduce((s, m) => s + (m.amount || 0), 0);
      return {
        item: item.name,
        qty: formatNumber(qty),
        amount: formatNumber(amount),
      };
    });
  }, [items, stockMovements]);

  const columns = [
    { key: "item", label: "Item" },
    { key: "qty", label: "Qty", align: "right" },
    { key: "amount", label: "Value", align: "right" },
  ];

  return (
    <ReportShell title="Stock Summary" subtitle="Inventory snapshot" companyName={companySettings?.companyNameEn} onPrint={() => window.print()} onOptions={() => setOptionsOpen(true)}>
      <ReportGrid columns={columns} data={data} />
      <ReportOptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} onApply={setOptions} initial={options} />
    </ReportShell>
  );
};

export default StockSummary;
