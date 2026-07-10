import type { SyncEventEnvelope } from "./syncServerContracts";
import { validateSyncEnvelope } from "./syncEnvelope";

export function verifySyncEnvelopeIntegrity(envelope: SyncEventEnvelope): boolean {
  if (!validateSyncEnvelope(envelope)) return false;
  if (!envelope.hash || envelope.hash.length < 8) return false;
  return true;
}

export function verifyEnvelopeTenant(
  envelope: SyncEventEnvelope,
  trustedTenantId: string,
): boolean {
  return envelope.tenantId === trustedTenantId;
}
