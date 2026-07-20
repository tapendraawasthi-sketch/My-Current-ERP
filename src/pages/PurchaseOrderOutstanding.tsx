import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { buildPurchaseOrderOutstandingReport } from "../lib/workflowUtils";
import { useBranchFilter } from "../hooks/useBranchFilter";

function money(v: number) {
  return Number(v || 0).toLocaleString("en-NP", { minimumFractionDigits: 2 });
}

const PurchaseOrderOutstanding: React.FC = () => {
  const { vouchers } = useStore() as any;
  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();

  const scopedVouchers = useMemo(
    () => (vouchers || []).filter((v: any) => matchBranch(v?.branchId)),
    [vouchers, matchBranch, branchFilter],
  );

  const rows = useMemo(
    () => buildPurchaseOrderOutstandingReport(scopedVouchers),
    [scopedVouchers],
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">Purchase Order Outstanding</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Pending receipt and bill against purchase orders</p>
        </div>
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
      </div>

      <div className="bg-white border rounded-lg overflow-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-gray-50">
            <tr>
              {[
                "PO No.",
                "Date",
                "Supplier",
                "Item",
                "Ordered Qty",
                "Received Qty",
                "Billed Qty",
                "Rejected Qty",
                "Pending Qty",
                "PO Value",
                "Pending Value",
                "Status",
              ].map((h) => (
                <th key={h} className="px-3 py-2 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((r, idx) => (
              <tr key={`${r.orderId}-${r.itemId}-${idx}`} className="border-t">
                <td className="px-3 py-2 font-mono">{r.orderNo}</td>
                <td className="px-3 py-2">{r.dateNepali || r.date}</td>
                <td className="px-3 py-2">{r.partyName}</td>
                <td className="px-3 py-2">{r.itemName}</td>
                <td className="px-3 py-2 text-right">{r.orderedQty}</td>
                <td className="px-3 py-2 text-right">{r.receivedOrDispatchedQty}</td>
                <td className="px-3 py-2 text-right">{r.billedOrInvoicedQty}</td>
                <td className="px-3 py-2 text-right">{r.rejectedQty}</td>
                <td className="px-3 py-2 text-right font-bold">{r.pendingQty}</td>
                <td className="px-3 py-2 text-right">{money(r.orderValue)}</td>
                <td className="px-3 py-2 text-right">{money(r.pendingValue)}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={r.workflowStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const cls =
    status === "closed"
      ? "bg-green-100 text-green-700"
      : status === "partial"
        ? "bg-amber-100 text-amber-700"
        : "bg-blue-100 text-blue-700";

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${cls}`}>
      {status}
    </span>
  );
};

export default PurchaseOrderOutstanding;
