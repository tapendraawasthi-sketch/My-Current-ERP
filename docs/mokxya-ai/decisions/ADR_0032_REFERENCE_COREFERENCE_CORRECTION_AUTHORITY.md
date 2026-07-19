# ADR_0032 — Reference, Coreference, and Correction Authority

- **Status:** Accepted (2026-07-19); slice 2 addendum same day
- **Phase:** MAI-15-REFERENCE-COREFERENCE-AND-CORRECTION (slice 2)
- **Extends:** ADR_0003, ADR_0031

## Context

Turn-relation (MAI-14) decides whether to bind a pending draft. Discourse still
needs typed mention/correction candidates (amount replace, prior-answer cues,
ambiguous pronouns) before NLU/slot application. FE `discourse.ts` and WSD
helpers are partial and untyped on the OIP request path.

## Decision

1. MAI-15 owns `ReferenceCoreferenceBundleV1` on `CanonicalAIRequestV1`.
2. Slice 1: deterministic lexicon produces mentions + correction candidates;
   `applied=false`, `silent_applications=0`, `draft_mutations=0`.
3. Slice 2: consume parseable AMOUNT corrections inside `mode_aware` only when
   `turn_relation == CORRECT_ACTIVE_DRAFT` and pending is purchase/sale;
   prove writes via `AppliedCorrectionReceipt` (do not flip candidate.applied).
4. `CONFIRMATION_INTENT` never applies corrections and never posts.
5. Does not widen `allows_pending_merge`. Gaps stay REDUCED.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Apply corrections in ingress | Wrong layer; bypasses mode/constitution |
| Flip candidate.applied=true | Violates annotation purity validators |
| Apply on ANSWER_CLARIFICATION | Overlays collide with normal clarify extract |
| Close GAP-P1-004/008 here | Needs broader MAI-04 proof |

## Related

- `docs/mokxya-ai/MAI_15_REFERENCE_COREFERENCE_AND_CORRECTION.md`
- `erp_bot/src/oip/modules/conversation/application/reference_coreference_service.py`
- `erp_bot/src/oip/integration/mode_aware_erp.py`
