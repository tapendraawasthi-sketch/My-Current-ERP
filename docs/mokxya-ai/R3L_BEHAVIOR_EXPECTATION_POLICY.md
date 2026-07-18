# R3L Behavior Expectation Policy

Phase: MAI-07R3L-AI-ASSISTED-RUNTIME-CONFORMANCE-DIAGNOSTIC

## Purpose

Map AI-assisted, user-accepted Round A disposition labels to **behavioral** expectations for the active MAI-07 runtime. This is policy-conformance measurement, not language quality.

## Non-goals

- No exact Devanagari target spellings.
- No target-accuracy / acceptable-target-recall / linguistic-correctness claims.
- No majority voting as gold.
- No promotion of AI-assisted labels to independent human IRR.

## Exhaustive disposition mapping

| Review disposition | Behavior class | Unique top-1 gold? | Core expectation |
|--------------------|----------------|--------------------|------------------|
| ENGLISH_IDENTITY_REQUIRED | ENGLISH_IDENTITY | yes | Identity top-1; forbid false Devanagari top-1 |
| DEVANAGARI_TRANSLITERATION_REQUIRED | DEVANAGARI_TRANSLITERATION | **no** | Non-identity Devanagari candidate present@5 (script only) |
| IDENTITY_FIRST_REVIEW_REQUIRED | IDENTITY_FIRST | yes | Identity top-1; alternatives allowed |
| TRANSLITERATION_OPTIONAL | OPTIONAL | **no** | Identity retained@5; no unique top-1 scored |
| ACRONYM_OR_IDENTIFIER | ACRONYM | yes | Acronym identity top-1; no forced char-by-char |
| CONTEXT_DEPENDENT | CONTEXT_DEPENDENT | **no** | Identity available; diversity/review signal |
| ABSTAIN_CANNOT_DECIDE | ABSTAIN | **no** | No forced Devanagari rewrite |
| PROTECTED / NAME_OR_ENTITY / NO_TRANSLITERATION_ALLOWED | PROTECTED_OR_IDENTIFIER | yes | Identity retained; no mutation |
| Unknown | UNKNOWN_UNSUPPORTED | n/a | Fail closed; residual queue |

## Devanagari candidate definition

A Devanagari candidate must:

1. not be identity;
2. contain Devanagari script characters;
3. not be Latin-only rewrite;
4. not be digits/punctuation alone.

## Scoring applicability

- `SCORABLE` — behavior class applies.
- `UNSUPPORTED` — unknown disposition; not counted pass/fail.
- Span failures retained separately (`SPAN_FAILURE`).
