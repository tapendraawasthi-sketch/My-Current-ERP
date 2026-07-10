export const EventTypes = {
  COMMAND_ACCEPTED: "CommandAccepted",
  VOUCHER_POSTED: "VoucherPosted",
  VOUCHER_UPDATED: "VoucherUpdated",
  VOUCHER_CANCELLED: "VoucherCancelled",
  INVOICE_POSTED: "InvoicePosted",
  INVOICE_UPDATED: "InvoiceUpdated",
  INVOICE_CANCELLED: "InvoiceCancelled",
  ACCOUNT_CREATED: "AccountCreated",
  ACCOUNT_UPDATED: "AccountUpdated",
  ACCOUNT_DELETED: "AccountDeleted",
  PARTY_CREATED: "PartyCreated",
  PARTY_UPDATED: "PartyUpdated",
  ITEM_CREATED: "ItemCreated",
  ITEM_UPDATED: "ItemUpdated",
  COMPANY_SETTINGS_UPDATED: "CompanySettingsUpdated",
  FISCAL_YEAR_CHANGED: "FiscalYearChanged",
  TDS_ENTRY_ADDED: "TdsEntryAdded",
  TDS_ENTRY_UPDATED: "TdsEntryUpdated",
  NOTIFICATION_ADDED: "NotificationAdded",
  NOTIFICATION_READ: "NotificationRead",
  NOTIFICATIONS_CLEARED: "NotificationsCleared",
  AUDIT_LOGS_LOADED: "AuditLogsLoaded",
  AUDIT_RECORD_ADDED: "AuditRecordAdded",
  SYNC_RECORD_ENQUEUED: "SyncRecordEnqueued",
  KHATA_ENTRY_POSTED: "KhataEntryPosted",
  HANDLER_FAILED: "HandlerFailed",
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

export const ALL_EVENT_TYPES: EventType[] = Object.values(EventTypes);
