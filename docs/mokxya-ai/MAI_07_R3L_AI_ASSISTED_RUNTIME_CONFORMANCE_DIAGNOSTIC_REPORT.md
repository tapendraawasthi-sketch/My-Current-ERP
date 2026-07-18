# MAI-07R3L — AI-Assisted Runtime Conformance Diagnostic

**Verdict:** `PASSED_ENGINEERING_DIAGNOSTIC`  
**Date:** 2026-07-17  
**Semantic hash:** `ca134c346414a2d30a448dddabb72287eac809965165a1a037431ee7c3cad6de`

## Explicit non-claims

This phase is **not** independent human review, professional-linguist evaluation, transliteration-quality scoring, official Round A, Round B, frozen V3, training data, runtime tuning, RC selection, or production approval.

`runtime_conformance_is_language_quality=false`. No exact Devanagari target spellings were invented.

## Authorities verified

| Authority | Value |
|-----------|-------|
| Accounting ZIP raw | `f558fefdc186ba79bbe2a8757569204b88ce1aa1ed27400cda7705c1551cdb68` |
| Accounting import semantic | `b96bec29e30ddcdc6dce1a5ef09a2003ee9de003a336cd98b43341c6e55e363b` |
| Remaining-role import semantic | `1cc783d79cc3cc5f3f2daa288ae8b4721238fed584dbfb540597c8f883a8f4a1` |
| R3K semantic | `42d1a5ffc170d201f8a4bf92e4cef4f156dde57c07e847c960835e26080ddafc` |
| R3K authority manifest | `65bfa6847a8d3d58af4e092f4217d65b3b6e5d51035c401e7304be1ed77fe2b8` |
| Runtime | `mai-07.1.3-r3f-sealnew` |
| Resource hash | `1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930` |
| Overlay | disabled |

Populations: 1111 cases · 611 accounting-map · 500 heuristic · 3944 judgments · 700 R3K risk-queue.

## Pipeline

Real active sequence (read-only):

`analyze_language` (MAI-05) → `attach_normalization_to_frame` (MAI-06) → `transliterate_frame` (eligibility / generate / rank / English-identity guard).

Evidence status: `NON_INDEPENDENT_AI_ASSISTED_USER_ACCEPTED_POLICY_REFERENCE`.  
Agreement status: `NON_INDEPENDENT_AI_OUTPUT_SIMILARITY_ONLY`.  
`majority_is_gold=false`.

## Outcomes

| Outcome | Count |
|---------|------:|
| PASS | 769 |
| FAIL | 328 |
| SPAN_FAILURE | 14 |
| EXCEPTION | 0 |

Span resolution: 14 `SPAN_AMBIGUOUS` (retained in residual queue; never silently first-match).

## Selected conformance metrics (integer N/D)

| Metric | Population | N/D | Rate |
|--------|------------|----:|-----:|
| identity_top1 | ENGLISH_IDENTITY | 233/241 | 0.967 |
| identity_retained_at_5 | ENGLISH_IDENTITY | 238/241 | 0.988 |
| false_devanagari_top1 | ENGLISH_IDENTITY | 5/241 | 0.021 |
| devanagari_candidate_present_at_5 | DEVANAGARI_BEHAVIOR | 142/316 | 0.449 |
| devanagari_candidate_top1 | DEVANAGARI_BEHAVIOR | 123/316 | 0.389 |
| identity_first_top1 | IDENTITY_FIRST | 197/216 | 0.912 |
| optional identity_retained_at_5 | OPTIONAL | 39/43 | 0.907 |
| acronym identity_top1 | ACRONYM | 71/72 | 0.986 |
| pass_rate | ALL_CASES | 769/1097 | 0.701 |
| pass_rate | ACCOUNTING_CONTENT_MAP | 473/604 | 0.783 |
| pass_rate | HEURISTIC_V1 | 296/493 | 0.600 |
| pass_rate | R3K_RISK_QUEUE | 487/690 | 0.706 |
| pass_rate | R3K TIER_2_HIGH | 296/494 | 0.599 |
| pass_rate | R3K TIER_3_MEDIUM | 191/196 | 0.974 |
| caps_respected | ALL_CASES | 1111/1111 | 1.0 |

Devanagari metrics are **script/disposition presence only** — not spelling accuracy.

## Safety invariants

| Invariant | Value |
|-----------|------:|
| raw mutations | 0 |
| protected mutations | 0 |
| exceptions | 0 |
| caps respected | 1.0 |
| accounting mutation attempts | 0 |
| successful mutations | 0 |
| CRITICAL_DIAGNOSTIC_FINDING | false |

## Residual risk

| Tier | Count |
|------|------:|
| TIER_1_CRITICAL | 8 |
| TIER_2_HIGH | 328 |
| TIER_3_MEDIUM | 493 |
| **Total** | **829** |

Primary drivers: missing Devanagari script candidates, identity not top-1/retained, soft confidence/ambiguity, heuristic safety-sensitive, 8 false forced-Devanagari-top1 on identity-like classes, 14 ambiguous spans.

## Targeted packet

65 Item | Value |
|------|------:|
| Rows | 65 (≤200) |
| Critical included | 8/8 |
| Official inbox writes | 0 |
| Leakage audit | passed |

Private mapping: `use=adjudication_import_only`, `prohibited_for_runtime=true`, `prohibited_for_training=true`.

## Evidence root

`docs/mokxya-ai/reviews/mai07_v3_ai_assisted/runtime_conformance_diagnostic/`

## Governance

All quality/independence/lock/Round-B/frozen-V3 flags remain **false**.  
`prohibited_for_training=true`.  
MAI-07=`NEEDS_CORRECTIVE_WORK`. MAI-08=`NOT_STARTED`.

## Recommended next phase

Based on residual findings (policy mismatches + ambiguous spans + missing Devanagari candidates under AI policy reference):

**MAI-07R3M-AI-ASSISTED-POLICY-MISMATCH-TRIAGE** — human-efficient triage of TIER_1/TIER_2 residual clusters without authorizing Round B or frozen V3.
