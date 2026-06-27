import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { buildSalesOrderOutstandingReport } from "../lib/workflowUtils";

function money(v: number) {
  return Number(v || 0).toLocaleString("en-NP", { minimumFractionDigits: 2 });
}

const SalesOrderOutstanding: React.FC = () => {
  const { vouchers } = useStore() as any;

  const rows = useMemo(
    () => buildSalesOrderOutstandingReport(vouchers || []),
    [vouchers],
  );

  return (
    <div className="p-4">
      <h1 className="text-[15px] font-semibold text-gray-800 mb-4">
        Sales Order Outstanding
      </h1>

      <div className="bg-white border rounded-md overflow-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-[#f5f6fa]">
            <tr>
              {[
                "SO No.",
                "Date",
                "Customer",
                "Item",
                "Ordered Qty",
                "Dispatched",
                "Invoiced",
                "Pending",
                "Value",
                "Pending Value",
                "Status",
              ].map((h) => (
                <th key={h} className="px-3 py-2 text-left">{h}</th>
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
                <td className="px-3 py-2 text-right font-bold">{r.pendingQty}</td>
                <td className="px-3 py-2 text-right">{money(r.orderValue)}</td>
                <td className="px-3 py-2 text-right">{money(r.pendingValue)}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    r.workflowStatus === "closed"
                      ? "bg-green-100 text-green-700"
                      : r.workflowStatus === "partial"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                  }`}>
                    {r.workflowStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalesOrderOutstanding;
