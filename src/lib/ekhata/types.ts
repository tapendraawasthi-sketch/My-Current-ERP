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

export interface KhataParseResult {
  clarifying_question?: string;
  card?: KhataConfirmationCard;
}

export interface EKhataChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

export const KHATA_INTENT_LABELS: Record<KhataIntent, string> = {
  khata_credit_sale: "Credit Sale (Udhaar)",
  khata_cash_sale: "Cash Sale",
  khata_payment_in: "Payment Received",
  khata_purchase: "Purchase",
  khata_payment_out: "Payment Made",
  khata_expense: "Expense",
};
