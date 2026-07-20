# ADR_0094 — PR-H3 Secondary AI Stack Quarantine

- **Status:** Accepted (2026-07-20)
- **Step:** PR-H3 / NEXT-H3
- **Extends:** ADR_0073 (production mount strangler)
- **Gap:** GAP-P1-001 (remains **REDUCED**, not CLOSED)

## Context

NEXT-03 / ADR_0073 already disables secondary AI HTTP stacks in production
by default. Secondary **code** remains for non-prod DX. PR-H3 requires an
explicit quarantine inventory so “parallel prototypes” are not treated as
product surfaces and are not deleted unsafely.

## Decision

1. **Quarantine disposition:** `QUARANTINED_NON_PROD_ONLY` for listed
   secondary stacks — mounted only when `secondary_ai_stacks_allowed()`
   is true (non-prod or break-glass).
2. **Do not delete** secondary modules in this ship (blast radius / DX).
3. **Primary product entry remains** `/orbix/chat/stream`.
4. Machine-check inventory + production-default denial remain green.
5. GAP-P1-001 stays **REDUCED** until secondary code is retired or an
   owner-accepted CLOSED residual is filed.
6. Keep `recommended_next_step = PR-C1-ARM` (arm still human-blocked).

## Inventory (quarantined)

| Stack ID | Mount prefix | Module (representative) |
|----------|--------------|-------------------------|
| NIOS_V1 | `/nios/v1` | `erp_bot/src/nios/api.py` |
| ORBIX_V2 | `/orbix/v2` | `erp_bot/src/orbix/api.py` |
| LEGACY_V2_CHAT_STREAM | `/v2/chat/stream` | `erp_bot/src/api/streaming.py` |
| LEGACY_V2_CHAT | `/v2/chat` | legacy chat handlers via server mount |

## Falcon orphan UI (GAP-P3-001 REDUCED)

Unused user-facing chrome (no importers outside `src/components/falcon/`):

| ID | Path |
|----|------|
| FALCON_PANEL | `src/components/falcon/FalconPanel.tsx` |
| FALCON_LAUNCHER | `src/components/falcon/FalconLauncher.tsx` |
| FALCON_THINKING_PANEL | `src/components/falcon/FalconThinkingPanel.tsx` |

**Retained:** `FalconProvider`, `src/lib/falcon/**`, `falconStore` (Orbix remap / helpers).

## Explicit non-claims

- Not GAP-P1-001 CLOSED
- Not GAP-P3-001 CLOSED (REDUCED only)
- Not secondary code deleted
- Not Falcon tree deleted
- Not production_approved
- Not break-glass enabled by default

## Related

- `docs/mokxya-ai/MAI_SECONDARY_AI_STACK_QUARANTINE_REGISTRY.json`
- `erp_bot/src/oip/domain/constitution/ai_stack_mount_policy.py`
- `erp_bot/src/oip/modules/conversation/application/secondary_ai_stack_quarantine_policy.py`
- `src/platform/hygiene/deadParallelAiQuarantinePolicy.ts`
- `artifacts/prod-ready-pr-h3/`
- `docs/mokxya-ai/baselines/PR_H3_SECONDARY_AI_STACK_QUARANTINE.md`
