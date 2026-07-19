# NEXT-08 — Response Language Live Parity (MAI-11 scaffolds)

**Date:** 2026-07-19  
**Step:** NEXT-08 / PR-A2  
**ADR:** ADR_0082  

## Decision

Launch-critical scaffolds select EN / Devanagari / Romanized / MIXED by
inferred response language. No SSE rewrite of model streams.

| Scaffold key | Wired into |
|--------------|------------|
| `unsupported_launch` | `launch_event_spec_policy` |
| `clarify_missing` | `clarification_plan_service` fallback |
| `ask_mode_mutation` | `orbix.mode_policy` (when lang/raw_text passed) |
| `confirm_preview_label` | catalog ready; UI consume optional |

## Evidence

- `docs/mokxya-ai/decisions/ADR_0082_RESPONSE_LANGUAGE_LIVE_PARITY.md`
- `docs/mokxya-ai/MAI_RESPONSE_LANGUAGE_REGISTRY.json`
- `erp_bot/.../response_language_live_policy.py`
- `evals/mai11/frozen/response_language_live_parity_v1.jsonl` (≥30)
- `erp_bot/tests/oip/language_runtime/test_mai_next08_response_language_live.py`
- `src/__tests__/orbix/maiNext08ResponseLanguage.test.ts`

## Explicit non-claims

- Not production_approved
- Not literary Nepali / sole NLU
- Not GAP-P1-009 / GAP-P1-012 CLOSED (NEXT-09)
- Not applied_response_rewrite

## Pointer

recommended_next_step → **NEXT-09** / PR-A3
