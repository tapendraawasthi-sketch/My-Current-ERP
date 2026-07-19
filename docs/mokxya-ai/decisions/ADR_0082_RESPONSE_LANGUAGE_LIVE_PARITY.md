# ADR_0082 — Response Language Live Parity (NEXT-08 / PR-A2)

- **Status:** Accepted (2026-07-19)
- **Step:** NEXT-08 / PR-A2
- **Extends:** ADR_0028 (MAI-11 response language + register)
- **Capability:** MAI-11 → scaffold consume on launch safe strings

## Context

MAI-11 set response-language / register policy and prompt directives, but
launch scaffolds (unsupported freeze, clarify fallback, Ask-mode mutation
refuse) stayed English-only. Shop users writing Devanagari or Romanized
Nepali got accidental English-only refusals.

## Decision

1. **Scaffold catalog** for launch-critical strings in ENGLISH /
   NEPALI_DEVANAGARI / ROMANIZED_NEPALI / MIXED.
2. **Infer language form** from user text (register service + script/
   romanized cues) and select scaffolds — **no SSE rewrite** of model
   output (`applied_response_rewrite=false`).
3. Claim **stable useful parity** for launch utterances, not literary Nepali.
4. Frozen ≥30 samples (10 EN / 10 Devanagari / 10 Romanized) covering
   sale / purchase / clarify / report / refuse families.
5. **Not** sole NLU; **not** production_approved; GAP-P1-009 / P1-012 stay
   OPEN for NEXT-09 linguist review.

## Rejected

| Alternative | Why |
|-------------|-----|
| Mechanical SSE rewrite of all replies | Names/IDs/citations must not be mangled |
| Claim literary Nepali / GAP-P1-009 CLOSED | Needs human linguist (NEXT-09) |
| Touch mode_aware_erp / khata draft bodies | Out of scope; known residual gap |

## Related

- `docs/mokxya-ai/MAI_RESPONSE_LANGUAGE_REGISTRY.json`
- `erp_bot/.../response_language_live_policy.py`
- `evals/mai11/frozen/response_language_live_parity_v1.jsonl`
