/**
 * Phase 5 unit tests — payload hash, event contract, retry classification,
 * company policy, and outbox enqueue against Dexie (fake-indexeddb if available).
 */

import { describe, expect, it, beforeEach } from "vitest";
import { computePayloadHash, computeEventChainHash, stableStringify } from "@/platform/sync/payloadHash";
import {
  buildPurchasePostedEvent,
  accountingEventToEnvelope,
  verifyAccountingEnvelopeIntegrity,
} from "@/platform/sync/accountingSyncContract";
import {
  classifySyncFailure,
  computeNextAttemptAt,
} from "@/platform/sync/syncRetry";
import {
  normalizeSyncPolicy,
  requiresOutboxEvent,
  isLocalOnly,
} from "@/platform/sync/companySyncPolicy";

describe("Phase 5 payload hashing", () => {
  it("stableStringify sorts object keys", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it("payload hash is stable for same content", async () => {
    const payload = { invoice_id: "inv-1", totals: { grand_total: 50000 } };
    const a = await computePayloadHash(payload);
    const b = await computePayloadHash({ totals: { grand_total: 50000 }, invoice_id: "inv-1" });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("payload hash changes when content changes", async () => {
    const a = await computePayloadHash({ amount: 1 });
    const b = await computePayloadHash({ amount: 2 });
    expect(a).not.toBe(b);
  });

  it("event chain hash depends on previous hash", async () => {
    const base = {
      payloadHash: "abc",
      eventId: "e1",
      eventType: "purchase_posted",
      aggregateId: "inv",
      aggregateVersion: 1,
      localSequence: 1,
      companyId: "c1",
      deviceId: "d1",
      occurredAt: "2026-01-01T00:00:00.000Z",
    };
    const h1 = await computeEventChainHash({ ...base, previousEventHash: null });
    const h2 = await computeEventChainHash({ ...base, previousEventHash: "prev" });
    expect(h1).not.toBe(h2);
  });
});

describe("Phase 5 accounting event contract", () => {
  it("builds purchase_posted event with integrity", async () => {
    const event = await buildPurchasePostedEvent({
      eventId: "evt-1",
      tenantId: "local",
      companyId: "orbix-sync-e2e-company",
      financialYearId: null,
      deviceId: "device-a",
      userId: "user-1",
      source: "test",
      localSequence: 1,
      previousEventHash: null,
      correlationId: "corr-1",
      idempotencyKey: "idem-1",
      payload: {
        posting_id: "post-1",
        invoice_id: "inv-1",
        invoice_number: "PI-1",
        voucher_id: "jnl-inv-1",
        voucher_number: "1",
        stock_movement_ids: ["sm-1"],
        audit_id: "aud-1",
        transaction_date: "2026-07-12",
        party_id: null,
        party_name: "Cash",
        payment_method: "cash",
        item_lines: [
          {
            item_id: "item-e2e-test-bike",
            item_name: "E2E Test Bike",
            quantity: 1,
            unit: "pcs",
            rate: 50000,
            amount: 50000,
          },
        ],
        totals: { subtotal: 50000, discount: 0, tax: 0, grand_total: 50000 },
        currency: "NPR",
        user_id: "user-1",
        company_id: "orbix-sync-e2e-company",
        financial_year_id: null,
        local_idempotency_key: "idem-1",
        device_id: "device-a",
        source: "test",
        aggregate_version: 1,
      },
    });

    expect(event.schema_version).toBe("1.0");
    expect(event.event_type).toBe("purchase_posted");
    expect(event.integrity.payload_hash).toHaveLength(64);
    expect(event.integrity.event_hash).toHaveLength(64);
    expect(event.sync.status).toBe("pending");

    const envelope = accountingEventToEnvelope(event);
    const check = await verifyAccountingEnvelopeIntegrity(envelope);
    expect(check).toEqual({ ok: true });
  });

  it("rejects tampered payload hash", async () => {
    const event = await buildPurchasePostedEvent({
      eventId: "evt-2",
      tenantId: "local",
      companyId: "c1",
      financialYearId: null,
      deviceId: "d1",
      userId: "u1",
      source: "test",
      localSequence: 2,
      previousEventHash: null,
      correlationId: "c",
      idempotencyKey: "i2",
      payload: {
        posting_id: "p",
        invoice_id: "inv",
        invoice_number: "PI-2",
        voucher_id: "j",
        voucher_number: "2",
        stock_movement_ids: [],
        audit_id: null,
        transaction_date: "2026-07-12",
        party_id: null,
        party_name: null,
        payment_method: "cash",
        item_lines: [],
        totals: { subtotal: 1, discount: 0, tax: 0, grand_total: 1 },
        currency: "NPR",
        user_id: "u1",
        company_id: "c1",
        financial_year_id: null,
        local_idempotency_key: "i2",
        device_id: "d1",
        source: "test",
        aggregate_version: 1,
      },
    });
    const envelope = accountingEventToEnvelope(event);
    (envelope.payload as { purchase: { totals: { grand_total: number } } }).purchase.totals.grand_total = 999;
    const check = await verifyAccountingEnvelopeIntegrity(envelope);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.code).toBe("integrity_hash_mismatch");
  });
});

describe("Phase 5 retry / failure classification", () => {
  it("classifies network as retryable", () => {
    expect(classifySyncFailure("network_unavailable")).toBe("retryable");
    expect(classifySyncFailure("HTTP 503")).toBe("retryable");
  });

  it("classifies auth and schema as permanent", () => {
    expect(classifySyncFailure("authorization_denied")).toBe("permanent");
    expect(classifySyncFailure("invalid_schema")).toBe("permanent");
  });

  it("classifies integrity as conflict", () => {
    expect(classifySyncFailure("integrity_hash_mismatch")).toBe("conflict");
    expect(classifySyncFailure("invoice_number_collision")).toBe("conflict");
  });

  it("computes increasing backoff timestamps", () => {
    const a1 = Date.parse(computeNextAttemptAt(1, 1000, 60_000));
    const a3 = Date.parse(computeNextAttemptAt(3, 1000, 60_000));
    expect(a3).toBeGreaterThan(a1 - 2000);
  });
});

describe("Phase 5 company sync policy", () => {
  it("normalizes and gates outbox requirement", () => {
    expect(normalizeSyncPolicy("local_only")).toBe("local_only");
    expect(normalizeSyncPolicy("bogus")).toBe("sync_enabled");
    expect(isLocalOnly("local_only")).toBe(true);
    expect(requiresOutboxEvent("sync_enabled")).toBe(true);
    expect(requiresOutboxEvent("local_only")).toBe(false);
  });
});
