# MAI-07R3H2 Shared Collision Root Cause Report

Authority: repository code inspection plus sealed non-frozen R3H holdout evidence only.

Firewall:
- no frozen V2 case bodies opened
- no frozen prediction rows used
- R3H lock/attempt/chain/qualification remain historical authority (not rewritten)
- R3H2 does not retune from frozen failures

## Parent Failure (MAI-07R3H)

R3H sealed non-frozen holdout = `FAILED_HOLDOUT_QUALITY`.

Concentrated failures (authoritative qualification/chain):
- unresolved shared identity-review accuracy **0/N** (identity top-1 without surviving review metadata)
- target-missing / mixed-population scorer defects (`max(1, den)`, population aliases, hard-coded denominators)
- counterfactual pair accuracy **0/N** under shared collision contexts

## Root Cause

### A. Shared-surface generation short-circuit

Shared English/Romanized collision surfaces were treated as `IDENTITY_ONLY` under the English-identity resource path. Candidate generation never produced Devanagari targets for those surfaces, so Nepali-context and optional-retention gates could not pass even when disposition later preferred a target.

### B. Disposition short-circuit via lexicon alone

Shared-surface disposition collapsed to English identity from lexicon membership alone, without decisive EN/NP/ambiguous context adjudication. Ambiguous contexts therefore never emitted authoritative `review_required` + reason codes on `TransliterationSpanV1`.

### C. Scorer defects

R3H-era scoring allowed empty or mismatched populations to look non-vacuous (`max(1, denominator)`), aliased populations incorrectly (e.g. target-missing numerator spanning gold-Devanagari cases while denominator was clear-romanized only), and hard-coded pass values. Required empty populations did not fail closed as `INVALID_REQUIRED_POPULATION`.

## Corrective Direction Selected

Branch combination **C + D + A** (not pure cap retention):

| Branch | Meaning |
|--------|---------|
| **C** | Shared-context disposition — decisive English → identity; decisive Nepali → target; else ambiguous identity-first + review |
| **D** | Shared-surface generation — `GENERATE` for shared collision so targets can exist pre-cap |
| **A** | Review metadata on spans — `review_required`, `review_reason_codes`, `disposition`, `policy_version` |

Rejected as sole fix: pure top-5 cap retention without generation/disposition/review authority.

## Evidence-Supported Conclusions

1. R3H improved clear English identity / false-Devanagari safety; remaining defect was shared-collision handling.
2. Lexicon-only English short-circuit prevented both generation and review metadata.
3. Scorer population binding was insufficiently strict for governance.
4. Mutation of sealed non-frozen trees by focused tests (GAP-P1-015) was a separate integrity defect addressed by canonical path guards + `tmp_path` builders.
