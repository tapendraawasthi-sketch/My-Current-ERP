// @ts-nocheck
import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { Trash2 } from "lucide-react";

export interface PaymentMode {
  mode: "cash" | "bank_transfer" | "cheque" | "esewa" | "khalti" | "fonepay" | "other";
  accountId: string;
  amount: number;
  reference: string;
}

export const isPaymentAllocationValid = (totalAmount: number, modes: PaymentMode[]) => {
  const allocated = modes.reduce((sum, mode) => sum + mode.amount, 0);
  return Math.abs(totalAmount - allocated) < 0.01;
};

interface MultiModePaymentProps {
  totalAmount: number;
  onChange: (modes: PaymentMode[]) => void;
  value: PaymentMode[];
}

const MultiModePayment: React.FC<MultiModePaymentProps> = ({ totalAmount, onChange, value }) => {
  const { accounts } = useStore();

  const cashBankAccounts = useMemo(() => {
    return accounts.filter(
      (a) => a.name.toLowerCase().includes("cash") || a.name.toLowerCase().includes("bank"),
    );
  }, [accounts]);

  const handleAddMode = () => {
    onChange([...value, { mode: "cash", accountId: "", amount: 0, reference: "" }]);
  };

  const handleRemoveMode = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleChangeMode = (index: number, field: keyof PaymentMode, newValue: any) => {
    const newValueParsed = field === "amount" ? Number(newValue) || 0 : newValue;
    const newModes = [...value];
    newModes[index] = { ...newModes[index], [field]: newValueParsed };
    onChange(newModes);
  };

  const allocatedAmount = value.reduce((sum, mode) => sum + mode.amount, 0);
  const remainingAmount = totalAmount - allocatedAmount;

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-[12px] font-semibold text-gray-800">Payment Allocation</label>
        <button
          type="button"
          className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded hover:bg-gray-50 transition-colors shadow-sm"
          onClick={handleAddMode}
        >
          Add Payment Mode
        </button>
      </div>

      <div className="border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Mode
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Account
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                Amount
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Reference
              </th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-12">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {value.map((mode, index) => (
              <tr key={index} className="bg-white border-b border-gray-100">
                <td className="px-3 py-2 align-top">
                  <select
                    value={mode.mode}
                    onChange={(e) => handleChangeMode(index, "mode", e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="esewa">eSewa</option>
                    <option value="khalti">Khalti</option>
                    <option value="fonepay">Fonepay</option>
                    <option value="other">Other</option>
                  </select>
                </td>
                <td className="px-3 py-2 align-top">
                  <select
                    value={mode.accountId}
                    onChange={(e) => handleChangeMode(index, "accountId", e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                  >
                    <option value="">Select Account</option>
                    {cashBankAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 align-top">
                  <input
                    type="number"
                    step="0.01"
                    value={mode.amount}
                    onChange={(e) => handleChangeMode(index, "amount", e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white text-right focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <input
                    type="text"
                    value={mode.reference}
                    placeholder="Cheque/Txn ID"
                    onChange={(e) => handleChangeMode(index, "reference", e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                  />
                </td>
                <td className="px-3 py-2 align-top text-center">
                  <button
                    type="button"
                    className="h-8 w-8 inline-flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    onClick={() => handleRemoveMode(index)}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 p-3 bg-[#f5f6fa] border border-gray-200 rounded-md">
        <div className="flex flex-wrap items-center justify-between gap-4 text-[12px] font-semibold">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-gray-800">
              <span className="text-gray-500">Total:</span>
              <span>Rs. {totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-800">
              <span className="text-gray-500">Allocated:</span>
              <span>Rs. {allocatedAmount.toFixed(2)}</span>
            </div>
            <div
              className={`flex items-center gap-2 ${Math.abs(remainingAmount) > 0.01 ? "text-red-600" : "text-green-600"}`}
            >
              <span className="text-gray-500">Remaining:</span>
              <span>Rs. {remainingAmount.toFixed(2)}</span>
            </div>
          </div>
          <div>
            {Math.abs(remainingAmount) < 0.01 ? (
              <span className="text-green-600 flex items-center gap-1">✓ Fully allocated</span>
            ) : (
              <span className="text-red-600 flex items-center gap-1">
                ⚠ Remaining must be 0 to proceed
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiModePayment;
