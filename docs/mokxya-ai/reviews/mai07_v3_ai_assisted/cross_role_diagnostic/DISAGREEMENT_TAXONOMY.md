# Disagreement taxonomy (MAI-07R3K)

Reason / risk codes used in diagnostics and the risk queue:

| Code | Meaning |
|------|---------|
| `DISPOSITION_DISAGREE` | Roles selected different dispositions |
| `NATURAL_CONTEXT_OK_CONFLICT` | `natural_context_ok` differs across roles |
| `ENGLISH_VS_DEVANAGARI_CONFLICT` | ENGLISH_IDENTITY vs DEVANAGARI_REQUIRED both present |
| `IDENTIFIER_CLASSIFICATION_CONFLICT` | Acronym/protected/name classification clash |
| `PROTECTED_VS_OTHER_CONFLICT` | PROTECTED coexists with another disposition |
| `NAME_ENTITY_POLICY_CONFLICT` | NAME_OR_ENTITY vs identity/Devanagari |
| `REVIEW_VS_REQUIRED_CONFLICT` | Soft/review disposition vs required decision |
| `ABSTAIN_PRESENT` | Any role selected ABSTAIN_CANNOT_DECIDE |
| `LOW_OR_MEDIUM_CONFIDENCE` | Any LOW/MEDIUM confidence |
| `SUSPECTED_AMBIGUITY_YES` | Any suspected_ambiguity=YES |
| `SOFT_OR_OPTIONAL_DISPOSITION` | CONTEXT_DEPENDENT / IDENTITY_FIRST / OPTIONAL present |
| `HEURISTIC_V1_SAFETY_SENSITIVE` | HEURISTIC_V1 + safety-sensitive disposition/confidence |
| `UNEXPECTED_ROLE_EVIDENCE` | Role cardinality mismatch vs expected 3/4 |

Taxonomy counts are descriptive. They do not create gold.
