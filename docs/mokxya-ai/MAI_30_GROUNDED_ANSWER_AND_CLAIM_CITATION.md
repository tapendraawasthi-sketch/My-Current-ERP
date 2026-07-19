# MAI-30 — Grounded Answer and Claim-Citation Verification

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0047](decisions/ADR_0047_CLAIM_CITATION_AUTHORITY.md)  
**Runtime:** `mai-30.0.1-slice1` (engineering; not production-approved)

## Objective

Annotate grounded-answer / claim-citation policy so unverified or insufficient
evidence must abstain — without executing a verifier or claiming legal proof.

## Slice 1

1. Ingress `CLAIM_CITATION_*` after HYBRID_FUSION
2. `ClaimCitationBundleV1` when knowledge-source governance is COMPLETE
3. Claim-like cue detection (LEGAL_TAX, ACCOUNTING_RULE, ERP_FACT, …)
4. `grounded_answer_policy=ABSTAIN_WHEN_UNGROUNDED`
5. `claims_verified=false`; `citations_verified=false`; `verifier_executed=false`
6. `fake_citation_allowed=false`; `legal_proof_claimed=false`

## Slice 2 (planned)

Consume policy into response gating / safe no-answer when ungrounded
(still no false VERIFIED).

## Gates

| Case | Expect |
|------|--------|
| COMPLETE + fusion ready | COMPLETE; UNVERIFIED or INSUFFICIENT |
| Legal/tax cue | cue present; still unverified |
| OOD / SKIP | SKIP |
| Any bundle | never VERIFIED; never fake cites |

## Non-goals

- Closing GAP-P2-008 in slice 1
- Production approval
- Legal-proof registry
