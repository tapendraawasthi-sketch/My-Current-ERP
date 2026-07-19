# ADR_0047 — Grounded Answer / Claim-Citation Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-30-GROUNDED-ANSWER-AND-CLAIM-CITATION (slice 1)
- **Extends:** ADR_0001, ADR_0041, ADR_0046

## Context

MAI-29 assembles unverified evidence candidates. GAP-P2-008 tracks incomplete
knowledge/no-answer and citation honesty. Citation presence must never be
treated as claim verification. MAI-30 must annotate grounded-answer policy and
claim-citation gates before any consume that forces abstain/no-answer.

## Decision

1. MAI-30 owns `ClaimCitationBundleV1` on `CanonicalAIRequestV1` after
   HYBRID_FUSION.
2. Slice 1: when knowledge-source governance is COMPLETE, detect claim-like
   cues; set `grounded_answer_policy=ABSTAIN_WHEN_UNGROUNDED`;
   `citation_required=true`; `claims_verified=false`;
   `citations_verified=false`; `verifier_executed=false`;
   `legal_proof_claimed=false`; `fake_citation_allowed=false`;
   `verification_status` is `UNVERIFIED` or `INSUFFICIENT` only;
   `is_execution_authority=false`.
3. Slice 1 never runs a verifier model, never marks VERIFIED, never mutates
   drafts.
4. Slice 2+ may consume policy into response gating / safe no-answer; still
   must not invent legal proof.
5. GAP-P2-008 stays OPEN until consume + eval gates prove honesty;
   GAP-P2-001 / GAP-P1-004 / GAP-P1-008 unchanged.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Treat citations as verified claims | False authority / GAP-P2-008 |
| Allow ungrounded legal answers | Hallucinated authority risk |
| Allow fake citations | Explicit honesty failure |
| Run verifier LLM in annotation | Side effects / wrong slice |

## Related

- `docs/mokxya-ai/MAI_30_GROUNDED_ANSWER_AND_CLAIM_CITATION.md`
- `erp_bot/src/oip/modules/conversation/application/claim_citation_service.py`
