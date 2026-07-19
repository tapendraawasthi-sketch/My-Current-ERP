# ADR_0048 — EventFrame → Domain Port Mapping Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-31-EVENTFRAME-TO-EXISTING-DOMAIN-PORTS (slice 1)
- **Extends:** ADR_0001, ADR_0036, ADR_0037

## Context

MAI-18/19 produce `EventFrameV1` skeletons and values. Live drafts still come
from `mode_aware_erp` → khata `start_or_merge_*` → Dexie on confirm. MAI-31
must introduce a typed EventFrame→existing-domain-port mapping boundary before
any consume that creates drafts. AI modules must not invent journal math or a
second posting writer (GAP-P0-001).

## Decision

1. MAI-31 owns `DomainPortMappingBundleV1` on `CanonicalAIRequestV1` after
   CLAIM_CITATION.
2. Slice 1: when an EventFrame is present, map `event_type` to a seed port
   table (`port_id`, `draft_entrypoint`, field bindings). Statuses are
   `COMPLETE` / `SKIP` with `support_status` in
   `{SUPPORTED, UNSUPPORTED, INCOMPLETE, NOT_APPLICABLE}`.
3. Slice 1 never calls `mode_aware`, never invokes `start_or_merge_*`, never
   touches Dexie, never calculates journals, never mutates drafts:
   `port_executed=false`, `draft_mutations=0`, `dexie_invoked=false`,
   `journal_calculated=false`, `mode_aware_invoked=false`,
   `lookup_executed=false`, `master_lookup_mode=ANNOTATION_ONLY`,
   `is_execution_authority=false`.
4. Unmapped / incomplete mappings fail closed (annotate UNSUPPORTED /
   INCOMPLETE); do not invent draft success.
5. Slice 2+ may wrap existing draft entrypoints behind this mapping; still no
   AI authoritative balancing; Dexie remains calc authority on confirm.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Call mode_aware in annotation | Side effects / wrong slice |
| New AI journal balancer | Authority violation / dual calc |
| Silent draft on unmapped types | Fail-open hallucination of ports |
| Expand Node confirm writer | Worsens GAP-P0-001 |

## Related

- `docs/mokxya-ai/MAI_31_EVENTFRAME_TO_EXISTING_DOMAIN_PORTS.md`
- `erp_bot/src/oip/modules/conversation/application/domain_port_mapping_service.py`
