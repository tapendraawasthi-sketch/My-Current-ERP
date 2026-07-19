# MAI-30 — Grounded Answer and Claim-Citation Verification

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0047](decisions/ADR_0047_CLAIM_CITATION_AUTHORITY.md)  
**Runtime:** `mai-30.0.2-slice2` (engineering; not production-approved)

## Objective

Annotate grounded-answer / claim-citation policy so unverified or insufficient
evidence must abstain — without executing a verifier or claiming legal proof —
then consume that policy into grounding / safe no-answer gates.

## Slice 1

1. Ingress `CLAIM_CITATION_*` after HYBRID_FUSION
2. `ClaimCitationBundleV1` when knowledge-source governance is COMPLETE
3. Claim-like cue detection (LEGAL_TAX, ACCOUNTING_RULE, ERP_FACT, …)
4. `grounded_answer_policy=ABSTAIN_WHEN_UNGROUNDED`
5. `claims_verified=false`; `citations_verified=false`; `verifier_executed=false`
6. `fake_citation_allowed=false`; `legal_proof_claimed=false`

## Slice 2

1. `resolve_grounded_answer_gate` / `should_emit_safe_no_answer`
2. `build_prompt_grounding(..., claim_citation=)` replaces block with
   `SAFE_NO_ANSWER_BLOCK` on `ABSTAIN_UNGROUNDED` / `BLOCKED`
3. Module + provider stages forward claim-citation into grounding
4. Still never marks VERIFIED / legal proof / execution authority

## Gates

| Case | Expect |
|------|--------|
| COMPLETE + fusion ready | COMPLETE; UNVERIFIED or INSUFFICIENT |
| Legal/tax cue + zero cites | `ABSTAIN_UNGROUNDED` + safe no-answer |
| Legal/tax + candidates | `ALLOW_WITH_CANDIDATES` (still unverified) |
| False verify flags | `BLOCKED` |
| OOD / SKIP | SKIP |
| Any bundle | never VERIFIED; never fake cites |

## Non-goals

- Closing GAP-P2-008 (consume landed; professional honesty review still open)
- Production approval
- Legal-proof registry
