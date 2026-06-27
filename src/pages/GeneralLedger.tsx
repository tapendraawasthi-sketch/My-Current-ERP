import React, { useMemo, useState, useEffect } from "react";
import { useScreenF12 } from "../hooks/useF12Config";
import { useStore } from "../store/useStore";
import { computeLedgerBalance, isDebitNature } from "../lib/accounting";
import { exportLedgerToExcel } from "../lib/exportUtils";
import { formatNumber } from "../lib/utils";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";

const GeneralLedger: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("ledger");

  const { accounts, vouchers, currentFiscalYear, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState({});
  const ledgerAccounts = useMemo(() => (accounts || []).filter((a) => !a.isGroup && a.isActive), [accounts]);

  const [accountId, setAccountId] = useState("");
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "2026-07-16");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "2027-07-15");

  useEffect(() => {
    if (!accountId && ledgerAccounts.length > 0) setAccountId(ledgerAccounts[0].id);
  }, [ledgerAccounts, accountId]);

  const selected = ledgerAccounts.find((a) => a.id === accountId);
  const ledgerData = useMemo(() => {
    if (!accountId || !selected) return null;
    const isDr = isDebitNature(selected.type);
    const opDr = selected.openingBalanceDr || 0;
    const opCr = selected.openingBalanceCr || 0;
    
    let baseOp = 0;
    let baseOpSign: "DR" | "CR" = "DR";
    
    if (isDr) { 
      baseOp = opDr - opCr; 
      baseOpSign = baseOp >= 0 ? "DR" : "CR"; 
    } else { 
      baseOp = opCr - opDr; 
      baseOpSign = baseOp >= 0 ? "CR" : "DR"; 
    }
    
    let runningBalance = baseOpSign === "DR" ? Math.abs(baseOp) : -Math.abs(baseOp);
    const transactions: any[] = [];

    // Prepend transactions BEFORE startDate to runningBalance
    const previousVouchers = (vouchers || [])
       .filter(v => (v.status === "posted" || v.status === "POSTED") && v.date < startDate);
    
    for (const v of previousVouchers) {
       for (const line of v.lines || []) {
          if (line.accountId === accountId) {
             runningBalance += (Number(line.debit) || 0) - (Number(line.credit) || 0);
          }
       }
    }

    if (runningBalance !== 0) {
      transactions.push({
        dateBS: startDate,
        voucherNo: "OPENING",
        narration: "Opening Balance",
        debit: runningBalance > 0 ? runningBalance : 0,
        credit: runningBalance < 0 ? Math.abs(runningBalance) : 0,
        runningBalance,
      });
    }

    const filteredVouchers = (vouchers || [])
       .filter(v => (v.status === "posted" || v.status === "POSTED"))
       .filter(v => v.date >= startDate && v.date <= endDate)
       .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const v of filteredVouchers) {
       for (const line of v.lines || []) {
          if (line.accountId === accountId) {
             const debit = Number(line.debit) || 0;
             const credit = Number(line.credit) || 0;
             runningBalance = Math.round((runningBalance + debit - credit) * 100) / 100;
             
             transactions.push({
                dateBS: v.dateNepali || v.date,
                voucherNo: v.voucherNo,
                narration: line.narration || v.narration || "",
                debit,
                credit,
                runningBalance,
             });
          }
       }
    }

    return { transactions };
  }, [accountId, selected, vouchers, startDate, endDate]);

  const columns = [
    { key: "dateBS", label: "Date" },
    { key: "voucherNo", label: "Voucher No" },
    { key: "narration", label: "Narration" },
    { key: "debit", label: "Debit", align: "right" as const },
    { key: "credit", label: "Credit", align: "right" as const },
    { key: "runningBalance", label: "Balance", align: "right" as const },
  ];

  const data = (ledgerData?.transactions || []).map((r) => ({
    ...r,
    debit: r.debit ? formatNumber(r.debit) : "—",
    credit: r.credit ? formatNumber(r.credit) : "—",
    runningBalance: `${formatNumber(Math.abs(r.runningBalance))} ${r.runningBalance >= 0 ? "DR" : "CR"}`,
  }));

  return (
    <ReportShell
      title="General Ledger"
      subtitle={selected?.name || ""}
      companyName={companySettings?.companyNameEn || companySettings?.name || "Company"}
      periodText={`From ${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onExport={() => selected && ledgerData && exportLedgerToExcel(selected.name, ledgerData.transactions as any)}
      onOptions={() => setOptionsOpen(true)}
    >
      <ReportGrid columns={columns} data={data} />
      <ReportOptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} onApply={setOptions} initial={options} />
    </ReportShell>
  );
};

export default GeneralLedger;
