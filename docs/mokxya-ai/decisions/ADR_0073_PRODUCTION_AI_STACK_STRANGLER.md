# ADR_0073 — Production AI Stack Strangler (GAP-P1-001)

- **Status:** Accepted (2026-07-19)
- **Step:** NEXT-03 (`MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt`)
- **Extends:** ADR_0001; ADR_0072 (mutation authority honesty)
- **Gap:** GAP-P1-001

## Context

`erp_bot` historically mounts multiple AI HTTP surfaces:

- Primary (product): `/orbix/chat/stream` (OIP ingress)
- Secondary: `/nios/v1`, `/orbix/v2`, `/v2/chat`, `/v2/chat/stream`

Parallel stacks create inconsistent memory/session behavior and widen the
production attack/review surface.

## Decision

1. **Primary entry remains** `/orbix/chat/stream` (+ OIP `/oip/v1`, Orbix
   drafts ack for Model B).
2. In **production** (`is_production_environment`), secondary stacks are
   **not mounted / not served** by default:
   - NIOS `/nios/v1`
   - Orbix v2 `/orbix/v2`
   - Legacy `/v2/chat` and `/v2/chat/stream`
3. **Non-production** keeps secondary mounts for local DX.
4. **Break-glass:** `MOKXYA_ALLOW_SECONDARY_AI_STACKS=true` re-enables
   secondary stacks even in production (explicit operator choice; not default).
5. Denied requests return `403` with `SECONDARY_AI_STACK_DISABLED` payload
   when a legacy route handler still exists and is hit while disabled.

## Rejected

| Alternative | Why |
|-------------|-----|
| Delete secondary code immediately | Breaks local DX / migration; large blast radius |
| Auth-only without mount gate | Still exposes inconsistent unauthenticated surfaces if misconfigured |
| Close GAP-P1-001 fully | Secondary code remains in tree; non-prod still mounts |

## Related

- `erp_bot/src/oip/domain/constitution/ai_stack_mount_policy.py`
- `erp_bot/src/api/server.py` mount gates
- `docs/mokxya-ai/MAI_00_GAP_REGISTER.md` GAP-P1-001
