import { VoucherType } from "../../lib/types";

export type TabKey = "sales" | "purchase" | "sales-return" | "purchase-return";

export type BillingMode = "list" | "new" | "edit";

export const TAB_META: Record<TabKey, { label: string; vt: VoucherType }> = {
  sales: { label: "Sales invoices", vt: VoucherType.SALES_INVOICE },
  purchase: { label: "Purchase invoices", vt: VoucherType.PURCHASE_INVOICE },
  "sales-return": { label: "Sales returns", vt: VoucherType.SALES_RETURN },
  "purchase-return": { label: "Purchase returns", vt: VoucherType.PURCHASE_RETURN },
};

export const th =
  "px-3 py-2.5 text-left text-[12px] font-semibold text-[var(--ds-text-muted)] uppercase tracking-wide";
export const td =
  "px-3 py-2.5 text-[12px] text-[var(--ds-text-default)] border-b border-[var(--ds-border-subtle)]";
export const btnPrimary =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
export const btnOutline =
  "h-8 px-3 bg-[var(--ds-surface)] border border-[var(--ds-border-default)] text-[var(--ds-text-default)] text-[12px] font-medium rounded-md hover:bg-[var(--ds-surface-muted)] inline-flex items-center gap-1.5";
export const inputCls =
  "h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-lg bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
