# MAI-07R3H English Identity Root Cause Report

Authority: repository code inspection plus non-frozen probes only.

Firewall:
- no frozen V2 case bodies opened
- no R3E/R3G-002 prediction rows or per-case audits read
- no frozen failure terms, ids, candidates, or acceptable-target sets used

## Branch Selection

Selected branch: **Branch B — Policy Generalization Defect**

Rejected branch: **Branch A — Path Integration Defect**

Reason:
- Product ingress calls `build_canonical_ai_request()` in `erp_bot/src/api/oip_chat_ingress.py`, which runs MAI-05, MAI-06, then `attach_transliteration_to_frame()`.
- Direct service/unit paths call `attach_transliteration_to_frame()` / `transliterate_frame()` directly.
- Non-frozen evaluators including `eval_mai07_r3f.py`, `eval_mai07_r3e.py`, `eval_mai07_r3c.py`, and `eval_mai07_r3g_reauthorized_002.py` all invoke the same transliteration service path.
- Frozen runner structure was inspected only at the orchestration level; it also routes through the same transliteration service without requiring frozen-body inspection.

Conclusion: the R3F guard was not bypassed by product or evaluator code paths. The defect was the policy itself plus the weakness of the prior non-frozen challenge set.

## Call-Path Audit

### A. Product ingress

`oip_chat_ingress.build_canonical_ai_request()`:
- builds canonical request
- attaches `LanguageFrameV1`
- attaches normalization
- attaches transliteration through `attach_transliteration_to_frame()`

Observed:
- transliteration runs after MAI-05/06 and before orchestration
- no separate product-only transliteration authority exists
- safe trace fields exclude raw text/candidate surfaces

### B. Canonical transliteration service

`transliteration_service.transliterate_frame()`:
- computes eligibility
- generates candidates
- ranks candidates
- applies identity-disposition reorder
- serializes bundle

R3H finding:
- R3F reordered after ranking, but on a pre-capped list
- this allowed ambiguous/shared cases to lose qualified Devanagari alternatives before final conservative identity handling

### C. Direct service / unit path

Tests and direct probes call the same transliteration service.

Observed:
- same inputs, same bundle schema, same candidate ordering semantics
- no evidence of a second post-rank mutator

### D. Non-frozen evaluator path

R3F/R3H non-frozen evaluators:
- analyze raw text
- call `attach_transliteration_to_frame()`
- score produced candidates

Observed:
- evaluator does not rebuild candidates through another transliteration stack
- candidate provenance, reason codes, and identity flags are preserved from the same service output

### E. Frozen evaluation runner structure

Inspected structurally only:
- historical runners also call the same transliteration attach path
- no frozen-body inspection was needed for this conclusion

## Evidence-Supported Conclusions

1. The R3F guard was invoked by product, direct-service, and evaluator paths.
2. The guard ran after ranking, but effectively after the ranker had already capped the candidate list.
3. No later serializer undid the reordering.
4. Evaluators did not use a different candidate generator path.
5. Guard/version metadata was only partially surfaced in evaluation artifacts; policy detail was not a first-class typed authority.
6. Protected/acronym checks were consistent; proper-name handling was conservative but too narrow when a name also had Romanized lexical evidence.
7. The guard received only local neighbor context, not a richer typed evidence lattice.
8. MAI-05 form, lexicon membership, and neighbor words were available, but candidate provenance and shared-term ambiguity were not modeled as one canonical policy.
9. The R3F logic still over-trusted shared Romanized/domain hits for business borrowings unless English context was very strong.
10. Product and evaluator context windows were effectively aligned, so context-window drift was not the primary cause.
11. MAI-05 English form alone was not intended to decide, but the earlier policy still let English-vs-Romanized collisions collapse too early.
12. Shared borrowed terms were under-modeled: a Romanized/domain hit remained too influential when the same surface was also a valid English business term.
13. The earlier non-frozen R3F holdout under-covered shared collisions, unresolved contexts, and richer counterfactual families relative to the failure mode indicated by the frozen aggregate facts.

## Root Cause

The failure was not a path bypass. It was a **policy generalization defect**:
- the R3F guard was too narrow for shared English/Romanized business terms
- it operated on a pre-capped candidate list
- the earlier non-frozen dataset was too synthetic and too weak on shared/borrowed-term counterfactuals to expose that gap before frozen evaluation

## Corrective Direction

R3H therefore:
- centralizes identity disposition as one typed authority
- reorders before final cap preservation
- adds a larger non-frozen dataset with shared-collision, counterfactual, protected, and OOV strata
- keeps frozen V2 completely untouched
