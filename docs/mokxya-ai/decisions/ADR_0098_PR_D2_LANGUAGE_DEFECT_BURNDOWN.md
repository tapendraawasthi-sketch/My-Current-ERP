# ADR_0098 — PR-D2 Language Defect Burn-down Pack

- **Status:** Accepted (2026-07-20)
- **Step:** PR-D2
- **Outcome:** Burn-down pack **READY**; defects not yet collected from prod

## Context

PR-C1-ARM remains BLOCKED. After launch, real EN / Nepali Devanagari /
Romanized failures must become frozen cases and fixes — without weakening
assertions (ADR_0095).

## Decision

1. File burn-down procedure at
   `docs/mokxya-ai/releases/LANGUAGE_DEFECT_BURNDOWN_V1.md`.
2. Require: capture utterance + expected + actual; add frozen case; fix;
   never delete/weaken honesty or language assertions to go green.
3. Mark `PR-D2 | PACK_READY` — `defects_collected=false` until real traffic.
4. Keep `recommended_next_step = PR-C1-ARM`.

## Explicit non-claims

- Not language quality CLOSED
- Not production_approved
- Not defects collected from live users
- Not assertion suites weakened

## Related

- ADR_0083 launch language sample; ADR_0095 vacuous-green forbid
- `artifacts/prod-ready-pr-d2/`
