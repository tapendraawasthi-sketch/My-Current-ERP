# V3 Dataset Design

Two pools (family-level hash split; reviewers cannot see assignment):

1. **POLICY_DEVELOPMENT** — may open after adjudication; never frozen-quality evidence.
2. **FROZEN_EVALUATION** — sealed after adjudication; opened only after new candidate + thresholds locked.

Split seed recorded before human review: see `V3_PACKET_MANIFEST.json`.

Purpose dimensions: English identity, Romanized Nepali, shared context, generation,
ranking/top-5, unambiguous top-1, multi-token, accounting terms, names/entities,
acronyms/ids, protected spans, ambiguity/review, unicode/cap safety.

Scope: MAI-07 only (not MAI-08 typo/code-mix expansion).
