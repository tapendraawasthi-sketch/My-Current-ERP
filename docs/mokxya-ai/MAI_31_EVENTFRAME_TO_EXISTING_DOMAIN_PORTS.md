# MAI-31 — EventFrame to Existing Domain Ports

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0048](decisions/ADR_0048_EVENTFRAME_DOMAIN_PORT_MAPPING_AUTHORITY.md)  
**Runtime:** `mai-31.0.2-slice2` (engineering; not production-approved)

## Objective

Declare how `EventFrameV1` maps to existing domain draft ports (mode_aware /
khata / Dexie) without executing those ports or inventing journal math —
then consume into draft payload candidates for later adapter handoff.

## Slice 1

1. Ingress `DOMAIN_PORT_MAPPING_*` after CLAIM_CITATION
2. `DomainPortMappingBundleV1` from EventFrame `event_type`
3. Seed port table: purchase / sales / sales_return / financial family
4. Field-binding candidates (annotation only)
5. `port_executed=false`; `draft_mutations=0`; `dexie_invoked=false`;
   `journal_calculated=false`; `mode_aware_invoked=false`

## Slice 2

1. `resolve_port_consume_mode` / `build_draft_payload_candidate`
2. Default `PAYLOAD_ONLY` — EventFrame values → `field_overrides` candidate
3. Incomplete / unsupported → `BLOCKED`; read-only → `SKIP`
4. Live path forces `allow_port_invoke=false` (no `start_or_merge_*`, no
   mode_aware edits per CR-31-01)
5. Metadata: `port_consume_ready` + `draft_payload_candidate`

## Gates

| Case | Expect |
|------|--------|
| purchase EventFrame | COMPLETE + SUPPORTED → `PAYLOAD_ONLY` candidate |
| Incomplete / unsupported | `BLOCKED` |
| report / OOD / unknown | SKIP / NOT_APPLICABLE |
| Any live path | never port_executed / never draft mutations |

## Non-goals

- Live `start_or_merge_*` invoke (deferred; CR-31-01 / CR-31-02)
- Durable drafts (MAI-32)
- Preview UI (MAI-33)
- Confirm / OEC / posting
- Production approval
