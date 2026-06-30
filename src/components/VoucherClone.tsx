import React, { useState } from "react";
import { useStore } from "../store/useStore";
import type { DBVoucher } from "../lib/db";
import { ADToBSString, todayISO } from "../lib/nepaliDate";
import { Copy } from "lucide-react";
import toast from "react-hot-toast";

interface VoucherCloneProps {
  voucher: DBVoucher;
  onCloned?: (newVoucher: DBVoucher) => void;
  className?: string;
}

const VoucherClone: React.FC<VoucherCloneProps> = ({ voucher, onCloned, className = "" }) => {
  const { addVoucher } = useStore();
  const [loading, setLoading] = useState(false);

  const handleClone = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const today = todayISO();

      // Fix BUG-063: compute both AD and BS dates for the cloned voucher
      const cloneData: Omit<DBVoucher, "id" | "voucherNo" | "totalDebit" | "totalCredit"> = {
        type:        voucher.type,
        date:        today,
        dateNepali:  ADToBSString(today),  // ← Fix BUG-063: was copying original dateNepali
        narration:   voucher.narration ? `[Copy] ${voucher.narration}` : "[Copy]",
        lines:       (voucher.lines ?? []).map((l) => ({ ...l })),
        status:      "draft",
        companyId:   voucher.companyId,
        fiscalYearId:voucher.fiscalYearId,
        grandTotal:  voucher.grandTotal,
        createdAt:   new Date().toISOString(),
      };

      // addVoucher now returns full DBVoucher (Fix BUG-071)
      const newVoucher = await addVoucher(cloneData);
      toast.success(`Voucher cloned as ${newVoucher.voucherNo}`);
      onCloned?.(newVoucher);
    } catch (err) {
      console.error("[VoucherClone] error:", err);
      toast.error("Failed to clone voucher");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClone}
      disabled={loading}
      className={`h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title="Duplicate this voucher with today's date"
    >
      <Copy className="h-4 w-4" />
      {loading ? "Cloning…" : "Duplicate"}
    </button>
  );
};

export default VoucherClone;
