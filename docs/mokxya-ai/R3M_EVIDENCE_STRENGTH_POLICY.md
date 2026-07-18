# R3M Evidence Strength Policy

| Strength | Meaning | May authorize |
|----------|---------|---------------|
| USER_ACCEPTED_ACCOUNTING_CONTENT_MAP | User-accepted accounting map; clearer engineering signal | Code/test candidates when stage supported |
| USER_ACCEPTED_HEURISTIC_REFERENCE | User-accepted heuristic | Diagnostics, property tests, review selection — **not** lexicon/targets |
| LOW_CONFIDENCE_REFERENCE | Low confidence | Human review |
| AMBIGUOUS_REFERENCE | Suspected ambiguity | Human review |
| INSUFFICIENT_LINGUISTIC_EVIDENCE | Needs spelling/linguist judgment (e.g. Devanagari without targets) | Professional linguist queue |
| SPAN_UNRESOLVED | Ambiguous/missing span | Blocked / no first-match repair |

HEURISTIC_V1 alone must not authorize lexicon additions, exact transliteration targets, production rules, or linguistic correctness claims.
