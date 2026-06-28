// @ts-nocheck
import React from "react";
import { generateId } from "../lib/db";
import { Copy } from "lucide-react";
import toast from "react-hot-toast";

interface VoucherCloneProps {
  voucher: any;
  onClone: (clonedVoucher: any) => void;
}

const VoucherClone: React.FC<VoucherCloneProps> = ({ voucher, onClone }) => {
  const handleClone = () => {
    if (!voucher?.id) {
      toast.error("Cannot clone an unsaved voucher");
      return;
    }

    const cloned = {
      ...voucher,
      id: generateId(),
      date: new Date().toISOString().split("T")[0],
      status: "draft",
      voucherNo: "",
      lines: (voucher.lines || []).map(l => ({...l, id: generateId()}))
    };

    onClone(cloned);
    toast.success("Voucher cloned. Editing a new draft copy.");
  };

  if (!voucher?.id) {
    return null;
  }

  return (
    <button 
      type="button"
      className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors shadow-sm"
      onClick={handleClone}
      title="Clone this voucher"
    >
      <Copy size={14} className="text-gray-500" />
      Clone This Voucher
    </button>
  );
};

export default VoucherClone;
