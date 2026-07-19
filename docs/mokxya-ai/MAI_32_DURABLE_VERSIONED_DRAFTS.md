# MAI-32 — Durable Versioned Drafts

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0049](decisions/ADR_0049_DURABLE_VERSIONED_DRAFT_AUTHORITY.md)  
**Runtime:** `mai-32.0.1-slice1` (engineering; not production-approved)

## Objective

Annotate draft durability, version/concurrency policy, and store readiness
from MAI-31 port mapping — without writing drafts or claiming production
store authority.

## Slice 1

1. Ingress `DURABLE_VERSIONED_DRAFT_*` after DOMAIN_PORT_MAPPING
2. `DurableVersionedDraftBundleV1` when port mapping is COMPLETE
3. Version policy `MONOTONIC_INT_BUMP`; concurrency
   `OPTIMISTIC_EXPECTED_VERSION`; stale → `CONFLICT`
4. Durability `EPHEMERAL_LOCAL_JSON` + `LOCAL_JSON_NOT_PRODUCTION_AUTHORITY`
5. Read-only probe of `ORBIX_DRAFT_STORE_DIR` / known `*_drafts.json`
6. `save_invoked=false`; `draft_mutations=0`; `draft_aggregate_ready=false`

## Slice 2 (planned)

Consume into DraftAggregate / durable write adapters under explicit allow
flags (still no AI journal math; Dexie remains confirm calc authority).

## Gates

| Case | Expect |
|------|--------|
| purchase SUPPORTED | COMPLETE; ephemeral local JSON; zero mutations |
| report / OOD / SKIP mapping | SKIP |
| incomplete / unsupported | COMPLETE + AGGREGATE_PENDING |
| Any bundle | never save_*; never production store authority |

## Non-goals

- Live `save_*` / `start_or_merge_*`
- mode_aware / khata module edits
- Preview UI (MAI-33) / confirm (MAI-34)
- Production approval
