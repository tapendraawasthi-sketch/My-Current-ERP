// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { AccountType, VoucherStatus } from "../lib/types";
import { formatNumber } from "../lib/utils";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { exportToExcel } from "../lib/reporting";

const ProfitLoss: React.FC = () => {
  const { accounts, vouchers, currentFiscalYear, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState({});
  const fiscalStart = currentFiscalYear?.startDate || "2026-07-16";
  const fiscalEnd = currentFiscalYear?.endDate || "2027-07-15";

  const rows = useMemo(() => {
    const posted = vouchers.filter((v) => v.status === VoucherStatus.POSTED && v.date >= fiscalStart && v.date <= fiscalEnd);
    const balances = new Map<string, number>();
    for (const acc of accounts) {
      if (acc.isGroup) continue;
      balances.set(acc.id, 0);
    }
    for (const v of posted) {
      for (const line of v.lines || []) {
        const cur = balances.get(line.accountId) || 0;
        balances.set(line.accountId, cur + (line.credit || 0) - (line.debit || 0));
      }
    }

    const income = accounts.filter(a => !a.isGroup && a.type === AccountType.INCOME).map(a => ({
      label: a.name,
      amount: formatNumber(Math.abs(balances.get(a.id) || 0)),
      type: "Income"
    }));
    const expense = accounts.filter(a => !a.isGroup && a.type === AccountType.EXPENSE).map(a => ({
      label: a.name,
      amount: formatNumber(Math.abs(balances.get(a.id) || 0)),
      type: "Expense"
    }));

    const totalIncome = income.reduce((s, i) => s + Number(i.amount.replace(/,/g, "")), 0);
    const totalExpense = expense.reduce((s, i) => s + Number(i.amount.replace(/,/g, "")), 0);
    const net = totalIncome - totalExpense;

    return [
      ...income,
      ...expense,
      { label: "Net Profit/Loss", amount: formatNumber(net), type: "Summary" },
    ];
  }, [accounts, vouchers, fiscalStart, fiscalEnd]);

  const columns = [
    { key: "type", label: "Category" },
    { key: "label", label: "Account" },
    { key: "amount", label: "Amount", align: "right" },
  ];

  return (
    <ReportShell
      title="Profit & Loss"
      subtitle="Income Statement"
      companyName={companySettings?.companyNameEn}
      periodText={`From ${fiscalStart} to ${fiscalEnd}`}
      onPrint={() => window.print()}
      onExport={() => exportToExcel("Profit Loss", columns.map(c => c.label), rows.map(r => [r.type, r.label, r.amount]))}
      onOptions={() => setOptionsOpen(true)}
    >
      <ReportGrid columns={columns} data={rows} />
      <ReportOptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} onApply={setOptions} initial={options} />
    </ReportShell>
  );
};

export default ProfitLoss;
