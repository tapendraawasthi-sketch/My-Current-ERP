/**
 * Legacy SO register (OrderForm / local list) — retired (Wave D / Function 17).
 * Canonical: OrderVoucherPage via nav `sales-order`.
 */
import React, { useEffect } from "react";
import { useStore } from "../store/useStore";
import { LoadingState } from "@/design-system";

const SalesOrder: React.FC = () => {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  useEffect(() => {
    setCurrentPage?.("sales-order");
  }, [setCurrentPage]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <LoadingState label="Opening Sales order…" />
    </div>
  );
};

export default SalesOrder;
