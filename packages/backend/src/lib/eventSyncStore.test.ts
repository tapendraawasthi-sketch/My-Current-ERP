/**
 * Backend file-store ingest tests (no Postgres required).
 * Run: ORBIX_SYNC_TEST_MODE=true npx tsx packages/backend/src/lib/eventSyncStore.test.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ingestSyncEnvelope, pullSyncEvents, resetE2ESyncStore } from "./eventSyncStore.js";

process.env.ORBIX_SYNC_TEST_MODE = "true";
process.env.ORBIX_SYNC_USE_FILE_STORE = "true";
process.env.ORBIX_SYNC_STORE_PATH = path.join(process.cwd(), ".data-test-sync");

async function main() {
  const storeDir = process.env.ORBIX_SYNC_STORE_PATH!;
  fs.rmSync(storeDir, { recursive: true, force: true });
  fs.mkdirSync(storeDir, { recursive: true });

  const companyId = "orbix-sync-e2e-company";
  await resetE2ESyncStore(companyId).catch(() => 0);

  const envelope = {
    eventId: "evt-test-1",
    eventType: "purchase_posted",
    aggregateType: "purchase",
    aggregateId: "inv-1",
    aggregateVersion: 1,
    timestamp: new Date().toISOString(),
    hash: "eventhash111",
    payload: {
      company_id: companyId,
      idempotency_key: "idem-test-1",
      integrity: {
        payload_hash: "payloadhash111",
        event_hash: "eventhash111",
        previous_event_hash: null,
      },
      purchase: {
        invoice_id: "inv-1",
        invoice_number: "PI-SYNC-1",
        voucher_number: "1",
        totals: { grand_total: 100 },
      },
    },
  };

  const first = await ingestSyncEnvelope({
    tenantId: "local",
    companyId,
    deviceId: "device-a",
    envelope,
  });
  assert.equal(first.status, "accepted");
  assert.ok(first.remote_sequence);

  const dup = await ingestSyncEnvelope({
    tenantId: "local",
    companyId,
    deviceId: "device-a",
    envelope,
  });
  assert.equal(dup.status, "duplicate");
  assert.equal(dup.remote_sequence, first.remote_sequence);

  const tampered = await ingestSyncEnvelope({
    tenantId: "local",
    companyId,
    deviceId: "device-a",
    envelope: {
      ...envelope,
      hash: "eventhash111",
      payload: {
        ...envelope.payload,
        integrity: {
          ...envelope.payload.integrity,
          payload_hash: "CHANGED",
          event_hash: "eventhash111",
        },
      },
    },
  });
  assert.equal(tampered.status, "conflict");
  assert.equal(tampered.error_code, "integrity_hash_mismatch");

  const pulled = await pullSyncEvents({
    tenantId: "local",
    companyId,
    sinceRemoteSequence: 0,
  });
  assert.equal(pulled.events.length, 1);
  assert.equal(pulled.events[0].event_id, "evt-test-1");

  const otherCompany = await pullSyncEvents({
    tenantId: "local",
    companyId: "orbix-other-e2e-company",
    sinceRemoteSequence: 0,
  });
  assert.equal(otherCompany.events.length, 0);

  const deleted = await resetE2ESyncStore(companyId);
  assert.ok(deleted >= 1);

  console.log("eventSyncStore.test.ts: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
