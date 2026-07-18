# MAI-07R3F — English Identity Non-Monotonicity Root Cause

**Authority:** Code inspection + independent non-frozen probes only.  
**Firewall:** No frozen V2 case IDs, sentences, candidate surfaces, or R3E per-case audits.

## Aggregate fact preserved from R3E (no case bodies)

| Signal | Value |
| --- | ---: |
| English identity population | 102 |
| English identity top-1 | 98/102 |
| False Devanagari on English | 4/102 |
| identity_corrected vs R3C | 4 |
| identity_harmed vs R3C | 4 |
| Net English identity improvement | 0 |

## Classification

### Primary — Final post-rank English identity guard missing

R3D ranking applies score boosts/penalties and then serializes. There is no disposition-authority reorder after ranking. Score deltas can swap identity and Devanagari for near-tied GENERATE spans, producing equal correct/harm counts with unchanged aggregates.

### Contributing — Dual eligibility paths for “English”

1. **Resource-backed English** (`english_identity` membership) → `IDENTITY_ONLY` (R3D). These cannot emit Devanagari-first. Explains **identity_corrected**.
2. **ENGLISH / TECHNICAL_ACCOUNTING_ENGLISH form with lexicon or domain hit, but not in `english_identity`** → `GENERATE`. `strong_romanized` forces `prefer_identity=False`, then `ROMANIZED_LEXICAL_BOOST` can place Devanagari first. Explains **identity_harmed** / remaining false Devanagari.

### Contributing — Domain borrowing treated as clear Romanized

Large overlap exists between `english_identity` and `domain_terms` / `romanized_lexicon`. Membership in the resource is fail-closed for identity; non-members that are domain borrowings remain GENERATE and are treated as strong Romanized evidence even in clear English sentences.

### Contributing — MAI-05 ENGLISH form alone is insufficient and unstable

Classifier default-Latin → ENGLISH for many alphabetic tokens. Using form alone for identity preference over-corrects some Romanized morphology; disabling preference whenever any lexicon hit exists under-corrects English identity outside the small resource set.

### Not primary (inspected)

| Hypothesis | Finding |
| --- | --- |
| Protected-span / raw-view mutations | R3E aggregates show 0; R3D hard gate retained |
| Cap displacement of identity | Identity retention before cap already present |
| Dedup changing identity position | Dedup is by surface; identity surface retained |
| Final serialization rewriting order | Serialization preserves ranked order; no English reorder step |
| Unicode/casefold mismatch | Lowercasing is consistent; not indicated as swap driver |
| Broad ranker rewrite needed | Not required; post-rank guard sufficient if monotonic |

## Required corrective shape (R3F)

Narrow **English Identity Guard** after candidate generation + contextual ranking, before bundle serialize:

- Multi-signal disposition (never MAI-05 ENGLISH alone).
- High-confidence English → identity rank-1; optional Devanagari retained below.
- High-confidence Romanized → do not suppress Dev-first.
- Shared/ambiguous → identity-first Option A.
- Candidate set stable (reorder only); protected hard gate untouched.

## Prohibited

- Opening R3E/V2 per-case failures.
- Tuning against frozen V1/V2.
- Broad ranker rewrite or overlay re-enable.
