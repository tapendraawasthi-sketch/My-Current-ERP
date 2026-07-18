import React, { useState } from "react";
import { X, Plus, Save, Trash2, FileText } from "lucide-react";
import { BillWiseAllocation, cryptoRandomId, todayAD } from "@/lib/tallyVoucher";
import { formatMoney, parseMoney } from "@/lib/tallyFormat";
import { round2 } from "@/lib/tallyVoucher";
import { useBranchFilter } from "@/hooks/useBranchFilter";

interface Props {
  isOpen: boolean;
  amount: number;
  partyId: string;
  invoices?: any[];
  existing?: BillWiseAllocation[];
  onClose: () => void;
  onSave: (allocations: BillWiseAllocation[]) => void;
}

export const TallyBillWiseAllocation: React.FC<Props> = ({
  isOpen,
  amount,
  partyId,
  invoices = [],
  existing,
  onClose,
  onSave,
}) => {
  const { matchBranch } = useBranchFilter();
  const partyInvoices = invoices.filter(
    (i) =>
      matchBranch(i.branchId) &&
      (i.partyId === partyId || i.accountId === partyId) &&
      (i.balanceDue ?? i.grandTotal ?? 0) !== 0,
  );

  const [rows, setRows] = useState<BillWiseAllocation[]>(() =>
    existing?.length
      ? existing
      : [{ id: cryptoRandomId(), method: "New Reference", refNo: "", refDate: todayAD(), amount }],
  );

  if (!isOpen) return null;

  const set = (i: number, k: string, v: any) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const diff = round2(amount - total);

  return (
    <div
      className="tally-modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="tally-modal bg-[var(--t-card)] border-2 border-[#2E5B1E] rounded-md max-w-[640px] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tally-modal-head bg-[var(--t-accent)] text-white p-2 font-bold flex justify-between">
          <span>
            <FileText size={14} className="inline mr-1" /> Bill-wise Details
          </span>
          <button onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="tally-modal-body p-3">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-[var(--ds-border-default)] bg-[var(--t-muted)] text-[11px] uppercase p-1">
                  Method
                </th>
                <th className="border border-[var(--ds-border-default)] bg-[var(--t-muted)] text-[11px] uppercase p-1">
                  Reference
                </th>
                <th className="border border-[var(--ds-border-default)] bg-[var(--t-muted)] text-[11px] uppercase p-1">
                  Date
                </th>
                <th className="border border-[var(--ds-border-default)] bg-[var(--t-muted)] text-[11px] uppercase p-1 text-right">
                  Amount
                </th>
                <th className="border border-[var(--ds-border-default)] bg-[var(--t-muted)] text-[11px] uppercase p-1"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="border border-[var(--ds-border-default)] p-1">
                    <select
                      className="tally-input w-full p-1"
                      value={r.method}
                      onChange={(e) => set(i, "method", e.target.value as any)}
                    >
                      <option>New Reference</option>
                      <option>Against Reference</option>
                      <option>Advance</option>
                      <option>On Account</option>
                    </select>
                  </td>
                  <td className="border border-[var(--ds-border-default)] p-1">
                    {r.method === "Against Reference" && partyInvoices.length ? (
                      <select
                        className="tally-input w-full p-1"
                        value={r.refNo}
                        onChange={(e) => set(i, "refNo", e.target.value)}
                      >
                        <option value="">Select bill…</option>
                        {partyInvoices.map((iv) => (
                          <option key={iv.id} value={iv.invoiceNo}>
                            {iv.invoiceNo}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="tally-input w-full p-1"
                        value={r.refNo}
                        onChange={(e) => set(i, "refNo", e.target.value)}
                      />
                    )}
                  </td>
                  <td className="border border-[var(--ds-border-default)] p-1">
                    <input
                      type="date"
                      className="tally-input w-full p-1"
                      value={r.refDate}
                      onChange={(e) => set(i, "refDate", e.target.value)}
                    />
                  </td>
                  <td className="border border-[var(--ds-border-default)] p-1">
                    <input
                      type="number"
                      className="tally-input w-full p-1 text-right"
                      value={r.amount}
                      onChange={(e) => set(i, "amount", parseMoney(e.target.value))}
                    />
                  </td>
                  <td className="border border-[var(--ds-border-default)] p-1 text-center">
                    <button
                      className="tally-btn py-0.5 px-1"
                      onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between mt-2">
            <button
              className="tally-btn flex items-center gap-1"
              onClick={() =>
                setRows((p) => [
                  ...p,
                  {
                    id: cryptoRandomId(),
                    method: "New Reference",
                    refNo: "",
                    refDate: todayAD(),
                    amount: diff > 0 ? diff : 0,
                  },
                ])
              }
            >
              <Plus size={12} /> Add Bill
            </button>
            <span
              className={`tally-total-box ${Math.abs(diff) > 0.001 ? "tally-cr text-[#8B1E1E]" : "tally-dr text-[#1B5E20]"}`}
            >
              Allocated {formatMoney(total)} · Diff {formatMoney(diff)}
            </span>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-3 no-print">
          <button className="tally-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="tally-btn tally-btn-primary flex items-center gap-1"
            onClick={() => {
              onSave(rows);
              onClose();
            }}
          >
            <Save size={13} /> Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default TallyBillWiseAllocation;
