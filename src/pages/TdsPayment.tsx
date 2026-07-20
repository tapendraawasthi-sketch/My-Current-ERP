// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { ActionToolbar, Card, Button, Select, NepaliDatePicker } from "../components/ui";
import { Save } from "lucide-react";
import { dateToAD, formatNumber } from "../lib/utils";
import { formatADToBS } from "../lib/nepaliDate";
import toast from "@/lib/appToast";
import { VoucherType, VoucherStatus, JournalEntryLine } from "../lib/types";
import { computeWithholdingTDS } from "../lib/taxUtils";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

const PAYMENT_NATURES = [
  "Contractor",
  "Service",
  "Rent",
  "Commission",
  "Salary",
  "Dividend",
  "Interest",
  "Royalty",
  "Other",
];

export default function TdsPayment() {
  const { parties, tdsRates, addTdsEntry, addVoucher, currentFiscalYear, accounts } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const defaultAd = dateToAD(new Date());

  const [date, setDate] = useState(defaultAd);
  const [partyId, setPartyId] = useState("");
  const [paymentNature, setPaymentNature] = useState("");
  const [grossAmount, setGrossAmount] = useState<number | "">("");
  const [expenseAccountId, setExpenseAccountId] = useState("");

  const [section, setSection] = useState("");
  const [tdsRate, setTdsRate] = useState(0);
  const [threshold, setThreshold] = useState(0);

  // Auto-fill section & rate when payment nature changes
  useEffect(() => {
    if (paymentNature) {
      const match = tdsRates.find((r: any) =>
        r.natureOfPayment.toLowerCase().includes(paymentNature.toLowerCase()),
      );
      if (match) {
        setSection(match.section);
        setTdsRate(match.rate);
        setThreshold(match.threshold || 0);
      } else {
        setSection("Other");
        setTdsRate(1.5);
        setThreshold(0);
      }
    } else {
      setSection("");
      setTdsRate(0);
      setThreshold(0);
    }
  }, [paymentNature, tdsRates]);

  const grossNum = typeof grossAmount === "number" ? grossAmount : 0;

  // Compute TDS
  const { tdsAmount, netAmount, isBelowThreshold } = useMemo(() => {
    return computeWithholdingTDS(grossNum, tdsRate, threshold);
  }, [grossNum, tdsRate, threshold]);

  const partyOptions = useMemo(
    () =>
      parties
        .filter((p) => matchBranch((p as { branchId?: string }).branchId))
        .map((p) => ({ value: p.id, label: p.name })),
    [parties, matchBranch, branchFilter],
  );
  const natureOptions = useMemo(() => PAYMENT_NATURES.map((n) => ({ value: n, label: n })), []);

  const expenseAccounts = useMemo(
    () =>
      accounts
        .filter(
          (a) => a.type === "Expense" || a.type === "DirectExpense" || a.type === "IndirectExpense",
        )
        .map((a) => ({ value: a.id, label: a.name })),
    [accounts],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId || !paymentNature || !grossNum || !expenseAccountId) {
      toast.error("Please fill all required fields.");
      return;
    }

    const party = parties.find((p) => p.id === partyId);
    if (!party) return;

    try {
      // 1. Create TDS Entry
      const branchId = readActiveBranchId() || undefined;
      const tdsEntry = {
        id: crypto.randomUUID(),
        date: date,
        dateBS: formatADToBS(date),
        partyId: partyId,
        partyName: party.name,
        partyPAN: party.panNumber || "",
        section: section,
        paymentNature: paymentNature,
        grossAmount: grossNum,
        tdsRate: tdsRate,
        tdsAmount: tdsAmount,
        netAmount: netAmount,
        status: "pending" as const,
        fiscalYearBS: currentFiscalYear?.bsYear || formatADToBS(date).substring(0, 4),
        branchId,
      };

      await addTdsEntry(tdsEntry);

      // 2. Create Journal Voucher
      const tdsPayableAcc = accounts.find(
        (a) => a.id === "acc-tds-payable" || a.name.toLowerCase().includes("tds payable"),
      );
      const tdsPayableId = tdsPayableAcc ? tdsPayableAcc.id : "acc-tds-payable";

      const lines: JournalEntryLine[] = [
        {
          accountId: expenseAccountId,
          debit: grossNum,
          credit: 0,
          narration: `Expense for ${paymentNature} to ${party.name}`,
        },
        {
          accountId: party.id,
          debit: 0,
          credit: netAmount,
          narration: `Net payable to ${party.name}`,
        },
      ];

      if (tdsAmount > 0) {
        lines.push({
          accountId: tdsPayableId,
          debit: 0,
          credit: tdsAmount,
          narration: `TDS deducted at ${tdsRate}% under section ${section}`,
        });
      }

      const voucherId = crypto.randomUUID();
      await addVoucher({
        id: voucherId,
        date: date,
        dateNepali: formatADToBS(date),
        voucherNo: `JV-TDS-${Date.now().toString().slice(-4)}`,
        type: VoucherType.JOURNAL,
        status: VoucherStatus.POSTED,
        narration: `TDS Entry for ${paymentNature} - Section ${section}`,
        lines: lines,
        totalDebit: lines.reduce((sum, l) => sum + (l.debit || 0), 0),
        totalCredit: lines.reduce((sum, l) => sum + (l.credit || 0), 0),
        branchId,
      } as any);

      toast.success("TDS payment recorded successfully!");
      setPartyId("");
      setPaymentNature("");
      setGrossAmount("");
      setExpenseAccountId("");
    } catch (err: any) {
      toast.error(err.message || "Failed to save TDS entry.");
    }
  };

  return (
    <div className="p-3 bg-[var(--ds-surface-muted)] min-h-full">
<div className="mb-4 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 animate-fadeIn select-none">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-[var(--ds-text-default)]">TDS Entry Form</h1>
              <p className="text-[12px] text-[var(--ds-text-default)] mt-0.5">
                Record TDS payments and generate automated journals
              </p>
            </div>
            <div className="flex items-center gap-2">
              {branchOptions.length > 0 && (
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  aria-label="Branch"
                >
                  <option value="all">All branches</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name || b.code || b.id}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary)] text-white text-[12px] font-medium rounded-md flex items-center gap-1 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" /> Save Entry
              </button>
            </div>
          </div>

          <Card border padding="md">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-4">
                <NepaliDatePicker label="Date" value={date} onChange={setDate} />

                <Select
                  label="Party *"
                  value={partyId}
                  onChange={setPartyId}
                  options={partyOptions}
                />

                <Select
                  label="Expense Account (Dr) *"
                  value={expenseAccountId}
                  onChange={setExpenseAccountId}
                  options={expenseAccounts}
                />
              </div>

              <div className="grid gap-4">
                <Select
                  label="Payment Nature *"
                  value={paymentNature}
                  onChange={setPaymentNature}
                  options={natureOptions}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] font-medium text-[var(--ds-text-default)] block mb-1">
                      Section
                    </label>
                    <div className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-[var(--ds-action-primary)] flex items-center">
                      {section || "-"}
                    </div>
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-[var(--ds-text-default)] block mb-1">
                      TDS Rate (%)
                    </label>
                    <div className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-[var(--ds-action-primary)] flex items-center">
                      {tdsRate || 0}%
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-medium text-[var(--ds-text-default)] block mb-1">
                    Gross Amount *
                  </label>
                  <input
                    type="number"
                    value={grossAmount}
                    onChange={(e) => setGrossAmount(e.target.value ? Number(e.target.value) : "")}
                    className="h-8 w-full px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                    placeholder="Enter gross amount"
                  />
                  {isBelowThreshold && (
                    <div className="mt-1 text-[12px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                      Below Rs.{formatNumber(threshold)} threshold — TDS not applicable
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-[var(--ds-border-default)] pt-4 grid grid-cols-3 gap-4">
              <div className="bg-[var(--ds-action-primary)] p-3 rounded border border-[var(--ds-border-default)]">
                <div className="text-[12px] uppercase font-bold text-[var(--ds-text-default)]">Gross Amount</div>
                <div className="text-[14px] font-bold text-[var(--ds-text-default)]">
                  Rs. {formatNumber(grossNum)}
                </div>
              </div>
              <div className="bg-red-50 p-3 rounded border border-red-200">
                <div className="text-[12px] uppercase font-bold text-red-700">
                  TDS Amount ({tdsRate}%)
                </div>
                <div className="text-[14px] font-bold text-red-800">
                  Rs. {formatNumber(tdsAmount)}
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded border border-green-200">
                <div className="text-[12px] uppercase font-bold text-green-700">Net Payable</div>
                <div className="text-[14px] font-bold text-green-800">
                  Rs. {formatNumber(netAmount)}
                </div>
              </div>
            </div>
          </Card>
        </form>
      </div>
    </div>
  );
}
