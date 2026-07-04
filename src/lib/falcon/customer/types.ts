/** Customer-facing Falcon intent labels — mirrors erp_bot/src/customer/intents.py */

export type CustomerIntent =
  | "SALE_CASH"
  | "SALE_CREDIT"
  | "PAYMENT_RECEIVED"
  | "PURCHASE_CASH"
  | "PURCHASE_CREDIT"
  | "PAYMENT_MADE"
  | "EXPENSE"
  | "RETURN_SALES"
  | "RETURN_PURCHASE"
  | "DISCOUNT_GIVEN"
  | "QUERY_BALANCE_ONE"
  | "QUERY_BALANCE_ALL"
  | "QUERY_DAILY_TOTAL"
  | "QUERY_STOCK"
  | "REMINDER_REQUEST"
  | "OPENING_ENTRY"
  | "GENERAL";

export type FalconMode = "developer" | "customer";

export interface CustomerSlots {
  party?: string;
  amount?: number;
  item?: string;
  date_ref?: string;
  direction?: string;
}

export interface CustomerParseResult {
  intent: CustomerIntent;
  slots: CustomerSlots;
  answer: string;
  action: "post" | "query" | "clarify" | "greet" | "fallback";
}
