/**
 * Legacy PO register — retired (Wave D / Function 17).
 * Canonical: OrderVoucherPage via nav `purchase-order`.
 */
import React, { useEffect } from "react";
import { useStore } from "../store/useStore";
import { LoadingState } from "@/design-system";

const PurchaseOrder: React.FC = () => {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  useEffect(() => {
    setCurrentPage?.("purchase-order");
  }, [setCurrentPage]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <LoadingState label="Opening Purchase order…" />
    </div>
  );
};

export default PurchaseOrder;
