# V3 Source Provenance Policy

Allowed provenance classes:
- NEW_HUMAN_AUTHORED
- LICENSED_PUBLIC_CORPUS
- OFFICIAL_PUBLIC_TEXT_WITH_PERMITTED_EVALUATION_USE
- INDEPENDENT_ENGINEERING_SCENARIO
- PROFESSIONAL_REVIEWER_SUBMITTED

Forbidden sources for V3 authoring:
- V1/V2 case bodies
- Frozen prediction rows / failed case IDs / acceptable-target sets
- Prior blind mappings as gold
- Consumed holdout bodies
- Runtime prediction outputs as gold
- Runtime lexicon-authored gold labels

All items: `prohibited_for_training=true`.
No PII / real account identifiers (synthetic tokens only).
If coverage cannot be met independently: `BLOCKED_SOURCE_DATA_REQUIRED`.
