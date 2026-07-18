# Risk-queue policy (MAI-07R3K)

## Inclusion

A case enters the risk queue when **any** of these hold:

1. Role dispositions disagree
2. Any confidence is LOW or MEDIUM
3. Any `suspected_ambiguity=YES`
4. Any ABSTAIN_CANNOT_DECIDE
5. CONTEXT_DEPENDENT, IDENTITY_FIRST_REVIEW_REQUIRED, or TRANSLITERATION_OPTIONAL appears
6. Acronym / protected / name classifications conflict
7. English identity conflicts with Devanagari-required
8. `natural_context_ok` conflicts across roles
9. Source method is HEURISTIC_V1 and the decision is safety-sensitive
10. Role evidence cardinality is unexpected

## Tiers (transparent; not an opaque score)

| Tier | Triggers (examples) |
|------|---------------------|
| TIER_1_CRITICAL | English↔Devanagari, protected vs other, identifier class conflicts |
| TIER_2_HIGH | Disposition disagree, review↔required, heuristic safety-sensitive, abstain |
| TIER_3_MEDIUM | Soft/optional, low/medium confidence, ambiguity, natural-context conflict |
| TIER_4_LOW | Other residual flags |

Ordering: tier ascending, then `diagnostic_case_id`.

## Authority

Risk-queue membership is an **engineering prioritization** aid only. It does not freeze gold, approve linguists, lock Round A, or authorize Round B.
