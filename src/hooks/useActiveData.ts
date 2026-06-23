import { useMemo } from "react";
import { useStore } from "../store/useStore";

/**
 * Custom hook to filter any array of date-bearing records
 * by the currently active fiscal year bounds.
 * Excludes records that fall outside the active FY.
 */
export const useActiveRecords = <T extends { date?: string }>(records: T[]) => {
  const fy = useStore((s) => s.currentFiscalYear);
  return useMemo(() => {
    if (!fy) return records;
    return records.filter((r) => {
      if (!r.date) return true;
      return r.date >= fy.startDate && r.date <= fy.endDate;
    });
  }, [records, fy]);
};

// Convenience hooks for specific transaction types
export const useActiveVouchers = () => {
  const records = useStore((s) => s.vouchers);
  return useActiveRecords(records);
};

export const useActiveInvoices = () => {
  const records = useStore((s) => s.invoices);
  return useActiveRecords(records);
};

export const useActiveStockMovements = () => {
  const records = useStore((s) => s.stockMovements);
  return useActiveRecords(records);
};

export const useActiveSalesOrders = () => {
  const records = useStore((s) => s.salesOrders);
  return useActiveRecords(records);
};

export const useActivePurchaseOrders = () => {
  const records = useStore((s) => s.purchaseOrders);
  return useActiveRecords(records);
};

export const useActiveDeliveryChallans = () => {
  const records = useStore((s) => s.deliveryChallans);
  return useActiveRecords(records);
};

export const useActiveGoodsReceiptNotes = () => {
  const records = useStore((s) => s.goodsReceiptNotes);
  return useActiveRecords(records);
};
