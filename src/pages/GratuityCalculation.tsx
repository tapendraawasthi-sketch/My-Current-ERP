import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { computeGratuity } from "../lib/nepalPayrollEngine";
import { Calculator, Save } from "lucide-react";
import toast from "@/lib/appToast";

function money(n: number): string {
  return Number(n || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function yearsOfService(joinDate?: string): number {
  if (!joinDate) return 0;
  const start = new Date(joinDate);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.max(0, diffMs / (365.25 * 24 * 60 * 60 * 1000));
}

const GratuityCalculation: React.FC = () => {
  const { employees, accounts, addVoucher, currentFiscalYear } = useStore();
  const [saving, setSaving] = useState(false);
  const [minYears, setMinYears] = useState(1);

  const rows = useMemo(() => {
    return (employees || [])
      .filter((e) => e.status !== "inactive")
      .map((e) => {
        const joinDate = e.dateOfJoining || e.joinDate;
        const years = yearsOfService(joinDate);
        const basic = Number(e.basicSalary || 0);
        const gratuity = years >= minYears ? computeGratuity(basic, Math.floor(years)) : 0;
        return {
          id: e.id,
          name: e.name,
          department: e.department,
          joinDate,
          years: Math.floor(years * 10) / 10,
          basicSalary: basic,
          gratuity,
        };
      });
  }, [employees, minYears]);

  const totalGratuity = useMemo(() => rows.reduce((sum, r) => sum + r.gratuity, 0), [rows]);

  const postProvision = async () => {
    if (totalGratuity <= 0) {
      toast.error("No gratuity amount to post.");
      return;
    }

    const expenseAcc = (accounts || []).find(
      (a) => !a.isGroup && a.type === "expense" && a.name?.toLowerCase().includes("gratuity"),
    );
    const payableAcc = (accounts || []).find(
      (a) => !a.isGroup && a.type === "liability" && a.name?.toLowerCase().includes("gratuity"),
    );

    if (!expenseAcc || !payableAcc) {
      toast.error("Gratuity Expense or Gratuity Payable account not found.");
      return;
    }

    setSaving(true);
    try {
      await addVoucher({
        id: crypto.randomUUID(),
        type: "journal",
        voucherNo: `JV-GRAT-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split("T")[0],
        narration: `Gratuity provision for FY ${currentFiscalYear?.name || ""}`,
        status: "posted",
        totalDebit: totalGratuity,
        totalCredit: totalGratuity,
        grandTotal: totalGratuity,
        lines: [
          {
            accountId: expenseAcc.id,
            accountName: expenseAcc.name,
            debit: totalGratuity,
            credit: 0,
            narration: "Gratuity provision (Labour Act 2074)",
          },
          {
            accountId: payableAcc.id,
            accountName: payableAcc.name,
            debit: 0,
            credit: totalGratuity,
            narration: "Gratuity payable",
          },
        ],
      } as any);
      toast.success("Gratuity provision journal posted.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to post gratuity provision.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-[var(--ds-canvas)] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-[var(--ds-action-primary)]" />
            Gratuity
          </h1>
          <p className=\"text-[12px] text-gray-500 mt-0.5\">Gratuity calculation.</p>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Labour Act 2074 — 8.33% of basic salary per year of service
          </p>
        </div>
        <button
          type="button"
          onClick={postProvision}
          disabled={saving || totalGratuity <= 0}
          className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] disabled:opacity-50 text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          Post Provision
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <label className="text-[12px] font-medium text-gray-600 mb-1 block">
          Minimum years of service
        </label>
        <input
          type="number"
          min={0}
          max={10}
          step={1}
          value={minYears}
          onChange={(e) => setMinYears(parseInt(e.target.value, 10) || 0)}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-32"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--ds-canvas)] border-b border-gray-200">
              <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                Employee
              </th>
              <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                Join Date
              </th>
              <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                Years
              </th>
              <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                Basic Salary
              </th>
              <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                Gratuity
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.name}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.joinDate || "—"}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">
                  {row.years}
                </td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">
                  {money(row.basicSalary)}
                </td>
                <td className="px-3 py-2.5 text-[12px] font-mono text-right text-gray-800">
                  {money(row.gratuity)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--ds-surface-selected)] font-bold text-[12px] border-t-2 border-[var(--ds-border-strong)]">
              <td className="px-3 py-2.5" colSpan={4}>
                Total Gratuity Provision
              </td>
              <td className="px-3 py-2.5 font-mono text-right">{money(totalGratuity)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default GratuityCalculation;
