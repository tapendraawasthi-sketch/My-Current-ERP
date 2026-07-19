# ADR_0032 — Reference, Coreference, and Correction Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-15-REFERENCE-COREFERENCE-AND-CORRECTION (slice 1)
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
3. Uses MAI-13 resolutions and MAI-14 turn-relation as signals only.
4. Slice 1 does **not** apply corrections into drafts or change merge gates.
5. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Apply amount corrections in slice 1 | Couples UX to first lexicon |
| Close GAP-P1-004/008 here | Needs broader MAI-04 proof + slice 2 consume |
| Promote FE discourse map as authority | Untyped; wrong layer |

## Related

- `docs/mokxya-ai/MAI_15_REFERENCE_COREFERENCE_AND_CORRECTION.md`
- `erp_bot/src/oip/modules/conversation/application/reference_coreference_service.py`
