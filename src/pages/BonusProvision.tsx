import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { computeProfitLoss } from "../lib/accounting";
import { Gift, Save } from "lucide-react";
import toast from "@/lib/appToast";

function money(n: number): string {
  return Number(n || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const BonusProvision: React.FC = () => {
  const { employees, accounts, vouchers, addVoucher, currentFiscalYear } = useStore();
  const [saving, setSaving] = useState(false);
  const [profitSharePercent, setProfitSharePercent] = useState(10);

  const pl = useMemo(() => {
    return computeProfitLoss(
      accounts || [],
      vouchers || [],
      currentFiscalYear?.startDate,
      currentFiscalYear?.endDate,
    );
  }, [accounts, vouchers, currentFiscalYear]);

  const eligibleEmployees = useMemo(() => {
    return (employees || []).filter((e) => e.status !== "inactive" && e.bonusEligible !== false);
  }, [employees]);

  const rows = useMemo(() => {
    const oneMonthTotal = eligibleEmployees.reduce((sum, e) => sum + Number(e.basicSalary || 0), 0);
    const profitCap = Math.max(0, pl.netProfit) * (profitSharePercent / 100);
    const provisionTotal = pl.netProfit > 0 ? Math.min(oneMonthTotal, profitCap) : 0;

    if (oneMonthTotal <= 0 || provisionTotal <= 0) {
      return eligibleEmployees.map((e) => ({
        ...e,
        bonusAmount: 0,
      }));
    }

    return eligibleEmployees.map((e) => {
      const basic = Number(e.basicSalary || 0);
      const bonusAmount = Math.round((basic / oneMonthTotal) * provisionTotal * 100) / 100;
      return { ...e, bonusAmount };
    });
  }, [eligibleEmployees, pl.netProfit, profitSharePercent]);

  const totalProvision = useMemo(
    () => rows.reduce((sum, r) => sum + Number(r.bonusAmount || 0), 0),
    [rows],
  );

  const postProvision = async () => {
    if (totalProvision <= 0) {
      toast.error("No bonus provision to post.");
      return;
    }

    const expenseAcc = (accounts || []).find(
      (a) =>
        !a.isGroup &&
        a.type === "expense" &&
        (a.name?.toLowerCase().includes("bonus") || a.code === "5325"),
    );
    const payableAcc = (accounts || []).find(
      (a) => !a.isGroup && a.type === "liability" && a.name?.toLowerCase().includes("bonus"),
    );

    if (!expenseAcc || !payableAcc) {
      toast.error("Bonus Expense or Bonus Payable account not found in chart of accounts.");
      return;
    }

    setSaving(true);
    try {
      await addVoucher({
        id: crypto.randomUUID(),
        type: "journal",
        voucherNo: `JV-BONUS-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split("T")[0],
        narration: `Bonus provision for FY ${currentFiscalYear?.name || ""}`,
        status: "posted",
        totalDebit: totalProvision,
        totalCredit: totalProvision,
        grandTotal: totalProvision,
        lines: [
          {
            accountId: expenseAcc.id,
            accountName: expenseAcc.name,
            debit: totalProvision,
            credit: 0,
            narration: "Bonus provision",
          },
          {
            accountId: payableAcc.id,
            accountName: payableAcc.name,
            debit: 0,
            credit: totalProvision,
            narration: "Bonus payable provision",
          },
        ],
      } as any);
      toast.success("Bonus provision journal posted.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to post bonus provision.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-[var(--ds-canvas)] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Gift className="h-4 w-4 text-[var(--ds-action-primary)]" />
            Bonus provision
          </h1>
          <p className=\"text-[12px] text-gray-500 mt-0.5\">Bonus set aside.</p>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Compute bonus provision from net profit and eligible employees
          </p>
        </div>
        <button
          type="button"
          onClick={postProvision}
          disabled={saving || totalProvision <= 0}
          className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] disabled:opacity-50 text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          Post Provision
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
            Net Profit (FY)
          </p>
          <p className="text-[15px] font-semibold text-gray-800 font-mono mt-1">
            Rs. {money(pl.netProfit)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
            Eligible Employees
          </p>
          <p className="text-[15px] font-semibold text-gray-800 mt-1">{eligibleEmployees.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
            Total Provision
          </p>
          <p className="text-[15px] font-semibold text-[var(--ds-action-primary)] font-mono mt-1">
            Rs. {money(totalProvision)}
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <label className="text-[12px] font-medium text-gray-600 mb-1 block">
          Profit share for bonus (%)
        </label>
        <input
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={profitSharePercent}
          onChange={(e) => setProfitSharePercent(parseFloat(e.target.value) || 0)}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-32"
        />
        <p className="text-[12px] text-gray-500 mt-2">
          Provision is capped at the lower of one month basic salary (eligible staff) or{" "}
          {profitSharePercent}% of net profit.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--ds-canvas)] border-b border-gray-200">
              <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                Employee
              </th>
              <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                Department
              </th>
              <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                Basic Salary
              </th>
              <th className="px-3 py-2.5 text-center text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                Eligible
              </th>
              <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                Bonus provision
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.name}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.department || "—"}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">
                  {money(row.basicSalary || 0)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span
                    className={`px-2 py-0.5 text-[12px] font-semibold uppercase rounded ${
                      row.bonusEligible !== false
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {row.bonusEligible !== false ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[12px] font-mono text-right text-gray-800">
                  {money(row.bonusAmount || 0)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--ds-surface-selected)] font-bold text-[12px] border-t-2 border-[var(--ds-border-strong)]">
              <td className="px-3 py-2.5" colSpan={4}>
                Total
              </td>
              <td className="px-3 py-2.5 font-mono text-right">{money(totalProvision)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default BonusProvision;
