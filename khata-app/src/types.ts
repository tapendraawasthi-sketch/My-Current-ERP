export type KhataIntent =
  | "khata_credit_sale"
  | "khata_cash_sale"
  | "khata_payment_in"
  | "khata_purchase"
  | "khata_payment_out"
  | "khata_expense";

export interface KhataConfirmationCard {
  intent: KhataIntent;
  party?: string | null;
  amount: number;
  item?: string | null;
  date: string;
  raw_text: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  card?: KhataConfirmationCard;
}

export interface BalanceSummaryData {
  udhaar_out_total: number;
  udhaar_in_total: number;
  recent_credit_sales: KhataEntry[];
  recent_payments_in: KhataEntry[];
}

export interface KhataEntry {
  id: string;
  voucher_date: string;
  amount: number;
  party_name?: string | null;
  item?: string | null;
  voucher_type: string;
}

export const TENANT_ID = import.meta.env.VITE_KHATA_TENANT_ID ?? "";
export const COMPANY_ID = import.meta.env.VITE_KHATA_COMPANY_ID ?? "";
export const USER_ID = import.meta.env.VITE_KHATA_USER_ID ?? "";
