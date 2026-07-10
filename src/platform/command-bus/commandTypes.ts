export const CommandTypes = {
  POST_VOUCHER: "PostVoucher",
  UPDATE_VOUCHER: "UpdateVoucher",
  CANCEL_VOUCHER: "CancelVoucher",
  POST_INVOICE: "PostInvoice",
  UPDATE_INVOICE: "UpdateInvoice",
  CANCEL_INVOICE: "CancelInvoice",
  CREATE_ACCOUNT: "CreateAccount",
  UPDATE_ACCOUNT: "UpdateAccount",
  DELETE_ACCOUNT: "DeleteAccount",
  CREATE_PARTY: "CreateParty",
  UPDATE_PARTY: "UpdateParty",
  CREATE_ITEM: "CreateItem",
  UPDATE_ITEM: "UpdateItem",
  UPDATE_COMPANY_SETTINGS: "UpdateCompanySettings",
  SET_CURRENT_FISCAL_YEAR: "SetCurrentFiscalYear",
  ADD_TDS_ENTRY: "AddTdsEntry",
  UPDATE_TDS_ENTRY: "UpdateTdsEntry",
  ADD_NOTIFICATION: "AddNotification",
  MARK_NOTIFICATION_READ: "MarkNotificationRead",
  CLEAR_NOTIFICATIONS: "ClearNotifications",
  LOAD_AUDIT_LOGS: "LoadAuditLogs",
  ADD_AUDIT_LOG: "AddAuditLog",
  ENQUEUE_SYNC_RECORD: "EnqueueSyncRecord",
  POST_KHATA_ENTRY: "PostKhataEntry",
} as const;

export type CommandType = (typeof CommandTypes)[keyof typeof CommandTypes];

export const AggregateTypes = {
  VOUCHER: "Voucher",
  INVOICE: "Invoice",
  ACCOUNT: "Account",
  PARTY: "Party",
  ITEM: "Item",
  COMPANY: "Company",
  FISCAL_YEAR: "FiscalYear",
  TAX: "Tax",
  NOTIFICATION: "Notification",
  AUDIT: "Audit",
  SYNC: "Sync",
  KHATA: "Khata",
} as const;

export type AggregateType = (typeof AggregateTypes)[keyof typeof AggregateTypes];
