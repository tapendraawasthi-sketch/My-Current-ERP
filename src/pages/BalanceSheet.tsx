// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { AccountType, VoucherStatus } from "../lib/types";
import { formatNumber } from "../lib/utils";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { exportToExcel } from "../lib/reporting";

const BalanceSheet: React.FC = () => {
  const { accounts, vouchers, currentFiscalYear, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState({});
  const fiscalEnd = currentFiscalYear?.endDate || "2027-07-15";

  const rows = useMemo(() => {
    const posted = vouchers.filter((v) => v.status === VoucherStatus.POSTED && v.date <= fiscalEnd);
    const balances = new Map<string, number>();
    for (const acc of accounts) {
      if (acc.isGroup) continue;
      balances.set(acc.id, (acc.openingBalanceDr || 0) - (acc.openingBalanceCr || 0));
    }
    for (const v of posted) {
      for (const line of v.lines || []) {
        const cur = balances.get(line.accountId) || 0;
        balances.set(line.accountId, cur + (line.debit || 0) - (line.credit || 0));
      }
    }

    const pick = (type: AccountType, negate: boolean) =>
      accounts
        .filter((a) => !a.isGroup && a.type === type)
        .map((a) => ({
          name: a.name,
          amount: negate ? -(balances.get(a.id) || 0) : (balances.get(a.id) || 0),
        }))
        .filter((i) => Math.abs(i.amount) > 0.01);

    const assets = pick(AccountType.ASSET, false);
    const liabilities = pick(AccountType.LIABILITY, true);
    const equity = pick(AccountType.EQUITY, true);

    const totalAssets = assets.reduce((s, i) => s + i.amount, 0);
    const totalLiab = liabilities.reduce((s, i) => s + i.amount, 0);
    const totalEq = equity.reduce((s, i) => s + i.amount, 0);

    return [
      { section: "Assets", label: "Total Assets", amount: formatNumber(totalAssets) },
      { section: "Liabilities", label: "Total Liabilities", amount: formatNumber(totalLiab) },
      { section: "Equity", label: "Total Equity", amount: formatNumber(totalEq) },
    ];
  }, [accounts, vouchers, fiscalEnd]);

  const columns = [
    { key: "section", label: "Section" },
    { key: "label", label: "Label" },
    { key: "amount", label: "Amount", align: "right" },
  ];

  return (
    <ReportShell
      title="Balance Sheet"
      subtitle="Statement of Financial Position"
      companyName={companySettings?.companyNameEn}
      periodText={`As at ${fiscalEnd}`}
      onPrint={() => window.print()}
      onExport={() => exportToExcel("Balance Sheet", columns.map(c => c.label), rows.map(r => [r.section, r.label, r.amount]))}
      onOptions={() => setOptionsOpen(true)}
    >
      <ReportGrid columns={columns} data={rows} />
      <ReportOptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} onApply={setOptions} initial={options} />
    </ReportShell>
  );
};

export default BalanceSheet;
