# MAI-31 — EventFrame to Existing Domain Ports

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0048](decisions/ADR_0048_EVENTFRAME_DOMAIN_PORT_MAPPING_AUTHORITY.md)  
**Runtime:** `mai-31.0.1-slice1` (engineering; not production-approved)

## Objective

Declare how `EventFrameV1` maps to existing domain draft ports (mode_aware /
khata / Dexie) without executing those ports or inventing journal math.

## Slice 1

1. Ingress `DOMAIN_PORT_MAPPING_*` after CLAIM_CITATION
2. `DomainPortMappingBundleV1` from EventFrame `event_type`
3. Seed port table: purchase / sales / sales_return / financial family
4. Field-binding candidates (annotation only)
5. `port_executed=false`; `draft_mutations=0`; `dexie_invoked=false`;
   `journal_calculated=false`; `mode_aware_invoked=false`

## Slice 2 (planned)

Consume mapping into thin adapters wrapping existing `start_or_merge_*`
(still no AI journal balancer; unsupported → block/clarify).

## Gates

| Case | Expect |
|------|--------|
| purchase EventFrame | COMPLETE + SUPPORTED or INCOMPLETE |
| report / OOD / unknown | SKIP / NOT_APPLICABLE |
| purchase_return / unmapped | COMPLETE + UNSUPPORTED |
| Any bundle | never port_executed / never draft mutations |

## Non-goals

- Durable drafts (MAI-32)
- Preview UI (MAI-33)
- Confirm / OEC / posting
- Production approval
