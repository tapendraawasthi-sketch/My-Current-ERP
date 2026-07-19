# MAI-32 — Durable Versioned Drafts

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0049](decisions/ADR_0049_DURABLE_VERSIONED_DRAFT_AUTHORITY.md)  
**Runtime:** `mai-32.0.2-slice2` (engineering; not production-approved)

## Objective

Annotate draft durability, version/concurrency policy, and store readiness
from MAI-31 port mapping — then consume into DraftAggregate candidates —
without writing drafts or claiming production store authority.

## Slice 1

1. Ingress `DURABLE_VERSIONED_DRAFT_*` after DOMAIN_PORT_MAPPING
2. `DurableVersionedDraftBundleV1` when port mapping is COMPLETE
3. Version policy `MONOTONIC_INT_BUMP`; concurrency
   `OPTIMISTIC_EXPECTED_VERSION`; stale → `CONFLICT`
4. Durability `EPHEMERAL_LOCAL_JSON` + `LOCAL_JSON_NOT_PRODUCTION_AUTHORITY`
5. Read-only probe of `ORBIX_DRAFT_STORE_DIR` / known `*_drafts.json`
6. `save_invoked=false`; `draft_mutations=0`; `draft_aggregate_ready=false`

## Slice 2

1. `resolve_durable_draft_consume_mode` / `build_draft_aggregate_candidate`
2. Default `CANDIDATE_ONLY` — merges MAI-31 `field_overrides` into candidate
3. Aggregate pending / prod-authority claims → `BLOCKED`; read-only → `SKIP`
4. Live path forces `allow_durable_write=false` (no `save_*`, no khata edits)
5. Metadata: `durable_consume_ready` + `draft_aggregate_candidate`

## Gates

| Case | Expect |
|------|--------|
| purchase SUPPORTED | COMPLETE → `CANDIDATE_ONLY` aggregate candidate |
| Aggregate pending / prod claim | `BLOCKED` |
| report / OOD / SKIP mapping | SKIP |
| Any live path | never save_*; never production store authority |

## Non-goals

- Live `save_*` / `start_or_merge_*` (CR-32-01)
- mode_aware / khata module edits
- Preview UI (MAI-33) / confirm (MAI-34)
- Production approval
