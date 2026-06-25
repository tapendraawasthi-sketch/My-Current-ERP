// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";

const BillWisePending: React.FC = () => {
  const { invoices, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState({});

  const data = useMemo(() => invoices
    .filter(inv => inv.paymentStatus !== "paid")
    .map(inv => ({
      invoiceNo: inv.invoiceNo,
      date: inv.date,
      party: inv.partyName || "—",
      amount: formatNumber(inv.grandTotal || 0),
      status: inv.paymentStatus || "pending",
    })), [invoices]);

  const columns = [
    { key: "invoiceNo", label: "Invoice No" },
    { key: "date", label: "Date" },
    { key: "party", label: "Party" },
    { key: "amount", label: "Amount", align: "right" },
    { key: "status", label: "Status" },
  ];

  return (
    <ReportShell title="Bill-wise Pending" subtitle="Unpaid invoices" companyName={companySettings?.companyNameEn} onPrint={() => window.print()} onOptions={() => setOptionsOpen(true)}>
      <ReportGrid columns={columns} data={data} />
      <ReportOptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} onApply={setOptions} initial={options} />
    </ReportShell>
  );
};

export default BillWisePending;
