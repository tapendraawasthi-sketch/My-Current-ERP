/** NIOS domain and system events */

export type NiosEventType =
  | "voucher.posted"
  | "invoice.created"
  | "invoice.updated"
  | "stock.movement"
  | "payroll.run"
  | "nios.chat.completed"
  | "nios.capability.executed";

export interface NiosEvent<T = Record<string, unknown>> {
  id: string;
  type: NiosEventType;
  timestamp: string;
  tenantId?: string;
  companyId?: string;
  sessionId?: string;
  payload: T;
}

export interface VoucherPostedPayload {
  voucherId: string;
  voucherNo: string;
  voucherType: string;
  referenceId?: string;
  referenceNo?: string;
  grandTotal?: number;
  partyName?: string;
}
