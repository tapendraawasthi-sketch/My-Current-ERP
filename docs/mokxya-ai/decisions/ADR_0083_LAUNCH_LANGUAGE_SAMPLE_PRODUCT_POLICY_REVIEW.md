# ADR_0083 — Launch Language Sample Product-Policy Review (NEXT-09 / PR-A3)

- **Status:** Accepted (2026-07-19)
- **Step:** NEXT-09 / PR-A3
- **Gaps:** GAP-P1-009 → **REDUCED**; GAP-P1-012 launch-sample path recorded (R3O linguist scope remains CLOSED under ADR_0022)
- **Extends:** ADR_0082 scaffolds; ADR_0011 honesty (no false independent linguist)

## Context

NEXT-08 landed EN / Devanagari / Romanized scaffolds. Multilingual product
quality must not be engineering-self-certified only. A launch-slice sample
needs product-policy sign-off before staging hard-proof (PR-B).

## Decision

1. Export and review a frozen launch language sample (≥30 cases) covering
   sale / purchase / clarify / report / refuse × EN / Devanagari / Romanized.
2. Record decisions **PASS / FIX / DEFER** with case IDs under
   `docs/mokxya-ai/reviews/launch_language_sample/`.
3. Grant **`PRODUCT_POLICY_APPROVED` for the launch language slice only**
   (not “all Nepali forever”).
4. **Do not** set `LINGUIST_APPROVED=true` from this continuum alone;
   independent professional-linguist deepening remains optional residual
   (R3O MAI-07 linguist path already CLOSED under ADR_0022).
5. Blocking FIX count must be 0 before pointer advances; DEFER items listed
   as residual risk.
6. GAP-P1-009 = **REDUCED** (not CLOSED). Production still false.

## Rejected

| Alternative | Why |
|-------------|-----|
| Claim LINGUIST_APPROVED from AI/ continuum | Violates ADR_0011 |
| Close GAP-P1-009 forever | MAI-04 multilingual suite still HUMAN_REVIEW |
| Skip sample package | Staging/prod needs review evidence |

## Related

- `docs/mokxya-ai/MAI_LAUNCH_LANGUAGE_SAMPLE_REGISTRY.json`
- `docs/mokxya-ai/reviews/launch_language_sample/`
- `docs/mokxya-ai/baselines/NEXT_09_LAUNCH_LANGUAGE_SAMPLE_REVIEW.md`
