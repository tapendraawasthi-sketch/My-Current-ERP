import { getDB } from './db';
import { useStore } from '../store/useStore';

export async function logMenuAction(
  action: string,
  details?: Record<string, any>
) {
  const db = getDB();
  const store = useStore.getState();
  await db.auditLogs?.add({
    action,
    userId: store.currentUser?.id,
    companyId: store.companySettings?.id,
    timestamp: new Date().toISOString(),
    details: JSON.stringify(details || {}),
    status: 'success',
  });
}
