# ADR_0049 — Durable Versioned Draft Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-32-DURABLE-VERSIONED-DRAFTS (slice 2)
- **Extends:** ADR_0001, ADR_0048

## Context

MAI-31 maps EventFrames to existing draft ports and emits `PAYLOAD_ONLY`
candidates without calling `start_or_merge_*`. Khata drafts today use
session-keyed local JSON under `ORBIX_DRAFT_STORE_DIR` with integer version
bumps — not a production DraftAggregate. MAI-32 must annotate durability /
version / concurrency policy and store readiness before any durable write
path. CR-31-01 / CR-32-01 keep `mode_aware_erp.py` and khata modules off the
Cursor heavy-edit lane.

## Decision

1. MAI-32 owns `DurableVersionedDraftBundleV1` on `CanonicalAIRequestV1`
   after DOMAIN_PORT_MAPPING.
2. Slice 1: when MAI-31 mapping is COMPLETE + SUPPORTED, declare version
   policy (`MONOTONIC_INT_BUMP`), concurrency
   (`OPTIMISTIC_EXPECTED_VERSION`), durability
   (`EPHEMERAL_LOCAL_JSON` / `NOT_PRODUCTION_AUTHORITY`), and read-only
   store path probe (`store_root_present` / `store_file_present`).
3. Slice 1 never calls `save_*`, `load_*`, `start_or_merge_*`, mode_aware,
   Dexie, or orbix drafts API: `draft_mutations=0`, `save_invoked=false`,
   `production_store_authority=false`, `draft_aggregate_ready=false`,
   `is_execution_authority=false`.
4. Incomplete / unsupported ports → annotate `AGGREGATE_PENDING` fail-closed;
   missing mapping → SKIP. Do not invent durable-write success.
5. Slice 2: consume builds `draft_aggregate_candidate` /
   `durable_consume_mode` (`CANDIDATE_ONLY` default; `BLOCKED` for
   aggregate-pending / production-authority claims; `SKIP` for read-only).
   Live path forces `allow_durable_write=false` — does **not** call
   `save_*` or edit khata. Still no AI journal math; Dexie remains calc
   authority on confirm.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Call save_* in annotation | Side effects / CR-32-01 |
| Live save_* in slice 2 | CR-32-01 / CR-32-02; GAP-P0-001 risk |
| Treat temp JSON as production aggregate | False authority (F-03) |
| Edit mode_aware / khata in slice 1–2 | CR-31-01 / CR-32-01 |
| Add third posting writer | Worsens GAP-P0-001 |

## Related

- `docs/mokxya-ai/MAI_32_DURABLE_VERSIONED_DRAFTS.md`
- `docs/mokxya-ai/baselines/MAI_32_SLICE2_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/durable_versioned_draft_service.py`
- `erp_bot/src/oip/modules/conversation/application/durable_versioned_draft_consume_service.py`
