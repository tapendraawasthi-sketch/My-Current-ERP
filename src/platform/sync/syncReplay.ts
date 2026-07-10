import { getEventRepository } from "@/platform/event-store/eventRepository";
import { buildSyncEnvelope } from "./syncEnvelope";
import { getIdentityProvider } from "@/platform/identity/identityProvider";
import { enqueueEventForSync } from "./syncQueue";

export async function replayEventsForSync(
  tenantId: string,
  fromGlobalSequence = 1,
): Promise<number> {
  const repository = getEventRepository();
  const events = await repository.readTenantStream(tenantId, fromGlobalSequence);
  const principal = getIdentityProvider().getPrincipal();
  let count = 0;

  for (const event of events) {
    const record = await repository.readRecordById(event.eventId);
    if (!record) continue;
    const envelope = buildSyncEnvelope(record, principal);
    if (!envelope.eventId) continue;
    await enqueueEventForSync(record);
    count += 1;
  }

  return count;
}
