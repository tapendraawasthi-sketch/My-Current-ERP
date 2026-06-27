import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { computePendingAlerts } from "../lib/workflowUtils";

const WorkflowAlertsWidget: React.FC = () => {
  const { vouchers, setCurrentPage, setReportFilters } = useStore() as any;

  const alerts = useMemo(
    () => computePendingAlerts(vouchers || []),
    [vouchers],
  );

  const go = (page: string, filter?: any) => {
    setReportFilters?.(filter || {});
    setCurrentPage?.(page);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <h3 className="text-[13px] font-semibold text-gray-800 mb-3">
        Pending Document Alerts
      </h3>

      <div className="space-y-2 text-[12px]">
        <AlertRow
          label={`${alerts.purchaseOrdersPendingGrnOlderThan7Days} Purchase Orders pending GRN older than 7 days`}
          onClick={() => go("purchase-order-outstanding", { pendingGrn: true })}
        />

        <AlertRow
          label={`${alerts.grnsPendingBilling} GRNs pending billing`}
          onClick={() => go("purchase-order-outstanding", { pendingBilling: true })}
        />

        <AlertRow
          label={`${alerts.salesOrdersPendingDispatchOlderThan7Days} Sales Orders pending dispatch older than 7 days`}
          onClick={() => go("sales-order-outstanding", { pendingDispatch: true })}
        />

        <AlertRow
          label={`${alerts.deliveryChallansPendingBilling} Delivery Challans pending billing`}
          onClick={() => go("sales-order-outstanding", { pendingDcBilling: true })}
        />
      </div>
    </div>
  );
};

const AlertRow = ({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left px-3 py-2 rounded border border-gray-200 hover:bg-yellow-50"
  >
    {label}
  </button>
);

export default WorkflowAlertsWidget;
