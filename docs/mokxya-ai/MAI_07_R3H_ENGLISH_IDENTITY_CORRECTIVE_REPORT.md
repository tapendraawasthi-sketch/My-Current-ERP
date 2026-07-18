# MAI-07R3H English Identity Corrective Report

## Verdict

**MAI-07R3H = FAILED_HOLDOUT_QUALITY**

This phase remained strictly non-frozen. No frozen V2 execution occurred.

## Implemented

- Refactored `english_identity_guard.py` into a canonical typed identity-disposition authority.
- Preserved one-path invocation through `transliteration_service.py`.
- Moved the identity/target preference reorder to operate before the final capped serialize.
- Added R3H non-frozen dataset builder, threshold manifest, RC lock-chain artifacts, one-shot holdout runner, and focused R3H tests.
- Preserved historical R3F/R3G active defaults and historical frozen/lock-chain evidence.

## R3H Dataset

Manifest: `evals/mai07_r3h_english_identity/MAI_07R3H_DATASET_MANIFEST.json`

Coverage:
- English identity cases: 906
- Shared collision cases: 319
- Clear Romanized controls: 688
- Counterfactual pairs: 290
- OOV cases: 260
- Technical English cases: 210
- Names/acronyms/identifiers: 472
- Protected-span cases: 440
- Ambiguous cases: 377

Split totals:
- DEVELOPMENT: 401
- HOLDOUT_VALIDATION: 711
- SAFETY_CHALLENGE: 885
- CONTEXT_COUNTERFACTUAL: 966
- OOV_GENERALIZATION: 260

## RC Lock

Locked RC body:
- `evals/mai07_r3h_english_identity/MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001.LOCKED_NOT_RUN.json`

Key hashes:
- lock semantic: `7870e554f6b71d15d4bb93e1a1816993e441add2a00f281f44580708645ac725`
- lock raw: `44473ba9fbd64994fffbbe1a38fd0c25457f10e36f0c2f1349bba3ca17419690`

Threshold manifest:
- `evals/mai07_r3h_english_identity/MAI_07R3H_THRESHOLDS.json`

## One-Shot Holdout

Attempt artifact:
- `evals/mai07_r3h_english_identity/MAI_07R3H_HOLDOUT_ATTEMPT_001.json`

Chain artifact:
- `evals/mai07_r3h_english_identity/MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001.CHAIN_MANIFEST.json`

The one-shot non-frozen evaluation was consumed once and is not eligible for silent rerun.

## Outcome

Passed:
- overall English identity top-1
- shared English-context identity top-1
- false Devanagari on clear English
- technical English identity top-1
- name identity top-1
- acronym/identifier identity top-1
- clear Romanized target top-1
- clear Romanized recall@5
- cross-path parity
- policy invocation coverage
- candidate-set preservation
- caps respected
- determinism
- protected/raw mutation gates

Failed gates:
- unresolved shared identity-review accuracy — HOLDOUT **0/19** (threshold ≥0.98); SAFETY **0/10**; COUNTERFACTUAL **0/29**
- target missing-from-top5 rate — HOLDOUT **43/229** (threshold ≤0.02); SAFETY **10/229**
  (note: scorer numerator spans all cases with gold Devanagari; denominator is clear-romanized count only)
- counterfactual pair accuracy — CONTEXT_COUNTERFACTUAL **0/29** (threshold ≥0.95)

Authoritative consumed metrics: `MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001.QUALIFICATION_RESULT.json` + `.CHAIN_MANIFEST.json` (not any later regenerated on-disk score report).

Interpretation:
- the new canonical policy solved the English identity / false-Devanagari safety side
- the remaining defect is now concentrated in ambiguous shared-term handling and retention of qualified Devanagari alternatives within the top-5 window under unresolved/shared contexts

## Governance

- `QUALITY_GATES_PASSED` remains false
- `AUTOMATED_ENGINEERING_GATES_PASSED` remains false for MAI-07 overall
- `LINGUIST_APPROVED` remains false
- `PRODUCTION_APPROVED` remains false
- `MAI-07` remains `NEEDS_CORRECTIVE_WORK`
- `MAI-08` remains `NOT_STARTED`

## Recommendation

Do not run frozen V2.

Recommended next governed phase:
**MAI-07R3H2-SHARED-COLLISION-CORRECTIVE**

Reason:
- R3H isolated the remaining failure mode to shared/ambiguous collision handling under counterfactual and review-heavy contexts, using non-frozen evidence only.
