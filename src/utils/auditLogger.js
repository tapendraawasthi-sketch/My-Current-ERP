import axios from 'axios';

const AUDIT_API_URL = '/api/audit-log';

/**
 * Log an audit event.
 * @param {object} entry
 * @param {string} entry.action        - e.g. 'COMPANY_CREATED', 'BACKUP_TAKEN'
 * @param {string} entry.userId        - user performing the action
 * @param {string} entry.companyId     - company context
 * @param {string} [entry.oldValue]    - previous value if applicable
 * @param {string} [entry.newValue]    - new value if applicable
 * @param {'SUCCESS'|'FAILED'} entry.status
 * @param {string} [entry.failureReason]
 * @param {object} [entry.meta]        - any extra data
 */
export async function logAuditEvent(entry) {
  const payload = {
    action: entry.action,
    userId: entry.userId || 'unknown',
    companyId: entry.companyId || null,
    timestamp: new Date().toISOString(),
    oldValue: entry.oldValue || null,
    newValue: entry.newValue || null,
    status: entry.status || 'SUCCESS',
    failureReason: entry.failureReason || null,
    meta: entry.meta || {},
  };

  try {
    await axios.post(AUDIT_API_URL, payload);
  } catch (err) {
    // Never let audit log failure crash the UI — silently log to console
    console.error('[AuditLogger] Failed to send audit event:', err?.message);
    // Optionally: queue for retry
    queueFailedEvent(payload);
  }
}

// Simple in-memory retry queue (resets on page refresh — acceptable for MVP)
const failedQueue = [];
export function queueFailedEvent(payload) {
  failedQueue.push(payload);
}

export async function retryFailedEvents() {
  if (failedQueue.length === 0) return;
  const toRetry = [...failedQueue];
  failedQueue.length = 0;
  for (const payload of toRetry) {
    try {
      await axios.post(AUDIT_API_URL, payload);
    } catch {
      failedQueue.push(payload);
    }
  }
}

// Audit action name constants — use these everywhere, never magic strings
export const AUDIT_ACTIONS = {
  COMPANY_SELECTED: 'COMPANY_SELECTED',
  COMPANY_CREATED: 'COMPANY_CREATED',
  COMPANY_ALTERED: 'COMPANY_ALTERED',
  COMPANY_SHUT: 'COMPANY_SHUT',
  USER_CHANGED: 'USER_CHANGED',
  SECURITY_SETTINGS_CHANGED: 'SECURITY_SETTINGS_CHANGED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  ENCRYPTION_ENABLED: 'ENCRYPTION_ENABLED',
  ENCRYPTION_CHANGED: 'ENCRYPTION_CHANGED',
  BACKUP_TAKEN: 'BACKUP_TAKEN',
  RESTORE_PERFORMED: 'RESTORE_PERFORMED',
  DATA_MIGRATED: 'DATA_MIGRATED',
  DATA_SPLIT: 'DATA_SPLIT',
  DATA_REPAIRED: 'DATA_REPAIRED',
  CLOUD_BACKUP_TAKEN: 'CLOUD_BACKUP_TAKEN',
  SYNC_PERFORMED: 'SYNC_PERFORMED',
  IMPORT_COMPLETED: 'IMPORT_COMPLETED',
  EXPORT_COMPLETED: 'EXPORT_COMPLETED',
  REPORT_PRINTED: 'REPORT_PRINTED',
  REPORT_EMAILED: 'REPORT_EMAILED',
  SHARE_LINK_CREATED: 'SHARE_LINK_CREATED',
  WHATSAPP_SHARED: 'WHATSAPP_SHARED',
  LICENSE_ACTIVATED: 'LICENSE_ACTIVATED',
  LICENSE_RENEWED: 'LICENSE_RENEWED',
  ADDON_INSTALLED: 'ADDON_INSTALLED',
  ADDON_REMOVED: 'ADDON_REMOVED',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
  FEATURE_TOGGLED: 'FEATURE_TOGGLED',
};
