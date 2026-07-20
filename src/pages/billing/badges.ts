import { PaymentStatus, VoucherStatus } from "../../lib/types";

export const paymentBadge = (status: string) => {
  if (status === PaymentStatus.PAID) return "bg-green-100 text-green-700";
  if (status === PaymentStatus.PARTIAL) return "bg-amber-100 text-amber-700";
  if (status === PaymentStatus.UNPAID) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
};

export const statusBadge = (status: string) => {
  if (status === VoucherStatus.POSTED) return "bg-green-100 text-green-700";
  if (status === VoucherStatus.CANCELLED) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
};
