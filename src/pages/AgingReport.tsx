// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { BSToADString } from "../lib/nepaliDate";
import { VoucherStatus, PaymentStatus } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";

const AgingReport: React.FC = () => {
  const { parties, invoices, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState<any>({});

  const data = useMemo(() => {
    const asOnBSDate = options.asOnDate || new Date().toISOString().split("T")[0]; // Wait, if it's not set, let's just use current AD Date for now or default
    const asOnAD = BSToADString(asOnBSDate) || new Date().toISOString().split("T")[0];

    const daysBetween = (from: string, to: string) => {
      const fromTime = new Date(from).getTime();
      const toTime = new Date(to).getTime();
      return Math.floor((toTime - fromTime) / (1000 * 60 * 60 * 24));
    };

    const outstandingInvoices = (invoices || []).filter((invoice) => {
      const outstanding = Number(invoice.grandTotal || 0) - Number(invoice.paidAmount || 0);
      return (
        (invoice.status === VoucherStatus.POSTED || invoice.status === "posted") &&
        outstanding > 0.01 &&
        invoice.paymentStatus !== PaymentStatus.PAID
      );
    });

    return parties.map(p => {
      let bucket0to30 = 0, bucket31to60 = 0, bucket61to90 = 0, bucket90Plus = 0;
      let totalOutstanding = 0;

      const partyInvoices = outstandingInvoices.filter(i => i.partyId === p.id);
      partyInvoices.forEach(inv => {
        const outstanding = Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0);
        const days = daysBetween(inv.date, asOnAD);
        
        if (days <= 30) bucket0to30 += outstanding;
        else if (days <= 60) bucket31to60 += outstanding;
        else if (days <= 90) bucket61to90 += outstanding;
        else bucket90Plus += outstanding;
        
        totalOutstanding += outstanding;
      });

      return {
        party: p.name,
        balance: formatNumber(p.balance || 0),
        bucket0to30: formatNumber(bucket0to30),
        bucket31to60: formatNumber(bucket31to60),
        bucket61to90: formatNumber(bucket61to90),
        bucket90Plus: formatNumber(bucket90Plus),
        totalOutstanding: formatNumber(totalOutstanding),
      };
    }).filter(row => Number(row.totalOutstanding.replace(/,/g, "")) > 0);
  }, [parties, invoices, options.asOnDate]);

  const columns = [
    { key: "party", label: "Party" },
    { key: "bucket0to30", label: "0-30 Days", align: "right" as const },
    { key: "bucket31to60", label: "31-60 Days", align: "right" as const },
    { key: "bucket61to90", label: "61-90 Days", align: "right" as const },
    { key: "bucket90Plus", label: "90+ Days", align: "right" as const },
    { key: "totalOutstanding", label: "Total Outstanding", align: "right" as const },
  ];

  return (
    <ReportShell title="Aging Report" subtitle="Outstanding analysis" companyName={companySettings?.companyNameEn} onPrint={() => window.print()} onOptions={() => setOptionsOpen(true)}>
      <ReportGrid columns={columns} data={data} />
      <ReportOptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} onApply={setOptions} initial={options} />
    </ReportShell>
  );
};

export default AgingReport;
